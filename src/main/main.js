'use strict';

const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { execFile, spawn } = require('node:child_process');
const {
  app, BrowserWindow, Tray, Menu, ipcMain, screen, protocol, net, shell, globalShortcut, nativeImage,
  clipboard, ClipboardItem, dialog, powerMonitor, session, desktopCapturer, Notification,
} = require('electron');

const config = require('./config');
const { TRAY } = require('./labels');
const lang = require('./lang');
const life = require('./life');
const hearing = require('./hearing');
const mouth = require('./mouth');
const history = require('./history');
const growth = require('./growth');
const { createBridge } = require('./bridge');
const { startWindowWatch } = require('./windows');
const llm = require('./llm');
const setup = require('./setup');
const apps = require('./apps');
const launch = require('./launch');
const lyrics = require('./lyrics');
const web = require('./web');
const { ASSISTANTS, assistant } = require('./assistants');
const activeAssistant = () => assistant(config.load().assistant); // Claude Code or Codex
const activeHooks = () => activeAssistant().hooks;
const demoSteps = require('../../scripts/demo-sequence');

const ROOT = path.resolve(__dirname, '..', '..');
const DEV = process.argv.includes('--dev');
const PORT = Number(process.env.CAPRI_PORT) || 47823;
const SOUND_EXT = /\.(mp3|wav|ogg|m4a)$/i;

const OLLAMA_SITE = 'https://ollama.com';

protocol.registerSchemesAsPrivileged([
  { scheme: 'capri', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

let overlay = null;
let tray = null;
let trayMenu = null; // also what she opens when you right-click her
let demoTimer = null;
let windowWatch = null;
// the watcher only speaks when something changes: the overlay asks for this when it (re)loads
let lastWindows = null;
let lastDesktopRearm = 0; // when her pointer hook was last set up again for the desktop coming in front
let chatModels = null; // the provider's models, as last seen (null: not reached)
let chatError = null;  // why not, when the provider said
let chatErrorCode = null; // 'nokey' or 'nourl': what her setup should ask for
const chats = new Map(); // id -> AbortController of an answer being streamed
let settingsWin = null;  // her settings window (settings › everything)
let personaText = '';    // her persona as the overlay last wrote it (chat.js), for what she asks her model herself (dares)
let earsDownload = null; // AbortController of "Download better ears…"
let hotkeyErrors = [];   // accelerators Windows wouldn't give her
let riding = false;      // she's perched on your cursor (the overlay says so)
let fullscreenAway = false;     // stepped aside for a game or a full screen video
let fullscreenOverride = false; // ...and you brought her back anyway: until it ends

const userSoundsDir = () => path.join(app.getPath('userData'), 'sounds');
// her recorded lines (Capri Desktop 2.4's voice folder): pat.wav, pat-2.wav, wake.mp3…
const voicesDir = () => path.join(app.getPath('userData'), 'voices');
const CLIP_KINDS = ['pat', 'click', 'wake', 'sit', 'peek', 'stretch', 'look', 'yawn', 'sleep', 'alarm', 'study', 'hello', 'reply', 'mischief', 'jealous', 'dare'];
const VOICES_README = `Put voice clips here and Capri will play them (.wav, .mp3, .ogg or .m4a, under 10 MB each).
Nothing is bundled: these are your own recordings.
Name a clip for the moment it belongs to, optionally with a number, so she can pick between several:

  pat.wav, pat-2.wav, pat-3.wav   when you pat her head
  click.wav     when you click her
  wake.wav      when she wakes up
  sit.wav       when she sits on a window (or on your cursor)
  peek.wav      when she peeks in from an edge
  stretch.wav, look.wav, yawn.wav, sleep.wav   her idle moods (look: when she looks at the satellite)
  alarm.wav     when an alarm goes off (replaces the chime)
  study.wav     when a study session changes phase
  hello.wav     when she comes online, and for "Play a sample"
  reply.wav     when her AI answers (only while she doesn't read answers out loud)
  mischief.wav  when she glitches your screen
  jealous.wav   when she catches another AI in front of you
  dare.wav      when she dares you

Automatic lines stay at least 8 seconds apart and keep quiet during a focus session. Mute is in her menu.
`;

function listVoices() {
  try {
    const re = new RegExp(`^(${CLIP_KINDS.join('|')})(?:[-_ ]?\\d+)?\\.(wav|mp3|ogg|m4a)$`, 'i');
    return fs.readdirSync(voicesDir())
      .map((f) => [f, re.exec(f)])
      .filter(([f, m]) => m && fs.statSync(path.join(voicesDir(), f)).size < 10 * 1024 * 1024)
      .map(([f, m]) => ({ kind: m[1].toLowerCase(), url: `capri://app/~voices/${encodeURIComponent(f)}` }));
  } catch {
    return [];
  }
}

function openVoices() {
  fs.mkdirSync(voicesDir(), { recursive: true });
  const note = path.join(voicesDir(), 'README.txt');
  if (!fs.existsSync(note)) fs.writeFileSync(note, VOICES_README.replace(/\n/g, '\r\n'));
  shell.openPath(voicesDir());
}

// a clip added or removed: the overlay loads them again (a moment later, once the copy is done)
let voicesWatch = null;
function watchVoices() {
  try {
    fs.mkdirSync(voicesDir(), { recursive: true });
    let timer = null;
    voicesWatch = fs.watch(voicesDir(), () => {
      clearTimeout(timer);
      timer = setTimeout(() => { overlay?.webContents.send('voices:changed'); rebuildTray(); }, 800);
    });
  } catch {
    // no folder watching here: she loads them at start and on "Play a sample"
  }
}

// Her memory of your chats, across restarts: { history: [{ role, content }], claude: Claude Code's session }
const memoryFile = () => path.join(app.getPath('userData'), 'memory.json');
function readMemory() {
  try {
    return JSON.parse(fs.readFileSync(memoryFile(), 'utf8'));
  } catch {
    return {};
  }
}
function saveMemory(patch) {
  try {
    fs.writeFileSync(memoryFile(), JSON.stringify({ ...readMemory(), ...patch }));
  } catch (err) {
    console.error('[capri] could not save her memory:', err.message);
  }
}
function forgetChats() {
  llm.resetClaude();
  saveMemory({ history: [], claude: null });
  sendCommand('forget');
}

// capri://app/...          -> files of this repo
// capri://app/~sounds/...  -> the user's own sound overrides
// capri://app/~voices/...  -> the user's own voice clips
// (same origin as her page: another host would be another origin, and its fetch blocked)
function serveProtocol() {
  protocol.handle('capri', (request) => {
    const url = new URL(request.url);
    let rel = decodeURIComponent(url.pathname);
    const own = /^\/~(sounds|voices)\//.exec(rel);
    const base = own?.[1] === 'sounds' ? userSoundsDir() : own?.[1] === 'voices' ? voicesDir() : ROOT;
    if (own) rel = rel.slice(own[0].length - 1);
    const target = path.resolve(base, '.' + rel);
    if (target !== base && !target.startsWith(base + path.sep)) {
      return new Response('forbidden', { status: 403 });
    }
    return net.fetch(pathToFileURL(target).toString());
  });
}

function targetDisplay() {
  const { displayId } = config.load();
  return screen.getAllDisplays().find((d) => d.id === displayId) || screen.getPrimaryDisplay();
}

// Her window: the work area, or the whole screen while she rests on the taskbar (her legs hang
// over it), less its top row of pixels: a window on top covering the whole screen is a fullscreen
// app to Windows (animated wallpapers pause, notifications wait). `gap`: how much of her window is
// below the top of the taskbar (0, or its height).
function overlayArea() {
  const { workArea, bounds } = targetDisplay();
  const area = config.load().rest === 'taskbar' ? { ...bounds, y: bounds.y + 1, height: bounds.height - 1 } : workArea;
  return { area, gap: area.y + area.height - (workArea.y + workArea.height) };
}

function fitOverlay() {
  if (!overlay) return;
  const { area, gap } = overlayArea();
  overlay.setBounds(area);
  overlay.webContents.send('overlay:resize', { width: area.width, height: area.height, gap });
}

// The pointer reaches her click-through window through a mouse hook, and Windows drops a hook that
// doesn't answer in time without a word (waking from sleep, a locked screen, a stall): she can't be
// clicked anymore. Off then on puts in a new one; her place on top and her size are set again too.
function rearmOverlay() {
  if (!overlay || overlay.isDestroyed()) return;
  overlay.setIgnoreMouseEvents(false);
  overlay.setIgnoreMouseEvents(true, { forward: true });
  overlay.setAlwaysOnTop(true, 'screen-saver');
  fitOverlay();
  sendCommand('rearmed'); // click-through again: she waits for the pointer to be on her
  debugNote('mouse hook set up again');
}

// Above every window, always: something (her chat taking the keyboard and giving it back, another
// always-on-top app, Windows itself) can push her window down the stack, behind your windows, where she
// can't be clicked or dragged. Put back where she belongs, now and every few seconds.
let menuOpen = false;
function keepOnTop() {
  if (!overlay || overlay.isDestroyed() || fullscreenAway || menuOpen || !overlay.isVisible()) return;
  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.moveTop();
}

// Back on top of everything, the taskbar included (it comes up over her when it's clicked). Twice:
// the taskbar can come up again a moment later, as its menus and previews open.
function raiseOverlay() {
  for (const wait of [0, 400]) {
    setTimeout(() => {
      if (!overlay || overlay.isDestroyed()) return;
      overlay.setAlwaysOnTop(true, 'screen-saver');
      overlay.moveTop();
    }, wait);
  }
}

function createOverlay() {
  overlay = new BrowserWindow({
    ...overlayArea().area,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    alwaysOnTop: true,
    type: process.platform === 'win32' ? 'toolbar' : undefined,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.setIgnoreMouseEvents(true, { forward: true });
  overlay.loadURL('capri://app/src/renderer/index.html');
  // always shown: put away, she's still there as her biochip in the corner. Sized again first:
  // Windows keeps a new window inside the work area, and resting on the taskbar it covers it too.
  overlay.once('ready-to-show', () => {
    fitOverlay();
    overlay.showInactive();
  });
  overlay.webContents.on('render-process-gone', (_e, details) => {
    console.error('[capri] renderer gone:', details.reason);
  });
  if (DEV) {
    overlay.webContents.on('console-message', (e) => {
      const { level, message, lineNumber, sourceId } = e;
      console.log(`[renderer:${level}] ${message} (${String(sourceId).split('/').pop()}:${lineNumber})`);
    });
    if (process.env.CAPRI_DEVTOOLS) overlay.webContents.openDevTools({ mode: 'detach' });
  }
}

function sendCommand(name, payload = {}) {
  overlay?.webContents.send('capri:command', { name, ...payload });
}

// to the overlay and her settings window alike
function broadcast(channel, payload) {
  overlay?.webContents.send(channel, payload);
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.webContents.send(channel, payload);
}

// Ctrl+Alt+C: she folds herself away into her biochip in the corner, or comes back out of it.
function toggleVisible(force) {
  // on your cursor, Ctrl+Alt+C gets her off it first (as in 2.4)
  if (riding && typeof force !== 'boolean') {
    sendCommand('hopOff');
    return;
  }
  // stepped aside for a game: bringing her back wins until it ends
  if (fullscreenAway && typeof force !== 'boolean') {
    fullscreenOverride = true;
    setFullscreenAway(false);
    if (config.load().visible) return;
  }
  const visible = typeof force === 'boolean' ? force : !config.load().visible;
  config.save({ visible });
  sendCommand('stow', { on: !visible });
  rebuildTray();
}

// A game or a full screen video in front: she steps aside (her whole window), and comes back after.
// Alarms that go off meanwhile become Windows notifications.
let comebackTimers = [];
function setFullscreenAway(away) {
  if (!overlay || overlay.isDestroyed() || away === fullscreenAway) return;
  fullscreenAway = away;
  debugNote(`fullscreen away: ${away}`);
  comebackTimers.forEach(clearTimeout);
  comebackTimers = [];
  if (away) {
    overlay.hide();
  } else {
    overlay.showInactive();
    rearmOverlay();
    // shown again, Windows may only now hand her window its pointer: the hook set up once more as it settles
    // (right after a hide and show she could stay click-through, unclickable, until you left and came back)
    comebackTimers = [400, 1500].map((ms) => setTimeout(() => !fullscreenAway && rearmOverlay(), ms));
  }
  rebuildTray();
}

// Settings › Advanced › Debug log: what she decided and why, in the console and in capri-debug.log (her data
// folder), to see afterwards why she stepped aside or stopped hearing the pointer.
function debugNote(line) {
  if (!DEV && !config.load().debugLog) return;
  const text = `${new Date().toISOString()} ${line}`;
  console.log('[capri]', line);
  fs.appendFile(path.join(app.getPath('userData'), 'capri-debug.log'), `${text}\n`, () => {});
}

// She steps aside only once it lasts (a game, a film), not for a window that flashes up full screen.
let fullscreenTimer = null;
function onFullscreen(on, why = '') {
  clearTimeout(fullscreenTimer);
  debugNote(`full screen in front: ${on} ${why}`);
  if (!on) {
    fullscreenOverride = false;
    setFullscreenAway(false);
    return;
  }
  fullscreenTimer = setTimeout(() => {
    if (life.fullscreen && config.load().hideInFullscreen && !fullscreenOverride) setFullscreenAway(true);
  }, 3000);
}

function playDemo() {
  clearTimeout(demoTimer);
  const steps = demoSteps(resolveLang(config.load().lang)); // in her language
  let i = 0;
  const next = () => {
    if (i >= steps.length) return;
    const [delay, evt] = steps[i++];
    demoTimer = setTimeout(() => {
      overlay?.webContents.send('claude:event', evt);
      next();
    }, delay);
  };
  next();
}

// During the demo, a little fake terminal for her to sit on and take over (window tracking is
// Windows only, so only there). Opened without stealing focus; closing it drops her off it.
let demoWin = null;
const DEMO_TERMINAL = `<body style="margin:0;background:#14101c;color:#8f8aa3;font:13px/1.7 Consolas,monospace;padding:14px 18px">
<div style="color:#36ff7a">PS C:\\night-city-api&gt; npm test -- gigs</div>
<div>&nbsp;&nbsp;GET /gigs</div><div style="color:#36ff7a">&nbsp;&nbsp;&nbsp;&nbsp;✓ returns 20 items per page</div>
<div style="color:#36ff7a">&nbsp;&nbsp;&nbsp;&nbsp;✓ paginates with a cursor</div><div style="color:#36ff7a">&nbsp;&nbsp;&nbsp;&nbsp;✓ rejects a bad cursor</div>
<div>&nbsp;&nbsp;6 passing (212ms)</div><div style="color:#36ff7a">PS C:\\night-city-api&gt; _</div></body>`;

function demoWindow(open) {
  demoWin?.destroy();
  demoWin = null;
  if (!open || process.platform !== 'win32') return false;
  const b = overlay.getBounds();
  demoWin = new BrowserWindow({
    x: Math.round(b.x + b.width * 0.5 - 310), y: Math.round(b.y + b.height * 0.42), width: 620, height: 300,
    show: false, alwaysOnTop: true, title: 'night-city-api — npm test', backgroundColor: '#14101c', autoHideMenuBar: true,
  });
  demoWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(DEMO_TERMINAL)}`);
  demoWin.once('ready-to-show', () => demoWin?.showInactive());
  demoWin.on('closed', () => { demoWin = null; });
  return true;
}

// 'auto' -> the first system language Capri speaks, English otherwise.
function resolveLang(setting) {
  if (lang.CODES.includes(setting)) return setting;
  const preferred = [...app.getPreferredSystemLanguages(), app.getSystemLocale(), app.getLocale()];
  for (const tag of preferred) {
    const base = String(tag || '').toLowerCase().split(/[-_]/)[0];
    if (lang.CODES.includes(base)) return base;
  }
  return 'en';
}

// Her tray words in a language: its own table, else the English one with what assets/lang translates.
function trayWords(code) {
  const own = TRAY[code];
  const english = Object.fromEntries(Object.entries(TRAY.en).map(([k, v]) => [k, typeof v === 'string' ? lang.T(v) : v]));
  return { ...english, ...(own || {}), name: own?.name || lang.CHOICES.find(([c]) => c === code)?.[1] || code };
}

// What the overlay gets: `lang` is the resolved one, `langSetting` what the user picked.
function rendererConfig() {
  const { apiKeys, ...cfg } = config.load(); // the keys stay here: the overlay only learns which ones are set
  return { ...cfg, keys: Object.keys(apiKeys || {}), assistant: activeAssistant().id, lang: resolveLang(cfg.lang), langSetting: cfg.lang, floorGap: overlayArea().gap };
}

function updateConfig(patch) {
  const before = config.load();
  config.save(patch);
  if ('rest' in patch) fitOverlay(); // the taskbar in her window or not
  if ('lang' in patch) lang.load(resolveLang(patch.lang));
  if ('hotkeys' in patch) registerHotkeys();
  if ('hideInFullscreen' in patch) {
    if (!patch.hideInFullscreen) setFullscreenAway(false);
    else if (life.fullscreen && !fullscreenOverride) setFullscreenAway(true);
  }
  // her senses read what's playing and whether another AI is in front only when asked to
  if (('music' in patch && (patch.music === 'off') !== (before.music === 'off')) || ('jealous' in patch && patch.jealous !== before.jealous)) life.startSenses();
  if ('lyrics' in patch && patch.lyrics !== before.lyrics) life.lyricsChanged();
  const cfg = rendererConfig();
  broadcast('capri:config', cfg);
  rebuildTray();
  return cfg;
}

// Her hotkeys (settings › Advanced): the ones Windows gives her; the others are reported in settings.
const HOTKEY_ACTIONS = {
  toggle: () => { sendCommand('stopGlitch'); toggleVisible(); },
  chat: () => sendCommand('chat'),
  talk: () => sendCommand('listen'),
  look: () => sendCommand('look'),
  settings: () => openSettings(),
};
function registerHotkeys() {
  globalShortcut.unregisterAll();
  hotkeyErrors = [];
  const keys = config.load().hotkeys || {};
  for (const [name, run] of Object.entries(HOTKEY_ACTIONS)) {
    const accel = String(keys[name] || '').trim();
    if (!accel) continue;
    try {
      if (!globalShortcut.register(accel, run)) hotkeyErrors.push(name);
    } catch {
      hotkeyErrors.push(name);
    }
  }
}

// ---- her settings window -----------------------------------------------------------------------------

function openSettings(tab) {
  if (settingsWin && !settingsWin.isDestroyed()) {
    if (settingsWin.isMinimized()) settingsWin.restore();
    settingsWin.show();
    settingsWin.focus();
    if (tab) settingsWin.webContents.send('settings:tab', tab);
    return;
  }
  settingsWin = new BrowserWindow({
    width: 1040,
    height: 760,
    minWidth: 760,
    minHeight: 520,
    title: 'Capri — Settings',
    backgroundColor: '#120e18',
    show: false,
    autoHideMenuBar: true,
    icon: path.join(ROOT, 'assets', 'icons', 'capri.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#120e18', symbolColor: '#f3e8ee', height: 38 },
    webPreferences: {
      preload: path.join(__dirname, '..', 'settings-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  settingsWin.loadURL(`capri://app/src/settings/index.html${tab ? `#${tab}` : ''}`);
  settingsWin.once('ready-to-show', () => settingsWin?.show());
  settingsWin.on('closed', () => { settingsWin = null; });
  if (DEV) {
    settingsWin.webContents.on('console-message', (e) => {
      console.log(`[settings:${e.level}] ${e.message} (${String(e.sourceId).split('/').pop()}:${e.lineNumber})`);
    });
  }
}

// What the settings window gets: her config without any key (only which ones are set), and the rest
// of what it shows.
async function settingsState() {
  const cfg = rendererConfig();
  const keys = setup.openKeys(config.load().apiKeys);
  const sttLang = sttLanguage(config.load());
  return {
    config: cfg,
    providers: Object.entries(llm.PROVIDERS).map(([id, p]) => ({ id, label: p.label, local: Boolean(p.local), needsKey: Boolean(p.env), keyPage: setup.KEY_PAGES[id] || null })),
    models: chatModels || [],
    modelError: chatError,
    model: pickModel(),
    langs: lang.CHOICES.map(([code, name]) => ({ code, name })),
    version: app.getVersion(),
    port: PORT,
    dataDir: app.getPath('userData'),
    ears: hearing.status(config.load(), keys, sttLang),
    sttLang,
    study: life.studyStatus(),
    sync: life.syncPercent(),
    hotkeyErrors,
    voiceClips: listVoices().reduce((all, c) => ({ ...all, [c.kind]: (all[c.kind] || 0) + 1 }), {}),
    voicesDir: voicesDir(),
    growth: growth.status(),
    historyDir: history.dir(),
    shortcut: fs.existsSync(path.join(app.getPath('desktop'), 'Capri.lnk')),
    canShare: !llm.isLocal(config.load().provider, config.load()) ? Boolean(config.load().cloudMemory) : true,
    startup: app.getLoginItemSettings(loginItemOptions()).openAtLogin,
    defaults: config.DEFAULTS,
  };
}

// The language she listens in: the one picked, else what she replies in, else her menus'.
function sttLanguage(cfg) {
  if (cfg.sttLanguage && cfg.sttLanguage !== 'auto') return cfg.sttLanguage;
  if (cfg.replyLanguage === 'mix' || cfg.replyLanguage === 'id') return 'id';
  if (cfg.replyLanguage === 'en') return 'en';
  return resolveLang(cfg.lang);
}

// One look at the screen the pointer is on, in memory only (Look, from 2.4): a picture of the window in
// front (what you're asking about, sharper than the whole screen), the text Windows' OCR reads in it (a
// small vision model can't read a note by itself, and makes it up), and whose window it is. The whole
// screen when no window is in front. { image: base64 JPEG, text, app, title, window }
const OCR = path.join(__dirname, 'ocr.ps1').replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);

async function snapshot() {
  const point = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(point);
  const physical = { width: Math.round(display.size.width * display.scaleFactor), height: Math.round(display.size.height * display.scaleFactor) };
  // herself and her chat panel left out of the picture (her panel's words would be read as yours):
  // Windows leaves a window out of captures while it's protected, without hiding it from you
  const self = overlay && !overlay.isDestroyed() ? overlay : null;
  self?.setContentProtection(true);
  let sources;
  try {
    if (self) await new Promise((r) => setTimeout(r, 150));
    sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: physical });
  } finally {
    self?.setContentProtection(false);
  }
  const source = sources.find((s) => String(s.display_id) === String(display.id)) || sources[0];
  if (!source || source.thumbnail.isEmpty()) throw new Error('blind');
  let shot = source.thumbnail;
  // the window in front on this screen, not one of hers (her window watch gives them front first, in
  // physical pixels)
  const area = process.platform === 'win32' ? screen.dipToScreenRect(null, display.bounds) : display.bounds;
  const own = new Set([overlay, settingsWin].filter((w) => w && !w.isDestroyed()).map((w) => hwndOf(w)));
  const front = (lastWindows?.wins || []).map((w) => ({ ...w, part: clip(w, area) })).find((w) => !own.has(w.id) && w.part && w.part.width * w.part.height >= 0.3 * w.w * w.h);
  if (front) {
    const sx = shot.getSize().width / area.width;
    const sy = shot.getSize().height / area.height;
    const crop = { x: Math.round((front.part.x - area.x) * sx), y: Math.round((front.part.y - area.y) * sy), width: Math.round(front.part.width * sx), height: Math.round(front.part.height * sy) };
    if (crop.width >= 100 && crop.height >= 60) shot = shot.crop(crop);
  }
  const read = process.platform === 'win32' ? await ocr(shot, front?.id || 0) : {};
  const { width } = shot.getSize();
  const small = width > 1280 ? shot.resize({ width: 1280, quality: 'best' }) : shot;
  return {
    image: small.toJPEG(82).toString('base64'),
    text: String(read.text || '').trim().slice(0, 2000),
    app: String(read.app || ''),
    title: String(read.title || ''),
    window: Boolean(front),
  };
}

function hwndOf(win) {
  const buf = win.getNativeWindowHandle();
  return buf.length >= 8 ? Number(buf.readBigUInt64LE()) : buf.readUInt32LE();
}

// the part of window `w` on screen `area` (both physical pixels), or null
function clip(w, area) {
  const x = Math.max(w.x, area.x);
  const y = Math.max(w.y, area.y);
  const right = Math.min(w.x + w.w, area.x + area.width);
  const bottom = Math.min(w.y + w.h, area.y + area.height);
  return right - x >= 200 && bottom - y >= 120 ? { x, y, width: right - x, height: bottom - y } : null;
}

// The text in that picture (Windows' OCR, offline) and whose window it is; {} when it can't tell in time.
function ocr(image, hwnd) {
  const file = path.join(os.tmpdir(), `capri-look-${process.pid}.png`);
  try {
    fs.writeFileSync(file, image.toPNG());
  } catch {
    return Promise.resolve({});
  }
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', OCR, file, String(hwnd)],
      { windowsHide: true, timeout: 8000, maxBuffer: 1 << 20 }, (err, out) => {
        fs.rm(file, { force: true }, () => {});
        try {
          resolve(JSON.parse(String(out).trim().split('\n').pop()));
        } catch {
          resolve({});
        }
      });
  });
}

// Whether she may look right now: switched on, and a model that may see it (local, or a cloud one allowed to).
function lookAllowed(cfg = config.load()) {
  if (!cfg.lookOn) return { ok: false, error: 'off' };
  if (!llm.canSee(cfg.provider)) return { ok: false, error: 'blindModel' };
  if (!llm.isLocal(cfg.provider, cfg) && !cfg.cloudLook) return { ok: false, error: 'cloud' };
  return { ok: true };
}

// Her model, once, with her persona, without streaming to anyone (her dares).
// What her model is told besides her persona: what life.js knows, her lessons and the story so far.
function brainContext(cfg = config.load()) {
  const cloud = !llm.isLocal(cfg.provider, cfg);
  return [life.brainContext({ cloud }), growth.context({ cloud })].filter(Boolean).join('\n\n');
}

// ---------- coding: she hands it to Claude Code, or writes it herself ----------

const codeDir = () => config.load().codeFolder || path.join(app.getPath('documents'), 'Capri Code');

// Claude Code's command if it's on this PC: where its installers put it, or on the PATH.
function claudeCli() {
  const tries = [path.join(os.homedir(), '.local', 'bin', 'claude.exe'), path.join(process.env.APPDATA || '', 'npm', 'claude.cmd')];
  for (const dir of (process.env.PATH || '').split(path.delimiter).filter(Boolean)) {
    tries.push(path.join(dir, 'claude.exe'), path.join(dir, 'claude.cmd'));
  }
  return tries.find((p) => fs.existsSync(p)) || null;
}

// Claude Code in a terminal of its own, in her coding folder, your task typed in for it: you see what it does and
// say yes to its edits there, and she narrates it through her hooks. false when it isn't installed.
function codeWithClaude(task) {
  const cli = process.platform === 'win32' && claudeCli();
  if (!cli) return false;
  const dir = codeDir();
  fs.mkdirSync(dir, { recursive: true });
  const quote = (s) => `'${String(s).replace(/'/g, "''")}'`; // PowerShell's own quoting: nothing in it runs
  const script = `$Host.UI.RawUI.WindowTitle = 'Claude Code (Capri)'; Set-Location -LiteralPath ${quote(dir)}; & ${quote(cli)} ${quote(task.replace(/\s+/g, ' '))}`;
  spawn('powershell.exe', ['-NoExit', '-NoProfile', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
    { detached: true, stdio: 'ignore', windowsHide: false }).on('error', () => {}).unref();
  return { dir };
}

// File types her code comes in, by the language of its code block.
const CODE_EXT = {
  python: '.py', py: '.py', javascript: '.js', js: '.js', typescript: '.ts', ts: '.ts', html: '.html', css: '.css', java: '.java',
  c: '.c', cpp: '.cpp', 'c++': '.cpp', csharp: '.cs', 'c#': '.cs', cs: '.cs', go: '.go', rust: '.rs', php: '.php', ruby: '.rb', lua: '.lua',
  bash: '.sh', sh: '.sh', shell: '.sh', powershell: '.ps1', ps1: '.ps1', batch: '.bat', bat: '.bat', cmd: '.bat', sql: '.sql', json: '.json',
  kotlin: '.kt', swift: '.swift', dart: '.dart', r: '.r',
};

// One file she writes herself with her chat model, saved in her coding folder and opened in an editor (VS Code,
// else Notepad), never run: a .py, .bat or .js opened with its own program would run.
async function codeHerself(task) {
  const cfg = config.load();
  if (!chatModels?.length) await refreshModels();
  const model = pickModel(cfg);
  if (!model || cfg.provider === 'claude') throw Object.assign(new Error('no model to code with'), { code: 'nomodel' });
  const system = [
    'You are a careful senior programmer. Write complete, working, runnable code for the task: no placeholders, no "...".',
    'Reply with exactly this and nothing else: a first line "FILE: <file name with its extension>", then one fenced code block holding the whole file.',
    'Explain things in short comments inside the code, never outside it. Use Python for scripts unless the task names another language; one self-contained HTML file for web pages and small games.',
  ].join('\n');
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 4 * 60 * 1000);
  let text;
  try {
    text = await llm.chat(cfg.provider, { ...llmConfig(cfg), temperature: 0.2, maxTokens: 4000 },
      { model, messages: [{ role: 'system', content: system }, { role: 'user', content: task }] }, () => {}, abort.signal);
  } finally {
    clearTimeout(timer);
  }
  const fence = /```([\w#+.-]*)[^\n]*\n([\s\S]*?)(?:```|$)/.exec(String(text || ''));
  const code = (fence ? fence[2] : String(text || '')).replace(/\s+$/, '') + '\n';
  if (code.trim().length < 10) throw Object.assign(new Error('no code came back'), { code: 'empty' });
  const named = /FILE:\s*`?([^\s`]+\.[A-Za-z0-9]{1,6})`?/i.exec(text)?.[1];
  const ext = named ? path.extname(named).toLowerCase() : CODE_EXT[(fence?.[1] || '').toLowerCase()] || '.txt';
  const stem = (named ? path.basename(named, path.extname(named)) : task.toLowerCase().split(/\s+/).slice(0, 4).join('-'))
    .replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'capri-code';
  const dir = codeDir();
  fs.mkdirSync(dir, { recursive: true });
  let file = path.join(dir, stem + ext);
  for (let n = 2; fs.existsSync(file); n++) file = path.join(dir, `${stem}-${n}${ext}`); // never over one you have
  fs.writeFileSync(file, code);
  const vscode = [path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Microsoft VS Code', 'Code.exe'), path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Microsoft VS Code', 'Code.exe')]
    .find((p) => fs.existsSync(p));
  spawn(vscode || 'notepad.exe', [file], { detached: true, stdio: 'ignore' }).on('error', () => shell.showItemInFolder(file)).unref();
  return { file, name: path.basename(file), lines: code.split('\n').length - 1, editor: vscode ? 'VS Code' : 'Notepad' };
}

// Her model, as is, for her own thinking (growth.js): no persona, nothing streamed.
async function askRaw(messages, { timeout = 90000 } = {}) {
  const cfg = config.load();
  const mayUseMain = llm.isLocal(cfg.provider, cfg) || cfg.cloudMemory;
  if (!mayUseMain || (!chatModels?.length && (await localBrain(cfg)))) {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), timeout);
    try {
      return await askLocal(messages, abort.signal);
    } catch (err) {
      throw err.code === 'nolocal' ? Object.assign(new Error('private'), { code: 'private' }) : err;
    } finally {
      clearTimeout(timer);
    }
  }
  if (!chatModels?.length) await refreshModels();
  if (!chatModels?.length || cfg.provider === 'claude') throw new Error('no model');
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeout);
  try {
    return await chatWithFallback({ ...cfg, temperature: 0.4, maxTokens: 900 }, messages, () => {}, abort.signal, () => false);
  } finally {
    clearTimeout(timer);
  }
}

// Shortcuts to her on the Desktop and in the Start menu, so she opens like any app (not from a terminal,
// which takes her down when it closes).
function makeShortcuts() {
  if (process.platform !== 'win32') return { ok: false, error: 'Windows only' };
  const options = {
    target: process.execPath,
    args: app.isPackaged ? '' : `"${ROOT}"`,
    cwd: app.isPackaged ? path.dirname(process.execPath) : ROOT,
    icon: path.join(ROOT, 'assets', 'icons', 'capri.ico'),
    iconIndex: 0,
    description: 'Capri, on your desktop',
    appUserModelId: 'capri.desktop',
  };
  const places = [
    path.join(app.getPath('desktop'), 'Capri.lnk'),
    path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Capri.lnk'),
  ];
  const made = places.filter((p) => {
    try {
      return shell.writeShortcutLink(p, fs.existsSync(p) ? 'replace' : 'create', options);
    } catch {
      return false;
    }
  });
  return made.length ? { ok: true, made } : { ok: false, error: 'Windows would not let me.' };
}

// Her quick jobs on her model (a word on a song, her verdict on it, a dare, her lessons): one at a time, and never
// while you're chatting with her (they wait for her answer to be done). Two prompts at once only make both slow,
// all the more on Ollama, on your own PC.
let quickJobs = Promise.resolve();
function quickJob(run) {
  const job = quickJobs.then(async () => {
    for (let waited = 0; chats.size && waited < 90000; waited += 250) await new Promise((r) => setTimeout(r, 250));
    return run();
  });
  quickJobs = job.catch(() => {});
  return job;
}

function askOnce(messages) {
  return quickJob(() => askOnceNow(messages));
}

async function askOnceNow(messages) {
  const cfg = config.load();
  // her small local brain for quick jobs, except when her main brain is on Ollama too: two models loaded at once
  // push each other out of your graphics card, and loading one back is the slowest thing there is
  const mainOnOllama = cfg.provider === 'ollama' && Boolean(chatModels?.length);
  if (cfg.localBackground !== false && !mainOnOllama && (await localBrain(cfg))) {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 45000);
    try {
      // a small model loses itself in her whole chat prompt: who she is, her dials, her language, the moment
      const lines = String(personaText || '').split('\n');
      const core = [...lines.slice(0, 12), lines.at(-1)].join('\n');
      const system = [core, life.brainContext({ cloud: false })].filter(Boolean).join('\n\n');
      return await askLocal([{ role: 'system', content: system }, ...messages], abort.signal);
    } finally {
      clearTimeout(timer);
    }
  }
  if (!chatModels?.length) await refreshModels();
  if (!chatModels?.length || cfg.provider === 'claude') throw new Error('no model');
  const abort = new AbortController();
  setTimeout(() => abort.abort(), 45000);
  const context = brainContext(cfg);
  const system = [personaText, context].filter(Boolean).join('\n\n');
  return chatWithFallback(cfg, [{ role: 'system', content: system }, ...messages], () => {}, abort.signal, () => false);
}

function rebuildTray() {
  if (!tray) return;
  const cfg = config.load();
  const hookState = activeHooks().status();
  const watched = activeAssistant();
  const t = Object.fromEntries(Object.entries(trayWords(resolveLang(cfg.lang))).map(([key, value]) =>
    [key, typeof value === 'string' && watched.id !== 'claude' ? value.replaceAll('Claude Code', watched.name) : value]));
  const alarms = cfg.alarms || [];
  const study = life.studyStatus();
  const clock = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

  const displays = screen.getAllDisplays();
  const current = targetDisplay().id;

  const menu = Menu.buildFromTemplate([
    { label: t.online(PORT), enabled: false },
    { type: 'separator' },
    { label: t.teleport, click: () => sendCommand('teleport') },
    { label: t.satellite, click: () => sendCommand('satellite') },
    { label: t.demo, click: playDemo },
    { label: t.help, click: () => sendCommand('welcome') },
    ...(cfg.claude ? [{ label: t.report, click: () => sendCommand('report') }] : []),
    { label: t.talk, accelerator: cfg.hotkeys?.chat || undefined, click: () => sendCommand('chat') },
    { label: t.settings, accelerator: cfg.hotkeys?.settings || undefined, click: () => openSettings() },
    { label: t.custom, click: () => sendCommand('customize') },
    // 2.4's perch: on your cursor, riding along (double-click her does it too)
    { label: riding ? t.hopOff : t.perch, enabled: cfg.visible && !fullscreenAway, click: () => sendCommand(riding ? 'hopOff' : 'ride') },
    { label: cfg.visible ? t.hide : t.show, accelerator: cfg.hotkeys?.toggle || undefined, click: () => { sendCommand('stopGlitch'); toggleVisible(); } },
    { type: 'separator' },
    // from Capri Desktop 2.4: her ears, her eyes, dares, sync, timers, mischief
    {
      label: t.voice,
      submenu: [
        { label: t.talkNow, accelerator: cfg.hotkeys?.talk || undefined, enabled: cfg.listen !== 'off', click: () => sendCommand('listen') },
        { type: 'separator' },
        ...[['off', t.listenOff], ['push', t.listenPush], ['always', t.listenAlways]].map(([listen, label]) => ({
          label, type: 'radio', checked: cfg.listen === listen, click: () => updateConfig({ listen }),
        })),
        { type: 'separator' },
        { label: t.tts, type: 'checkbox', checked: cfg.tts, click: (item) => updateConfig({ tts: item.checked }) },
        { label: t.voiceSettings, click: () => openSettings('voice') },
        { type: 'separator' },
        { label: lang.F('Voice clips: {0}', listVoices().length), enabled: false },
        { label: t.voiceSample, click: () => sendCommand('voiceSample') },
        { label: t.voiceFolder, click: openVoices },
      ],
    },
    { label: t.look, accelerator: cfg.hotkeys?.look || undefined, enabled: cfg.lookOn, click: () => sendCommand('look') },
    { label: t.dare, enabled: cfg.dares, click: () => sendCommand('dare') },
    {
      label: t.games,
      submenu: [['rps', 'main suit'], ['guess', 'tebak angka'], ['coin', 'lempar koin'], ['dice', 'lempar dadu']].map(([id, text]) => ({
        label: t[`game_${id}`], click: () => sendCommand('game', { text }),
      })),
    },
    {
      label: t.timers,
      submenu: [
        ...(alarms.length
          ? alarms.slice(0, 10).map((a) => ({ label: `${clock(a.due)}  ${a.label || ''}`.trim(), click: () => { life.removeAlarm(a.due); rebuildTray(); } }))
          : [{ label: t.noAlarms, enabled: false }]),
        ...(alarms.length ? [{ label: t.clearAlarms, click: () => { life.clearAlarms(); rebuildTray(); } }] : []),
        { type: 'separator' },
        study.phase === 'off'
          ? { label: lang.F('Start focus ({0} min)', cfg.focusMinutes), click: () => { life.startStudy(); rebuildTray(); } }
          : { label: study.paused ? t.studyResume : t.studyPause, click: () => { life.pauseStudy(); rebuildTray(); } },
        ...(study.phase !== 'off' ? [{ label: t.studyStop, click: () => { life.stopStudy(); rebuildTray(); } }] : []),
        { label: t.timerSettings, click: () => openSettings('timers') },
      ],
    },
    {
      label: t.mischief,
      submenu: [
        { label: t.mischiefOn, type: 'checkbox', checked: cfg.mischief, click: (item) => updateConfig({ mischief: item.checked }) },
        { label: t.glitchNow, click: () => sendCommand('glitch') },
        { label: t.hackNote, click: () => sendCommand('glitch', { note: true }) },
      ],
    },
    ...(cfg.syncShown ? [{ label: lang.F('Sync with Capri: {0}%', life.syncPercent()), enabled: false }] : []),
    { type: 'separator' },
    {
      label: t.size,
      submenu: [[t.small, 0.45], [t.medium, 0.6], [t.large, 0.8]].map(([label, scale]) => ({
        label, type: 'radio', checked: Math.abs(cfg.scale - scale) < 0.01, click: () => updateConfig({ scale }),
      })),
    },
    {
      label: t.sound,
      submenu: [
        { label: t.mute, type: 'checkbox', checked: cfg.muted, click: (item) => updateConfig({ muted: item.checked }) },
        { type: 'separator' },
        {
          label: t.soundsDir,
          click: () => {
            fs.mkdirSync(userSoundsDir(), { recursive: true });
            shell.openPath(userSoundsDir());
          },
        },
      ],
    },
    {
      label: t.screen,
      enabled: displays.length > 1,
      submenu: displays.map((d, i) => ({
        label: `${i + 1} — ${d.size.width}×${d.size.height}`,
        type: 'radio',
        checked: d.id === current,
        click: () => { config.save({ displayId: d.id }); fitOverlay(); rebuildTray(); },
      })),
    },
    {
      label: t.chatModel,
      submenu: [
        { label: t.aiSetup, click: () => sendCommand('setupChat') },
        { type: 'separator' },
        ...Object.entries(llm.PROVIDERS).map(([provider, p]) => ({
          label: p.label, type: 'radio', checked: cfg.provider === provider, click: () => pickProvider(provider),
        })),
        { type: 'separator' },
        ...(chatModels?.length
          ? chatModels.map((name) => ({
            label: name, type: 'radio', checked: name === pickModel(cfg), click: () => updateConfig({ chatModel: name }),
          }))
          : [{ label: (chatError || t.noOllama).slice(0, 80), enabled: false }]),
        { type: 'separator' },
        ...(cfg.provider === 'claude' ? [
          { label: `Claude Code: ${cfg.claudeCwd || app.getPath('home')}`, click: pickClaudeFolder },
          {
            label: 'Claude Code permissions',
            submenu: llm.CLAUDE_MODES.map((mode) => ({
              label: mode, type: 'radio', checked: cfg.claudeMode === mode, click: () => updateConfig({ claudeMode: mode }),
            })),
          },
        ] : []),
        { label: t.forget, click: forgetChats },
        // the key (or the address) of the one picked, pasted in her panel
        { label: t.apiKey, click: () => sendCommand('setupKey') },
      ],
    },
    { label: t.wander, type: 'checkbox', checked: cfg.wander, click: (item) => updateConfig({ wander: item.checked }) },
    { label: t.possess, type: 'checkbox', checked: cfg.possess, click: (item) => updateConfig({ possess: item.checked }) },
    { label: t.hideFull, type: 'checkbox', checked: cfg.hideInFullscreen, click: (item) => updateConfig({ hideInFullscreen: item.checked }) },
    {
      label: t.rest,
      submenu: [['corner', t.restCorner], ['taskbar', t.restTaskbar]].map(([rest, label]) => ({
        label, type: 'radio', checked: cfg.rest === rest, click: () => updateConfig({ rest }),
      })),
    },
    // the coding assistant she watches (a new one: she says hello and offers to plug herself in), or none
    {
      label: t.watch,
      submenu: [
        ...Object.entries(ASSISTANTS).map(([id, { name }]) => ({
          label: name,
          type: 'radio',
          checked: cfg.claude && watched.id === id,
          click: () => {
            const other = watched.id !== id;
            updateConfig({ claude: true, assistant: id, ...(other && { linked: false, welcomed: false }) });
            if (other) sendCommand('assistantChanged');
          },
        })),
        { label: t.watchNone, type: 'radio', checked: !cfg.claude, click: () => updateConfig({ claude: false }) },
      ],
    },
    {
      label: t.motion,
      submenu: [['auto', t.motionAuto], ['full', t.motionFull], ['reduced', t.motionReduced]].map(([motion, label]) => ({
        label, type: 'radio', checked: cfg.motion === motion, click: () => updateConfig({ motion, motionAsked: true }),
      })),
    },
    {
      label: t.display,
      // only read when she starts: she restarts in the mode picked
      submenu: [['auto', t.displayAuto], ['gl', t.displayGl], ['software', t.displaySoftware]].map(([render, label]) => ({
        label, type: 'radio', checked: cfg.render === render,
        click: () => {
          if (cfg.render === render) return;
          config.save({ render });
          app.relaunch();
          app.exit(0);
        },
      })),
    },
    {
      label: t.lang,
      submenu: [[t.auto, 'auto'], ...lang.CHOICES.map(([code, name]) => [name, code])].map(([label, code]) => ({
        label, type: 'radio', checked: cfg.lang === code, click: () => updateConfig({ lang: code }),
      })),
    },
    {
      label: t.startup,
      type: 'checkbox',
      checked: app.getLoginItemSettings(loginItemOptions()).openAtLogin,
      click: (item) => app.setLoginItemSettings({ ...loginItemOptions(), openAtLogin: item.checked }),
    },
    // her hooks, while she watches Claude Code
    ...(cfg.claude ? [
      { type: 'separator' },
      hookState.installed
        ? { label: t.hooksOn, enabled: false }
        : { label: t.hooksOff, click: () => runHooks('install') },
      ...(hookState.installed ? [{ label: t.hooksRemove, click: () => runHooks('uninstall') }] : []),
    ] : []),
    { type: 'separator' },
    { label: t.quit, click: () => app.quit() },
  ]);
  // open, it stays above her (keepOnTop waits)
  menu.on('menu-will-show', () => { menuOpen = true; });
  menu.on('menu-will-close', () => { menuOpen = false; });
  tray.setContextMenu(menu);
  trayMenu = menu;
}

// Run from a clone (`npm start`), electron.exe alone would open the default Electron app at login:
// it needs the project folder as argument.
function loginItemOptions() {
  return app.isPackaged ? {} : { path: process.execPath, args: [ROOT] };
}

// From the tray, she says how it went; from her welcome panel (quiet), the panel does.
function runHooks(action, { quiet = false } = {}) {
  let outcome;
  try {
    const result = action === 'install' ? activeHooks().install() : activeHooks().uninstall();
    outcome = { action, ok: true, file: result.file };
  } catch (err) {
    outcome = { action, ok: false, error: err.message };
  }
  if (!quiet) sendCommand('hooks', outcome);
  rebuildTray();
  return outcome;
}

// The model she talks with: the one picked in her menu if it's still installed, else the first.
function pickModel(cfg = config.load()) {
  if (!chatModels?.length) return null;
  return chatModels.includes(cfg.chatModel) ? cfg.chatModel : chatModels[0];
}

async function refreshModels() {
  const cfg = config.load();
  chatError = null;
  chatErrorCode = null;
  chatModels = await llm.models(cfg.provider, llmConfig(cfg)).catch((err) => {
    chatError = err.message;
    chatErrorCode = err.code || null;
    return null;
  });
  rebuildTray();
  return chatModels;
}

// Her answer from the model picked, or from the next one when that one can't: too busy twice in a row
// (Gemini's "high demand"), or not served anymore (an older model closed to new keys). The model
// that answered is kept for next time.
// ---- her local brain: a small Ollama model on this PC (qwen2.5:1.5b…) ----------------------------------
// It answers when her main brain can't (offline, out of quota, a key gone wrong), and does her quick jobs on the
// side (a word on your song, a dare, looking back at your chats when the cloud isn't allowed them).
let ollamaModels = { at: 0, list: [] };
async function localModels(fresh = false) {
  if (!fresh && Date.now() - ollamaModels.at < 60000) return ollamaModels.list;
  const list = (await llm.models('ollama', llmConfig()).catch(() => null)) || [];
  ollamaModels = { at: Date.now(), list };
  return list;
}

async function localBrain(cfg = config.load()) {
  const name = String(cfg.localBrain || '').trim();
  if (!name) return null;
  const list = await localModels();
  return list.find((m) => m === name || m === `${name}:latest`) || null;
}

async function askLocal(messages, signal, send = () => {}) {
  const cfg = config.load();
  const model = await localBrain(cfg);
  if (!model) throw Object.assign(new Error('no local brain'), { code: 'nolocal' });
  return llm.chat('ollama', llmConfig(cfg), { model, messages }, send, signal);
}

// The first time Ollama is there with a model, the smallest one becomes her local brain (qwen2.5 first).
async function pickLocalBrain() {
  const cfg = config.load();
  if (cfg.localBrain || cfg.localBrainChecked) return;
  const list = await localModels(true);
  if (!list.length) return;
  const size = (m) => Number(/(\d+(?:\.\d+)?)b\b/i.exec(m)?.[1] || 4);
  const best = [...list].sort((a, b) => (/qwen2\.5/i.test(b) - /qwen2\.5/i.test(a)) || size(a) - size(b))[0];
  updateConfig({ localBrain: best, localBrainChecked: true });
}

async function chatWithFallback(cfg, messages, send, signal, streamed) {
  let model = pickModel(cfg);
  const tried = new Set();
  let busy = 0;
  for (;;) {
    try {
      const text = await llm.chat(cfg.provider, llmConfig(cfg), { model, messages }, send, signal);
      if (model !== pickModel(cfg)) updateConfig({ chatModel: model });
      return text;
    } catch (err) {
      if (signal.aborted || streamed() || !['busy', 'gone'].includes(err.code)) throw err;
      if (err.code === 'busy' && busy++ === 0) {
        await new Promise((r) => setTimeout(r, 1500)); // usually gone a moment later
        continue;
      }
      tried.add(model);
      const next = chatModels?.find((m) => !tried.has(m));
      if (!next || tried.size >= 3) throw err;
      model = next;
      busy = 0;
    }
  }
}

async function pickProvider(provider) {
  updateConfig({ provider });
  await refreshModels();
  if (chatErrorCode) sendCommand('setupKey'); // it needs a key or an address: she asks for it
}

// What llm.js gets: the config with its keys opened (they're kept encrypted, setup.js)
function llmConfig(cfg = config.load()) {
  return { ...cfg, apiKeys: setup.openKeys(cfg.apiKeys) };
}

async function pickClaudeFolder() {
  const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'], defaultPath: config.load().claudeCwd || app.getPath('home') });
  if (canceled || !filePaths[0]) return;
  llm.resetClaude(); // a new folder, a new Claude Code conversation (hers goes on)
  saveMemory({ claude: null });
  updateConfig({ claudeCwd: filePaths[0] });
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(ROOT, 'assets', 'icons', 'tray.png'));
  tray = new Tray(icon);
  tray.setToolTip('Capri');
  tray.on('click', () => sendCommand('status'));
  rebuildTray();
}

function registerIpc() {
  ipcMain.on('overlay:interactive', (_e, on) => {
    overlay?.setIgnoreMouseEvents(!on, { forward: true });
  });
  ipcMain.on('overlay:rearm', () => rearmOverlay()); // the pointer moved over her and she never heard of it
  ipcMain.handle('overlay:cursor', () => {
    const p = screen.getCursorScreenPoint();
    const b = overlay.getBounds();
    return { x: p.x - b.x, y: p.y - b.y, inside: p.x >= b.x && p.y >= b.y && p.x < b.x + b.width && p.y < b.y + b.height };
  });
  ipcMain.handle('config:get', () => rendererConfig());
  ipcMain.handle('hooks:status', () => activeHooks().status());
  ipcMain.handle('config:set', (_e, patch) => updateConfig(patch));
  ipcMain.handle('demo:window', (_e, open) => demoWindow(open));
  // right-clicking her: the same menu as the tray icon (which Windows often hides behind the ^ by the clock)
  ipcMain.on('menu:open', () => trayMenu?.popup({ window: overlay }));
  // her welcome panel's buttons
  ipcMain.handle('hooks:install', () => runHooks('install', { quiet: true }));
  ipcMain.handle('claude:found', () => fs.existsSync(path.dirname(activeHooks().status().file))); // Claude Code keeps its settings there
  ipcMain.on('claude:help', () => shell.openExternal(activeAssistant().help));
  ipcMain.handle('windows:get', () => lastWindows);
  // talking to her (chat.js): is Ollama there, with a model to talk with
  ipcMain.handle('chat:status', async () => {
    const cfg = config.load(true); // keys may have been edited by hand
    const { provider } = cfg;
    const models = await refreshModels();
    if (!models?.length && cfg.localFallback !== false) {
      const local = await localBrain(cfg);
      if (local) return { ok: true, provider, model: `${local} · lokal`, local: true, fallback: true };
    }
    if (!models) return { ok: false, error: chatError || 'offline', code: chatErrorCode, provider };
    if (!models.length) return { ok: false, error: 'nomodel', provider };
    llm.warm(provider, pickModel()); // loading while you type your first message
    return { ok: true, provider, model: pickModel(), agent: provider === 'claude', local: llm.isLocal(provider, cfg), warmup: provider === 'ollama' };
  });
  // her answer, streamed to the overlay piece by piece as `chat:delta`
  ipcMain.handle('chat:send', async (_e, { id, messages }) => {
    // one answer at a time: a new message stops one still being written (you've moved on, and two at once
    // would only make both slow)
    for (const [other, stop] of chats) if (other !== id) stop.abort();
    const abort = new AbortController();
    chats.set(id, abort);
    try {
      let streamed = false;
      const send = (text) => {
        streamed = true;
        overlay?.webContents.send('chat:delta', { id, text });
      };
      const cfg = config.load();
      try {
        const text = await chatWithFallback(cfg, messages, send, abort.signal, () => streamed);
        if (cfg.provider === 'claude') saveMemory({ claude: llm.claudeMemory() });
        return { ok: true, text };
      } catch (err) {
        // her main brain failed before a word came: her local brain answers instead
        // (not for a screenshot: her local brain can't see, it would make the screen up)
        const looking = messages.some((m) => m.images?.length);
        const local = !abort.signal.aborted && !streamed && !looking && cfg.localFallback !== false && cfg.provider !== 'claude' ? await localBrain(cfg) : null;
        if (!local || (cfg.provider === 'ollama' && pickModel(cfg) === local)) throw err;
        console.log('[capri] main brain failed, local brain answers:', err.message);
        const text = await askLocal(messages, abort.signal, send);
        return { ok: true, text, local };
      }
    } catch (err) {
      return { ok: false, error: abort.signal.aborted ? 'stopped' : err.message, code: err.code || null };
    } finally {
      chats.delete(id);
    }
  });
  ipcMain.on('chat:stop', (_e, id) => chats.get(id)?.abort());
  // questions about the world, looked up on the web first (web.js), when settings › Access allows it
  ipcMain.handle('web:lookup', (_e, question) => (config.allowed('search') ? web.lookup(String(question || '')).catch(() => null) : null));
  ipcMain.handle('chat:memory', () => readMemory().history || []);
  ipcMain.on('chat:remember', (_e, history) => Array.isArray(history) && saveMemory({ history }));
  ipcMain.on('chat:ollama', () => shell.openExternal(OLLAMA_SITE));
  // setting her up with buttons (setup.js): Ollama and a model, or a key, or an address
  const progress = (payload) => overlay?.webContents.send('setup:progress', payload);
  let pulling = null; // AbortController of the model being fetched
  ipcMain.handle('setup:info', () => ({ models: setup.MODELS, ram: os.totalmem(), keyed: Object.keys(setup.KEY_PAGES) }));
  ipcMain.handle('setup:ollama', () => setup.ollamaState());
  ipcMain.handle('setup:install', () => setup.installOllama((line) => progress({ kind: 'install', line })));
  ipcMain.handle('setup:start', async () => {
    const res = await setup.startOllama();
    await refreshModels();
    return res;
  });
  ipcMain.handle('setup:pull', async (_e, name) => {
    if (!setup.MODELS.some((m) => m.name === name)) return { ok: false, error: 'unknown model' };
    pulling?.abort();
    const abort = new AbortController();
    pulling = abort;
    try {
      await setup.pullModel(name, (p) => progress({ kind: 'pull', ...p }), abort.signal);
      updateConfig({ provider: 'ollama' });
      await refreshModels();
      const model = chatModels?.find((m) => m === name || m.startsWith(`${name}:`));
      if (model) updateConfig({ chatModel: model });
      return { ok: true, model };
    } catch (err) {
      return { ok: false, error: abort.signal.aborted ? 'stopped' : err.message };
    } finally {
      if (pulling === abort) pulling = null;
    }
  });
  ipcMain.on('setup:cancel', () => pulling?.abort());
  // who answers her chat, with its key or address if it needs one: saved, tried, and undone if it fails
  ipcMain.handle('setup:use', async (_e, { provider, key, url }) => {
    if (!llm.PROVIDERS[provider]) return { ok: false, error: 'unknown provider' };
    const before = config.load();
    const patch = { provider };
    if (key) patch.apiKeys = { ...before.apiKeys, [provider]: setup.sealKey(String(key).trim()) };
    if (url) patch.customUrl = String(url).trim();
    updateConfig(patch);
    const models = await refreshModels();
    if (models?.length) return { ok: true, model: pickModel() };
    const error = models ? 'no model' : chatError || 'offline';
    updateConfig({ provider: before.provider, apiKeys: before.apiKeys, customUrl: before.customUrl });
    await refreshModels();
    return { ok: false, error };
  });
  ipcMain.on('setup:keyPage', (_e, provider) => setup.KEY_PAGES[provider] && shell.openExternal(setup.KEY_PAGES[provider]));
  ipcMain.handle('setup:launch', (_e, integration) => setup.launchThroughOllama(integration));
  // closing an app you asked her to close, once you've clicked to confirm (apps.js)
  const appInfo = (app) => app && { name: app.process, label: app.label };
  ipcMain.handle('apps:list', async () => (await apps.list().catch(() => [])).map(appInfo));
  ipcMain.handle('apps:find', async (_e, wanted) => appInfo(await apps.find(wanted).catch(() => null)));
  // (each only when settings › Access allows it)
  ipcMain.handle('apps:close', (_e, { name, force }) => (config.allowed('close') ? apps.close(name, { force }).catch((err) => ({ error: err.message })) : { error: 'Not allowed: Settings › Access.' }));
  // opening things you ask her to (launch.js): an app or a game, your music, a website
  ipcMain.handle('apps:findLaunch', (_e, text) => (config.allowed('apps') ? launch.find(String(text || '')).catch(() => null) : null));
  ipcMain.handle('apps:launch', (_e, item) => (config.allowed('apps') ? launch.launch(item).then(() => ({ ok: true }), (err) => ({ ok: false, error: err.message })) : { ok: false, error: 'denied' }));
  ipcMain.handle('apps:media', (_e, action) => config.allowed('media') && launch.media(action));
  // music her model asked for ([[music: …]]) or you named: played, not only searched (Windows)
  ipcMain.handle('apps:music', (_e, query) => (!config.allowed('spotify') ? false : process.platform === 'win32'
    ? life.playSong(String(query || '').trim().slice(0, 200)).then((r) => r.ok, () => false)
    : launch.music(query).catch(() => false)));
  ipcMain.handle('apps:site', (_e, address) => config.allowed('web') && launch.site(address).catch(() => false));
  // her lyrics kept on this PC (settings › Access)
  ipcMain.handle('lyrics:cache', () => lyrics.cacheInfo());
  ipcMain.handle('lyrics:clear', () => ({ cleared: lyrics.clearCache(), ...lyrics.cacheInfo() }));
  // typing to her: the overlay takes the keyboard while the chat is open, and gives it back after
  ipcMain.on('overlay:focus', (_e, on) => {
    if (!overlay) return;
    overlay.setFocusable(Boolean(on));
    if (on) overlay.focus();
    if (on && config.allowed('search')) web.warm(); // her chat open: her web lookups ready to go
    else overlay.blur();
    // on Windows, changing whether a window can take the keyboard can drop it out of the always-on-top band:
    // after her chat, she ended up behind your windows (and so unclickable). Put back on top.
    keepOnTop();
  });
  // her report card's copy button: a picture of that part of the overlay, on the clipboard
  ipcMain.handle('panel:copy', async (_e, rect) => {
    const image = await overlay.webContents.capturePage(rect);
    if (image.isEmpty()) return false;
    const png = new Blob([image.toPNG()], { type: 'image/png' });
    await clipboard.write([new ClipboardItem({ 'image/png': png })]);
    return true;
  });
  // her guide: where her tray icon is (it lives in the taskbar, off the overlay, hence overlay
  // coordinates past its edge), and the corner by the clock in case Windows hid it behind the ^
  ipcMain.handle('guide:tray', () => {
    const o = overlay.getBounds();
    const d = targetDisplay().bounds;
    const b = tray?.getBounds();
    const icon = b && b.width > 0 ? { x: b.x - o.x, y: b.y - o.y, w: b.width, h: b.height } : null;
    const corner = { x: d.x + d.width - 150 - o.x, y: d.y + d.height - 44 - o.y, w: 140, h: 40 };
    return { icon, corner };
  });
  // her guide: Claude Code's folder (~/.claude) in Explorer, its settings file selected
  ipcMain.handle('guide:claudeFolder', () => {
    const file = activeHooks().status().file;
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) return { found: false, dir };
    if (fs.existsSync(file)) shell.showItemInFolder(file);
    else shell.openPath(dir);
    return { found: true, dir, file: fs.existsSync(file), label: fs.existsSync(file) ? path.basename(file) : path.basename(dir) };
  });
  // ---- from Capri Desktop 2.4: her words, errands, her eyes and ears, her life --------------------------
  ipcMain.handle('lang:table', () => lang.table());
  // her own growth first ("improve yourself", "from now on…"), then her errands
  ipcMain.handle('errand:run', async (_e, text) => {
    const said = String(text || '').slice(0, 500);
    try {
      return (await growth.command(said)) || (await life.run(said));
    } catch (err) {
      return { handled: false, error: err.message };
    }
  });
  // a chat turn, into her history (and her growth: your reactions, her next look back)
  ipcMain.on('history:add', (_e, entries) => {
    if (!Array.isArray(entries) || config.load().historyOn === false) return;
    const clean = entries.slice(0, 4).map((e) => ({ role: e?.role, text: String(e?.text || ''), emotion: e?.emotion || undefined, via: e?.via || undefined }));
    growth.onTurn(clean);
    history.add(clean);
  });
  ipcMain.on('persona:set', (_e, text) => { personaText = String(text || ''); });
  ipcMain.handle('life:context', () => brainContext());
  ipcMain.handle('life:song', () => life.songNow()); // her window (re)loaded: the song she was following
  // her history, for her settings
  ipcMain.handle('history:days', () => history.days());
  ipcMain.handle('ollama:models', () => localModels(true));
  ipcMain.handle('history:read', (_e, day) => history.read(day));
  ipcMain.handle('history:search', (_e, query) => history.search(String(query || '').slice(0, 100)));
  ipcMain.on('life:sync', (_e, { points, source }) => life.addSync(Number(points) || 0, String(source || '')));
  ipcMain.handle('life:hack', () => life.hackLine());
  ipcMain.on('life:quiet', (_e, ms) => life.quiet(Number(ms) || 0));
  ipcMain.handle('life:dare', () => life.giveDare(true));
  ipcMain.handle('life:syncLine', () => ({ line: life.syncLine(), percent: life.syncPercent() }));
  ipcMain.handle('look:snapshot', async () => {
    const allowed = lookAllowed();
    if (!allowed.ok) return allowed;
    try {
      return { ok: true, ...(await snapshot()) };
    } catch {
      return { ok: false, error: 'blind' };
    }
  });
  ipcMain.handle('voice:transcribe', async (_e, { wav, language }) => {
    const cfg = config.load();
    const lang2 = language && language !== 'auto' ? language : sttLanguage(cfg);
    return hearing.transcribe(Buffer.from(wav), { cfg, keys: setup.openKeys(cfg.apiKeys), language: lang2 });
  });
  ipcMain.handle('voice:status', () => {
    const cfg = config.load();
    return hearing.status(cfg, setup.openKeys(cfg.apiKeys), sttLanguage(cfg));
  });
  ipcMain.on('settings:open', (_e, tab) => openSettings(tab));
  ipcMain.handle('voices:list', () => listVoices());
  // her voice, as sound (mouth.js): her line in, audio out (Windows' own voices are spoken in the overlay)
  ipcMain.handle('tts:speak', async (_e, { text, emotion }) => {
    const cfg = config.load();
    const res = await mouth.speak(String(text || ''), { cfg, keys: setup.openKeys(cfg.apiKeys), emotion });
    return res.ok ? { ok: true, audio: res.audio.buffer.slice(res.audio.byteOffset, res.audio.byteOffset + res.audio.byteLength), engine: res.engine } : res;
  });
  ipcMain.handle('tts:voices', (_e, engine) => {
    const cfg = config.load();
    return mouth.voices(String(engine || cfg.ttsEngine), { cfg, keys: setup.openKeys(cfg.apiKeys) }).catch((err) => ({ voices: [], error: err.message }));
  });
  ipcMain.on('ride:state', (_e, on) => {
    riding = Boolean(on);
    rebuildTray();
  });

  // ---- her settings window ----------------------------------------------------------------------------
  ipcMain.handle('settings:get', () => settingsState());
  ipcMain.handle('settings:set', (_e, patch) => {
    const clean = { ...patch };
    delete clean.apiKeys; // keys only through settings:key
    if ('startup' in clean) {
      app.setLoginItemSettings({ ...loginItemOptions(), openAtLogin: Boolean(clean.startup) });
      delete clean.startup;
    }
    if ('render' in clean && clean.render !== config.load().render) {
      config.save({ render: clean.render });
      app.relaunch();
      app.exit(0);
      return null;
    }
    updateConfig(clean);
    return settingsState();
  });
  ipcMain.handle('settings:key', async (_e, { provider, key }) => {
    if (!llm.PROVIDERS[provider] && !['groq', 'openai', 'elevenlabs', 'ttscustom'].includes(provider)) return { ok: false };
    const keys = { ...(config.load().apiKeys || {}) };
    if (key) keys[provider] = setup.sealKey(String(key).trim());
    else delete keys[provider];
    updateConfig({ apiKeys: keys });
    await refreshModels();
    return settingsState();
  });
  ipcMain.handle('settings:models', async () => {
    await refreshModels();
    return settingsState();
  });
  ipcMain.handle('settings:action', async (_e, { name, arg } = {}) => {
    const userData = app.getPath('userData');
    switch (name) {
      case 'openData': shell.openPath(userData); break;
      case 'openSpeech': fs.mkdirSync(hearing.speechDir(), { recursive: true }); shell.openPath(hearing.speechDir()); break;
      case 'openVoiceLog': if (fs.existsSync(hearing.logFile())) shell.openPath(hearing.logFile()); break;
      case 'openSounds': fs.mkdirSync(userSoundsDir(), { recursive: true }); shell.openPath(userSoundsDir()); break;
      case 'openVoices': openVoices(); break;
      case 'shortcuts': return { ...(await settingsState()), shortcuts: makeShortcuts() };
      case 'historyOpen': fs.mkdirSync(history.dir(), { recursive: true }); shell.openPath(history.dir()); break;
      case 'historyRemoveDay': history.removeDay(String(arg)); break;
      case 'historyClear': history.clear(); break;
      case 'summaryUpdate': return { ...(await settingsState()), result: await growth.summarize({ force: true }) };
      case 'summarySet': history.setSummary(String(arg || '')); break;
      case 'reflect': return { ...(await settingsState()), result: await growth.reflect({ manual: true }) };
      case 'lessonsReset': updateConfig({ lessons: [], growth: { ...config.DEFAULTS.growth } }); break;
      case 'openPiper': fs.mkdirSync(path.join(mouth.piperDir(), 'voices'), { recursive: true }); shell.openPath(mouth.piperDir()); break;
      case 'ttsPage': if (mouth.PAGES[arg]) shell.openExternal(mouth.PAGES[arg]); break;
      case 'game': sendCommand('game', { text: String(arg || '') }); break;
      case 'voiceSample': sendCommand('voiceSample'); break;
      case 'ride': sendCommand('ride'); break;
      case 'openLang': fs.mkdirSync(path.join(userData, 'lang'), { recursive: true }); shell.openPath(path.join(userData, 'lang')); break;
      case 'keyPage': if (setup.KEY_PAGES[arg]) shell.openExternal(setup.KEY_PAGES[arg]); break;
      case 'forgetChats': forgetChats(); break;
      case 'resetSync': updateConfig({ sync: { ...config.DEFAULTS.sync } }); break;
      case 'clearMemory': updateConfig({ memories: [] }); break;
      case 'clearAlarms': life.clearAlarms(); break;
      case 'removeAlarm': life.removeAlarm(Number(arg)); break;
      case 'addTimer': life.addAlarm(Date.now() + Number(arg.minutes) * 60000, String(arg.label || lang.F('Timer: {0}', lang.count('{0} minute|{0} minutes', Number(arg.minutes))))); break;
      case 'startStudy': life.startStudy(Number(arg?.focus) || config.load().focusMinutes, Number(arg?.rest) || config.load().breakMinutes); break;
      case 'stopStudy': life.stopStudy(); break;
      case 'pauseStudy': life.pauseStudy(); break;
      case 'testLook': sendCommand('look'); break;
      case 'testGlitch': sendCommand('glitch', { kind: arg }); break;
      case 'testSpeak': sendCommand('speak', { text: arg }); break;
      case 'dare': sendCommand('dare'); break;
      case 'demo': playDemo(); break;
      case 'customize': sendCommand('customize'); break;
      case 'chat': sendCommand('chat'); break;
      case 'export': {
        const { canceled, filePath } = await dialog.showSaveDialog(settingsWin, { defaultPath: 'capri-settings.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
        if (canceled || !filePath) return null;
        const { apiKeys, ...rest } = config.load(); // keys stay on this PC
        fs.writeFileSync(filePath, JSON.stringify(rest, null, 2));
        return { ok: true, file: filePath };
      }
      case 'import': {
        const { canceled, filePaths } = await dialog.showOpenDialog(settingsWin, { properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] });
        if (canceled || !filePaths[0]) return null;
        try {
          const { apiKeys, ...data } = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
          const known = Object.fromEntries(Object.entries(data).filter(([k]) => k in config.DEFAULTS));
          updateConfig(known);
          registerHotkeys();
          return { ok: true };
        } catch (err) {
          return { ok: false, error: err.message };
        }
      }
      case 'reset':
        config.reset({ keepKeys: true });
        lang.load(resolveLang(config.load().lang));
        registerHotkeys();
        updateConfig({});
        break;
      case 'downloadEars': {
        earsDownload?.abort();
        const abort = new AbortController();
        earsDownload = abort;
        try {
          await hearing.downloadEars((p) => broadcast('voice:progress', p), abort.signal);
          return { ok: true, state: await settingsState() };
        } catch (err) {
          return { ok: false, error: abort.signal.aborted ? 'stopped' : err.message };
        } finally {
          if (earsDownload === abort) earsDownload = null;
        }
      }
      case 'cancelEars': earsDownload?.abort(); break;
      default: return null;
    }
    return settingsState();
  });
  ipcMain.handle('sounds:list', () => {
    try {
      return fs.readdirSync(userSoundsDir())
        .filter((f) => SOUND_EXT.test(f))
        .map((f) => ({ name: f.replace(SOUND_EXT, '').toLowerCase(), url: `capri://app/~sounds/${encodeURIComponent(f)}` }));
    } catch {
      return [];
    }
  });
}

// Only in --dev: lets scripts drive the overlay and grab frames of it (no desktop content, just our window).
const testWins = new Map(); // name -> test window

async function debugHandler(route, body) {
  if (!DEV) throw new Error('debug routes need --dev');
  if (route === 'command') {
    sendCommand(body.name, body);
    return { ok: true };
  }
  if (route === 'reload') {
    overlay.webContents.reloadIgnoringCache();
    return { ok: true };
  }
  if (route === 'away') {
    // { on }: as if a game had come full screen in front of her (she steps aside), or gone
    setFullscreenAway(Boolean(body.on));
    return { ok: true };
  }
  if (route === 'unhook') {
    // the pointer no longer passed on to her, as when Windows drops the mouse hook
    overlay.setIgnoreMouseEvents(true);
    return { ok: true };
  }
  if (route === 'testwin') {
    // plain windows to sit on, opened without stealing focus, by name (`id`, default "main");
    // each one opened goes in front of the others. { open: false } without an id closes them all.
    const id = body.id ?? 'main';
    if (!body.open && body.id === undefined) {
      for (const win of testWins.values()) win.destroy();
      testWins.clear();
      return { ok: true };
    }
    testWins.get(id)?.destroy();
    testWins.delete(id);
    if (body.open) {
      const b = overlay.getBounds();
      const win = new BrowserWindow({
        x: b.x + (body.x ?? 300), y: b.y + (body.y ?? 380), width: body.w ?? 720, height: body.h ?? 380,
        show: false, alwaysOnTop: true, title: `Capri test window ${id}`, backgroundColor: '#1b1726',
      });
      // { html } to show something in it (Look tests)
      win.loadURL(`data:text/html,${encodeURIComponent(body.html || '<body style="background:#1b1726"></body>')}`);
      win.showInactive();
      testWins.set(id, win);
    }
    return { ok: true };
  }
  if (route === 'movewin' && testWins.has(body.id ?? 'main')) {
    const win = testWins.get(body.id ?? 'main');
    const [x, y] = win.getPosition();
    win.setPosition(x + (body.dx || 0), y + (body.dy || 0));
    return { ok: true };
  }
  if (route === 'mouse') {
    // the pointer moving over the overlay (css px), and clicking if asked, without touching the real one
    // { down: true } presses, { up: true } lets go (a drag, a throw), in between moves with the button held
    const at = { x: Math.round(body.x), y: Math.round(body.y) };
    overlay.webContents.sendInputEvent({ type: 'mouseMove', ...at });
    if (body.down) overlay.webContents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...at });
    if (body.up) overlay.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...at });
    if (body.click) {
      overlay.webContents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...at });
      overlay.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...at });
    }
    return { ok: true };
  }
  if (route === 'type') {
    // typing into the overlay (her chat), and Enter if asked
    if (body.text) await overlay.webContents.insertText(body.text);
    if (body.enter) {
      overlay.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Return' });
      overlay.webContents.sendInputEvent({ type: 'char', keyCode: 'Return' });
      overlay.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Return' });
    }
    return { ok: true };
  }
  if (route === 'settings') {
    // her settings window, on a tab ({ close: true } closes it)
    if (body.close) settingsWin?.destroy();
    else if (typeof body.find === 'string' && settingsWin) {
      // scroll to the card with that title (to capture it)
      await settingsWin.webContents.executeJavaScript(`[...document.querySelectorAll('.card__title')].find((n) => n.textContent.includes(${JSON.stringify(body.find)}))?.scrollIntoView()`);
    } else openSettings(body.tab);
    return { ok: true };
  }
  if (route === 'snapshot') {
    // the picture Look would send, saved (to check what her model is shown)
    const dir = path.join(app.isPackaged ? app.getPath('userData') : ROOT, 'captures');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'snapshot.jpg');
    const { image, ...seen } = await snapshot();
    fs.writeFileSync(file, Buffer.from(image, 'base64'));
    return { ok: true, file, ...seen };
  }
  if (route === 'config') {
    // { patch }: a setting changed, the way her settings window does it
    const now = updateConfig(body.patch || {});
    return { ok: true, config: Object.fromEntries(Object.keys(body.patch || {}).map((k) => [k, now[k]])) };
  }
  if (route === 'errand') {
    // what she'd do with these words (her errands), without saying it
    const said = String(body.text || '');
    return (await growth.command(said)) || life.run(said);
  }
  if (route === 'capture') {
    // { window: 'settings' }: her settings window instead of the overlay
    const target = body.window === 'settings' && settingsWin && !settingsWin.isDestroyed() ? settingsWin : overlay;
    const image = await target.webContents.capturePage();
    // installed, the app's own folder is read-only: its data folder instead
    const dir = path.join(app.isPackaged ? app.getPath('userData') : ROOT, 'captures');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${(body.name || 'frame').replace(/[^\w-]/g, '')}.png`);
    fs.writeFileSync(file, image.toPNG());
    return { ok: true, file };
  }
  throw new Error('unknown debug route');
}

// How her window is drawn, set before Electron starts (her menu › Display). On some PCs her see-through
// window shows up black (NVIDIA with FXAA, MFAA or HDR on, for one): drawing it through OpenGL, or
// without the graphics card, often fixes it.
function applyRender() {
  const { render } = config.load();
  if (render === 'gl') app.commandLine.appendSwitch('use-angle', 'gl');
  if (render === 'software') {
    app.disableHardwareAcceleration();
    app.commandLine.appendSwitch('enable-unsafe-swiftshader'); // her drawing still needs WebGL, done on the CPU
  }
  // --dev: what Chromium ended up drawing with
  if (DEV) app.whenReady().then(() => setTimeout(() => console.log('[capri] display:', render, JSON.stringify(app.getGPUFeatureStatus())), 4000));
}

function main() {
  applyRender();
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }
  app.on('second-instance', () => sendCommand('status'));
  if (process.platform === 'win32') app.setAppUserModelId('capri.desktop');

  app.whenReady().then(() => {
    if (!['codex', 'claude'].includes(config.load().assistant)) config.save({ assistant: activeAssistant().id });
    lang.load(resolveLang(config.load().lang));
    // her ears: the microphone, for her own pages only (the overlay and her settings), never for anything else
    const ours = (url) => String(url || '').startsWith('capri://');
    session.defaultSession.setPermissionRequestHandler((wc, permission, callback, details) => {
      callback(['media', 'audioCapture'].includes(permission) && ours(details?.requestingUrl || wc.getURL()) && (!details?.mediaTypes || !details.mediaTypes.includes('video')));
    });
    session.defaultSession.setPermissionCheckHandler((wc, permission, origin) => ['media', 'audioCapture'].includes(permission) && ours(origin || wc?.getURL()));
    serveProtocol();
    registerIpc();
    createOverlay();
    createTray();
    windowWatch = startWindowWatch({
      overlay,
      onUpdate: (data) => {
        // a click on the taskbar brings it up over her: sitting on it, her legs would vanish behind it
        if (data.taskbar && !lastWindows?.taskbar && config.load().rest === 'taskbar') raiseOverlay();
        // the last window closed (your desktop in front now, none of the windows): her pointer hook set up
        // again, the moment that's known to leave her unclickable; at most every 10 seconds
        const own = [overlay, settingsWin].filter((w) => w && !w.isDestroyed()).map(hwndOf); // her chat taking the keyboard isn't it
        const toDesktop = data.fg !== lastWindows?.fg && !data.taskbar && !own.includes(data.fg) && !(data.wins || []).some((w) => w.id === data.fg);
        if (toDesktop && Date.now() - lastDesktopRearm > 10000) {
          lastDesktopRearm = Date.now();
          rearmOverlay();
        }
        lastWindows = data;
        overlay?.webContents.send('windows:update', data);
      },
    });
    createBridge({
      port: PORT,
      // her own Claude Code chat's hooks would cover its answer with theirs
      onEvent: (evt) => !llm.isChatSession(evt.session_id) && overlay?.webContents.send('claude:event', evt),
      onDebug: DEV ? debugHandler : null,
    });
    registerHotkeys();
    watchVoices();
    growth.init({
      ask: (messages) => quickJob(() => askRaw(messages)), // her lessons: one quick job at a time, after your chat
      // her chats only go to a model on this PC, or to a cloud one you allowed (settings › Owner)
      allowed: () => {
        const cfg = config.load();
        return llm.isLocal(cfg.provider, cfg) || Boolean(cfg.cloudMemory) || Boolean(cfg.localBrain);
      },
      emit: (evt) => overlay?.webContents.send('life:event', evt),
      remember: (fact) => life.remember(fact),
      persona: () => personaText,
    });
    history.prune(Number(config.load().historyDays) || 0);
    // lessons from a bad look back (before her lessons were guarded) that made her refuse things
    const dropped = growth.sanitize();
    if (dropped.length) console.log('[capri] dropped lessons that made her refuse things:', dropped.length);
    setTimeout(() => pickLocalBrain().catch(() => {}), 5000);
    // installed (the exe), she starts with Windows the first time; her menu or settings turn it off
    if (app.isPackaged && !config.load().autostartSet) {
      app.setLoginItemSettings({ ...loginItemOptions(), openAtLogin: true });
      config.save({ autostartSet: true });
    }
    life.start({
      onEvent: (evt) => {
        if (evt.type === 'fullscreen') {
          onFullscreen(evt.on, evt.why);
          return;
        }
        // a setting changed by asking her ("matikan lirik"): saved like from her settings, everyone told
        if (evt.type === 'setConfig') {
          updateConfig(evt.patch);
          return;
        }
        // she stepped aside for a game: an alarm still gets through, as a Windows notification
        if (evt.type === 'alarm' && fullscreenAway && Notification.isSupported()) {
          new Notification({ title: 'Capri', body: evt.text, icon: path.join(ROOT, 'assets', 'icons', 'capri.png') }).show();
        }
        overlay?.webContents.send('life:event', evt);
        if (evt.type === 'alarms' || evt.type === 'study' || evt.type === 'sync') {
          rebuildTray();
          if (settingsWin && !settingsWin.isDestroyed()) settingsWin.webContents.send('settings:refresh');
        }
      },
      model: (messages) => askOnce(messages),
      raw: (messages) => quickJob(() => askRaw(messages, { timeout: 25000 })), // plain questions, no persona (what a song sounds like)
      coder: { claude: codeWithClaude, self: codeHerself }, // code you ask for (errands)
      look: () => lookAllowed().ok,
      shot: snapshot,
    });
    llm.restoreClaude(readMemory().claude);
    refreshModels(); // for her menu's model list
    setTimeout(() => launch.launchables().catch(() => {}), 20000); // what she can open, before you ask
    screen.on('display-metrics-changed', fitOverlay);
    screen.on('display-added', () => { fitOverlay(); rebuildTray(); });
    screen.on('display-removed', () => { fitOverlay(); rebuildTray(); });
    // after sleep or a locked screen, once Windows has settled
    powerMonitor.on('resume', () => setTimeout(rearmOverlay, 2000));
    powerMonitor.on('unlock-screen', () => setTimeout(rearmOverlay, 1000));
    setInterval(keepOnTop, 3000);
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    windowWatch?.stop();
    life.stop();
    earsDownload?.abort();
    voicesWatch?.close();
  });
  app.on('window-all-closed', (e) => e.preventDefault());
}

main();

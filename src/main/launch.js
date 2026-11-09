'use strict';

// Opening things when you ask her to (chat.js): an app from the Start menu (Store apps like Spotify
// included), a Steam or Epic game, your music (the media keys: pause, next…, so it works with
// Spotify and most players), a Spotify search, or a website. Windows only.

const fs = require('node:fs');
const path = require('node:path');
const { spawn, execFile } = require('node:child_process');
const { shell } = require('electron');
const { powershell } = require('./apps');
const helper = require('./helper');

const WIN = process.platform === 'win32';
// not things to open from a chat: uninstallers, help pages and the like
const SKIP = /uninstall|désinstaller|desinstalar|deinstall|readme|documentation|release notes|support center|website|manual/i;
const STEAM_SKIP = /redistributable|dedicated server|steamworks/i;
// words that don't tell apps apart ("Roblox Player" is "roblox")
const FILLER = new Set(['player', 'launcher', 'app', 'the', 'for', 'windows', 'desktop', 'client', 'x64', 'x86', 'beta']);
const CACHE_MS = 10 * 60 * 1000; // installed apps hardly change

let cache = null; // { at, items }

const plain = (text) => String(text || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
const words = (text) => plain(text).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2);

// Everything she can open: [{ name, kind: 'app' | 'steam' | 'epic', id }]
async function launchables() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.items;
  if (!WIN) return [];
  const items = [];
  const seen = new Set();
  const add = (item) => {
    const key = words(item.name).join(' ');
    if (!key || seen.has(key) || SKIP.test(item.name)) return;
    seen.add(key);
    items.push(item);
  };
  // games first: a game's own entry wins over a shortcut to it
  for (const game of [...steamGames(await steamRoot()), ...epicGames()]) add(game);
  // the Start menu's list is slow the first time (PowerShell starting cold): main.js asks for it early
  const out = await powershell('Get-StartApps | Select-Object Name, AppID | ConvertTo-Json -Compress', 45000).catch(() => null);
  for (const { Name, AppID } of [].concat(out ? JSON.parse(out) : [])) {
    if (Name && AppID && !/^https?:/i.test(AppID)) add({ name: Name, kind: 'app', id: AppID });
  }
  if (out !== null) cache = { at: Date.now(), items }; // a list that failed isn't kept: next time, again
  return items;
}

function steamRoot() {
  return new Promise((resolve) => {
    execFile('reg.exe', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'], { windowsHide: true, timeout: 5000 }, (err, out) => {
      const found = !err && /SteamPath\s+REG_SZ\s+(.+)/.exec(String(out))?.[1].trim();
      resolve(found ? path.normalize(found) : null);
    });
  });
}

// Steam's games, from the manifests in each of its libraries
function steamGames(root) {
  if (!root) return [];
  const libraries = new Set([root]);
  try {
    const vdf = fs.readFileSync(path.join(root, 'steamapps', 'libraryfolders.vdf'), 'utf8');
    for (const m of vdf.matchAll(/"path"\s+"([^"]+)"/g)) libraries.add(path.normalize(m[1].replace(/\\\\/g, '\\')));
  } catch {
    // one library, the main one
  }
  const games = [];
  for (const library of libraries) {
    let files = [];
    try {
      files = fs.readdirSync(path.join(library, 'steamapps')).filter((f) => /^appmanifest_\d+\.acf$/.test(f));
    } catch {
      continue;
    }
    for (const file of files) {
      try {
        const acf = fs.readFileSync(path.join(library, 'steamapps', file), 'utf8');
        const id = /"appid"\s+"(\d+)"/.exec(acf)?.[1];
        const name = /"name"\s+"([^"]+)"/.exec(acf)?.[1];
        if (id && name && !STEAM_SKIP.test(name)) games.push({ name, kind: 'steam', id });
      } catch {
        // a manifest being written: skip it
      }
    }
  }
  return games;
}

// Epic's games, from its launcher's manifests (not the Unreal Engine plugins it also keeps there)
function epicGames() {
  const dir = path.join(process.env.ProgramData || 'C:\\ProgramData', 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests');
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.item'));
  } catch {
    return [];
  }
  const games = [];
  for (const file of files) {
    try {
      const m = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      if (m.bIsIncompleteInstall || m.CatalogNamespace === 'ue' || !m.DisplayName || !m.AppName) continue;
      games.push({ name: m.DisplayName, kind: 'epic', id: `${m.CatalogNamespace}:${m.CatalogItemId}:${m.AppName}` });
    } catch {
      // not one of its manifests
    }
  }
  return games;
}

// The one of `items` named in `text` (your message, or the name in her tag): all the words of its
// name in it, else at least half of them; the closest wins. null if nothing fits well enough.
function match(items, text) {
  const said = new Set(words(text));
  const joined = words(text).join('');
  let best = null;
  for (const item of items) {
    const key = words(item.name).filter((w) => !FILLER.has(w));
    if (!key.length) continue;
    const hits = key.filter((w) => said.has(w) || (w.length >= 5 && joined.includes(w)));
    if (!hits.some((w) => w.length >= 3) || hits.length / key.length < 0.5) continue;
    const rank = (hits.length / key.length) * 10 + hits.join('').length / 10;
    if (!best || rank > best.rank) best = { item, rank };
  }
  return best?.item || null;
}

async function find(text) {
  return match(await launchables(), text);
}

// Whether the app's name has every word of what you said ("youtube music" isn't the app "Music"; "spotify" is
// the app "Spotify").
function covers(item, text) {
  const name = new Set(words(item?.name || ''));
  return words(text).filter((w) => !FILLER.has(w)).every((w) => name.has(w));
}

// Opens one of them (only something she listed herself): a Start menu app through its AppsFolder
// entry (desktop and Store apps alike), a game through its launcher's link.
async function launch({ kind, id } = {}) {
  const item = (await launchables()).find((i) => i.kind === kind && i.id === id);
  if (!item) throw new Error('not found');
  if (kind === 'steam') return shell.openExternal(`steam://rungameid/${id}`);
  if (kind === 'epic') return shell.openExternal(`com.epicgames.launcher://apps/${encodeURIComponent(id)}?action=launch&silent=true`);
  spawn('explorer.exe', [`shell:AppsFolder\\${id}`], { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
  return undefined;
}

// The media keys, as if pressed on the keyboard: whatever plays music (Spotify, a browser…) reacts.
// Play and pause are the same key; the volume moves a few steps at a time. Sent as keys (their virtual
// key codes), not typed: typed, they come out as "³" or "°" on a German keyboard.
const MEDIA = { pause: [0xb3, 1], play: [0xb3, 1], next: [0xb0, 1], previous: [0xb1, 1], volup: [0xaf, 5], voldown: [0xae, 5], mute: [0xad, 1] };
const KEY_DOWN = 1; // KEYEVENTF_EXTENDEDKEY
const KEY_UP = 3;   // ...and KEYEVENTF_KEYUP

async function media(action) {
  if (!WIN || !MEDIA[action]) return false;
  const [key, times] = MEDIA[action];
  if (helper.free()) return helper.call('keys', { vk: key, times }, { timeout: 4000 }).then(() => true, () => false);
  return powershell(
    'Add-Type -Namespace Capri -Name Keys -MemberDefinition \'[DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, System.UIntPtr extra);\'; '
    + `1..${times} | ForEach-Object { [Capri.Keys]::keybd_event(${key}, 0, ${KEY_DOWN}, [UIntPtr]::Zero); [Capri.Keys]::keybd_event(${key}, 0, ${KEY_UP}, [UIntPtr]::Zero) }`,
  ).then(() => true, () => false);
}

// What's playing, through Windows' media session (media.ps1, Spotify first): repeat, shuffle, back to the start,
// a jump forward or back. -> { ok, app, why, repeat, shuffle }
const MEDIA_PS1 = path.join(__dirname, 'media.ps1').replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
function session(action, seconds = 0) {
  if (!WIN) return Promise.resolve({ ok: false, why: 'windows' });
  if (helper.free()) return helper.script('media.ps1', { Action: action, Seconds: seconds }, { timeout: 15000 }).catch(() => ({ ok: false, why: 'failed' }));
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', MEDIA_PS1, action, String(seconds)],
      { windowsHide: true, timeout: 15000 }, (err, out) => {
        try {
          resolve(JSON.parse(String(out).trim().split('\n').pop()));
        } catch {
          resolve({ ok: false, why: err ? 'failed' : 'unreadable' });
        }
      });
  });
}

// Typing for you in another app (type.ps1): the apps she knows by name, and their processes; any other name is
// looked for as a process and in window titles.
const TYPE_TARGETS = [
  [/^(?:notepad|catatan)$/, ['Notepad', 'notepad']],
  [/^notepad\s*\+\+$/, ['notepad++']],
  [/^(?:vs ?code|visual studio code|code)$/, ['Code']],
  [/^antigravity$/, ['Antigravity']],
  [/^cursor$/, ['Cursor']],
  [/^windsurf$/, ['Windsurf']],
  [/^(?:google )?chrome$/, ['chrome']],
  [/^(?:microsoft )?edge$/, ['msedge']],
  [/^firefox$/, ['firefox']],
  [/^opera(?: gx)?$/, ['opera']],
  [/^brave$/, ['brave']],
  [/^discord$/, ['Discord']],
  [/^whatsapp$/, ['WhatsApp', 'WhatsApp.Root']],
  [/^telegram$/, ['Telegram']],
  [/^slack$/, ['slack']],
  [/^(?:microsoft )?teams$/, ['ms-teams', 'Teams']],
  [/^(?:microsoft )?word$/, ['WINWORD']],
  [/^(?:microsoft )?excel$/, ['EXCEL']],
  [/^(?:microsoft )?powerpoint$/, ['POWERPNT']],
  [/^(?:windows )?terminal$/, ['WindowsTerminal']],
  [/^(?:cmd|command prompt)$/, ['cmd']],
  [/^(?:windows )?powershell$/, ['powershell', 'pwsh']],
  [/^obsidian$/, ['Obsidian']],
  [/^notion$/, ['Notion']],
];
const CLICK_PS1 = path.join(__dirname, 'click.ps1').replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
const TYPE_PS1 = path.join(__dirname, 'type.ps1').replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);

// Text typed into an app (its name: "notepad", "Visual Studio Code"…), or into a window (hwnd), then keys pressed
// ('enter', 'save'…). fresh: the app was just opened (she waits for its window). onFound(hwnd, app): its window is
// in front and the typing starts. -> { ok, app, why }
// the typing going on (one at a time), for her Stop button
let typing = null;
function stopTyping() {
  if (!typing) return false;
  typing.stopped = true;
  typing.kill();
  return true;
}

// the processes of an app she knows by name, or the name itself: 'Notepad,notepad'
function processesOf(target) {
  const name = String(target || '').trim().toLowerCase();
  const known = name && TYPE_TARGETS.find(([re]) => re.test(name));
  return known ? known[1].join(',') : name.replace(/\s+/g, '');
}

// The title of a window ("hello.html - project - Antigravity"): which file is open in it.
function windowTitle(hwnd) {
  if (!WIN || !hwnd) return Promise.resolve('');
  if (helper.free()) return helper.call('title', { hwnd: Number(hwnd) }, { timeout: 4000 }).then((r) => String(r.title || '').trim(), () => '');
  const script = `Add-Type -Namespace CapriW -Name T -MemberDefinition '[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, System.Text.StringBuilder s, int n);'; $s = New-Object System.Text.StringBuilder 512; [void][CapriW.T]::GetWindowText([IntPtr]${Number(hwnd)}, $s, 512); [Console]::OutputEncoding = [Text.Encoding]::UTF8; $s.ToString()`;
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 6000, encoding: 'utf8' }, (err, out) => resolve(err ? '' : String(out || '').trim()));
  });
}

// A button pressed by its name (click.ps1): in the window you were in (hwnd), or in an app by name.
// -> { ok, name, app } | { ok: false, why, seen }
function click({ name = '', hwnd = 0, target = '' } = {}) {
  if (!WIN) return Promise.resolve({ ok: false, why: 'windows' });
  const params = { Name: String(name).slice(0, 60) };
  if (target) params.Process = processesOf(target);
  else if (hwnd) params.Hwnd = Number(hwnd);
  else return Promise.resolve({ ok: false, why: 'nowindow' });
  // a dialog that opens from a button can keep Windows' call waiting: it was pressed all the same
  if (helper.free()) return helper.script('click.ps1', params, { timeout: 8000 }).catch((err) => ({ ok: err.message === 'timeout', name, why: 'failed' }));
  const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', CLICK_PS1];
  for (const [k, v] of Object.entries(params)) args.push(`-${k}`, String(v));
  return new Promise((resolve) => {
    execFile('powershell.exe', args, { windowsHide: true, timeout: 12000, encoding: 'utf8' }, (err, out) => {
      try {
        resolve(JSON.parse(String(out).trim().split('\n').pop()));
      } catch {
        resolve({ ok: false, why: 'failed' });
      }
    });
  });
}

function typeInto({ text = '', target = '', hwnd = 0, keys = [], fresh = false, onFound = null, paste = false } = {}) {
  if (!WIN) return Promise.resolve({ ok: false, why: 'windows' });
  const name = String(target || '').trim().toLowerCase();
  const known = name && TYPE_TARGETS.find(([re]) => re.test(name));
  const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', TYPE_PS1, '-Wait', fresh ? '12000' : '4000', '-Fresh', fresh ? '1' : '0'];
  const start = args.indexOf('-Wait');
  if (hwnd && !name) args.push('-Hwnd', String(hwnd));
  else if (known) args.push('-Process', known[1].join(','));
  else if (name) args.push('-Process', name.replace(/\s+/g, ''), '-Title', String(target).trim());
  else return Promise.resolve({ ok: false, why: 'nowindow' });
  if (keys.length) args.push('-Keys', keys.join(','));
  if (paste) args.push('-Paste', '1'); // code: pasted whole, so the editor doesn't indent and close tags as it's typed
  const b64 = text ? Buffer.from(String(text), 'utf8').toString('base64') : ''; // every character, as it is
  if (b64) args.push('-B64', b64);
  return new Promise((resolve) => {
    stopTyping();
    // through the helper when it's free (no half a second first); her Stop button then drops the helper and starts another
    if (helper.free()) {
      const params = {};
      for (let i = start; i < args.length; i += 2) params[args[i].slice(1)] = args[i + 1];
      const job = { stopped: false, kill: () => helper.restart() };
      typing = job;
      let told = false;
      const onLine = (line) => {
        if (told || !/"found"/.test(line)) return;
        told = true;
        try {
          const { found, app } = JSON.parse(line);
          onFound?.(found, app);
        } catch { /* only for her show */ }
      };
      const end = (res) => {
        if (typing === job) typing = null;
        resolve(job.stopped ? { ok: false, why: 'stopped' } : res);
      };
      helper.script('type.ps1', params, { timeout: 60000, onLine }).then(end, () => end({ ok: false, why: 'failed' }));
      return;
    }
    const child = spawn('powershell.exe', args, { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    typing = child;
    let out = '';
    let told = false;
    const timer = setTimeout(() => child.kill(), 60000);
    child.stdout.on('data', (d) => {
      out += d;
      const first = /^\{[^\n]*"found"[^\n]*\}/m.exec(out);
      if (first && !told) {
        told = true;
        try {
          const { found, app } = JSON.parse(first[0]);
          onFound?.(found, app);
        } catch { /* only for her show */ }
      }
    });
    child.on('error', () => resolve({ ok: false, why: 'failed' }));
    child.on('close', () => {
      clearTimeout(timer);
      if (typing === child) typing = null;
      if (child.stopped) return resolve({ ok: false, why: 'stopped' });
      try {
        resolve(JSON.parse(out.trim().split('\n').pop()));
      } catch {
        resolve({ ok: false, why: 'failed' });
      }
    });
  });
}

// A Spotify search for it: in the app if it's installed, else on the web.
async function music(query) {
  const q = String(query || '').trim().slice(0, 200);
  if (!q) return false;
  try {
    await shell.openExternal(`spotify:search:${encodeURIComponent(encodeURIComponent(q))}`);
  } catch {
    await shell.openExternal(`https://open.spotify.com/search/${encodeURIComponent(q)}`);
  }
  return true;
}

// A website: http or https, with a real host name.
function siteUrl(address) {
  try {
    const url = new URL(/^https?:\/\//i.test(address) ? address : `https://${address}`);
    return ['http:', 'https:'].includes(url.protocol) && url.hostname.includes('.') ? url : null;
  } catch {
    return null;
  }
}

async function site(address) {
  const url = siteUrl(String(address || '').trim());
  if (!url) return false;
  await shell.openExternal(url.toString());
  return true;
}

module.exports = { launchables, match, find, covers, launch, media, session, click, typeInto, stopTyping, windowTitle, music, site, siteUrl };

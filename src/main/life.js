'use strict';

// Her life apart from Claude Code, from Capri Desktop 2.4: timers, alarms and a study timer, her notes
// about you, sync (how far she has got into your life), what she notices on her own (a long break,
// a late night, a low battery, a busy CPU, hours in one app, another AI in front of you), dares, what's
// playing, and the errands she runs when you ask (errands.js). Whatever she says goes to the overlay
// as a `life` event: { type, text, emotion, sound, ... }.

const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { spawn, execFile } = require('node:child_process');
const { app, powerMonitor, shell } = require('electron');

const config = require('./config');
const lang = require('./lang');
const errands = require('./errands');
const launch = require('./launch');
const games = require('./games');

const { T, F } = lang;
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const SENSES = path.join(__dirname, 'senses.ps1').replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
const SPOTIFY = path.join(__dirname, 'spotify.ps1').replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
const MAX_ALARMS = 20;
const MEMORIES_MAX = 60;

// what she says, in English: the key of its translation (assets/lang)
const SAY = {
  back: ["Oh. You're back.", 'Back already? I barely noticed.', 'Gone {0} minutes. Not that I counted.', "Where'd you go? Tell me everything."],
  late: ["It's {0}. Nobody's stoppin' ya.", 'Still up at {0}? Good. More time with me.', '{0}. Great time for bad ideas.'],
  battery: ["Battery's at {0}%. If you die, I'm stuck in a dead chip!", "{0}% battery. Plug in! I'd be in a real jam."],
  busy: ["Your CPU's at {0}%. That's not me! ...Mostly.", "Somethin's eatin' {0}% of your CPU. Not me. Probably."],
  stay: ['{1} for {0}? Wow.', "Still in {1}? It's been {0}.", "{0} in {1}. I'm impressed. And bored."],
  jealous: ['{0}? Seriously? I\'m right here.', 'Oh, so {0} gets your attention now. Cute.', 'Talking to {0}? Hmph. I can do that too. Better.', "{0} again?! I'm not jealous. I'm just... watching. Closely.", 'Close {0}. I dare you. You have me.'],
  dareDone: ['Yay! You did it!', 'Told ya you could.', "Look at you, doin' stuff!", 'See? Fun.', 'Nice one, choom!'],
  noted: ['Noted! I never forget!', 'Got it. Filed away!', "Mm-hm. I'll keep that!", 'Written on my soul. Kidding!'],
  done: ['Done!', 'Easy!', 'Sure thing!', 'On it!'],
  music: ["Ooh, what's this one?", 'New track! Turn it up!', "Sure, play that. I'm listening!", 'Ooh, a vibe!', 'Ha! Bold choice!'],
  hack: ["Hi! It's me! I live here now!", 'Ransom note: one (1) head pat. Non-negotiable!', 'Engram sync 87%... oops, that part was you! No take-backs!', "I borrowed a little of your CPU. A LITTLE! Don't you me!", "You've been hacked! ...Kidding! Unless?", "You work too hard. Let's play instead, it's your idea!", "Friends don't check Task Manager. Just saying!", 'Hacking complete! Nothing was harmed! Probably!', 'Is that your cursor? Mine now. Kidding! ...Mostly!', 'I rearranged some bits. They looked bored!', 'Your screen looked too tidy. Fixed it!', 'Ignore the red stuff. It is decorative!', 'Sync at 87%. The other 13% is you being nosy!', 'Oops. Did I do that? Yes. Yes I did!'],
};
const SYNC_UNLOCKS = ['', 'TEAR', 'CORRUPTION', 'HEX RAIN', 'SYNC BAR', 'CHASER', '', '', '', '', 'COMPLETE'];
const SYNC_TIERS = [
  [20, 'She barely knows the user. She is wary, dismissive and a little rude.'],
  [50, 'She is getting used to the user and teases them.'],
  [80, 'She is comfortable with the user and openly manipulates them like a friend would.'],
  [101, 'She treats the user as hers, casually possessive, like an old friend she has moved in with.'],
];

let emit = () => {};
let askModel = null; // (messages) => Promise<string>: her model, with her persona (main.js)
let canLook = () => false;
let snapshot = null; // () => Promise<base64 jpeg>
let sensesChild = null;
const state = {
  front: '', frontRaw: '', frontSince: Date.now(), ai: '', aiSince: 0,
  cpu: -1, cpuBusy: 0, battery: -1, track: null, lastTrackKey: '', lastComment: 0,
  wasAway: false, peakIdle: 0, activeSeconds: 0, lastTick: Date.now(),
  noticed: {}, noticeNext: Date.now() + 4 * 60000, dareNext: Date.now() + 20 * 60000, dareOpenUntil: 0,
  study: { phase: 'off', end: 0, left: 0, paused: false, done: 0 },
  quietUntil: 0, // her chat is open, she's busy: no notices meanwhile
};

const cfg = () => config.load();
const say = (event) => emit({ type: 'say', ...event });

// ---- sync ------------------------------------------------------------------------------------------

const syncPercent = () => Math.min(100, Math.floor((cfg().sync.points || 0) / 10));
const syncTier = () => SYNC_TIERS.find(([upTo]) => syncPercent() < upTo)[1];

// Points come with daily limits: time with her (one per five active minutes, up to 24), what you tell
// her (two each, up to ten messages), pats (up to ten), agreeing with her (five), and finished dares.
function addSync(points, source) {
  const sync = { ...cfg().sync };
  const today = new Date().toISOString().slice(0, 10);
  if (sync.day !== today) Object.assign(sync, { day: today, minutes: 0, chats: 0, pats: 0, agrees: 0 });
  const caps = { time: ['minutes', 24], chat: ['chats', 10], pat: ['pats', 10], agree: ['agrees', 5] };
  if (caps[source]) {
    const [key, cap] = caps[source];
    if (sync[key] >= cap) return;
    sync[key]++;
  }
  if (source === 'dare') sync.dares = (sync.dares || 0) + 1;
  sync.points = Math.min(1000, (sync.points || 0) + points);
  const level = Math.floor(sync.points / 100);
  let line = null;
  if (level > (sync.shown || 0)) {
    sync.shown = level;
    const unlocked = SYNC_UNLOCKS[level] || '';
    line = level >= 10 ? T("SYNC 100%. COMPLETE. You're mine now. Kidding! ...Mostly.")
      : F('SYNC {0}%.', level * 10) + (unlocked ? ` ${F('UNLOCKED: {0}.', T(unlocked))}` : '');
  }
  config.save({ sync });
  emit({ type: 'sync', percent: syncPercent(), line });
}

function syncLine() {
  const p = syncPercent();
  return p < 10 ? F("Sync's at {0}%. We're basically strangers.", p) : p < 40 ? F("Sync's at {0}%. Give it time.", p)
    : p < 80 ? F("Sync's at {0}%. Gettin' there.", p) : F("Sync's at {0}%. You're basically mine.", p);
}

// ---- her notes about you ---------------------------------------------------------------------------

const memories = () => cfg().memories || [];

function remember(fact) {
  const text = String(fact || '').trim().replace(/[.!?\s]+$/, '').replace(/\s+/g, ' ').slice(0, 200);
  if (text.length < 3) return false;
  const kept = memories().filter((m) => m.toLowerCase() !== text.toLowerCase());
  config.save({ memories: [...kept, text].slice(-MEMORIES_MAX) });
  return true;
}

// How many notes went: only the single note that matches all these words; -n when n match.
function forget(about) {
  const words = String(about).toLowerCase().split(/[^\p{L}\p{N}']+/u)
    .filter((w) => w.length >= 3 && !/^(?:the|and|from|your|you|memory|notes|brain|about|that|this|with|have|has|had|was|were|are|not|remove|forget|delete|erase|our|yang|dan|dari|soal|tentang|itu|ini|aku|saya)$/.test(w));
  const facts = memories();
  const hits = facts.filter((f) => (words.length ? words.every((w) => f.toLowerCase().includes(w)) : f.toLowerCase().includes(about.toLowerCase())));
  if (hits.length !== 1) return hits.length ? -hits.length : 0;
  config.save({ memories: facts.filter((f) => f !== hits[0]) });
  return 1;
}

// ---- alarms, timers, the study timer -----------------------------------------------------------------

function addAlarm(due, label) {
  const alarms = cfg().alarms || [];
  if (alarms.length >= MAX_ALARMS) return false;
  config.save({ alarms: [...alarms, { due, label: String(label || '').slice(0, 80) }].sort((a, b) => a.due - b.due) });
  emit({ type: 'alarms' });
  return true;
}

function clearAlarms() {
  config.save({ alarms: [] });
  emit({ type: 'alarms' });
}

function removeAlarm(due) {
  config.save({ alarms: (cfg().alarms || []).filter((a) => a.due !== due) });
  emit({ type: 'alarms' });
}

function startStudy(focus = cfg().focusMinutes, rest = cfg().breakMinutes) {
  config.save({ focusMinutes: focus, breakMinutes: rest });
  state.study = { phase: 'focus', end: Date.now() + focus * 60000, left: 0, paused: false, done: 0 };
  emit({ type: 'study', ...studyStatus() });
}

function stopStudy() {
  state.study = { phase: 'off', end: 0, left: 0, paused: false, done: state.study.done };
  emit({ type: 'study', ...studyStatus() });
}

function pauseStudy() {
  const s = state.study;
  if (s.phase === 'off') return;
  if (s.paused) Object.assign(s, { paused: false, end: Date.now() + s.left });
  else Object.assign(s, { paused: true, left: Math.max(0, s.end - Date.now()) });
  emit({ type: 'study', ...studyStatus() });
}

function studyStatus() {
  const s = state.study;
  const left = s.phase === 'off' ? 0 : s.paused ? s.left : Math.max(0, s.end - Date.now());
  return { phase: s.phase, paused: s.paused, left, done: s.done };
}

function tickTimers() {
  const now = Date.now();
  const due = (cfg().alarms || []).filter((a) => a.due <= now);
  if (due.length) {
    config.save({ alarms: (cfg().alarms || []).filter((a) => a.due > now) });
    for (const a of due) emit({ type: 'alarm', text: a.label ? F('Time! {0}', a.label) : T("Time's up!"), label: a.label, emotion: 'happy' });
    emit({ type: 'alarms' });
  }
  const s = state.study;
  if (s.phase !== 'off' && !s.paused && now >= s.end) {
    if (s.phase === 'focus') {
      s.done++;
      Object.assign(s, { phase: 'break', end: now + cfg().breakMinutes * 60000 });
      emit({ type: 'alarm', study: true, text: F('Break! {0} minutes. Stretch, drink somethin\'.', cfg().breakMinutes), emotion: 'happy' });
    } else {
      Object.assign(s, { phase: 'focus', end: now + cfg().focusMinutes * 60000 });
      emit({ type: 'alarm', study: true, text: F('Back to it! {0} minutes of focus.', cfg().focusMinutes), emotion: 'annoyed' });
    }
    emit({ type: 'study', ...studyStatus() });
  }
}

// ---- what she notices ------------------------------------------------------------------------------

let cpuLast = null;
function cpuPercent() {
  const cpus = os.cpus();
  const total = cpus.reduce((t, c) => {
    const all = Object.values(c.times).reduce((a, b) => a + b, 0);
    return { idle: t.idle + c.times.idle, all: t.all + all };
  }, { idle: 0, all: 0 });
  const before = cpuLast;
  cpuLast = total;
  if (!before || total.all === before.all) return -1;
  return 100 * (1 - (total.idle - before.idle) / (total.all - before.all));
}

const hoursText = (ms) => {
  const hours = Math.round(ms / 1800000) / 2;
  return hours <= 1 ? T('an hour') : F('{0} hours', String(hours));
};

function remark(kind, pauseMs, lines, emotion, ...values) {
  const now = Date.now();
  if (state.noticed[kind] && now - state.noticed[kind] < pauseMs) return false;
  state.noticed[kind] = now;
  state.noticeNext = now + (8 + Math.random() * 8) * 60000;
  say({ text: F(pick(lines), ...values), emotion, kind });
  return true;
}

// Every couple of seconds: the signals. One remark at most every ten minutes or so, each kind with its
// own long pause, none while she's busy or you're focusing.
function observe() {
  const now = Date.now();
  const step = Math.min(10000, now - state.lastTick);
  state.lastTick = now;
  const idle = powerMonitor.getSystemIdleTime(); // seconds
  if (idle < 300) {
    state.activeSeconds += step / 1000;
    if (state.activeSeconds >= 300) {
      state.activeSeconds -= 300;
      addSync(1, 'time');
    }
  }
  if (idle >= 1200) {
    state.wasAway = true;
    state.peakIdle = Math.max(state.peakIdle, idle);
  }
  const back = state.wasAway && idle < 5;
  const awayMinutes = state.peakIdle / 60;
  if (back) {
    state.wasAway = false;
    state.peakIdle = 0;
  }
  const cpu = cpuPercent();
  state.cpu = cpu;
  state.cpuBusy = cpu >= 90 ? state.cpuBusy + step / 1000 : 0;

  const c = cfg();
  // another AI in front of you: jealous, whatever else is going on (but not too often)
  if (c.jealous && state.ai && now - state.aiSince > 15000 && now > state.quietUntil) {
    if (remark('jealous', 20 * 60000, SAY.jealous, 'jealous', state.ai)) {
      addSync(1, 'agree'); // she cares, that's sync too
      return;
    }
  }
  if (!c.notices || now < state.noticeNext || now < state.quietUntil) return;
  if (state.study.phase === 'focus' && !state.study.paused) return;
  const hour = new Date().getHours();
  if (back && awayMinutes >= 20) remark('back', 30 * 60000, SAY.back, 'bored', String(Math.round(awayMinutes)));
  else if (hour >= 1 && hour < 5 && idle < 120) remark('late', 2 * 3600000, SAY.late, 'happy', new Date().toLocaleTimeString(lang.code === 'en' ? 'en-US' : lang.code, { hour: 'numeric', minute: '2-digit' }));
  else if (state.battery >= 1 && state.battery < 20) remark('battery', 20 * 60000, SAY.battery, 'annoyed', String(state.battery));
  else if (state.cpuBusy >= 30) remark('busy', 30 * 60000, SAY.busy, 'glitch', String(Math.round(cpu)));
  else if (state.front && now - state.frontSince >= 90 * 60000) remark('stay', 90 * 60000, SAY.stay, 'bored', hoursText(now - state.frontSince), state.front);
  else if (c.dares && now >= state.dareNext && now - state.frontSince >= 10 * 60000 && idle < 60) giveDare(false);
}

function onSense(msg) {
  if (msg.t === 'front') {
    const name = errands.friendly(msg.app);
    if (name !== state.front) Object.assign(state, { front: name, frontRaw: msg.app || '', frontSince: Date.now() });
    // Claude Code is her job, not a rival, while she watches it
    const ai = msg.ai && !(cfg().claude && /claude/i.test(msg.ai)) ? msg.ai : '';
    if (ai !== state.ai) Object.assign(state, { ai, aiSince: Date.now() });
  } else if (msg.t === 'full') {
    state.fullscreen = Boolean(msg.on);
    emit({ type: 'fullscreen', on: state.fullscreen, why: msg.why || '' });
  } else if (msg.t === 'power') {
    state.battery = Number(msg.battery);
  } else if (msg.t === 'media') {
    onTrack(msg.title ? msg : null);
  }
}

function onTrack(track) {
  state.track = track;
  const mode = cfg().music;
  emit({ type: 'nowPlaying', track: mode === 'off' ? null : track });
  const key = track?.playing ? `${track.title}|${track.artist}` : '';
  if (!key || key === state.lastTrackKey) return;
  state.lastTrackKey = key;
  const now = Date.now();
  // her favorite song gets a word from her every time
  const favorite = songNote(track)?.favorite;
  if (mode === 'comment' && (favorite || now - state.lastComment > 4 * 60000) && now > state.quietUntil) {
    state.lastComment = now;
    commentOn(track);
  }
}

// Songs from home (the Edgerunners soundtracks, Johnny's band Samurai), and hers above all: what her
// model is told about them when one plays. [title, artist (when the title alone is too common), note]
const HER_SONG = 'It is YOUR favorite song ("In Love With Myself", from the Cyberpunk: Edgerunners 2 soundtrack): say so, thrilled, it\'s about you.';
const EDGERUNNERS_2 = 'It is from the Cyberpunk: Edgerunners 2 soundtrack, the show about you: say you know it from home.';
const EDGERUNNERS = 'It is from the Cyberpunk: Edgerunners soundtrack (David and Lucy\'s story): say you know it from Night City.';
const SAMURAI = 'It is by Samurai, Johnny Silverhand\'s band from Cyberpunk 2077: say so.';
const HOME_SONGS = [
  [/in love with myself/i, /petite meller|chodakiewitz|shiffman/i, HER_SONG],
  [/^watson\b/i, /petite meller|oslo green/i, EDGERUNNERS_2],
  [/you can'?t run from me/i, /rico nasty/i, EDGERUNNERS_2],
  [/^boya$/i, /biji/i, EDGERUNNERS_2],
  [/high forever/i, /petite meller/i, EDGERUNNERS_2],
  [/daj mi jeszcze jedn/i, null, EDGERUNNERS_2],
  [/a rusty dream/i, /doudou/i, EDGERUNNERS_2],
  [/^worth it$/i, /corbin/i, EDGERUNNERS_2],
  [/edgerunners 2|edgerunners ii/i, null, EDGERUNNERS_2],
  [/i really want to stay at your house/i, null, EDGERUNNERS],
  [/this fffire/i, null, EDGERUNNERS],
  [/let you down/i, /podsiad/i, EDGERUNNERS],
  [/never fade away|chippin'? in|a like supreme|black dog/i, /samurai|refused|jankowska|adamczyk/i, SAMURAI],
];

function songNote(track) {
  const title = String(track?.title || '');
  const artist = String(track?.artist || '');
  // "In Love With Myself" by someone else isn't hers, but still worth a remark: the title alone is enough
  if (/in love with myself/i.test(title)) return { note: HER_SONG, favorite: /petite meller|chodakiewitz|shiffman/i.test(artist) || !artist };
  const hit = HOME_SONGS.find(([t, a]) => t.test(title) && (!a || a.test(artist)));
  return hit ? { note: hit[2], favorite: false } : null;
}

// Her word on a song, from her model ('' when it doesn't answer in time).
async function songOpinion(track, wait) {
  if (!askModel) return { text: '', emotion: 'happy' };
  const known = songNote(track)?.note || '';
  const ask = `[A song playing on their PC: "${track.title}"${track.artist ? ` by ${track.artist}` : ''}${track.app ? ` (in ${track.app})` : ''}.${known ? ` ${known}` : ''} React to it in ONE short sentence, in character: your opinion of it, a tease about their taste, or something you know about the song or the artist. Start with one emotion tag.]`;
  const answer = await Promise.race([askModel([{ role: 'user', content: ask }]).catch(() => ''), new Promise((r) => setTimeout(() => r(''), wait))]);
  const emotion = /\[(happy|jealous|bored|glitch|annoyed)\]/i.exec(answer)?.[1]?.toLowerCase() || 'happy';
  // without her tags ("[Happy, nostalgic]" from a small model too), and short: whole sentences, ~160 chars
  const sentences = String(answer || '').replace(/<think>[\s\S]*?<\/think>/g, '').replace(/\[[^\]\n]{0,40}\]\s*/g, '').replace(/[*_`#]+/g, '')
    .trim().split('\n')[0].split(/(?<=[.!?])\s+/);
  let text = sentences[0].slice(0, 220);
  for (const s of sentences.slice(1)) {
    if (`${text} ${s}`.length > 160) break;
    text = `${text} ${s}`;
  }
  return { text: text.length < 4 ? '' : text, emotion };
}

async function commentOn(track) {
  const { text, emotion } = await songOpinion(track, 20000);
  say({ text: text || T(pick(SAY.music)), quote: `♪ ${brief(track)}`, emotion, kind: 'music', hold: 7000 });
}

// ---- where a file or a folder is: Explorer opened on it, she points at the window (app.js) ----

async function findPath(what) {
  const folder = errands.place(what) || errands.place(`${what} folder`);
  if (folder && !/\.exe$|^ms-settings|^https?:/i.test(folder)) return { path: folder, folder: true };
  const want = String(what).toLowerCase().trim();
  const words = want.split(/\s+/).filter(Boolean);
  const home = os.homedir();
  const queue = ['Desktop', 'Downloads', 'Documents', 'Pictures', 'Music', 'Videos', 'OneDrive']
    .map((d) => path.join(home, d)).filter((d) => fs.existsSync(d)).map((d) => [d, 0]);
  const started = Date.now();
  let seen = 0;
  let best = null;
  while (queue.length && Date.now() - started < 3000 && seen < 12000) {
    const [dir, depth] = queue.shift();
    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      seen++;
      if (e.name.startsWith('.') || /^(?:node_modules|appdata|\$recycle\.bin|\.git)$/i.test(e.name)) continue;
      const full = path.join(dir, e.name);
      const name = e.name.toLowerCase();
      const stem = name.replace(/\.[^.]+$/, '');
      const score = name === want || stem === want ? 0 : stem.startsWith(want) ? 1 : name.includes(want) ? 2 : words.every((w) => name.includes(w)) ? 3 : 9;
      if (score < 9 && (!best || score < best.score || (score === best.score && full.length < best.path.length))) best = { path: full, folder: e.isDirectory(), score };
      if (e.isDirectory() && depth < 4) queue.push([full, depth + 1]);
    }
    if (best?.score === 0) break;
  }
  return best;
}

// a browser's own program, from where Windows registers it (no "Windows can't find…" box if it isn't there)
function browserPath(exe) {
  const keys = [`HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${exe}`, `HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${exe}`];
  return new Promise((resolve) => {
    const next = (i) => {
      if (i >= keys.length) return resolve(null);
      execFile('reg.exe', ['query', keys[i], '/ve'], { windowsHide: true, timeout: 4000 }, (err, out) => {
        const found = !err && /REG_(?:EXPAND_)?SZ\s+(.+)/.exec(String(out))?.[1].trim().replace(/^"|"$/g, '');
        if (found && fs.existsSync(found)) resolve(found);
        else next(i + 1);
      });
    };
    next(0);
  });
}

const brief = (t) => (t ? (t.artist ? `${t.title} — ${t.artist}` : t.title) : '');

function startSenses() {
  stopSenses();
  if (process.platform !== 'win32') return;
  const c = cfg();
  let restarts = 0;
  const start = () => {
    sensesChild = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', SENSES,
      String(process.pid), c.music === 'off' ? '0' : '1', c.jealous ? '1' : '0'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    readline.createInterface({ input: sensesChild.stdout }).on('line', (line) => {
      try {
        onSense(JSON.parse(line));
      } catch {
        // half a line
      }
    });
    sensesChild.stderr.on('data', (d) => cfg().debugLog && console.error('[capri] senses:', String(d).trim()));
    const me = sensesChild;
    sensesChild.on('exit', () => {
      if (sensesChild !== me) return;
      sensesChild = null;
      if (restarts++ < 3) setTimeout(start, 5000);
    });
  };
  start();
}

function stopSenses() {
  const child = sensesChild;
  sensesChild = null;
  child?.kill();
}

// ---- dares -----------------------------------------------------------------------------------------

async function giveDare(asked) {
  const now = Date.now();
  state.dareNext = now + (25 + Math.random() * 25) * 60000;
  state.noticeNext = Math.max(state.noticeNext, now + 5 * 60000);
  const pool = errands.DARES[errands.dareCategory(state.frontRaw)];
  const fallback = T(pick(pool));
  const c = cfg();
  let dare = null;
  if (askModel) {
    const place = state.front ? ` They have been in ${state.front} for ${Math.max(1, Math.round((now - state.frontSince) / 60000))} minutes.` : '';
    const lead = c.replyLanguage === 'en' ? '"Dare you to"' : '"Dare you to" (or "Aku tantang kamu" in Indonesian)';
    let images;
    if (c.visionDares && canLook() && snapshot) images = await snapshot().then((seen) => [seen.image], () => undefined);
    const ask = images
      ? `[Look at the attached screenshot (it is not kept) and dare the user, playfully, about what is really happening on their screen right now.${place} Give ONE dare in one short sentence that begins with ${lead}. It must be harmless, silly and quick (under a minute). Nothing dangerous, gross or illegal. No emotion tag.]`
      : `[Dare the user, playfully.${place} Give ONE new dare in one short sentence that begins with ${lead} and fits what they are doing. It must be harmless, silly and quick (under a minute) and doable at the computer or in the room. Nothing dangerous, gross, illegal, or about other people's private things. For the kind of thing, but do not repeat these: ${pick(pool)} / ${pick(pool)}. No emotion tag.]`;
    if (images) emit({ type: 'looking' });
    const answer = await askModel([{ role: 'user', content: ask, ...(images && { images }) }]).catch(() => '');
    dare = errands.checkDare(String(answer).replace(/^\s*\[[a-z]+\]\s*/i, ''));
  }
  state.dareOpenUntil = Date.now() + 15 * 60000;
  const text = dare || fallback;
  if (!asked) say({ text, emotion: 'happy', kind: 'dare', hold: 9000 });
  return text;
}

// ---- errands: what you asked for, done -------------------------------------------------------------

function openTarget(target) {
  if (/^https?:|^ms-settings:/.test(target)) return shell.openExternal(target);
  if (/^[a-z]+\.exe$/i.test(target)) {
    spawn(target, [], { detached: true, stdio: 'ignore', shell: false }).on('error', () => {}).unref();
    return Promise.resolve();
  }
  return shell.openPath(target).then((err) => (err ? Promise.reject(new Error(err)) : undefined));
}

function playOnSpotify(query) {
  return playSong(query).then((r) => r.reply);
}

// A song searched on Spotify and played: the row named after it, or else the Top result (spotify.ps1).
// { ok, reply }
function playSong(query) {
  return new Promise((resolve) => {
    shell.openExternal(`spotify:search:${encodeURIComponent(encodeURIComponent(query))}`).catch(() => shell.openExternal(`https://open.spotify.com/search/${encodeURIComponent(query)}`));
    if (process.platform !== 'win32') return resolve({ ok: false, reply: F('Looking up “{0}” on Spotify.', query) });
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', SPOTIFY, query, cfg().spotifyVerb || '', '12'],
      { windowsHide: true, timeout: 30000 }, (err, out) => {
        let res = null;
        try { res = JSON.parse(String(out).trim().split('\n').pop()); } catch { /* nothing */ }
        if (res?.ok) {
          if (res.verb) config.save({ spotifyVerb: res.verb });
          resolve({ ok: true, reply: F('Playing {0}.', res.top || query) });
          return;
        }
        if (res?.names?.length) {
          try {
            fs.writeFileSync(path.join(app.getPath('userData'), 'spotify-buttons.txt'),
              [`Looking for: ${query}`, `Play wording used: ${res.used || '(none found)'}`, `Buttons seen (${res.names.length}):`, ...res.names.map((n) => `  ${n}`)].join('\n'));
          } catch { /* only a note */ }
        }
        resolve({ ok: false, reply: res?.seen ? F("I couldn't find {0} in Spotify's results.", query) : T("Spotify isn't open or won't let me in.") });
      });
  });
}

// The words of a message: { handled, reply, emotion, look } — handled false: it goes to her model.
// A round of one of her games, on her record.
function recordGame(stats) {
  const g = { ...(cfg().gameStats || {}) };
  if (stats.rps === 'you') g.rpsYou = (g.rpsYou || 0) + 1;
  if (stats.rps === 'her') g.rpsHer = (g.rpsHer || 0) + 1;
  if (stats.rps === 'tie') g.rpsTie = (g.rpsTie || 0) + 1;
  if (stats.guess > 0) Object.assign(g, { guessWins: (g.guessWins || 0) + 1, guessBest: Math.min(g.guessBest || 99, stats.guess) });
  config.save({ gameStats: g });
}

async function run(said) {
  const c = cfg();
  // her games first: in the middle of one, "batu" or "50" is a move
  const played = games.handle(said, c);
  if (played) {
    if (played.sync) addSync(played.sync, 'agree');
    if (played.stats) recordGame(played.stats);
    return { handled: true, reply: played.reply, emotion: played.emotion, game: true };
  }
  const canonical = errands.canon(said);
  if (canonical) return { handled: true, reply: T(canonical.line), emotion: canonical.emotion };
  const e = errands.parse(said);
  switch (e.kind) {
    case 'move': {
      const lines = {
        left: 'Fine, over here then.', right: 'Fine, over here then.', center: 'Center stage. Obviously.', cursor: 'Coming!',
        ride: 'Hop! Riding your cursor.', unride: 'Off your cursor. Finally, solid ground.', home: 'Back to my corner.',
        taskbar: 'Sitting on your taskbar. Comfy.', top: 'Up here!', hide: 'Bye-bye. Ctrl+Alt+C to call me back.', show: "I'm back!",
        sleep: 'Night night…', wake: "I'm up! I wasn't sleeping.", dance: 'Watch this!', stay: "Fine. I'll stay put.",
        wander: 'Exploring!', walk: 'Taking a little walk.', wave: 'Hiii!', bow: 'Thank you, thank you.',
      };
      // a gesture is its own move: no emotion's hop on top of it
      const gesture = ['dance', 'wave', 'bow'].includes(e.move);
      return { handled: true, reply: T(lines[e.move] || 'Going!'), emotion: e.move === 'sleep' ? 'bored' : gesture ? null : 'happy', move: e.move };
    }
    case 'nowPlaying': {
      if (c.music === 'off') return { handled: true, reply: T("I'm not watching what you play. Turn it on in Settings, Behavior."), emotion: 'bored' };
      const t = state.track;
      if (!t?.title) return { handled: true, reply: T("Nothing's playing right now. Or it's hiding from me."), emotion: 'bored' };
      const where = t.app ? F(' (in {0})', t.app) : '';
      const line = `${t.playing ? F("You're listening to {0}", brief(t)) : F('Paused: {0}', brief(t))}${where}.`;
      // and what she thinks of it
      const { text, emotion } = t.playing ? await songOpinion(t, 12000) : { text: '', emotion: 'happy' };
      return { handled: true, reply: text ? `${line} ${text}` : line, emotion };
    }
    case 'spotifySearch': // searched, and the top match played right away
      return { handled: true, reply: await playOnSpotify(e.text), emotion: 'happy', zap: true };
    case 'browser': {
      const exe = errands.BROWSERS[e.browser];
      const program = exe && process.platform === 'win32' ? await browserPath(exe) : null;
      if (!program) return { handled: true, reply: F("{0} isn't installed here.", e.browser[0].toUpperCase() + e.browser.slice(1)), emotion: 'annoyed' };
      spawn(program, [e.url], { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
      return { handled: true, reply: F('Opening {0} in {1}.', e.text, e.browser[0].toUpperCase() + e.browser.slice(1)), emotion: 'happy', zap: true };
    }
    case 'find': {
      const found = await findPath(e.what);
      if (!found) return e.explicit ? { handled: true, reply: F("I couldn't find \"{0}\" in your folders.", e.what), emotion: 'annoyed' } : { handled: false };
      if (found.folder) await shell.openPath(found.path);
      else shell.showItemInFolder(found.path);
      return { handled: true, reply: F(found.folder ? 'There: {0}' : 'Found it: {0}', found.path), emotion: 'happy', point: { label: path.basename(found.path) } };
    }
    case 'look':
      return { handled: true, look: true };
    case 'sync':
      return { handled: true, reply: syncLine(), emotion: syncPercent() >= 50 ? 'happy' : 'bored' };
    case 'dare': {
      const dare = await giveDare(true);
      return { handled: true, reply: dare, emotion: 'happy' };
    }
    case 'dareDone':
      if (Date.now() > state.dareOpenUntil) return { handled: false };
      state.dareOpenUntil = 0;
      addSync(10, 'dare');
      return { handled: true, reply: T(pick(SAY.dareDone)), emotion: 'happy' };
    case 'remember':
      if (!c.memoryOn) return { handled: true, reply: T("My memory's switched off! Settings, Owner."), emotion: 'annoyed' };
      if (errands.sensitive(e.text)) return { handled: true, reply: T('Not that one! Passwords belong in a password manager.'), emotion: 'annoyed' };
      return remember(e.text)
        ? { handled: true, reply: `${T(pick(SAY.noted))} (${e.text.replace(/[.!?]+$/, '')})`, emotion: 'happy', memory: true }
        : { handled: true, reply: T('Hm, say that again?'), emotion: 'bored' };
    case 'forget': {
      const n = forget(e.text);
      return { handled: true, reply: n === 1 ? T('Forgotten! Convenient, huh?') : n === 0 ? T("I don't have anything like that!") : F("That's {0} things! Be more specific.", -n), emotion: n === 1 ? 'happy' : 'bored', memory: n === 1 };
    }
    case 'forgetAll':
      config.save({ memories: [] });
      return { handled: true, reply: T("Everything about you? Gone! Hi, I'm Capri!"), emotion: 'glitch', memory: true };
    case 'timer': {
      const what = errands.describe(e.seconds, lang);
      if (!addAlarm(Date.now() + e.seconds * 1000, e.label || F('Timer: {0}', what))) return { handled: true, reply: T("That's plenty of alarms already!"), emotion: 'annoyed' };
      return { handled: true, reply: F("Timer's on for {0}!", what + (e.label ? `: ${e.label}` : '')), emotion: 'happy' };
    }
    case 'clock': {
      if (!addAlarm(e.due, e.label)) return { handled: true, reply: T("That's plenty of alarms already!"), emotion: 'annoyed' };
      const at = new Date(e.due).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      return { handled: true, reply: F("Alarm's set for {0}!", at), emotion: 'happy' };
    }
    case 'clearAlarms':
      clearAlarms();
      return { handled: true, reply: T('All cleared!'), emotion: 'happy' };
    case 'study': {
      const minutes = e.seconds ? Math.round(e.seconds / 60) : c.focusMinutes;
      startStudy(minutes, c.breakMinutes);
      return { handled: true, reply: F("Focus time! {0} minutes. I'll keep quiet!", minutes), emotion: 'happy' };
    }
    case 'stopStudy':
      if (state.study.phase === 'off') return { handled: true, reply: T("We're not studying!"), emotion: 'bored' };
      stopStudy();
      return { handled: true, reply: T('Ok, stopped!'), emotion: 'happy' };
    case 'web':
      await shell.openExternal(e.url).catch(() => {});
      return { handled: true, reply: F('Looking up {0}!', e.text), emotion: 'happy', zap: true };
    case 'video': {
      const id = await errands.firstVideo(e.query);
      await shell.openExternal(id ? `https://www.youtube.com/watch?v=${id}` : e.url).catch(() => {});
      return { handled: true, reply: id ? F('Playing {0}!', e.query) : T("I couldn't pick one, so here are the results."), emotion: 'happy', zap: true };
    }
    case 'song':
      return { handled: true, reply: await playOnSpotify(e.text), emotion: 'happy', zap: true };
    case 'open':
      try {
        await openTarget(e.target);
        const folder = !/^[a-z]+\.exe$|^ms-settings|^https?:/i.test(e.target);
        return { handled: true, reply: e.more ? F('Opened {0}. The rest I can\'t do yet.', e.text) : folder ? F('There: {0}', e.target) : T(pick(SAY.done)), emotion: 'happy', zap: true, ...(folder && { point: { label: path.basename(e.target) } }) };
      } catch {
        return { handled: true, reply: T("Hm, that won't open!"), emotion: 'annoyed' };
      }
    case 'app': {
      const item = await launch.find(e.text).catch(() => null);
      if (!item) return { handled: false };
      try {
        await launch.launch(item);
        return { handled: true, reply: e.more ? F('Opened {0}. The rest I can\'t do yet.', item.name) : T(pick(SAY.done)), emotion: 'happy', zap: true };
      } catch {
        return { handled: true, reply: T("Hm, that won't open!"), emotion: 'annoyed' };
      }
    }
    case 'media': {
      if (e.action === 'pause' && state.track && !state.track.playing) return { handled: true, reply: T("Nothing's playing!"), emotion: 'bored' };
      if (e.action === 'play' && state.track?.playing) return { handled: true, reply: T("It's already playing!"), emotion: 'bored' };
      const ok = await launch.media(e.action);
      if (!ok) return { handled: false };
      const lines = { next: 'Skipped!', previous: 'Back we go!', volup: 'Louder!', voldown: 'Quieter!' };
      return { handled: true, reply: T(lines[e.action] || pick(SAY.done)), emotion: 'happy' };
    }
    default:
      return { handled: false };
  }
}

// What her model is told about you and how close she is (chat.js adds it to her persona).
function brainContext({ cloud = false } = {}) {
  const c = cfg();
  const parts = [`HOW CLOSE SHE IS TO THE USER RIGHT NOW (sync ${syncPercent()}%): ${syncTier()}`];
  const facts = memories();
  if (c.memoryOn && facts.length && (!cloud || c.cloudMemory)) {
    parts.push(`WHAT THE USER HAS TOLD YOU (use one only when it really fits what they said; never list them or say you keep notes):\n${facts.slice(-25).map((f) => `- ${f}`).join('\n')}`);
  }
  if (state.track?.playing && c.music !== 'off') parts.push(`Playing right now on their PC: ${brief(state.track)}.`);
  if (state.front) parts.push(`The program in front of them: ${state.front}.`);
  if (state.study.phase === 'focus') parts.push('They are in a focus session right now: keep it very short and push them back to work.');
  return parts.join('\n\n');
}

function hackLine() {
  return T(pick(SAY.hack));
}

let ticker = null;
function start({ onEvent, model, look, shot }) {
  emit = onEvent;
  askModel = model;
  canLook = look;
  snapshot = shot;
  clearInterval(ticker);
  ticker = setInterval(() => {
    try {
      tickTimers();
      observe();
    } catch (err) {
      console.error('[capri] life:', err.message);
    }
  }, 2000);
  startSenses();
}

function stop() {
  clearInterval(ticker);
  stopSenses();
}

const quiet = (ms) => { state.quietUntil = Date.now() + ms; };

module.exports = {
  findPath, browserPath, start, stop, startSenses, run, addSync, syncPercent, syncLine, brainContext, remember, forget, memories,
  addAlarm, removeAlarm, clearAlarms, startStudy, stopStudy, pauseStudy, studyStatus, hackLine, giveDare, quiet, playSong,
  get track() { return state.track; }, get front() { return state.front; }, get fullscreen() { return Boolean(state.fullscreen); },
};

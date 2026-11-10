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

const config = require('./core/config');
const lang = require('./core/lang');
const errands = require('./commands/errands');
const launch = require('./platform/launch');
const games = require('./actions/games');
const lyrics = require('./online/lyrics');
const { vocabulary } = require('./voice/hearing');
const actionsLog = require('./core/actions-log');
const weather = require('./online/weather');
const plugins = require('./actions/plugins');
const { createMood } = require('./engines/mood');
const songdata = require('./online/songdata');
const { createTasks, orStopped } = require('./actions/tasks');
const planner = require('./actions/planner');
const { createTools } = require('./actions/tools');
const router = require('./engines/router');
const web = require('./online/web');

const { T, F } = lang;
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const SENSES = path.join(__dirname, 'platform', 'senses.ps1').replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
const SPOTIFY = path.join(__dirname, 'platform', 'spotify.ps1').replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
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
const SYNC_UNLOCKS = ['', 'TEAR + GLITCH FORM', 'CORRUPTION + SPARK FORM', 'HEX RAIN', 'SYNC BAR + SHARDS FORM', 'CHASER', 'SILHOUETTE FORM', '', '', '', 'COMPLETE'];
const SYNC_TIERS = [
  [20, 'She barely knows the user. She is wary, dismissive and a little rude.'],
  [50, 'She is getting used to the user and teases them.'],
  [80, 'She is comfortable with the user and openly manipulates them like a friend would.'],
  [101, 'She treats the user as hers, casually possessive, like an old friend she has moved in with.'],
];

let emit = () => {};
let coder = null;    // { claude(task), self(task) }: code you ask for (main.js)
let askModel = null; // (messages) => Promise<string>: her model, with her persona (main.js)
let askPlain = null; // (messages) => Promise<string>: her model as is, for plain questions (main.js)
let frontWindow = null; // () => the window you were in before talking to her (main.js), for typing in it
const startedAt = Date.now(); // her morning brief waits until she has settled in
let held = null; // her renderer holds her down to her mask ('game', 'focus', 'quiet'): no remarks, dares or brief
let brainParts = {}; // { memory, knowledge, skills, browser, close }: main.js, once they're up
let agentTools = null;
let pendingPlan = null; // a plan you're asked to say go to: { plan, at }
let pluginEngine = null; // your plugins (plugins.js): what sets them off is seen here
let pluginTimer = null;
let cancelled = false; // her Stop button: the task going on ends (the typing at once, a chain before its next step)
let canLook = () => false;
let snapshot = null; // () => Promise<base64 jpeg>
let sensesChild = null;
const state = {
  front: '', frontRaw: '', frontSince: Date.now(), ai: '', aiSince: 0,
  cpu: -1, cpuBusy: 0, battery: -1, track: null, lastTrackKey: '', lastComment: 0,
  song: '', words: null, wordsFor: '', // the song she follows, its lyrics ({ lines, plain, instrumental }, lyrics.js), and whether they were looked up
  verdict: { song: '', verdict: '' }, // what she thinks of the song playing (taste)
  wasAway: false, peakIdle: 0, activeSeconds: 0, lastTick: Date.now(),
  noticed: {}, noticeNext: Date.now() + 4 * 60000, dareNext: Date.now() + 20 * 60000, dareOpenUntil: 0,
  study: { phase: 'off', end: 0, left: 0, paused: false, done: 0 },
  quietUntil: 0, // her chat is open, she's busy: no notices meanwhile
};

const cfg = () => config.load();
const tasks = createTasks({ emit: (evt) => emit(evt) });
// what she says before a job that takes a while, so it never happens behind your back
const shortly = (s, n = 60) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
function taskFor(e) {
  if (e.kind === 'code') return { kind: 'code', title: shortly(e.task), line: e.here ? T("On it. I'll write the code first, then paste it in. Stop me any time.") : F("On it. I'm coding this now: {0}. I'll tell you when it's done.", shortly(e.task, 50)) };
  if (e.kind === 'myBrowser' && e.action !== 'close') return { kind: 'browser', title: shortly(e.url || e.query || ''), line: e.action === 'read' ? T('Reading it now.') : T('Opening my browser. Yours stays out of it.') };
  if (e.kind === 'draft') return { kind: 'draft', title: shortly(e.task), line: T('Writing it now. One moment.') };
  if (e.kind === 'type' && String(e.text || '').length > 60 && !e.code) return { kind: 'type', title: shortly(e.text, 40), line: F('Typing it now, {0} characters. Press any key to stop me.', String(e.text).length) };
  return null;
}
const mood = createMood({ load: () => cfg().moodState, save: (moodState) => config.save({ moodState }), off: () => cfg().moodEngine === false });
let moodShown = 0;
const showMood = () => {
  if (cfg().moodEngine === false) return;
  const { v, e, label } = mood.read();
  emit({ type: 'mood', label, v, e, sync: syncPercent() });
};
const say = (event) => emit({ type: 'say', ...event });

// ---- sync ------------------------------------------------------------------------------------------

const syncPercent = () => Math.min(100, Math.floor((cfg().sync.points || 0) / 10));
const syncTier = () => SYNC_TIERS.find(([upTo]) => syncPercent() < upTo)[1];

// Points come with daily limits: time with her (one per five active minutes, up to 24), what you tell
// her (two each, up to ten messages), pats (up to ten), agreeing with her (five), and finished dares.
function addSync(points, source) {
  if (['pat', 'chat', 'agree', 'dare'].includes(source)) mood.nudge(source);
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
    mood.nudge(awayMinutes >= 180 ? 'neglected' : 'back');
    state.wasAway = false;
    state.peakIdle = 0;
    pluginEngine?.onBack(awayMinutes);
  }
  mood.tick();
  if (now - moodShown >= 60000) {
    moodShown = now;
    showMood();
  }
  const cpu = cpuPercent();
  state.cpu = cpu;
  state.cpuBusy = cpu >= 90 ? state.cpuBusy + step / 1000 : 0;

  const c = cfg();
  // game, focus or quiet mode: not a word of her own until you call her
  if (held) return;
  // the first time you're at your PC in the morning: her brief of your day, once a day
  const today = new Date().toDateString();
  if (c.dailyBrief !== false && !state.briefing && c.briefDay !== today && idle < 30 && now - startedAt > 20000 && now > state.quietUntil) {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) {
      state.briefing = true;
      config.save({ briefDay: today });
      briefing().then((b) => emit({ type: 'brief', ...b }), () => {}).finally(() => { state.briefing = false; });
    }
  }
  // another AI in front of you: jealous, whatever else is going on (but not too often)
  if (c.jealous && state.ai && now - state.aiSince > 15000 && now > state.quietUntil) {
    if (remark('jealous', 20 * 60000, SAY.jealous, 'jealous', state.ai)) {
      mood.nudge('rival');
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
    if (name !== state.front) {
      Object.assign(state, { front: name, frontRaw: msg.app || '', frontSince: Date.now() });
      pluginEngine?.onApp(`${name} ${msg.app || ''}`);
    }
    // Claude Code is her job, not a rival, while she watches it
    const ai = msg.ai && !(cfg().claude && /claude/i.test(msg.ai)) ? msg.ai : '';
    if (ai !== state.ai) Object.assign(state, { ai, aiSince: Date.now() });
  } else if (msg.t === 'full') {
    state.fullscreen = Boolean(msg.on);
    emit({ type: 'fullscreen', on: state.fullscreen, why: msg.why || '' });
  } else if (msg.t === 'power') {
    state.battery = Number(msg.battery);
    pluginEngine?.onBattery(state.battery);
  } else if (msg.t === 'media') {
    onTrack(msg.title ? msg : null);
  }
}

function onTrack(track) {
  if (track) track.at = Date.now(); // when its position was read: she counts on from there
  state.track = track;
  const mode = cfg().music;
  emit({ type: 'nowPlaying', track: mode === 'off' ? null : track });
  if (mode !== 'off') followSong(track);
  const key = track?.playing ? `${track.title}|${track.artist}` : '';
  if (!key || key === state.lastTrackKey) return;
  state.lastTrackKey = key;
  pluginEngine?.onSong(track);
  const now = Date.now();
  // her favorite song gets a word from her every time
  const favorite = songNote(track)?.favorite;
  const comment = mode === 'comment' && (favorite || now - state.lastComment > 4 * 60000) && now > state.quietUntil;
  if (comment) state.lastComment = now;
  // what she thinks of it first (she dances to it, or dozes off), then her word on it, in the same mood
  (async () => {
    const verdict = cfg().musicMood !== false ? await taste(track) : '';
    if (verdict && state.lastTrackKey === key) {
      state.verdict = { song: songKey(track), verdict };
      emit({ type: 'taste', ...state.verdict });
      mood.nudge({ love: 'songLove', like: 'songLike', meh: 'songMeh' }[verdict]);
    }
    if (comment) commentOn(track, verdict);
  })();
}

// ---- following the song: its words, and whether she likes it ----

const songKey = (track) => (track?.title ? `${track.title}|${track.artist || ''}` : '');

// A new song: its lyrics (lyrics.js), sent to the overlay for her to show, line by line. Played before, they're
// on this PC already; else from LRCLIB, a moment in (Windows gives the new song's length a reading to settle).
let songTimer = null;
function followSong(track) {
  const key = songKey(track);
  if (key === state.song) return;
  state.song = key;
  state.words = null;
  state.wordsFor = '';
  clearTimeout(songTimer);
  if (!key || cfg().lyrics === false) return;
  const deliver = (words) => {
    if (state.song !== key) return;
    state.words = words;
    state.wordsFor = key; // looked up (found or not)
    emit({ type: 'lyrics', song: key, lines: words?.lines || null, instrumental: Boolean(words?.instrumental), found: Boolean(words) });
  };
  const kept = lyrics.cached(track);
  if (kept !== undefined) {
    deliver(kept);
    return;
  }
  // none (LRCLIB down, or not there yet): asked once more a little later, while the song still plays
  const fetchWords = (again) => {
    if (state.song !== key) return;
    lyrics.lyricsFor(state.track).then((words) => {
      deliver(words);
      if (!words && again) songTimer = setTimeout(() => fetchWords(false), 30000);
    });
  };
  songTimer = setTimeout(() => fetchWords(true), 2200);
}

// Lyrics turned on or off (settings, or you asked her): the song's words fetched again, or taken away.
function lyricsChanged() {
  state.song = '';
  state.words = null;
  state.wordsFor = '';
  if (cfg().lyrics === false) emit({ type: 'lyrics', song: '', lines: null, instrumental: false, found: false });
  else if (cfg().music !== 'off') followSong(state.track);
}

// The song she's following, for her window when it (re)loads: what's playing (where it is now), its lyrics, her verdict.
function songNow() {
  const track = cfg().music === 'off' || !state.track ? null : { ...state.track, pos: songPosition() };
  const song = songKey(track);
  return {
    track,
    lines: song && song === state.song ? state.words?.lines || null : null,
    verdict: song && state.verdict.song === song ? state.verdict.verdict : '',
  };
}

// Where the song is now (seconds), counted on from the last reading while it plays.
function songPosition() {
  const t = state.track;
  if (!t || !(t.pos >= 0)) return -1;
  return t.pos + (t.playing ? (Date.now() - (t.at || Date.now())) / 1000 : 0);
}

// The lines around the one being sung, for her model ('' when there are none).
function wordsNow() {
  const lines = state.words?.lines;
  if (!lines || songKey(state.track) !== state.song) return '';
  const at = lyrics.lineAt(lines, songPosition());
  if (at < 0) return '';
  return lines.slice(Math.max(0, at - 2), at + 2).map((l) => `${l === lines[at] ? '> ' : '  '}${l.text || '(music)'}`).join('\n');
}

// What she thinks of a song: 'love' (hers, songs from home), 'like' or 'meh', kept so she likes the same songs
// every time. She's into loud and fast (Night City), bored by slow and sleepy: her model is asked what the song
// sounds like (a plain fact it knows better than a taste), twice with the answers swapped round, and believed only
// when it says the same both times (a small model just picks the first answer). Otherwise, her whim.
const TASTE_MAX = 400;
async function sound(track) {
  if (!askPlain) return '';
  const song = `"${track.title}"${track.artist ? ` by ${track.artist}` : ''}`;
  const one = async (first, second) => {
    const ask = `What does the song ${song} sound like? Is it ${first} or ${second}? Answer with ONE word only: ${first.split(' ')[0]} or ${second.split(' ')[0]}.`;
    const answer = await Promise.race([askPlain([{ role: 'user', content: ask }]).catch(() => ''), new Promise((r) => setTimeout(() => r(''), 25000))]);
    return /\b(energetic|calm)\b/i.exec(String(answer).replace(/<think>[\s\S]*?<\/think>/g, ''))?.[1]?.toLowerCase() || '';
  };
  const LOUD = 'energetic (fast, loud, danceable, upbeat)';
  const SOFT = 'calm (slow, soft, sleepy, a ballad)';
  const a = await one(LOUD, SOFT);
  const b = a && (await one(SOFT, LOUD));
  return a && a === b ? a : '';
}

// asked once a song even when several want to know at once (a new song, "do you like it?", "listen to this")
const tasting = new Map(); // song -> Promise<verdict>
function taste(track) {
  if (songNote(track)) return Promise.resolve('love');
  const key = `${String(track.title).toLowerCase()}|${String(track.artist || '').toLowerCase()}`;
  const known = cfg().tastes?.[key];
  if (known) return Promise.resolve(known);
  if (!tasting.has(key)) tasting.set(key, judge(track, key).finally(() => tasting.delete(key)));
  return tasting.get(key);
}

async function judge(track, key) {
  // her whim, the same for a song every time: which energetic songs she loves, what she makes of an unknown one
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  // the real loudness and tempo when the catalogue has them (songdata.js), her model's guess only otherwise
  const facts = cfg().songData !== false ? await songdata.lookup(track) : null;
  const heard = facts?.energy || await sound(track);
  const verdict = heard === 'energetic' ? (h % 10 < 3 ? 'love' : 'like') : heard === 'calm' ? 'meh' : h % 10 < 7 ? 'like' : 'meh';
  const tastes = { ...(cfg().tastes || {}), [key]: verdict };
  const keys = Object.keys(tastes);
  for (const old of keys.slice(0, Math.max(0, keys.length - TASTE_MAX))) delete tastes[old];
  config.save({ tastes });
  return verdict;
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
const FEELS = { love: ' You LOVE it.', like: ' You like it.', meh: ' It bores you.' };
async function songOpinion(track, wait, verdict = '') {
  if (!askModel) return { text: '', emotion: 'happy' };
  const known = songNote(track)?.note || '';
  const ask = `[A song playing on their PC: "${track.title}"${track.artist ? ` by ${track.artist}` : ''}${track.app ? ` (in ${track.app})` : ''}.${known ? ` ${known}` : ''}${FEELS[verdict] || ''} React to it in ONE short sentence, in character: your opinion of it, a tease about their taste, or something you know about the song or the artist. Start with one emotion tag.]`;
  const answer = await Promise.race([askModel([{ role: 'user', content: ask }]).catch(() => ''), new Promise((r) => setTimeout(() => r(''), wait))]);
  const emotion = /\[(happy|jealous|bored|glitch|annoyed)\]/i.exec(answer)?.[1]?.toLowerCase() || 'happy';
  // without her tags ("[Happy, nostalgic]" from a small model too), and short: whole sentences, ~160 chars
  const sentences = String(answer || '').replace(/<think>[\s\S]*?<\/think>/g, '').replace(/\[[^\]\n]{0,40}\]\s*/g, '').replace(/[*_`#]+/g, '')
    .trim().replace(/^\[([^\]\n]+)\]$/, '$1') // a whole answer in brackets, like a stage direction
    .split('\n')[0].split(/(?<=[.!?])\s+/);
  let text = sentences[0].slice(0, 220);
  for (const s of sentences.slice(1)) {
    if (`${text} ${s}`.length > 160) break;
    text = `${text} ${s}`;
  }
  return { text: text.length < 4 ? '' : text, emotion };
}

async function commentOn(track, verdict = '') {
  const { text, emotion } = await songOpinion(track, 20000, verdict);
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
// A song: through your own Spotify developer app if you've connected one (no window comes up), else the way it always was.
async function playSong(query) {
  const api = brainParts.spotify;
  if (api?.connected()) {
    const res = await api.playSong(query).catch(() => ({ why: 'failed' }));
    if (res.ok) return { ok: true, reply: F('Playing {0}.', `${res.name} · ${res.artist}`) };
    if (res.why === 'notfound') return { ok: false, reply: F("I couldn't find {0} in Spotify's results.", query) };
    const old = await playSongInWindow(query);
    const note = { premium: T('(Spotify only lets Premium accounts start a song from here, so I opened it.)'), nodevice: T("(Spotify wasn't open anywhere, so I opened it.)") }[res.why];
    return note ? { ...old, reply: `${old.reply} ${note}` } : old;
  }
  return playSongInWindow(query);
}

function playSongInWindow(query) {
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

// What she does to the song playing through Windows' media session (launch.session), and her line when it's done.
const SESSION_ACTIONS = {
  next: 'Skipped!', previous: 'Back we go!', restart: 'From the top!', seek: '',
  'repeat-one': 'On repeat. This one again, and again.', 'repeat-all': 'Repeating the whole playlist.', 'repeat-off': 'Repeat off.',
  'shuffle-on': 'Shuffle on. Chaos, my favorite.', 'shuffle-off': 'Shuffle off. In order. How boring.',
};

// What each errand needs from you in settings › Access, and what she says when it's off.
const NEEDS = { weather: 'search', code: 'code', spotifySearch: 'spotify', song: 'spotify', browser: 'web', web: 'web', video: 'web', find: 'files', app: 'apps', media: 'media', volumeLevel: 'media', home: 'home', playlist: 'spotify', playlistList: 'spotify', type: 'type', key: 'type', click: 'click', myBrowser: 'browser', songPick: 'spotify' };
// buttons that can't be undone are never pressed from a sentence ("Send" is: you said so, and you can see it)
const RISKY_BUTTON = /\b(?:delete|remove|erase|wipe|uninstall|format|reset|shut ?down|restart|buy|pay|purchase|order|checkout|transfer|withdraw|confirm|hapus|buang|copot|bayar|beli|pesan sekarang|tarik|konfirmasi|setel ulang)\b/i;
const ACCESS_NAMES = { home: 'Smart home', browser: 'Her own browser', click: 'Press buttons', search: 'Look things up online', apps: 'Open apps', files: 'Folders and files', close: 'Close apps', web: 'Websites', media: 'Media keys', spotify: 'Spotify', code: 'Write code', type: 'Type for me' };
const allowed = (what) => config.allowed(what);
const denied = (what) => ({ handled: true, reply: F("I'm not allowed to do that. Settings › Access › {0}.", T(ACCESS_NAMES[what])), emotion: 'annoyed', denied: true });

// Her Stop button (the panel while she types for you): the typing ends at once, a chain before its next step.
function cancel() {
  tasks.cancel();
  cancelled = true;
  return launch.stopTyping();
}

// ---- plans: a goal of several steps (actions/planner.js) -----------------------------------------------------------------
const PLAN_YES = /^(?:ya|iya|yes|yep|gas|lanjut|jalankan|go|go ahead|run it|do it|oke|ok|okay|sip)[.!]*$/i;
const PLAN_NO = /^(?:no|nope|tidak|nggak|gak|ga|jangan|batal|batalkan|cancel|stop)[.!]*$/i;
const PLAN_TTL = 10 * 60000;

function tools() {
  agentTools ||= createTools({
    parse: errands.parse,
    act: (e) => act(e),
    ask: (messages, opts) => askPlain(messages, opts),
    lookup: (q) => web.lookup(q),
    recall: async (q) => {
      const { memory, knowledge } = brainParts;
      if (!memory) return '';
      const [notes, docs] = await Promise.all([memory.search(q, { spaces: ['fact', 'episode', 'working'], limit: 5 }), knowledge.search(q, 4)]);
      return [...notes.map((n) => n.text), ...docs.map((d) => `[${d.title}] ${d.text}`)].join('\n\n');
    },
    skill: async (id, input) => {
      const s = brainParts.skills?.find(id);
      if (!s) return '';
      return String(await askPlain([{ role: 'system', content: s.prompt }, { role: 'user', content: input }], { timeout: 90000 }).catch(() => '')).replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    },
    browser: brainParts.browser && allowed('browser') ? { open: (u) => brainParts.browser.goto(u), search: (q) => brainParts.browser.search(q), read: () => brainParts.browser.read(), click: (t) => brainParts.browser.click(t), fill: (f, t) => brainParts.browser.fill(f, t) } : null,
    close: brainParts.close || null,
  });
  return agentTools;
}

async function runPlan(plan) {
  const res = await tasks.run({ kind: 'chain', title: shortly(plan.goal), total: plan.steps.length, line: F('On it, {0} steps. {1} first.', plan.steps.length, shortly(plan.steps[0].why, 40)) }, async () => {
    const out = await planner.run(plan, { tasks, tools: tools(), sayNo: T('You said no, so I stopped there.') });
    return { ...out, handled: true, denied: !out.ok };
  });
  // what the last step wrote, when nothing was done with it: that's the answer
  const said = [...new Set(res.said.filter(Boolean))];
  if (res.ok) {
    const answer = res.last && !plan.steps.some((s) => s.tool === 'type_text') ? res.last : '';
    return { handled: true, reply: [said.join(' '), answer].filter(Boolean).join('\n\n') || T('All done. What next?'), emotion: 'happy', task: answer ? undefined : 'chain' };
  }
  if (res.stopped) return { handled: true, reply: F('Stopped, after {0} of {1} steps.', res.done, res.total), emotion: 'annoyed' };
  if (res.refused) return { handled: true, reply: said.join(' '), emotion: 'bored' };
  return { handled: true, reply: `${F('I got stuck on step {0} of {1}: {2}.', res.failedAt + 1, res.total, res.why)} ${said.at(-1) || ''}`.trim(), emotion: 'annoyed', denied: true };
}

// A goal her rules can't do in one go. Her model proposes the steps; if any of them reaches into your PC you see them first.
async function planFor(goal) {
  if (!askPlain) return null;
  const plan = await tasks.run({ kind: 'plan', title: shortly(goal), line: T('Let me work out the steps.') }, async () => {
    tasks.step(T('Working out the steps…'));
    const p = await orStopped(planner.plan(goal, { tools: tools(), ask: (m, o) => askPlain(m, o) }), tasks.signal, null);
    return { ok: Boolean(p), handled: true, plan: p };
  });
  if (!plan.plan?.steps?.length) return null; // not something her tools can do: a chat, then
  if (plan.plan.risk === 0) return runPlan(plan.plan);
  pendingPlan = { plan: plan.plan, at: Date.now() };
  return { handled: true, reply: F("Here's what I'd do:\n{0}\n\nSay go, or cancel.", planner.outline(plan.plan)), emotion: 'happy', plan: { steps: plan.plan.steps.length } };
}

// Her Run and Cancel buttons (or "gas", "batal").
async function answerPlan(yes) {
  const waiting = pendingPlan;
  pendingPlan = null;
  if (!waiting || Date.now() - waiting.at > PLAN_TTL) return { handled: true, reply: T("That plan's gone cold. Ask me again?"), emotion: 'bored' };
  if (!yes) return { handled: true, reply: T('Okay, forget it.'), emotion: 'bored' };
  return runPlan(waiting.plan);
}

async function run(said, { voice = false, fromPlugin = false } = {}) {
  const c = cfg();
  if (pendingPlan && !fromPlugin) {
    const t = errands.plain(said);
    if (PLAN_YES.test(t)) return answerPlan(true);
    if (PLAN_NO.test(t)) return answerPlan(false);
  }
  // her games first: in the middle of one, "batu" or "50" is a move
  const played = games.handle(said, c);
  if (played) {
    if (played.sync) addSync(played.sync, 'agree');
    if (played.stats) recordGame(played.stats);
    return { handled: true, reply: played.reply, emotion: played.emotion, game: true };
  }
  const canonical = errands.canon(said);
  if (canonical) return { handled: true, reply: T(canonical.line), emotion: canonical.emotion };
  // a plugin of yours set off by what you said (Settings › Plugins)
  if (!fromPlugin) {
    const plugged = await pluginEngine?.said(said);
    if (plugged) return plugged.reply ? plugged : { ...plugged, reply: F('{0}: on it.', plugged.plugin) };
  }
  // a command of yours ("work mode"): what you taught her, done like you'd said it all
  const own = skillFor(said);
  if (own) {
    const steps = stepsOf(own.run);
    if (steps) {
      const done = await runChain(steps, { voice, routed: '' });
      return { ...done, reply: `${F('{0}!', own.name)} ${done.reply || ''}`.trim(), skill: own.name };
    }
  }
  // "forget work mode": one of yours forgotten (anything else to forget is her memory's)
  const forgetting = errands.UNTEACH_ASK.exec(errands.plain(said));
  const forgotten = forgetting && skillFor(forgetting[1]);
  if (forgotten) {
    emit({ type: 'setConfig', patch: { skills: (cfg().skills || []).filter((s) => s !== forgotten) } });
    return { handled: true, reply: F('Forgot "{0}".', forgotten.name), emotion: 'happy' };
  }
  // several commands at once ("open notepad and type hello", "buka spotify lalu putar musik"): one after the other
  const steps = errands.chain(said);
  // one step needs what another comes up with: a plan, or nothing (never the words "the summary", typed as they are)
  if (steps && !fromPlugin && router.usesEarlierResult(steps)) return (await planFor(errands.plain(said))) || { handled: false };
  const one = steps ? null : errands.parse(said);
  // a draft on screen and "make it shorter", "lebih resmi" (and not a command of hers: "change the song" is one)
  if (one?.kind === 'none' && lastDraft && Date.now() - lastDraft.at < 15 * 60000 && errands.plain(said).length < 160 && REVISE.test(errands.plain(said))) {
    return revise(errands.plain(said));
  }
  // in words her rules don't know ("could you crank it up", "puterin yang santai dong"), or read as something she
  // couldn't do ("show me what they are singing" isn't a file to find): her model says which command it is, and
  // she says how she took it
  const guessed = async (unlike = null) => {
    const guess = await route(said);
    const kinds = guess && (guess.steps ? guess.steps.map((s) => s.e.kind) : [guess.e.kind]);
    if (!guess || (unlike && kinds.length === 1 && kinds[0] === unlike)) return null;
    const done = guess.steps ? await runChain(guess.steps, { voice, routed: guess.line }) : await act(guess.e, { voice, routed: guess.line });
    return done?.handled ? { ...done, routed: guess.line, reply: `${F('(Taking that as "{0}".)', guess.line)} ${done.reply || ''}`.trim() } : null;
  };
  // a goal of several steps her rules can't do in one go (a plugin never plans: it does what you wrote)
  if (one?.kind === 'none' && !fromPlugin && router.wantsPlan(errands.plain(said))) {
    const planned = await planFor(errands.plain(said));
    if (planned) return planned;
  }
  // what one of her skills is for ("perbaiki tulisan ini: …") goes to her chat with that skill, never read as a command
  if (one?.kind === 'none' && !fromPlugin && brainParts.skills?.match(errands.plain(said))) return { handled: false };
  let res = one?.kind === 'none' ? await guessed() : null;
  if (!res) res = steps ? await runChain(steps, { voice }) : await act(one, { voice });
  if (!res?.handled && one && one.kind !== 'none') res = (await guessed(one.kind)) || res;
  // a task done (typing for you, several commands): she says so, and asks what's next
  if (res?.handled && res.task && !res.denied && res.emotion !== 'annoyed') res.reply = `${res.reply} ${T(pick(TASK_DONE[res.task]))}`;
  return res;
}

// What you meant, when her rules didn't catch a command (errands.routable: it sounds like one): her model, asked
// in one short call, answers with one of her own commands, which her rules then read (errands.routed), so it can
// only ever be something she does anyway, and nothing she does only behind a button. A few seconds at most.
const ROUTE_PROMPT = `You turn what someone said to their desktop assistant into ONE of her commands, or NONE.
Her commands (write one exactly like these, with their words filled in):
turn on the <room> light | turn off the <room> light | set the <room> light to <number> percent | turn on the ac | turn off the ac | set the ac to <number> degrees | set the ac to <cool, heat, dry, fan or auto> mode | play my <name> playlist | open <app, website or folder> | play <song> by <artist> | play music | pause the music | next song | previous song | louder | quieter | mute | repeat this song | shuffle on | show lyrics | hide lyrics | what song is this | search <words> | search <words> on spotify | type <their exact words> in <app> | write <the code they want, like "a simple HTML page"> here | press enter | set a timer for <n> minutes | wake me at <time> | what time is it | move to the left | move to the right | come to my cursor | dance
Two commands: join them with " and ". Keep names, song titles and the text to type exactly as they said them (don't translate them).
If it's chat, a question, a feeling or anything that isn't one of these: NONE.`;
async function route(said) {
  if (!askPlain || cfg().intentRouter === false || !errands.routable(said)) return null;
  const ask = [{ role: 'system', content: ROUTE_PROMPT }, { role: 'user', content: `They said: """${said}"""\nReply with the command line only.` }];
  const answer = await Promise.race([askPlain(ask).catch(() => ''), new Promise((done) => setTimeout(() => done(''), 7000))]);
  const guess = errands.routed(String(answer || '').replace(/<think>[\s\S]*?<\/think>/g, ''), said);
  if (guess) console.log(`[capri] took "${said.slice(0, 60)}" as "${guess.line}"`);
  return guess;
}

// ---- something to write for you (errands 'draft'): her model drafts it, you see it, she types it on your word ----
const DRAFT_PROMPT = `You write what the user asks for, ready to paste: the text itself and nothing else. No preamble ("Here's…", "Sure"), no notes after it, no markdown (no **, no #, no bullet symbols unless the text needs a list). Use the name and date given below; a detail you can't know (someone else's name, a place) goes in [brackets] for them to fill in, and only when the text needs it. In the language of the request (an Indonesian request gets Indonesian). An email starts with its greeting (no "Subject:" line unless they asked for one). As long as that kind of text usually is, at most about 180 words unless they asked for a long one.`;
let lastDraft = null; // { text, target, task, at }: the one on screen, for "make it shorter" and her Type it button
const REVISE = /^(?:make it|make that|bikin|buat(?:lah)?|jadikan|jadiin)\s+(?:it\s+|that\s+|lebih\s+|jadi\s+)?(?:shorter|longer|more|less|formal|casual|funnier|nicer|simpler|polite|lebih|singkat|pendek|panjang|resmi|santai|lucu|sopan|sederhana)\b|^(?:shorter|longer|more formal|more casual|lebih (?:singkat|pendek|panjang|resmi|santai|lucu|sopan|sederhana)|tambah(?:kan)?|add|remove|hapus|ganti|change|without|tanpa|in english|dalam bahasa (?:inggris|indonesia)|translate|terjemahkan)\b/i;

const cleanDraft = (s) => String(s || '').replace(/<think>[\s\S]*?<\/think>/g, '')
  .replace(/^\s*(?:sure|okay|ok|here(?:'s| is)|berikut(?: ini)?|tentu)[^\n]*:\s*\n+/i, '')
  .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/^#+\s*/gm, '')
  .replace(/\n{3,}/g, '\n\n').trim();

async function draftFor(messages) {
  if (!askPlain) return '';
  const answer = await Promise.race([askPlain(messages, { timeout: 60000 }).catch(() => ''), new Promise((done) => setTimeout(() => done(''), 60000))]);
  return cleanDraft(answer).slice(0, 4000);
}

// who's writing and when: the name and date a letter needs, so the model doesn't leave [Your Name] in it
// (only a letter, an email, an invitation gets the name and the date: a poem with a date on it is a letter)
const SIGNED = /\b(?:e-?mail|letter|cover letter|invitation|announcement|apology|surat|undangan|pengumuman|permintaan maaf|izin)\b/i;
// the request's own language, said plainly (a model drifts into the language of whatever else it's told)
const INDONESIAN = /\b(?:tuliskan|tulisin|tulis|buatkan|buatin|bikinin|bikin|buat|karang\w*|susun\w*|surat|pesan|puisi|pantun|cerita|ucapan|untuk|tentang|yang|dan|aku|saya|ibu|ayah|kakak|adik|teman|pacar|guru|bos|sakit|izin|ulang tahun|selamat)\b/i;
const addressed = (task) => SIGNED.test(task) || /\b(?:message|text|reply|response|note|toast|pesan|balasan|ucapan|kata sambutan)\b|\b(?:to|for|untuk|buat|kepada) (?:my|the|a|ibu|ayah|kakak|adik|teman|pacar|bos|guru)\b/i.test(task);
// a poem or a story isn't for anyone unless you said so: the "Dear …," a model puts on top of it anyway, gone
// (and the "Rina, 2024" over a poem, the "— Rina" under it: a byline nobody asked for)
const unaddressed = (text, task) => (addressed(task) ? text : text
  .replace(/^\s*(?:dear|to|for|untuk|kepada|teruntuk)\s+[^\n,]{1,40},?\s*\n+/i, '')
  .replace(/^\s*[\p{L} .'-]{1,30},?\s+(?:\d{1,2}\s+\p{L}+\s+)?\d{4}\s*\n+/u, '')
  .replace(/\n+\s*[-–—]\s*[\p{L} .'-]{1,30}\s*$/u, ''));
function draftSystem(task = '') {
  const c = cfg();
  const you = String(c.owner?.nickname || c.userName || '').trim();
  const parts = [DRAFT_PROMPT];
  if (SIGNED.test(task)) {
    const date = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    parts.push(`It is signed: sign it ${you ? `as ${you}` : 'without a name'}. If it needs a date, today is ${date} (written the way the text's language writes dates).`);
  }
  // a text with someone it's for (a letter, a message, a reply): written as them, to that someone
  if (addressed(task)) {
    parts.push('You write it as them, to whoever it is for: never to them, never about this request.');
  } else {
    parts.push('It is not addressed to anyone unless the request says so: no "To …" or "Dear …" line, no signature.');
  }
  parts.push(INDONESIAN.test(task) ? 'Write it in Indonesian.' : 'Write it in English, unless the request itself is in another language.');
  return parts.join('\n');
}
// "Subject: …" when you didn't ask for one: typed into an email's body, it would be in the mail
const unasked = (text, task) => (/\b(?:subject|subjek|perihal)\b/i.test(task) ? text : text.replace(/^\s*(?:subject|subjek|perihal)\s*:[^\n]*\n+/i, ''));

// what a model leaves blank that she knows: your name ("[Your Name]", "[Nama Anda]"); a whole sentence in
// brackets is the text, not a blank
function filled(text) {
  const c = cfg();
  const you = String(c.owner?.nickname || c.userName || '').trim();
  let t = text.replace(/\[([^\]\n]{25,}[.!?])\]/g, '$1');
  if (you) t = t.replace(/\[(?:your (?:full )?name|name|sender'?s? name|nama(?: lengkap)?(?: anda| kamu|mu)?|nama pengirim)\]/gi, you);
  return t;
}

async function draft(task, target) {
  const text = filled(unaddressed(unasked(await draftFor([{ role: 'system', content: draftSystem(task) }, { role: 'user', content: task }]), task), task));
  if (!text) return { handled: true, reply: T("My brain didn't answer. Try again in a moment?"), emotion: 'annoyed' };
  lastDraft = { text, target, task, at: Date.now() };
  return { handled: true, reply: target ? F('Here it is. Say the word and I type it in {0}.', target) : T('Here it is. Want me to type it where you were?'), draft: { text, target }, emotion: 'happy' };
}

async function revise(how) {
  const d = lastDraft;
  const text = filled(await draftFor([
    { role: 'system', content: draftSystem(d.task) },
    { role: 'user', content: d.task },
    { role: 'assistant', content: d.text },
    { role: 'user', content: `Rewrite it: ${how}. The whole text again, nothing else.` },
  ]));
  if (!text) return { handled: true, reply: T("My brain didn't answer. Try again in a moment?"), emotion: 'annoyed' };
  lastDraft = { ...d, text, at: Date.now() };
  return { handled: true, reply: T('Changed. Better?'), draft: { text, target: d.target }, emotion: 'happy' };
}

// Her Type it button under a draft: typed where you asked, or where you were.
async function typeDraft({ text, target } = {}) {
  const words = String(text || lastDraft?.text || '').slice(0, 4000);
  if (!words) return { handled: false };
  const res = await act({ kind: 'type', text: words, target: target || '' }, { voice: false });
  if (res?.handled && !res.denied) lastDraft = null;
  return res;
}

// ---- commands of yours (config.skills, settings › Behavior): a name, and what to do in your own words ----
const MAX_SKILLS = 30;
function skillFor(said) {
  const name = errands.skillName(said);
  return name ? (cfg().skills || []).find((s) => errands.skillName(s.name) === name) || null : null;
}
// what one does, as her commands: several, or one (never teaching another)
function stepsOf(run) {
  const steps = errands.chain(run);
  if (steps) return steps.some((s) => s.e.kind === 'teach') ? null : steps;
  const e = errands.parse(run);
  return e.kind === 'none' || e.kind === 'teach' ? null : [{ said: run, e }];
}
function teach(name, run) {
  if (!stepsOf(run)) return { handled: true, reply: F("I don't know how to \"{0}\" yet, so I can't learn it. Say it the way you'd ask me.", run), emotion: 'annoyed' };
  const key = errands.skillName(name);
  if (!key || errands.parse(name).kind !== 'none') return { handled: true, reply: F('"{0}" is already a command of mine. Pick another name.', name), emotion: 'annoyed' };
  const others = (cfg().skills || []).filter((s) => errands.skillName(s.name) !== key);
  if (others.length >= MAX_SKILLS) return { handled: true, reply: T('I can keep 30 of those. Forget one first (Settings › Behavior).'), emotion: 'annoyed' };
  emit({ type: 'setConfig', patch: { skills: [...others, { name: name.slice(0, 40), run: run.slice(0, 300) }] } });
  return { handled: true, reply: F('Got it. When you say "{0}", I {1}.', name, run), emotion: 'happy', zap: true };
}

// ---- the weather (weather.js, Open-Meteo) and her brief of your day ----
function weatherLine(w, when = 'today') {
  const where = w.place.name;
  const [day0, day1] = w.days;
  const umbrella = (d) => ((d?.rain ?? 0) >= 50 || weather.wet(d?.code) ? ` ${T('Bring an umbrella.')}` : '');
  if (when === 'tomorrow' && day1) {
    return F('{0} tomorrow: {1}, {2}–{3}°C, {4}% chance of rain.', where, T(weather.describe(day1.code)), day1.min, day1.max, day1.rain ?? 0) + umbrella(day1);
  }
  const line = F('{0}: {1}°C, {2} (feels like {3}°).', where, w.now.temp, T(weather.describe(w.now.code)), w.now.feels);
  return day0 ? `${line} ${F('Today {0}–{1}°, {2}% chance of rain.', day0.min, day0.max, day0.rain ?? 0)}${umbrella(day0)}` : line;
}

const BRIEF_END = ["Go get 'em.", "That's the day. Don't make me nag you.", "I'll be right here. Obviously.", 'Make it a good one. Or at least an interesting one.'];
// { title, text }: hello, the date, the weather where you are, today's alarms, what's playing, a word of hers
async function briefing() {
  const c = cfg();
  const now = new Date();
  const hour = now.getHours();
  const you = String(c.owner?.nickname || c.userName || '').trim();
  const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const title = you ? F(`${part}, {0}!`, you) : T(`${part}!`);
  const locale = lang.code === 'id' ? 'id-ID' : 'en-GB';
  const lines = [F("It's {0}.", now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' }))];
  if (c.weatherCity && allowed('search')) {
    const w = await weather.forecast(c.weatherCity).catch(() => null);
    if (w) lines.push(weatherLine(w, 'today'));
  }
  const alarms = (c.alarms || []).filter((a) => a.due > Date.now() && new Date(a.due).toDateString() === now.toDateString()).sort((a, b) => a.due - b.due);
  if (alarms.length) {
    const at = (ms) => new Date(ms).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    lines.push(F('Alarms today: {0}.', alarms.map((a) => `${at(a.due)}${a.label ? ` ${a.label}` : ''}`).join(', ')));
  }
  if (state.track?.playing) lines.push(F('Playing: {0}.', brief(state.track)));
  lines.push(T(pick(BRIEF_END)));
  return { title, text: lines.join('\n') };
}

// her settings' "Brief me now"
function briefNow() {
  return briefing().then((b) => { emit({ type: 'brief', ...b }); return true; }, () => false);
}

// ---- code written right where you are (errands 'code' with here): her model writes it, she pastes it in ----
const CODE_LANGS = { html: 'HTML', htm: 'HTML', css: 'CSS', scss: 'SCSS', js: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript', jsx: 'JavaScript (React)', ts: 'TypeScript', tsx: 'TypeScript (React)', vue: 'Vue', svelte: 'Svelte', py: 'Python', java: 'Java', kt: 'Kotlin', c: 'C', h: 'C', cpp: 'C++', cc: 'C++', cs: 'C#', php: 'PHP', go: 'Go', rs: 'Rust', rb: 'Ruby', swift: 'Swift', dart: 'Dart', lua: 'Lua', sql: 'SQL', sh: 'Bash', ps1: 'PowerShell', bat: 'Batch', json: 'JSON', yaml: 'YAML', yml: 'YAML', md: 'Markdown', xml: 'XML' };
const NAMED_LANG = /\b(HTML|CSS|SCSS|JavaScript|TypeScript|React|Vue|Svelte|Python|Java|Kotlin|C\+\+|C#|PHP|Go|Golang|Rust|Ruby|Swift|Dart|Lua|SQL|Bash|PowerShell|JSON|YAML|Markdown)\b/i;
const CODE_PROMPT = `You write code that is pasted straight into the file the user has open in their code editor. Reply with ONLY the code: complete, working, ready to paste. No explanation before or after it, no markdown code fences, nothing that isn't code. Short comments only where they help. Indent with 2 spaces (4 for Python). A web page is one HTML file, its CSS in a <style> and its script in a <script>.`;

// the code in a model's answer: what's inside its fences, if it put any, without what it said around them
function codeOf(answer) {
  const text = String(answer || '').replace(/<think>[\s\S]*?<\/think>/g, '');
  const fenced = /```[\w+#.-]*[ \t]*\r?\n([\s\S]*?)```/.exec(text);
  return (fenced ? fenced[1] : text.replace(/^```[\w+#.-]*\s*|```\s*$/g, '')).replace(/\s+$/, '').replace(/^\n+/, '');
}

async function codeHere(e, opts = {}) {
  if (!allowed('type')) return denied('type');
  if (!askPlain) return { handled: true, reply: T('I need a brain for that: set one up in my settings, AI brain.'), emotion: 'annoyed' };
  // the file open in front ("hello.html - Antigravity"): its language, when you didn't name one
  const hwnd = e.target ? 0 : frontWindow?.() || 0;
  const title = hwnd ? await launch.windowTitle(hwnd).catch(() => '') : '';
  const file = /([\w.-]+\.([a-z][a-z0-9]{0,5}))(?![\w.])/i.exec(title); // ("hello.html●": the dot of an unsaved file after it)
  const named = NAMED_LANG.exec(e.task)?.[1];
  const langName = named ? named.replace(/^golang$/i, 'Go').replace(/^react$/i, 'JavaScript (React)') : CODE_LANGS[file?.[2]?.toLowerCase()] || '';
  tasks.step(langName ? F('Writing the {0}…', langName) : T('Writing the code…'));
  const ask = [
    { role: 'system', content: `${CODE_PROMPT}${langName ? `\nLanguage: ${langName}.` : ''}${file ? `\nThe file open: ${file[1]}.` : ''}` },
    { role: 'user', content: e.task },
  ];
  const answer = await orStopped(Promise.race([askPlain(ask, { timeout: 90000 }).catch(() => ''), new Promise((done) => setTimeout(() => done(''), 90000))]), tasks.signal, '');
  if (tasks.stopped) return { handled: true, reply: T('Stopped.'), emotion: 'annoyed', denied: true };
  const code = codeOf(answer).slice(0, 20000);
  if (!code.trim()) return { handled: true, reply: T("My brain didn't answer. Try again in a moment?"), emotion: 'annoyed' };
  tasks.step(F('Pasting {0} lines in…', code.split('\n').length));
  return actNow({ kind: 'type', text: code, target: e.target || '', paste: true, code: langName || T('code') }, opts);
}

// her word when a task of yours is done, and what she asks next
const TASK_DONE = {
  write: ['Task done! What else should I write?', "Done. Anything else to type? I'm on a roll.", "All typed. What's next, boss?"],
  chain: ['All done. What next?', 'Done and done. Anything else?', 'Easy. Give me another one.'],
};

// The steps of a chain, in order: what one opened is where the next one types ("open notepad and type hello"); a
// step that can't be done ends it there. Her lines for them, one after the other (the same one only once).
function runChain(steps, opts = {}) {
  const n = steps.length;
  return tasks.run({ kind: 'chain', title: shortly(steps.map((s) => s.said).join(', ')), total: n, line: F('On it, {0} steps. {1} first.', n, shortly(steps[0].said, 40)) }, () => chainSteps(steps, opts));
}

async function chainSteps(steps, opts = {}) {
  const lines = [];
  const out = { handled: true, emotion: 'happy' };
  let opened = '';
  cancelled = false;
  let fresh = false; // something just opened: the first typing into it waits for its window
  for (const [i, step] of steps.entries()) {
    tasks.step(step.said, i + 1);
    if (cancelled) {
      lines.push(T('Stopped.'));
      out.emotion = 'annoyed';
      break;
    }
    const typing = step.e.kind === 'type' || step.e.kind === 'key' || step.e.kind === 'click';
    const e = typing ? { ...step.e, target: step.e.target || opened, fresh: fresh && !step.e.target }
      : step.e.kind === 'draft' ? { ...step.e, target: step.e.target || opened } : step.e;
    if (typing) fresh = false;
    const res = await act(e, opts).catch(() => null);
    if (!res?.handled) {
      lines.push(F("I couldn't do \"{0}\".", step.said));
      out.emotion = 'annoyed';
      break;
    }
    if (res.reply && !lines.includes(res.reply)) lines.push(res.reply);
    // a draft waits for your word: what came after it in the sentence goes with it
    if (res.draft) {
      out.draft = res.draft;
      break;
    }
    out.task = res.task === 'write' || out.task === 'write' ? 'write' : 'chain';
    if (res.opened) {
      opened = res.opened;
      fresh = true;
    }
    if (res.emotion && res.emotion !== 'happy') out.emotion = res.emotion;
    for (const k of ['move', 'point', 'zap']) if (res[k]) out[k] = res[k];
    if (res.reply === T("Hm, that won't open!") || res.denied) break;
    // a moment between them: what one opened comes up, music starts
    if (i < steps.length - 1 && !opened) await new Promise((done) => setTimeout(done, 300));
  }
  return { ...out, reply: lines.join(' ') };
}

// One command of hers (errands.parse), done.
// What you dictated to be typed, with the speech recognizer's slips fixed by her model ("is free on get hub" ->
// "It's free on GitHub"): misheard words, spelling, capitals, punctuation, and nothing else, in the same language.
// A few seconds at most; anything that isn't plainly that text, fixed (an answer, a much longer or shorter one),
// and she types what you said as it was.
async function fixDictation(text) {
  if (!askPlain || text.length > 600) return text;
  const ask = `Speech-to-text wrote this, which the user dictated to be typed into an app:
"""${text}"""
Words they use, spelled right: ${vocabulary(cfg()).join(', ')}.
Fix only what speech recognition got wrong: misheard words (product names too, like GitHub or YouTube), spelling, capital letters, punctuation. Keep their words, their meaning and their language; add nothing, answer nothing, translate nothing. Reply with the fixed text only, nothing else.`;
  const answer = await Promise.race([askPlain([{ role: 'user', content: ask }]).catch(() => ''), new Promise((done) => setTimeout(() => done(''), 9000))]);
  const fixed = String(answer || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim().replace(/^"""|"""$/g, '').replace(/^["“](.*)["”]$/s, '$1').trim();
  const sane = fixed && fixed.length <= text.length * 1.6 + 12 && fixed.length >= text.length * 0.5 && !/\n\s*\n/.test(fixed)
    && !/^(?:sure|here|okay|ok|the fixed|fixed text|corrected)\b/i.test(fixed);
  return sane ? fixed : text;
}

// opts.voice: you said it (her ears), so what she types gets its speech-to-text slips fixed first
// One errand done, and kept in her action log (settings › Access › What she did) when it touched your PC.
async function act(e, opts = {}) {
  const spec = taskFor(e);
  const res = spec ? await tasks.run(spec, () => actNow(e, opts)) : await actNow(e, opts);
  if (res?.handled && !['move', 'time', 'math', 'sync', 'none'].includes(e.kind)) mood.nudge(res.denied ? 'failed' : 'done');
  actionsLog.record(e, res, { via: opts.voice ? 'voice' : 'typed', routed: opts.routed });
  return res;
}

async function actNow(e, opts = {}) {
  const c = cfg();
  const need = e.kind === 'open' ? (/^https?:/i.test(e.target) ? 'web' : /^[a-z]+\.exe$|^ms-settings/i.test(e.target) ? 'apps' : 'files') : NEEDS[e.kind];
  if (need && !allowed(need)) return denied(need);
  switch (e.kind) {
    case 'move': {
      const lines = {
        left: 'Fine, over here then.', right: 'Fine, over here then.', center: 'Center stage. Obviously.', cursor: 'Coming!',
        ride: 'Hop! Riding your cursor.', unride: 'Off your cursor. Finally, solid ground.', home: 'Back to my corner.',
        taskbar: 'Sitting on your taskbar. Comfy.', top: 'Up here!', hide: 'Bye-bye. Ctrl+Alt+C to call me back.', show: "I'm back!",
        sleep: 'Night night…', wake: "I'm up! I wasn't sleeping.", dance: 'Watch this!', stay: "Fine. I'll stay put.",
        wander: 'Exploring!', walk: 'Taking a little walk.', wave: 'Hiii!', bow: 'Thank you, thank you.', here: 'Right here!',
      };
      // a gesture is its own move: no emotion's hop on top of it
      const gesture = ['dance', 'wave', 'bow'].includes(e.move);
      return { handled: true, reply: T(lines[e.move] || 'Going!'), emotion: e.move === 'sleep' ? 'bored' : gesture ? null : 'happy', move: e.move };
    }
    case 'code': { // code you asked for: Claude Code in a terminal, or her own, in a file
      if (e.here) return codeHere(e, opts);
      if (!coder) return { handled: false };
      const who = e.via || c.coder || 'auto';
      if (who !== 'self') {
        tasks.step(T('Handing it to Claude Code…'));
        const handed = coder.claude(e.task);
        if (handed) return { handled: true, reply: T("Claude Code's on it, in a terminal. Say yes to its edits there, I'll keep an eye on it."), emotion: 'happy', zap: true };
      }
      const missing = who === 'claude' ? T("Claude Code isn't installed here, so I wrote it myself.") + ' ' : '';
      try {
        const made = await coder.self(e.task, { signal: tasks.signal, onStep: (label) => tasks.step(T(label)) });
        return { handled: true, reply: missing + F('Done: {0}, {1} lines, open in {2}. It\'s in your Capri Code folder.', made.name, made.lines, made.editor), emotion: 'happy', zap: true };
      } catch (err) {
        if (tasks.stopped) return { handled: true, reply: T('Stopped.'), emotion: 'annoyed', denied: true };
        if (err.code === 'nomodel') return { handled: true, reply: T('I need a brain for that: set one up in my settings, AI brain.'), emotion: 'annoyed' };
        return { handled: true, reply: T('My code came out garbled. Ask me again?'), emotion: 'glitch' };
      }
    }
    case 'time': { // the time or the date, exactly: her model only guesses them ('clock' is an alarm, below)
      const now = new Date();
      const locale = lang.code === 'id' || c.replyLanguage === 'id' || c.replyLanguage === 'mix' ? 'id-ID' : 'en-US';
      const time = now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
      const date = now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      return { handled: true, reply: e.what === 'date' ? F('Today is {0}.', date) : F("It's {0}. {1}.", time, date), emotion: 'happy' };
    }
    case 'math': // a sum, worked out (not guessed by her model)
      return { handled: true, reply: F('{0} = {1}. Easy.', e.expr, Number(e.value).toLocaleString('en-US', { maximumFractionDigits: 8 })), emotion: 'happy' };
    case 'nowPlaying': {
      if (c.music === 'off') return { handled: true, reply: T("I'm not watching what you play. Turn it on in Settings, Behavior."), emotion: 'bored' };
      const t = state.track;
      if (!t?.title) return { handled: true, reply: T("Nothing's playing right now. Or it's hiding from me."), emotion: 'bored' };
      const where = t.app ? F(' (in {0})', t.app) : '';
      const line = `${t.playing ? F("You're listening to {0}", brief(t)) : F('Paused: {0}', brief(t))}${where}.`;
      // and what she thinks of it (the same as her verdict on it)
      const verdict = t.playing && c.musicMood !== false ? await taste(t) : '';
      const { text, emotion } = t.playing ? await songOpinion(t, 12000, verdict) : { text: '', emotion: 'happy' };
      return { handled: true, reply: text ? `${line} ${text}` : line, emotion };
    }
    case 'songOpinion': { // "do you like this song?": the song playing, never her own favorite
      if (c.music === 'off') return { handled: true, reply: T("I'm not watching what you play. Turn it on in Settings, Behavior."), emotion: 'bored' };
      const t = state.track;
      if (!t?.title) return { handled: true, reply: T("Nothing's playing right now. Or it's hiding from me."), emotion: 'bored' };
      const verdict = await taste(t);
      if (state.verdict.song !== songKey(t) || state.verdict.verdict !== verdict) {
        state.verdict = { song: songKey(t), verdict };
        emit({ type: 'taste', ...state.verdict });
      }
      const { text, emotion } = await songOpinion(t, 15000, verdict);
      const plainly = { love: 'This one? I love it.', like: "Yeah, I like it. You've got taste. Sometimes.", meh: 'Honestly? It bores me.' };
      return { handled: true, reply: `"${t.title}"? ${text || T(plainly[verdict] || plainly.like)}`, emotion: verdict === 'meh' ? 'bored' : verdict === 'love' ? 'happy' : emotion };
    }
    case 'lyrics': {
      const t = state.track;
      if (e.action !== 'now') {
        const on = e.action === 'show';
        if (on && c.music === 'off') return { handled: true, reply: T("I'm not watching what you play. Turn it on in Settings, Behavior."), emotion: 'bored' };
        emit({ type: 'setConfig', patch: { lyrics: on } }); // main.js: saved, and her window and settings told
        if (!on) return { handled: true, reply: T('Lyrics off. I still know the words.'), emotion: 'happy' };
        // this song already looked up: what there is to show
        const key = songKey(t);
        if (t?.playing && key && state.wordsFor === key && state.song === key) {
          if (!state.words) return { handled: true, reply: T("Lyrics on, but I can't find the words to this one. LRCLIB doesn't have it (yet)."), emotion: 'bored' };
          if (state.words.instrumental) return { handled: true, reply: T('Lyrics on. No words in this one, though. Just vibes.'), emotion: 'happy' };
          if (!state.words.lines) return { handled: true, reply: T("Lyrics on, but this one only has words without timing, so I can't follow it line by line."), emotion: 'bored' };
        }
        return { handled: true, reply: T(t?.playing ? "Lyrics on. I'll follow along, line by line." : "Lyrics on. Play something and I'll follow along."), emotion: 'happy' };
      }
      if (c.music === 'off' || !t?.title) return { handled: true, reply: T("Nothing's playing right now. Or it's hiding from me."), emotion: 'bored' };
      if (songKey(t) !== state.song || !state.words) return { handled: true, reply: T("I can't find the words to this one."), emotion: 'bored' };
      if (state.words.instrumental) return { handled: true, reply: T('No words in this one. Just vibes.'), emotion: 'happy' };
      const lines = state.words.lines;
      if (!lines) return { handled: true, reply: T("I know the words, but not when they're sung."), emotion: 'bored' };
      const at = lyrics.lineAt(lines, songPosition());
      const line = at >= 0 ? lines.slice(0, at + 1).reverse().find((l) => l.text)?.text : '';
      if (!line) return { handled: true, reply: T("Nobody's singing yet. Wait for it."), emotion: 'happy' };
      return { handled: true, reply: `♪ "${line}"`, emotion: 'happy' };
    }
    case 'listen': { // "dengarkan lagu ini": she listens along, says what she makes of it, and follows its words
      const t = state.track;
      if (c.music === 'off') return { handled: true, reply: T("I'm not watching what you play. Turn it on in Settings, Behavior."), emotion: 'bored' };
      if (!t?.title || !t.playing) return { handled: true, reply: T("Nothing's playing right now. Or it's hiding from me."), emotion: 'bored' };
      const verdict = c.musicMood !== false ? await taste(t) : '';
      if (verdict) {
        state.verdict = { song: songKey(t), verdict };
        emit({ type: 'taste', ...state.verdict });
      }
      emit({ type: 'listenNow', song: songKey(t), lyrics: Boolean(state.words?.lines) && c.lyrics !== false });
      const { text, emotion } = await songOpinion(t, 15000, verdict);
      const lead = F("Okay, I'm listening: {0}.", brief(t));
      return { handled: true, reply: text ? `${lead} ${text}` : lead, emotion: verdict === 'meh' ? 'bored' : emotion };
    }
    case 'songPick': { // "putar nomor 2", from what she just found
      const api = brainParts.spotify;
      const res = api?.connected() ? await api.playPicked(e.n).catch(() => ({ why: 'failed' })) : { why: 'nothing' };
      if (res.ok) return { handled: true, reply: F('Playing {0}.', res.artist ? `${res.name} · ${res.artist}` : res.name), emotion: 'happy', zap: true };
      const why = { nothing: T('Search for something first.'), premium: T('Spotify only lets Premium accounts start a song from here.'), nodevice: T("Spotify isn't open anywhere. Open it on this PC or your phone.") }[res.why];
      return { handled: true, reply: why || T("Hm, that didn't work."), emotion: 'annoyed', denied: true };
    }
    case 'playlist': case 'playlistList': { // your own playlists, through your Spotify developer app
      const api = brainParts.spotify;
      if (!api?.connected()) return { handled: true, reply: T('To play your playlists, connect your Spotify app in my settings.'), emotion: 'bored' };
      const res = await (e.kind === 'playlist' ? api.playPlaylist(e.text) : api.playlists()).catch(() => ({ why: 'failed' }));
      const list = res.playlists;
      if (list?.length && (res.why === 'ask' || e.kind === 'playlistList')) return { handled: true, reply: `${list.slice(0, 20).map((p, i) => `${i + 1}. ${p.name}`).join('\n')}\n\n${T('Say "putar nomor 2" to play one.')}`, emotion: 'happy' };
      if (res.ok && res.name) return { handled: true, reply: F('Playing your playlist {0}.', res.name), emotion: 'happy', zap: true };
      const why = {
        notfound: F("I can't find a playlist called {0}.", e.text),
        none: T("You don't have any playlists yet."),
        scope: T('Press Connect once more in my Spotify settings, so I can see your playlists.'),
        premium: T('Spotify only lets Premium accounts start a song from here.'),
        nodevice: T("Spotify isn't open anywhere. Open it on this PC or your phone."),
      }[res.ok ? 'none' : res.why];
      return { handled: true, reply: why || T("Hm, that didn't work."), emotion: 'annoyed' };
    }
    case 'home': { // your lights and plugs (online/tuya.js)
      const api = brainParts.home;
      if (!api?.ready()) return { handled: true, reply: T('Your lights are not connected to me yet. Settings, Access, Smart home.'), emotion: 'bored' };
      const res = await api.act(e).catch(() => ({ ok: false, why: 'failed' }));
      const names = (res.names || []).join(', ');
      if (res.ok) {
        const line = {
          on: F('{0}: on.', names),
          off: F('{0}: off.', names),
          level: F('{0}: {1}%.', names, e.level),
          color: F('{0}: {1}.', names, T(e.shade || '')),
          white: F('{0}: {1}.', names, T(e.shade || '')),
          status: e.noun === 'ac' && Number.isFinite(res.temp) ? F(res.on ? '{0} is on, last set to {1}°C.' : '{0} is off, last set to {1}°C.', names, res.temp) : F(res.on ? '{0} is on.' : '{0} is off.', names),
          scene: F('{0}: {1} mode.', names, e.shade || ''),
          temp: res.clamped ? F('{0} only goes from {1} to {2}°C, so: {3}°C.', names, res.low, res.high, res.temp) : F('{0}: {1}°C.', names, res.temp),
          tempStep: res.clamped ? F('{0} only goes from {1} to {2}°C, so: {3}°C.', names, res.low, res.high, res.temp) : F('{0}: {1}°C.', names, res.temp),
          acMode: F('{0}: {1} mode.', names, e.word || ''),
          fan: F('{0}: fan {1}.', names, e.word || ''),
        }[e.action];
        return { handled: true, reply: line, emotion: 'happy', zap: e.action !== 'status' };
      }
      const problem = {
        ask: F('Which one? {0}.', names),
        none: F("I can't find {0} among your devices.", e.target),
        offline: F('{0} is offline. Is it plugged in?', names),
        nodevices: T('I got no devices from Tuya. Check that your app account is linked to your project.'),
        badkey: T('Tuya says your Access ID or Secret is wrong.'),
        noaccess: T('Tuya refused. Check that your project has IoT Core and your app account is linked.'),
        expired: T('Your Tuya project has run out of its free period. Renew it on the Tuya site.'),
        unsupported: T("That device can't do that."),
        noac: T("I can't find an air conditioner. A normal AC needs an IR blaster, with the AC added as a remote in Smart Life."),
        noir: T('Tuya refused the AC. Add the IR Control Hub Open Service to your project in Service API.'),
      }[res.why];
      return { handled: true, reply: problem || T("Hm, that didn't work."), emotion: 'annoyed' };
    }
    case 'volumeLevel': { // an exact number needs your Spotify developer app; without it, Windows only has a step up or down
      const api = brainParts.spotify;
      if (api?.connected()) {
        const res = await api.setVolume(e.level).catch(() => ({ why: 'failed' }));
        if (res.ok) return { handled: true, reply: F('Volume at {0}%.', e.level), emotion: 'happy' };
        if (res.why === 'nodevice') return { handled: true, reply: T("Nothing's playing right now. Or it's hiding from me."), emotion: 'bored' };
        if (res.why === 'premium') return { handled: true, reply: T('Setting the volume needs Spotify Premium.'), emotion: 'annoyed' };
      }
      await launch.media(e.level >= 50 ? 'volup' : 'voldown');
      return { handled: true, reply: T('One notch for now. For an exact number, connect your Spotify app in my settings.'), emotion: 'bored' };
    }
    case 'spotifySearch': { // your developer app: the results, no window. Otherwise: searched, and the top match played right away
      const api = brainParts.spotify;
      if (api?.connected()) {
        const found = await api.search(e.text).catch(() => ({ why: 'failed' }));
        if (found.ok && found.tracks.length) return { handled: true, reply: `${found.tracks.map((t, i) => `${i + 1}. ${t.name} · ${t.artist}`).join('\n')}\n\n${T('Say "putar nomor 2" to play one.')}`, emotion: 'happy' };
        if (found.ok) return { handled: true, reply: F("I couldn't find {0} in Spotify's results.", e.text), emotion: 'bored' };
      }
      return { handled: true, reply: await playOnSpotify(e.text), emotion: 'happy', zap: true };
    }
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
      return { handled: true, look: true, lookTask: e.task || '' };
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
    case 'song': {
      const played = await playSong(e.text);
      // hers: she says so
      const reply = e.mine && played.ok ? T('My song! "In Love With Myself". Obviously.') : played.reply;
      return { handled: true, reply, emotion: 'happy', zap: true };
    }
    case 'open':
      try {
        await openTarget(e.target);
        const folder = !/^[a-z]+\.exe$|^ms-settings|^https?:/i.test(e.target);
        const opened = /^[a-z]+\.exe$/i.test(e.target) ? e.target.replace(/\.exe$/i, '') : '';
        // (more: there was more to what you said that she didn't catch: she says so, never just leaves it)
        return { handled: true, reply: e.more ? F('Opened {0}. The rest I can\'t do yet.', e.text) : folder ? F('There: {0}', e.target) : F('Opened {0}.', e.text), emotion: 'happy', zap: true, opened, ...(folder && { point: { label: path.basename(e.target) } }) };
      } catch {
        return { handled: true, reply: T("Hm, that won't open!"), emotion: 'annoyed' };
      }
    case 'app': {
      const item = await launch.find(e.text).catch(() => null);
      // a site by that name ("youtube music") when no app here is called all of it (the app "Music" isn't it):
      // the site, in your browser
      const site = errands.siteFor(e.text);
      if (site && (!item || !launch.covers(item, e.text))) {
        await shell.openExternal(site);
        return { handled: true, reply: F('Opening {0}.', e.text), emotion: 'happy', zap: true };
      }
      if (!item) return { handled: false };
      try {
        await launch.launch(item);
        return { handled: true, reply: e.more ? F('Opened {0}. The rest I can\'t do yet.', item.name) : F('Opened {0}.', item.name), emotion: 'happy', zap: true, opened: item.name };
      } catch {
        return { handled: true, reply: T("Hm, that won't open!"), emotion: 'annoyed' };
      }
    }
    case 'draft':
      return draft(e.task, e.target);
    case 'hold': {
      const lines = {
        game: 'Game mode. I\'ll keep to my mask. Click it, or say "normal mode", when you\'re done. GLHF!',
        focus: 'Focus mode. Not a peep from me. Click my mask, or say "normal mode", when you need me.',
        quiet: 'Quiet mode. Just my mask, not a word. Click it when you want me back.',
        off: "I'm back! Did you miss me?",
      };
      return { handled: true, reply: T(lines[e.mode] || lines.off), emotion: e.mode === 'off' ? 'happy' : null, move: `hold-${e.mode}` };
    }
    case 'teach':
      return teach(e.name, e.run);
    case 'weather': {
      const city = e.city || c.weatherCity;
      if (!city) return { handled: true, reply: T('Which city? Say "weather in Bandung", or set yours in Settings › Behavior › Your day.'), emotion: null };
      const w = await weather.forecast(city).catch(() => null);
      if (!w) return { handled: true, reply: F("I couldn't get the weather for {0}.", city), emotion: 'annoyed' };
      return { handled: true, reply: weatherLine(w, e.when), emotion: 'happy' };
    }
    case 'brief': {
      const b = await briefing();
      return { handled: true, reply: `${b.title} ${b.text.replace(/\n/g, ' ')}`, emotion: 'happy' };
    }
    case 'type':
    case 'key': { // typing for you (or a key: Enter, Ctrl+S…) in an app by name, the one just opened, or the one you were in
      const where = e.target ? {} : { hwnd: frontWindow?.() || 0 };
      // her show while she types (the overlay: she jacks into that window, capri.js hack), from the moment it's in front
      let hacking = false;
      const onFound = (hwnd, app) => {
        hacking = true;
        emit({ type: 'hack', phase: 'start', hwnd, app, typing: e.kind === 'type', chars: words.length });
      };
      const said = e.kind === 'type' ? e.text : '';
      const words = said && opts.voice && c.fixDictation !== false && !e.paste ? await fixDictation(said) : said;
      const typeIt = (fresh) => launch.typeInto({ text: words, target: e.target || '', ...where, keys: e.kind === 'key' ? [e.key] : [], fresh, onFound, paste: Boolean(e.paste) });
      let res = await typeIt(Boolean(e.fresh));
      // "type hello in notepad" with Notepad closed: opened first, then typed in
      if (!res.ok && res.why === 'nowindow' && e.target && !e.fresh && allowed('apps')) {
        const item = await launch.find(e.target).catch(() => null);
        if (item && (await launch.launch(item).then(() => true, () => false))) res = await typeIt(true);
      }
      const app = res.app ? res.app.replace(/^WINWORD$/, 'Word').replace(/^Code$/, 'VS Code').replace(/^msedge$/, 'Edge') : (e.target || T('that window'));
      if (res.ok) {
        const done = { enter: 'Pressed Enter.', save: 'Saved.', selectall: 'Selected it all.', undo: 'Undone.', newline: 'New line.', tab: 'Tab.' };
        if (hacking) emit({ type: 'hack', phase: 'end', ok: true });
        const typed = e.code ? F('Wrote {0} lines of {1} in {2}. Ctrl+Z takes it back.', words.split('\n').length, e.code, app)
          : words !== said ? F('Typed "{0}" in {1}.', words, app) : F('Typed it in {0}.', app);
        return { handled: true, reply: e.kind === 'type' ? typed : T(done[e.key] || 'Done!'), emotion: 'happy', task: 'write' };
      }
      if (hacking) emit({ type: 'hack', phase: 'end', ok: false });
      const why = {
        nowindow: e.target ? F("I can't find {0} open.", e.target) : T("I don't know which window you mean. Name it: \"in notepad\"."),
        gone: T('That window is gone.'),
        focus: F("{0} wouldn't come to the front, so I typed nothing.", app),
        moved: T('You switched windows, so I stopped typing.'),
        you: T('You pressed a key, so I stopped typing. Your keyboard, your rules.'),
        password: T("That's a password box. I never type into those: that one's yours."),
        stopped: T('Stopped.'),
        clipboard: T('Your clipboard was busy, so I wrote nothing. Try again?'),
      };
      return { handled: true, reply: why[res.why] || T("Hm, that didn't work."), emotion: 'annoyed', denied: true };
    }
    case 'click': { // a button pressed by its name, in the window you were in or the app you named
      if (RISKY_BUTTON.test(e.name)) return { handled: true, reply: F('"{0}" can\'t be taken back, so that one\'s yours to press.', e.name), emotion: 'annoyed', denied: true };
      const res = await launch.click({ name: e.name, target: e.target || '', hwnd: e.target ? 0 : frontWindow?.() || 0 });
      if (res.ok) return { handled: true, reply: F('Pressed "{0}".', res.name || e.name), emotion: 'happy', task: 'write' };
      const seen = (res.seen || []).slice(0, 6).join(', ');
      const why = res.why === 'nowindow' ? (e.target ? F("I can't find {0} open.", e.target) : T("I don't know which window you mean. Name it: \"in notepad\"."))
        : res.why === 'notfound' ? F('There\'s no "{0}" button I can see there.', e.name) + (seen ? ` ${F('I can see: {0}.', seen)}` : '')
          : T("Hm, that didn't work.");
      return { handled: true, reply: why, emotion: 'annoyed', denied: true };
    }
    case 'form': { // "jadi spark", "glitch out": her shape, if your sync has got that far (forms.js)
      const need = { glitch: 10, spark: 20, shards: 40, silhouette: 60 }[e.form];
      if (syncPercent() < need) return { handled: true, reply: F("Not yet. We're at {0}%, I'd show you that one at {1}%.", syncPercent(), need), emotion: 'bored' };
      return { handled: true, reply: T('Watch this.'), emotion: null, move: `form-${e.form}` };
    }
    case 'rate': { // your word on her last answer: it counts for what her local model learns from (training/reward.js)
      const had = brainParts.reward?.rateLast(e.points);
      if (!had) return { handled: true, reply: T("I haven't said anything lately to rate."), emotion: 'bored' };
      return e.points > 0 ? { handled: true, reply: T('Noted. I knew that one was good.'), emotion: 'happy' } : { handled: true, reply: T("Fine. I'll remember that one was bad."), emotion: 'annoyed' };
    }
    case 'myBrowser': { // her own browser, not yours
      const b = brainParts.browser;
      if (!b) return { handled: true, reply: T("My browser isn't ready."), emotion: 'annoyed', denied: true };
      if (e.action === 'close') {
        await b.close();
        return { handled: true, reply: T('Closed it.'), emotion: 'happy' };
      }
      if (e.action === 'read') {
        const page = await b.read();
        if (!page.ok) return { handled: true, reply: page.say, emotion: 'annoyed', denied: true };
        const summary = askPlain ? await orStopped(askPlain([{ role: 'user', content: `Summarize this web page in three short sentences, in the language of the page. Only what it says.\n\n${page.text}` }], { timeout: 60000 }).catch(() => ''), tasks.signal, '') : '';
        return { handled: true, reply: String(summary).replace(/<think>[\s\S]*?<\/think>/g, '').trim() || page.text.slice(0, 400), emotion: 'happy' };
      }
      const res = e.action === 'search' ? await b.search(e.query) : await b.goto(e.url);
      return res.ok ? { handled: true, reply: res.title ? F('Open: {0}.', res.title) : T('Done!'), emotion: 'happy' } : { handled: true, reply: res.say, emotion: 'annoyed', denied: true };
    }
    case 'media': {
      if (e.action === 'pause' && state.track && !state.track.playing) return { handled: true, reply: T("Nothing's playing!"), emotion: 'bored' };
      if (e.action === 'play' && state.track?.playing) return { handled: true, reply: T("It's already playing!"), emotion: 'bored' };
      // the song itself (repeat, shuffle, from the start, a jump; next and previous too, Spotify first): through
      // Windows' media session; next and previous fall back on the media keys
      if (e.action in SESSION_ACTIONS) {
        const res = await launch.session(e.action, e.seconds || 0);
        if (res.ok) {
          const line = e.action === 'seek' ? F(e.seconds < 0 ? 'Back {0} seconds.' : 'Skipped ahead {0} seconds.', Math.abs(e.seconds)) : T(SESSION_ACTIONS[e.action]);
          return { handled: true, reply: line, emotion: 'happy' };
        }
        if (!(e.action === 'next' || e.action === 'previous')) {
          if (res.why === 'nosession') return { handled: true, reply: T("Nothing's playing right now. Or it's hiding from me."), emotion: 'bored' };
          if (res.why === 'unsupported') return { handled: true, reply: F("{0} won't let me do that.", res.app || 'This player'), emotion: 'annoyed' };
          return { handled: true, reply: T("Hm, that didn't work."), emotion: 'annoyed' };
        }
      }
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
// facts: her notes picked for this message (recall.js), else the newest; past: lines from your past chats about it
function brainContext({ cloud = false, facts: picked = null, past = [], episodes = [], working = [], knowledge = [], skill = null } = {}) {
  const c = cfg();
  // the moment, so she never guesses the time or the day
  const now = new Date();
  const parts = [
    `RIGHT NOW (their local time): ${now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, ${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}.`,
    `HOW CLOSE SHE IS TO THE USER RIGHT NOW (sync ${syncPercent()}%): ${syncTier()}`,
  ];
  const feeling = mood.line();
  if (feeling) parts.push(feeling);
  const facts = picked || memories().slice(-25);
  if (c.memoryOn && facts.length && (!cloud || c.cloudMemory)) {
    parts.push(`WHAT THE USER HAS TOLD YOU (use one only when it really fits what they said; never list them or say you keep notes):\n${facts.map((f) => `- ${f}`).join('\n')}`);
  }
  if (c.memoryOn && working.length && (!cloud || c.cloudMemory)) {
    parts.push(`GOING ON FOR THEM RIGHT NOW (they told you in the last day; bring it up only if it fits):\n${working.map((w) => `- ${w}`).join('\n')}`);
  }
  if (c.memoryOn && episodes.length && (!cloud || c.cloudMemory)) {
    parts.push(`A DAY YOU REMEMBER THAT THIS IS ABOUT:\n${episodes.map((e) => `- ${e.day}: ${e.text}`).join('\n')}`);
  }
  if (knowledge.length && (!cloud || c.cloudMemory)) {
    parts.push(`FROM WHAT THEY GAVE YOU TO READ (answer from this, name the file you got it from, and say so if it isn't here):\n${knowledge.map((k) => `[${k.title}] ${k.text}`).join('\n\n')}`);
  }
  if (skill) parts.push(skill.prompt);
  if (c.memoryOn && past.length && (!cloud || c.cloudMemory)) {
    parts.push(`FROM YOUR PAST CHATS WITH THEM, about this (bring one up only if it really fits, like you just remembered it; never say you looked it up):\n${past.map((m) => `- ${m.day}, they said: "${m.text.slice(0, 240)}"`).join('\n')}`);
  }
  if (state.track?.playing && c.music !== 'off') {
    parts.push(`Playing right now on their PC: ${brief(state.track)}. When they say "this song", "this one" or "lagu ini", they mean THIS song, not your own favorite song.`);
    const feel = state.verdict.song === songKey(state.track) ? { love: 'you love it', like: 'you like it', meh: 'it bores you' }[state.verdict.verdict] : '';
    if (feel) parts.push(`What you think of this song: ${feel}.`);
    // the words being sung (LRCLIB), so she can talk about the song as it goes
    const words = wordsNow();
    if (words) parts.push(`ITS LYRICS AROUND THIS MOMENT (">" marks the line being sung now; quote one only when they ask about the words):\n${words}`);
  }
  if (state.front) parts.push(`The program in front of them: ${state.front}.`);
  if (state.study.phase === 'focus') parts.push('They are in a focus session right now: keep it very short and push them back to work.');
  return parts.join('\n\n');
}

function hackLine() {
  return T(pick(SAY.hack));
}

let ticker = null;
// main.js, once her memory, knowledge, skills and browser are up
function setBrainParts(parts) {
  brainParts = parts;
  agentTools = null;
}

function start({ onEvent, model, raw, look, shot, front, coder: coders }) {
  coder = coders || null;
  frontWindow = front || null;
  emit = onEvent;
  askModel = model;
  askPlain = raw || model;
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
  // your plugins: what you said comes through run(); the time ones are looked at every few seconds
  pluginEngine?.stop();
  pluginEngine = plugins.createEngine({
    list: () => cfg().plugins || [],
    run: (text, opts) => run(text, opts),
    say: (evt) => emit({ type: 'plugin', ...evt }),
    notify: (text, title) => emit({ type: 'notify', text, title }),
    couldnt: (text) => F("I couldn't do \"{0}\".", text),
  });
  clearInterval(pluginTimer);
  pluginTimer = setInterval(() => pluginEngine?.tick(), 15000);
  setTimeout(() => pluginEngine?.onStart(), 25000);
}

// Settings › Plugins › Run now
const pluginRun = (id) => Boolean(pluginEngine?.runNow(String(id || '')));

function stop() {
  mood.flush();
  clearInterval(ticker);
  clearInterval(pluginTimer);
  pluginEngine?.stop();
  stopSenses();
}

const quiet = (ms) => { state.quietUntil = Date.now() + ms; };
// her renderer, held down to her mask (capri.holdIn) or back: null when she's back
const setHold = (reason) => { held = ['game', 'focus', 'quiet'].includes(reason) ? reason : null; };

module.exports = {
  tasks, setBrainParts, answerPlan, findPath, browserPath, start, stop, startSenses, run, cancel, typeDraft, briefNow, pluginRun, setHold, addSync, syncPercent, syncLine, brainContext, remember, forget, memories,
  addAlarm, removeAlarm, clearAlarms, startStudy, stopStudy, pauseStudy, studyStatus, hackLine, giveDare, quiet, playSong, lyricsChanged, songNow,
  get track() { return state.track; }, get front() { return state.front; }, get fullscreen() { return Boolean(state.fullscreen); },
};

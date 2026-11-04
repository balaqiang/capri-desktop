'use strict';

// Plugins anyone can make, without code: WHEN something happens, she DOES these steps, one after the other.
//
//   when: said "good morning" (exactly, or a sentence with it), a time of day (on some days), an app coming to the
//         front, a song starting (by its artist or title), you coming back after a while away, her starting up,
//         your battery running low
//   do:   say something; any command of hers in your words ("open spotify and play music", "pasang timer 25 menit");
//         wait; a move (dance, wave, to your cursor…); a feeling; a Windows notification
//
// Kept in her settings (config.plugins), made and changed in Settings › Plugins, shared as .capri-plugin.json files.
// A plugin does nothing she wouldn't do if you asked: its commands go through her own rules and your Access
// switches, and one coming from a file arrives switched off, for you to read first.
//
//   clean(plugin) -> a plugin she can run, or null      summary(plugin) -> its "when" in a few words
//   createEngine(deps) -> { said, onApp, onSong, onBack, onBattery, onStart, tick, runNow, stop }

const WHEN = ['said', 'time', 'app', 'song', 'back', 'start', 'battery'];
const STEPS = ['say', 'command', 'wait', 'move', 'emotion', 'notify'];
const MOVES = ['wave', 'nod', 'shrug', 'think', 'bow', 'dance', 'laugh', 'shy', 'spin', 'hop', 'left', 'right', 'center', 'cursor', 'taskbar', 'top', 'home', 'sleep', 'hide', 'show'];
const EMOTIONS = ['happy', 'jealous', 'bored', 'glitch', 'annoyed'];
const MAX_STEPS = 12;
const MAX_PLUGINS = 50;

const text = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const int = (v, lo, hi, fallback) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};
const fold = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const newId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function cleanWhen(w) {
  const type = WHEN.includes(w?.type) ? w.type : null;
  switch (type) {
    case 'said': {
      const phrase = text(w.phrase, 60);
      return phrase ? { type, phrase, match: w.match === 'contains' ? 'contains' : 'exact' } : null;
    }
    case 'time': {
      const m = /^(\d{1,2}):(\d{2})$/.exec(String(w.at || '').trim());
      if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
      const days = [...new Set((Array.isArray(w.days) ? w.days : []).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
      return { type, at: `${m[1].padStart(2, '0')}:${m[2]}`, days };
    }
    case 'app': {
      const app = text(w.app, 40);
      return app ? { type, app } : null;
    }
    case 'song': {
      const artist = text(w.artist, 60);
      const title = text(w.title, 60);
      return { type, artist, title };
    }
    case 'back': return { type, minutes: int(w.minutes, 20, 600, 30) }; // (she notices you're away after 20 minutes)
    case 'start': return { type };
    case 'battery': return { type, below: int(w.below, 5, 80, 20) };
    default: return null;
  }
}

function cleanStep(s) {
  const type = STEPS.includes(s?.type) ? s.type : null;
  switch (type) {
    case 'say': case 'command': {
      const t = text(s.text, 300);
      return t ? { type, text: t } : null;
    }
    case 'notify': {
      const t = text(s.text, 200);
      return t ? { type, text: t } : null;
    }
    case 'wait': return { type, seconds: int(s.seconds, 1, 600, 5) };
    case 'move': return MOVES.includes(s.move) ? { type, move: s.move } : null;
    case 'emotion': return EMOTIONS.includes(s.emotion) ? { type, emotion: s.emotion } : null;
    default: return null;
  }
}

function clean(p) {
  if (!p || typeof p !== 'object') return null;
  const when = cleanWhen(p.when);
  const steps = (Array.isArray(p.do) ? p.do : []).map(cleanStep).filter(Boolean).slice(0, MAX_STEPS);
  if (!when || !steps.length) return null;
  const id = /^[a-z0-9-]{3,40}$/i.test(String(p.id || '')) ? String(p.id) : newId();
  return { id, name: text(p.name, 60) || 'Plugin', on: p.on !== false, when, do: steps, cooldown: int(p.cooldown, 0, 1440, 1) };
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// its "when", in English (her settings translate it)
function summary(p) {
  const w = p.when;
  switch (w.type) {
    case 'said': return w.match === 'contains' ? `When you say something with "${w.phrase}"` : `When you say "${w.phrase}"`;
    case 'time': {
      const days = w.days.length === 0 || w.days.length === 7 ? 'every day' : w.days.join() === '1,2,3,4,5' ? 'on weekdays' : w.days.join() === '0,6' ? 'on weekends' : `on ${w.days.map((d) => DAY_NAMES[d]).join(', ')}`;
      return `At ${w.at}, ${days}`;
    }
    case 'app': return `When ${w.app} comes to the front`;
    case 'song': return w.artist || w.title ? `When a song${w.title ? ` "${w.title}"` : ''}${w.artist ? ` by ${w.artist}` : ''} starts` : 'When a song starts';
    case 'back': return `When you're back after ${w.minutes} minutes away`;
    case 'start': return 'When she starts';
    case 'battery': return `When your battery drops below ${w.below}%`;
    default: return '';
  }
}

// The plugins running, and what sets them off.
//   deps.list() -> plugins (config.plugins)         deps.run(text, opts) -> Promise<her errand result>
//   deps.say({ text, emotion, move, zap })          deps.notify(text)
//   deps.couldnt(command) -> her line for a command she couldn't do
//   deps.now() -> ms (tests)                        deps.sleep(ms) -> Promise (tests)
function createEngine(deps) {
  const now = deps.now || (() => Date.now());
  const sleep = deps.sleep || ((ms) => new Promise((done) => setTimeout(done, ms)));
  const last = new Map();    // id -> when it last ran
  const running = new Set(); // ids running now (one run of a plugin at a time)
  const fired = new Map();   // time plugins: id -> the minute they last fired
  let stopped = false;
  let battery = -1;

  const plugins = () => (deps.list() || []).map(clean).filter((p) => p && p.on).slice(0, MAX_PLUGINS);

  async function step(s, p) {
    switch (s.type) {
      case 'say': deps.say({ text: s.text, emotion: 'happy', plugin: p.name }); return null;
      case 'emotion': deps.say({ emotion: s.emotion, plugin: p.name }); return null;
      case 'move': deps.say({ move: s.move, plugin: p.name }); return null;
      case 'notify': deps.notify?.(s.text, p.name); return null;
      case 'wait': await sleep(s.seconds * 1000); return null;
      case 'command': {
        // (a command from a plugin never sets off a plugin or one of your commands: no loops)
        const res = await deps.run(s.text, { fromPlugin: true }).catch(() => null);
        if (!res?.handled) return { text: deps.couldnt ? deps.couldnt(s.text) : `I couldn't do "${s.text}".`, emotion: 'annoyed', failed: true };
        return { text: res.reply || '', emotion: res.emotion, move: res.move, zap: res.zap };
      }
      default: return null;
    }
  }

  // Runs its steps; the lines before its first wait come back (for her chat, when you set it off by saying it),
  // the rest she says as they happen.
  async function fire(p, { untilWait = false } = {}) {
    if (stopped || running.has(p.id)) return null;
    const t = now();
    if (p.cooldown && last.has(p.id) && t - last.get(p.id) < p.cooldown * 60000) return null;
    last.set(p.id, t);
    running.add(p.id);
    const first = [];
    let i = 0;
    let failed = false;
    if (untilWait) {
      for (; i < p.do.length && p.do[i].type !== 'wait'; i++) {
        const s = p.do[i];
        if (s.type === 'say') {
          first.push({ text: s.text });
          continue;
        }
        const r = await step(s, p);
        if (r) first.push(r);
        if (r?.failed) {
          failed = true;
          break;
        }
      }
    }
    const later = failed ? [] : p.do.slice(i);
    if (!later.length) {
      running.delete(p.id);
      return first;
    }
    // the steps after it, as they happen (a run keeps its place until they're done)
    const going = (async () => {
      for (const s of later) {
        if (stopped || !plugins().some((q) => q.id === p.id)) break; // switched off meanwhile
        const r = await step(s, p);
        if (r?.text || r?.move) deps.say({ text: r.text, emotion: r.emotion, move: r.move, zap: r.zap, plugin: p.name });
        if (r?.failed) break;
      }
    })().catch(() => {}).finally(() => running.delete(p.id));
    if (!untilWait) await going;
    return first;
  }

  return {
    // You said it: the plugin's first lines, for her answer ({ handled, reply, emotion, move }), or null.
    async said(textSaid) {
      const said = fold(textSaid);
      if (!said) return null;
      const p = plugins().find((q) => q.when.type === 'said' && (q.when.match === 'contains' ? ` ${said} `.includes(` ${fold(q.when.phrase)} `) : said === fold(q.when.phrase)));
      if (!p) return null;
      const lines = await fire(p, { untilWait: true });
      if (!lines) return { handled: true, reply: '', emotion: null, plugin: p.name };
      const out = lines.filter((l) => l.text);
      return {
        handled: true,
        reply: out.map((l) => l.text).join(' '),
        emotion: out.find((l) => l.emotion)?.emotion || 'happy',
        move: lines.find((l) => l.move)?.move,
        zap: lines.some((l) => l.zap),
        plugin: p.name,
      };
    },
    onApp(app) {
      const a = fold(app);
      if (!a) return;
      for (const p of plugins()) if (p.when.type === 'app' && a.includes(fold(p.when.app))) fire(p);
    },
    onSong(track) {
      if (!track?.title) return;
      const title = fold(track.title);
      const artist = fold(track.artist);
      for (const p of plugins()) {
        if (p.when.type !== 'song') continue;
        if (p.when.title && !title.includes(fold(p.when.title))) continue;
        if (p.when.artist && !artist.includes(fold(p.when.artist))) continue;
        fire(p);
      }
    },
    onBack(minutes) {
      for (const p of plugins()) if (p.when.type === 'back' && minutes >= p.when.minutes) fire(p);
    },
    onBattery(pct) {
      const was = battery;
      battery = Number(pct);
      if (!(battery >= 0) || !(was >= 0)) return;
      for (const p of plugins()) if (p.when.type === 'battery' && was >= p.when.below && battery < p.when.below) fire(p);
    },
    onStart() {
      for (const p of plugins()) if (p.when.type === 'start') fire(p);
    },
    // every few seconds: the time plugins whose minute it is (once each)
    tick(date = new Date(now())) {
      const hhmm = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
      const minute = `${date.toDateString()} ${hhmm}`;
      for (const p of plugins()) {
        if (p.when.type !== 'time' || p.when.at !== hhmm) continue;
        if (p.when.days.length && !p.when.days.includes(date.getDay())) continue;
        if (fired.get(p.id) === minute) continue;
        fired.set(p.id, minute);
        fire(p);
      }
    },
    // her settings' "Run now"
    runNow(id) {
      const p = (deps.list() || []).map(clean).find((q) => q?.id === id);
      if (!p) return false;
      last.delete(p.id);
      fire(p);
      return true;
    },
    stop() {
      stopped = true;
    },
  };
}

// Ready-made ones, to start from (Settings › Plugins › Add).
const TEMPLATES = [
  { name: 'Morning routine', when: { type: 'said', phrase: 'good morning', match: 'exact' }, do: [{ type: 'command', text: 'brief me' }, { type: 'command', text: 'play music' }, { type: 'move', move: 'dance' }] },
  { name: 'Work mode', when: { type: 'said', phrase: 'work mode', match: 'exact' }, do: [{ type: 'command', text: 'open vscode' }, { type: 'command', text: 'pasang timer 25 menit' }, { type: 'say', text: 'Focus time. 25 minutes, I\'m counting.' }] },
  { name: 'Welcome back', when: { type: 'back', minutes: 30 }, do: [{ type: 'move', move: 'wave' }, { type: 'say', text: 'There you are! I was getting bored.' }] },
  { name: 'Coding vibes', when: { type: 'app', app: 'Code' }, do: [{ type: 'say', text: 'Coding time? Want some music on?' }], cooldown: 120 },
  { name: 'Lunch break', when: { type: 'time', at: '12:00', days: [1, 2, 3, 4, 5] }, do: [{ type: 'say', text: 'Lunch! Go eat something. I\'ll guard the PC.' }, { type: 'notify', text: 'Lunch time!' }] },
  { name: 'Low battery', when: { type: 'battery', below: 15 }, do: [{ type: 'emotion', emotion: 'annoyed' }, { type: 'say', text: 'Plug me in before I black out!' }] },
];

module.exports = { clean, summary, createEngine, TEMPLATES, WHEN, STEPS, MOVES, EMOTIONS, MAX_STEPS };

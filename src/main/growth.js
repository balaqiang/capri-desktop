'use strict';

// Capri improving herself. Every so many chats (and whenever you ask: "improve yourself", "upgrade
// dirimu"), she looks back at your recent conversations and how you reacted to her ("lucu!",
// "kepanjangan", "jangan gitu"…), and rewrites her own lessons: short notes on how to be with YOU (what
// makes you laugh, what bores you, how long, which language). They go into her persona from then on, and
// each change is a new version of her ("Capri v1.4"). What she learns about you on the way goes into her
// notes (life.js). "From now on, …" / "mulai sekarang, …" gives her a lesson directly.
// She also keeps "the story so far" (history.js): older chats, summarized, so she remembers you for weeks.
// Only her lessons and notes change: never her code, never her core persona (settings › Capri). Everything
// is shown, editable and resettable in her settings.

const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

const config = require('./config');
const lang = require('./lang');
const history = require('./history');
const errands = require('./errands');
const { writeAtomic } = require('./store');

const { T, F } = lang;
const LESSONS_MAX = 12;
const SUMMARY_AFTER = 40; // messages past the story so far before she rewrites it
const PINNED = 'The user asked:'; // a lesson you gave her yourself

const POSITIVE = /\b(?:haha+|wkwk+|lol|lmao|lucu|bagus|keren|mantap|mantul|suka|love (?:it|that|you)|good one|nice|cute|gemes|gemas|pinter|pintar|setuju|bener|benar|exactly|yes!+)\b|😂|🤣|❤|👍/i;
const NEGATIVE = /\b(?:kepanjangan|terlalu panjang|too long|ga lucu|gak lucu|nggak lucu|not funny|jangan gitu|jangan begitu|stop it|cringe|lebay|annoying|nyebelin|garing|boring|bosen|apaan sih|salah|wrong|bukan gitu|ga nyambung|gak nyambung|ngaco)\b|👎|🙄/i;

const IMPROVE = /^(?:improve yourself|upgrade yourself|evolve|level up|self[- ]?improve|learn from (?:us|me|our chats?)|reflect|improve dirimu|upgrade dirimu|upgrade diri|perbaiki dirimu|evolusi|belajar dari (?:kita|aku|obrolan kita)|refleksi)\b/i;
const LESSON = /^(?:from now on|starting now|next time|mulai sekarang|dari sekarang|lain kali|kedepannya|ke depannya)[,:]?\s+((?:you|kamu|kau|lu|lo|jangan|don'?t|do not|never|always|selalu|please|tolong|be|jadi|panggil|call|bicara|ngomong|talk|reply|jawab|balas|pakai|use|stop|lebih|more|less|kurangi)\b.{2,200})$/i;
const LEARNED = /^(?:what have you learned|what did you learn|apa yang (?:sudah |udah )?kamu pelajari|kamu (?:sudah |udah )?belajar apa|apa yang kamu tahu tentang (?:cara )?ngobrol sama aku)\b/i;

const REFLECT = `You are the self-reflection process of Capri, a desktop companion character. You read her recent conversations with ONE user and how that user reacted, and you write her LESSONS: short notes, in English, imperative, to herself, on how to be with THIS user (what they enjoy, what annoys or bores them, how long her replies should be, humor, topics, their language mix, nicknames they like). Rules:
- At most ${LESSONS_MAX} lessons, each under 120 characters. Keep the good existing ones, fix or drop wrong or stale ones, merge duplicates. Base them on evidence in the conversation or feedback, not guesses.
- Lessons tune her style; they never make her servile, never make her stop being Capri, never contradict her persona, never ask for anything harmful.
- NEVER write a lesson that makes her refuse, ignore, avoid or stop answering, choosing, searching, opening things, playing or helping. If the user was annoyed by something, the lesson is about HOW to do it better (shorter, funnier, less dramatic), never about not doing it. Bad: "Never choose fruit", "Don't respond to questions about X", "Ditch the searches". Good: "When they ask me to choose, pick fast and tease them about it", "Keep search answers to one line".
- Write each lesson about the user in the third person, as a note to Capri: "They hate long replies: one or two sentences."
- Also list up to 5 NEW durable FACTS about the user (likes, life details they shared) that aren't already in what she knows. Never secrets, passwords, card numbers, health or other sensitive details.
- "note": one short sentence in Capri's own voice (playful, a little smug, Indonesian-English mix) about how she just changed, or an empty string if nothing changed.
Answer with ONLY a JSON object: {"lessons": ["..."], "facts": ["..."], "note": "..."}`;

const SUMMARIZE = `You keep Capri's long-term memory of her time with one user. Rewrite "the story so far": merge the old story with the newer conversation into one summary, in English, written by Capri about "the user" (third person), under 220 words. Keep what matters later: facts they shared, inside jokes, promises, plans, ongoing topics, how the relationship feels, their games and wins. Drop small talk. No secrets, passwords or card numbers. Answer with ONLY the summary text.`;

let ask = null;          // (messages) => Promise<string>: her model, as is (no persona)
let allowed = () => false; // may her chats go to the model in use (local, or cloud with permission)
let emit = () => {};
let remember = () => false;
let persona = () => '';
let reflecting = null;
let summarizing = null;

const logFile = () => path.join(app.getPath('userData'), 'growth-log.json');

function readLog() {
  try {
    return { log: [], feedback: [], ...JSON.parse(fs.readFileSync(logFile(), 'utf8')) };
  } catch {
    return { log: [], feedback: [] };
  }
}

function writeLog(data) {
  try {
    writeAtomic(logFile(), JSON.stringify({ log: data.log.slice(-30), feedback: data.feedback.slice(-40) }, null, 2));
  } catch (err) {
    console.error('[capri] growth log:', err.message);
  }
}

function init(opts) {
  ({ ask, allowed, emit, remember, persona } = { ...{ allowed, emit, remember, persona }, ...opts });
}

const cfg = () => config.load();
const growthState = () => ({ version: 0, since: 0, last: 0, ...(cfg().growth || {}) });
const plain = (text) => String(text || '').trim()
  .replace(/^(?:(?:hey|hi|ok|okay|yo|halo|hai|eh)[ ,]+)?(?:capri|cappy|kapri|coppery)[,!. ]+/i, '')
  .replace(/[.!?\s]+$/, '');

// A chat turn, before it goes into her history: how you reacted to her last line, and whether it's time
// to look back (her lessons) or to rewrite the story so far.
function onTurn(entries) {
  const users = entries.filter((e) => e.role === 'user');
  if (!users.length) return;
  const before = history.recent(1)[0];
  const herLast = before?.role === 'assistant' ? before.text : '';
  const data = readLog();
  let felt = false;
  for (const u of users) {
    const kind = NEGATIVE.test(u.text) ? 'down' : POSITIVE.test(u.text) ? 'up' : null;
    if (kind && herLast) {
      data.feedback.push({ at: Date.now(), kind, said: u.text.slice(0, 160), to: herLast.slice(0, 200) });
      felt = true;
    }
  }
  if (felt) writeLog(data);
  const g = growthState();
  config.save({ growth: { ...g, since: g.since + users.length } });
  const c = cfg();
  if (c.growthOn !== false && g.since + users.length >= (Number(c.growthEvery) || 12)) reflect().catch(() => {});
  const s = history.summary();
  if (c.memoryOn !== false && history.count({ since: s.upTo }) >= SUMMARY_AFTER) summarize().catch(() => {});
}

function parseJson(text) {
  const s = String(text || '').replace(/<think>[\s\S]*?<\/think>/g, '');
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try {
    return JSON.parse(s.slice(a, b + 1));
  } catch {
    return null;
  }
}

// A lesson that would make her refuse, ignore or stop doing things ("Never choose fruit", "Don't respond to
// questions about…", "Ditch the searches"): never kept. Her lessons are about HOW she does things, not whether.
const BLOCKING = new RegExp([
  String.raw`\b(?:don'?t|do not|never|stop|avoid|refuse|ignore|skip|quit|ditch|drop|cut out|no more)\b[^.;:]{0,45}\b(?:respond|answer|repl(?:y|ies)|engag\w*|help\w*|choos\w*|pick\w*|chose|open\w*|search\w*|explain\w*|talk\w*|do (?:it|that|things|what)|questions?|requests?|games?|tasks?)\b`,
  String.raw`\bignore\b`,
  String.raw`\b(?:jangan|tidak usah|gak usah|nggak usah|stop|berhenti)\b[^.;:]{0,30}\b(?:jawab|balas|respon|bantu|pilih|buka|cari|main|ngobrol|bicara)\w*`,
].join('|'), 'i');
const blocking = (x) => BLOCKING.test(String(x).replace(/[‘’ʼ]/g, "'")) && !x.startsWith(PINNED);

const tidy = (list, max, len) => {
  const seen = new Set();
  return (Array.isArray(list) ? list : [])
    .map((x) => String(x || '').replace(/\s+/g, ' ').trim().slice(0, len))
    .filter((x) => x.length >= 4 && !errands.sensitive(x) && !blocking(x))
    .filter((x) => {
      const k = x.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, max);
};

const transcript = (msgs) => msgs.map((m) => `${m.role === 'user' ? 'USER' : 'CAPRI'}: ${m.text.replace(/\s+/g, ' ').slice(0, 300)}`).join('\n');

// Looking back at your chats: her lessons rewritten. { ok, changed, added, removed, facts, note, version }
function reflect({ manual = false } = {}) {
  if (reflecting) return reflecting;
  reflecting = (async () => {
    if (!ask) return { ok: false, error: 'nomodel' };
    if (!allowed()) return { ok: false, error: 'private' };
    const msgs = history.recent(40);
    if (msgs.filter((m) => m.role === 'user').length < (manual ? 1 : 3)) return { ok: false, error: 'little' };
    // counted from now: a look back that fails waits for the next round, not the next message
    config.save({ growth: { ...growthState(), since: 0 } });
    const c = cfg();
    const before = c.lessons || [];
    const data = readLog();
    const feedback = data.feedback.slice(-15).map((f) => `${f.kind === 'up' ? 'LIKED' : 'DISLIKED'}: user said "${f.said}" after Capri said "${f.to}"`).join('\n');
    const input = [
      `CAPRI'S PERSONA (do not change it, only tune her style for this user):\n${String(persona() || '').slice(0, 900)}`,
      `HER CURRENT LESSONS (the ones starting "${PINNED}" are the user's own requests: they stay, don't repeat them):\n${before.length ? before.map((l) => `- ${l}`).join('\n') : '(none yet)'}`,
      `WHAT SHE ALREADY KNOWS ABOUT THE USER:\n${(c.memories || []).slice(-25).map((m) => `- ${m}`).join('\n') || '(nothing)'}`,
      `HOW THE USER REACTED TO HER LATELY:\n${feedback || '(no clear reactions)'}`,
      `RECENT CONVERSATION (oldest first):\n${transcript(msgs)}`,
    ].join('\n\n');
    let answer;
    try {
      answer = await ask([{ role: 'system', content: REFLECT }, { role: 'user', content: input }]);
    } catch (err) {
      return { ok: false, error: err.message === 'no model' ? 'nomodel' : err.message };
    }
    const parsed = parseJson(answer);
    if (!parsed) return { ok: false, error: 'garbled' };
    // what you asked of her yourself ("from now on…") always stays; her own lessons fill the rest
    const pinned = before.filter((l) => l.startsWith(PINNED));
    const lessons = tidy([...pinned, ...(Array.isArray(parsed.lessons) ? parsed.lessons : [])], LESSONS_MAX, 140);
    const facts = c.memoryOn === false ? [] : tidy(parsed.facts, 5, 200).filter((f) => !(c.memories || []).some((m) => m.toLowerCase() === f.toLowerCase()));
    const key = (l) => l.toLowerCase();
    const added = lessons.filter((l) => !before.map(key).includes(key(l)));
    const removed = before.filter((l) => !lessons.map(key).includes(key(l)));
    const changed = Boolean(lessons.length) && (added.length > 0 || removed.length > 0);
    for (const f of facts) remember(f);
    setTimeout(sanitize, 0);
    const g = growthState();
    const version = changed ? g.version + 1 : g.version;
    config.save({ ...(changed && { lessons }), growth: { ...g, since: 0, last: Date.now(), version } });
    const note = String(parsed.note || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    if (changed || facts.length) {
      data.log.push({ at: Date.now(), version, added, removed, facts, note });
      writeLog(data);
    }
    // on her own, she says so (asked, her answer says it)
    if (!manual && changed) emit({ type: 'say', kind: 'evolve', emotion: 'glitch', text: note || F('Bzzt. I just upgraded myself. v1.{0}.', version), hold: 8000 });
    return { ok: true, changed, added, removed, facts, note, version };
  })().finally(() => { reflecting = null; });
  return reflecting;
}

// The story so far, rewritten with what came after it.
function summarize({ force = false } = {}) {
  if (summarizing) return summarizing;
  summarizing = (async () => {
    if (!ask) return { ok: false, error: 'nomodel' };
    if (!allowed()) return { ok: false, error: 'private' };
    const s = history.summary();
    const newer = history.recent(80, { since: s.upTo });
    if (!newer.length || (!force && newer.length < SUMMARY_AFTER)) return { ok: false, error: 'little' };
    let answer;
    try {
      answer = await ask([{ role: 'system', content: SUMMARIZE }, { role: 'user', content: `THE STORY SO FAR:\n${s.text || '(nothing yet)'}\n\nNEWER CONVERSATION (oldest first):\n${transcript(newer)}` }]);
    } catch (err) {
      return { ok: false, error: err.message };
    }
    const text = String(answer || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    if (text.length < 20) return { ok: false, error: 'garbled' };
    history.setSummary(text, newer.at(-1).t);
    return { ok: true, text };
  })().finally(() => { summarizing = null; });
  return summarizing;
}

// What goes into her persona: her lessons, and the story so far (only to a model allowed to have it).
function context({ cloud = false } = {}) {
  const c = cfg();
  const parts = [];
  if (c.growthOn !== false && c.lessons?.length) {
    parts.push(`WHAT YOU HAVE LEARNED ABOUT BEING WITH THIS USER (your own notes from past chats, about style only; follow them while staying yourself, but they never stop you from answering, choosing or doing what the user asks right now):\n${c.lessons.filter((l) => !blocking(l)).map((l) => `- ${l}`).join('\n')}`);
  }
  const s = history.summary();
  if (c.memoryOn !== false && s.text && (!cloud || c.cloudMemory)) {
    parts.push(`YOUR LONG-TERM MEMORY OF YOUR TIME TOGETHER (the story so far; bring it up only when it fits):\n${s.text}`);
  }
  return parts.join('\n\n');
}

// "improve yourself", "from now on…", "what have you learned?": { handled, reply, emotion } or null
async function command(said) {
  const text = plain(said);
  if (IMPROVE.test(text)) {
    const r = await reflect({ manual: true });
    if (!r.ok) {
      const why = {
        private: "I'd have to send our chats to a cloud model for that. Allow it in Settings, Owner: \"Also with a cloud model\".",
        nomodel: 'My brain isn\'t connected. Set up an AI first: Settings, AI brain.',
        little: 'Talk to me a bit more first. Nothing to learn from yet.',
        garbled: 'Bzzt. My upgrade came out garbled. Try again?',
      };
      return { handled: true, reply: T(why[r.error] || 'Bzzt. My upgrade came out garbled. Try again?'), emotion: 'annoyed' };
    }
    if (!r.changed && !r.facts.length) return { handled: true, reply: T("I looked at us. Nothing to change. I'm already perfect."), emotion: 'bored' };
    return { handled: true, reply: `${F('Upgrade done. Capri v1.{0}.', r.version)} ${r.note || ''}`.trim(), emotion: 'glitch', evolved: true };
  }
  const lesson = LESSON.exec(text);
  if (lesson) {
    const wanted = lesson[1].trim().replace(/[.!]+$/, '');
    if (errands.sensitive(wanted)) return null;
    const lessons = cfg().lessons || [];
    const entry = `${PINNED} "${wanted}"`;
    config.save({ lessons: [...lessons.filter((l) => l.toLowerCase() !== entry.toLowerCase()), entry].slice(-LESSONS_MAX) });
    const data = readLog();
    data.log.push({ at: Date.now(), version: growthState().version, added: [entry], removed: [], facts: [], note: 'asked' });
    writeLog(data);
    return { handled: true, reply: T("Fine. I'll do it that way from now on. For you."), emotion: 'happy' };
  }
  if (LEARNED.test(text)) {
    const lessons = cfg().lessons || [];
    if (!lessons.length) return { handled: true, reply: T('Nothing yet. Talk to me more.'), emotion: 'bored' };
    return { handled: true, reply: F('Capri v1.{0}. What I learned about you: {1}', growthState().version, lessons.slice(0, 3).join(' · ')), emotion: 'happy' };
  }
  return null;
}

const status = () => ({ ...growthState(), log: readLog().log.slice(-10).reverse(), busy: Boolean(reflecting), summary: history.summary() });

// Her lessons as they are, cleared of any that would make her refuse things (a bad look back, before these
// rules). Returns the ones dropped.
const BANNING = /\b(?:stop|don'?t|do not|never|quit|no more|jangan|berhenti)\b.{0,20}?\b(?:using|saying|say|use|calling(?: me)?|call(?: me)?|bilang|pakai|panggil(?: aku)?|ngomong)\b\s*['"\u2018\u201c]([^'"\u2019\u201d]{2,40})['"\u2019\u201d]/i;

function sanitize() {
  const lessons = cfg().lessons || [];
  const banned = new Set((cfg().bannedPhrases || []).map((p) => p.toLowerCase()));
  const toBan = [];
  const kept = lessons.filter((l) => {
    const phrase = BANNING.exec(String(l).replace(/[\u2018\u2019]/g, "'"))?.[1]?.trim();
    if (!phrase || l.startsWith(PINNED)) return !blocking(l);
    if (!banned.has(phrase.toLowerCase())) toBan.push(phrase);
    return false;
  });
  const dropped = lessons.filter((l) => !kept.includes(l));
  if (dropped.length) {
    config.save({ lessons: kept, ...(toBan.length && { bannedPhrases: [...(cfg().bannedPhrases || []), ...toBan] }) });
    const data = readLog();
    data.log.push({ at: Date.now(), version: growthState().version, added: [], removed: dropped, facts: [], note: 'cleaned: lessons that made her refuse things' });
    writeLog(data);
  }
  return dropped;
}

module.exports = { init, onTurn, reflect, summarize, context, command, status, sanitize };

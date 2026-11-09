'use strict';

// What she can be asked to do, matched from plain words (typed or spoken), so it's quick, works without a model and can
// never run anything unexpected (from Capri Desktop 2.4's Errands, with Indonesian added). The commands themselves are
// in commands/*.js, in the order of commands/index.js. parse(text) -> { kind, ... } or { kind: 'none' }.

const { COMMANDS } = require('./commands');
const { plain, politely, length, nextClock, describe } = require('./commands/words');
const { friendly, place } = require('./commands/places');
const { canon, sensitive, skillName, UNTEACH_ASK, dareCategory, checkDare, DARES } = require('./commands/self');
const { CODE_THING, codeSpelled } = require('./commands/hands');
const { siteFor, BROWSERS, firstVideo } = require('./commands/web');

function parse(said) {
  const cased = plain(said);
  const text = cased.toLowerCase();
  if (!text) return { kind: 'none' };
  const asked = { said, cased, text };
  for (const { run } of COMMANDS) {
    const found = run(asked);
    if (found) return found;
  }
  return { kind: 'none' };
}

// Several commands in one sentence ("open notepad and type hello tiktok", "buka spotify lalu putar musik", "ke kiri
// terus joget"): split where they join, kept only when every part is a command of hers (else it's one command, a
// song or a search with "and" in it, or a chat). What to type runs on to the end, or to a key to press after it.
const JOIN = /\s*,?\s+(?:and then|and|then|after that|lalu|terus|trus|kemudian|habis itu|abis itu|setelah itu|dan|&)\s+|\s*[;,]\s+/gi;
const MAX_STEPS = 5;

function chain(said) {
  const raw = politely(said);
  const pieces = [];
  const joins = [];
  let last = 0;
  for (const m of raw.matchAll(JOIN)) {
    pieces.push(raw.slice(last, m.index));
    joins.push(m[0]);
    last = m.index + m[0].length;
  }
  pieces.push(raw.slice(last));
  if (pieces.length < 2) return null;
  const steps = [];
  for (let i = 0; i < pieces.length; i++) {
    let part = pieces[i].trim();
    if (!part) continue;
    let e = parse(part);
    if (e.kind === 'type') {
      let j = i + 1;
      while (j < pieces.length && !['key', 'click'].includes(parse(pieces[j].trim()).kind)) {
        part += joins[j - 1] + pieces[j];
        j++;
      }
      e = parse(part.trim());
      i = j - 1;
    }
    if (e.kind === 'none') return null;
    steps.push({ said: part.trim(), e });
  }
  return steps.length >= 2 && steps.length <= MAX_STEPS ? steps : null;
}

// ---- what her rules missed: her model asked what you meant (life.js route) ----
// Only a sentence that sounds like a command ("could you fire up spotify", "tolong nyalain notepad dong", "kecilin
// suaranya"), so a plain chat never waits for it; a question about the world never is one.
const ROUTE_HINT = /\b(?:open|launch|start|fire up|boot|run|load|bring up|pull up|play|pause|resume|stop the|skip|next|previous|turn (?:up|down|on|off)|crank|volume|louder|quieter|softer|mute|unmute|tunes?|hear|listen|type|write|enter|search|google|look up|find|show|hide|set|timer|alarm|remind|wake me|move|go to|go (?:left|right)|stand|sit|come|dance|lyrics?|music|song|track|playlist|spotify|notepad|vs ?code|chrome|edge|browser|youtube|discord|whatsapp|telegram|folder|downloads?|documents?|buka\w*|nyala\w*|jalan\w*|putar\w*|puter\w*|setel\w*|mainkan|lanjut\w*|ganti|lewati|skip\w*|ketik\w*|tulis\w*|cari\w*|tampil\w*|sembunyi\w*|pasang\w*|ingatkan|bangunin|kecil\w*|gede\w*|besar\w*|keras\w*|pelan\w*|lagu\w*|musik\w*|lirik\w*|suara\w*|pindah\w*|ke (?:kiri|kanan|tengah|sini)|joget\w*)\b/i;
const ROUTE_QUESTION = /^(?:who|what|why|how|when|where|which|whose|is|are|was|were|does|did|siapa|apa|apakah|kenapa|mengapa|bagaimana|gimana|kapan|di ?mana|berapa)\b/i;
// what she may do from her model's reading of you (never closing an app, forgetting, clearing alarms, writing code)
const ROUTE_KINDS = new Set(['app', 'open', 'find', 'browser', 'web', 'song', 'media', 'spotifySearch', 'lyrics', 'listen', 'nowPlaying', 'move', 'timer', 'clock', 'time', 'type', 'key']);

// talk to her, about her, or about the world: a chat, whatever words are in it ("kamu suka musik apa?", "tell me
// about spotify's history")
const ROUTE_CHAT = /^(?:tell me|ceritakan|ceritain|explain|jelaskan|describe|what do you think|menurutmu|do you|are you|kamu suka|kamu tau|apa kamu|i (?:love|like|hate)|aku (?:suka|cinta|benci))\b/i;

function routable(said) {
  const t = politely(plain(said));
  if (t.length < 3 || t.length > 160 || /\n/.test(t)) return false;
  const asking = /^(?:can|could|would|will) you\b/i.test(politely(String(said || '')).trim()) || /^(?:can|could|would|will) you\b|^(?:tolong|bisa)\b/i.test(String(said || '').trim());
  if ((ROUTE_QUESTION.test(t) || /\?\s*$/.test(t)) && !asking) return false;
  if (ROUTE_CHAT.test(t)) return false;
  return ROUTE_HINT.test(t);
}

// What her model's guess may be, by what you said: an app opened only when you said to open something, a search
// only when you said search, typing only when you said type... (a guess is never more than your own words).
const ROUTE_GROUNDS = {
  app: /\b(?:open|launch|start|fire up|boot|run|load|bring up|pull up|go to|buka\w*|nyala\w*|jalan\w*)\b/i,
  find: /\b(?:find|where|open|bring up|pull up|cari\w*|mana|buka\w*)\b/i,
  web: /\b(?:search|google|look up|cari\w*|carikan|googling\w*)\b/i,
  song: /\b(?:play|put on|hear|listen|tunes?|music|songs?|track|putar\w*|puter\w*|setel\w*|dengar\w*|denger\w*|lagu\w*|musik\w*|mainkan)\b/i,
  timer: /\b(?:timer|alarm|remind|wake|minutes?|hours?|o'?clock|ingat\w*|bangun\w*|menit|jam|pukul)\b/i,
  type: /\b(?:type|write|enter|press|send|save|ketik\w*|tulis(?!an\b)\w*|tekan|kirim|simpan)\b/i, // ("tulisan" is a piece of writing, not "write")
};
const GROUND_OF = { app: 'app', open: 'app', browser: 'app', find: 'find', web: 'web', song: 'song', spotifySearch: 'song', timer: 'timer', clock: 'timer', type: 'type', key: 'type' };
const grounded = (e, said) => !GROUND_OF[e.kind] || ROUTE_GROUNDS[GROUND_OF[e.kind]].test(said);

// The one line her model answered, read by her own rules: what to do, or null (NONE, something she may not do
// from a guess, or more than you said).
function routed(line, said = '') {
  let t = String(line || '').trim().split(/\r?\n/)[0].replace(/^["'`]+|["'`]+$/g, '').replace(/^(?:command|answer)\s*:\s*/i, '').trim();
  if (!t || /^none\b/i.test(t) || t.length > 200) return null;
  // a small model copying the list back ("open <app> | play music"): not an answer
  if (/[|<>]/.test(t)) return null;
  // "play blinding lights by <someone>": the artist only if you named them (a model guesses one, and wrong)
  const fold = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  if (said) t = t.replace(/\s+by\s+([^,]+?)(?=\s+and\s|$)/i, (m, who) => (fold(said).includes(fold(who)) && !/^(?:aku|saya|me|i|myself|you|kamu)$/i.test(who.trim()) ? m : ''));
  // (code only written into the editor in front, "write … here": never a terminal or a file from a guess)
  const ok = (e) => (ROUTE_KINDS.has(e.kind) || (e.kind === 'code' && e.here && CODE_THING.test(codeSpelled(said || e.task)))) && (!said || grounded(e, said));
  const steps = chain(t);
  // several commands back for one thing you asked: a guess too far
  if (steps && said && !new RegExp(JOIN.source, 'i').test(politely(said))) return null;
  if (steps) return steps.every((s) => ok(s.e)) ? { line: t, steps } : null;
  const e = parse(t);
  return ok(e) ? { line: t, e } : null;
}

module.exports = { parse, chain, canon, routable, routed, ROUTE_KINDS, skillName, UNTEACH_ASK, sensitive, describe, firstVideo, dareCategory, checkDare, friendly, DARES, length, nextClock, plain, place, siteFor, BROWSERS };

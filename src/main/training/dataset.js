'use strict';

// What her local model can be trained on: her lines from the show, what was written for her (curated.jsonl) and the chats that went well, cleaned up. Only ever written
// to this PC. Names, numbers and addresses are the reason a chat is left out, not something to scrub and hope: a chat with a
// phone number in it simply doesn't go in. Her lines from the show stay yours to use: don't publish a dataset or a model made
// from them.

const CHAT_TAGS = /\[\[[^\]]*\]\]|\[[a-z]+\]/gi;
const PRIVATE = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b|\bhttps?:\/\/\S+|(?:\+?\d[\s-]?){9,}|\b(?:password|passcode|kata sandi|api key|token|pin atm|nomor kartu|alamat rumah|nik)\b/i;
const OFF_CHARACTER = /\b(?:as an ai|i'?m just an ai|language model|sebagai (?:ai|model bahasa)|i cannot assist)\b/i;
const MAX_ANSWER = 500;

const clean = (s) => String(s || '').replace(CHAT_TAGS, '').replace(/\s+/g, ' ').trim();

// One exchange, fit to learn from? -> { user, answer } or null
function usable({ user, answer }) {
  const u = clean(user);
  const a = clean(answer);
  if (u.length < 2 || a.length < 2 || a.length > MAX_ANSWER || u.length > 500) return null;
  if (a === '…' || OFF_CHARACTER.test(a) || PRIVATE.test(u) || PRIVATE.test(a)) return null;
  return { user: u, answer: a };
}

// One written example, fit to learn from? Its emotion tags stay: that's how she should answer. The profile and body notes in context are made up.
function usableCurated(row) {
  const turns = Array.isArray(row?.turns) ? row.turns : [];
  if (turns.length < 2 || turns.length % 2 || turns.at(-1).role !== 'assistant') return false;
  return turns.filter((t) => t.role === 'assistant').every((t) => {
    const text = String(t.content || '');
    return text.length >= 2 && text.length <= MAX_ANSWER && !OFF_CHARACTER.test(text);
  });
}

// As the app sends it: your profile and what's going on come right before the last thing you said.
function curatedMessages(persona, { turns, context }) {
  const before = turns.slice(0, -2);
  return [{ role: 'system', content: persona }, ...before, ...(context ? [{ role: 'system', content: context }] : []), ...turns.slice(-2)];
}

// A tenth of the examples held back, always the same ones, to see whether training helped. -> { train, valid }
function split(rows) {
  const train = [];
  const valid = [];
  for (const row of rows) {
    const user = row.messages.filter((m) => m.role === 'user').map((m) => m.content).join('|');
    let hash = 7;
    for (let i = 0; i < user.length; i++) hash = (hash * 31 + user.charCodeAt(i)) % 1000003;
    (hash % 10 === 0 ? valid : train).push(row);
  }
  return { train, valid };
}

// canon: [{ user, answer }], curated: [{ cat, turns, context }], good: what went well (reward.js). -> { rows: [{ messages }], used, dropped, counts }
function build({ persona, canon = [], curated = [], good = [] }) {
  const seen = new Set();
  const rows = [];
  let dropped = 0;
  for (const raw of [...canon, ...good]) {
    const ok = usable(raw);
    const key = ok && `${ok.user.toLowerCase()}|${ok.answer.toLowerCase()}`;
    if (!ok || seen.has(key)) {
      dropped++;
      continue;
    }
    seen.add(key);
    rows.push({ messages: [{ role: 'system', content: persona }, { role: 'user', content: ok.user }, { role: 'assistant', content: ok.answer }] });
  }
  const counts = { canon: 0, chats: 0 };
  for (const row of curated) {
    const messages = usableCurated(row) ? curatedMessages(persona, row) : null;
    const key = messages && JSON.stringify(messages.slice(1));
    if (!messages || seen.has(key)) {
      dropped++;
      continue;
    }
    seen.add(key);
    rows.push({ messages });
    counts[row.cat || 'other'] = (counts[row.cat || 'other'] || 0) + 1;
  }
  return { rows, used: rows.length, dropped, counts };
}

const toJsonl = (rows) => `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`;

// For `ollama create`: the trained file, her persona, how she samples. Nothing here can reach outside the quotes.
function modelfile({ gguf, persona, temperature = 0.85 }) {
  const quoted = String(persona).replace(/\\/g, '\\\\').replace(/"""/g, '" " "');
  return `FROM "${String(gguf).replace(/"/g, '')}"\nPARAMETER temperature ${Number(temperature) || 0.85}\nSYSTEM """${quoted}"""\n`;
}

module.exports = { build, usable, usableCurated, curatedMessages, split, toJsonl, modelfile };

'use strict';

// What her local model can be trained on: her lines from the show and the chats that went well, cleaned up. Only ever written
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

// canon: [{ user, answer }], good: what went well (reward.js). -> { rows: [{ messages }], used, dropped }
function build({ persona, canon = [], good = [] }) {
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
  return { rows, used: rows.length, dropped };
}

const toJsonl = (rows) => `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`;

// For `ollama create`: the trained file, her persona, how she samples. Nothing here can reach outside the quotes.
function modelfile({ gguf, persona, temperature = 0.85 }) {
  const quoted = String(persona).replace(/\\/g, '\\\\').replace(/"""/g, '" " "');
  return `FROM "${String(gguf).replace(/"/g, '')}"\nPARAMETER temperature ${Number(temperature) || 0.85}\nSYSTEM """${quoted}"""\n`;
}

module.exports = { build, usable, toJsonl, modelfile };

'use strict';

// What every command shares: your words without her name or the polite start, numbers, lengths of time.

const NUMBERS = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  fifteen: 15, twenty: 20, thirty: 30, forty: 40, sixty: 60,
  se: 1, satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10,
  'lima belas': 15, 'dua puluh': 20, 'tiga puluh': 30, 'empat puluh': 40, 'enam puluh': 60,
};
const NUMBER = '(\\d+(?:[.,]\\d+)?|lima belas|dua puluh|tiga puluh|empat puluh|enam puluh|an?|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|forty|sixty|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh)';
const UNIT = '(seconds?|secs?|detik|minutes?|mins?|menit|hours?|hrs?|jam)';
const DURATION = new RegExp(`\\b${NUMBER}\\s*${UNIT}\\b`, 'i');

// Her name as a speech recognizer may write it, and what people say before it ("Hello Capri.", "Um, Capri,",
// "Hey, Kapri!", "Okay Capri"): stripped before anything is read as a command.
const NAME = String.raw`(?:capri|cappy|kapri|caprie|capree|coppery|copri|cabri|kaprie|kapre)`;
const GREETING = String.raw`(?:hey|hi|hello|helo|hallo|halo|hai|ok|okay|oke|yo|eh|woy|oi|um+|uh+|uhm+|erm|hmm+)`;
const CALLED = new RegExp(String.raw`^(?:${GREETING}[\s,.!]+)*(?:${NAME}[\s,.!:?]+)?`, 'i');

function plain(text) {
  let t = String(text || '').trim().replace(/[‘’]/g, "'");
  t = t.replace(CALLED, '');
  for (let i = 0; i < 3; i++) {
    t = t.replace(/^(?:can you|could you|would you|will you|please|just|go ahead and|i want you to|i need you to|tolong|coba|bisa|bisakah|bisa gak|bisa nggak|bisa tolong|minta|aku mau kamu|aku minta|dong|yuk)\s+/i, '');
  }
  t = t.replace(/\s+(?:please|for me|now|thanks|thank you|capri|dong|ya|yah|sekarang|buat aku|untukku|makasih|pls)[.!?]*$/i, '');
  t = t.replace(/^(play|put on|queue|start|open|search|look up|google|find|set|remind|dare|remember|forget|putar|buka|cari|ingat|lupakan)\s*[,;:]\s*/i, '$1 ');
  return t.replace(/^[\s.!?,]+|[\s.!?,]+$/g, '');
}

const number = (word) => {
  const w = String(word).toLowerCase();
  const v = Number(w.replace(',', '.'));
  return Number.isFinite(v) ? v : NUMBERS[w] || 0;
};

// Seconds in "10 minutes", "an hour", "setengah jam", "5 menit"; 0 when there's none.
function length(text) {
  if (/\bhalf an? hour\b|\bsetengah jam\b/i.test(text)) return 1800;
  const m = DURATION.exec(text);
  if (!m) return 0;
  const amount = number(m[1]);
  const unit = m[2].toLowerCase();
  const seconds = /^(h|jam)/.test(unit) ? amount * 3600 : /^(m)/.test(unit) ? amount * 60 : amount;
  return seconds >= 1 && seconds <= 86400 ? seconds : 0;
}

// The next time the clock shows this, today or tomorrow; with no am/pm (or pagi/siang/sore/malam), the nearest.
function nextClock(hour, minute, half, now = new Date()) {
  if (hour > 23 || minute > 59) return null;
  const hours = [];
  const h = String(half || '').toLowerCase();
  if (/^a|pagi/.test(h)) hours.push(hour % 12);
  else if (/^p|siang|sore|malam/.test(h)) hours.push((hour % 12) + 12);
  else if (hour >= 13 || hour === 0) hours.push(hour);
  else hours.push(hour % 12, (hour % 12) + 12);
  let best = null;
  for (const hh of hours) {
    const when = new Date(now);
    when.setHours(hh, minute, 0, 0);
    if (when <= new Date(now.getTime() + 5000)) when.setDate(when.getDate() + 1);
    if (!best || when < best) best = when;
  }
  return best;
}

// her name and a polite start ("Capri, can you…", "tolong…", "bisa nggak…"): not a command of their own
const ASKING = new RegExp(String.raw`^(?:${GREETING}[\s,.!]+)*(?:${NAME}[\s,.!:?]+)?(?:(?:can you|could you|would you|will you|please|pls|tolong|coba|bisa(?:kah| tolong| nggak| gak| ga)?|aku mau kamu|i want you to|go ahead and)[\s,]+)*`, 'i');
// what you asked, without her name or the polite start; asked as a question ("can you…?"), its question mark is
// the request's, not part of what to type
function politely(said) {
  const raw = String(said || '').trim();
  const start = ASKING.exec(raw)?.[0] || '';
  const rest = raw.slice(start.length);
  return /\b(?:can|could|would|will) you\b|\bbisa\b/i.test(start) ? rest.replace(/\s*\?+$/, '') : rest;
}

// "10 minutes", "1 hour 5 min"
function describe(seconds, lang) {
  if (seconds < 60) return lang.count('{0} second|{0} seconds', Math.round(seconds));
  if (seconds < 3600) return lang.count('{0} minute|{0} minutes', Math.round(seconds / 60));
  const h = Math.floor(seconds / 3600);
  const rest = Math.round((seconds - h * 3600) / 60);
  return lang.count('{0} hour|{0} hours', h) + (rest > 0 ? ` ${lang.F('{0} min', rest)}` : '');
}

module.exports = { NAME, GREETING, plain, politely, number, length, nextClock, describe };

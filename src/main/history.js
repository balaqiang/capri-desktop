'use strict';

// Her history with you: every chat turn, kept on this PC, one file a day (<userData>/history/YYYY-MM-DD.jsonl,
// one JSON line a message: { t, role, text, emotion, via }). Her chat only takes the last few messages to
// her model; what's older lives on as "the story so far" (summary.json), a short summary she rewrites now
// and then (growth.js), so she remembers you across weeks without sending all of it anywhere.
// Settings › History reads, searches and deletes it.

const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

const dir = () => path.join(app.getPath('userData'), 'history');
const DAY = /^\d{4}-\d{2}-\d{2}\.jsonl$/;

const today = (t = Date.now()) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// [{ role: 'user' | 'assistant', text, emotion?, via? }]
function add(entries) {
  try {
    fs.mkdirSync(dir(), { recursive: true });
    const now = Date.now();
    const lines = entries
      .filter((e) => e && (e.role === 'user' || e.role === 'assistant') && String(e.text || '').trim())
      .map((e, i) => JSON.stringify({ t: now + i, role: e.role, text: String(e.text).slice(0, 4000), ...(e.emotion && { emotion: e.emotion }), ...(e.via && { via: e.via }) }));
    if (lines.length) fs.appendFileSync(path.join(dir(), `${today(now)}.jsonl`), `${lines.join('\n')}\n`);
    return lines.length;
  } catch (err) {
    console.error('[capri] history:', err.message);
    return 0;
  }
}

function files() {
  try {
    return fs.readdirSync(dir()).filter((f) => DAY.test(f)).sort();
  } catch {
    return [];
  }
}

function read(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day))) return [];
  try {
    return fs.readFileSync(path.join(dir(), `${day}.jsonl`), 'utf8').split('\n').filter(Boolean).map((l) => {
      try { return JSON.parse(l); } catch { return null; }
    }).filter(Boolean);
  } catch {
    return [];
  }
}

// [{ day, count }], newest first
function days() {
  return files().reverse().map((f) => {
    const day = f.slice(0, 10);
    let count = 0;
    try {
      count = fs.readFileSync(path.join(dir(), f), 'utf8').split('\n').filter(Boolean).length;
    } catch {
      // being written
    }
    return { day, count };
  });
}

// the last n messages, across days (newest last)
function recent(n = 40, { since = 0 } = {}) {
  const out = [];
  for (const f of files().reverse()) {
    const msgs = read(f.slice(0, 10)).filter((m) => m.t > since);
    out.unshift(...msgs);
    if (out.length >= n || (since && msgs.length === 0)) break;
  }
  return out.slice(-n);
}

function count({ since = 0 } = {}) {
  let total = 0;
  for (const f of files().reverse()) {
    const msgs = read(f.slice(0, 10));
    const newer = msgs.filter((m) => m.t > since).length;
    total += newer;
    if (newer < msgs.length) break; // older days are all before it
  }
  return total;
}

// messages with these words in them: [{ day, t, role, text }], newest first, at most 100
function search(query) {
  const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const hits = [];
  for (const f of files().reverse()) {
    for (const m of read(f.slice(0, 10)).reverse()) {
      const low = m.text.toLowerCase();
      if (words.every((w) => low.includes(w))) hits.push({ day: f.slice(0, 10), ...m });
      if (hits.length >= 100) return hits;
    }
  }
  return hits;
}

function removeDay(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day))) return;
  fs.rmSync(path.join(dir(), `${day}.jsonl`), { force: true });
}

function clear() {
  for (const f of files()) fs.rmSync(path.join(dir(), f), { force: true });
  setSummary('');
}

// days older than `keep` go (0: keep forever)
function prune(keep) {
  if (!keep) return;
  const limit = today(Date.now() - keep * 86400000);
  for (const f of files()) if (f.slice(0, 10) < limit) fs.rmSync(path.join(dir(), f), { force: true });
}

// ---- the story so far ----

const summaryFile = () => path.join(dir(), 'summary.json');

function summary() {
  try {
    return { text: '', upTo: 0, updated: 0, ...JSON.parse(fs.readFileSync(summaryFile(), 'utf8')) };
  } catch {
    return { text: '', upTo: 0, updated: 0 };
  }
}

function setSummary(text, upTo = summary().upTo) {
  try {
    fs.mkdirSync(dir(), { recursive: true });
    fs.writeFileSync(summaryFile(), JSON.stringify({ text: String(text || '').slice(0, 4000), upTo, updated: Date.now() }, null, 2));
  } catch (err) {
    console.error('[capri] history summary:', err.message);
  }
}

module.exports = { add, days, read, recent, count, search, removeDay, clear, prune, summary, setSummary, dir };

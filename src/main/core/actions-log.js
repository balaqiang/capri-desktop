'use strict';

// What she did on your PC, for you to see (settings › Access › What she did): every app she opened, every page,
// every search, every key she pressed and every time she typed for you, with how it went and why not when it
// didn't. Kept on this PC only (actions.json in her data folder), the last 300. What she typed is never kept,
// only how much of it and where.
//
//   record(e, res, { via, routed })   list(n) -> [{ at, kind, what, ok, why, via, routed }]   clear()

const path = require('node:path');
const { app } = require('electron');
const { writeAtomic, readJson } = require('./store');

const KEEP = 300;
// what touches your PC (her moves, her timers, a chat, a draft only shown aren't in it)
const LOGGED = new Set(['app', 'open', 'find', 'browser', 'web', 'video', 'song', 'spotifySearch', 'media', 'type', 'key', 'close', 'code']);

let entries = null;
let saveTimer = null;
let enabled = () => true;

const file = () => path.join(app.getPath('userData'), 'actions.json');
function shelf() {
  if (!entries) {
    const kept = readJson(file());
    entries = Array.isArray(kept?.entries) ? kept.entries.slice(-KEEP) : [];
  }
  return entries;
}
function flush() {
  saveTimer = null;
  try {
    writeAtomic(file(), JSON.stringify({ v: 1, entries: shelf() }));
  } catch (err) {
    console.error('[capri] action log:', err.message);
  }
}

// a few words on what it was: the app, the page, the search, the key; for typing, how much and where
function describe(e) {
  switch (e.kind) {
    case 'type': { const n = String(e.text || '').length; return `${n} character${n === 1 ? '' : 's'}${e.target ? ` → ${e.target}` : ''}`; }
    case 'key': return `${e.key}${e.target ? ` → ${e.target}` : ''}`;
    case 'click': return `"${e.name}"${e.target ? ` → ${e.target}` : ''}`;
    case 'media': return `${e.action}${e.seconds ? ` ${e.seconds}s` : ''}`;
    case 'code': return String(e.task || '').slice(0, 80);
    default: return String(e.text || e.target || e.what || '').slice(0, 80);
  }
}

function record(e, res, { via = 'typed', routed = '' } = {}) {
  if (!e || !LOGGED.has(e.kind) || !res?.handled || !enabled()) return;
  const failed = res.denied || res.emotion === 'annoyed';
  shelf().push({
    at: Date.now(),
    kind: e.kind,
    what: describe(e),
    ok: !failed,
    ...(failed && { why: String(res.why || res.reply || '').slice(0, 120) }),
    via,
    ...(routed && { routed: String(routed).slice(0, 120) }),
  });
  if (entries.length > KEEP) entries.splice(0, entries.length - KEEP);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 1500);
}

const list = (n = 60) => shelf().slice(-n).reverse();

function clear() {
  const had = shelf().length;
  clearTimeout(saveTimer);
  entries = [];
  flush();
  return had;
}

function start({ on } = {}) {
  if (on) enabled = on;
  app.on('will-quit', () => { if (saveTimer) flush(); });
}

module.exports = { start, record, list, clear, describe };

'use strict';

// How much video memory is free on this PC, and which of your Ollama models fits in it right now. A model that fits runs
// on the graphics card and answers fast; one that doesn't spills onto the CPU and crawls. So: the model you picked as long
// as (most of) it fits, a smaller one while something else is eating the card (a game, say), and yours again afterwards.

const { execFile } = require('node:child_process');

const MIB = 1024 * 1024;
const CACHE_MS = 15000;
// the part of a model that has to be on the card for it to be worth running this way
const ENOUGH = 0.75;

let cache = { at: 0, value: null };

const parseSmi = (out) => {
  const row = String(out || '').trim().split(/\r?\n/)[0] || '';
  const [total, used] = row.split(',').map((x) => Number(x.trim()));
  return Number.isFinite(total) && Number.isFinite(used) && total > 0 ? { total: total * MIB, used: used * MIB, free: Math.max(0, total - used) * MIB } : null;
};

// { total, used, free } in bytes, or null: no NVIDIA card (nothing here to go by, and nothing changes)
function memory({ fresh = false } = {}) {
  if (!fresh && Date.now() - cache.at < CACHE_MS) return Promise.resolve(cache.value);
  return new Promise((resolve) => {
    execFile('nvidia-smi', ['--query-gpu=memory.total,memory.used', '--format=csv,noheader,nounits'], { windowsHide: true, timeout: 3000 }, (err, out) => {
      cache = { at: Date.now(), value: err ? null : parseSmi(out) };
      resolve(cache.value);
    });
  });
}

// models: [{ name, size }] on disk (about what they take on the card), loaded: { name: bytes on the card already }.
// -> the name of the model to use: `wanted` when enough of it fits, else the biggest that does, else the smallest.
// Without a list of sizes or a card to go by: `wanted`.
function choose({ wanted, models, free, loaded = {} }) {
  const known = (models || []).filter((m) => m.size > 0);
  if (free == null || !known.length) return wanted;
  const room = (m) => free + (loaded[m.name] || 0);
  const fits = (m) => m.size * ENOUGH <= room(m);
  const mine = known.find((m) => m.name === wanted);
  if (!mine || fits(mine)) return wanted;
  const smaller = known.filter((m) => m.size < mine.size).sort((a, b) => b.size - a.size);
  return (smaller.find(fits) || smaller.at(-1) || mine).name;
}

module.exports = { memory, choose, parseSmi, ENOUGH };

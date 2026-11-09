'use strict';

// What she recalls for what you just said: of her notes about you, the ones it's about (not just the last 25),
// and from your past chats, a line or two where you talked about it before ("my sister's name is Ayu", said
// three weeks ago). Words matched the way a search engine does (BM25, Indonesian and English, a little
// stemming: "lagunya" finds "lagu"); with an embedding model in Ollama (ollama pull nomic-embed-text), by meaning
// too ("my sibling" finds "my sister"). All on this PC: nothing is sent anywhere for it.
//
//   memoriesFor(query, facts) -> Promise<facts>   pastChats(query, messages) -> Promise<[{ day, text }]>

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { app } = require('electron');
const ollama = require('../ai/ollama');

const STOP = new Set(`a an the and or but if then so to of in on at for with from by about as is are was were be been am do does did have has had
i me my mine you your yours we our us they them their he she it its this that these those what which who whom how why when where
can could would will should shall may might must not no yes ok okay just really very too also please thanks hey hi hello capri kapri
aku saya gue gw kamu kau lu lo anda dia kita kami mereka ini itu yang dan atau tapi kalau jika maka untuk dari di ke pada dengan
tentang ada adalah jadi sudah udah belum lagi aja saja dong deh sih kok ya yah nah tuh nih mau ingin bisa boleh harus akan sedang
apa siapa kapan mana gimana bagaimana kenapa mengapa berapa juga banget sangat tolong coba halo hai
today tonight tomorrow yesterday now again week time get got make go going want need like know think say said tell thing something
lol haha wkwk hehe hari besok kemarin nanti sekarang minggu waktu lagi bikin buat kasih bilang tahu tau pikir`.split(/\s+/));

// "lagunya" -> "lagu", "kakakku" -> "kakak", "songs" -> "song", "playing" -> "play"
function stem(w) {
  if (w.length <= 4) return w;
  return w.replace(/(?:nya|ku|mu|lah|kah|pun)$/, '')
    .replace(/^(?:meng|meny|mem|men|me|peng|peny|pem|pen|pe|ber|be|ter|di)(?=\w{4,})/, '')
    .replace(/(?:kan|an|i)$/, (m, i, s) => (s.length - m.length >= 4 ? '' : m))
    .replace(/(?:ing|ed|es|s)$/, (m, i, s) => (s.length - m.length >= 3 ? '' : m));
}
const tokens = (text) => String(text || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2 && !STOP.has(w)).map(stem);

// BM25 over these texts, for this query: [score per text]
function bm25(query, docs, { k1 = 1.4, b = 0.75 } = {}) {
  const q = [...new Set(tokens(query))];
  const toks = docs.map(tokens);
  const avg = toks.reduce((n, t) => n + t.length, 0) / Math.max(1, toks.length) || 1;
  const df = new Map();
  for (const t of toks) for (const w of new Set(t)) df.set(w, (df.get(w) || 0) + 1);
  return toks.map((t) => {
    let s = 0;
    for (const w of q) {
      const f = t.filter((x) => x === w).length;
      if (!f) continue;
      const idf = Math.log(1 + (docs.length - df.get(w) + 0.5) / (df.get(w) + 0.5));
      s += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * t.length) / avg)));
    }
    return s;
  });
}

// ---- by meaning, when Ollama has an embedding model ----

const EMBEDDERS = /(?:embed|nomic|mxbai|bge|minilm|e5-|gte|arctic|snowflake)/i;
let embedder = { name: null, checked: 0 };
let vectors = null; // { hash: [numbers] }, kept on this PC (embeddings.json)
let saveTimer = null;
const vecFile = () => path.join(app.getPath('userData'), 'embeddings.json');
const hash = (s) => crypto.createHash('sha1').update(`${embedder.name}|${s}`).digest('hex').slice(0, 20);

async function findEmbedder() {
  if (Date.now() - embedder.checked < 10 * 60000) return embedder.name;
  embedder.checked = Date.now();
  try {
    const names = (await ollama.models()).map((m) => m.name || m);
    embedder.name = names.find((n) => EMBEDDERS.test(n)) || null;
  } catch {
    embedder.name = null;
  }
  return embedder.name;
}

function shelf() {
  if (!vectors) {
    try { vectors = JSON.parse(fs.readFileSync(vecFile(), 'utf8')); } catch { vectors = {}; }
  }
  return vectors;
}
function keep() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const all = Object.entries(shelf());
      fs.writeFileSync(vecFile(), JSON.stringify(Object.fromEntries(all.slice(-3000))));
    } catch { /* only a cache */ }
  }, 2000);
}

async function embed(texts, wait = 2500) {
  const model = await findEmbedder();
  if (!model || !texts.length) return null;
  const known = shelf();
  const missing = [...new Set(texts.filter((t) => !known[hash(t)]))];
  if (missing.length) {
    const res = await fetch(`${ollama.base()}/api/embed`, {
      method: 'POST',
      body: JSON.stringify({ model, input: missing, keep_alive: '10m' }),
      signal: AbortSignal.timeout(wait),
    }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (!res?.embeddings?.length) return null;
    missing.forEach((t, i) => { known[hash(t)] = res.embeddings[i].map((x) => Math.round(x * 1e4) / 1e4); });
    keep();
  }
  return texts.map((t) => known[hash(t)]);
}
const cosine = (a, b) => {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na * nb) || 1);
};

// The texts that are about the query, best first: by words, and by meaning when she can.
async function ranked(query, docs, { min = 0.8, meaning = 0.55 } = {}) {
  if (!docs.length || tokens(query).length === 0) return [];
  const words = bm25(query, docs);
  const top = Math.max(...words, 1e-9);
  const vecs = await embed([query, ...docs]).catch(() => null);
  return docs.map((text, i) => {
    const lexical = words[i] / top; // 0..1
    const sim = vecs?.[0] && vecs[i + 1] ? cosine(vecs[0], vecs[i + 1]) : null;
    const hit = words[i] >= min || (sim !== null && sim >= meaning);
    return { text, i, score: sim === null ? lexical : 0.6 * sim + 0.4 * lexical, hit };
  }).filter((r) => r.hit).sort((a, b) => b.score - a.score);
}

// Her notes for this message: all of them while they're few; else the ones it's about, and the newest few.
async function memoriesFor(query, facts, { few = 12, top = 8, newest = 3 } = {}) {
  if (facts.length <= few) return facts;
  const about = (await ranked(query, facts)).slice(0, top).map((r) => r.i);
  const keepIdx = new Set([...about, ...facts.map((_, i) => i).slice(-newest)]);
  return facts.filter((_, i) => keepIdx.has(i));
}

// From your past chats (what you said, not today's), the lines this message is about: [{ day, text }].
async function pastChats(query, messages, { top = 3 } = {}) {
  if (tokens(query).length < 2) return [];
  const today = new Date().toISOString().slice(0, 10);
  const yours = messages.filter((m) => m.role === 'user' && m.text && m.text.length >= 12 && m.text.length <= 400)
    .map((m) => ({ day: new Date(m.t).toISOString().slice(0, 10), text: m.text }))
    .filter((m) => m.day !== today);
  if (!yours.length) return [];
  // by words first, over all of them (fast): two words in common, or one that's rare in your chats (a name, "sister")
  const q = new Set(tokens(query));
  const toks = yours.map((m) => new Set(tokens(m.text)));
  const df = new Map();
  for (const t of toks) for (const w of t) df.set(w, (df.get(w) || 0) + 1);
  const rare = (w) => w.length >= 4 && (df.get(w) || 0) <= Math.max(2, toks.length * 0.01);
  const words = bm25(query, yours.map((m) => m.text));
  const best = toks.map((t, i) => {
    const shared = [...t].filter((w) => q.has(w));
    return { i, s: words[i], ok: shared.length >= 2 || shared.some(rare) };
  }).filter((r) => r.ok).sort((a, b) => b.s - a.s).slice(0, 40).map((r) => yours[r.i]);
  if (!best.length) return [];
  // by meaning too (each one embedded once, kept), when Ollama has an embedding model: best first
  const vecs = await embed([query, ...best.map((m) => m.text)]).catch(() => null);
  const order = vecs?.[0] ? best.map((m, i) => ({ m, s: vecs[i + 1] ? cosine(vecs[0], vecs[i + 1]) : 0 })).filter((r) => r.s >= 0.45).sort((a, b) => b.s - a.s).map((r) => r.m) : best;
  const seen = new Set();
  return order.filter((m) => !seen.has(m.text.toLowerCase()) && seen.add(m.text.toLowerCase())).slice(0, top);
}

module.exports = { findEmbedder, memoriesFor, pastChats, tokens, bm25, ranked, stem };

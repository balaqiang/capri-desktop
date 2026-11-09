'use strict';

// Quick answers from the web for questions about the world ("siapa presiden indonesia", "who is the ceo of nvidia"):
// Wikipedia (in the question's language) and, for an Indonesian question, Bing's results (safe search on), asked at
// once and given a few seconds at most. What they say goes to her model with your question, so she answers from
// today's web, not from what her model remembers. Only the question goes out; results are kept 15 minutes.
//
//   lookup(question) -> Promise<{ query, lang, results: [{ title, text, url, from }] }>

const { app, net } = require('electron');

// through Chromium's own network stack (Electron's net), the way a browser asks: a search engine answers it with
// its results, where Node's fetch got an empty page (results left for JavaScript to fetch)
const request = (url, init) => (net?.fetch ? net.fetch(url, init) : fetch(url, init));

const WAIT_MS = 3000;
const BING_WAIT_MS = 4500; // its first answer of a session can be slow
const KEEP_MS = 15 * 60000;
const looked = new Map(); // question -> { at, found: Promise }

const agent = () => `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 CapriDesktop/${app.getVersion()}`;

const plain = (s) => String(s || '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&ensp;|&#0?160;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&#x27;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/\s+/g, ' ').trim();

// the question as a search: without "siapa", "who is", "sih", "ya"... (an engine searches for those words too)
const QUESTION_WORDS = /^(?:(?:capri|kapri)[,\s]+)?(?:tolong |coba )?(?:siapa(?:kah)?|apa(?:kah)?(?: itu| sih| arti| yang dimaksud(?: dengan)?)?|kapan(?:kah)?|di ?mana(?:kah)?|berapa(?:kah)?|bagaimana|gimana|jelaskan|ceritakan(?: tentang)?|who(?:'s| is| was| are| were)?|what(?:'s| is| are| was| were| does| did)?|when(?: is| was| did| does| will)?|where(?: is| was| are)?|how|which|define|explain)\s+/i;
const FILLER = /\s+(?:sih|ya|dong|kah|tuh|deh|nih|sekarang|now|today|please)\b/gi;
const searchFor = (q) => String(q).trim().replace(/[?!.]+$/, '').replace(QUESTION_WORDS, '').replace(/^(?:the|a|an)\s+/i, '').replace(FILLER, '').trim() || String(q).trim();

const INDONESIAN = /\b(?:siapa|apa|apakah|kapan|dimana|di mana|berapa|bagaimana|gimana|yang|itu|adalah|sekarang|hari ini|presiden|negara|kota|harga|cara|jelaskan)\b/i;
// what never reaches her model, whatever an engine returns
const UNSAFE = /\b(?:bokep|ngewe|ngentot|porn\w*|porno|xxx|sex|seks|nude|nudes|nsfw|crot|kontol|memek|tobrut|hentai|onlyfans|judi|slot gacor|togel)\b/i;
const JUNK = /\b(?:sign in|log ?in|masuk|google (?:forms|sheets|accounts)|microsoft word|document editor)\b/i;

async function get(url, json, wait = WAIT_MS) {
  const res = await request(url, { headers: { 'User-Agent': agent(), 'Accept-Language': 'id,en;q=0.8' }, signal: AbortSignal.timeout(wait) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return json ? res.json() : res.text();
}

// You opened her chat: the way to Bing and Wikipedia found and opened now (the first request of a session is the
// slow one, a few seconds), so a question you're about to type is answered at full speed.
let warmed = 0;
function warm() {
  if (Date.now() - warmed < 60000) return;
  warmed = Date.now();
  for (const url of ['https://www.bing.com/', 'https://id.wikipedia.org/', 'https://en.wikipedia.org/']) {
    request(url, { method: 'HEAD', headers: { 'User-Agent': agent() }, signal: AbortSignal.timeout(6000) }).catch(() => {});
  }
}

// Wikipedia: the best page for it (its opening), and the lines of the next two that match
async function wikipedia(query, lang) {
  const base = `https://${lang}.wikipedia.org`;
  const found = await get(`${base}/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=3&srprop=snippet&format=json&utf8=1`, true);
  const hits = found?.query?.search || [];
  if (!hits.length) return [];
  const url = (title) => `${base}/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
  const page = await get(`${base}/api/rest_v1/page/summary/${encodeURIComponent(hits[0].title.replace(/ /g, '_'))}`, true).catch(() => null);
  const first = plain(page?.extract).slice(0, 700) || plain(hits[0].snippet);
  return [
    { title: hits[0].title, text: first, url: page?.content_urls?.desktop?.page || url(hits[0].title), from: 'Wikipedia' },
    ...hits.slice(1).map((h) => ({ title: h.title, text: plain(h.snippet), url: url(h.title), from: 'Wikipedia' })).filter((h) => h.text),
  ].filter((h) => h.text);
}

// Bing's results (Indonesian, safe search strict): titles and snippets, only ones about the question
async function bing(query) {
  const html = await get(`https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=id&cc=ID&adlt=strict`, false, BING_WAIT_MS);
  const words = query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2);
  const out = [];
  for (const item of html.split('<li class="b_algo"').slice(1)) {
    const title = plain(/<h2[^>]*>([\s\S]*?)<\/h2>/.exec(item)?.[1]);
    const text = plain(/<p[^>]*>([\s\S]*?)<\/p>/.exec(item)?.[1]); // its date first, when it has one: how fresh it is
    const url = /<a[^>]+href="(https?:[^"]+)"/.exec(item)?.[1] || '';
    const all = `${title} ${text}`;
    const about = words.filter((w) => all.toLowerCase().includes(w)).length;
    // about the question (a word of a two-word one, two of a longer one), never unsafe, never a login page
    if (!title || !text || UNSAFE.test(all) || JUNK.test(title) || about < (words.length <= 2 ? 1 : 2)) continue;
    out.push({ title, text: text.slice(0, 260), url: plain(url), from: 'Bing' });
    if (out.length >= 4) break;
  }
  if (!app.isPackaged) console.log(`[web] Bing: ${html.split('<li class="b_algo"').length - 1} results, ${out.length} kept`);
  return out;
}

async function search(question) {
  const query = searchFor(question);
  const lang = INDONESIAN.test(question) ? 'id' : 'en';
  const settle = (p, from) => p.catch((err) => {
    if (!app.isPackaged) console.log(`[web] ${from} failed:`, err.cause?.code || err.message);
    return [];
  });
  const [wiki, news] = await Promise.all([
    settle(wikipedia(query, lang).then((r) => (r.length || lang === 'en' ? r : wikipedia(query, 'en'))), 'Wikipedia'),
    lang === 'id' ? settle(bing(query), 'Bing') : Promise.resolve([]),
  ]);
  return { query, lang, results: [...news, ...wiki] };
}

function lookup(question) {
  const q = String(question || '').trim().slice(0, 200);
  if (!q) return Promise.resolve({ query: '', lang: 'en', results: [] });
  const had = looked.get(q.toLowerCase());
  if (had && Date.now() - had.at < KEEP_MS) return had.found;
  const found = search(q);
  looked.set(q.toLowerCase(), { at: Date.now(), found });
  for (const [k, v] of looked) if (Date.now() - v.at > KEEP_MS) looked.delete(k);
  return found;
}

module.exports = { lookup, warm, searchFor };

'use strict';

// The words of the song you're playing, for her to follow along (the line being sung, over her head, as it's
// sung) and to know what it's about: from LRCLIB (lrclib.net), a free, open library of timed lyrics, no
// account or key. Asked once a song, with only what Windows says is playing (title, artist, album, length),
// and kept on this PC (lyrics-cache.json in her data folder): a song you've played before has its words at
// once, without asking anyone. Settings › Access clears it.
//
//   lyricsFor(track) -> Promise<{ lines: [{ t, text }] | null, plain: string, instrumental: boolean } | null>
//   cached(track) -> the same, at once, when it's kept on this PC (undefined when it isn't)
//   lineAt(lines, seconds) -> the index of the line being sung then (-1 before the first)
//   cacheInfo() -> { songs, bytes }      clearCache() -> how many songs were forgotten

const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

const API = 'https://lrclib.net/api';
const WAIT_MS = 9000;
const KEEP = 1000;   // songs kept on disk (the ones played longest ago go first)
const NEAR_S = 3.5;  // a recording this much longer or shorter than the song is another version
const MISSING_DAYS = 3; // a song LRCLIB didn't have: asked again after this long (it may have it by then)
const asking = new Map(); // song -> Promise<lyrics | null>, while it's being looked up

const agent = () => `Capri Desktop v${app.getVersion()} (https://github.com/balaqiang/capri-desktop)`;

// ---- kept on this PC ----

const cacheFile = () => path.join(app.getPath('userData'), 'lyrics-cache.json');
let kept = null; // { song: { at, dur, lyrics | null } }
let saveTimer = null;

function shelf() {
  if (kept) return kept;
  try {
    const data = JSON.parse(fs.readFileSync(cacheFile(), 'utf8'));
    kept = data && data.v === 1 && data.songs && typeof data.songs === 'object' ? data.songs : {};
  } catch {
    kept = {};
  }
  return kept;
}

function keep(song, entry) {
  const all = shelf();
  all[song] = entry;
  const names = Object.keys(all);
  if (names.length > KEEP) {
    names.sort((a, b) => (all[a].at || 0) - (all[b].at || 0));
    for (const old of names.slice(0, names.length - KEEP)) delete all[old];
  }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 1500);
}

function flush() {
  saveTimer = null;
  if (!kept) return;
  try {
    const file = cacheFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(`${file}.tmp`, JSON.stringify({ v: 1, songs: kept }));
    fs.renameSync(`${file}.tmp`, file);
  } catch (err) {
    console.error('[capri] could not keep the lyrics:', err.message);
  }
}

function cacheInfo() {
  const songs = Object.values(shelf()).filter((e) => e.lyrics).length;
  let bytes = 0;
  try { bytes = fs.statSync(cacheFile()).size; } catch { /* nothing kept yet */ }
  return { songs, bytes };
}

function clearCache() {
  const gone = Object.values(shelf()).filter((e) => e.lyrics).length;
  kept = {};
  asking.clear();
  clearTimeout(saveTimer);
  saveTimer = null;
  try { fs.rmSync(cacheFile(), { force: true }); } catch { /* already gone */ }
  return gone;
}

// ---- LRCLIB ----

async function ask(route, params) {
  const res = await fetch(`${API}/${route}?${new URLSearchParams(params)}`, {
    headers: { 'User-Agent': agent(), 'Lrclib-Client': agent() },
    signal: AbortSignal.timeout(WAIT_MS),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`LRCLIB ${res.status}`);
  return res.json();
}

// "Song (feat. X) - Remastered 2011" -> "Song": what's after the name, that the library rarely has
const bareTitle = (title) => String(title || '')
  .replace(/\s*[([](?:feat|ft|with|prod)\b\.?[^)\]]*[)\]]/gi, '')
  .replace(/\s*[([][^)\]]*\b(?:remaster(?:ed)?|version|edit|live|mono|stereo|deluxe|bonus|from)\b[^)\]]*[)\]]/gi, '')
  .replace(/\s+-\s+.*\b(?:remaster(?:ed)?|version|edit|live|mono|stereo|deluxe|bonus|from)\b.*$/i, '')
  .trim();
const fold = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const alike = (a, b) => {
  const x = fold(a), y = fold(b);
  return Boolean(x && y && (x === y || x.includes(y) || y.includes(x)));
};

// "[01:02.34]words" (several stamps on a line, a line with none skipped) -> [{ t: 62.34, text: 'words' }]
function parse(lrc) {
  const lines = [];
  for (const row of String(lrc || '').split(/\r?\n/)) {
    const stamps = [...row.matchAll(/\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g)];
    if (!stamps.length) continue;
    const text = row.replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
    for (const m of stamps) lines.push({ t: Number(m[1]) * 60 + Number(m[2].replace(':', '.')), text });
  }
  return lines.sort((a, b) => a.t - b.t);
}

// The best of what a search found: the same length as the song, timed, the same names.
function best(records, track) {
  const dur = Number(track.dur) || 0;
  const scored = (records || [])
    .filter((r) => r && (r.syncedLyrics || r.plainLyrics || r.instrumental))
    .filter((r) => !dur || !r.duration || Math.abs(r.duration - dur) <= NEAR_S)
    .filter((r) => !track.artist || alike(r.artistName, track.artist))
    .map((r) => ({ r, score: (r.syncedLyrics ? 4 : 0) + (alike(r.trackName, track.title) ? 2 : 0) + (alike(r.albumName, track.album) ? 1 : 0) - (dur && r.duration ? Math.abs(r.duration - dur) / NEAR_S : 0) }))
    .sort((a, b) => b.score - a.score);
  return scored[0]?.r || null;
}

function shape(record) {
  if (!record) return null;
  const lines = record.syncedLyrics ? parse(record.syncedLyrics) : [];
  return { lines: lines.length ? lines : null, plain: String(record.plainLyrics || '').trim(), instrumental: Boolean(record.instrumental) };
}

// -> { lyrics, sure }: sure is false when the internet let her down (nothing to keep then)
async function look(track) {
  const dur = Math.round(Number(track.dur) || 0);
  let sure = true;
  const tryAsk = (route, params) => ask(route, params).catch(() => { sure = false; return null; });
  // the exact recording first (it needs the length), then a search by name, then a looser one
  let found = null;
  if (dur > 0 && track.album) {
    found = await tryAsk('get', { track_name: track.title, artist_name: track.artist, album_name: track.album, duration: dur });
    if (found?.syncedLyrics || found?.instrumental) return { lyrics: shape(found), sure: true };
  }
  const title = bareTitle(track.title) || track.title;
  const named = await tryAsk('search', { track_name: title, ...(track.artist && { artist_name: track.artist }) });
  let pick = best(named, track);
  if (!pick?.syncedLyrics) {
    const loose = await tryAsk('search', { q: `${title} ${track.artist || ''}`.trim() });
    const other = best(loose, track);
    if (other && (!pick || (other.syncedLyrics && !pick.syncedLyrics))) pick = other;
  }
  // only the untimed words of the exact recording: still something to know the song by
  const lyrics = shape(pick?.syncedLyrics || !found ? pick || found : found);
  return { lyrics, sure: Boolean(lyrics) || sure };
}

const songOf = (track) => `${fold(track.title)}|${fold(track.artist)}`;

// Played before: its words from this PC, right away (null: LRCLIB hasn't got them; undefined: not kept, or
// kept for a recording of another length, another version).
function cached(track) {
  if (!track?.title) return undefined;
  const song = songOf(track);
  const dur = Number(track.dur) || 0;
  const had = shelf()[song];
  if (!had || (dur && had.dur && Math.abs(had.dur - dur) > NEAR_S)) return undefined;
  if (!had.lyrics && Date.now() - had.at > MISSING_DAYS * 86400000) return undefined;
  if (had.lyrics) keep(song, { ...had, at: Date.now() }); // played again: kept longer
  return had.lyrics;
}

function lyricsFor(track) {
  if (!track?.title) return Promise.resolve(null);
  const had = cached(track);
  if (had !== undefined) return Promise.resolve(had);
  const song = songOf(track);
  const dur = Number(track.dur) || 0;
  if (!asking.has(song)) {
    asking.set(song, look(track).then(({ lyrics, sure }) => {
      if (sure) keep(song, { at: Date.now(), dur: Math.round(dur), lyrics });
      return lyrics;
    }).catch(() => null).finally(() => setTimeout(() => asking.delete(song), 1000)));
  }
  return asking.get(song);
}

function lineAt(lines, seconds) {
  if (!lines?.length || !(seconds >= 0)) return -1;
  let lo = 0, hi = lines.length - 1, at = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].t <= seconds) { at = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return at;
}

app.on('will-quit', () => { if (saveTimer) flush(); });

module.exports = { lyricsFor, cached, lineAt, parse, bareTitle, cacheInfo, clearCache };

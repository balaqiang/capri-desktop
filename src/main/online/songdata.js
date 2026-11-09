'use strict';

// What a song really sounds like, so what she makes of it isn't her model's guess. Spotify closed its tempo and energy
// data to new apps in November 2024; Deezer's public catalogue still has a loudness (gain) and often a tempo (bpm) for
// a track, needs no login and gets only the title and artist. Her ear goes by the loudness first: a tempo there can be
// double the real one on a slow song, or 0 when nobody measured it.

const LOUD = -9;   // dB: mastered loud, at -9 or above
const SOFT = -13.5; // and quiet at -13.5 or below
const fold = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\([^)]*\)|\[[^\]]*\]| - .*$/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

// 'energetic', 'calm', or '' when the numbers don't say
function energyOf({ bpm, gain } = {}) {
  if (!Number.isFinite(gain)) return '';
  if (gain >= LOUD) return 'energetic';
  if (gain <= SOFT) return 'calm';
  if (bpm >= 110 && bpm <= 165) return 'energetic'; // in between: a danceable tempo decides
  if (bpm >= 60 && bpm < 90) return 'calm';
  return '';
}

// The result that really is this song: the same title, and the artist when you know it.
function matching(results, title, artist) {
  const t = fold(title);
  const a = fold(artist);
  return (results || []).find((r) => {
    const rt = fold(r.title);
    const ra = fold(r.artist?.name);
    return rt === t && (!a || ra === a || ra.includes(a) || a.includes(ra));
  }) || null;
}

// -> { bpm, gain, energy } or null (not found, offline, too slow)
async function lookup({ title, artist }, { fetcher = fetch } = {}) {
  if (!title) return null;
  try {
    const q = encodeURIComponent(`${artist || ''} ${title}`.trim().slice(0, 150));
    const found = await (await fetcher(`https://api.deezer.com/search?limit=5&q=${q}`, { signal: AbortSignal.timeout(5000) })).json();
    const hit = matching(found.data, title, artist);
    if (!hit) return null;
    const track = await (await fetcher(`https://api.deezer.com/track/${hit.id}`, { signal: AbortSignal.timeout(5000) })).json();
    const facts = { bpm: Number(track.bpm) || 0, gain: Number(track.gain) };
    return { ...facts, energy: energyOf(facts) };
  } catch {
    return null;
  }
}

module.exports = { lookup, energyOf, matching };

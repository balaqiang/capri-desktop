'use strict';

// The weather where you are, from Open-Meteo (open-meteo.com: free, no key, no account): your city from her
// settings (Behavior › Your day), or the one you name ("cuaca di Bandung", "weather in Tokyo"). Only the city's
// name, and then its coordinates, go out. Kept 20 minutes.
//
//   forecast(city) -> Promise<{ place, now: { temp, feels, code, wind, humidity }, days: [{ date, code, max, min, rain }] } | null>
//   describe(code) -> 'light rain'   (English: her lines are translated by lang.js)

const { app, net } = require('electron');

const request = (url) => (net?.fetch ? net.fetch(url, { headers: { 'User-Agent': `CapriDesktop/${app.getVersion()}` }, signal: AbortSignal.timeout(6000) })
  : fetch(url, { signal: AbortSignal.timeout(6000) }));
const KEEP_MS = 20 * 60000;
const places = new Map(); // city -> place | null
const kept = new Map();   // "lat,lon" -> { at, data }

async function json(url) {
  const res = await request(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function place(city) {
  const key = String(city || '').trim().toLowerCase();
  if (!key) return null;
  if (places.has(key)) return places.get(key);
  const found = await json(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(key)}&count=1&language=id&format=json`);
  const p = found?.results?.[0];
  const out = p ? { name: p.name, country: p.country || '', lat: p.latitude, lon: p.longitude } : null;
  places.set(key, out);
  return out;
}

async function forecast(city) {
  const where = await place(city);
  if (!where) return null;
  const at = `${where.lat.toFixed(3)},${where.lon.toFixed(3)}`;
  const had = kept.get(at);
  if (had && Date.now() - had.at < KEEP_MS) return had.data;
  const w = await json(`https://api.open-meteo.com/v1/forecast?latitude=${where.lat}&longitude=${where.lon}`
    + '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m'
    + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=3');
  const c = w?.current;
  if (!c) return null;
  const d = w.daily || {};
  const data = {
    place: where,
    now: { temp: Math.round(c.temperature_2m), feels: Math.round(c.apparent_temperature), code: c.weather_code, wind: Math.round(c.wind_speed_10m), humidity: c.relative_humidity_2m },
    days: (d.time || []).map((date, i) => ({ date, code: d.weather_code[i], max: Math.round(d.temperature_2m_max[i]), min: Math.round(d.temperature_2m_min[i]), rain: d.precipitation_probability_max?.[i] ?? null })),
  };
  kept.set(at, { at: Date.now(), data });
  return data;
}

// WMO weather codes (Open-Meteo's), in a few words
function describe(code) {
  if (code === 0) return 'clear sky';
  if (code === 1) return 'mostly clear';
  if (code === 2) return 'partly cloudy';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'foggy';
  if (code >= 51 && code <= 57) return 'drizzle';
  if (code === 61 || code === 80) return 'light rain';
  if (code === 63 || code === 81) return 'rain';
  if (code === 65 || code === 82 || code === 66 || code === 67) return 'heavy rain';
  if (code >= 71 && code <= 77) return 'snow';
  if (code === 85 || code === 86) return 'snow showers';
  if (code === 95) return 'thunderstorms';
  if (code === 96 || code === 99) return 'thunderstorms with hail';
  return 'mixed weather';
}
const wet = (code) => (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;

module.exports = { forecast, describe, wet };

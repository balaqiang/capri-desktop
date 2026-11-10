'use strict';

// Spotify through your own developer app (optional: settings › Access › Spotify): search and play without the Spotify window
// coming up. You paste your Client ID and log in on Spotify's own page in your browser, so she never sees your password; no
// client secret is needed (PKCE). What she gets is a token that can only look at and control your playback, kept encrypted.
//
// Playing needs a Premium account, and Spotify running somewhere (this PC, your phone): the API tells a device what to play, it
// doesn't play anything itself. Without those she falls back on the old way.

const http = require('node:http');
const crypto = require('node:crypto');

const PORT = 47830;
const REDIRECT = `http://127.0.0.1:${PORT}/spotify/callback`;
const SCOPES = 'user-read-playback-state user-modify-playback-state playlist-read-private playlist-read-collaborative';
const API = 'https://api.spotify.com/v1';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const LOGIN_WAIT = 3 * 60000;
const CLIENT_ID = /^[0-9a-f]{32}$/i;

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const challengeOf = (verifier) => b64url(crypto.createHash('sha256').update(verifier).digest());

function authorizeUrl({ clientId, verifier, state }) {
  const q = new URLSearchParams({ client_id: clientId, response_type: 'code', redirect_uri: REDIRECT, scope: SCOPES, code_challenge_method: 'S256', code_challenge: challengeOf(verifier), state });
  return `https://accounts.spotify.com/authorize?${q}`;
}

const PAGE = (line) => `<!doctype html><meta charset="utf-8"><title>Capri</title><body style="font:16px sans-serif;background:#111;color:#eee;padding:40px">${line}</body>`;

// The device to play on: the one playing now, else this kind of thing first (a computer), never one that can't be controlled.
function pickDevice(devices) {
  const usable = (devices || []).filter((d) => d.id && !d.is_restricted);
  return usable.find((d) => d.is_active) || usable.find((d) => d.type === 'Computer') || usable[0] || null;
}

const summary = (t) => ({ uri: t.uri, name: t.name, artist: (t.artists || []).map((a) => a.name).join(', ') });

// deps: { clientId() -> string, loadToken() -> refresh token or '', saveToken(token | ''), open(url), fetcher, now }
function createSpotify({ clientId, loadToken, saveToken, open, fetcher = fetch, now = Date.now, port = PORT }) {
  let access = '';
  let expires = 0;
  let waiting = null; // a login going on: { cancel }
  let last = [];      // what the last search found
  let lastLists = null; // or the playlists she just listed, if that came after it: what "putar nomor 2" means

  const form = (fields) => ({ method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields).toString(), signal: AbortSignal.timeout(10000) });
  const keep = (body) => {
    access = body.access_token;
    expires = now() + ((Number(body.expires_in) || 3600) - 30) * 1000;
    if (body.refresh_token) saveToken(body.refresh_token); // it can change every time
  };

  async function token() {
    if (access && now() < expires) return access;
    const refresh = loadToken();
    if (!refresh || !clientId()) return '';
    const res = await fetcher(TOKEN_URL, form({ grant_type: 'refresh_token', refresh_token: refresh, client_id: clientId() }));
    if (!res.ok) {
      if (res.status === 400 || res.status === 401) spotify.disconnect(); // taken back on Spotify's side: log in again
      return '';
    }
    keep(await res.json());
    return access;
  }

  async function call(method, path, body) {
    const t = await token();
    if (!t) return { why: 'login' };
    const res = await fetcher(`${API}${path}`, { method, headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' }, ...(body && { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10000) });
    if (res.status === 401) {
      access = '';
      return { why: 'login' };
    }
    if (res.status === 403) {
      // connected before she asked to see your playlists, or not Premium: they need different things from you
      const info = await res.json().catch(() => null);
      return { why: /scope/i.test(info?.error?.message || '') ? 'scope' : 'premium' };
    }
    if (res.status === 404) return { why: 'nodevice' };
    if (res.status === 429) return { why: 'busy' };
    if (!res.ok) return { why: 'failed' };
    return { ok: true, data: res.status === 204 ? null : await res.json().catch(() => null) };
  }

  const spotify = {
    connected: () => Boolean(clientId() && loadToken()),
    validId: (id) => CLIENT_ID.test(String(id || '').trim()),
    redirect: REDIRECT,

    // Spotify's own login page, in your browser; back here on 127.0.0.1 with a code. -> { ok } | { ok: false, why }
    login() {
      const id = String(clientId() || '').trim();
      if (!CLIENT_ID.test(id)) return Promise.resolve({ ok: false, why: 'noid' });
      waiting?.cancel();
      const verifier = b64url(crypto.randomBytes(48));
      const state = b64url(crypto.randomBytes(16));
      return new Promise((resolve) => {
        const finish = (res) => {
          clearTimeout(timer);
          server.close();
          waiting = null;
          resolve(res);
        };
        const server = http.createServer(async (req, reply) => {
          const url = new URL(req.url, REDIRECT);
          if (url.pathname !== '/spotify/callback') {
            reply.statusCode = 404;
            reply.end();
            return;
          }
          // (the state: only the login she started can land here)
          const code = url.searchParams.get('code');
          const answer = (status, line) => {
            reply.statusCode = status;
            reply.setHeader('content-type', 'text/html; charset=utf-8');
            reply.end(PAGE(line));
          };
          if (url.searchParams.get('state') !== state || !code) {
            answer(400, 'That did not work. Go back to Capri and try again.');
            finish({ ok: false, why: url.searchParams.get('error') === 'access_denied' ? 'denied' : 'failed' });
            return;
          }
          try {
            const res = await fetcher(TOKEN_URL, form({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT, client_id: id, code_verifier: verifier }));
            if (!res.ok) throw new Error(String(res.status));
            keep(await res.json());
            answer(200, 'Connected. You can close this tab.');
            finish({ ok: true });
          } catch {
            answer(500, 'That did not work. Go back to Capri and try again.');
            finish({ ok: false, why: 'failed' });
          }
        });
        const timer = setTimeout(() => finish({ ok: false, why: 'timeout' }), LOGIN_WAIT);
        waiting = { cancel: () => finish({ ok: false, why: 'cancelled' }) };
        server.on('error', () => finish({ ok: false, why: 'port' }));
        server.listen(port, '127.0.0.1', () => open(authorizeUrl({ clientId: id, verifier, state })));
      });
    },

    disconnect() {
      access = '';
      expires = 0;
      last = [];
      saveToken('');
    },

    // -> { ok, tracks: [{ uri, name, artist }] } | { ok: false, why }
    async search(query, limit = 5) {
      const res = await call('GET', `/search?type=track&limit=${Math.min(10, limit)}&q=${encodeURIComponent(String(query).slice(0, 200))}`);
      if (!res.ok) return res;
      const tracks = (res.data?.tracks?.items || []).filter(Boolean).map(summary);
      last = tracks;
      lastLists = null;
      return { ok: true, tracks };
    },

    // One song on the device playing (or a computer of yours). -> { ok, name, artist, device } | { ok: false, why }
    async playTrack(track) {
      const list = await call('GET', '/me/player/devices');
      if (!list.ok) return list;
      const device = pickDevice(list.data?.devices);
      if (!device) return { ok: false, why: 'nodevice' };
      const res = await call('PUT', `/me/player/play?device_id=${encodeURIComponent(device.id)}`, { uris: [track.uri] });
      return res.ok ? { ok: true, name: track.name, artist: track.artist, device: device.name } : res;
    },

    // The volume on the device playing, 0 to 100. -> { ok, device } | { ok: false, why }
    async setVolume(percent) {
      const list = await call('GET', '/me/player/devices');
      if (!list.ok) return list;
      const device = pickDevice(list.data?.devices);
      if (!device) return { ok: false, why: 'nodevice' };
      const level = Math.max(0, Math.min(100, Math.round(percent)));
      const res = await call('PUT', `/me/player/volume?volume_percent=${level}&device_id=${encodeURIComponent(device.id)}`);
      return res.ok ? { ok: true, device: device.name } : res;
    },

    async playSong(query) {
      const found = await spotify.search(query);
      if (!found.ok) return found;
      if (!found.tracks.length) return { ok: false, why: 'notfound' };
      return spotify.playTrack(found.tracks[0]);
    },

    // "putar nomor 2", from the last search. -> as playTrack, or { why: 'nothing' }
    // Your playlists, yours and the ones you follow. -> { ok, playlists: [{ uri, name }] } | { ok: false, why }
    async playlists() {
      const playlists = [];
      for (let offset = 0; offset < 200; offset += 50) {
        const res = await call('GET', `/me/playlists?limit=50&offset=${offset}`);
        if (!res.ok) return res;
        const items = (res.data?.items || []).filter(Boolean);
        playlists.push(...items.map((p) => ({ uri: p.uri, name: String(p.name || '') })));
        if (items.length < 50) break;
      }
      lastLists = playlists;
      return { ok: true, playlists };
    },

    async playContext(item) {
      const list = await call('GET', '/me/player/devices');
      if (!list.ok) return list;
      const device = pickDevice(list.data?.devices);
      if (!device) return { ok: false, why: 'nodevice' };
      const res = await call('PUT', `/me/player/play?device_id=${encodeURIComponent(device.id)}`, { context_uri: item.uri });
      return res.ok ? { ok: true, name: item.name, device: device.name } : res;
    },

    // One of your playlists by name; with no name, what you have. -> { ok, name } | { ok: false, why, playlists? }
    async playPlaylist(name) {
      const found = await spotify.playlists();
      if (!found.ok) return found;
      if (!found.playlists.length) return { ok: false, why: 'none' };
      const wanted = String(name || '').trim().toLowerCase();
      if (!wanted) return { ok: false, why: 'ask', playlists: found.playlists };
      const low = (p) => p.name.toLowerCase();
      const words = wanted.split(/\s+/);
      const item = found.playlists.find((p) => low(p) === wanted) || found.playlists.find((p) => low(p).includes(wanted)) || found.playlists.find((p) => words.every((w) => low(p).includes(w)));
      return item ? spotify.playContext(item) : { ok: false, why: 'notfound' };
    },

    playPicked(n) {
      if (lastLists) {
        const item = lastLists[n - 1];
        return item ? spotify.playContext(item) : Promise.resolve({ ok: false, why: 'nothing' });
      }
      const track = last[n - 1];
      return track ? spotify.playTrack(track) : Promise.resolve({ ok: false, why: 'nothing' });
    },
  };
  return spotify;
}

module.exports = { createSpotify, authorizeUrl, challengeOf, pickDevice, REDIRECT, SCOPES, PORT };

'use strict';

// Your own Spotify developer app: optional, the login, search, play, and what happens when it can't; Illustrator's names.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

require('./electron-stub');
const { createSpotify, authorizeUrl, challengeOf, pickDevice, REDIRECT } = require('../src/main/online/spotify-api');
const errands = require('../src/main/commands/errands');
const { check, decodeIds } = require('../scripts/check-blueprint');
const { scriptFor } = require('../scripts/export-ai');

const ID = 'a'.repeat(32);
const json = (body, status = 200) => ({ ok: status < 300, status, json: async () => body });

function api({ routes = {}, id = ID, token = 'refresh-1', port } = {}) {
  const state = { token, calls: [], opened: [] };
  const fetcher = async (url, init = {}) => {
    state.calls.push({ url: String(url), init });
    for (const [key, handler] of Object.entries(routes)) if (String(url).includes(key)) return handler(init, url);
    if (String(url).includes('/api/token')) return json({ access_token: 'access-1', expires_in: 3600, refresh_token: 'refresh-2' });
    if (String(url).includes('/search')) return json({ tracks: { items: [{ uri: 'spotify:track:1', name: 'Numb', artists: [{ name: 'Linkin Park' }] }, { uri: 'spotify:track:2', name: 'Faint', artists: [{ name: 'Linkin Park' }] }] } });
    if (String(url).includes('/devices')) return json({ devices: [{ id: 'pc', name: 'MY PC', type: 'Computer', is_active: false }] });
    if (String(url).includes('/me/player/play')) return { ok: true, status: 204, json: async () => null };
    return json({}, 500);
  };
  const s = createSpotify({ clientId: () => id, loadToken: () => state.token, saveToken: (t) => { state.token = t; }, open: (u) => state.opened.push(u), fetcher, port });
  return { s, state };
}

test('it is optional: no Client ID or no login, not connected', () => {
  assert.strictEqual(api({ id: '' }).s.connected(), false);
  assert.strictEqual(api({ token: '' }).s.connected(), false);
  assert.strictEqual(api().s.connected(), true);
  assert.strictEqual(api().s.validId('xyz'), false);
  assert.strictEqual(api().s.validId(ID), true);
});

test('the login page: PKCE, no secret, the registered address', () => {
  const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  assert.strictEqual(challengeOf(verifier), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM', 'the example from RFC 7636');
  const url = new URL(authorizeUrl({ clientId: ID, verifier, state: 'st' }));
  assert.strictEqual(url.hostname, 'accounts.spotify.com');
  assert.strictEqual(url.searchParams.get('code_challenge_method'), 'S256');
  assert.strictEqual(url.searchParams.get('redirect_uri'), REDIRECT);
  assert.match(REDIRECT, /^http:\/\/127\.0\.0\.1:/, 'Spotify refuses "localhost"');
  assert.strictEqual(url.searchParams.get('scope'), 'user-read-playback-state user-modify-playback-state playlist-read-private playlist-read-collaborative', 'playback and reading your playlists, nothing else');
  assert.ok(!url.searchParams.has('client_secret'));
});

async function loginFlow(callback) {
  const port = 47900 + crypto.randomInt(90);
  const { s, state } = api({ token: '', port });
  const done = s.login();
  while (!state.opened.length) await new Promise((r) => setTimeout(r, 5));
  const sent = new URL(state.opened[0]).searchParams.get('state');
  const res = await fetch(`http://127.0.0.1:${port}/spotify/callback?${callback(sent)}`).catch(() => null);
  return { res, result: await done, state };
}

test('login: the code comes back and is swapped for a token', async () => {
  const { res, result, state } = await loginFlow((st) => `code=abc&state=${st}`);
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(result, { ok: true });
  assert.strictEqual(state.token, 'refresh-2');
  const body = new URLSearchParams(state.calls[0].init.body);
  assert.strictEqual(body.get('grant_type'), 'authorization_code');
  assert.ok(body.get('code_verifier').length >= 43);
  assert.ok(!body.has('client_secret'));
});

test('login: anything that did not come from her own request is refused', async () => {
  const { res, result, state } = await loginFlow(() => 'code=abc&state=forged');
  assert.strictEqual(res.status, 400);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(state.token, '');
  assert.strictEqual(state.calls.length, 0, 'nothing swapped');
});

test('login: you said no on their page', async () => {
  const { result } = await loginFlow((st) => `error=access_denied&state=${st}`);
  assert.deepStrictEqual(result, { ok: false, why: 'denied' });
});

test('no valid Client ID: no login page', async () => {
  const { s, state } = api({ id: 'nope' });
  assert.deepStrictEqual(await s.login(), { ok: false, why: 'noid' });
  assert.deepStrictEqual(state.opened, []);
});

test('search, and playing what was found', async () => {
  const { s, state } = api();
  const found = await s.search('numb');
  assert.strictEqual(found.tracks[1].name, 'Faint');
  assert.match(state.calls.find((c) => c.url.includes('/search')).url, /type=track&limit=5/);
  assert.strictEqual(state.calls[0].url.includes('/api/token'), true, 'the token refreshed first');
  assert.strictEqual(state.token, 'refresh-2', 'a new refresh token is kept');
  const res = await s.playPicked(2);
  assert.deepStrictEqual(res, { ok: true, name: 'Faint', artist: 'Linkin Park', device: 'MY PC' });
  const play = state.calls.find((c) => c.url.includes('/me/player/play'));
  assert.match(play.url, /device_id=pc/);
  assert.deepStrictEqual(JSON.parse(play.init.body), { uris: ['spotify:track:2'] });
  assert.deepStrictEqual(await s.playPicked(9), { ok: false, why: 'nothing' });
});

test('never asks for more than Spotify allows in a search', async () => {
  const { s, state } = api();
  await s.search('x', 50);
  assert.match(state.calls.find((c) => c.url.includes('/search')).url, /limit=10/);
});

test('play and repeat is two commands, never a song to look for', () => {
  for (const said of ['Play and repeat the song.', 'play and repeat', 'play this song on repeat']) {
    const steps = errands.chain(said);
    assert.deepStrictEqual(steps?.map((s) => s.e.action), ['play', 'repeat-one'], said);
  }
  for (const said of ['play and repeat the song', 'putar dan ulang-ulang lagu ini']) assert.notStrictEqual(errands.parse(said).kind, 'song', said);
  assert.strictEqual(errands.parse('play Die For You').kind, 'song', 'a real title still is one');
});

test('your playlists, by name', async () => {
  const lists = { items: [{ uri: 'spotify:playlist:a', name: 'Chill Malam' }, { uri: 'spotify:playlist:b', name: 'Gym' }] };
  const { s, state } = api({ routes: { '/me/playlists': () => json(lists) } });
  assert.deepStrictEqual(await s.playPlaylist('chill'), { ok: true, name: 'Chill Malam', device: 'MY PC' });
  const sent = state.calls.find((c) => c.url.includes('/me/player/play'));
  assert.deepStrictEqual(JSON.parse(sent.init.body), { context_uri: 'spotify:playlist:a' });
  assert.strictEqual((await s.playPlaylist('nope')).why, 'notfound');
  const asked = await s.playPlaylist('');
  assert.strictEqual(asked.why, 'ask');
  assert.deepStrictEqual(asked.playlists.map((p) => p.name), ['Chill Malam', 'Gym']);
});

test('"putar nomor 2" means whatever she listed last', async () => {
  const lists = { items: [{ uri: 'spotify:playlist:a', name: 'Chill' }, { uri: 'spotify:playlist:b', name: 'Gym' }] };
  const { s } = api({ routes: { '/me/playlists': () => json(lists) } });
  await s.playlists();
  assert.strictEqual((await s.playPicked(2)).name, 'Gym');
  await s.search('numb');
  assert.ok((await s.playPicked(1)).artist, 'after a search, its songs');
});

test('connected before playlists existed: told to connect again, not that Premium is missing', async () => {
  const { s } = api({ routes: { '/me/playlists': () => json({ error: { status: 403, message: 'Insufficient client scope' } }, 403) } });
  assert.deepStrictEqual(await s.playlists(), { why: 'scope' });
});

test('when it can not: why, so she can do it the old way', async () => {
  assert.deepStrictEqual(await api({ routes: { '/me/player/play': () => json({}, 403) } }).s.playSong('x'), { why: 'premium' });
  assert.deepStrictEqual(await api({ routes: { '/devices': () => json({ devices: [] }) } }).s.playSong('x'), { ok: false, why: 'nodevice' });
  assert.deepStrictEqual(await api({ routes: { '/search': () => json({ tracks: { items: [] } }) } }).s.playSong('x'), { ok: false, why: 'notfound' });
  assert.deepStrictEqual(await api({ routes: { '/search': () => json({}, 429) } }).s.playSong('x'), { why: 'busy' });
});

test('a login taken back on Spotify\'s side: disconnected, log in again', async () => {
  const { s, state } = api({ routes: { '/api/token': () => json({ error: 'invalid_grant' }, 400) } });
  assert.deepStrictEqual(await s.search('x'), { why: 'login' });
  assert.strictEqual(state.token, '');
  assert.strictEqual(s.connected(), false);
});

test('which device: the one playing, else a computer, never a restricted one', () => {
  const d = (id, extra = {}) => ({ id, type: 'Smartphone', ...extra });
  assert.strictEqual(pickDevice([d('a'), d('b', { is_active: true })]).id, 'b');
  assert.strictEqual(pickDevice([d('a'), d('pc', { type: 'Computer' })]).id, 'pc');
  assert.strictEqual(pickDevice([d('a', { is_active: true, is_restricted: true }), d('b')]).id, 'b');
  assert.strictEqual(pickDevice([]), null);
});

test('one of what she found, by words', () => {
  assert.deepStrictEqual(errands.parse('putar nomor 2'), { kind: 'songPick', n: 2 });
  assert.deepStrictEqual(errands.parse('play number 3'), { kind: 'songPick', n: 3 });
  assert.strictEqual(errands.parse('putar lagu numb').kind, 'song');
});

test('the token is never handed to her settings window or an export', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'main', 'main.js'), 'utf8');
  assert.match(main, /const \{ apiKeys, \.\.\.cfg \} = config\.load\(\);[^\n]*\n\s*delete cfg\.spotifyToken;/, 'her windows');
  assert.match(main, /const \{ apiKeys, \.\.\.rest \} = config\.load\(\);[^\n]*\n\s*delete rest\.spotifyToken;/, 'an export');
  assert.match(main, /delete clean\.spotifyToken;/, 'and no window can set it');
});

test('names as Illustrator writes them', () => {
  assert.strictEqual(decodeIds('<g id="arm_x5F_L"/>'), '<g id="arm_L"/>');
  assert.strictEqual(decodeIds('<g id="head_1_"/>'), '<g id="head"/>');
  assert.strictEqual(decodeIds('<g id="form_x2D_full"/>'), '<g id="form-full"/>');
  assert.strictEqual(decodeIds('<g id="SVGID_1_"/><use href="#SVGID_1_"/>'), '<g id="SVGID_1_"/><use href="#SVGID_1_"/>', 'its own ids stay');
  assert.strictEqual(decodeIds('<g id="head"/><g id="head_1_"/>').match(/id="head"/g).length, 1, 'never two of a name');
  assert.strictEqual(check('<svg><g id="form_x2D_full"><g id="head"/><g id="torso"/><g id="arm_x5F_L"/><g id="arm_x5F_R"/><g id="leg_x5F_L"/><g id="leg_x5F_R"/></g><g id="form_x2D_mask"/></svg>').ok, true);
});

test('the Illustrator script: old JavaScript, and paths that can not become code', () => {
  const body = fs.readFileSync(path.join(__dirname, '..', 'tools', 'illustrator', 'export-layers.jsx'), 'utf8');
  const code = body.replace(/\/\/.*$/gm, '');
  assert.ok(!/\b(?:let|const)\s|=>|`/.test(code), 'ExtendScript is ES3');
  assert.doesNotThrow(() => new Function(body));
  const script = scriptFor({ file: 'C:/a"; alert(1); "/x.ai', out: 'C:/o', report: 'C:/r.json' }, '// body');
  assert.doesNotThrow(() => new Function(script));
  const CAPRI = new Function(`${script}\nreturn CAPRI_FILE;`)();
  assert.match(CAPRI, /a"; alert\(1\); "\/x\.ai$/, 'stayed a string');
});

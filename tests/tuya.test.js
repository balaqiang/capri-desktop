'use strict';

require('./electron-stub');
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const errands = require('../src/main/commands/errands');
const home = require('../src/main/commands/home');
const { createTuya, signature, pathWith, commandsFor, matchDevices, whyOf } = require('../src/main/online/tuya');

const lamp = (id, name, extra = {}) => ({ id, name, online: true, category: 'dj', status: { switch_led: true, bright_value_v2: 500, work_mode: 'white', colour_data_v2: { h: 0, s: 0, v: 0 }, temp_value_v2: 500, ...extra } });
const plug = (id, name) => ({ id, name, online: true, category: 'cz', status: { switch_1: true } });

test('signed the way Tuya checks it', () => {
  const secret = 'secret';
  const expected = (token, body) => crypto.createHmac('sha256', secret).update(`idA${token}123POST\n${crypto.createHash('sha256').update(body).digest('hex')}\n\n/v1/x?a=1&b=2`).digest('hex').toUpperCase();
  assert.equal(signature({ id: 'idA', secret, t: '123', method: 'POST', signed: '/v1/x?a=1&b=2', body: '{}' }), expected('', '{}'));
  assert.equal(signature({ id: 'idA', secret, token: 'tok', t: '123', method: 'POST', signed: '/v1/x?a=1&b=2', body: '{}' }), expected('tok', '{}'));
  assert.deepEqual(pathWith('/p', { z: 'a b', a: 1 }), { signed: '/p?a=1&z=a b', sent: '/p?a=1&z=a%20b' });
});

test('what she sends a lamp', () => {
  const l = lamp('1', 'Kamar');
  assert.deepEqual(commandsFor(l, { action: 'off' }), [{ code: 'switch_led', value: false }]);
  assert.deepEqual(commandsFor(l, { action: 'level', level: 100 }), [{ code: 'switch_led', value: true }, { code: 'bright_value_v2', value: 1000 }]);
  assert.deepEqual(commandsFor(l, { action: 'level', level: 0 }), [{ code: 'switch_led', value: false }], 'zero percent is off');
  assert.equal(commandsFor(l, { action: 'level', level: 50 }, { min: 0, max: 100 })[1].value, 50);
  assert.deepEqual(commandsFor(l, { action: 'color', color: { h: 240 } }), [{ code: 'switch_led', value: true }, { code: 'work_mode', value: 'colour' }, { code: 'colour_data_v2', value: { h: 240, s: 1000, v: 1000 } }]);
  assert.deepEqual(commandsFor(l, { action: 'white', temp: 0 }).at(-1), { code: 'temp_value_v2', value: 0 });
  assert.deepEqual(commandsFor(plug('2', 'P'), { action: 'on' }), [{ code: 'switch_1', value: true }]);
  assert.equal(commandsFor(plug('2', 'P'), { action: 'color', color: { h: 1 } }), null, 'a plug has no colors');
});

test('which device you mean', () => {
  const all = [lamp('1', 'Lampu Kamar'), lamp('2', 'Lampu Dapur'), lamp('3', 'Lampu Kamar Mandi'), plug('4', 'Colokan TV')];
  const ids = (r) => r.devices?.map((d) => d.id);
  assert.deepEqual(ids(matchDevices(all, 'kamar')), ['1'], 'the exact name first');
  assert.deepEqual(ids(matchDevices(all, 'bedroom')), ['1'], 'in the other language too');
  assert.deepEqual(ids(matchDevices(all, 'kitchen')), ['2']);
  assert.deepEqual(ids(matchDevices(all, 'tv', { noun: 'plug' })), ['4']);
  assert.equal(matchDevices(all, '').why, 'ask', 'several lamps and no name: she asks');
  assert.deepEqual(matchDevices(all, '').names, ['Lampu Kamar', 'Lampu Dapur', 'Lampu Kamar Mandi']);
  assert.deepEqual(ids(matchDevices(all, '', { every: true })), ['1', '2', '3'], 'all the lamps, not the plugs');
  assert.equal(matchDevices(all, 'garasi').why, 'none');
  assert.deepEqual(ids(matchDevices([lamp('9', 'Bardi Bulb')], '')), ['9'], 'only one: that one');
  assert.equal(matchDevices([], 'x').why, 'nodevices');
});

test('how you say it', () => {
  const p = (s) => { const e = errands.parse(s); return [e.kind, e.action, e.target, e.level ?? e.shade ?? (e.all ? 'all' : '')].join('|'); };
  assert.equal(p('matiin lampu kamar'), 'home|off|kamar|');
  assert.equal(p('nyalakan lampu di dapur'), 'home|on|dapur|');
  assert.equal(p('tolong matikan semua lampu'), 'home|off||all');
  assert.equal(p('turn off the bedroom light'), 'home|off|bedroom|');
  assert.equal(p('turn the kitchen lights on'), 'home|on|kitchen|');
  assert.equal(p('lights off'), 'home|off||');
  assert.equal(p('lampu kamar mati'), 'home|off|kamar|');
  assert.equal(p('lampu kamar nyala nggak'), 'home|status|kamar|');
  assert.equal(p('is the bedroom light on'), 'home|status|bedroom|');
  assert.equal(p('lampu kamar 50 persen'), 'home|level|kamar|50');
  assert.equal(p('redupkan lampu kamar'), 'home|level|kamar|25');
  assert.equal(p('set the desk light to 40%'), 'home|level|desk|40');
  assert.equal(p('lampu kamar warna biru'), 'home|color|kamar|biru');
  assert.equal(p('make the bedroom light red'), 'home|color|bedroom|red');
  assert.equal(p('lampu kamar jadi putih'), 'home|white|kamar|putih');
  assert.equal(errands.parse('matikan colokan tv').noun, 'plug');
});

test('other things stay what they were', () => {
  for (const s of ['matikan suara', 'turn off the music', 'lampu itu bagus ya', 'apa itu lampu pintar', 'open spotify', 'turn it up']) assert.notEqual(errands.parse(s).kind, 'home', s);
});

test('a device by the name you gave it, once she knows your devices', () => {
  assert.notEqual(errands.parse('matiin kipas').kind, 'home');
  home.setKnown(['Kipas']);
  assert.equal(errands.parse('matiin kipas').target, 'kipas');
  home.setKnown([]);
});

// a stand-in for Tuya's cloud that checks every signature
function cloud({ devices = [lamp('1', 'Lampu Kamar')], home: where = 'us', codes = {}, remotes = [], acState = { power: '0', mode: '0', temp: '26', wind: '0' }, fns = null } = {}) {
  const log = [];
  let n = 0;
  const reply = (o) => ({ json: async () => o });
  const fetcher = async (url, init) => {
    const u = new URL(url);
    log.push({ host: u.host, path: u.pathname, method: init.method, body: init.body });
    const signed = u.search ? `${u.pathname}?${decodeURIComponent(u.search.slice(1))}` : u.pathname;
    assert.equal(init.headers.sign, signature({ id: 'ID', secret: 'SEC', token: init.headers.access_token || '', t: init.headers.t, method: init.method, signed, body: init.body || '' }));
    if (u.pathname === '/v1.0/token') return reply({ success: true, result: { access_token: `tok${++n}`, expire_time: 7200 } });
    if (codes[u.pathname]?.length) return reply({ success: false, code: codes[u.pathname].shift() });
    if (u.pathname.endsWith('/associated-users/devices')) {
      const here = u.host.includes(where === 'us' ? 'tuyaus' : 'iotbing');
      return reply({ success: true, result: { devices: here ? devices.map((d) => ({ ...d, status: Object.entries(d.status).map(([code, value]) => ({ code, value })) })) : [], has_more: false } });
    }
    if (u.pathname.endsWith('/remotes')) return reply({ success: true, result: remotes });
    if (u.pathname.endsWith('/ac/status')) return reply({ success: true, result: acState });
    if (u.pathname.endsWith('/functions') && fns) return reply({ success: true, result: { functions: fns } });
    if (u.pathname.endsWith('/functions')) return reply({ success: true, result: { functions: [{ code: 'bright_value_v2', values: '{"min":10,"max":1000}' }] } });
    return reply({ success: true, result: true });
  };
  return { fetcher, log };
}
const creds = (region = '') => () => ({ id: 'ID', secret: 'SEC', region });

test('it finds the data center that has your devices, and remembers it', async () => {
  const { fetcher, log } = cloud();
  let saved = '';
  const names = [];
  const t = createTuya({ creds: creds(), fetcher, saveRegion: (r) => { saved = r; }, onDevices: (n) => names.push(...n) });
  const res = await t.status();
  assert.equal(res.ok, true);
  assert.equal(saved, 'us');
  assert.deepEqual(names, ['Lampu Kamar']);
  assert.deepEqual(res.devices, [{ id: '1', name: 'Lampu Kamar', online: true, lamp: true, ac: false }]);
  assert.ok(log.some((l) => l.host === 'openapi-sg.iotbing.com'), 'it tried the nearest first');
});

test('a command goes out, signed, and she reports what really happened', async () => {
  const { fetcher, log } = cloud();
  const t = createTuya({ creds: creds('us'), fetcher });
  const res = await t.act({ action: 'off', target: 'kamar', noun: 'lamp' });
  assert.deepEqual(res, { ok: true, names: ['Lampu Kamar'] });
  const sent = log.find((l) => l.method === 'POST');
  assert.equal(sent.path, '/v1.0/iot-03/devices/1/commands');
  assert.deepEqual(JSON.parse(sent.body), { commands: [{ code: 'switch_led', value: false }] });
});

test('nothing is claimed that did not happen', async () => {
  const off = createTuya({ creds: creds('us'), fetcher: cloud({ devices: [{ ...lamp('1', 'Lampu Kamar'), online: false }] }).fetcher });
  assert.equal((await off.act({ action: 'off', target: 'kamar', noun: 'lamp' })).why, 'offline');
  const failed = createTuya({ creds: creds('us'), fetcher: cloud({ codes: { '/v1.0/iot-03/devices/1/commands': [2008] } }).fetcher });
  assert.equal((await failed.act({ action: 'off', target: 'kamar', noun: 'lamp' })).ok, false);
  const none = createTuya({ creds: creds('us'), fetcher: cloud().fetcher });
  assert.equal((await none.act({ action: 'off', target: 'garasi', noun: 'lamp' })).why, 'none');
  const unset = createTuya({ creds: () => ({ id: '', secret: '', region: '' }), fetcher: async () => assert.fail('no request without keys') });
  assert.equal((await unset.status()).why, 'notset');
  assert.equal(unset.ready(), false);
});

test('an expired token is renewed once', async () => {
  const c = cloud({ codes: { '/v1.0/iot-01/associated-users/devices': [1010] } });
  const t = createTuya({ creds: creds('us'), fetcher: c.fetcher });
  assert.equal((await t.status()).ok, true);
  assert.equal(c.log.filter((l) => l.path === '/v1.0/token').length, 2);
  assert.equal(whyOf(1004), 'badkey');
  assert.equal(whyOf(28841002), 'expired');
});

const blaster = { id: 'hub1', name: 'IR Blaster', online: true, category: 'wnykq', status: {} };
const remote = { remote_id: 'ac9', remote_name: 'AC Kamar', category_id: 5 };

test('a light has modes', () => {
  const l = lamp('1', 'Kamar', { scene_data_v2: {} });
  const read = commandsFor(l, { action: 'scene', scene: 'read' });
  assert.deepEqual(read.slice(0, 2), [{ code: 'switch_led', value: true }, { code: 'work_mode', value: 'scene' }]);
  assert.equal(read[2].code, 'scene_data_v2');
  assert.equal(read[2].value.scene_units[0].bright, 1000);
  const party = commandsFor(l, { action: 'scene', scene: 'party' })[2].value;
  assert.equal(party.scene_units[0].unit_change_mode, 'jump');
  assert.ok(party.scene_units.length > 1);
  assert.equal(commandsFor(lamp('2', 'Tanpa'), { action: 'scene', scene: 'read' }), null, 'one that has no modes says so');
  assert.deepEqual(commandsFor(l, { action: 'scene', scene: 'music' }).at(-1), { code: 'work_mode', value: 'music' });
});

test('how you say modes and the air conditioner', () => {
  const p = (s) => { const e = errands.parse(s); return [e.kind, e.noun, e.action, e.target, e.temp ?? e.mode ?? e.fan ?? e.scene ?? e.shade ?? e.delta ?? ''].join('|'); };
  assert.equal(p('lampu kamar mode baca'), 'home|lamp|scene|kamar|read');
  assert.equal(p('ganti mode lampu ke santai'), 'home|lamp|scene||relax');
  assert.equal(p('set the bedroom light to party mode'), 'home|lamp|scene|bedroom|party');
  assert.equal(p('ganti mode lampu ke red'), 'home|lamp|color||red');
  assert.equal(p('lampu kamar mode merah'), 'home|lamp|color|kamar|merah');
  assert.equal(p('ubah lampu ke biru muda'), 'home|lamp|color||biru muda');
  assert.notEqual(errands.parse('matiin lampu tidur').action, 'scene', 'a bedside lamp is not a mode');
  assert.equal(p('nyalakan ac'), 'home|ac|on||');
  assert.equal(p('matiin ac kamar'), 'home|ac|off|kamar|');
  assert.equal(p('turn off the ac'), 'home|ac|off||');
  assert.equal(p('ac 24 derajat'), 'home|ac|temp||24');
  assert.equal(p('set ac ke 18'), 'home|ac|temp||18');
  assert.equal(p('suhu ac kamar 22'), 'home|ac|temp|kamar|22');
  assert.equal(p('set the ac to 25 degrees'), 'home|ac|temp||25');
  assert.equal(p('naikkan suhu ac'), 'home|ac|tempStep||1');
  assert.equal(p('ac lebih dingin'), 'home|ac|tempStep||-1');
  assert.equal(p('ac mode kering'), 'home|ac|acMode||dry');
  assert.equal(p('ganti ac ke mode kipas'), 'home|ac|acMode||fan');
  assert.equal(p('set the ac to cool mode'), 'home|ac|acMode||cool');
  assert.equal(p('kipas ac kencang'), 'home|ac|fan||high');
  assert.equal(p('ac kamar kipas pelan'), 'home|ac|fan|kamar|low');
  assert.equal(p('suhu ac berapa'), 'home|ac|status||');
  for (const s of ['accu mobil rusak', 'matikan suara']) assert.notEqual(errands.parse(s).noun, 'ac', s);
});

test('an AC through an IR blaster: found by itself, the whole state sent at once', async () => {
  const c = cloud({ devices: [lamp('1', 'Lampu'), blaster], remotes: [remote, { remote_id: 'tv1', remote_name: 'TV', category_id: 2 }] });
  const t = createTuya({ creds: creds('us'), fetcher: c.fetcher });
  const res = await t.act({ action: 'temp', temp: 22, noun: 'ac', target: '' });
  assert.equal(res.ok, true);
  assert.equal(res.temp, 22);
  const sent = c.log.find((l) => l.path.endsWith('/scenes/command'));
  assert.equal(sent.path, '/v2.0/infrareds/hub1/air-conditioners/ac9/scenes/command');
  assert.deepEqual(JSON.parse(sent.body), { power: 1, mode: 0, temp: 22, wind: 0 });
  assert.equal((await t.act({ action: 'on', noun: 'ac', target: 'kamar' })).ok, true);
  assert.deepEqual(JSON.parse(c.log.find((l) => l.path.endsWith('/command') && !l.path.includes('scenes') && l.path.includes('air-conditioners')).body), { code: 'power', value: 1 });
  const hot = await t.act({ action: 'temp', temp: 40, noun: 'ac', target: '' });
  assert.deepEqual([hot.temp, hot.clamped, hot.high], [30, true, 30], 'and it says when it could not');
  const mode = await t.act({ action: 'acMode', mode: 'dry', noun: 'ac', target: '' });
  assert.equal(mode.ok, true);
  assert.equal(JSON.parse(c.log.filter((l) => l.path.endsWith('/scenes/command')).at(-1).body).mode, 4);
  const step = await t.act({ action: 'tempStep', delta: 1, noun: 'ac', target: '' });
  assert.equal(step.temp, 27, 'one up from what it was last told');
  const names = (await t.status()).devices.map((d) => [d.name, d.ac]);
  assert.deepEqual(names, [['Lampu', false], ['AC Kamar', true]]);
});

test('an AC on Wi-Fi: in the words and the range it says it has', async () => {
  const wifi = { id: 'k1', name: 'AC Tamu', online: true, category: 'kt', status: { switch: false, temp_set: 240, mode: 'cold', windspeed: 'low' } };
  const fns = [{ code: 'temp_set', values: '{"min":160,"max":300,"scale":1,"step":10}' }, { code: 'mode', values: '{"range":["cold","hot","wet","wind","auto"]}' }, { code: 'windspeed', values: '{"range":["low","mid","high"]}' }];
  const c = cloud({ devices: [wifi], fns });
  const t = createTuya({ creds: creds('us'), fetcher: c.fetcher });
  const last = () => JSON.parse(c.log.filter((l) => l.method === 'POST').at(-1).body).commands;
  assert.equal((await t.act({ action: 'temp', temp: 20, noun: 'ac', target: '' })).temp, 20);
  assert.deepEqual(last(), [{ code: 'switch', value: true }, { code: 'temp_set', value: 200 }]);
  await t.act({ action: 'acMode', mode: 'dry', noun: 'ac', target: '' });
  assert.deepEqual(last().at(-1), { code: 'mode', value: 'wet' });
  await t.act({ action: 'fan', fan: 'high', noun: 'ac', target: '' });
  assert.deepEqual(last().at(-1), { code: 'windspeed', value: 'high' });
  assert.equal((await t.act({ action: 'temp', temp: 10, noun: 'ac', target: '' })).clamped, true);
  assert.equal((await t.act({ action: 'acMode', mode: 'heat', noun: 'ac', target: 'garasi' })).why, 'none');
});

test('no AC, or the IR service missing: she says which', async () => {
  const none = createTuya({ creds: creds('us'), fetcher: cloud().fetcher });
  assert.equal((await none.act({ action: 'on', noun: 'ac', target: '' })).why, 'noac');
  const c = cloud({ devices: [lamp('1', 'L'), blaster], codes: { '/v2.0/infrareds/hub1/remotes': [1106] } });
  const refused = createTuya({ creds: creds('us'), fetcher: c.fetcher });
  assert.equal((await refused.act({ action: 'on', noun: 'ac', target: '' })).why, 'noir');
});

test('only things with a power switch are hers to touch', async () => {
  const lock = { id: '7', name: 'Pintu', online: true, category: 'ms', status: { unlock_key: 0 } };
  const t = createTuya({ creds: creds('us'), fetcher: cloud({ devices: [lock, lamp('1', 'Lampu')] }).fetcher });
  assert.deepEqual((await t.status()).devices.map((d) => d.name), ['Lampu']);
});

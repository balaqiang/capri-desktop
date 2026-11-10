'use strict';

// Your smart lights, plugs and air conditioner (Bardi and other Tuya-based devices), through your own Tuya cloud project. Her settings hold your Access ID and
// Access Secret (encrypted, never shown again); nothing but these requests goes to Tuya. Only things that plainly switch on and off are hers to
// touch: a device without a power switch (a lock, a sensor) never shows up here.

const crypto = require('node:crypto');

const HOSTS = {
  sg: 'openapi-sg.iotbing.com',
  us: 'openapi.tuyaus.com',
  'us-e': 'openapi-ueaz.tuyaus.com',
  eu: 'openapi.tuyaeu.com',
  'eu-w': 'openapi-weaz.tuyaeu.com',
  in: 'openapi.tuyain.com',
  cn: 'openapi.tuyacn.com',
};
const REGIONS = Object.keys(HOSTS);
const LIST_FOR = 30000; // how long what she knows about your devices stays good
const MAX_PAGES = 10;
const LAMP_KINDS = new Set(['dj', 'dd', 'xdd', 'fwd', 'dc', 'fsd', 'tyndj', 'tgq', 'gyd']);
const EXPIRED = new Set([28841002, 28841004, 28841101, 28841105]);
const IR_HUBS = new Set(['wnykq', 'hwktwkq']);
const AC_KINDS = new Set(['kt', 'ktkzq', 'infrared_ac']);
// an air conditioner through an IR blaster: what Tuya calls each thing
const IR_MODES = { cool: 0, heat: 1, auto: 2, fan: 3, dry: 4 };
const IR_WINDS = { auto: 0, low: 1, mid: 2, high: 3 };
const IR_NAMES = Object.fromEntries(Object.entries(IR_MODES).map(([k, v]) => [v, k]));
const AC_LOW = 16;
const AC_HIGH = 30;
// on Wi-Fi each maker has its own words for them
const MODE_WORDS = { cool: ['cold', 'cool', 'cooling'], heat: ['hot', 'heat', 'heating'], dry: ['wet', 'dry', 'dehumidify', 'dehumidification'], fan: ['wind', 'fan', 'fan_only', 'blow'], auto: ['auto', 'automatic'] };
const FAN_WORDS = { low: ['low', 'low_speed', 'level_1', '1', 'slow'], mid: ['mid', 'middle', 'medium', 'level_2', '2'], high: ['high', 'high_speed', 'level_3', '3', 'strong'], auto: ['auto'] };

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// Keys in alphabetical order, as Tuya signs them. -> { signed, sent }: unescaped for the signature, escaped for the address.
function pathWith(path, query = {}) {
  const keys = Object.keys(query).sort();
  if (!keys.length) return { signed: path, sent: path };
  return {
    signed: `${path}?${keys.map((k) => `${k}=${query[k]}`).join('&')}`,
    sent: `${path}?${keys.map((k) => `${k}=${encodeURIComponent(query[k])}`).join('&')}`,
  };
}

function signature({ id, secret, token = '', t, method, signed, body = '' }) {
  const text = `${id}${token}${t}${method}\n${sha256(body)}\n\n${signed}`;
  return crypto.createHmac('sha256', secret).update(text).digest('hex').toUpperCase();
}

function whyOf(code) {
  if (code === 1004) return 'badkey';
  if (code === 1106) return 'noaccess';
  if (EXPIRED.has(code)) return 'expired';
  if (code === 2008 || code === 2009) return 'unsupported';
  return 'failed';
}

function powerCodes(status) {
  if ('switch_led' in status) return ['switch_led'];
  if ('switch' in status) return ['switch'];
  return Object.keys(status).filter((c) => /^switch_\d+$/.test(c)).sort();
}

const isLamp = (d) => 'switch_led' in d.status || LAMP_KINDS.has(d.category);

// Which of a device's own words means this. -> its word, or undefined
function wordFor(range, words) {
  const list = Array.isArray(range) ? range : [];
  return list.find((r) => words.includes(String(r).toLowerCase()));
}

const white = (top, bright, temp) => ({ unit_change_mode: 'static', unit_switch_duration: 14, unit_gradient_duration: 14, bright: Math.round(top * bright), temperature: Math.round(top * temp), h: 0, s: 0, v: 0 });
const hue = (top, h, how, speed) => ({ unit_change_mode: how, unit_switch_duration: speed, unit_gradient_duration: speed, bright: 0, temperature: 0, h, s: top, v: top });
const RAINBOW = [0, 60, 120, 180, 240, 300];
// What each mode of a light looks like. top: the device's largest value.
const SCENES = {
  night: { num: 1, units: (top) => [white(top, 0.1, 0)] },
  read: { num: 2, units: (top) => [white(top, 1, 0.5)] },
  work: { num: 3, units: (top) => [white(top, 1, 1)] },
  relax: { num: 4, units: (top) => [white(top, 0.5, 0.2)] },
  soft: { num: 5, units: (top) => [280, 320, 200].map((h) => hue(top, h, 'gradient', 60)) },
  rainbow: { num: 6, units: (top) => RAINBOW.map((h) => hue(top, h, 'gradient', 40)) },
  party: { num: 7, units: (top) => RAINBOW.map((h) => hue(top, h, 'jump', 10)) },
};

function brief(raw) {
  const status = Object.fromEntries((raw.status || []).map((s) => [s.code, s.value]));
  return { id: String(raw.id), name: String(raw.name || raw.custom_name || raw.product_name || raw.id), online: raw.online !== false, category: String(raw.category || ''), gateway: String(raw.gateway_id || ''), status };
}

const COLOR_DEFAULT = { h: 0, s: 1000, v: 1000 };

// What to send a device for what you asked. range: { min, max } of its brightness, if known. -> [{ code, value }], or null if it can't.
function commandsFor(device, { action, level, color, temp, scene }, range = null) {
  const { status } = device;
  const power = powerCodes(status);
  if (action === 'on' || action === 'off') return power.map((code) => ({ code, value: action === 'on' }));
  if (!power.length || !('switch_led' in status)) return null;
  const on = { code: 'switch_led', value: true };
  const mode = (m) => ('work_mode' in status ? [{ code: 'work_mode', value: m }] : []);
  if (action === 'level') {
    if (level <= 0) return [{ code: 'switch_led', value: false }];
    const code = ['bright_value_v2', 'bright_value'].find((c) => c in status);
    if (!code) return null;
    const { min, max } = range || (code === 'bright_value_v2' ? { min: 10, max: 1000 } : { min: 25, max: 255 });
    const value = Math.round(min + ((max - min) * Math.min(100, level)) / 100);
    return [on, ...(status.work_mode === 'colour' ? mode('white') : []), { code, value }];
  }
  if (action === 'color') {
    if ('colour_data_v2' in status) return [on, ...mode('colour'), { code: 'colour_data_v2', value: { ...COLOR_DEFAULT, h: color.h } }];
    if ('colour_data' in status) return [on, ...mode('colour'), { code: 'colour_data', value: { h: color.h, s: 255, v: 255 } }];
    return null;
  }
  if (action === 'scene') {
    if (scene === 'music') return 'work_mode' in status ? [on, ...mode('music')] : null;
    const code = ['scene_data_v2', 'scene_data'].find((c) => c in status);
    const preset = SCENES[scene];
    if (!code || !preset) return null;
    return [on, ...mode('scene'), { code, value: { scene_num: preset.num, scene_units: preset.units(code === 'scene_data_v2' ? 1000 : 255) } }];
  }
  if (action === 'white') {
    const code = ['temp_value_v2', 'temp_value'].find((c) => c in status);
    if (!code && !('work_mode' in status)) return null;
    const top = code === 'temp_value_v2' ? 1000 : 255;
    return [on, ...mode('white'), ...(code && Number.isFinite(temp) ? [{ code, value: Math.round(top * temp) }] : [])];
  }
  return null;
}

const SAME = [['kamar tidur', 'bedroom'], ['kamar', 'bedroom'], ['ruang tamu', 'living room'], ['dapur', 'kitchen'], ['kamar mandi', 'bathroom'], ['teras', 'terrace'], ['garasi', 'garage'], ['meja', 'desk']];
const NOISE = /\b(?:lampu|lamps?|lights?|bohlam|bulb|smart|bardi|the|my|di|yang|stop ?kontak|colokan|saklar|plugs?|sockets?|switch|ac|air|conditioner|aircon|pendingin|ruangan)\b/g;
const wordsOf = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, ' ').replace(NOISE, ' ').split(/\s+/).filter(Boolean);

// A room said in the other language counts: "bedroom" finds "Lampu Kamar".
function spellings(target) {
  const said = String(target || '').toLowerCase();
  const out = [said];
  for (const [id, en] of SAME) {
    if (said.includes(en)) out.push(said.replace(en, id));
    if (said.includes(id)) out.push(said.replace(id, en));
  }
  return out;
}

// Which devices you mean. -> { devices } or { why: 'ask', names } or { why: 'none' | 'nodevices' }
function matchDevices(all, target, { every = false, noun = 'lamp' } = {}) {
  if (!all.length) return { why: 'nodevices' };
  const kind = all.filter((d) => (noun === 'plug' ? !isLamp(d) : isLamp(d)));
  const pool = kind.length ? kind : all;
  if (every) return { devices: pool };
  const wanted = spellings(target).map(wordsOf).filter((w) => w.length);
  if (!wanted.length) return pool.length === 1 ? { devices: pool } : { why: 'ask', names: pool.map((d) => d.name) };
  for (const words of wanted) {
    const same = all.filter((d) => wordsOf(d.name).join(' ') === words.join(' '));
    if (same.length) return { devices: same };
  }
  for (const words of wanted) {
    const near = all.filter((d) => {
      const name = wordsOf(d.name);
      return words.every((w) => name.some((n) => n === w || n.includes(w)));
    });
    if (near.length) return { devices: near };
  }
  return { why: 'none' };
}

// creds() -> { id, secret, region }. saveRegion(r): the data center that turned out to have your devices. onDevices(names): for her commands.
function createTuya({ creds, saveRegion = () => {}, onDevices = () => {}, fetcher = (url, init) => fetch(url, init), now = () => Date.now() }) {
  const tokens = new Map();
  const ranges = new Map();
  let known = null; // { at, devices, region }
  let lastKey = '';

  const signedIn = () => {
    const c = creds();
    const key = `${c.id}:${c.secret}`;
    if (key !== lastKey) {
      lastKey = key;
      tokens.clear();
      known = null;
    }
    return c;
  };

  async function raw(region, method, path, { query, body, token = '' } = {}) {
    const { id, secret } = signedIn();
    const t = String(now());
    const text = body ? JSON.stringify(body) : '';
    const { signed, sent } = pathWith(path, query);
    const headers = { client_id: id, sign: signature({ id, secret, token, t, method, signed, body: text }), t, sign_method: 'HMAC-SHA256', 'content-type': 'application/json', ...(token && { access_token: token }) };
    const res = await fetcher(`https://${HOSTS[region]}${sent}`, { method, headers, ...(text && { body: text }) });
    return res.json();
  }

  async function tokenFor(region) {
    const have = tokens.get(region);
    if (have && have.until > now()) return { token: have.token };
    const res = await raw(region, 'GET', '/v1.0/token', { query: { grant_type: 1 } });
    if (!res?.success) return { why: whyOf(res?.code) };
    tokens.set(region, { token: res.result.access_token, until: now() + (Number(res.result.expire_time) - 60) * 1000 });
    return { token: res.result.access_token };
  }

  async function call(region, method, path, options = {}, retry = true) {
    const got = await tokenFor(region);
    if (got.why) return { ok: false, why: got.why };
    const res = await raw(region, method, path, { ...options, token: got.token });
    if (res?.success) return { ok: true, result: res.result };
    if ((res?.code === 1010 || res?.code === 1011) && retry) {
      tokens.delete(region);
      return call(region, method, path, options, false);
    }
    return { ok: false, why: whyOf(res?.code) };
  }

  async function listFrom(region) {
    const out = [];
    const query = { size: 50 };
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await call(region, 'GET', '/v1.0/iot-01/associated-users/devices', { query });
      if (!res.ok) return res;
      out.push(...(res.result?.devices || []).map(brief));
      if (!res.result?.has_more || !res.result?.last_row_key) break;
      query.last_row_key = res.result.last_row_key;
    }
    return { ok: true, devices: out };
  }

  // Your air conditioners: on Wi-Fi, or as remotes of an IR blaster.
  async function airCons(region, all) {
    const out = all.filter((d) => d.category === 'kt' || d.category === 'ktkzq' || ('temp_set' in d.status && 'mode' in d.status)).map((d) => ({ ...d, via: 'wifi' }));
    const hubs = all.filter((d) => IR_HUBS.has(d.category));
    let refused = false;
    for (const hub of hubs) {
      const res = await call(region, 'GET', `/v2.0/infrareds/${hub.id}/remotes`);
      if (!res.ok) refused = true;
      for (const r of res.result || []) {
        if (Number(r.category_id) === 5) out.push({ id: String(r.remote_id), name: String(r.remote_name || hub.name), online: hub.online, category: 'infrared_ac', status: {}, via: 'ir', hub: hub.id });
      }
    }
    // the same remotes, as Tuya lists them under the blaster
    for (const d of all.filter((x) => x.category === 'infrared_ac')) {
      const hub = d.gateway || (hubs.length === 1 ? hubs[0].id : '');
      const had = out.find((o) => o.id === d.id);
      if (had) had.name = d.name;
      else if (hub) out.push({ ...d, via: 'ir', hub });
    }
    return { acs: out, refused: refused && !out.length };
  }

  // Your devices, from the data center that has them. You don't have to know which one that is.
  async function devices({ fresh = false } = {}) {
    const c = signedIn();
    if (!c.id || !c.secret) return { ok: false, why: 'notset' };
    if (!fresh && known && now() - known.at < LIST_FOR) return { ok: true, devices: known.devices, acs: known.acs, refused: known.refused, region: known.region };
    let problem = 'nodevices';
    for (const region of c.region && HOSTS[c.region] ? [c.region] : REGIONS) {
      const res = await listFrom(region);
      if (res.ok && res.devices.length) {
        const { acs, refused } = await airCons(region, res.devices);
        const plain = res.devices.filter((d) => powerCodes(d.status).length && !AC_KINDS.has(d.category) && !acs.some((a) => a.id === d.id));
        known = { at: now(), devices: plain, acs, refused, region };
        if (region !== c.region) saveRegion(region);
        onDevices([...plain, ...acs].map((d) => d.name));
        return { ok: true, devices: plain, acs, refused, region };
      }
      if (!res.ok && res.why !== 'noaccess') problem = res.why;
      if (res.why === 'badkey' || res.why === 'expired') break;
    }
    return { ok: false, why: problem };
  }

  // What a device says each setting can be: { code: values }
  async function functionsOf(region, device) {
    if (ranges.has(`fn:${device.id}`)) return ranges.get(`fn:${device.id}`);
    const res = await call(region, 'GET', `/v1.0/devices/${device.id}/functions`);
    const out = {};
    for (const f of res.ok ? res.result?.functions || [] : []) {
      try {
        out[f.code] = JSON.parse(f.values || '{}');
      } catch {
        out[f.code] = {};
      }
    }
    ranges.set(`fn:${device.id}`, out);
    return out;
  }

  // An air conditioner through an IR blaster. It has no way of telling what it's doing: this is what it was last told.
  async function viaIr(region, d, e) {
    const air = `/v2.0/infrareds/${d.hub}/air-conditioners/${d.id}`;
    if (e.action === 'on' || e.action === 'off') return call(region, 'POST', `${air}/command`, { body: { code: 'power', value: e.action === 'on' ? 1 : 0 } });
    const read = await call(region, 'GET', `/v2.0/infrareds/${d.hub}/remotes/${d.id}/ac/status`);
    const was = read.ok ? read.result || {} : {};
    const state = { power: Number(was.power) || 0, mode: Number.isFinite(Number(was.mode)) && was.mode !== undefined && was.mode !== '' ? Number(was.mode) : IR_MODES.cool, temp: Number(was.temp) || 24, wind: Number(was.wind) || 0 };
    if (e.action === 'status') return read.ok ? { ok: true, on: Boolean(state.power), temp: state.temp, mode: IR_NAMES[state.mode] } : read;
    const next = { ...state, power: 1 };
    let clamped = false;
    if (e.action === 'temp' || e.action === 'tempStep') {
      const wanted = e.action === 'temp' ? e.temp : state.temp + e.delta;
      next.temp = Math.max(AC_LOW, Math.min(AC_HIGH, wanted));
      clamped = next.temp !== wanted;
    } else if (e.action === 'acMode') next.mode = IR_MODES[e.mode];
    else if (e.action === 'fan') next.wind = IR_WINDS[e.fan];
    const res = await call(region, 'POST', `${air}/scenes/command`, { body: next });
    return res.ok ? { ok: true, temp: next.temp, clamped, low: AC_LOW, high: AC_HIGH } : res;
  }

  // An air conditioner on Wi-Fi, which says for itself what it can do.
  async function viaWifi(region, d, e) {
    const { status } = d;
    if (e.action === 'on' || e.action === 'off') return send(region, d, commandsFor(d, e));
    const fns = await functionsOf(region, d);
    const code = 'temp_set' in status ? 'temp_set' : 'temp_set' in fns ? 'temp_set' : '';
    const scale = 10 ** Number(fns[code]?.scale || 0);
    const current = code && Number.isFinite(status[code]) ? status[code] / scale : 24;
    if (e.action === 'status') return { ok: true, on: powerCodes(status).some((c) => status[c]), temp: current, mode: Object.keys(MODE_WORDS).find((k) => MODE_WORDS[k].includes(String(status.mode).toLowerCase())) };
    const power = powerCodes(status).map((c) => ({ code: c, value: true }));
    if (e.action === 'temp' || e.action === 'tempStep') {
      if (!code) return { ok: false, why: 'unsupported' };
      const low = Number.isFinite(fns[code]?.min) ? fns[code].min / scale : AC_LOW;
      const high = Number.isFinite(fns[code]?.max) ? fns[code].max / scale : AC_HIGH;
      const wanted = e.action === 'temp' ? e.temp : current + e.delta;
      const temp = Math.max(low, Math.min(high, wanted));
      const res = await send(region, d, [...power, { code, value: Math.round(temp * scale) }]);
      return res.ok ? { ok: true, temp, clamped: temp !== wanted, low, high } : res;
    }
    if (e.action === 'acMode') {
      const value = wordFor(fns.mode?.range, MODE_WORDS[e.mode]);
      return value ? send(region, d, [...power, { code: 'mode', value }]) : { ok: false, why: 'unsupported' };
    }
    const fan = ['fan_speed_enum', 'windspeed', 'fan_speed', 'wind'].find((c) => c in fns);
    const value = fan && wordFor(fns[fan]?.range, FAN_WORDS[e.fan]);
    return value ? send(region, d, [...power, { code: fan, value }]) : { ok: false, why: 'unsupported' };
  }

  async function actOnAc(listed, e) {
    if (!listed.acs.length) return { ok: false, why: listed.refused ? 'noir' : 'noac' };
    const found = matchDevices(listed.acs, e.target, { every: e.all, noun: 'plug' });
    if (found.why) return { ok: false, why: found.why, names: found.names };
    const names = found.devices.map((d) => d.name);
    const online = found.devices.filter((d) => d.online);
    if (!online.length) return { ok: false, why: 'offline', names };
    const results = await Promise.all(online.map((d) => (d.via === 'ir' ? viaIr(listed.region, d, e) : viaWifi(listed.region, d, e))));
    const first = results.find((r) => r.ok);
    if (!first) return { ok: false, why: results[0].why === 'noaccess' ? 'noir' : results[0].why, names };
    return { ...first, ok: true, names };
  }

  async function brightnessRange(region, device) {
    if (ranges.has(device.id)) return ranges.get(device.id);
    const res = await call(region, 'GET', `/v1.0/devices/${device.id}/functions`);
    const fn = res.ok && (res.result?.functions || []).find((f) => /^bright_value/.test(f.code));
    let range = null;
    try {
      const { min, max } = JSON.parse(fn?.values || '{}');
      if (Number.isFinite(min) && Number.isFinite(max) && max > min) range = { min, max };
    } catch { /* then the usual values */ }
    ranges.set(device.id, range);
    return range;
  }

  async function send(region, device, commands) {
    const res = await call(region, 'POST', `/v1.0/iot-03/devices/${device.id}/commands`, { body: { commands } });
    if (res.ok) for (const { code, value } of commands) device.status[code] = value;
    return res;
  }

  return {
    ready() {
      const c = signedIn();
      return Boolean(c.id && c.secret);
    },

    // For her settings: no keys, just what's there.
    async status() {
      const res = await devices({ fresh: true });
      if (!res.ok) return res;
      return { ok: true, region: res.region, refused: res.refused, devices: [...res.devices, ...res.acs].map((d) => ({ id: d.id, name: d.name, online: d.online, lamp: isLamp(d), ac: Boolean(d.via) })) };
    },

    async setPower(id, on) {
      const res = await devices();
      if (!res.ok) return res;
      const ac = res.acs.find((d) => d.id === id);
      if (ac) return ac.via === 'ir' ? viaIr(res.region, ac, { action: on ? 'on' : 'off' }) : viaWifi(res.region, ac, { action: on ? 'on' : 'off' });
      const device = res.devices.find((d) => d.id === id);
      if (!device) return { ok: false, why: 'none' };
      return send(res.region, device, commandsFor(device, { action: on ? 'on' : 'off' }));
    },

    // What you asked for (commands/home.js). -> { ok, names, on? } | { ok: false, why, names? }
    async act(e) {
      const res = await devices({ fresh: e.action === 'status' && e.noun !== 'ac' });
      if (!res.ok) return res;
      if (e.noun === 'ac') return actOnAc(res, e);
      const found = matchDevices(res.devices, e.target, { every: e.all, noun: e.noun });
      if (found.why) return { ok: false, why: found.why, names: found.names };
      const names = found.devices.map((d) => d.name);
      if (e.action === 'status') return { ok: true, names, on: found.devices.some((d) => powerCodes(d.status).some((c) => d.status[c])) };
      const online = found.devices.filter((d) => d.online);
      if (!online.length) return { ok: false, why: 'offline', names };
      let can = 0;
      const results = await Promise.all(online.map(async (device) => {
        const range = e.action === 'level' ? await brightnessRange(res.region, device) : null;
        const commands = commandsFor(device, e, range);
        if (!commands?.length) return { ok: false, why: 'unsupported', device };
        can++;
        return { ...(await send(res.region, device, commands)), device };
      }));
      const worked = results.filter((r) => r.ok);
      if (worked.length) return { ok: true, names: worked.map((r) => r.device.name) };
      return { ok: false, why: can ? results[0].why : 'unsupported', names };
    },
  };
}

module.exports = { createTuya, signature, pathWith, commandsFor, matchDevices, powerCodes, isLamp, whyOf, wordFor, HOSTS, REGIONS };

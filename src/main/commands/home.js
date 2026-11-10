'use strict';

// Your lights, plugs and air conditioner: "matiin lampu kamar", "turn off the bedroom light", "lampu 30 persen", "lampu kamar warna biru",
// "lampu kamar mode baca", "ac 24 derajat", "ac mode kering", "kipas ac kencang" (online/tuya.js does it).

const LAMP = '(?:lampu|bohlam|lights?|lamps?|stop ?kontak|colokan|saklar|plugs?|sockets?)';
const AC = '(?:air conditioner|aircon|air ?con|ac|pendingin ruangan|pendingin)';
const THING = `(?:${LAMP}|${AC})`;
const ON = 'nyalakan|nyalain|nyalakanlah|hidupkan|hidupin|idupin|idupkan';
const OFF = 'matikan|matiin|matikanlah|padamkan|padamin';
const PLUG = /^(?:stop ?kontak|colokan|saklar|plugs?|sockets?)$/;
const IS_AC = new RegExp(`^${AC}$`);
const nounOf = (thing) => (IS_AC.test(thing) ? 'ac' : PLUG.test(thing) ? 'plug' : 'lamp');

const COLORS = {
  merah: 0, red: 0, oranye: 30, orange: 30, jingga: 30, emas: 45, gold: 45, kuning: 60, yellow: 60, lime: 90, hijau: 120, green: 120, toska: 175, tosca: 175, teal: 175, cyan: 180, 'biru muda': 200, 'light blue': 200, biru: 240, blue: 240, nila: 260, indigo: 260, ungu: 280, purple: 280, violet: 280, magenta: 300, 'merah muda': 330, pink: 330,
};
const WHITES = { putih: {}, white: {}, hangat: { temp: 0 }, warm: { temp: 0 }, dingin: { temp: 1 }, cool: { temp: 1 } };
const SCENES = {
  malam: 'night', tidur: 'night', night: 'night', sleep: 'night', baca: 'read', membaca: 'read', read: 'read', reading: 'read', kerja: 'work', fokus: 'work', work: 'work', focus: 'work', santai: 'relax', relax: 'relax', lembut: 'soft', soft: 'soft', 'warna-warni': 'rainbow', 'warna warni': 'rainbow', pelangi: 'rainbow', rainbow: 'rainbow', colorful: 'rainbow', disko: 'party', pesta: 'party', party: 'party', disco: 'party', musik: 'music', music: 'music',
};
const AC_MODES = { dingin: 'cool', cool: 'cool', cooling: 'cool', panas: 'heat', heat: 'heat', heating: 'heat', kering: 'dry', dry: 'dry', kipas: 'fan', fan: 'fan', otomatis: 'auto', auto: 'auto' };
const FANS = { pelan: 'low', rendah: 'low', low: 'low', sedang: 'mid', medium: 'mid', mid: 'mid', kencang: 'high', tinggi: 'high', high: 'high', otomatis: 'auto', auto: 'auto' };
const anyOf = (table) => `(${Object.keys(table).sort((a, b) => b.length - a.length).join('|')})`;

const SHADE = anyOf({ ...COLORS, ...WHITES });
const SCENE = anyOf(SCENES);
const PERCENT = '(\\d{1,3})\\s*(?:%|persen|percent)';
const DEGREES = '(\\d{2})\\s*(?:derajat|degrees?|°\\s*c?|c)?';
const FOR = '(?:\\s+(?:di|yang di)\\s+|\\s+)';
const ID_TAIL = `(?:${FOR}(.+?))?`;
const OWNED = '(?:(?:the|my)\\s+)?';
const SET_ID = '(?:(?:atur|ubah|ganti|bikin|buat|jadikan|setel|set)\\s+)?';
const SET_EN = '(?:set|put|change|turn|make)\\s+';
const TO = '(?:(?:ke|jadi|to|at|di)\\s+)?';

const SAY_ON = new RegExp(`^(${ON}|${OFF})\\s+(semua\\s+|seluruh\\s+)?(${THING})${ID_TAIL}$`);
const EN_BEFORE = new RegExp(`^(?:turn|switch|shut)\\s+(on|off)\\s+(all\\s+(?:of\\s+)?)?${OWNED}(?:(.+?)\\s+)?(${THING})$`);
const EN_AFTER = new RegExp(`^(?:turn|switch|shut)\\s+(all\\s+)?${OWNED}(?:(.+?)\\s+)?(${THING})\\s+(on|off)$`);
const ID_STATE = new RegExp(`^(semua\\s+)?(${THING})(?:\\s+(.+?))?\\s+(nyala(?:in|kan)?|hidup(?:in|kan)?|mati(?:in|kan)?|on|off)$`);
const EN_STATE = new RegExp(`^(all\\s+)?${OWNED}(?:(.+?)\\s+)?(${THING})\\s+(on|off)$`);
const ASK_ID = new RegExp(`^(?:apakah\\s+)?(${THING})(?:\\s+(.+?))?\\s+(?:masih\\s+|sudah\\s+|udah\\s+|lagi\\s+)?(?:nyala|hidup|mati)\\s*(?:nggak|ngga|enggak|gak|ga|tidak|kah|atau (?:mati|nyala|hidup))$`);
const ASK_EN = new RegExp(`^(?:is|are)\\s+${OWNED}(?:(.+?)\\s+)?(${THING})\\s+(?:still\\s+)?(?:on|off)$`);

const LEVEL_ID = new RegExp(`^(?:(?:atur|ubah|ganti|bikin)\\s+)?(?:kecerahan\\s+|brightness\\s+)?(${LAMP})(?:\\s+(.+?))?\\s+(?:(?:ke|jadi)\\s+)?${PERCENT}$`);
const LEVEL_TO = new RegExp(`^(?:(?:atur|ubah|ganti|bikin)\\s+)?(?:kecerahan\\s+|brightness\\s+)?(${LAMP})(?:\\s+(.+?))?\\s+(?:ke|jadi)\\s+(\\d{1,3})$`);
const LEVEL_EN = new RegExp(`^(?:set|put|change|turn|make|dim|brighten)\\s+${OWNED}(?:(.+?)\\s+)?(${LAMP})\\s+(?:to|at)\\s+(\\d{1,3})\\s*(?:%|percent)?$`);
const DIM_ID = new RegExp(`^(redup(?:kan|in)|terang(?:kan|in))\\s+(${LAMP})${ID_TAIL}$`);
const DIM_EN = new RegExp(`^(dim|brighten)\\s+${OWNED}(?:(.+?)\\s+)?(${LAMP})$`);
const COLOR_ID = new RegExp(`^${SET_ID}(?:warna\\s+)?(${LAMP})(?:\\s+(.+?))?\\s+(?:(?:jadi|ke)\\s+)?(?:warna\\s+)?${SHADE}$`);
const COLOR_EN = new RegExp(`^${SET_EN}${OWNED}(?:(.+?)\\s+)?(${LAMP})\\s+(?:to\\s+)?${SHADE}$`);
// a mode needs the word "mode": "lampu tidur" is a bedside lamp, "lampu mode tidur" is a mode
const SCENE_ID = new RegExp(`^${SET_ID}(${LAMP})(?:\\s+(.+?))?\\s+${TO}(?:mode|scene)\\s+${SCENE}$`);
const SCENE_FRONT = new RegExp(`^${SET_ID}(?:mode|scene)\\s+(${LAMP})(?:\\s+(.+?))?\\s+(?:ke|jadi|to)\\s+${SCENE}$`);
const SCENE_EN = new RegExp(`^${SET_EN}${OWNED}(?:(.+?)\\s+)?(${LAMP})\\s+to\\s+${SCENE}\\s+(?:mode|scene)$`);

const AC_TEMP_ID = new RegExp(`^${SET_ID}(?:suhu\\s+|temperatur\\s+|temperature\\s+)?(${AC})(?:\\s+(.+?))?\\s+${TO}${DEGREES}$`);
const AC_TEMP_EN = new RegExp(`^${SET_EN}${OWNED}(?:(.+?)\\s+)?(${AC})\\s+(?:temperature\\s+)?(?:to|at)\\s+${DEGREES}$`);
const AC_STEP_ID = new RegExp(`^(naik(?:kan|in)|tambah(?:in)?|turun(?:kan|in)|kurang(?:i|in))\\s+suhu\\s+(${AC})${ID_TAIL}$`);
const AC_COLDER = new RegExp(`^(?:bikin\\s+)?(${AC})(?:\\s+(.+?))?\\s+(?:lebih\\s+)(dingin|hangat|panas)$`);
const AC_STEP_EN = new RegExp(`^make\\s+${OWNED}(?:(.+?)\\s+)?(${AC})\\s+(colder|cooler|warmer)$`);
const AC_MODE_ID = new RegExp(`^${SET_ID}(?:mode\\s+)?(${AC})(?:\\s+(.+?))?\\s+${TO}(?:mode\\s+)?${anyOf(AC_MODES)}$`);
const AC_MODE_EN = new RegExp(`^${SET_EN}${OWNED}(?:(.+?)\\s+)?(${AC})\\s+to\\s+${anyOf(AC_MODES)}(?:\\s+mode)?$`);
const AC_FAN_FRONT = new RegExp(`^${SET_ID}(?:kipas|fan|angin)(?:\\s+speed)?\\s+(${AC})(?:\\s+(.+?))?\\s+${TO}${anyOf(FANS)}$`);
const AC_FAN_BACK = new RegExp(`^${SET_ID}(${AC})(?:\\s+(.+?))?\\s+(?:kipas|fan|angin)(?:(?:nya)|\\s+speed)?\\s+${TO}${anyOf(FANS)}$`);
const AC_ASK = new RegExp(`^(?:suhu|temperatur)\\s+(${AC})(?:\\s+(.+?))?\\s+berapa$|^what(?:'s| is)\\s+${OWNED}(?:(.+?)\\s+)?(${AC})\\s+(?:temperature|set to)$`);

// (a word like "ke" that the sentence passed through isn't a name)
const clean = (s) => String(s || '').replace(/\s+(?:ya|dong|deh|aja)$/, '').replace(/(?:^|\s+)(?:ke|jadi|to|at|di|warna|mode)$/, '').trim();
const home = (action, thing, target, more = {}) => ({ kind: 'home', action, noun: nounOf(thing), target: clean(target), all: false, ...more });
const ac = (action, thing, target, more = {}) => ({ ...home(action, thing, target, more), noun: 'ac' });

function shade(thing, target, word) {
  if (word in COLORS) return home('color', thing, target, { color: { h: COLORS[word] }, shade: word });
  return home('white', thing, target, { ...WHITES[word], shade: word });
}
const scene = (thing, target, word) => home('scene', thing, target, { scene: SCENES[word], shade: word });

// Your devices by name, for "matiin kipas", where nothing says it's a device.
let known = [];
const setKnown = (names) => {
  known = names.map((n) => String(n).toLowerCase().trim()).filter(Boolean);
};

function airCon(text) {
  let m;
  if ((m = AC_ASK.exec(text))) return ac('status', m[1] || m[4], m[2] || m[3]);
  if ((m = AC_FAN_FRONT.exec(text)) || (m = AC_FAN_BACK.exec(text))) return ac('fan', m[1], m[2], { fan: FANS[m[3]], word: m[3] });
  if ((m = AC_TEMP_ID.exec(text))) return ac('temp', m[1], m[2], { temp: Number(m[3]) });
  if ((m = AC_TEMP_EN.exec(text))) return ac('temp', m[2], m[1], { temp: Number(m[3]) });
  if ((m = AC_STEP_ID.exec(text))) return ac('tempStep', m[2], m[3], { delta: /^(?:naik|tambah)/.test(m[1]) ? 1 : -1 });
  if ((m = AC_COLDER.exec(text))) return ac('tempStep', m[1], m[2], { delta: m[3] === 'dingin' ? -1 : 1 });
  if ((m = AC_STEP_EN.exec(text))) return ac('tempStep', m[2], m[1], { delta: m[3] === 'warmer' ? 1 : -1 });
  if ((m = AC_MODE_ID.exec(text))) return ac('acMode', m[1], m[2], { mode: AC_MODES[m[3]], word: m[3] });
  if ((m = AC_MODE_EN.exec(text))) return ac('acMode', m[2], m[1], { mode: AC_MODES[m[3]], word: m[3] });
  return null;
}

function lights({ text }) {
  let m;
  const cold = airCon(text);
  if (cold) return cold;
  if ((m = ASK_ID.exec(text))) return home('status', m[1], m[2]);
  if ((m = ASK_EN.exec(text))) return home('status', m[2], m[1]);
  if ((m = LEVEL_ID.exec(text)) || (m = LEVEL_TO.exec(text))) return home('level', m[1], m[2], { level: Math.min(100, Number(m[3])) });
  if ((m = LEVEL_EN.exec(text))) return home('level', m[2], m[1], { level: Math.min(100, Number(m[3])) });
  if ((m = DIM_ID.exec(text))) return home('level', m[2], m[3], { level: m[1].startsWith('redup') ? 25 : 100 });
  if ((m = DIM_EN.exec(text))) return home('level', m[3], m[2], { level: m[1] === 'dim' ? 25 : 100 });
  if ((m = SCENE_ID.exec(text)) || (m = SCENE_FRONT.exec(text))) return scene(m[1], m[2], m[3]);
  if ((m = SCENE_EN.exec(text))) return scene(m[2], m[1], m[3]);
  if ((m = SAY_ON.exec(text))) return home(new RegExp(`^(?:${ON})$`).test(m[1]) ? 'on' : 'off', m[3], m[4], { all: Boolean(m[2]) });
  if ((m = EN_BEFORE.exec(text))) return home(m[1], m[4], m[3], { all: Boolean(m[2]) });
  if ((m = EN_AFTER.exec(text))) return home(m[4], m[3], m[2], { all: Boolean(m[1]) });
  if ((m = ID_STATE.exec(text))) return home(/^(?:nyala|hidup|on)/.test(m[4]) ? 'on' : 'off', m[2], m[3], { all: Boolean(m[1]) });
  if ((m = EN_STATE.exec(text))) return home(m[4], m[3], m[2], { all: Boolean(m[1]) });
  // "mode" before a color changes nothing: "ganti mode lampu ke red", "lampu kamar mode merah"
  const plain = /\bmode\b/.test(text) ? text.replace(/\bmode\s+/g, '') : text;
  if ((m = COLOR_ID.exec(plain))) return shade(m[1], m[2], m[3]);
  if ((m = COLOR_EN.exec(plain))) return shade(m[2], m[1], m[3]);
  // a device by the name you gave it, with no "lampu" in the sentence
  m = new RegExp(`^(${ON}|${OFF})\\s+${OWNED}(.+)$`).exec(text);
  const en = !m && /^(?:turn|switch)\s+(on|off)\s+(?:(?:the|my)\s+)?(.+)$/.exec(text);
  const name = clean(m ? m[2] : en ? en[2] : '');
  if (name && known.includes(name)) return { kind: 'home', action: m ? (new RegExp(`^(?:${ON})$`).test(m[1]) ? 'on' : 'off') : en[1], noun: 'lamp', target: name, all: false };
  return null;
}

const commands = { lights };

module.exports = { commands, setKnown };

'use strict';

// Your day: the time, a sum, the weather, her brief, timers, alarms and the study timer.

const { length, nextClock } = require('./words');

// "jam berapa?", "what time is it?", "hari apa sekarang?", "tanggal berapa?"
const CLOCK_ASK = /^(?:(?:sekarang )?jam berapa(?: sekarang)?|what(?:'s| is) the time(?: now)?|what time is it(?: now)?|time\?|(?:hari ini|sekarang) hari apa|hari apa(?: (?:ini|sekarang|hari ini))?|what day is (?:it|today)(?: today)?|what(?:'s| is) (?:the date|today'?s date)(?: today)?|(?:hari ini |sekarang )?tanggal berapa(?: (?:hari ini|sekarang))?|what(?:'s| is) today)\??$/;

// A sum asked for: "berapa 25 x 4", "what is 12*7", "hitung 15% dari 200", "100 / 8". { expr, value } or null.
function arithmetic(text) {
  const m = /^(?:berapa|hitung(?:kan|in)?|what(?:'s| is)|calculate|how much is|compute)?\s*(.+?)\s*(?:=|\?)?\s*$/.exec(text);
  if (!m) return null;
  let e = m[1].replace(/,/g, '.').replace(/\s+/g, ' ').trim();
  // "15% dari 200", "15% of 200"
  const pct = /^(\d+(?:\.\d+)?)\s*%\s*(?:dari|of)\s*(\d+(?:\.\d+)?)$/.exec(e);
  if (pct) return { expr: `${pct[1]}% of ${pct[2]}`, value: (Number(pct[1]) / 100) * Number(pct[2]) };
  e = e.replace(/\b(?:x|kali|times)\b|×/g, '*').replace(/\b(?:bagi|divided by)\b|÷|:/g, '/').replace(/\b(?:tambah|plus)\b/g, '+')
    .replace(/\b(?:kurang|minus)\b/g, '-').replace(/\^|\bpangkat\b/g, '**');
  if (!/^[\d\s.+\-*/()]+$/.test(e) || !/\d\s*(?:\*\*|[+\-*/])\s*[(\d.-]/.test(e)) return null; // digits and operators only, and one at least
  let value;
  try {
    value = Function(`"use strict"; return (${e});`)(); // nothing but numbers and + - * / ** ( ) can be in it
  } catch {
    return null;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return { expr: e.replace(/\*\*/g, '^').replace(/\*/g, '×').replace(/\//g, '÷'), value: Math.round(value * 1e8) / 1e8 };
}

// The weather ("what's the weather", "cuaca di Bandung besok", "will it rain tomorrow?", "besok hujan nggak?")
const WEATHER_ASK = /^(?:(?:what(?:'s| is| will be)|how(?:'s| is))\s+(?:the\s+)?(?:weather|forecast|temperature)\b|(?:check|show me|tell me)\s+(?:the\s+)?(?:weather|forecast)\b|(?:weather|forecast|temperature)\b|(?:(?:gimana|bagaimana|cek|lihat|liat)\s+)?(?:cuaca|ramalan cuaca|prakiraan cuaca|suhu)\b|(?:will|is) it (?:going to )?(?:rain|snow|be (?:hot|cold|sunny|rainy))\b|(?:is it|it's) raining\b|how (?:hot|cold|warm) is it\b|(?:apakah |apa )?(?:besok |nanti |hari ini |nanti sore |nanti malam )?(?:bakal |akan |mau )?hujan\s+(?:nggak|gak|ga|enggak|tidak|ya|kah|gak sih|nggak sih)\b|(?:bakal|akan) hujan\b)/i;
const WEATHER_CITY = /\b(?:in|di|at|for|untuk|daerah|kota)\s+([\p{L}][\p{L} .'-]{1,40}?)(?:\s+(?:today|tomorrow|now|tonight|this (?:morning|afternoon|evening|week)|besok|hari ini|sekarang|nanti|malam ini|sore ini|minggu ini))?\s*[?.!]*$/iu;
function weatherAsk(text) {
  if (!WEATHER_ASK.test(text)) return null;
  // "cuaca di Bandung", "weather in Tokyo"; or right after the word ("cek cuaca jakarta")
  const city = (WEATHER_CITY.exec(text)?.[1] || /\b(?:cuaca|weather|forecast)\s+(?!(?:hari|besok|today|tomorrow|now|sekarang|nanti|is|di|in|for|untuk|gimana|bagaimana)\b)([\p{L}][\p{L} .'-]{1,30}?)\s*[?.!]*$/iu.exec(text)?.[1] || '').trim();
  return { kind: 'weather', city: /^(?:here|sini|my (?:city|area)|kotaku|daerahku)$/i.test(city) ? '' : city, when: /\b(?:tomorrow|besok)\b/i.test(text) ? 'tomorrow' : 'today' };
}

// Her brief of your day ("brief me", "what's my day", "rangkuman hari ini"; "good morning", "selamat pagi" in the morning)
const BRIEF_ASK = /^(?:brief me|daily brief|my day|what'?s (?:my|on my|on) (?:day|agenda)|what(?:'s| is) (?:up )?today|how(?:'s| is) my day(?: looking)?|rangkuman(?: hari ini)?|ringkasan(?: hari ini)?|apa (?:agenda|jadwal|rencana)(?:ku| aku| saya)? hari ini|hari ini ada apa(?: aja)?)$/i;
const MORNING = /^(?:good morning|morning|mornin'?|selamat pagi|pagi|met pagi|pagi capri)$/i;
function briefAsk(text) {
  const hour = new Date().getHours();
  return BRIEF_ASK.test(text) || (MORNING.test(text) && hour >= 4 && hour < 12) ? { kind: 'brief' } : null;
}

function clock({ text }) {
  if (CLOCK_ASK.test(text)) return { kind: 'time', what: /tanggal|date|hari apa|what day|day is it|bulan|month|tahun|year/.test(text) ? 'date' : 'time' };
  return null;
}

function math({ text }) {
  const sum = arithmetic(text);
  if (sum) return { kind: 'math', ...sum };
  return null;
}

function clearAlarms({ text }) {
  if (/^(?:cancel|clear|delete|remove|stop|hapus|batalkan|matikan)\s+(?:all\s+|semua\s+)?(?:my\s+|the\s+)?(?:timers?|alarms?)(?:\s+(?:semua|semuanya))?$/.test(text)) return { kind: 'clearAlarms' };
  return null;
}

function stopStudy({ text }) {
  if (/^(?:stop|end|cancel|berhenti|hentikan|selesai|stop)\s+(?:the\s+|my\s+)?(?:study|focus|pomodoro|belajar|fokus)/.test(text)) return { kind: 'stopStudy' };
  return null;
}

function study({ text }) {
  if (/^(?:start|begin|do|mulai|ayo)\s+(?:a\s+|the\s+|my\s+)?(?:study|focus|pomodoro|belajar|fokus)\b/.test(text)) {
    const focus = length(text);
    return { kind: 'study', seconds: focus >= 60 ? focus : 0 };
  }
  return null;
}

function timer({ text }) {
  const timerWords = /\b(?:timer|alarm|remind|wake|countdown|ingatkan|ingetin|bangunkan|bangunin|pengingat)/;
  if (/^(?:set|start|make|create|add|put|give me|remind|wake|timer|countdown|alarm|pasang|setel|buat|bikin|atur|ingatkan|ingetin|bangunkan|bangunin)\b/.test(text) && timerWords.test(text)) {
    const seconds = length(text);
    let label = '';
    const l = /\b(?:to|about|untuk|buat|supaya|biar)\s+(.{2,60})$/.exec(text);
    if (l && !/^\d/.test(l[1])) label = l[1].trim();
    if (seconds > 0) return { kind: 'timer', seconds, label };
    const c = /\b(?:at|for|jam|pukul)\s+(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?m\.?|p\.?m\.?|pagi|siang|sore|malam)?(?:\s|$)/.exec(text);
    if (c && (c[2] || c[3] || /\b(?:alarm|wake|bangun|jam|pukul)/.test(text))) {
      const due = nextClock(Number(c[1]), c[2] ? Number(c[2]) : 0, c[3]);
      if (due) return { kind: 'clock', due: due.getTime(), label };
    }
  }
  return null;
}

const commands = {
  weather: ({ cased }) => weatherAsk(cased),
  brief: ({ text }) => briefAsk(text.replace(/[.!?]+$/, '')),
  clock,
  math,
  clearAlarms,
  stopStudy,
  study,
  timer,
};

module.exports = { commands };

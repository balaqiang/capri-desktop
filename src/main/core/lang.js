'use strict';

// Her words for everything that came over from Capri Desktop 2.4 (errands, notices, dares, sync,
// voice, the settings window): the English wording is the key, and assets/lang/<code>.txt holds the
// translations, the same files 2.4 used. A line starting with "> " is the English, the line under it
// the translation. A file of your own in <userData>/lang/<code>.txt wins, line by line.
// No file, or a missing line: the English.

const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

const ROOT = path.resolve(__dirname, '..', '..', '..');

// every language she can be set to, with its name in its own language, and in English (for the model)
const CHOICES = [
  ['en', 'English', 'English'], ['id', 'Bahasa Indonesia', 'Indonesian'], ['fr', 'Français', 'French'],
  ['es', 'Español', 'Spanish'], ['pt', 'Português (Brasil)', 'Brazilian Portuguese'], ['ru', 'Русский', 'Russian'],
  ['de', 'Deutsch', 'German'], ['it', 'Italiano', 'Italian'], ['pl', 'Polski', 'Polish'], ['cs', 'Čeština', 'Czech'],
  ['vi', 'Tiếng Việt', 'Vietnamese'],
];
const CODES = CHOICES.map(([code]) => code);

let code = 'en';
let lines = {};

function unescape(text) {
  return text.replace(/\\(.)/g, (_, c) => (c === 'n' ? '\n' : c));
}

function parse(text, into) {
  let key = null;
  for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    if (line.startsWith('> ')) {
      key = unescape(line.slice(2));
      continue;
    }
    if (key === null || !line || line.startsWith('#')) continue;
    into[key] = unescape(line);
    key = null;
  }
  return into;
}

function read(file, into) {
  try {
    parse(fs.readFileSync(file, 'utf8'), into);
  } catch {
    // no such file: English
  }
}

function load(wanted) {
  code = CODES.includes(wanted) ? wanted : 'en';
  lines = {};
  if (code === 'en') return;
  read(path.join(ROOT, 'assets', 'lang', `${code}.txt`), lines);
  read(path.join(app.getPath('userData'), 'lang', `${code}.txt`), lines);
}

const T = (english) => (english && lines[english]) || english;

// "Timer's on for {0}!" with its values; a translation that breaks its {0}s falls back to the English
function F(english, ...values) {
  const fill = (s) => s.replace(/\{(\d+)\}/g, (_, i) => (values[i] ?? ''));
  return fill(T(english));
}

// Wording that changes with the number, as one key: "{0} minute|{0} minutes". Polish, Russian and
// Czech have a third form; Vietnamese and Indonesian one.
function count(forms, n) {
  const parts = T(forms).split('|');
  let i;
  if (code === 'pl') i = n === 1 ? 0 : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)) ? 1 : 2;
  else if (code === 'ru') i = (n % 10 === 1 && n % 100 !== 11) ? 0 : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)) ? 1 : 2;
  else if (code === 'cs') i = n === 1 ? 0 : n >= 2 && n <= 4 ? 1 : 2;
  else if (code === 'vi' || code === 'id') i = 0;
  else if (code === 'fr' || code === 'pt') i = n < 2 ? 0 : 1;
  else i = n === 1 ? 0 : 1;
  return parts[Math.min(i, parts.length - 1)].replace(/\{0\}/g, String(n));
}

// the whole table, for the overlay and the settings window (they translate the same way)
const table = () => ({ code, lines });
const englishName = (c = code) => CHOICES.find(([k]) => k === c)?.[2] || 'English';

module.exports = { CHOICES, CODES, load, T, F, count, table, englishName, parse, get code() { return code; } };

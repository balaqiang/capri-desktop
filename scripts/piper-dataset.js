#!/usr/bin/env node
'use strict';

// A recording, cut into a dataset for training a Piper voice: node scripts/piper-dataset.js <audio> <folder> [--language en]
// Whisper on this PC (her better ears) writes down every word with its time, ffmpeg cuts one clip per sentence. Laughs, screams and music are
// cut out. What you get: <folder>/wav/*.wav and <folder>/metadata.csv ("clip.wav|text"), to read through before training. Nothing leaves this PC.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const SAMPLE_RATE = 22050;
const NOT_SPEECH = /[[\]()*♪]/;

// [{ text, from, to }] (seconds) -> sentences to cut: [{ text, from, to }]
function utterances(words, { gap = 0.35, minSec = 1, maxSec = 10, minWords = 2 } = {}) {
  const out = [];
  let now = [];
  const close = () => {
    if (now.length >= minWords && now.at(-1).to - now[0].from >= minSec) out.push({ text: now.map((w) => w.text).join(' ').replace(/\s+([,.!?])/g, '$1'), from: now[0].from, to: now.at(-1).to });
    now = [];
  };
  let inside = false; // within [a laugh] written over several words
  for (const raw of words) {
    const text = String(raw.text || '').trim();
    if (!text) continue;
    if (inside || NOT_SPEECH.test(text)) {
      if (/[[(]/.test(text) && !/[\])]/.test(text)) inside = true;
      else if (/[\])]/.test(text)) inside = false;
      close();
      continue;
    }
    const last = now.at(-1);
    if (last && raw.from - last.to > gap) close();
    now.push({ text, from: raw.from, to: raw.to });
    const long = raw.to - now[0].from;
    if (/[.!?]["']?$/.test(text) || (long >= maxSec * 0.7 && /[,;:]$/.test(text)) || long >= maxSec) close();
  }
  close();
  return out;
}

const speechDir = () => path.join(process.env.APPDATA || os.homedir(), 'capri-desktop', 'speech');

function wordsOf(audio, language, work) {
  const dir = speechDir();
  const program = ['bin/Release/whisper-cli.exe', 'bin/whisper-cli.exe'].map((p) => path.join(dir, p)).find((p) => fs.existsSync(p));
  const model = fs.existsSync(path.join(dir, 'models')) && fs.readdirSync(path.join(dir, 'models')).find((f) => /^ggml-.*\.bin$/.test(f));
  if (!program || !model) throw new Error("Whisper isn't here: Settings, Voice, Download better ears.");
  const wav = path.join(work, 'words16k.wav');
  execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', audio, '-ac', '1', '-ar', '16000', wav]);
  const stem = path.join(work, 'words');
  execFileSync(program, ['-m', path.join(dir, 'models', model), '-f', wav, '-l', language, '-ml', '1', '-sow', '-oj', '-of', stem, '-np'], { stdio: 'ignore', maxBuffer: 1 << 26 });
  return JSON.parse(fs.readFileSync(`${stem}.json`, 'utf8')).transcription.map((t) => ({ text: t.text, from: t.offsets.from / 1000, to: t.offsets.to / 1000 }));
}

function main() {
  const args = process.argv.slice(2);
  const at = args.indexOf('--language');
  const language = at >= 0 ? args.splice(at, 2)[1] : 'en';
  const [audio, folder] = args;
  if (!audio || !folder || !fs.existsSync(audio)) {
    console.error('usage: node scripts/piper-dataset.js <audio> <folder> [--language en]');
    process.exit(2);
  }
  const wavs = path.join(folder, 'wav');
  fs.rmSync(wavs, { recursive: true, force: true });
  fs.mkdirSync(wavs, { recursive: true });
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'capri-piper-'));
  const clips = utterances(wordsOf(audio, language, work));
  // one level for the whole recording, so that every clip keeps its place next to the others
  const even = path.join(work, 'even.wav');
  execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', audio, '-ac', '1', '-ar', String(SAMPLE_RATE), '-af', 'highpass=f=70,loudnorm=I=-20:TP=-2:LRA=11', '-ar', String(SAMPLE_RATE), even]);
  const rows = clips.map((c, i) => {
    const name = `capri_${String(i + 1).padStart(4, '0')}.wav`;
    const from = Math.max(0, c.from - 0.05);
    const to = c.to + 0.12;
    execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-ss', from.toFixed(3), '-to', to.toFixed(3), '-i', even, '-c:a', 'pcm_s16le', path.join(wavs, name)]);
    return `${name}|${c.text.replace(/\|/g, ' ')}`;
  });
  fs.writeFileSync(path.join(folder, 'metadata.csv'), `${rows.join('\n')}\n`);
  fs.rmSync(work, { recursive: true, force: true });
  const seconds = clips.reduce((sum, c) => sum + c.to - c.from, 0);
  console.log(`${clips.length} clips, ${Math.round(seconds)} seconds of speech`);
}

if (require.main === module) main();

module.exports = { utterances };

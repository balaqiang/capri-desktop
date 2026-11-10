#!/usr/bin/env node
'use strict';

// A recording, cut into a dataset for training a Piper voice: node scripts/piper-dataset.js <audio> <folder> [--language en]
// Whisper on this PC (her better ears) writes down every word with its time; the clips are cut where the recording really goes quiet, so no
// clip starts or ends inside a sound. Laughs, screams and music are left out. What you get: <folder>/wav/*.wav and <folder>/metadata.csv
// ("clip.wav|text"), to read through before training. Nothing leaves this PC.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const SAMPLE_RATE = 22050;
const NOT_SPEECH = /[[\]()*♪]/;
const SENTENCE_END = /[.!?]["']?$/;

// [{ text, from, to }] (seconds) -> sentences to cut: [{ text, from, to }]. Used when the recording has hardly any pauses.
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
    if (SENTENCE_END.test(text) || (long >= maxSec * 0.7 && /[,;:]$/.test(text)) || long >= maxSec) close();
  }
  close();
  return out;
}

// Clips between real pauses. pauses: [{ from, to }] where the recording is quiet. Each clip starts a little before its first sound and ends a
// little after its last, both inside a pause; it ends at the end of a sentence when it can, and is never longer than maxSec unless one stretch
// of speech is. Words are given to the stretch their middle falls in. -> [{ text, from, to }]
function clipsAtPauses(words, pauses, { minSec = 1, maxSec = 12, longest = 16, minWords = 2, lead = 0.06, tail = 0.12 } = {}) {
  const gaps = pauses.filter((p) => p.to > p.from).sort((a, b) => a.from - b.from);
  const end = Math.max(...words.map((w) => w.to), ...gaps.map((g) => g.to), 0);
  const edges = [{ from: -Infinity, to: 0 }, ...gaps, { from: end, to: Infinity }];
  const stretches = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const from = edges[i].to;
    const to = edges[i + 1].from;
    if (to - from < 0.15) continue;
    const said = words.filter((w) => (w.from + w.to) / 2 >= from && (w.from + w.to) / 2 < to).map((w) => String(w.text || '').trim()).filter(Boolean);
    stretches.push({ from, to, said, before: edges[i], after: edges[i + 1] });
  }
  const out = [];
  let now = [];
  const close = () => {
    if (!now.length) return;
    const said = now.flatMap((s) => s.said);
    const first = now[0];
    const last = now.at(-1);
    const from = Math.max(first.before.from, first.from - lead, 0);
    const to = Math.min(last.after.to, last.to + tail);
    const long = to - from;
    if (said.length >= minWords && long >= minSec && long <= longest && !said.some((w) => NOT_SPEECH.test(w))) {
      out.push({ text: said.join(' ').replace(/\s+([,.!?])/g, '$1'), from, to });
    }
    now = [];
  };
  for (const s of stretches) {
    if (s.said.some((w) => NOT_SPEECH.test(w))) {
      close();
      continue; // a laugh or a scream: neither in this clip nor the next
    }
    if (now.length && s.to - now[0].from > maxSec) close();
    now.push(s);
    const long = s.to - now[0].from;
    if (long >= minSec && SENTENCE_END.test(s.said.at(-1) || '')) close();
  }
  close();
  return out;
}

// Where the recording is quiet: [{ from, to }]
function pausesIn(wav, { below = -40, atLeast = 0.15 } = {}) {
  const run = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', wav, '-af', `silencedetect=noise=${below}dB:d=${atLeast}`, '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const out = [];
  let from = null;
  for (const line of String(run.stderr).split(/\r?\n/)) {
    const start = /silence_start: (-?[\d.]+)/.exec(line);
    const stop = /silence_end: (-?[\d.]+)/.exec(line);
    if (start) from = Math.max(0, Number(start[1]));
    if (stop && from !== null) {
      out.push({ from, to: Number(stop[1]) });
      from = null;
    }
  }
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
  const words = wordsOf(audio, language, work);
  // one level for the whole recording, so that every clip keeps its place next to the others
  const even = path.join(work, 'even.wav');
  execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', audio, '-ac', '1', '-af', 'highpass=f=70,loudnorm=I=-20:TP=-2:LRA=11', '-ar', String(SAMPLE_RATE), even]);
  const pauses = pausesIn(even);
  const clips = pauses.length >= 3 ? clipsAtPauses(words, pauses) : utterances(words);
  const rows = clips.map((c, i) => {
    const name = `capri_${String(i + 1).padStart(4, '0')}.wav`;
    execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-ss', c.from.toFixed(3), '-to', c.to.toFixed(3), '-i', even, '-c:a', 'pcm_s16le', path.join(wavs, name)]);
    return `${name}|${c.text.replace(/\|/g, ' ')}`;
  });
  fs.writeFileSync(path.join(folder, 'metadata.csv'), `${rows.join('\n')}\n`);
  fs.rmSync(work, { recursive: true, force: true });
  const seconds = clips.reduce((sum, c) => sum + c.to - c.from, 0);
  console.log(`${clips.length} clips, ${Math.round(seconds)} seconds, cut at ${pauses.length >= 3 ? `${pauses.length} pauses` : 'word times (few pauses)'}`);
}

if (require.main === module) main();

module.exports = { utterances, clipsAtPauses, pausesIn };

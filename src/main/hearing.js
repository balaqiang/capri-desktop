'use strict';

// Her ears: what you said into the microphone, as text. The overlay records one phrase at a time
// (it starts when you speak and ends after a moment of quiet, ears.js) and hands it over as a 16 kHz
// mono WAV; this turns it into words with, in order of preference (settings › Voice):
//   whisper  whisper.cpp on this PC (from Capri Desktop 2.4: "Download better ears…"), nothing leaves it
//   groq     Groq's Whisper (free tier, your key), openai: OpenAI's (your key)
//   windows  Windows' own recognizer, offline, only for the speech packs Windows has installed
// Nothing is kept: the recording only lives in memory, and in a temp file while Whisper reads it.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { app } = require('electron');

// the optional download of better ears: a Windows build of whisper.cpp and a model that understands many
// languages, fixed files checked by size and SHA-256 before anything is used (as in 2.4)
const EARS = {
  programUrl: 'https://github.com/ggml-org/whisper.cpp/releases/download/b5454/whisper-bin-x64.zip',
  programBytes: 8928640,
  programSha: '6ba69e3482d7826214f90a6a9c84ca07782aec1e1d0c6a7c30c994fd5d816ccb',
  modelUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-q5_1.bin',
  modelName: 'ggml-small-q5_1.bin',
  modelBytes: 190085487,
  modelSha: 'ae85e4a935d7a567bd102fe55afc16bb595bdb618e11b2fc7591bc08120411bb',
};

const speechDir = () => path.join(app.getPath('userData'), 'speech');
const logFile = () => path.join(app.getPath('userData'), 'voice-log.txt');

// one line per attempt, numbers and errors only, never the words (as in 2.4)
function log(line) {
  try {
    const file = logFile();
    const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').slice(-300).join('\n') : '';
    fs.writeFileSync(file, `${old}${old ? '\n' : ''}${new Date().toISOString()} ${line}`);
  } catch {
    // only a log
  }
}

function whisperProgram(dir = speechDir()) {
  for (const p of [path.join(dir, 'bin', 'Release', 'whisper-cli.exe'), path.join(dir, 'bin', 'whisper-cli.exe')]) if (fs.existsSync(p)) return p;
  return null;
}

// For English: small.en, base.en, then any. For another language only a multilingual one (no ".en").
function whisperModel(language, dir = speechDir()) {
  const models = path.join(dir, 'models');
  let all = [];
  try {
    all = fs.readdirSync(models).filter((f) => /^ggml-.*\.bin$/i.test(f)).sort();
  } catch {
    return null;
  }
  if (language === 'en') {
    for (const name of ['ggml-small.en.bin', 'ggml-base.en.bin']) if (all.includes(name)) return path.join(models, name);
    return all.length ? path.join(models, all[0]) : null;
  }
  for (const pre of ['ggml-small', 'ggml-base', 'ggml-medium', 'ggml-large', 'ggml-tiny']) {
    const hit = all.find((f) => f.toLowerCase().startsWith(pre) && !/\.en/i.test(f));
    if (hit) return path.join(models, hit);
  }
  const any = all.find((f) => !/\.en/i.test(f));
  return any ? path.join(models, any) : null;
}

const keyFor = (cfg, keys, provider, env) => keys?.[provider] || process.env[env] || '';

// Which ears she has, for her settings: { engines: { whisper, groq, openai, windows }, active, whisperModel }
function status(cfg, keys, language) {
  const program = whisperProgram();
  const model = whisperModel(language);
  const engines = {
    whisper: Boolean(program && model),
    groq: Boolean(keyFor(cfg, keys, 'groq', 'GROQ_API_KEY')),
    openai: Boolean(keyFor(cfg, keys, 'openai', 'OPENAI_API_KEY')),
    windows: process.platform === 'win32',
  };
  return {
    engines,
    active: pickEngine(cfg, engines),
    whisperProgram: Boolean(program),
    whisperModel: model ? path.basename(model).replace(/^ggml-|\.bin$/g, '') : null,
    needsDownload: !program || !fs.existsSync(path.join(speechDir(), 'models', EARS.modelName)),
    folder: speechDir(),
    sizeMb: Math.round((EARS.programBytes + EARS.modelBytes) / 1e6),
  };
}

function pickEngine(cfg, engines) {
  if (cfg.sttEngine !== 'auto') return engines[cfg.sttEngine] ? cfg.sttEngine : null;
  return ['whisper', 'groq', 'openai', 'windows'].find((e) => engines[e]) || null;
}

const clean = (text) => String(text || '').replace(/\[[^\]]*\]|\([^)]*\)|\*[^*]*\*/g, ' ').replace(/\s+/g, ' ').trim();

function runWhisper(wav, language) {
  const program = whisperProgram();
  const model = whisperModel(language);
  if (!program || !model) return Promise.reject(new Error('Whisper isn\'t set up'));
  const file = path.join(os.tmpdir(), `capri-${crypto.randomUUID()}.wav`);
  fs.writeFileSync(file, wav);
  const args = ['-m', model, '-f', file, '-nt', '-np', '-l', language || 'auto', '-t', String(Math.max(2, Math.min(8, os.cpus().length))), '-bs', '1', '-bo', '1'];
  if (language === 'en') args.push('--prompt', 'Hello Capri.');
  if (language === 'id') args.push('--prompt', 'Halo Capri.');
  return new Promise((resolve, reject) => {
    execFile(program, args, { windowsHide: true, timeout: 40000, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }, (err, out) => {
      fs.rm(file, { force: true }, () => {});
      if (err) return reject(new Error(err.killed ? 'Whisper took too long' : `Whisper stopped (${err.code ?? err.message})`));
      return resolve(clean(out));
    });
  });
}

async function runCloud(kind, wav, language, key) {
  const url = kind === 'groq' ? 'https://api.groq.com/openai/v1/audio/transcriptions' : 'https://api.openai.com/v1/audio/transcriptions';
  const form = new FormData();
  form.append('file', new Blob([wav], { type: 'audio/wav' }), 'capri.wav');
  form.append('model', kind === 'groq' ? 'whisper-large-v3-turbo' : 'whisper-1');
  form.append('response_format', 'json');
  if (language && language !== 'auto') form.append('language', language);
  form.append('prompt', language === 'id' ? 'Halo Capri.' : 'Hey Capri.');
  const res = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${key}` }, body: form, signal: AbortSignal.timeout(30000) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message || `${kind} answered ${res.status}`);
  return clean(body.text);
}

// Windows' own recognizer (System.Speech), on the recording; the language's speech pack if Windows has it.
function runWindows(wav, language) {
  const file = path.join(os.tmpdir(), `capri-${crypto.randomUUID()}.wav`);
  fs.writeFileSync(file, wav);
  const script = `
Add-Type -AssemblyName System.Speech
$want = '${String(language || 'en').replace(/[^a-z-]/gi, '')}'
$all = [System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers()
$info = $all | Where-Object { $_.Culture.TwoLetterISOLanguageName -eq $want } | Select-Object -First 1
if (-not $info) { $info = $all | Select-Object -First 1 }
if (-not $info) { Write-Output '::none'; exit }
$r = New-Object System.Speech.Recognition.SpeechRecognitionEngine($info)
$r.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
$r.SetInputToWaveFile('${file.replace(/'/g, "''")}')
$res = $r.Recognize()
if ($res) { Write-Output $res.Text }
$r.Dispose()`;
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `[Console]::OutputEncoding = [Text.Encoding]::UTF8; ${script}`],
      { windowsHide: true, timeout: 30000 }, (err, out) => {
        fs.rm(file, { force: true }, () => {});
        if (err) return reject(new Error('Windows speech failed'));
        const text = String(out).trim();
        if (text === '::none') return reject(new Error('Windows has no speech recognizer installed'));
        return resolve(clean(text));
      });
  });
}

// What was said: { ok, text, engine } or { ok: false, error }
async function transcribe(wav, { cfg, keys, language }) {
  const engines = status(cfg, keys, language).engines;
  const engine = pickEngine(cfg, engines);
  const seconds = Math.max(0, (wav.length - 44) / 32000).toFixed(1);
  if (!engine) {
    log(`no engine (asked ${cfg.sttEngine}) ${seconds}s`);
    return { ok: false, error: 'noears' };
  }
  const started = Date.now();
  try {
    let text;
    if (engine === 'whisper') text = await runWhisper(wav, language);
    else if (engine === 'groq') text = await runCloud('groq', wav, language, keyFor(cfg, keys, 'groq', 'GROQ_API_KEY'));
    else if (engine === 'openai') text = await runCloud('openai', wav, language, keyFor(cfg, keys, 'openai', 'OPENAI_API_KEY'));
    else text = await runWindows(wav, language);
    log(`${engine} ${language} ${seconds}s -> ${text.length} chars in ${Date.now() - started} ms`);
    return { ok: true, text, engine };
  } catch (err) {
    log(`${engine} ${language} ${seconds}s failed: ${err.message}`);
    return { ok: false, error: err.message, engine };
  }
}

// ---- "Download better ears…" -------------------------------------------------------------------------

async function fetchTo(url, dest, onBytes, signal) {
  const u = new URL(url);
  if (u.protocol !== 'https:' || !['github.com', 'huggingface.co'].includes(u.hostname)) throw new Error('That address is not allowed.');
  const res = await fetch(url, { headers: { 'user-agent': 'Capri' }, redirect: 'follow', signal });
  if (!res.ok || !res.url.startsWith('https:')) throw new Error(`download failed (${res.status})`);
  const out = fs.createWriteStream(dest);
  let total = 0;
  try {
    for await (const chunk of res.body) {
      total += chunk.length;
      if (!out.write(chunk)) await new Promise((r) => out.once('drain', r));
      onBytes(total);
    }
  } finally {
    await new Promise((r) => out.end(r));
  }
}

function sha256(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    fs.createReadStream(file).on('data', (d) => hash.update(d)).on('end', () => resolve(hash.digest('hex'))).on('error', reject);
  });
}

async function getChecked(url, bytes, sha, dir, onBytes, signal) {
  const part = path.join(dir, `download-${crypto.randomUUID()}.part`);
  try {
    await fetchTo(url, part, onBytes, signal);
    if (signal.aborted) throw new Error('stopped');
    if (fs.statSync(part).size !== bytes || (await sha256(part)) !== sha) throw new Error('The download was not the file it should be, so it was not used.');
    return part;
  } catch (err) {
    fs.rmSync(part, { force: true });
    throw err;
  }
}

// only whisper-cli.exe and the libraries it loads come out of the zip, by file name, never by path
function unpack(zip, target) {
  const tmp = path.join(os.tmpdir(), `capri-ears-${crypto.randomUUID()}`);
  fs.mkdirSync(tmp, { recursive: true });
  fs.mkdirSync(target, { recursive: true });
  return new Promise((resolve, reject) => {
    execFile('tar.exe', ['-xf', zip, '-C', tmp], { windowsHide: true, timeout: 120000 }, (err) => {
      if (err) return reject(new Error('could not unpack Whisper'));
      const files = [];
      const walk = (dir) => {
        for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, f.name);
          if (f.isDirectory()) walk(full);
          else files.push(full);
        }
      };
      walk(tmp);
      for (const f of files) if (/\.dll$/i.test(f)) fs.copyFileSync(f, path.join(target, path.basename(f)));
      const cli = files.find((f) => path.basename(f) === 'whisper-cli.exe');
      if (cli) fs.copyFileSync(cli, path.join(target, 'whisper-cli.exe'));
      fs.rmSync(tmp, { recursive: true, force: true });
      return cli ? resolve() : reject(new Error('whisper-cli.exe was not in the download'));
    });
  });
}

async function downloadEars(onProgress, signal) {
  const dir = speechDir();
  fs.mkdirSync(dir, { recursive: true });
  const needProgram = !whisperProgram();
  const needModel = !fs.existsSync(path.join(dir, 'models', EARS.modelName));
  const total = (needProgram ? EARS.programBytes : 0) + (needModel ? EARS.modelBytes : 0);
  let before = 0;
  const report = (n) => onProgress({ done: before + n, total, percent: Math.min(99, Math.floor(((before + n) * 100) / Math.max(1, total))) });
  if (needProgram) {
    const zip = await getChecked(EARS.programUrl, EARS.programBytes, EARS.programSha, dir, report, signal);
    try {
      await unpack(zip, path.join(dir, 'bin', 'Release'));
    } finally {
      fs.rmSync(zip, { force: true });
    }
    before = EARS.programBytes;
  }
  if (needModel) {
    fs.mkdirSync(path.join(dir, 'models'), { recursive: true });
    const part = await getChecked(EARS.modelUrl, EARS.modelBytes, EARS.modelSha, dir, report, signal);
    const final = path.join(dir, 'models', EARS.modelName);
    fs.rmSync(final, { force: true });
    fs.renameSync(part, final);
  }
  onProgress({ done: total, total, percent: 100 });
  log('better ears installed');
}

module.exports = { transcribe, status, downloadEars, speechDir, logFile, EARS };


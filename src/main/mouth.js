'use strict';

// Her voice, as sound (settings › Voice › Her voice). Windows' own voices are spoken in the overlay
// (speech synthesis); every other engine is made here and handed to the overlay as audio, so her voice
// effects and her lip-sync can work on it (tts.js):
//   openai      OpenAI's gpt-4o-mini-tts: told how to sound (her style, and her emotion of the moment)
//   elevenlabs  ElevenLabs: any voice of your account, a cloned one included (your own "Capri" voice)
//   custom      a TTS server of your own with OpenAI's /audio/speech (Kokoro-FastAPI, AllTalk, openedai-speech,
//               a GPT-SoVITS or XTTS adapter…): voice cloning on your own PC
//   piper       Piper on this PC (offline), with any .onnx voice, one you trained yourself too
// Only her lines go to these services, never what you say.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { app } = require('electron');

const OPENAI_VOICES = ['coral', 'nova', 'shimmer', 'sage', 'ballad', 'fable', 'alloy', 'ash', 'echo', 'onyx', 'verse'];
const OPENAI_MODELS = ['gpt-4o-mini-tts', 'tts-1', 'tts-1-hd'];
const ELEVEN_MODELS = ['eleven_multilingual_v2', 'eleven_flash_v2_5', 'eleven_turbo_v2_5', 'eleven_v3'];

// how she sounds, for the engines that take directions (OpenAI), and what each emotion changes
const STYLE = 'Voice of Capri, a personality construct made of many fused human minds: a playful, mischievous, proud digital girl. Light, quick and teasing, childlike charm with a sudden unsettling edge. Casual; pronounce the Indonesian-English mix naturally.';
const MOODS = {
  happy: 'Right now: bright, giggly, delighted with herself.',
  jealous: 'Right now: pouty and possessive, a little sulky, fake-sweet.',
  bored: 'Right now: flat, drawn-out, sighing, theatrically bored.',
  glitch: 'Right now: suddenly eerie and staccato, like a voice breaking through static, then playful again.',
  annoyed: 'Right now: snappy and irritated, clipped words.',
};
// ElevenLabs: less stable reads wilder (more emotional), and more style exaggerates it
const ELEVEN_MOOD = { happy: [-0.05, 0.1], jealous: [-0.05, 0.1], bored: [0.15, -0.15], glitch: [-0.2, 0.2], annoyed: [-0.1, 0.15] };

const speechDir = () => path.join(app.getPath('userData'), 'speech');
const piperDir = () => path.join(speechDir(), 'piper');

const cache = new Map(); // a line she says again (canned ones) isn't paid for twice
const CACHE_MAX = 40;

function remember(key, value) {
  cache.set(key, value);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  return value;
}

// her line, ready to say: no tags, no stage directions, no addresses
function said(text) {
  return String(text || '')
    .replace(/\[\[[^\]]*\]\]/g, '')
    .replace(/\[[a-z]+\]/gi, '')
    .replace(/\*[^*]*\*/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 800);
}

async function failure(res, who) {
  const body = await res.text().catch(() => '');
  let message = body.slice(0, 200) || `${who} answered ${res.status}`;
  try {
    const parsed = JSON.parse(body);
    const err = parsed.error || parsed.detail;
    message = typeof err === 'string' ? err : err?.message || err?.status || message;
  } catch {
    // not JSON
  }
  return new Error(`${who}: ${message}`);
}

async function openai(text, { cfg, key, emotion }) {
  if (!key) throw Object.assign(new Error('no OpenAI key'), { code: 'nokey' });
  const model = OPENAI_MODELS.includes(cfg.ttsOpenaiModel) ? cfg.ttsOpenaiModel : 'gpt-4o-mini-tts';
  const instructions = [cfg.ttsStyle?.trim() || STYLE, cfg.ttsEmotion !== false && MOODS[emotion]].filter(Boolean).join(' ');
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, voice: cfg.ttsOpenaiVoice || 'coral', input: text, response_format: 'mp3', ...(model === 'gpt-4o-mini-tts' && { instructions }) }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw await failure(res, 'OpenAI');
  return Buffer.from(await res.arrayBuffer());
}

async function elevenlabs(text, { cfg, key, emotion }) {
  if (!key) throw Object.assign(new Error('no ElevenLabs key'), { code: 'nokey' });
  const voice = String(cfg.ttsElevenVoice || '').trim();
  if (!voice) throw Object.assign(new Error('pick a voice (or paste its voice ID) first'), { code: 'novoice' });
  const [dStab, dStyle] = (cfg.ttsEmotion !== false && ELEVEN_MOOD[emotion]) || [0, 0];
  const clamp = (v) => Math.min(1, Math.max(0, v));
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'xi-api-key': key, accept: 'audio/mpeg' },
    body: JSON.stringify({
      text,
      model_id: ELEVEN_MODELS.includes(cfg.ttsElevenModel) ? cfg.ttsElevenModel : 'eleven_multilingual_v2',
      voice_settings: {
        stability: clamp(Number(cfg.ttsStability ?? 0.45) + dStab),
        similarity_boost: 0.8,
        style: clamp(Number(cfg.ttsStyleAmount ?? 0.45) + dStyle),
        use_speaker_boost: true,
      },
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw await failure(res, 'ElevenLabs');
  return Buffer.from(await res.arrayBuffer());
}

function customUrl(cfg) {
  const url = String(cfg.ttsUrl || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(url)) throw Object.assign(new Error('no address for your TTS server'), { code: 'nourl' });
  return url;
}

async function custom(text, { cfg, key }) {
  const res = await fetch(`${customUrl(cfg)}/audio/speech`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(key && { authorization: `Bearer ${key}` }) },
    body: JSON.stringify({ model: cfg.ttsCustomModel || 'tts-1', voice: cfg.ttsCustomVoice || 'alloy', input: text, response_format: cfg.ttsCustomFormat || 'mp3', speed: Number(cfg.ttsCustomSpeed) || 1 }),
    signal: AbortSignal.timeout(60000), // a cloning model on a small GPU takes its time
  });
  if (!res.ok) throw await failure(res, 'TTS server');
  return Buffer.from(await res.arrayBuffer());
}

// ---- Piper (offline) -----------------------------------------------------------------------------------

function piperProgram() {
  for (const p of [path.join(piperDir(), 'piper.exe'), path.join(piperDir(), 'piper', 'piper.exe')]) if (fs.existsSync(p)) return p;
  return null;
}

// the .onnx voices in her piper folder (and its voices folder), each with its .onnx.json next to it
function piperModels() {
  const found = [];
  for (const dir of [piperDir(), path.join(piperDir(), 'voices')]) {
    try {
      for (const f of fs.readdirSync(dir)) if (/\.onnx$/i.test(f) && fs.existsSync(path.join(dir, `${f}.json`))) found.push(path.join(dir, f));
    } catch {
      // no such folder yet
    }
  }
  return found;
}

function piper(text, { cfg }) {
  const program = piperProgram();
  if (!program) throw Object.assign(new Error('Piper is not in her speech folder yet'), { code: 'nopiper' });
  const models = piperModels();
  const model = models.find((m) => path.basename(m) === cfg.ttsPiperModel) || models[0];
  if (!model) throw Object.assign(new Error('no Piper voice (.onnx + .onnx.json) in her piper folder'), { code: 'nopiper' });
  const out = path.join(os.tmpdir(), `capri-say-${crypto.randomUUID()}.wav`);
  const speed = Math.min(2, Math.max(0.5, Number(cfg.ttsPiperSpeed) || 1));
  return new Promise((resolve, reject) => {
    const child = spawn(program, ['--model', model, '--output_file', out, '--length_scale', String((1 / speed).toFixed(3))], {
      cwd: path.dirname(program), windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'],
    });
    let errors = '';
    const timer = setTimeout(() => child.kill(), 30000);
    child.stderr.on('data', (d) => { errors += d; });
    child.on('error', (err) => { clearTimeout(timer); reject(err); });
    child.on('close', (code) => {
      clearTimeout(timer);
      try {
        if (code !== 0 || !fs.existsSync(out)) throw new Error(`Piper stopped (${code}): ${errors.trim().split('\n').pop() || ''}`);
        resolve(fs.readFileSync(out));
      } catch (err) {
        reject(err);
      } finally {
        fs.rm(out, { force: true }, () => {});
      }
    });
    child.stdin.end(text);
  });
}

// ---- what her settings show ---------------------------------------------------------------------------

async function voices(engine, { cfg, keys }) {
  if (engine === 'openai') return { voices: OPENAI_VOICES.map((v) => ({ id: v, name: v })), models: OPENAI_MODELS };
  if (engine === 'piper') return { voices: piperModels().map((m) => ({ id: path.basename(m), name: path.basename(m, '.onnx') })), program: Boolean(piperProgram()), folder: piperDir() };
  if (engine === 'elevenlabs') {
    const key = keys.elevenlabs || process.env.ELEVENLABS_API_KEY;
    if (!key) return { voices: [], models: ELEVEN_MODELS, error: 'nokey' };
    const res = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': key }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return { voices: [], models: ELEVEN_MODELS, error: (await failure(res, 'ElevenLabs')).message };
    const { voices: list = [] } = await res.json();
    // your own (cloned, designed) ones first
    const mine = (v) => (['cloned', 'generated', 'professional'].includes(v.category) ? 0 : 1);
    return { voices: list.sort((a, b) => mine(a) - mine(b)).map((v) => ({ id: v.voice_id, name: `${v.name}${mine(v) === 0 ? ' ★' : ''}` })), models: ELEVEN_MODELS };
  }
  if (engine === 'custom') {
    // some servers list their voices (Kokoro-FastAPI: /audio/voices); others just take a name
    try {
      const res = await fetch(`${customUrl(cfg)}/audio/voices`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const body = await res.json();
        const list = Array.isArray(body) ? body : body.voices || [];
        return { voices: list.map((v) => (typeof v === 'string' ? { id: v, name: v } : { id: v.id || v.name, name: v.name || v.id })) };
      }
    } catch {
      // not listed: typed by hand
    }
    return { voices: [] };
  }
  return { voices: [] };
}

// Her line as audio: { ok, audio: Buffer, engine } or { ok: false, error, code }
async function speak(text, { cfg, keys, emotion }) {
  const engine = cfg.ttsEngine;
  const line = said(text);
  if (!line) return { ok: false, error: 'nothing to say' };
  const voice = { openai: `${cfg.ttsOpenaiModel}/${cfg.ttsOpenaiVoice}/${cfg.ttsStyle}`, elevenlabs: `${cfg.ttsElevenModel}/${cfg.ttsElevenVoice}/${cfg.ttsStability}/${cfg.ttsStyleAmount}`, custom: `${cfg.ttsUrl}/${cfg.ttsCustomModel}/${cfg.ttsCustomVoice}/${cfg.ttsCustomSpeed}`, piper: `${cfg.ttsPiperModel}/${cfg.ttsPiperSpeed}` }[engine];
  if (!voice) return { ok: false, error: 'not an engine of hers', code: 'engine' };
  const key = `${engine}|${voice}|${cfg.ttsEmotion === false ? '' : emotion || ''}|${line}`;
  if (cache.has(key)) return { ok: true, audio: cache.get(key), engine };
  try {
    let audio;
    if (engine === 'openai') audio = await openai(line, { cfg, key: keys.openai || process.env.OPENAI_API_KEY, emotion });
    else if (engine === 'elevenlabs') audio = await elevenlabs(line, { cfg, key: keys.elevenlabs || process.env.ELEVENLABS_API_KEY, emotion });
    else if (engine === 'custom') audio = await custom(line, { cfg, key: keys.ttscustom });
    else audio = await piper(line, { cfg });
    return { ok: true, audio: remember(key, audio), engine };
  } catch (err) {
    return { ok: false, error: err.message, code: err.code || null, engine };
  }
}

const PAGES = {
  elevenlabsKeys: 'https://elevenlabs.io/app/settings/api-keys',
  elevenlabsClone: 'https://elevenlabs.io/app/voice-lab',
  openaiKeys: 'https://platform.openai.com/api-keys',
  piper: 'https://github.com/rhasspy/piper/releases',
  piperVoices: 'https://huggingface.co/rhasspy/piper-voices/tree/main',
  kokoro: 'https://github.com/remsky/Kokoro-FastAPI',
  alltalk: 'https://github.com/erew123/alltalk_tts',
};

module.exports = { speak, voices, piperDir, piperProgram, piperModels, PAGES, OPENAI_VOICES, ELEVEN_MODELS, STYLE };

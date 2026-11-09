// Her ears: a voice told from noise, the end of a sentence, your words as you say them, and nothing done with those.

import test from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';

const { Ears, stripWake } = await import('../src/renderer/js/ears.js');
const { Transcript, unfinished } = await import('../src/renderer/js/transcript.js');
const require = createRequire(import.meta.url);
const { createVad, WINDOW } = require('../src/main/voice/vad.js');

const frame = () => new Float32Array(320);
const tick = () => new Promise((r) => setTimeout(r, 0));

function ears(cfg = {}) {
  const calls = { final: 0, partial: 0, audio: [], prep: 0, cancels: 0 };
  const host = {
    transcribe: async () => { calls.final++; return { ok: true, text: calls.finalText ?? 'Capri buka notepad' }; },
    transcribePartial: async () => { calls.partial++; return calls.partialRes ?? { ok: true, text: 'Capri buka' }; },
    cancelPartial: () => { calls.cancels++; },
    earsAudio: (samples, name) => calls.audio.push({ n: samples.length, name }),
    voicePrep: () => { calls.prep++; },
  };
  const e = new Ears({ host, button: null });
  e.cfg = { silenceMs: 900, ...cfg };
  e.mode = cfg.mode || 'always';
  e.stream = {}; // the microphone, as if open
  e.lastPartial = -1e9; // (these tests pass in no time at all)
  const heard = [];
  const shown = [];
  e.onHeard = (text, info) => heard.push({ text, info });
  e.onPartial = (p) => shown.push(p);
  return { e, calls, heard, shown };
}

const run = (e, ms, rms) => { for (let t = 0; t < ms; t += 20) e.frame(rms, frame()); };

test('a voice: written out once it stops', async () => {
  const { e, calls, heard } = ears();
  e.speechSignal(false);
  run(e, 100, 0.2);
  e.speechSignal(true);
  run(e, 800, 0.2);
  assert.strictEqual(calls.final, 0, 'not while you are talking');
  e.speechSignal(false);
  run(e, 700, 0.001);
  await tick();
  assert.strictEqual(calls.final, 1);
  assert.deepStrictEqual(heard.map((h) => h.text), ['buka notepad']);
});

test('loud but no voice in it: nothing is written out', async () => {
  const { e, calls } = ears();
  e.speechSignal(false);
  run(e, 2000, 0.3); // a keyboard, a door
  await tick();
  assert.strictEqual(calls.final, 0);
});

test('a song that stays loud: the sentence still ends when your voice does', async () => {
  const { e, calls } = ears();
  e.speechSignal(true);
  run(e, 800, 0.2);
  e.speechSignal(false);
  run(e, 700, 0.2);
  await tick();
  assert.strictEqual(calls.final, 1);
});

test('no detector: loudness alone, as before', async () => {
  const { e, calls } = ears();
  run(e, 800, 0.2);
  run(e, 1000, 0.0001);
  await tick();
  assert.strictEqual(calls.final, 1);
});

test('the sound goes to main in 100 ms pieces; her name is listened for only when it should be', () => {
  const a = ears();
  a.e.cfg.wakeWord = true;
  run(a.e, 400, 0.001);
  assert.deepStrictEqual(a.calls.audio.map((x) => x.n), [1600, 1600, 1600, 1600]);
  assert.ok(a.calls.audio.every((x) => x.name));
  const b = ears({ mode: 'push' });
  b.e.armed = true;
  run(b.e, 200, 0.001);
  assert.ok(b.calls.audio.every((x) => !x.name), 'push to talk needs no name');
});

test('your words as you say them: shown, and never acted on', async () => {
  const { e, calls, heard, shown } = ears();
  e.speechSignal(true);
  run(e, 1400, 0.2);
  await tick();
  assert.strictEqual(calls.partial, 1);
  assert.strictEqual(shown.at(-1).text, 'Capri buka');
  assert.strictEqual(calls.prep, 1, 'her model woken up meanwhile');
  assert.deepStrictEqual(heard, [], 'nothing done yet');
  e.speechSignal(false);
  run(e, 700, 0.001);
  await tick();
  assert.strictEqual(heard.length, 1);
  assert.ok(calls.cancels >= 1, 'the pass still going is dropped');
  assert.strictEqual(shown.at(-1), null);
});

test('listening all the time: what is not said to her is not shown', async () => {
  const { e, calls, shown } = ears();
  calls.partialRes = { ok: true, text: 'jadi tadi aku ke pasar' };
  e.speechSignal(true);
  run(e, 1400, 0.2);
  await tick();
  assert.strictEqual(calls.partial, 1);
  assert.deepStrictEqual(shown, []);
});

test('ears that are not Whisper on this PC: no more passes', async () => {
  const { e, calls } = ears();
  calls.partialRes = { ok: false, off: true };
  e.speechSignal(true);
  run(e, 1400, 0.2);
  await tick();
  run(e, 3000, 0.2);
  await tick();
  assert.strictEqual(calls.partial, 1);
});

test('a sentence that stops on "yang" waits longer for the rest', async () => {
  const { e, calls } = ears();
  calls.partialRes = { ok: true, text: 'Capri buka file yang' };
  e.speechSignal(true);
  run(e, 1400, 0.2);
  await tick();
  e.speechSignal(false);
  run(e, 700, 0.001);
  await tick();
  assert.strictEqual(calls.final, 0, 'still waiting');
  run(e, 520, 0.001);
  await tick();
  assert.strictEqual(calls.final, 1);
});

test('transcript: what stayed the same is stable', () => {
  const t = new Transcript();
  assert.deepStrictEqual(t.partial('Capri buka'), { text: 'Capri buka', stable: '', tail: 'Capri buka' });
  assert.deepStrictEqual(t.partial('capri, buka note'), { text: 'capri, buka note', stable: 'capri, buka', tail: 'note' });
  assert.deepStrictEqual(t.partial('Capri buka notepad'), { text: 'Capri buka notepad', stable: 'Capri buka', tail: 'notepad' });
  t.reset();
  assert.strictEqual(t.partial('halo').stable, '');
});

test('what sounds unfinished', () => {
  for (const s of ['buka file yang', 'open the', 'aku mau makan dan', 'kirim ke']) assert.ok(unfinished(s), s);
  for (const s of ['buka notepad', 'open notepad.', 'halo capri', '']) assert.ok(!unfinished(s), s);
});

test('stripWake still finds her name', () => {
  assert.strictEqual(stripWake('Capri, buka notepad'), 'buka notepad');
  assert.strictEqual(stripWake('buka notepad'), null);
});

test('the detector: whole windows at a time, the rest kept for next time', () => {
  const seen = [];
  let empty = false;
  class Vad {
    acceptWaveform(s) { seen.push(s.length); empty = false; }
    isEmpty() { return empty; }
    pop() { empty = true; }
    isDetected() { return true; }
    reset() {}
  }
  const vad = createVad({ load: () => ({ Vad }), file: () => 'x' });
  assert.strictEqual(vad.push(new Float32Array(1600)), true);
  assert.deepStrictEqual(seen, [WINDOW, WINDOW, WINDOW]);
  vad.push(new Float32Array(1600));
  assert.strictEqual(seen.length, 6, 'what was left over counts');
  vad.unload();
});

test('no detector to be had: "can\'t tell", not a crash', () => {
  const vad = createVad({ load: () => { throw new Error('no addon'); }, file: () => 'x' });
  const err = console.error;
  console.error = () => {};
  assert.strictEqual(vad.push(new Float32Array(1600)), null);
  console.error = err;
});

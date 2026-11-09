'use strict';

// Is someone speaking? Silero's voice activity detector (sherpa-onnx, assets/wake/silero_vad.onnx), on this PC. Loudness
// alone can't tell a voice from a fan, a keyboard or a song; this can. Her ears still start on loudness (it's instant) and
// ask this whether it was a voice and when it stopped.

const path = require('node:path');

const WINDOW = 512; // the samples Silero wants at a time, at 16 kHz
const IDLE_MS = 5 * 60000;

const model = () => path.join(__dirname, '..', '..', '..', 'assets', 'wake', 'silero_vad.onnx').replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);

// load: the sherpa-onnx module, for tests. -> { push(samples) -> true | false | null (can't tell), reset(), unload() }
function createVad({ load = () => require('sherpa-onnx-node'), file = model } = {}) {
  let vad = null;
  let failed = false;
  let rest = new Float32Array(0);
  let idle = null;

  function ensure() {
    if (vad || failed) return Boolean(vad);
    try {
      const { Vad } = load();
      vad = new Vad({ sileroVad: { model: file(), threshold: 0.5, minSpeechDuration: 0.2, minSilenceDuration: 0.25, maxSpeechDuration: 30, windowSize: WINDOW }, sampleRate: 16000, numThreads: 1, provider: 'cpu', debug: 0 }, 30);
      return true;
    } catch (err) {
      failed = true; // her ears go on with loudness alone, as they always did
      console.error('[capri] voice detector:', err.message);
      return false;
    }
  }

  const unload = () => {
    vad = null;
    rest = new Float32Array(0);
  };

  return {
    push(samples) {
      if (!samples?.length || !ensure()) return null;
      clearTimeout(idle);
      idle = setTimeout(unload, IDLE_MS);
      idle.unref?.();
      const all = new Float32Array(rest.length + samples.length);
      all.set(rest);
      all.set(samples, rest.length);
      let at = 0;
      for (; at + WINDOW <= all.length; at += WINDOW) vad.acceptWaveform(all.subarray(at, at + WINDOW));
      rest = all.slice(at);
      while (!vad.isEmpty()) vad.pop(); // only whether someone's speaking matters here, not the pieces it keeps
      return vad.isDetected();
    },
    reset() {
      vad?.reset();
      rest = new Float32Array(0);
    },
    unload,
  };
}

module.exports = { createVad, WINDOW };

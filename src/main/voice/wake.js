'use strict';

// Her name, heard the moment you say it, on this PC, before anything is written out. A very small speech model
// (sherpa-onnx keyword spotting, assets/wake, about 2% of one CPU core) listens for "Capri" in what her ears are hearing.
// It misses some, so it's never the only way in: what you said is still written out and looked at for her name
// (ears.js). What this adds is that she reacts at once, and a name the transcription got wrong still counts.

const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

const KEYWORDS = ['▁CA P RI', '▁C A P RI', '▁K A P RI', '▁CA P RE', '▁CA P R E', '▁K A P R E', '▁CO P RI', '▁CA P R I'];
const BOOST = 3;
const THRESHOLD = 0.05;
const REST_MS = 1200;      // one "Capri" is one hit
const IDLE_MS = 5 * 60000; // no audio for this long: the model leaves memory

const assets = () => path.join(__dirname, '..', '..', '..', 'assets', 'wake').replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);

let spotter = null;
let stream = null;
let failed = false;
let lastHit = 0;
let idleTimer = null;

function load() {
  if (spotter || failed) return Boolean(spotter);
  try {
    const { KeywordSpotter } = require('sherpa-onnx-node');
    const dir = assets();
    const keywordsFile = path.join(app.getPath('userData'), 'wake-keywords.txt');
    fs.writeFileSync(keywordsFile, `${KEYWORDS.map((k) => `${k} :${BOOST} #${THRESHOLD} @capri`).join('\n')}\n`);
    spotter = new KeywordSpotter({
      featConfig: { sampleRate: 16000, featureDim: 80 },
      modelConfig: {
        transducer: { encoder: path.join(dir, 'encoder.int8.onnx'), decoder: path.join(dir, 'decoder.int8.onnx'), joiner: path.join(dir, 'joiner.int8.onnx') },
        tokens: path.join(dir, 'tokens.txt'),
        numThreads: 1,
        provider: 'cpu',
        debug: 0,
      },
      maxActivePaths: 4,
      numTrailingBlanks: 1,
      keywordsScore: BOOST,
      keywordsThreshold: THRESHOLD,
      keywordsFile,
    });
    stream = spotter.createStream();
    return true;
  } catch (err) {
    failed = true; // her ears go on without it, as they always did
    console.error('[capri] wake word:', err.message);
    return false;
  }
}

function unload() {
  spotter = null;
  stream = null;
}

// 16 kHz mono samples; true when her name is in them.
function push(samples) {
  if (!samples?.length || !load()) return false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(unload, IDLE_MS);
  idleTimer.unref?.();
  stream.acceptWaveform({ sampleRate: 16000, samples });
  let heard = false;
  while (spotter.isReady(stream)) {
    spotter.decode(stream);
    if (spotter.getResult(stream).keyword) {
      spotter.reset(stream);
      heard = true;
    }
  }
  if (!heard) return false;
  const now = Date.now();
  if (now - lastHit < REST_MS) return false;
  lastHit = now;
  return true;
}

module.exports = { push, unload };

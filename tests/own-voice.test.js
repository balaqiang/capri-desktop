'use strict';

require('./electron-stub');
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { checkManifest, download, installed, PIPER, RELEASE } = require('../src/main/voice/own-voice');

const sha = 'a'.repeat(64);
const good = { name: 'en_US-capri-medium', files: [{ file: 'en_US-capri-medium.onnx', bytes: 60, sha256: sha }, { file: 'en_US-capri-medium.onnx.json', bytes: 5, sha256: sha }] };

test('capri-voice.json is believed only when it is sound', () => {
  assert.deepStrictEqual(checkManifest(good), good);
  const bad = (change) => assert.throws(() => checkManifest({ ...good, ...change }));
  bad({ name: '../evil' });
  bad({ files: [{ ...good.files[0], file: '../../piper.exe' }, good.files[1]] });
  bad({ files: [{ ...good.files[0], file: 'other.onnx' }, good.files[1]] });
  bad({ files: [{ ...good.files[0], bytes: 900 * 1024 * 1024 }, good.files[1]] });
  bad({ files: [{ ...good.files[0], sha256: 'xyz' }, good.files[1]] });
  bad({ files: [good.files[0]] });
});

function fakeSpeech({ withPiper = false } = {}) {
  const speech = fs.mkdtempSync(path.join(os.tmpdir(), 'capri-voice-test-'));
  if (withPiper) {
    fs.mkdirSync(path.join(speech, 'piper'), { recursive: true });
    fs.writeFileSync(path.join(speech, 'piper', 'piper.exe'), 'x');
  }
  const asked = [];
  const getChecked = async (url, bytes, hash, dir, onBytes) => {
    asked.push(url);
    onBytes(bytes);
    const part = path.join(dir, `part-${asked.length}`);
    fs.writeFileSync(part, url);
    return part;
  };
  return { speech, asked, getChecked };
}

test('her voice comes from the latest release, both files, into the voices folder', async () => {
  const { speech, asked, getChecked } = fakeSpeech({ withPiper: true });
  const seen = [];
  const res = await download((p) => seen.push(p.percent), new AbortController().signal, { speech, getChecked, fetchManifest: async () => good });
  assert.deepStrictEqual(res, { name: 'en_US-capri-medium' });
  assert.deepStrictEqual(asked, good.files.map((f) => RELEASE + f.file), 'Piper is already there: not downloaded again');
  assert.deepStrictEqual(installed(speech), ['en_US-capri-medium']);
  assert.strictEqual(seen.at(-1), 100);
  assert.deepStrictEqual(fs.readdirSync(speech).filter((f) => f.startsWith('part-')), [], 'nothing left behind');
});

test('Piper comes first when it is missing, from its official release', async () => {
  const { speech, asked, getChecked } = fakeSpeech();
  let unpacked = null;
  await download(() => {}, new AbortController().signal, { speech, getChecked, fetchManifest: async () => good, unpackPiper: async (zip, target) => { unpacked = target; fs.mkdirSync(target, { recursive: true }); fs.writeFileSync(path.join(target, 'piper.exe'), 'x'); } });
  assert.strictEqual(asked[0], PIPER.url);
  assert.ok(unpacked.endsWith('piper'));
});

test('a voice is never half replaced: if one file fails, the old one stays', async () => {
  const { speech, getChecked } = fakeSpeech({ withPiper: true });
  const old = path.join(speech, 'piper', 'voices');
  fs.mkdirSync(old, { recursive: true });
  fs.writeFileSync(path.join(old, 'en_US-capri-medium.onnx'), 'old');
  fs.writeFileSync(path.join(old, 'en_US-capri-medium.onnx.json'), 'old');
  let n = 0;
  const failing = async (...args) => {
    if (++n === 2) throw new Error('The download was not the file it should be, so it was not used.');
    return getChecked(...args);
  };
  await assert.rejects(download(() => {}, new AbortController().signal, { speech, getChecked: failing, fetchManifest: async () => good }));
  assert.strictEqual(fs.readFileSync(path.join(old, 'en_US-capri-medium.onnx'), 'utf8'), 'old');
});

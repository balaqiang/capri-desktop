#!/usr/bin/env node
'use strict';

// Her voice, ready to attach to a GitHub release: node scripts/voice-release.js <voice.onnx> [folder]
// Copies the .onnx and its .onnx.json into dist/voice (or [folder]) and writes capri-voice.json with their sizes and fingerprints. Attach all
// three files to the release; "Capri's own voice" in her settings downloads them from the latest release and checks every byte.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { checkManifest, MANIFEST } = require('../src/main/voice/own-voice');

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function main() {
  const [voice, folder = path.join(__dirname, '..', 'dist', 'voice')] = process.argv.slice(2);
  if (!voice || !/\.onnx$/i.test(voice) || !fs.existsSync(voice) || !fs.existsSync(`${voice}.json`)) {
    console.error('usage: node scripts/voice-release.js <voice.onnx> [folder]   (its .onnx.json next to it)');
    process.exit(2);
  }
  const name = path.basename(voice).replace(/\.onnx$/i, '');
  fs.mkdirSync(folder, { recursive: true });
  const files = [`${name}.onnx`, `${name}.onnx.json`].map((file, i) => {
    const from = i ? `${voice}.json` : voice;
    const to = path.join(folder, file);
    fs.copyFileSync(from, to);
    return { file, bytes: fs.statSync(to).size, sha256: sha256(to) };
  });
  const manifest = checkManifest({ name, files });
  fs.writeFileSync(path.join(folder, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`attach these to the release:\n${[...files.map((f) => f.file), MANIFEST].map((f) => `  ${path.join(folder, f)}`).join('\n')}`);
}

if (require.main === module) main();

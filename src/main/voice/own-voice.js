'use strict';

// Capri's own voice, downloaded when you ask (Settings, Voice): Piper for Windows from its official release, and her voice from this app's
// latest release on GitHub. Every file is checked by size and SHA-256 before it's used: Piper's against the numbers here, her voice's against
// capri-voice.json, published in the same release (node scripts/voice-release.js makes it). Nothing is run while downloading.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');

const PIPER = {
  url: 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip',
  bytes: 22477236,
  sha: 'f3c58906402b24f3a96d92145f58acba6d86c9b5db896d207f78dc80811efcea',
};
const RELEASE = 'https://github.com/balaqiang/capri-desktop/releases/latest/download/';
const MANIFEST = 'capri-voice.json';
const MAX_BYTES = 300 * 1024 * 1024;
const FILE = /^[A-Za-z0-9_-][A-Za-z0-9_.-]*\.onnx(?:\.json)?$/;

// What capri-voice.json says, if it's sound. -> { name, files: [{ file, bytes, sha256 }] }, or throws
function checkManifest(m) {
  const name = String(m?.name || '');
  const files = Array.isArray(m?.files) ? m.files : [];
  if (!/^[A-Za-z0-9_-]+$/.test(name)) throw new Error('capri-voice.json has no proper name');
  const want = new Set([`${name}.onnx`, `${name}.onnx.json`]);
  for (const f of files) {
    if (!FILE.test(String(f?.file)) || !want.has(f.file)) throw new Error(`capri-voice.json lists an unexpected file: ${String(f?.file).slice(0, 60)}`);
    if (!Number.isInteger(f.bytes) || f.bytes <= 0 || f.bytes > MAX_BYTES) throw new Error(`capri-voice.json gives ${f.file} an impossible size`);
    if (!/^[0-9a-f]{64}$/.test(String(f.sha256))) throw new Error(`capri-voice.json gives ${f.file} no proper fingerprint`);
  }
  if (files.length !== 2 || new Set(files.map((f) => f.file)).size !== 2) throw new Error('capri-voice.json must list the .onnx and its .onnx.json');
  return { name, files: files.map(({ file, bytes, sha256 }) => ({ file, bytes, sha256 })) };
}

const piperDir = (speech) => path.join(speech, 'piper');
const hasPiper = (speech) => ['piper.exe', 'piper/piper.exe'].some((p) => fs.existsSync(path.join(piperDir(speech), p)));
const voicesDir = (speech) => path.join(piperDir(speech), 'voices');

// Her voices already here (any Capri voice with both of its files).
function installed(speech) {
  try {
    return fs.readdirSync(voicesDir(speech)).filter((f) => /capri.*\.onnx$/i.test(f) && fs.existsSync(path.join(voicesDir(speech), `${f}.json`))).map((f) => f.replace(/\.onnx$/i, ''));
  } catch {
    return [];
  }
}

// Piper's whole folder (piper.exe, its libraries, espeak-ng-data) out of the zip, into hers.
function unpackPiper(zip, target) {
  const tmp = path.join(os.tmpdir(), `capri-piper-${crypto.randomUUID()}`);
  fs.mkdirSync(tmp, { recursive: true });
  return new Promise((resolve, reject) => {
    execFile('tar.exe', ['-xf', zip, '-C', tmp], { windowsHide: true, timeout: 120000 }, (err) => {
      try {
        if (err) throw new Error('could not unpack Piper');
        const inside = [tmp, path.join(tmp, 'piper')].find((d) => fs.existsSync(path.join(d, 'piper.exe')));
        if (!inside) throw new Error('piper.exe was not in the download');
        fs.mkdirSync(target, { recursive: true });
        fs.cpSync(inside, target, { recursive: true, force: true });
        resolve();
      } catch (e) {
        reject(e);
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });
  });
}

async function fetchManifest(signal) {
  const res = await fetch(RELEASE + MANIFEST, { headers: { 'user-agent': 'Capri' }, redirect: 'follow', signal });
  if (res.status === 404) throw Object.assign(new Error("Her voice isn't in the latest release yet."), { code: 'novoice' });
  if (!res.ok || !res.url.startsWith('https:')) throw new Error(`download failed (${res.status})`);
  return checkManifest(await res.json());
}

// deps: { speech, getChecked(url, bytes, sha, dir, onBytes, signal) -> part file, fetchManifest, unpackPiper } -> { name }
async function download(onProgress, signal, deps) {
  const { speech, getChecked } = deps;
  const manifest = await (deps.fetchManifest || fetchManifest)(signal);
  const needPiper = !hasPiper(speech);
  const total = (needPiper ? PIPER.bytes : 0) + manifest.files.reduce((sum, f) => sum + f.bytes, 0);
  let before = 0;
  const report = (n) => onProgress({ done: before + n, total, percent: Math.min(99, Math.floor(((before + n) * 100) / Math.max(1, total))) });
  fs.mkdirSync(voicesDir(speech), { recursive: true });
  if (needPiper) {
    const zip = await getChecked(PIPER.url, PIPER.bytes, PIPER.sha, speech, report, signal);
    try {
      await (deps.unpackPiper || unpackPiper)(zip, piperDir(speech));
    } finally {
      fs.rmSync(zip, { force: true });
    }
    before += PIPER.bytes;
  }
  // both files fetched and checked before either replaces what was there
  const parts = [];
  try {
    for (const f of manifest.files) {
      parts.push([await getChecked(RELEASE + f.file, f.bytes, f.sha256, speech, report, signal), f.file]);
      before += f.bytes;
    }
    for (const [part, file] of parts) {
      const final = path.join(voicesDir(speech), file);
      fs.rmSync(final, { force: true });
      fs.renameSync(part, final);
    }
  } finally {
    for (const [part] of parts) fs.rmSync(part, { force: true });
  }
  onProgress({ done: total, total, percent: 100 });
  return { name: manifest.name };
}

module.exports = { checkManifest, download, installed, hasPiper, PIPER, RELEASE, MANIFEST };

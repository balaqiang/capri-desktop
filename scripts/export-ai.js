#!/usr/bin/env node
'use strict';

// One Illustrator file, exported piece by piece: node scripts/export-ai.js drawing.ai [folder]
// It runs in your Illustrator (tools/illustrator/export-layers.jsx). Your file isn't saved or changed; if it was closed it's closed
// again. Layer names like arm_L come out of Illustrator as arm_x5F_L: they're put right, and the whole drawing is checked as her body.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, execSync } = require('node:child_process');
const { decodeIds } = require('./check-blueprint');

const JSX = path.join(__dirname, '..', 'tools', 'illustrator', 'export-layers.jsx');
const WAIT = 15 * 60000;

// The script with what it needs written in front of it. Paths are JSON strings, so nothing in one can become code.
function scriptFor({ file, out, report, quit = false }, body = fs.readFileSync(JSX, 'utf8')) {
  const str = (p) => JSON.stringify(path.resolve(p).replace(/\\/g, '/'));
  return `var CAPRI_FILE = ${str(file)};\nvar CAPRI_OUT = ${str(out)};\nvar CAPRI_REPORT = ${str(report)};\nvar CAPRI_QUIT = ${quit === true};\n${body}`;
}

function findIllustrator() {
  if (process.env.ILLUSTRATOR_EXE) return process.env.ILLUSTRATOR_EXE;
  try {
    const out = execSync('powershell -NoProfile -Command "(Get-ChildItem \'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\' | Where-Object { $_.PSChildName -match \'Illustrator\' } | Select-Object -First 1 | ForEach-Object { $_.GetValue(\'\') })"', { encoding: 'utf8', windowsHide: true }).trim();
    return out || null;
  } catch {
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const quit = args.includes('--quit');
  const [file, folder] = args.filter((a) => a !== '--quit');
  if (!file || !fs.existsSync(file)) {
    console.error('usage: node scripts/export-ai.js <drawing.ai> [folder]');
    process.exit(2);
  }
  const exe = findIllustrator();
  if (!exe) {
    console.error("Illustrator wasn't found. Set ILLUSTRATOR_EXE to where Illustrator.exe is.");
    process.exit(1);
  }
  const out = path.resolve(folder || `${file.replace(/\.[^.]+$/, '')}-export`);
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'capri-ai-'));
  const report = path.join(work, 'report.json');
  const script = path.join(work, 'export.jsx');
  fs.writeFileSync(script, scriptFor({ file, out, report, quit }));
  spawn(exe, [script], { detached: true, stdio: 'ignore' }).unref();
  const until = Date.now() + WAIT;
  while (!fs.existsSync(report)) {
    if (Date.now() > until) throw new Error('Illustrator did not finish in fifteen minutes.');
    await new Promise((r) => setTimeout(r, 500));
  }
  const res = JSON.parse(fs.readFileSync(report, 'utf8'));
  for (const f of fs.readdirSync(out).filter((x) => x.endsWith('.svg'))) {
    const p = path.join(out, f);
    fs.writeFileSync(p, decodeIds(fs.readFileSync(p, 'utf8')));
  }
  console.log(`${res.pieces} pieces in ${res.folder}`);
  for (const e of res.errors) console.log(`  failed: ${e}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { scriptFor };

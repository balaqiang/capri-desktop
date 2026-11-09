'use strict';

// Her files on this PC, written so a crash or a power cut halfway through never leaves half a file: the new
// text goes to "name.tmp" first, then takes the old one's place in one step (a rename). The last good copy
// stays as "name.bak", and a file that can't be read any more is kept aside ("name.broken-<time>") and the
// .bak read instead, so your settings, keys and her memory of you survive it.
//
//   writeAtomic(file, text)            readJson(file) -> the object, or undefined (none, or none readable)

const fs = require('node:fs');
const path = require('node:path');

const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function writeAtomic(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, text);
  // the old one kept as the last good copy (only when it reads: a broken file never replaces a good .bak)
  try {
    if (fs.existsSync(file)) {
      const old = fs.readFileSync(file, 'utf8');
      if (old.trim()) { JSON.parse(old); fs.copyFileSync(file, `${file}.bak`); }
    }
  } catch { /* not JSON, or unreadable: the .bak stays as it was */ }
  // a virus scanner or a backup tool can hold the file a moment: tried again, then written in place
  for (let i = 0; i < 5; i++) {
    try {
      fs.renameSync(tmp, file);
      return;
    } catch (err) {
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(err.code)) throw err;
      sleepSync(40 * (i + 1));
    }
  }
  fs.writeFileSync(file, text);
  try { fs.unlinkSync(tmp); } catch { /* gone already */ }
}

function parse(file) {
  const text = fs.readFileSync(file, 'utf8');
  return text.trim() ? JSON.parse(text) : undefined;
}

function readJson(file) {
  if (!fs.existsSync(file)) {
    // only the .tmp is there: written, never put in place (the crash came between the two)
    for (const other of [`${file}.tmp`, `${file}.bak`]) {
      try { if (fs.existsSync(other)) return parse(other); } catch { /* next one */ }
    }
    return undefined;
  }
  try {
    return parse(file);
  } catch (err) {
    console.error(`[capri] ${path.basename(file)} can't be read (${err.message}): kept aside, the last good copy used`);
    try { fs.copyFileSync(file, `${file}.broken-${Date.now()}`); } catch { /* still read the .bak */ }
    try { return parse(`${file}.bak`); } catch { return undefined; }
  }
}

module.exports = { writeAtomic, readJson };

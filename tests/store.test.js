'use strict';
// Her files survive a crash halfway through a write (src/main/store.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { writeAtomic, readJson } = require('../src/main/store');

const fresh = () => fs.mkdtempSync(path.join(os.tmpdir(), 'capri-store-'));

test('written, read back, the old one kept as .bak', () => {
  const file = path.join(fresh(), 'sub', 'config.json');
  writeAtomic(file, JSON.stringify({ a: 1 }));
  assert.deepEqual(readJson(file), { a: 1 });
  writeAtomic(file, JSON.stringify({ a: 2 }));
  assert.deepEqual(readJson(file), { a: 2 });
  assert.deepEqual(JSON.parse(fs.readFileSync(`${file}.bak`, 'utf8')), { a: 1 });
  assert.equal(fs.existsSync(`${file}.tmp`), false);
});

test('a broken file: kept aside, the last good copy read', () => {
  const dir = fresh();
  const file = path.join(dir, 'config.json');
  writeAtomic(file, JSON.stringify({ key: 'one' }));
  writeAtomic(file, JSON.stringify({ key: 'two' }));
  fs.writeFileSync(file, '{"key": "tw'); // cut off halfway
  const errors = [];
  const log = console.error;
  console.error = (m) => errors.push(m);
  try {
    assert.deepEqual(readJson(file), { key: 'one' });
  } finally {
    console.error = log;
  }
  assert.ok(fs.readdirSync(dir).some((f) => f.startsWith('config.json.broken-')));
  assert.equal(errors.length, 1);
  // a broken file never replaces the good .bak
  writeAtomic(file, JSON.stringify({ key: 'three' }));
  assert.deepEqual(JSON.parse(fs.readFileSync(`${file}.bak`, 'utf8')), { key: 'one' });
});

test('the crash between the two steps: the .tmp is read', () => {
  const file = path.join(fresh(), 'memory.json');
  fs.writeFileSync(`${file}.tmp`, JSON.stringify({ history: [1] }));
  assert.deepEqual(readJson(file), { history: [1] });
});

test('nothing there', () => {
  assert.equal(readJson(path.join(fresh(), 'none.json')), undefined);
});

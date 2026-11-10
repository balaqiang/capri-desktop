'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const dataset = require('../src/main/training/dataset');

const file = path.join(__dirname, '..', 'assets', 'finetune', 'curated.jsonl');
const curated = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const answers = curated.flatMap((r) => r.turns.filter((t) => t.role === 'assistant').map((t) => t.content));

test('there is a lot to learn from, of every kind', () => {
  assert.ok(curated.length >= 900, String(curated.length));
  const cats = new Set(curated.map((r) => r.cat));
  for (const c of ['lore', 'media', 'opinion', 'body', 'owner', 'conversation', 'feelings', 'honest']) assert.ok(cats.has(c), c);
});

test('every answer has one of her emotion tags, and is short', () => {
  for (const a of answers) {
    assert.match(a, /^\[(happy|jealous|bored|glitch|annoyed)\] /, a);
    assert.ok(a.length <= 500, a);
  }
});

test('all of it can be used, nothing repeats', () => {
  const built = dataset.build({ persona: 'P', curated });
  assert.strictEqual(built.dropped, 0);
  assert.strictEqual(built.used, curated.length);
});

test('notes about you and her body come right before the last thing you said', () => {
  const row = { turns: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }, { role: 'user', content: 'c' }, { role: 'assistant', content: 'd' }], context: 'NOTE' };
  assert.deepStrictEqual(dataset.curatedMessages('P', row).map((m) => m.content), ['P', 'a', 'b', 'NOTE', 'c', 'd']);
});

test('a tenth is held back, and always the same tenth', () => {
  const { rows } = dataset.build({ persona: 'P', curated });
  const a = dataset.split(rows);
  const b = dataset.split(rows);
  assert.strictEqual(a.valid.length + a.train.length, rows.length);
  assert.deepStrictEqual(a.valid, b.valid);
  assert.ok(a.valid.length > rows.length * 0.05 && a.valid.length < rows.length * 0.16, String(a.valid.length));
});

test('a row that breaks character or has the wrong shape is refused', () => {
  assert.ok(!dataset.usableCurated({ turns: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'As an AI, I cannot.' }] }));
  assert.ok(!dataset.usableCurated({ turns: [{ role: 'user', content: 'a' }] }));
});

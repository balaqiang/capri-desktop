'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { utterances } = require('../scripts/piper-dataset');

const spoken = (line, start = 0, each = 0.4) => line.split(' ').map((text, i) => ({ text, from: start + i * each, to: start + (i + 1) * each }));

test('one clip a sentence', () => {
  const out = utterances(spoken('Hello there my friend. How are you doing today?'));
  assert.deepStrictEqual(out.map((c) => c.text), ['Hello there my friend.', 'How are you doing today?']);
  assert.ok(out[0].to <= out[1].from);
});

test('a long pause ends a clip', () => {
  const out = utterances([...spoken('one two three four', 0), ...spoken('five six seven eight', 10)]);
  assert.strictEqual(out.length, 2);
});

test('laughs and screams are cut out, even written over several words', () => {
  const out = utterances([...spoken('I am so happy.'), ...[{ text: '[', from: 2, to: 2.1 }, { text: 'laughs', from: 2.1, to: 2.5 }, { text: ']', from: 2.5, to: 2.6 }], ...spoken('That was very funny.', 2.7), { text: '[screams]', from: 5, to: 6 }, ...spoken('Now we can go.', 6.1)]);
  assert.deepStrictEqual(out.map((c) => c.text), ['I am so happy.', 'That was very funny.', 'Now we can go.']);
});

test('nothing too short or too long', () => {
  assert.deepStrictEqual(utterances(spoken('Yes.')), [], 'a single word teaches little');
  const out = utterances(spoken(Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ')));
  assert.ok(out.length >= 2);
  for (const c of out) assert.ok(c.to - c.from <= 10.01);
});

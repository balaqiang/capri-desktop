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

const { clipsAtPauses } = require('../scripts/piper-dataset');

test('clips are cut inside real pauses, never inside a sound', () => {
  // two sentences with a pause after each; Whisper's word times end a little early, as they do
  const words = [...spoken('Hello there my friend.', 0.5, 0.4), ...spoken('How are you doing today?', 3, 0.4)];
  const pauses = [{ from: 0, to: 0.45 }, { from: 2.25, to: 2.95 }, { from: 5.1, to: 6 }];
  const out = clipsAtPauses(words, pauses);
  assert.deepStrictEqual(out.map((c) => c.text), ['Hello there my friend.', 'How are you doing today?']);
  for (const c of out) {
    const before = pauses.find((p) => c.from >= p.from && c.from <= p.to);
    const after = pauses.find((p) => c.to >= p.from && c.to <= p.to);
    assert.ok(before && after, `${c.text}: ${c.from}-${c.to} starts and ends in a pause`);
  }
});

test('a sentence that pauses in the middle stays one clip; a laugh between pauses is left out', () => {
  const words = [...spoken('I was thinking,', 0, 0.4), ...spoken('maybe we should go.', 2, 0.4), { text: '[laughs]', from: 4.5, to: 5 }, ...spoken('Okay then, see you.', 6, 0.4)];
  const pauses = [{ from: 1.2, to: 1.9 }, { from: 3.6, to: 4.4 }, { from: 5.2, to: 5.9 }, { from: 7.6, to: 8.5 }];
  assert.deepStrictEqual(clipsAtPauses(words, pauses).map((c) => c.text), ['I was thinking, maybe we should go.', 'Okay then, see you.']);
});

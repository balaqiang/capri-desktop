// Her voice as her answer comes in: whole sentences, said in order, her ears shut from the first to the last.

import test from 'node:test';
import assert from 'node:assert';

const spoken = [];
globalThis.speechSynthesis = {
  speaking: false,
  pending: false,
  addEventListener() {},
  getVoices: () => [],
  cancel() { spoken.cancelled = (spoken.cancelled || 0) + 1; },
  speak(u) {
    spoken.push(u.text);
    u.onstart?.();
    setTimeout(() => u.onend?.(), 5);
  },
};
globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
globalThis.document = { documentElement: { lang: 'en' } };

const { Sentencer } = await import('../src/renderer/js/sentences.js');
const { Mouth } = await import('../src/renderer/js/tts.js');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cut(text, size = 3) {
  const s = new Sentencer();
  const out = [];
  for (let i = 0; i < text.length; i += size) out.push(...s.push(text.slice(i, i + size)));
  const rest = s.end();
  return rest ? [...out, rest] : out;
}

test('sentences: where they end', () => {
  assert.deepStrictEqual(cut('Harganya 3.14 dolar, kata Dr. Budi. Oke kan?'), ['Harganya 3.14 dolar, kata Dr. Budi.', 'Oke kan?']);
  assert.deepStrictEqual(cut('Oh. Hai! That is a good one, choom.'), ['Oh. Hai! That is a good one, choom.']);
  assert.deepStrictEqual(cut('First line goes here\nSecond line'), ['First line goes here', 'Second line']);
});

test('sentences: her tags stay whole, a half tag is dropped', () => {
  assert.deepStrictEqual(cut('Wave at them. Really? [[move: wave]] Yes, do that.', 1).join(' ').includes('[[move: wave]]'), true);
  assert.deepStrictEqual(cut('That was the whole thing, ok [[mov'), ['That was the whole thing, ok']);
});

test('a sentence that never ends is cut at a comma', () => {
  const long = `${'kata '.repeat(40)}, ${'lagi '.repeat(30)}`;
  const s = new Sentencer();
  assert.strictEqual(s.push(long).length, 1);
});

function mouth() {
  spoken.length = 0;
  const m = new Mouth({});
  m.configure({ tts: true, ttsEngine: 'windows' });
  const ears = [];
  m.onSpeaking = (on) => ears.push(on);
  return { m, ears };
}

test('she says them in order, and her ears stay shut in between', async () => {
  const { m, ears } = mouth();
  assert.strictEqual(m.begin(), true);
  m.say('First sentence here.');
  m.say('Second sentence here.');
  await sleep(30);
  assert.deepStrictEqual(spoken, ['First sentence here.', 'Second sentence here.']);
  await sleep(300);
  assert.ok(!ears.includes(false), 'still in the middle of her answer');
  m.say('Third one.');
  m.finish();
  await sleep(350);
  assert.deepStrictEqual(spoken, ['First sentence here.', 'Second sentence here.', 'Third one.']);
  assert.strictEqual(ears.at(-1), false, 'and open again when she is done');
});

test('a newer line cuts her off', async () => {
  const { m } = mouth();
  m.begin();
  m.say('One that gets cut off.');
  const before = spoken.cancelled || 0;
  m.stop();
  assert.strictEqual(m.flowing, false);
  m.say('Too late for this one.');
  await sleep(30);
  assert.ok(!spoken.includes('Too late for this one.'));
  assert.strictEqual(spoken.cancelled || 0, before); // (nothing was speaking in the stub)
});

test('muted, there is nothing to begin; nothing readable is not said', async () => {
  const { m } = mouth();
  m.configure({ tts: true, muted: true });
  assert.strictEqual(m.begin(), false);
  m.configure({ tts: true });
  m.begin();
  m.say('[happy] ...');
  await sleep(20);
  assert.deepStrictEqual(spoken, []);
});

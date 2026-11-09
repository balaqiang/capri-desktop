'use strict';

// Her mood, her command registry, the model that fits on your graphics card, what a song really sounds like.

const test = require('node:test');
const assert = require('node:assert');

require('./electron-stub');
const { createMood, rhythm, temper, labelOf, drift } = require('../src/main/engines/mood');
const { COMMANDS, ORDER } = require('../src/main/commands');
const errands = require('../src/main/commands/errands');
const gpu = require('../src/main/ai/gpu');
const songdata = require('../src/main/online/songdata');

const HOUR = 3600000;

function moodAt(start, kept = null) {
  let clock = start;
  let saved = kept;
  const mood = createMood({ load: () => saved, save: (s) => { saved = s; }, now: () => clock });
  return { mood, pass: (ms) => { clock += ms; }, saved: () => saved };
}

test('her mood: awake at night, useless in the morning; the same temper all day, not the same every day', () => {
  assert.ok(rhythm(21) > rhythm(9));
  assert.ok(rhythm(21) >= 0.8 && rhythm(9) <= 0.25);
  const morning = new Date(2026, 10, 9, 8);
  assert.strictEqual(temper(morning), temper(new Date(2026, 10, 9, 23)));
  const days = new Set([9, 10, 11, 12, 13, 14].map((d) => temper(new Date(2026, 10, d, 12))));
  assert.ok(days.size > 1);
  for (let d = 1; d < 29; d++) assert.ok(Math.abs(temper(new Date(2026, 1, d)) - 0.05) <= 0.2500001);
});

test('her mood: what happens moves it, and it fades', () => {
  const start = new Date(2026, 10, 9, 8).getTime(); // the same day all through: the same temper
  const { mood, pass } = moodAt(start);
  const before = mood.read().v;
  for (let i = 0; i < 6; i++) mood.nudge('pat');
  const petted = mood.read().v;
  assert.ok(petted > before + 0.2);
  pass(6 * HOUR);
  const later = mood.read().v;
  assert.ok(Math.abs(later - before) < Math.abs(petted - before) / 4, 'most of it has faded after hours');
});

test('her mood: it outlives a restart, and the time she was off counts', () => {
  const start = new Date(2026, 10, 9, 21).getTime();
  const a = moodAt(start);
  for (let i = 0; i < 5; i++) a.mood.nudge('neglected');
  a.mood.flush();
  const kept = a.saved();
  assert.ok(kept && Number.isFinite(kept.v));
  const soon = moodAt(start + 60000, kept);
  assert.ok(Math.abs(soon.mood.read().v - a.mood.read().v) < 0.05, 'still in that mood a minute later');
  assert.ok(drift(kept, 12 * HOUR, start + 12 * HOUR).v > kept.v + 0.2, 'and over it by the next day');
});

test('her mood: a broken save is ignored, the mood off says nothing', () => {
  const start = new Date(2026, 10, 9, 21).getTime();
  assert.ok(Number.isFinite(moodAt(start, { v: 'x' }).mood.read().v));
  const off = createMood({ load: () => null, save: () => {}, now: () => start, off: () => true });
  assert.strictEqual(off.line(), '');
  const on = moodAt(start).mood;
  assert.match(on.line(), /FEELING TODAY/);
});

test('her mood in a word', () => {
  assert.strictEqual(labelOf(0.5, 0.8), 'playful');
  assert.strictEqual(labelOf(0.5, 0.4), 'content');
  assert.strictEqual(labelOf(-0.5, 0.8), 'irritable');
  assert.strictEqual(labelOf(-0.5, 0.4), 'gloomy');
  assert.strictEqual(labelOf(0, 0.1), 'drowsy');
  assert.strictEqual(labelOf(-0.5, 0.1), 'drained');
  assert.strictEqual(labelOf(0, 0.7), 'restless');
  assert.strictEqual(labelOf(0, 0.5), 'calm');
});

test('the registry: every command once, in its order', () => {
  assert.strictEqual(new Set(ORDER).size, ORDER.length);
  assert.strictEqual(COMMANDS.length, ORDER.length);
  // what used to come first still does
  assert.ok(ORDER.indexOf('hands.type') < ORDER.indexOf('hands.key'));
  assert.ok(ORDER.indexOf('hands.click') < ORDER.indexOf('hands.key'));
  assert.ok(ORDER.indexOf('music.songControl') < ORDER.indexOf('music.playSong'));
});

test('a button by its name', () => {
  const click = (s) => errands.parse(s);
  assert.deepStrictEqual(click('click the Send button'), { kind: 'click', name: 'Send', target: '' });
  assert.deepStrictEqual(click('klik tombol Kirim'), { kind: 'click', name: 'Kirim', target: '' });
  assert.deepStrictEqual(click('tolong pencet tombol OK'), { kind: 'click', name: 'OK', target: '' });
  assert.deepStrictEqual(click('click Save in notepad'), { kind: 'click', name: 'Save', target: 'notepad' });
  assert.deepStrictEqual(click('tap on the Submit button'), { kind: 'click', name: 'Submit', target: '' });
  // a key is still a key
  assert.deepStrictEqual(click('press enter'), { kind: 'key', key: 'enter' });
  assert.deepStrictEqual(click('tekan enter'), { kind: 'key', key: 'enter' });
  // not a button
  assert.notStrictEqual(click('klik kanan').kind, 'click');
  // typed, then pressed
  const steps = errands.chain('ketik halo lalu klik tombol kirim');
  assert.deepStrictEqual(steps.map((s) => s.e.kind), ['type', 'click']);
  // never from a guess of her model's
  assert.strictEqual(errands.routed('click the Delete button', 'click the Delete button'), null);
});

test('the model that fits on your graphics card', () => {
  const G = 1024 ** 3;
  const models = [{ name: 'big', size: 3.3 * G }, { name: 'small', size: G }];
  assert.strictEqual(gpu.choose({ wanted: 'big', models, free: 3.2 * G }), 'big');
  assert.strictEqual(gpu.choose({ wanted: 'big', models, free: G }), 'small', 'a game on the card');
  assert.strictEqual(gpu.choose({ wanted: 'big', models, free: 0.2 * G }), 'small', 'nothing fits: the smallest');
  assert.strictEqual(gpu.choose({ wanted: 'big', models, free: 0.2 * G, loaded: { big: 3.2 * G } }), 'big', 'already on the card');
  assert.strictEqual(gpu.choose({ wanted: 'small', models, free: 0.1 * G }), 'small', 'nothing smaller');
  assert.strictEqual(gpu.choose({ wanted: 'big', models, free: undefined }), 'big', 'no NVIDIA card: nothing to go by');
  assert.strictEqual(gpu.choose({ wanted: 'other', models, free: G }), 'other', 'a name it has no size for');
  assert.deepStrictEqual(gpu.parseSmi('4096, 845\n'), { total: 4096 * 1048576, used: 845 * 1048576, free: 3251 * 1048576 });
  assert.strictEqual(gpu.parseSmi('[N/A], [N/A]'), null);
});

test('what a song really sounds like: its loudness first', () => {
  assert.strictEqual(songdata.energyOf({ bpm: 0, gain: -6.7 }), 'energetic');
  assert.strictEqual(songdata.energyOf({ bpm: 176.7, gain: -16.5 }), 'calm', 'a doubled tempo on a slow song');
  assert.strictEqual(songdata.energyOf({ bpm: 121, gain: -11.2 }), 'energetic');
  assert.strictEqual(songdata.energyOf({ bpm: 72, gain: -11 }), 'calm');
  assert.strictEqual(songdata.energyOf({ bpm: 0, gain: -11.3 }), '', 'no way to tell');
  assert.strictEqual(songdata.energyOf({ bpm: 120 }), '');
});

test('what a song really sounds like: only the right song counts', async () => {
  const results = [{ id: 1, title: 'Numb (Live)', artist: { name: 'Someone Else' } }, { id: 2, title: 'Numb', artist: { name: 'Linkin Park' } }];
  assert.strictEqual(songdata.matching(results, 'Numb', 'Linkin Park').id, 2);
  assert.strictEqual(songdata.matching(results, 'Numb 2', 'Linkin Park'), null);
  assert.strictEqual(songdata.matching(results, 'In the End', ''), null);
  const fetcher = async (url) => ({ json: async () => (url.includes('/search') ? { data: results } : { bpm: 0, gain: -6.7 }) });
  assert.deepStrictEqual(await songdata.lookup({ title: 'Numb', artist: 'Linkin Park' }, { fetcher }), { bpm: 0, gain: -6.7, energy: 'energetic' });
  assert.strictEqual(await songdata.lookup({ title: 'Numb', artist: 'Linkin Park' }, { fetcher: async () => { throw new Error('offline'); } }), null);
});

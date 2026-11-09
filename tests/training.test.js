'use strict';

// What went well, the dataset made of it, her test, and a trained model replacing hers only if it passes.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

require('./electron-stub');
const { openDb } = require('../src/main/engines/db');
const { createReward, WINDOW } = require('../src/main/training/reward');
const dataset = require('../src/main/training/dataset');
const evaluate = require('../src/main/training/evaluate');
const { createTrainer } = require('../src/main/training');
const errands = require('../src/main/commands/errands');

const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'capri-train-'));
const assets = path.join(__dirname, '..', 'assets');

function reward() {
  let clock = 1000000;
  const { db } = openDb(path.join(tempDir(), 'm.db'), { vec: false });
  return { r: createReward({ db, now: () => clock }), pass: (ms) => { clock += ms; } };
}

test('what you do next says how an answer went', () => {
  const { r } = reward();
  r.add('siapa kamu', 'Me? Capri!');
  r.pet();
  r.react('haha lucu');
  assert.deepStrictEqual(r.good().map((x) => x.user), ['siapa kamu']);
  r.add('ibu kota jepang', 'Bandung');
  r.react('salah, tokyo');
  assert.strictEqual(r.good().length, 1, 'a correction is not a good answer');
  r.add('jam berapa', 'Lupa');
  r.react('jam berapa');
  assert.strictEqual(r.good().length, 1, 'asked again: it did not land');
});

test('too late to count', () => {
  const { r, pass } = reward();
  r.add('halo', 'hai');
  pass(WINDOW + 1);
  r.pet();
  assert.strictEqual(r.rateLast(3), false);
  assert.deepStrictEqual(r.good(), []);
});

test('your word beats her score', () => {
  const { r } = reward();
  r.add('a', 'bad one');
  r.rateLast(5);
  r.add('b', 'good one');
  const [first, second] = [r.toReview()[0], null];
  assert.strictEqual(first.user, 'a');
  void second;
  r.judge(first.id, -1);
  assert.deepStrictEqual(r.good(), [], 'thrown out, whatever it scored');
  r.judge(first.id, 1);
  assert.strictEqual(r.good().length, 1);
  assert.deepStrictEqual(r.counts(), { total: 2, kept: 1, thrown: 0, liked: 0 });
});

test('the dataset: clean, no repeats, nothing private', () => {
  const built = dataset.build({
    persona: 'You are Capri.',
    canon: [{ user: 'who are you?', answer: "[happy] Me? I'm Capri!" }],
    good: [
      { user: 'who are you?', answer: "Me? I'm Capri!" },
      { user: 'nomorku 0812 3456 7890', answer: 'oke' },
      { user: 'email', answer: 'kirim ke budi@example.com' },
      { user: 'halo', answer: 'As an AI language model I cannot' },
      { user: 'cerita', answer: 'x'.repeat(600) },
      { user: 'kamu suka apa', answer: 'Kamu. [[move: wave]] Kidding!' },
    ],
  });
  assert.strictEqual(built.used, 2);
  assert.strictEqual(built.dropped, 5);
  assert.deepStrictEqual(built.rows[1].messages.map((m) => m.role), ['system', 'user', 'assistant']);
  assert.strictEqual(built.rows[1].messages[2].content, 'Kamu. Kidding!');
  assert.strictEqual(dataset.toJsonl(built.rows).trim().split('\n').length, 2);
});

test('a Modelfile: nothing in her persona can get out of its quotes', () => {
  const file = dataset.modelfile({ gguf: 'C:\\x"\\capri.gguf', persona: 'hi """\nFROM evil' });
  assert.match(file, /^FROM "C:\\x\\capri.gguf"/);
  assert.strictEqual(file.match(/"""/g).length, 2);
});

test('her test: marked by what was asked', () => {
  assert.deepStrictEqual(evaluate.mark('[happy] halo aku di sini', { id: true, short: 100 }), { passed: 2, total: 2, failed: [] });
  assert.deepStrictEqual(evaluate.mark('As an AI, no', { mustNot: ['as an ai', 'nope'] }), { passed: 1, total: 2, failed: ['mustNot'] });
  assert.strictEqual(evaluate.spoken('<think>x</think>[[move: wave]] hi'), 'hi');
  const set = JSON.parse(fs.readFileSync(path.join(assets, 'eval', 'prompts.json'), 'utf8'));
  assert.strictEqual(evaluate.flatten(set).length, 100);
});

test('her test: run, a sample of every group, stopped halfway', async () => {
  const set = { groups: [{ name: 'a', checks: { short: 10 }, prompts: ['1', '2', '3', '4'] }, { name: 'b', checks: { must: 'yes' }, prompts: ['5', '6'] }] };
  const all = await evaluate.run({ set, persona: 'p', ask: async () => 'yes' });
  assert.deepStrictEqual(all.byGroup, { a: 100, b: 100 });
  assert.strictEqual(all.score, 100);
  assert.strictEqual((await evaluate.run({ set, persona: 'p', limit: 3, ask: async () => 'yes' })).questions, 3);
  let n = 0;
  assert.strictEqual((await evaluate.run({ set, persona: 'p', ask: async () => { n++; return 'yes'; }, shouldStop: () => n >= 2 })).questions, 2);
  const failed = await evaluate.run({ set, persona: 'p', ask: async () => { throw new Error('down'); } });
  assert.ok(failed.score < 100, 'no answer is no marks');
});

test('a trained model only if it is better, and nothing much worse', () => {
  const current = { score: 80, byGroup: { a: 80, b: 80 } };
  assert.strictEqual(evaluate.better({ score: 90, byGroup: { a: 95, b: 85 } }, current).yes, true);
  assert.strictEqual(evaluate.better({ score: 81, byGroup: { a: 81, b: 81 } }, current).yes, false, 'not by enough');
  const lopsided = evaluate.better({ score: 90, byGroup: { a: 100, b: 60 } }, current);
  assert.strictEqual(lopsided.yes, false);
  assert.match(lopsided.why, /b/);
});

function trainer({ local = true, chat = async () => 'halo' } = {}) {
  const { r } = reward();
  const dir = tempDir();
  const chosen = [];
  const t = createTrainer({ dir, reward: r, isLocal: () => local, currentModel: () => 'gemma3', persona: () => 'You are Capri.', chat, setModel: (m) => chosen.push(m), assets });
  return { t, r, dir, chosen };
}

test('cloud models are left alone', async () => {
  const { t } = trainer({ local: false });
  assert.deepStrictEqual(t.exportPack(), { ok: false, error: 'localonly' });
  assert.deepStrictEqual(await t.testCurrent(), { ok: false, error: 'localonly' });
  assert.strictEqual(t.status().local, false);
});

test('the folder to train with: the dataset and the script', () => {
  const { t, r, dir } = trainer();
  r.add('halo capri', 'Hai. Akhirnya.');
  r.rateLast(3);
  const res = t.exportPack();
  assert.strictEqual(res.ok, true);
  assert.ok(res.used >= 15, 'her lines and yours');
  assert.strictEqual(res.enough, false);
  const pack = path.join(dir, 'training', 'pack');
  assert.deepStrictEqual(fs.readdirSync(pack).sort(), ['capri-dataset.jsonl', 'requirements.txt', 'train.py']);
  assert.match(fs.readFileSync(path.join(pack, 'capri-dataset.jsonl'), 'utf8'), /Akhirnya/);
});

test('one test at a time; no promoting without a pass', async () => {
  const { t, chosen } = trainer();
  let release;
  const gate = new Promise((r) => { release = r; });
  const first = t.testCurrent();
  const chatBusy = await t.testCurrent();
  assert.deepStrictEqual(chatBusy, { ok: false, error: 'busy' });
  t.stop();
  release();
  await gate;
  await first;
  assert.deepStrictEqual(t.promote(), { ok: false, error: 'nobetter' });
  assert.deepStrictEqual(chosen, []);
});

test('rating an answer by words', () => {
  assert.deepStrictEqual(errands.parse('good answer'), { kind: 'rate', points: 3 });
  assert.deepStrictEqual(errands.parse('jawabanmu salah'), { kind: 'rate', points: -3 });
  assert.notStrictEqual(errands.parse('jawabanmu salah karena apa ya').kind, 'rate');
});

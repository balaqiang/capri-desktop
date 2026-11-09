// Her forms and what she needs before she has them; whether a drawing is ready to be her body.

import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const { FORMS, FORM_NAMES, SHAPES, hasForm, unlockedForms, formForMood, formSeconds } = await import('../src/renderer/js/forms.js');
const require = createRequire(import.meta.url);
const { check } = require('../scripts/check-blueprint.js');
require('./electron-stub');
const errands = require('../src/main/commands/errands');

test('her forms come with sync', () => {
  assert.deepStrictEqual(unlockedForms(0), []);
  assert.deepStrictEqual(unlockedForms(25), ['glitch', 'spark']);
  assert.deepStrictEqual(unlockedForms(100), FORM_NAMES);
  assert.strictEqual(hasForm('spark', 19), false);
  assert.strictEqual(hasForm('spark', 20), true);
  assert.strictEqual(hasForm('constructor', 100), false, 'only what is on the list');
  for (const name of FORM_NAMES) assert.ok(SHAPES[name], name);
  assert.ok(Object.values(FORMS).every((at) => at > 0 && at <= 100));
});

test('how long, within reason', () => {
  assert.strictEqual(formSeconds(0.1), 1.5);
  assert.strictEqual(formSeconds(999), 15);
  assert.strictEqual(formSeconds('x', 4), 4);
});

test('a mood picks a form only if she has it', () => {
  assert.strictEqual(formForMood('restless', 100), 'spark');
  assert.strictEqual(formForMood('restless', 5), null);
  assert.strictEqual(formForMood('irritable', 100), 'glitch');
  assert.strictEqual(formForMood('gloomy', 100), 'silhouette');
  assert.strictEqual(formForMood('calm', 100), null);
});

test('her forms, by words', () => {
  assert.deepStrictEqual(errands.parse('jadi spark'), { kind: 'form', form: 'spark' });
  assert.deepStrictEqual(errands.parse('become a shadow'), { kind: 'form', form: 'silhouette' });
  assert.deepStrictEqual(errands.parse('glitch out'), { kind: 'form', form: 'glitch' });
  assert.notStrictEqual(errands.parse('jadi apa nanti').kind, 'form');
});

const good = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 420">
<g id="form-full"><g id="head"/><g id="torso"/><g id="arm_L"/><g id="arm_R"/><g id="leg_L"/><g id="leg_R"/><circle id="pivot-head"/></g><g id="form-mask"/></svg>`;

test('a drawing with everything she needs', () => {
  const res = check(good);
  assert.strictEqual(res.ok, true);
  assert.deepStrictEqual(res.missing, []);
  assert.ok(res.missingPivots.includes('arm_L'), 'pivots are advice, not a failure');
  assert.ok(!res.missingPivots.includes('head'));
});

test('a drawing that is not ready says why', () => {
  const res = check('<svg><g id="form-full"><g id="head"/><g id="Torso"/><g id="arm-L"/></g><script>x</script></svg>');
  assert.strictEqual(res.ok, false);
  assert.ok(res.missing.includes('torso'));
  assert.deepStrictEqual(res.missingForms, ['mask']);
  assert.ok(res.unknown.includes('Torso'), 'looks like a typo');
  assert.ok(res.unknown.includes('arm-L'));
  assert.deepStrictEqual(res.unsafe, ['script']);
  assert.strictEqual(check('%PDF-1.5 illustrator file').isSvg, false);
});

test('colors written as CSS would all come out black', () => {
  const res = check(good.replace('<g id="form-mask"/>', '<g id="form-mask"/><style>.a{fill:red}</style>'));
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.hasCss, true);
});

test('the schema and the docs agree', () => {
  const schema = JSON.parse(fs.readFileSync(new URL('../assets/capri/blueprint.schema.json', import.meta.url), 'utf8'));
  const docs = fs.readFileSync(new URL('../docs/BLUEPRINT.md', import.meta.url), 'utf8');
  for (const name of [...schema.required, ...schema.requiredForms.map((f) => `form-${f}`)]) assert.ok(docs.includes(name), name);
});

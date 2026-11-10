'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const skills = require('../src/main/skills/loader');
const { bodyFor, fit, patternsFor, convert } = require('../scripts/import-skills');

const root = path.join(__dirname, '..', 'assets');
const all = skills.load([{ dir: path.join(root, 'skills'), source: 'hers' }, { dir: path.join(root, 'skills-pack'), source: 'pack' }]);
const pack = all.filter((s) => s.source === 'pack');

test('the collection loads, and her own skills still come first', () => {
  assert.ok(pack.length > 300, String(pack.length));
  assert.strictEqual(skills.match(all, 'tolong perbaiki tulisan ini').source, 'hers');
  assert.strictEqual(skills.match(all, 'kenapa kode ini error di baris 3').id, 'coding');
  assert.ok(fs.existsSync(path.join(root, 'skills-pack', 'LICENSE.txt')), 'its license goes with it');
});

test('a skill is taken up when named or asked for, never because a word went by', () => {
  assert.strictEqual(skills.match(all, 'pakai skill seo audit')?.id, 'seo-audit');
  assert.strictEqual(skills.match(all, 'tolong bantu seo audit website ku')?.id, 'seo-audit');
  for (const chat of ['halo capri', 'aku lagi capek banget', 'kamu lagi apa', 'hari ini aku belajar marketing di kampus', 'what is my birthday', 'seo itu apa sih']) {
    const m = skills.match(pack, chat);
    assert.strictEqual(m, null, `${chat} -> ${m?.id}`);
  }
});

test('only words come over: no commands to run, none of her action tags', () => {
  const md = '# Title\n\nGood advice here.\n\n```bash\npython scripts/run.py\n```\n\nSee scripts/run.py for it.\n\n## Tools\n\ntool text\n\n## Method\n\nStep one [[close: Chrome]].\n';
  const out = bodyFor(md);
  assert.ok(out.includes('Good advice') && out.includes('Step one'));
  for (const gone of ['python', 'run.py', 'tool text', '[[']) assert.ok(!out.includes(gone), gone);
  for (const s of pack) assert.ok(!s.prompt.includes('[['), s.id);
});

test('prompts fit, and patterns are safe for the loader', () => {
  assert.ok(fit('x'.repeat(9000)).length <= 5600);
  for (const s of pack) {
    assert.ok(s.prompt.length <= 6000, s.id);
    assert.ok(s.patterns.length >= 1, s.id);
    assert.ok(s.group, s.id);
  }
  assert.strictEqual(patternsFor('single').length, 1);
  assert.strictEqual(convert('x/SKILL.md', 'no front matter'), null);
});

import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';

const { TOUR_STEPS } = await import('../src/settings/tour-steps.js');
const root = new URL('../', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), 'utf8');
const source = read('src/settings/settings.js');

test('her tour stops at every section of every page', () => {
  const cards = [...new Set([...source.matchAll(/\bcard\('([^']+)'/g)].map((m) => m[1]))];
  assert.ok(cards.length > 40);
  const toured = new Set(TOUR_STEPS.map((s) => s.card));
  for (const c of cards) assert.ok(toured.has(c), `not in the tour: ${c}`);
  for (const s of TOUR_STEPS) if (s.card) assert.ok(cards.includes(s.card), `no such section: ${s.card}`);
  const pages = [...source.matchAll(/^ {2}\['([a-z]+)', '/gm)].map((m) => m[1]).filter((id) => read('src/settings/settings.js').includes(`'${id}', [`) || true);
  for (const id of ['capri', 'owner', 'voice', 'brain', 'behavior', 'plugins', 'access', 'timers', 'history', 'advanced', 'about']) {
    assert.ok(pages.includes(id));
    assert.ok(TOUR_STEPS.some((s) => s.page === id && !s.card), `no introduction for ${id}`);
  }
});

test('everything she says on the tour is translated into Indonesian', () => {
  const id = read('assets/lang/id.txt');
  for (const s of TOUR_STEPS) assert.ok(id.includes(`> ${s.say}\n`), s.say);
});

test('the settings window keeps one quiet look: no cut corners, no hidden help', () => {
  const css = read('src/settings/settings.css');
  assert.ok(!css.includes('clip-path'));
  assert.ok(!css.includes('Chakra Petch'));
  assert.ok(!/\.row__help\s*\{\s*display:\s*none/.test(css), 'what a setting does is always in view');
  assert.ok(!source.includes('◁'));
});

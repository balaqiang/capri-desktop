import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';

const { ownerFacts, birthdayWords } = await import('../src/renderer/js/owner-facts.js');

test('a birthday in words', () => {
  assert.strictEqual(birthdayWords('2077-01-13'), '13 January 2077');
  assert.strictEqual(birthdayWords(''), '');
  assert.strictEqual(birthdayWords('soon'), 'soon');
});

test('everything you wrote about yourself reaches her, and outweighs an old chat', () => {
  const text = ownerFacts({ name: 'good', owner: { nickname: 'Good Boy', pronouns: 'he/him', birthday: '2077-01-13', about: 'I draw', likes: 'ramen', dislikes: 'Mondays' }, relation: 'her host' });
  for (const part of ['good', 'Good Boy', 'he/him', '13 January 2077', 'I draw', 'ramen', 'Mondays', 'her host', 'even if an older message']) assert.ok(text.includes(part), part);
  assert.strictEqual(ownerFacts({}), '');
  assert.ok(!ownerFacts({ name: 'x' }).includes('birthday:'), 'only what you filled in');
});

test('it goes in right before your message', () => {
  const chat = fs.readFileSync(new URL('../src/renderer/js/chat.js', import.meta.url), 'utf8');
  assert.ok(/const now = \[[^\]]*this\.ownerNow\(\)\]/.test(chat));
});

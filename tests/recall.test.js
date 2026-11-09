'use strict';
// What she recalls for what you said (src/main/recall.js), and the weather and brief requests (errands).
require('./electron-stub');
const test = require('node:test');
const assert = require('node:assert/strict');
const recall = require('../src/main/engines/recall');
const errands = require('../src/main/commands/errands');

const FACTS = ['my sister is called Ayu', 'I work as a nurse at the hospital', 'my cat is named Mochi', 'I hate mushrooms', 'favourite band is Hindia',
  'birthday is in May', 'I live in Bandung', 'I study informatics at ITB', 'I drink coffee every morning', 'my dog died last year',
  'I want to learn Japanese', 'I play valorant with friends', 'my mom makes the best rendang'];

test('her notes: the ones it is about, and the newest few', async () => {
  const picked = await recall.memoriesFor('what should I cook tonight, no mushrooms please', FACTS);
  assert.ok(picked.includes('I hate mushrooms'));
  assert.ok(picked.length <= 11);
  assert.ok((await recall.memoriesFor('aku lagi dengerin hindia', FACTS)).includes('favourite band is Hindia'));
  assert.deepEqual(await recall.memoriesFor('anything', FACTS.slice(0, 5)), FACTS.slice(0, 5)); // few: all of them
});

test('past chats: what you said about it before, not today', async () => {
  const day = (d) => Date.now() - d * 86400000;
  const msgs = [
    { role: 'user', t: day(20), text: 'my sister Ayu just got into university in Jogja' },
    { role: 'user', t: day(15), text: 'I failed my driving test again today, so annoying' },
    { role: 'assistant', t: day(15), text: 'Again? Wow, my sister would laugh.' },
    { role: 'user', t: day(3), text: 'what should we eat for dinner tonight?' },
    { role: 'user', t: day(0), text: 'my sister is visiting today' },
  ];
  assert.deepEqual((await recall.pastChats('my sister is coming home this weekend', msgs)).map((m) => m.text), ['my sister Ayu just got into university in Jogja']);
  assert.deepEqual((await recall.pastChats('should I retake the driving test?', msgs)).map((m) => m.text), ['I failed my driving test again today, so annoying']);
  assert.deepEqual(await recall.pastChats('hello', msgs), []);
});

test('stemming: Indonesian and English forms meet', () => {
  assert.deepEqual(recall.tokens('Lagunya, kakakku, songs, playing'), ['lagu', 'kakak', 'song', 'play']);
});

test('weather and brief requests', () => {
  assert.deepEqual(errands.parse('cuaca di Bandung besok'), { kind: 'weather', city: 'Bandung', when: 'tomorrow' });
  assert.deepEqual(errands.parse('will it rain tomorrow?'), { kind: 'weather', city: '', when: 'tomorrow' });
  assert.deepEqual(errands.parse('cek cuaca jakarta'), { kind: 'weather', city: 'jakarta', when: 'today' });
  assert.equal(errands.parse('aku suka hujan').kind, 'none');
  assert.equal(errands.parse('the weather is nice').kind, 'none');
  assert.equal(errands.parse('rangkuman hari ini').kind, 'brief');
  assert.equal(errands.parse('brief me').kind, 'brief');
});

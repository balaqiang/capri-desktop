'use strict';
// The song's words (src/main/lyrics.js) and the web question (src/main/web.js): the parts that don't
// need the internet. Made-up lines only (no song's real words here).
require('./electron-stub');
const test = require('node:test');
const assert = require('node:assert/strict');
const { parse, lineAt, bareTitle } = require('../src/main/online/lyrics');
const { searchFor } = require('../src/main/online/web');

test('parse: timed lines, sorted, a line with two stamps twice', () => {
  const lines = parse('[ar: someone]\n[00:12.50]first line\n[01:02.34]  third   line \nno stamp here\n[00:30.00][01:30.00]twice\n[00:40]');
  assert.deepEqual(lines, [
    { t: 12.5, text: 'first line' },
    { t: 30, text: 'twice' },
    { t: 40, text: '' },
    { t: 62.34, text: 'third line' },
    { t: 90, text: 'twice' },
  ]);
  assert.deepEqual(parse(''), []);
  assert.deepEqual(parse(null), []);
});

test('lineAt: the line being sung', () => {
  const lines = parse('[00:10.00]a\n[00:20.00]b\n[00:30.00]c');
  assert.equal(lineAt(lines, 5), -1);
  assert.equal(lineAt(lines, 10), 0);
  assert.equal(lineAt(lines, 19.9), 0);
  assert.equal(lineAt(lines, 25), 1);
  assert.equal(lineAt(lines, 999), 2);
  assert.equal(lineAt([], 10), -1);
  assert.equal(lineAt(lines, NaN), -1);
});

test('bareTitle: the name without what follows it', () => {
  assert.equal(bareTitle('Song (feat. Someone)'), 'Song');
  assert.equal(bareTitle('Song [ft. A & B]'), 'Song');
  assert.equal(bareTitle('Song - Remastered 2011'), 'Song');
  assert.equal(bareTitle('Song (Live at Wembley)'), 'Song');
  assert.equal(bareTitle('Song (Deluxe Version)'), 'Song');
  assert.equal(bareTitle('Hyphen-Song'), 'Hyphen-Song');
  assert.equal(bareTitle(''), '');
});

test('searchFor: the question as a search', () => {
  assert.equal(searchFor('siapa presiden indonesia sekarang?'), 'presiden indonesia');
  assert.equal(searchFor('who is the ceo of nvidia?'), 'ceo of nvidia');
  assert.equal(searchFor('Capri, apa itu blockchain sih?'), 'blockchain');
  assert.equal(searchFor('kapan indonesia merdeka'), 'indonesia merdeka');
  assert.equal(searchFor('???'), '???');
});

'use strict';
// Her action log (src/main/actions-log.js): what she did, never the words she typed.
require('./electron-stub');
const test = require('node:test');
const assert = require('node:assert/strict');
const log = require('../src/main/core/actions-log');

test('what she did, newest first; what she typed only as a count', () => {
  log.clear();
  log.record({ kind: 'app', text: 'spotify' }, { handled: true, reply: 'Opened Spotify.' });
  log.record({ kind: 'type', text: 'my secret words', target: 'notepad' }, { handled: true, reply: 'Typed it.' }, { via: 'voice' });
  log.record({ kind: 'type', text: 'x' }, { handled: true, denied: true, why: 'password' });
  log.record({ kind: 'move', move: 'left' }, { handled: true }); // not on your PC: not kept
  log.record({ kind: 'timer' }, { handled: true });
  const list = log.list();
  assert.equal(list.length, 3);
  assert.deepEqual(list.map((a) => [a.kind, a.what, a.ok]), [['type', '1 character', false], ['type', '15 characters → notepad', true], ['app', 'spotify', true]]);
  assert.equal(list[1].via, 'voice');
  assert.equal(JSON.stringify(list).includes('secret'), false);
  assert.equal(log.clear(), 3);
  assert.equal(log.list().length, 0);
});

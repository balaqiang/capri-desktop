'use strict';
// Whisper's prompt (src/main/hearing.js): the words she should hear right, and her prompt coming back on
// silence thrown away (or a repeated command would be done).
require('./electron-stub');
const test = require('node:test');
const assert = require('node:assert/strict');
const { promptFor, heardPrompt } = require('../src/main/voice/hearing');

test('the prompt: your words and name first, names only', () => {
  const prompt = promptFor({ sttWords: 'Figma, Obsidian', owner: { nickname: 'Bala' } }, 'en');
  assert.match(prompt, /^Hey Capri\. Figma, Obsidian, Bala, Notepad, VS Code/);
  assert.doesNotMatch(prompt, /\b(?:open|type|play|buka|ketik)\b/i);
  assert.match(promptFor({}, 'id'), /^Halo Capri\./);
});

test('her prompt said back is silence', () => {
  const prompt = promptFor({ sttWords: 'Figma' }, 'en');
  assert.equal(heardPrompt('Hey Capri. Notepad, VS Code, Spotify.', prompt), true);
  assert.equal(heardPrompt('Figma, Notepad', prompt), true);
  assert.equal(heardPrompt('Capri open Notepad and type hello', prompt), false);
  assert.equal(heardPrompt('Hey Capri, open Spotify.', prompt), false);
  assert.equal(heardPrompt('', prompt), false);
});

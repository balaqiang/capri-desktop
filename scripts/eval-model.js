#!/usr/bin/env node
'use strict';

// Marks an Ollama model on her test questions: node scripts/eval-model.js gemma3:latest [--limit 20]
// Only asks it things; nothing on your PC is touched.

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const evaluate = require('../src/main/training/evaluate');

async function main() {
  const [model, ...rest] = process.argv.slice(2);
  if (!model) {
    console.error('usage: node scripts/eval-model.js <ollama model> [--limit n]');
    process.exit(2);
  }
  const limit = rest[0] === '--limit' ? Number(rest[1]) || 0 : 0;
  const { DEFAULT_PERSONA } = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'renderer', 'js', 'persona.js')));
  const set = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'assets', 'eval', 'prompts.json'), 'utf8'));
  const ask = async (messages) => {
    const res = await fetch('http://127.0.0.1:11434/api/chat', { method: 'POST', body: JSON.stringify({ model, messages, stream: false, keep_alive: '2m', options: { temperature: 0.7, num_predict: 240 } }) });
    return (await res.json()).message?.content || '';
  };
  const result = await evaluate.run({ set, ask, persona: DEFAULT_PERSONA, limit, onProgress: (done, all) => process.stderr.write(`\r${done}/${all}`) });
  process.stderr.write('\n');
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

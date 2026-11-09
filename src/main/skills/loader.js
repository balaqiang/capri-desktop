'use strict';

// Her skills: how she goes about a kind of work. Each is a folder, skill.json and prompt.md, in assets/skills (hers) or in
// the skills folder of her data (yours, dropped in; yours wins over hers of the same id). A skill is words only: what to
// do and when, never code, so a skill you download can't run anything. (The commands you teach her are something else:
// config.skills, life.js.)
//
// skill.json: { "id": "writing", "name": "Writing", "about": "…", "when": ["regex", …], "web": false, "maxTokens": 800, "temperature": 0.7 }

const fs = require('node:fs');
const path = require('node:path');

const ID = /^[a-z][a-z0-9-]{1,39}$/;
const MAX_PROMPT = 6000;
const MAX_PATTERNS = 20;
const MAX_PATTERN = 300;
// a pattern that could take forever on a long message: nested repeats
const RISKY_PATTERN = /\([^)]*[+*][^)]*\)[+*{]/;

function readSkill(dir, source) {
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(dir, 'skill.json'), 'utf8').replace(/^﻿/, ''));
  } catch {
    return null;
  }
  if (!ID.test(String(manifest?.id || ''))) return null;
  let prompt;
  try {
    prompt = fs.readFileSync(path.join(dir, 'prompt.md'), 'utf8').trim().slice(0, MAX_PROMPT);
  } catch {
    return null;
  }
  if (!prompt) return null;
  const patterns = [];
  for (const raw of Array.isArray(manifest.when) ? manifest.when.slice(0, MAX_PATTERNS) : []) {
    if (typeof raw !== 'string' || raw.length > MAX_PATTERN || RISKY_PATTERN.test(raw)) continue;
    try {
      patterns.push(new RegExp(raw, 'i'));
    } catch { /* not a pattern: skipped */ }
  }
  const number = (v, lo, hi) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : undefined);
  return {
    id: manifest.id,
    name: String(manifest.name || manifest.id).slice(0, 40),
    about: String(manifest.about || '').slice(0, 200),
    web: manifest.web === true,
    maxTokens: number(manifest.maxTokens, 50, 4000),
    temperature: number(manifest.temperature, 0, 1.5),
    patterns,
    prompt,
    source,
  };
}

// Her skills and yours, by id. -> [skill]
function load(dirs) {
  const byId = new Map();
  for (const { dir, source } of dirs) {
    let names = [];
    try {
      names = fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    } catch {
      continue;
    }
    for (const name of names) {
      const skill = readSkill(path.join(dir, name), source);
      if (skill) byId.set(skill.id, skill);
    }
  }
  return [...byId.values()];
}

// The skill for this message, if one of its patterns says so. off: the ids you've turned off.
function match(skills, text, off = []) {
  const t = String(text || '').slice(0, 1000);
  return skills.find((s) => !off.includes(s.id) && s.patterns.some((p) => p.test(t))) || null;
}

const find = (skills, id, off = []) => skills.find((s) => s.id === id && !off.includes(id)) || null;

module.exports = { load, match, find, readSkill };

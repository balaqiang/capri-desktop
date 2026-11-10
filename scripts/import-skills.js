#!/usr/bin/env node
'use strict';

// Skills from a folder of SKILL.md files, as her own kind of skill (skill.json and prompt.md, words only), into assets/skills-pack:
// node scripts/import-skills.js <folder>
// Only the text of each SKILL.md is read. Nothing in that folder is ever run. What only makes sense with its scripts goes, and so does anything
// that looks like one of her own action tags.

const fs = require('node:fs');
const path = require('node:path');

const OUT = path.join(__dirname, '..', 'assets', 'skills-pack');
const MAX_PROMPT = 5600; // (the loader takes 6000: her line in front comes on top)
// for Claude's own agent machinery: nothing she could do with them
const LEFT_OUT = /(?:^|\/)(?:agent-launcher|agenthub|self-improving-agent|autoresearch-agent|loop-library|orchestration)(?:\/|$)/;
const TOOL_SECTION = /^(?:python )?(?:tools?|scripts?|automation|cli|install(?:ation)?|set ?up|quick ?start|references?|reference (?:docs|guides?)|related skills?|assets|files?|bundled resources|how to run|usage)\b/i;
const TOOL_LINE = /\b(?:scripts?|references|assets|tools)\/[\w./-]+|\bpython3?\s+\S+\.py\b|\bnpx\s+|\bpip3? install\b|\.claude\//;
const ASKING = '(?:bantu|tolong|buat|buatin|buatkan|bikin|bikinin|susun|rancang|cek|periksa|perbaiki|analisis|help|write|make|create|build|draft|audit|review|plan|analy[sz]e|improve|fix)';
const GROUPS = [
  [/^marketing/, 'Marketing'],
  [/^engineering/, 'Engineering'],
  [/^c-level/, 'Executive advisors'],
  [/^product/, 'Product'],
  [/^(?:ra-qm|compliance)/, 'Compliance and quality'],
  [/^project/, 'Project management'],
  [/^(?:business|commercial)/, 'Business'],
  [/^finance/, 'Finance'],
  [/^research/, 'Research'],
  [/^(?:productivity|markdown)/, 'Productivity'],
];

const front = (text) => {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return null;
  const name = /^name:\s*["']?([^"'\n]+?)["']?\s*$/m.exec(m[1])?.[1];
  const about = /^description:\s*>?-?\s*([\s\S]*?)(?=\n[a-zA-Z_-]+:|$)/m.exec(m[1])?.[1];
  return name ? { name: name.trim().toLowerCase(), about: String(about || '').replace(/^["']|["']$/g, '').replace(/\s+/g, ' ').trim(), body: text.slice(m[0].length) } : null;
};

// What's left of a SKILL.md for someone with no scripts, no files and no shell.
function bodyFor(markdown) {
  const out = [];
  let fence = null;
  let keep = true;
  let skipLevel = 0;
  for (const raw of String(markdown).split(/\r?\n/)) {
    const line = raw.replace(/\[\[/g, '[ [').replace(/\]\]/g, '] ]');
    const opens = /^\s*```(\w*)/.exec(line);
    if (fence !== null) {
      if (opens) {
        fence = null;
        continue;
      }
      if (keep && fence !== 'drop') out.push(line);
      continue;
    }
    if (opens) {
      fence = /^(?:bash|sh|shell|zsh|powershell|console|python|py)$/i.test(opens[1]) ? 'drop' : '';
      if (keep && fence !== 'drop') out.push(line);
      continue;
    }
    const head = /^(#{1,6})\s+(.*)$/.exec(line);
    if (head) {
      const level = head[1].length;
      if (!keep && level > skipLevel) continue;
      keep = !TOOL_SECTION.test(head[2].replace(/[^\w\s]/g, '').trim());
      skipLevel = keep ? 0 : level;
    }
    if (!keep || TOOL_LINE.test(line)) continue;
    out.push(line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// As much as fits, cut where a section or a paragraph ends.
function fit(text, max = MAX_PROMPT) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const at = Math.max(cut.lastIndexOf('\n## '), cut.lastIndexOf('\n### '), cut.lastIndexOf('\n\n'));
  return cut.slice(0, at > max * 0.6 ? at : max).trim();
}

// She takes up a skill when it's named, or when you ask for help with exactly what it's called. Never because a word went by.
function patternsFor(name) {
  const words = name.split('-').filter(Boolean).join('[\\s-]+');
  const named = `\\b(?:skill|pakai|pake|gunakan|use(?: the)?)\\s+${words}\\b`;
  return name.includes('-') ? [named, `\\b${ASKING}\\b.*\\b${words}\\b`] : [named];
}

const groupOf = (rel) => GROUPS.find(([re]) => re.test(rel))?.[1] || 'Other';

function convert(rel, text) {
  const skill = front(text);
  if (!skill || !/^[a-z][a-z0-9-]{1,39}$/.test(skill.name)) return null;
  const body = fit(bodyFor(skill.body));
  if (body.length < 200) return null;
  return {
    manifest: { id: skill.name, name: skill.name.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ').slice(0, 40), about: skill.about.slice(0, 200), group: groupOf(rel), when: patternsFor(skill.name), maxTokens: 1200, temperature: 0.5 },
    prompt: `YOU ARE USING THE SKILL "${skill.name}" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.\n\n${body}\n`,
  };
}

function main() {
  const root = process.argv[2];
  if (!root) {
    console.error('usage: node scripts/import-skills.js <folder>');
    process.exit(2);
  }
  const found = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === '.git' || e.name === '.gemini' || e.isSymbolicLink()) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === 'SKILL.md') found.push(p);
    }
  })(root);
  const own = new Set(fs.readdirSync(path.join(__dirname, '..', 'assets', 'skills')));
  const best = new Map();
  let skipped = 0;
  for (const file of found) {
    const rel = path.relative(root, file).replace(/\\/g, '/');
    const one = LEFT_OUT.test(rel) ? null : convert(rel, fs.readFileSync(file, 'utf8'));
    if (!one || own.has(one.manifest.id)) {
      skipped++;
      continue;
    }
    if (!best.has(one.manifest.id) || one.prompt.length > best.get(one.manifest.id).prompt.length) best.set(one.manifest.id, one);
  }
  fs.rmSync(OUT, { recursive: true, force: true });
  for (const { manifest, prompt } of best.values()) {
    const dir = path.join(OUT, manifest.id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'skill.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    fs.writeFileSync(path.join(dir, 'prompt.md'), prompt);
  }
  const license = path.join(root, 'LICENSE');
  if (fs.existsSync(license)) fs.copyFileSync(license, path.join(OUT, 'LICENSE.txt'));
  console.log(`${best.size} skills in assets/skills-pack (${skipped} left out)`);
}

if (require.main === module) main();

module.exports = { front, bodyFor, fit, patternsFor, convert };

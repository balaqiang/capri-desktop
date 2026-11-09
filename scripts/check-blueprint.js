#!/usr/bin/env node
'use strict';

// Is your SVG ready to be her body? node scripts/check-blueprint.js capri.svg
// Says which named groups and pivots are missing. See docs/BLUEPRINT.md.

const fs = require('node:fs');
const path = require('node:path');

const SCHEMA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'assets', 'capri', 'blueprint.schema.json'), 'utf8'));

// -> { ok, missing: [], missingForms: [], missingPivots: [], unknown: [], unsafe: [] }
function check(svg, schema = SCHEMA) {
  const text = String(svg || '');
  const ids = new Set([...text.matchAll(/\bid\s*=\s*"([^"]+)"/g)].map((m) => m[1]));
  const known = new Set([...schema.parts, ...schema.parts.map((p) => `pivot-${p}`), ...schema.forms.map((f) => `form-${f}`)]);
  const missing = schema.required.filter((p) => !ids.has(p));
  const missingForms = schema.requiredForms.filter((f) => !ids.has(`form-${f}`));
  const missingPivots = schema.parts.filter((p) => ids.has(p) && !ids.has(`pivot-${p}`));
  // Illustrator's own ids (_x31_, SVGID_1_) aren't mistakes; a name that's nearly right is
  const unknown = [...ids].filter((id) => !known.has(id) && /^(?:head|hair|torso|arm|forearm|hand|leg|jaw|form|pivot)[-_]?/i.test(id));
  const unsafe = [/<script\b/i.test(text) && 'script', /\son[a-z]+\s*=/i.test(text) && 'event attributes'].filter(Boolean);
  // her window only loads styles of its own: colors written as a <style> block would all come out black
  const hasCss = /<style\b/i.test(text);
  return { ok: !/<svg\b/i.test(text) ? false : !missing.length && !missingForms.length && !hasCss, isSvg: /<svg\b/i.test(text), hasCss, missing, missingForms, missingPivots, unknown, unsafe };
}

if (require.main === module) {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: node scripts/check-blueprint.js <file.svg>');
    process.exit(2);
  }
  const res = check(fs.readFileSync(file, 'utf8'));
  if (!res.isSvg) console.log('This is not an SVG. In Illustrator: File > Export > Export As > SVG, with "Object IDs: Layer Names".');
  for (const [label, list] of [['Missing parts', res.missing], ['Missing forms', res.missingForms.map((f) => `form-${f}`)], ['Parts with no pivot (they will turn around the corner of the drawing)', res.missingPivots.map((p) => `pivot-${p}`)], ['Names that look like a typo', res.unknown], ['Removed when loaded', res.unsafe]]) {
    if (list.length) console.log(`${label}: ${list.join(', ')}`);
  }
  if (res.hasCss) console.log('It uses CSS for its colors, which she can\'t load. Export again with Styling: Presentation Attributes.');
  console.log(res.ok ? 'Ready: it has everything she needs.' : 'Not ready yet.');
  process.exit(res.ok ? 0 : 1);
}

module.exports = { check };

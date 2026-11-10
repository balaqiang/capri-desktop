#!/usr/bin/env node
'use strict';

// Her models, from what scripts/export-ai.js wrote, into assets/capri/rig/: node scripts/build-rig.js <export folder>
// One file a model, every piece a group of its own under the name you gave it, stacked as in your Layers panel. Each piece's gradients and
// clips get a prefix of their own, so that pieces exported apart can't point at each other's. Illustrator's noise goes.

const fs = require('node:fs');
const path = require('node:path');

const OUT = path.join(__dirname, '..', 'assets', 'capri', 'rig');
const MODELS = { 'Capri-opening': 'opening', 'Capri-sit': 'sit', 'Capri-lean': 'lean', 'Capri-lean-sleep': 'lean-sleep', 'Capri-perch': 'perch', 'Capri-just-head': 'just-head', spark: 'spark' };

// Pieces you've said go furthest back, whatever their place in the file.
const TO_THE_BACK = { 'Capri-lean-sleep': ['hair-back'] };

// Top of the Layers panel first.
function stacked(model) {
  const back = TO_THE_BACK[model.name] || [];
  return [...model.parts.filter((p) => !back.includes(p.name)), ...model.parts.filter((p) => back.includes(p.name))];
}

// What's inside one exported piece: no prolog, no invisible canvas box, every id made its own.
function inner(svg, prefix) {
  const body = /<svg\b[^>]*>([\s\S]*)<\/svg>/.exec(String(svg))?.[1] ?? '';
  let s = body
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<rect\b[^>]*\bid="capri-canvas"[^>]*\/>\s*/g, '')
    .replace(/\s+display="none"/g, '')
    // her window allows no inline styles: the same thing, written as attributes
    .replace(/\sstyle="([^"]*)"/g, (m, css) => css.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
      const at = d.indexOf(':');
      return ` ${d.slice(0, at).trim()}="${d.slice(at + 1).trim()}"`;
    }).join(''));
  const ids = new Set([...s.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  s = s.replace(/\bid="([^"]+)"/g, (m, id) => `id="${prefix}${id}"`)
    .replace(/url\(#([^)]+)\)/g, (m, id) => (ids.has(id) ? `url(#${prefix}${id})` : m))
    .replace(/(xlink:href|href)="#([^"]+)"/g, (m, attr, id) => (ids.has(id) ? `${attr}="#${prefix}${id}"` : m));
  for (let before = ''; before !== s;) {
    before = s;
    s = s.replace(/<g(?:\s[^>]*)?>\s*<\/g>\s*/g, '');
  }
  return s.trim();
}

// model: from manifest.json. read(file) -> its SVG. Stacked bottom first, as SVG draws; data-order is its place in the Layers panel, 0 on top.
function merge(model, read) {
  const groups = stacked(model).reverse().map((p) => {
    const id = (p.name || `layer-${String(p.index + 1).padStart(2, '0')}`).replace(/"/g, '');
    return `<g id="${id}" data-order="${p.index}">${inner(read(p.file), `p${p.index}-`)}</g>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${model.width} ${model.height}">\n<g id="${model.name}">\n${groups.join('\n')}\n</g>\n</svg>\n`;
}

function main() {
  const from = process.argv[2];
  if (!from) {
    console.error('usage: node scripts/build-rig.js <export folder>');
    process.exit(2);
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(from, 'manifest.json'), 'utf8'));
  fs.mkdirSync(OUT, { recursive: true });
  for (const model of manifest.models) {
    const name = MODELS[model.name];
    if (!name) {
      console.log(`not one of hers: ${model.name}`);
      continue;
    }
    const out = merge(model, (file) => fs.readFileSync(path.join(from, model.folder, file), 'utf8'));
    fs.writeFileSync(path.join(OUT, `${name}.svg`), out);
    console.log(`${name}.svg  ${model.parts.length} pieces  ${Math.round(out.length / 1024)} KB`);
  }
}

if (require.main === module) main();

module.exports = { inner, merge, stacked, MODELS };

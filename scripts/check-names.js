'use strict';
// Two kinds of name clash ESLint doesn't see, both of which broke her once:
//  - a class field with a method's name (`this.asked = text` in a class with an `asked()` method: the method
//    is gone after the first chat, and she stopped answering);
//  - a PowerShell variable with two spellings ($text and $Text are ONE variable there: a helper typed
//    nothing because its text param was overwritten).
// node scripts/check-names.js   (exit 1 when it finds one)
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const walk = (dir, ext) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
  const p = path.join(dir, d.name);
  if (d.isDirectory()) return d.name === 'node_modules' ? [] : walk(p, ext);
  return d.name.endsWith(ext) ? [p] : [];
});
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');
const lineOf = (src, index) => src.slice(0, index).split('\n').length;

// The body of each class in a file, by matching braces (strings, comments and regexes are skipped roughly:
// good enough for this code, which never has a brace in a regex without a backslash).
function classes(src) {
  const out = [];
  const head = /\bclass\s+(\w+)[^{]*\{/g;
  let m;
  while ((m = head.exec(src))) {
    let depth = 1, i = head.lastIndex, quote = null;
    for (; i < src.length && depth; i++) {
      const c = src[i];
      if (quote) {
        if (c === '\\') i++;
        else if (c === quote) quote = null;
        continue;
      }
      if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i < 0) break; continue; }
      if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2) + 1; continue; }
      if (c === '"' || c === "'" || c === '`') quote = c;
      else if (c === '{') depth++;
      else if (c === '}') depth--;
    }
    out.push({ name: m[1], start: head.lastIndex, body: src.slice(head.lastIndex, i) });
  }
  return out;
}

function fieldClashes(file) {
  const src = fs.readFileSync(file, 'utf8');
  const found = [];
  for (const cls of classes(src)) {
    const methods = new Set(), setters = new Set();
    for (const m of cls.body.matchAll(/^[ \t]+(?:static\s+)?(?:async\s+)?(get\s+|set\s+)?\*?\s*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/gm)) {
      if (['if', 'for', 'while', 'switch', 'catch', 'function', 'return'].includes(m[2])) continue;
      (m[1]?.startsWith('set') ? setters : methods).add(m[2]);
    }
    for (const name of setters) methods.delete(name); // a setter is meant to be assigned to
    for (const m of cls.body.matchAll(/\bthis\.([A-Za-z_$][\w$]*)\s*=(?!=)\s*([^;\n]*)/g)) {
      const [, name, value] = m;
      if (!methods.has(name)) continue;
      if (new RegExp(`^this\\.${name}\\.bind\\(this\\)`).test(value)) continue; // the method itself, bound
      found.push(`${rel(file)}:${lineOf(src, cls.start + m.index)}  this.${name} = … overwrites ${cls.name}.${name}()`);
    }
  }
  return found;
}

// PowerShell: the C# inside Add-Type @"..."@ blocks is case-sensitive, so it's left out.
function psClashes(file) {
  const src = fs.readFileSync(file, 'utf8').replace(/@"[\s\S]*?"@|@'[\s\S]*?'@/g, (s) => s.replace(/[^\n]/g, ' '));
  const spellings = new Map(); // lower -> Map(spelling -> first line)
  for (const m of src.matchAll(/\$(?!(?:env|script|global|using|local|private):)([A-Za-z_]\w*)/g)) {
    const lower = m[1].toLowerCase();
    if (!spellings.has(lower)) spellings.set(lower, new Map());
    const seen = spellings.get(lower);
    if (!seen.has(m[1])) seen.set(m[1], lineOf(src, m.index));
  }
  const AUTOMATIC = new Set(['true', 'false', 'null', '_', 'args', 'input', 'matches', 'error', 'host', 'lastexitcode', 'psitem', 'this', 'pwd', 'home', 'pid', 'psscriptroot', 'pscmdlet', 'psboundparameters']);
  const found = [];
  for (const [lower, seen] of spellings) {
    if (seen.size < 2 || AUTOMATIC.has(lower)) continue;
    found.push(`${rel(file)}  $${[...seen].map(([s, line]) => `${s} (line ${line})`).join(', $')} are one variable in PowerShell`);
  }
  return found;
}

const problems = [
  ...['src/main', 'src/renderer/js', 'src/settings', 'scripts', 'hooks'].flatMap((d) => walk(path.join(ROOT, d), '.js')).flatMap(fieldClashes),
  ...walk(path.join(ROOT, 'src/main'), '.ps1').flatMap(psClashes),
];
if (problems.length) {
  console.error(`${problems.length} name clash${problems.length > 1 ? 'es' : ''}:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log('no name clashes');

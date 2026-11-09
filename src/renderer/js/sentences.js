// Her answer as it comes in, cut into whole sentences, so she can start saying the first while her model is still on
// the second. push(piece) -> the sentences finished by it; end() -> whatever was left. Her [[tags]] and half-finished
// ones aren't sentences; "3.14", "e.g." and "Dr." don't end one; a one-word "Oh." waits for the next, so it isn't said
// as a sentence of its own.

const ABBREVIATION = /(?:^|[\s(])(?:mr|mrs|ms|dr|prof|st|vs|etc|e\.g|i\.e|no|jl|yg|dll|dst|sdh|tsb)\.$/i;
const MIN_CHARS = 14;
const MAX_CHARS = 220; // a sentence that never ends: cut at a comma, so she isn't silent for all of it

export class Sentencer {
  constructor() {
    this.buffer = '';
  }

  push(piece) {
    this.buffer += piece;
    const out = [];
    for (;;) {
      const cut = this.findEnd();
      if (cut < 0) break;
      out.push(this.buffer.slice(0, cut).trim());
      this.buffer = this.buffer.slice(cut);
    }
    return out.filter(Boolean);
  }

  end() {
    const rest = this.buffer.replace(/\[\[[^\]]*$/, '').trim();
    this.buffer = '';
    return rest;
  }

  // Where the first finished sentence ends, or -1.
  findEnd() {
    const s = this.buffer;
    let inTag = false;
    for (let i = 0; i < s.length; i++) {
      if (s.startsWith('[[', i)) inTag = true;
      if (inTag) {
        const close = s.indexOf(']]', i);
        if (close < 0) return -1; // a tag still coming in
        i = close + 1;
        inTag = false;
        continue;
      }
      const c = s[i];
      if (c === '\n') {
        if (i >= MIN_CHARS) return i + 1;
        continue;
      }
      if (!'.!?…'.includes(c)) continue;
      let end = i + 1;
      while (end < s.length && '.!?…"\')]”’'.includes(s[end])) end++;
      if (end >= s.length) return -1; // could go on: "3." may be "3.14", "!" may be "!?"
      if (!/\s/.test(s[end])) continue;
      if (end < MIN_CHARS) continue;
      if (c === '.' && (ABBREVIATION.test(s.slice(0, end)) || /\d\.$/.test(s.slice(0, end)))) continue;
      return end;
    }
    if (s.length > MAX_CHARS) {
      const comma = Math.max(s.lastIndexOf(', ', MAX_CHARS), s.lastIndexOf('; ', MAX_CHARS));
      if (comma > MIN_CHARS && !s.slice(0, comma).includes('[[')) return comma + 1;
    }
    return -1;
  }
}

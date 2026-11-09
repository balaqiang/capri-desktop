// What you've said so far, while you're still saying it. Each pass over your voice comes back a little different: the words
// that stayed the same from one pass to the next are stable, the rest may change. It's only ever for showing: nothing is
// done with a sentence until it's finished and written out for good.

const fold = (w) => w.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
const wordsOf = (text) => String(text || '').trim().split(/\s+/).filter(Boolean);

export class Transcript {
  constructor() {
    this.reset();
  }

  reset() {
    this.last = [];
    this.stable = 0;
  }

  // The latest pass. -> { text, stable, tail }
  partial(text) {
    const words = wordsOf(text);
    let same = 0;
    while (same < words.length && same < this.last.length && fold(words[same]) === fold(this.last[same])) same++;
    this.last = words;
    this.stable = same;
    return { text: words.join(' '), stable: words.slice(0, same).join(' '), tail: words.slice(same).join(' ') };
  }
}

// A sentence that stops on one of these isn't finished: wait a little longer for the rest.
const DANGLING = /(?:^|\s)(?:and|or|but|the|a|an|to|of|in|on|for|with|that|because|if|dan|atau|tapi|terus|lalu|yang|di|ke|dari|untuk|dengan|kalau|karena|sama|buat)[.,…]*$/i;
export const LONGER_WAIT_MS = 500;
export const unfinished = (text) => DANGLING.test(String(text || '').trim());

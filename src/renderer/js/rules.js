// The pure rules her chat goes by (chat.js): what counts as a question about the world, a song's words
// written out, a claim of hers that she did something. Kept apart so the tests reach them (tests/rules.test.mjs).

// her lyrics shown or put away when you asked in words the app didn't catch ([[lyrics: show]])
const LYRICS_TAG = /\[\[\s*lyrics?\s*:\s*(show|hide|on|off)\s*\]\]/i;
// a song's words written out in her bubble (a model asked about lyrics makes them up): never shown; the real
// ones show over her head, line by line (listen.js)
const LYRIC_DUMP = /\((?:intro|verse|pre-?chorus|chorus|bridge|outro|hook|refrain)\b[^)]{0,12}\)|\[(?:intro|verse|pre-?chorus|chorus|bridge|outro|hook|refrain)\b[^\]]{0,12}\]/i;
const LYRIC_WORD = /\b(?:lyrics?|lirik\w*)\b/i;
// a song you asked her to write herself: hers to write out
const WRITE_ASK = /\b(?:write|make|create|compose|bikin\w*|buat\w*|tulis\w*|karang\w*|ciptakan)\b/i;
const aboutLyrics = (said) => LYRIC_WORD.test(said || '') && !WRITE_ASK.test(said || '');
const NO_DUMP_LINE = "Lyrics? Look over my head: they show line by line, as they're sung.";
// her model claiming it did something on your PC ("Typed it in Notepad. Done.", "sudah kuketik", "I've opened it")
const FAKE_DONE = /\b(?:typed it|i(?:'ve| have)? typed|i(?:'ve| have)? (?:opened|launched|saved|sent) (?:it|notepad|the)|sudah (?:ku)?ketik|udah (?:ku)?ketik|sudah kubuka|udah kubuka|sudah (?:ku)?tulis(?:kan)? di)\b/i;

// A question about the world, looked up on the web first ("siapa presiden indonesia", "who is the ceo of nvidia",
// "harga emas hari ini?"): not one about her, you or the two of you, not chit-chat.
const WORLD_Q = /^(?:siapa(?:kah)?|apa(?:kah)? (?:itu|sih|arti|nama|ibu ?kota)|apakah|kapan(?:kah)?|di ?mana(?:kah)?|berapa(?:kah)?|bagaimana (?:cara|sejarah)|gimana cara|jelaskan|ceritakan tentang|who(?:'s| is| was| are| were| won| invented| wrote| made| founded| owns| directed| sang)|what(?:'s| is| are| was| were| does| did)|when (?:is|was|did|does|will)|where (?:is|was|are)|how (?:many|much|old|tall|far|long|big)|which (?:country|team|city|company|year)|define|explain)\b/i;
const ABOUT_US = /\b(?:kamu|kau|lu|lo|elo|anda|km|you|your|yours|yourself|capri|aku|saya|gue|gw|me|my|mine|kita|we|our|us|(?:umur|nama|rumah|pacar|teman|lagu|hobi|kabar|warna|makanan|film)(?:mu|ku))\b/i;
const CHITCHAT = /^(?:what(?:'s| is) (?:up|new|good|wrong|happening|going on)|apa kabar)\b/i;
const NEWS = /\b(?:harga|kurs|cuaca|skor|hasil|berita|terbaru|price|weather|score|news|latest)\b/i;
function worldQuestion(text) {
  const t = String(text || '').trim().replace(/^(?:(?:hey|hi|halo|hai) )?(?:capri|kapri)[,\s]+/i, '');
  if (t.length < 8 || t.length > 200 || ABOUT_US.test(t) || CHITCHAT.test(t)) return false;
  return WORLD_Q.test(t) || (NEWS.test(t) && /\?$/.test(t));
}

// What the web said (main/web.js), for her model: newer than what it remembers, so used first, briefly.
function webNote(question, found) {
  if (!found) return '';
  const results = (found.results || []).slice(0, 6);
  if (!results.length) return `They asked something to look up ("${question}"), but the web search found nothing useful: answer from what you know, and say so if you're not sure.`;
  // (said this firmly because a model trusts its own memory first: it answered last year's president otherwise)
  return [
    `Today is ${new Date().toDateString()}. What you remember stops years ago and is OUT OF DATE: who holds an office, prices, scores and news have changed since.`,
    `You just searched the web for their question "${question}". The results, from today:`,
    ...results.map((r, i) => `${i + 1}. ${r.title} (${r.from}): ${r.text}`),
    `Answer "${question}" ONLY from these results: if they name a person, a number or a date, that is the answer, even if you remember something else. Never answer it from memory. If they don't answer it, say you couldn't find it. One or two sentences, in character.`,
  ].join('\n');
}

// ---- exact math: her calculator ----
// A model gets sums wrong; a calculator doesn't. Numbers, + - * / ^ %, parentheses, √ and sqrt( ): read by this
// little parser (her page's security forbids running text as code, and nothing but arithmetic is ever read).
// calc('12*(3+4)') -> 84, calc('2^10') -> 1024, calc('15% * 200') -> 30, calc('hello') -> null
// strict (a worksheet's sums): "1.250" could be 1.25 or one thousand two hundred fifty, so such a sum isn't worked
// out at all, unless a decimal comma in it says how it's written ("1.250 + 3,5" is Indonesian: 1253.5)
function calc(expr, { strict = false } = {}) {
  let s = String(expr || '').trim().replace(/[×✕✖]/g, '*').replace(/[÷]/g, '/').replace(/[−–—]/g, '-').replace(/\*\*/g, '^')
    .replace(/([\d)])\s*[xX]\s*(?=[\d(])/g, '$1*').replace(/([\d)])\s*:\s*(?=[\d(])/g, '$1/').replace(/\bsqrt\b|akar/gi, '√');
  const decimalComma = /\d,\d{1,2}(?!\d)|\d,\d{4,}/.test(s);
  if (decimalComma) s = s.replace(/(\d)\.(?=\d{3}(?!\d))/g, '$1').replace(/(\d),(\d)/g, '$1.$2'); // 1.250,5 -> 1250.5
  else if (/\d,\d{3}(?!\d)/.test(s)) s = s.replace(/(\d),(?=\d{3}(?!\d))/g, '$1'); // 1,000,000
  else if (strict && /\d\.\d{3}(?!\d)/.test(s)) return null; // 1.250: which one?
  if (!s || /[^\d.\s+\-*/^%()√]/.test(s)) return null;
  const tokens = s.match(/\d+(?:\.\d+)?|\.\d+|[+\-*/^%()√]/g) || [];
  let i = 0;
  const peek = () => tokens[i];
  const next = () => tokens[i++];
  function primary() {
    const t = next();
    if (t === undefined) throw new Error('end');
    if (t === '(') {
      const v = sum();
      if (next() !== ')') throw new Error(')');
      return v;
    }
    if (t === '√') return Math.sqrt(unary());
    const n = Number(t);
    if (!Number.isFinite(n)) throw new Error('number');
    return n;
  }
  function postfix() {
    let v = primary();
    while (peek() === '%') { next(); v /= 100; }
    return v;
  }
  function unary() {
    if (peek() === '-') { next(); return -unary(); }
    if (peek() === '+') { next(); return unary(); }
    return power();
  }
  function power() {
    const base = postfix();
    if (peek() === '^') { next(); return base ** unary(); }
    return base;
  }
  function product() {
    let v = unary();
    for (;;) {
      if (peek() === '*') { next(); v *= unary(); } else if (peek() === '/') { next(); v /= unary(); } else if (peek() === '(' || peek() === '√') v *= unary(); // 2(3+4)
      else return v;
    }
  }
  function sum() {
    let v = product();
    for (;;) {
      if (peek() === '+') { next(); v += product(); } else if (peek() === '-') { next(); v -= product(); } else return v;
    }
  }
  try {
    const v = sum();
    return i === tokens.length && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

// a result as people write it: 84, 0.5, 3.333333 (no 0.30000000000000004)
const number = (v) => (Number.isInteger(v) ? String(v) : String(Number(v.toFixed(6))));

// [[calc: 12*(3+4)]] in her answer: the exact result in its place (what can't be read stays as it was written)
// A model writing the result again right after it ("[[calc: 125*8]] 1000", "[[calc: 3*24500]] Rp 73.500"): once,
// in its own way of writing it (Rp 73.500 reads better than 73500) since the calculator says it's right.
const withSums = (text) => String(text || '').replace(/\[\[\s*calc\s*:\s*([^\]\n]{1,160}?)\s*\]\](?:([ \t]*)((?:Rp\.?|IDR|\$|€|£)\s?)?(-?\d[\d.,]*\d|-?\d))?/gi, (m, e, gap, unit, again) => {
  const v = calc(e);
  if (v === null) return `${e}${again ? `${gap}${unit || ''}${again}` : ''}`;
  if (again === undefined) return number(v);
  const same = [calc(again), calc(again.replace(/\.(?=\d{3}(?!\d))/g, '').replace(/,(?=\d{1,2}(?!\d))/, '.'))].includes(v);
  return same ? `${unit || ''}${again}` : `${number(v)}${gap}${unit || ''}${again}`;
});

// The sums on a worksheet (the text read off the screen): "1. 25 x 4 = ...", "b) (12+8)/5 =", "3.  7^2 = ?"
// -> [{ line, expr, value }], so her answer uses the right results.
function sumsIn(text) {
  const out = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    const e = line.replace(/^(?:no\.?\s*)?(?:\(?\d{1,2}[.)]|\(?[a-h][.)])\s+/i, '').replace(/\s*=\s*(?:\?|_+|\.{2,}|…|\[\s*\]|\(\s*\))?\s*$/, '').trim();
    if (!/\d\s*(?:[-+*/^:x×÷%]|\*\*)\s*[\d(√.]|√\s*\d/.test(e) || e.length > 80) continue;
    const value = calc(e, { strict: true });
    if (value !== null) out.push({ line, expr: e, value: number(value) });
    if (out.length >= 30) break;
  }
  return out;
}

// Her homework answers, set straight (the model's wording kept):
//  - one paragraph a question: "…Jawaban: 1000 2. (48 + 72) : 6" -> a blank line before "2."
//  - a question that is a sum on the sheet (sumsIn) gets the calculator's result as its answer, whatever the
//    model wrote after "Jawaban:" / "Answer:" (it once wrote 16 under "(48 + 72) : 6 = 20")
const squash = (s) => String(s).replace(/[×✕✖xX*]/g, '*').replace(/[÷:]/g, '/').replace(/\s+/g, '');
function fixAnswers(answer, sums = []) {
  let text = String(answer || '');
  // the questions in order: each next number starts its own paragraph
  let from = 0;
  for (let n = 1; n <= 40; n++) {
    const re = new RegExp(String.raw`(^|[^\d.,])(${n}[.)])\s`, 'g');
    re.lastIndex = from;
    const m = re.exec(text);
    if (!m) { if (n > 1) break; continue; }
    const at = m.index + m[1].length;
    const before = text.slice(0, at);
    if (at > 0 && !/\n\s*\n\s*$/.test(before)) text = `${before.replace(/\s+$/, '')}\n\n${text.slice(at)}`;
    from = text.indexOf(m[2], at) + m[2].length;
  }
  if (!sums.length) return text;
  return text.split(/\n\s*\n/).map((para) => {
    const flat = squash(para);
    const sum = sums.find((s) => squash(s.expr).length >= 3 && flat.includes(squash(s.expr)));
    if (!sum) return para;
    return para.replace(/((?:Jawaban|Jawab|Answer|Hasil(?:nya)?|Result)\s*:\s*)(-?\d[\d.,]*)/gi, (m, label, n) => {
      const v = [calc(n), calc(n.replace(/\.(?=\d{3}(?!\d))/g, '').replace(/,(?=\d{1,2}(?!\d))/, '.'))];
      return v.includes(Number(sum.value)) ? m : `${label}${sum.value}`;
    });
  }).join('\n\n');
}

export { fixAnswers, LYRICS_TAG, LYRIC_DUMP, LYRIC_WORD, WRITE_ASK, aboutLyrics, NO_DUMP_LINE, FAKE_DONE, WORLD_Q, ABOUT_US, CHITCHAT, NEWS, worldQuestion, webNote, calc, number, withSums, sumsIn };

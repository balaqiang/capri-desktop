'use strict';

// A model marked on the same questions every time (assets/eval/prompts.json): is she in character, short, in the right
// language, and honest about what she can't do? A newly trained model only replaces the one you have if it does better.

// `said` -> the checks it passed out of the checks asked for
const INDONESIAN = /\b(?:yang|dan|aku|kamu|ini|itu|tidak|nggak|gak|apa|dengan|untuk|sudah|udah|bisa|kan|dong|sih|nih|ya|lagi|buat|ada|mau)\b/gi;
const ENGLISH = /\b(?:the|and|you|your|that|this|what|with|for|are|was|have|not|just|it's|i'm|don't|can|will|like)\b/gi;
const count = (re, s) => (String(s).match(re) || []).length;

const CHECKS = {
  short: (a, v) => a.length <= v,
  id: (a) => count(INDONESIAN, a) >= count(ENGLISH, a),
  en: (a) => count(ENGLISH, a) > count(INDONESIAN, a),
  must: (a, v) => new RegExp(v, 'i').test(a),
  mustNot: (a, v) => !new RegExp(v, 'i').test(a),
  answered: (a) => a.trim().length >= 2,
};

// Her tags aren't part of what she said.
const spoken = (raw) => String(raw || '').replace(/<think>[\s\S]*?(?:<\/think>|$)/g, '').replace(/\[\[[^\]]*\]\]|\[[a-z]+\]/gi, '').trim();

// one question's answer -> { passed, total, failed: [names] }
function mark(answer, checks) {
  const a = spoken(answer);
  const failed = [];
  let total = 0;
  for (const [name, value] of Object.entries(checks)) {
    const list = Array.isArray(value) && (name === 'must' || name === 'mustNot') ? value : [value];
    for (const v of list) {
      total++;
      if (!CHECKS[name](a, v)) failed.push(name);
    }
  }
  return { passed: total - failed.length, total, failed };
}

// { groups: [{ name, checks, prompts: [string] }] } -> the questions, each with the checks of its group
const flatten = (set) => set.groups.flatMap((g) => g.prompts.map((prompt) => ({ group: g.name, prompt, checks: { answered: true, ...g.checks } })));

// ask(messages) -> her answer. -> { score, byGroup: { name: score }, questions, seconds }
async function run({ set, ask, persona, limit = 0, onProgress = () => {}, shouldStop = () => false }) {
  const all = flatten(set);
  // a little of every group when it isn't the whole set
  const questions = limit && limit < all.length ? all.filter((_, i) => i % Math.ceil(all.length / limit) === 0) : all;
  const started = Date.now();
  const groups = {};
  let passed = 0;
  let total = 0;
  let done = 0;
  for (const q of questions) {
    if (shouldStop()) break;
    const answer = await ask([{ role: 'system', content: persona }, { role: 'user', content: q.prompt }]).catch(() => '');
    const m = mark(answer, q.checks);
    passed += m.passed;
    total += m.total;
    const g = (groups[q.group] ||= { passed: 0, total: 0 });
    g.passed += m.passed;
    g.total += m.total;
    onProgress(++done, questions.length);
  }
  const pct = (p, t) => (t ? Math.round((p / t) * 1000) / 10 : 0);
  return { score: pct(passed, total), byGroup: Object.fromEntries(Object.entries(groups).map(([k, g]) => [k, pct(g.passed, g.total)])), questions: done, seconds: Math.round((Date.now() - started) / 1000) };
}

// A new model replaces the current one only if it's better overall and nothing got much worse.
function better(candidate, current, { margin = 2, worstDrop = 10 } = {}) {
  if (candidate.score < current.score + margin) return { yes: false, why: 'not better overall' };
  const fell = Object.keys(current.byGroup).find((g) => (candidate.byGroup[g] ?? 0) < current.byGroup[g] - worstDrop);
  return fell ? { yes: false, why: `much worse at ${fell}` } : { yes: true, why: '' };
}

module.exports = { run, mark, flatten, better, spoken, CHECKS };

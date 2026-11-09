'use strict';

// A goal that takes several steps ("cari info tentang kucing lalu tulis ringkasannya di notepad"): her model writes the
// steps as JSON, they're checked against her tools (tools.js), and run one at a time, each told as it goes. Her model
// only ever proposes: what it writes that isn't one of her tools, or doesn't have what the tool needs, is thrown out.

const { check, describe, MAX_TEXT } = require('./tools');

const MAX_STEPS = 8;

function prompt(tools) {
  return `You plan tasks for a desktop assistant. Reply with ONLY one JSON object and nothing else:
{"steps":[{"tool":"<tool name>","args":{...},"why":"<a few words saying what this step does, in the user's language>"}]}

The tools, and nothing else:
${describe(tools)}

Rules:
- As few steps as it takes, ${MAX_STEPS} at most. Do what was asked, nothing more.
- "$last" inside an argument stands for the text the step before it gave.
- A tool with no arguments takes "args":{}. browser_read only comes after browser_open or browser_search.
- Never make up facts: to know something, use web_lookup, browser_read or recall first, then think.
- To write or summarize something and put it in an app: think, then type_text with "text":"$last".
- If these tools can't do it, reply {"steps":[]}.

Example. "cari info tentang kucing lalu tulis ringkasannya di notepad":
{"steps":[{"tool":"web_lookup","args":{"query":"kucing"},"why":"cari info kucing"},{"tool":"think","args":{"prompt":"Ringkas dalam tiga kalimat bahasa Indonesia:\\n$last"},"why":"meringkas"},{"tool":"open","args":{"what":"notepad"},"why":"buka Notepad"},{"tool":"type_text","args":{"text":"$last","app":"notepad"},"why":"mengetik ringkasannya"}]}`;
}

// Real line breaks inside its strings, and a comma before a closing bracket: a small model's usual slips.
function repaired(json) {
  let out = '';
  let quoted = false;
  for (let i = 0; i < json.length; i++) {
    const c = json[i];
    if (quoted && c === '\\') {
      out += c + (json[++i] ?? '');
      continue;
    }
    if (c === '"') quoted = !quoted;
    out += quoted && c === '\n' ? '\\n' : quoted && c === '\r' ? '' : quoted && c === '\t' ? '\\t' : c;
  }
  return out.replace(/,(\s*[\]}])/g, '$1').replace(/"args"\s*:\s*\{\s*""\s*\}/g, '"args":{}');
}

// The JSON in what her model answered (a small one wraps it in words or a code block).
function parse(answer) {
  const text = String(answer || '').replace(/<think>[\s\S]*?<\/think>/g, '');
  const from = text.indexOf('{');
  const to = text.lastIndexOf('}');
  if (from < 0 || to <= from) return null;
  for (const json of [text.slice(from, to + 1), repaired(text.slice(from, to + 1))]) {
    try {
      const value = JSON.parse(json);
      if (Array.isArray(value?.steps)) return value;
    } catch { /* the next way */ }
  }
  return null;
}

// What reaches into your PC only happens if you said so: a step your words have no ground for is dropped (a model likes
// to close the app when it's done, or to write the answer into a Notepad nobody mentioned).
const GROUNDS = {
  close_app: /\b(?:close|quit|exit|tutup\w*|keluar\w*|matikan|matiin)\b/i,
  type_text: /\b(?:type|write|enter|put|note|ketik\w*|tulis\w*|catat\w*|isi\w*|masuk\w*)\b/i,
  press_key: /\b(?:press|save|send|enter|tekan|pencet|simpan|kirim)\b/i,
  click_button: /\b(?:click|tap|press|klik|pencet|tekan)\b/i,
  write_code: /\b(?:code|coding|script|program|kode|koding|ngoding|skrip)\b/i,
  play_music: /\b(?:play|music|song|putar\w*|puter\w*|setel\w*|lagu\w*|musik\w*)\b/i,
  media: /\b(?:pause|play|next|skip|volume|mute|louder|quieter|jeda|lanjut\w*|lewati|ganti lagu|kecil\w*|keras\w*|bisu\w*)\b/i,
};
const fold = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const groundedIn = (goal) => (step) => (step.tool === 'open' ? fold(goal).includes(fold(step.args.what)) : !GROUNDS[step.tool] || GROUNDS[step.tool].test(goal));

// Every step good, or the first thing wrong with it.
function review(value, tools, goal = '') {
  if (!value) return { ok: false, error: 'that was not the JSON asked for' };
  if (!value.steps.length) return { ok: true, steps: [] };
  if (value.steps.length > MAX_STEPS) return { ok: false, error: `more than ${MAX_STEPS} steps` };
  const checked = [];
  for (const raw of value.steps) {
    const res = check(raw, tools);
    if (!res.ok) return res;
    checked.push(res.step);
  }
  // (reading a page nothing has opened yet is a slip, not a step)
  const opened = (i) => checked.slice(0, i).some((s) => s.tool === 'browser_open' || s.tool === 'browser_search');
  const steps = (goal ? checked.filter(groundedIn(goal)) : checked).filter((s) => s.tool !== 'browser_read' || opened(checked.indexOf(s)));
  if (steps[0] && /\$last/.test(JSON.stringify(steps[0].args))) return { ok: false, error: 'the first step has no "$last" to use' };
  return { ok: true, steps };
}

// -> { goal, steps, risk } (steps empty: it can't be done with her tools), or null: her model never wrote a usable one.
async function plan(goal, { tools, ask, context = '' }) {
  const messages = [
    { role: 'system', content: prompt(tools) },
    { role: 'user', content: `${context ? `${context}\n\n` : ''}The task: "${goal}"` },
  ];
  for (let attempt = 0; attempt < 2; attempt++) {
    const answer = await ask(messages, { timeout: 45000 }).catch(() => '');
    const res = review(parse(answer), tools, goal);
    if (!res.ok && process.env.CAPRI_PLAN_DEBUG) console.log('[plan]', res.error, String(answer).slice(0, 900));
    if (res.ok) return { goal, steps: res.steps, risk: res.steps.reduce((m, s) => Math.max(m, s.risk), 0) };
    messages.push({ role: 'assistant', content: String(answer || '').slice(0, 1500) }, { role: 'user', content: `That can't be used: ${res.error}. Reply with only the corrected JSON.` });
  }
  return null;
}

// The steps, one to a line, for you to read before saying go.
const outline = (p) => p.steps.map((s, i) => `${i + 1}. ${s.why}`).join('\n');

// One after the other. $last is what the step before gave. A step that fails ends it there, and it says which.
// { tasks, tools }: what she tells you as she goes, and what there is. -> { ok, done, total, failedAt, said, last }
async function run(p, { tasks, tools, sayNo = 'You said no.' }) {
  let last = '';
  const said = [];
  for (const [i, step] of p.steps.entries()) {
    tasks.step(step.why, i + 1);
    if (tasks.stopped) return { ok: false, stopped: true, done: i, total: p.steps.length, said, last };
    if (step.risk >= 2 && !(await tasks.ask(step.why))) return { ok: false, refused: true, done: i, total: p.steps.length, said: [...said, sayNo], last };
    const args = Object.fromEntries(Object.entries(step.args).map(([k, v]) => [k, typeof v === 'string' ? v.replaceAll('$last', last).slice(0, MAX_TEXT + 500) : v]));
    const res = await tools[step.tool].run(args).catch((err) => ({ ok: false, say: err.message }));
    if (res.say) said.push(res.say);
    if (!res.ok) return { ok: false, failedAt: i, why: step.why, done: i, total: p.steps.length, said, last };
    if (res.text !== undefined) last = res.text;
  }
  return { ok: true, done: p.steps.length, total: p.steps.length, said, last };
}

module.exports = { plan, parse, review, outline, run, prompt, MAX_STEPS };

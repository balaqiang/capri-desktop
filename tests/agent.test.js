'use strict';

// Told as she goes, plans checked against her tools, her memory, what you gave her to read, her skills, her browser's limits.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

require('./electron-stub');
const { createTasks, orStopped } = require('../src/main/actions/tasks');
const { createTools, check } = require('../src/main/actions/tools');
const planner = require('../src/main/actions/planner');
const router = require('../src/main/engines/router');
const { openDb, createVectors } = require('../src/main/engines/db');
const { createMemory, workingNote } = require('../src/main/engines/memory');
const { createKnowledge, chunks } = require('../src/main/engines/knowledge');
const skills = require('../src/main/skills/loader');
const { safeUrl, RISKY, SECRET_FIELD } = require('../src/main/platform/browser');
const errands = require('../src/main/commands/errands');
const { tokens } = require('../src/main/engines/recall');

const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'capri-test-'));

function fakeTasks() {
  const events = [];
  return { events, tasks: createTasks({ emit: (e) => events.push(e) }) };
}

test('a task: said before it starts, its steps, its end', async () => {
  const { events, tasks } = fakeTasks();
  await tasks.run({ kind: 'code', title: 'snake', line: 'On it.' }, async () => {
    assert.strictEqual(events[0].phase, 'start', 'told before the work');
    tasks.step('writing');
    return { handled: true };
  });
  assert.deepStrictEqual(events.map((e) => e.phase), ['start', 'step', 'end']);
  assert.strictEqual(events[0].line, 'On it.');
  assert.strictEqual(events.at(-1).ok, true);
  assert.strictEqual(tasks.current, null);
});

test('a task inside a task is a step of it; a failure ends it', async () => {
  const { events, tasks } = fakeTasks();
  await tasks.run({ kind: 'chain', title: 'all', total: 2 }, async () => {
    await tasks.run({ kind: 'code', title: 'inner' }, async () => ({ handled: true }));
    return { handled: true };
  });
  assert.deepStrictEqual(events.map((e) => e.phase), ['start', 'step', 'end']);
  await assert.rejects(tasks.run({ kind: 'code', title: 'x' }, async () => { throw new Error('boom'); }));
  assert.strictEqual(events.at(-1).ok, false);
  assert.strictEqual(tasks.current, null, 'nothing left hanging');
});

test('stop: what was waited for stops being waited for', async () => {
  const { tasks } = fakeTasks();
  const never = new Promise(() => {});
  const res = tasks.run({ kind: 'code', title: 'x' }, async () => {
    setTimeout(() => tasks.cancel(), 5);
    const v = await orStopped(never, tasks.signal, 'stopped');
    return { handled: true, v };
  });
  assert.strictEqual((await res).v, 'stopped');
});

test('a yes or no in the middle of a task', async () => {
  const { events, tasks } = fakeTasks();
  tasks.begin({ kind: 'chain', title: 'x' });
  const asked = tasks.ask('Close Discord?');
  assert.strictEqual(events.at(-1).phase, 'ask');
  assert.strictEqual(tasks.answer(true), true);
  assert.strictEqual(await asked, true);
  const silence = tasks.ask('Again?', { timeout: 5 });
  assert.strictEqual(await silence, false, 'no answer is a no');
  const stopped = tasks.ask('Once more?');
  tasks.cancel();
  assert.strictEqual(await stopped, false);
  tasks.end();
});

const noDeps = { parse: errands.parse, act: async () => ({ handled: true, reply: 'ok' }), ask: async () => 'text', lookup: async () => null };

test('tools: only what exists, with what it needs', () => {
  const tools = createTools(noDeps);
  assert.strictEqual(check({ tool: 'format_disk', args: {} }, tools).ok, false);
  assert.strictEqual(check({ tool: 'constructor', args: {} }, tools).ok, false, 'not a property of an object either');
  assert.strictEqual(check({ tool: 'open', args: {} }, tools).ok, false);
  assert.strictEqual(check({ tool: 'media', args: { action: 'explode' } }, tools).ok, false);
  assert.strictEqual(check({ tool: 'set_timer', args: { minutes: 99999 } }, tools).ok, false);
  const good = check({ tool: 'open', args: { what: 'notepad', extra: 'dropped' }, why: 'buka' }, tools);
  assert.deepStrictEqual(good.step, { tool: 'open', args: { what: 'notepad' }, why: 'buka', risk: 1 });
  // what's seen outside her waits for your go; only what stays inside her just runs
  for (const [tool, args] of [['play_music', { song: 'x' }], ['media', { action: 'pause' }], ['type_text', { text: 'x' }]]) assert.strictEqual(check({ tool, args }, tools).step.risk, 1, tool);
  for (const [tool, args] of [['web_lookup', { query: 'x' }], ['think', { prompt: 'x' }], ['set_timer', { minutes: 5 }]]) assert.strictEqual(check({ tool, args }, tools).step.risk, 0, tool);
  assert.strictEqual(check({ tool: 'close_app', args: { name: 'x' } }, tools).step.risk, 2);
  assert.strictEqual(check({ tool: 'type_text', args: { text: 'x', app: null } }, tools).ok, true, 'an optional one left empty');
});

test('a plan: the JSON in what a small model writes', () => {
  assert.deepStrictEqual(planner.parse('Sure!\n```json\n{"steps":[{"tool":"open"}]}\n```'), { steps: [{ tool: 'open' }] });
  assert.ok(planner.parse('{"steps":[{"tool":"x","args":{"prompt":"line one\nline two"}},]}'), 'real line breaks and a trailing comma');
  assert.ok(planner.parse('{"steps":[{"tool":"browser_read","args":{""}}]}'), 'empty args written wrong');
  assert.strictEqual(planner.parse('I cannot do that.'), null);
});

test('a plan: what you never asked for is dropped', () => {
  const tools = createTools(noDeps);
  const value = { steps: [{ tool: 'web_lookup', args: { query: 'kucing' } }, { tool: 'think', args: { prompt: 'x $last' } }, { tool: 'close_app', args: { name: 'chrome' } }, { tool: 'open', args: { what: 'notepad' } }, { tool: 'type_text', args: { text: '$last', app: 'notepad' } }] };
  const said = planner.review(value, tools, 'cari info kucing terus kasih tau rangkumannya');
  assert.deepStrictEqual(said.steps.map((s) => s.tool), ['web_lookup', 'think']);
  const asked = planner.review(value, tools, 'cari info kucing lalu tulis ringkasannya di notepad, terus tutup chrome');
  assert.deepStrictEqual(asked.steps.map((s) => s.tool), ['web_lookup', 'think', 'close_app', 'open', 'type_text']);
  const noPage = planner.review({ steps: [{ tool: 'web_lookup', args: { query: 'x' } }, { tool: 'browser_read', args: {} }] }, tools, 'cari x');
  assert.deepStrictEqual(noPage.steps.map((s) => s.tool), ['web_lookup'], 'reading a page nothing opened');
  assert.strictEqual(planner.review({ steps: [{ tool: 'think', args: { prompt: '$last' } }] }, tools, 'x').ok, false);
  assert.strictEqual(planner.review({ steps: new Array(9).fill({ tool: 'think', args: { prompt: 'x' } }) }, tools, 'x').ok, false);
});

test('a plan asks her model again once, then gives up', async () => {
  const tools = createTools(noDeps);
  let calls = 0;
  const p = await planner.plan('open notepad', { tools, ask: async () => (++calls === 1 ? 'nonsense' : '{"steps":[{"tool":"open","args":{"what":"notepad"},"why":"buka"}]}') });
  assert.strictEqual(calls, 2);
  assert.strictEqual(p.steps[0].tool, 'open');
  assert.strictEqual(await planner.plan('open notepad', { tools, ask: async () => 'nope' }), null);
});

test('a plan runs in order, what one step gave going to the next', async () => {
  const seen = [];
  const tools = { a: { args: {}, risk: 0, run: async () => ({ ok: true, text: 'kucing lucu', say: '' }) }, b: { args: {}, risk: 0, run: async (args) => { seen.push(args.t); return { ok: true, say: 'done b' }; } } };
  const { tasks } = fakeTasks();
  tasks.begin({ kind: 'chain', title: 'x' });
  const res = await planner.run({ steps: [{ tool: 'a', args: {}, why: 'a', risk: 0 }, { tool: 'b', args: { t: 'isi: $last' }, why: 'b', risk: 0 }] }, { tasks, tools });
  assert.deepStrictEqual(seen, ['isi: kucing lucu']);
  assert.strictEqual(res.ok, true);
  assert.deepStrictEqual(res.said, ['done b']);
});

test('a plan: a failed step ends it, a no ends it, Stop ends it', async () => {
  const ran = [];
  const tool = (ok, risk = 0) => ({ args: {}, risk, run: async () => { ran.push(ok); return { ok, say: ok ? '' : 'nope' }; } });
  const tools = { good: tool(true), bad: tool(false), risky: tool(true, 2) };
  const step = (name, risk = 0) => ({ tool: name, args: {}, why: name, risk });
  let { tasks } = fakeTasks();
  tasks.begin({ kind: 'chain', title: 'x' });
  let res = await planner.run({ steps: [step('good'), step('bad'), step('good')] }, { tasks, tools });
  assert.strictEqual(res.failedAt, 1);
  assert.deepStrictEqual(ran, [true, false], 'nothing after it');
  ({ tasks } = fakeTasks());
  tasks.begin({ kind: 'chain', title: 'x' });
  ran.length = 0;
  const going = planner.run({ steps: [step('risky', 2)] }, { tasks, tools });
  tasks.answer(false);
  res = await going;
  assert.strictEqual(res.refused, true);
  assert.deepStrictEqual(ran, [], 'never run without your yes');
  ({ tasks } = fakeTasks());
  tasks.begin({ kind: 'chain', title: 'x' });
  tasks.cancel();
  res = await planner.run({ steps: [step('good')] }, { tasks, tools });
  assert.strictEqual(res.stopped, true);
});

test('what goes to a plan, and what is just a chat', () => {
  for (const s of ['cari info tentang kucing lalu tulis ringkasannya di notepad', 'search for cats and then write a summary in notepad', 'rencanakan belajar matematika', 'buka notepad, ketik puisi hujan, terus simpan']) assert.ok(router.wantsPlan(s), s);
  for (const s of ['aku makan lalu tidur', 'apa yang harus aku lakukan lalu tulis apa?', 'halo capri', 'kamu lagi apa', 'open notepad', 'I went home and then slept']) assert.ok(!router.wantsPlan(s), s);
});

test('one step needing what another came up with is a plan, not a chain typed as it stands', () => {
  const uses = (s) => router.usesEarlierResult(errands.chain(s) || []);
  assert.ok(uses('cari info tentang kucing persia lalu tulis ringkasannya di notepad'));
  assert.ok(uses('search for cats and then type the summary in notepad'));
  assert.ok(!uses('open notepad and type hello tiktok'));
  assert.ok(!uses('buka notepad lalu ketik halo'));
});

test('the router: skill first, then what you gave her to read, then her memory', () => {
  const skill = { id: 'research', web: true };
  assert.deepStrictEqual(router.decide('x', { skill }), { route: 'skill', skill, web: true });
  assert.strictEqual(router.decide('x', { knowledgeHits: [{ words: true }] }).route, 'knowledge');
  assert.strictEqual(router.decide('x', { knowledgeHits: [{ words: true }] }).web, false, 'no need for the web');
  assert.strictEqual(router.decide('kemarin aku bilang apa', {}).route, 'memory');
  assert.strictEqual(router.decide('siapa presiden', {}).route, 'chat');
  assert.strictEqual(router.decide('siapa presiden', {}).web, undefined);
});

// a tiny embedder: words to a vector, so that "kucing" and "cat" are close
const VOCAB = [['kucing', 'cat', 'meong'], ['mobil', 'car'], ['ujian', 'exam'], ['adik', 'sister', 'sibling'], ['kopi', 'coffee']];
const fakeEmbed = async (texts) => texts.map((t) => {
  const low = t.toLowerCase();
  const v = VOCAB.map((group) => (group.some((w) => low.includes(w)) ? 1 : 0));
  return v.some(Boolean) ? v : [0.01, 0.01, 0.01, 0.01, 0.01];
});

function engine({ vec = true, now = () => Date.now(), ask = null } = {}) {
  const handle = openDb(path.join(tempDir(), 'm.db'), { vec });
  const vectors = createVectors(handle);
  const memory = createMemory({ db: handle.db, vectors, tokens, embed: fakeEmbed, model: () => 'fake', ask, now });
  return { ...handle, vectors, memory, knowledge: createKnowledge({ db: handle.db, memory, vectors }) };
}

test('her notes: the list in her settings is the truth', async () => {
  const { memory } = engine();
  memory.syncFacts(['My sister is Ayu', 'I like black coffee']);
  memory.syncFacts(['My sister is Ayu', 'I study in Bandung']);
  assert.strictEqual(memory.counts().fact, 2);
  const found = await memory.forChat('adikku siapa namanya ayu');
  assert.ok(found.facts.includes('My sister is Ayu'));
  assert.ok(!found.facts.includes('I like black coffee'));
});

test('words: "lagunya" finds "lagu", Indonesian endings and all', async () => {
  const { memory } = engine();
  memory.put('chat', 'lagu favoritku itu judulnya senja', { meta: { day: '2026-11-01' } });
  memory.put('chat', 'besok ada rapat penting', { meta: { day: '2026-11-02' } });
  const found = await memory.search('lagunya apa', { spaces: ['chat'] });
  assert.strictEqual(found.length, 1);
  assert.match(found[0].text, /senja/);
});

for (const vec of [true, false]) {
  test(`meaning (${vec ? 'sqlite-vec' : 'plain scan'}): "cat" finds "kucing" with not one word in common`, async () => {
    const e = engine({ vec });
    assert.strictEqual(e.hasVec, vec);
    e.memory.put('fact', 'Si kucing namanya Mochi');
    e.memory.put('fact', 'Mobil merah di garasi');
    await e.memory.embedPending();
    assert.strictEqual(e.memory.counts().withMeaning, 2);
    const found = await e.memory.search('my cat', { spaces: ['fact'] });
    assert.strictEqual(found[0].text, 'Si kucing namanya Mochi');
    assert.ok(found[0].close);
    assert.strictEqual(found.length, 1, 'the car has nothing to do with it');
  });
}

test('a new embedding model: the old meanings are dropped and made again', async () => {
  const e = engine();
  e.memory.put('fact', 'kucing');
  await e.memory.embedPending();
  e.vectors.ensure('other-model', 3);
  assert.strictEqual(e.memory.counts().withMeaning, 0);
});

test('short term: what is going on for you, and it fades', async () => {
  let clock = Date.now();
  const { memory } = engine({ now: () => clock });
  assert.ok(workingNote('besok aku ujian matematika'));
  assert.strictEqual(workingNote('apa besok hujan?'), '');
  assert.strictEqual(workingNote('halo'), '');
  memory.addTurn('user', 'besok aku ujian matematika');
  memory.addTurn('assistant', 'semangat ya, besok pasti bisa');
  assert.deepStrictEqual(memory.working(), ['besok aku ujian matematika']);
  assert.strictEqual(memory.counts().chat, 1, 'your words, not hers');
  clock += 25 * 3600000;
  assert.deepStrictEqual(memory.working(), []);
  assert.strictEqual(memory.counts().chat, 1, 'what you said stays');
});

test('episodes: a day written up once; a chat that barely happened is not', async () => {
  let asked = 0;
  const { memory } = engine({ ask: async () => { asked++; return 'Mereka belajar matematika dan senang.'; } });
  const messages = new Array(8).fill({ role: 'user', text: 'halo' });
  assert.strictEqual(await memory.writeEpisodes([{ day: '2026-11-01', messages }, { day: '2026-11-02', messages: messages.slice(0, 2) }]), 1);
  assert.strictEqual(await memory.writeEpisodes([{ day: '2026-11-01', messages }]), 0);
  assert.strictEqual(asked, 1);
  assert.strictEqual(memory.counts().episode, 1);
});

test('a chat word that barely touches what you asked does not come back', async () => {
  const { memory } = engine();
  memory.put('chat', 'makan siang tadi enak banget di warung', { meta: { day: 'x' } });
  const found = await memory.forChat('makan malam besok ulang tahun ibu di restoran');
  assert.deepStrictEqual(found.past, []);
});

test('pieces of a file: not too long, overlapping, all of it', () => {
  const text = Array.from({ length: 60 }, (_, i) => `Kalimat nomor ${i} dari dokumen ini cukup panjang.`).join(' ');
  const parts = chunks(text);
  assert.ok(parts.length > 2);
  assert.ok(parts.every((p) => p.length <= 900));
  assert.ok(text.endsWith(parts.at(-1).slice(-30)));
  assert.ok(parts.join(' ').includes('Kalimat nomor 30'));
  assert.deepStrictEqual(chunks('   '), []);
});

test('what you gave her to read: added, found, changed, removed', async () => {
  const e = engine();
  const dir = tempDir();
  const file = path.join(dir, 'catatan.md');
  fs.writeFileSync(file, 'Password wifi kantor ada di meja resepsionis lantai dua.');
  fs.writeFileSync(path.join(dir, 'gambar.png'), 'not text');
  fs.mkdirSync(path.join(dir, 'node_modules'));
  fs.writeFileSync(path.join(dir, 'node_modules', 'x.js'), 'skip me');
  assert.deepStrictEqual(e.knowledge.add(dir), { added: 1, updated: 0, same: 0, skipped: 0, failed: 0 });
  assert.strictEqual(e.knowledge.add(dir).same, 1);
  const found = await e.knowledge.search('wifi kantor ada di mana');
  assert.strictEqual(found[0].title, 'catatan.md');
  assert.deepStrictEqual(await e.knowledge.search('resep rendang padang enak'), []);
  fs.writeFileSync(file, 'Sekarang ruang server pindah ke basement gedung.');
  assert.strictEqual(e.knowledge.refresh().updated, 1);
  assert.strictEqual((await e.knowledge.search('wifi kantor resepsionis')).length, 0, 'the old words are gone');
  assert.ok((await e.knowledge.search('ruang server basement')).length);
  fs.unlinkSync(file);
  assert.strictEqual(e.knowledge.refresh().removed, 1);
  assert.deepStrictEqual(e.knowledge.list(), []);
  assert.strictEqual(e.memory.counts().knowledge, 0);
});

test('her skills: hers load; a broken or greedy one does not; words only', () => {
  const hers = skills.load([{ dir: path.join(__dirname, '..', 'assets', 'skills'), source: 'hers' }]);
  assert.deepStrictEqual(hers.map((s) => s.id).sort(), ['coding', 'math', 'research', 'writing']);
  assert.strictEqual(skills.match(hers, 'tolong perbaiki tulisan ini').id, 'writing');
  assert.strictEqual(skills.match(hers, 'kenapa kode ini error di baris 3').id, 'coding');
  assert.strictEqual(skills.match(hers, 'hitunglah luas segitiga').id, 'math');
  assert.strictEqual(skills.match(hers, 'bandingkan iphone dan samsung').id, 'research');
  assert.strictEqual(skills.match(hers, 'halo capri apa kabar'), null);
  assert.strictEqual(skills.match(hers, 'bandingkan iphone dan samsung', ['research']), null, 'turned off');
  assert.strictEqual(skills.find(hers, 'research').web, true);

  const dir = tempDir();
  const make = (name, manifest, prompt = 'Do it.') => {
    fs.mkdirSync(path.join(dir, name));
    fs.writeFileSync(path.join(dir, name, 'skill.json'), typeof manifest === 'string' ? manifest : JSON.stringify(manifest));
    if (prompt) fs.writeFileSync(path.join(dir, name, 'prompt.md'), prompt);
  };
  make('broken', '{ not json');
  make('noprompt', { id: 'noprompt' }, null);
  make('badid', { id: '../../evil' });
  make('greedy', { id: 'greedy', when: ['(a+)+$', 'halo'] });
  make('mine', { id: 'writing', name: 'My writing', when: ['tulisanku'], maxTokens: 99999 });
  const all = skills.load([{ dir: path.join(__dirname, '..', 'assets', 'skills'), source: 'hers' }, { dir, source: 'yours' }]);
  assert.deepStrictEqual(all.map((s) => s.id).sort(), ['coding', 'greedy', 'math', 'research', 'writing']);
  assert.strictEqual(all.find((s) => s.id === 'greedy').patterns.length, 1, 'the one that could hang her is left out');
  const mine = all.find((s) => s.id === 'writing');
  assert.strictEqual(mine.source, 'yours');
  assert.strictEqual(mine.maxTokens, 4000);
});

test('her browser: web addresses only; what she never presses or fills', () => {
  assert.strictEqual(safeUrl('example.com'), 'https://example.com/');
  assert.strictEqual(safeUrl('file:///c:/windows/win.ini'), null);
  assert.strictEqual(safeUrl('javascript:alert(1)'), null);
  for (const b of ['Delete account', 'Buy now', 'Bayar', 'Log in', 'Masuk']) assert.ok(RISKY.test(b), b);
  assert.ok(!RISKY.test('Halaman dua'));
  for (const f of ['Password', 'Kata sandi', 'cc-number', 'Credit card', 'nomor kartu', 'CVV', 'PIN']) assert.ok(SECRET_FIELD.test(f), f);
  assert.ok(!SECRET_FIELD.test('Nama lengkap'));
});

test('text given in the message is not a look at your screen', () => {
  assert.strictEqual(errands.parse('baca tulisan ini').kind, 'look');
  assert.notStrictEqual(errands.parse('tolong perbaiki tulisan ini: aku pergi kepasar kemarin').kind, 'look');
});

test('a guess of her model\'s: "tulisan" is not "tulis"', () => {
  const line = 'type aku pergi ke pasar';
  assert.strictEqual(errands.routed(line, 'tolong perbaiki tulisan ini'), null);
  assert.ok(errands.routed(line, 'tolong tulis aku pergi ke pasar'));
});

test('her browser, by words', () => {
  assert.deepStrictEqual(errands.parse('browse example.com'), { kind: 'myBrowser', action: 'open', url: 'https://example.com' });
  assert.deepStrictEqual(errands.parse('cari kucing di browsermu'), { kind: 'myBrowser', action: 'search', query: 'kucing' });
  assert.deepStrictEqual(errands.parse('baca halaman di browsermu'), { kind: 'myBrowser', action: 'read' });
  assert.deepStrictEqual(errands.parse('tutup browsermu'), { kind: 'myBrowser', action: 'close' });
  assert.strictEqual(errands.parse('buka youtube').kind, 'app', 'your own browser stays yours');
});

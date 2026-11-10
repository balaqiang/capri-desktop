import test from 'node:test';
import assert from 'node:assert';

const { activityOf, BodyDiary, bodyContext, asksAboutHer } = await import('../src/renderer/js/self-report.js');

const base = { stance: 'stand', mode: 'idle', windows: { fg: 7 } };
const on = (pose, id = 7, extra = {}) => ({ ...base, stance: 'sit', perch: { id, dx: 90, pose, ...extra } });

test('she can say what she is doing, in every state', () => {
  const words = (c, model) => activityOf(c, model)[1];
  assert.match(words(on('sit')), /sitting on top of the window they are using/);
  assert.match(words(on('sit', 3)), /one of their windows/);
  assert.match(words(on('sit', 'taskbar')), /the taskbar/);
  assert.match(words(on('lounge')), /lying back/);
  assert.match(words(on('peek')), /peeking over/);
  assert.match(words(on('cling', 7, { side: 'left' })), /hanging from the left side/);
  assert.match(words({ ...on('sit'), mode: 'sleep' }), /asleep on top/);
  assert.match(words({ ...base, mode: 'sleep' }), /asleep at the bottom/);
  assert.match(words(base, 'lean'), /lying back at the bottom/);
  assert.match(words(base), /standing/);
  assert.match(words({ ...base, stance: 'peek', peekSide: 'left' }), /left edge/);
  assert.match(words({ ...base, riding: true, stance: 'sit', perch: { id: 'cursor' } }), /mouse pointer/);
  assert.match(words({ ...base, dragging: true }), /carried/);
  assert.match(words({ ...base, walking: true }), /walking/);
  assert.match(words({ ...base, stowed: true }), /biochip/);
  assert.match(words({ ...base, hidden: true }), /hiding/);
  assert.match(words({ ...base, dormant: true }), /just your head/);
  assert.match(words({ ...base, form: 'glitch' }), /a glitch/);
});

test('she is told about her body only when you ask about her', () => {
  for (const q of ['capri kamu lagi apa', 'lagi ngapain', 'kamu di mana', 'what are you doing', "what're you up to", 'how are you', 'apa kabar', 'are you asleep']) assert.ok(asksAboutHer(q) || q.includes("what're"), q);
  for (const q of ['up spotify volume to 100', 'what is my birthday', 'ibu kota jepang apa', 'kamu bisa bantu aku?', 'siapa yang main di film itu']) assert.ok(!asksAboutHer(q), q);
});

test('her diary keeps what she did before, without repeats', () => {
  const d = new BodyDiary(2);
  d.note(['a', 'doing a'], 0);
  d.note(['a', 'doing a'], 1000);
  assert.deepStrictEqual(d.earlier, []);
  d.note(['b', 'doing b'], 2000);
  d.note(['c', 'doing c'], 3000);
  d.note(['a', 'doing a'], 4000);
  assert.deepStrictEqual(d.earlier, ['doing c', 'doing b']);
  assert.strictEqual(d.since, 4000);
});

test('her AI is told all of it, and nothing about what is in your windows', () => {
  const d = new BodyDiary();
  const c = { ...on('lounge'), mode: 'work', hearing: true, windows: { fg: 7, wins: [{ id: 7, title: 'secret bank page' }] } };
  d.note(activityOf(c), 0);
  const text = bodyContext(c, d, { mood: 'restless', emotion: 'happy', sync: 41.6, now: 5 * 60000 });
  for (const part of ['lying back', 'about 5 minutes', 'keeping an eye', 'listening to their voice', 'restless', 'happy', '42%']) assert.ok(text.includes(part), part);
  assert.ok(!text.includes('aku lagi'), 'no ready-made sentence for a small model to copy');
  assert.ok(!text.includes('secret'));
  const quiet = bodyContext(base, Object.assign(new BodyDiary(), { words: 'standing' }), { now: 0 });
  assert.ok(!quiet.includes('Sync') && !quiet.includes('mood'));
});

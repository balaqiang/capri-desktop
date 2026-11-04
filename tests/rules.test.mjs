// Her chat's rules (src/renderer/js/rules.js): what she looks up on the web first, the song's words a model
// makes up, the things her model claims to have done.
import test from 'node:test';
import assert from 'node:assert/strict';
import { worldQuestion, webNote, FAKE_DONE, LYRIC_DUMP, aboutLyrics, LYRICS_TAG } from '../src/renderer/js/rules.js';

test('worldQuestion: questions about the world', () => {
  for (const q of ['siapa presiden indonesia', 'who is the ceo of nvidia?', 'Capri, kapan indonesia merdeka?', 'berapa jumlah penduduk jepang',
    'what is the capital of australia', 'harga emas hari ini?', 'how tall is mount everest', 'apa itu blockchain']) {
    assert.equal(worldQuestion(q), true, q);
  }
});

test('worldQuestion: not about the world', () => {
  for (const q of ['siapa kamu?', 'who are you', 'what is your name', 'apa kabar?', "what's up", 'siapa namaku?', 'hi', 'aku capek',
    'what do you think about me', 'kapan kita main lagi?', 'tell me a joke']) {
    assert.equal(worldQuestion(q), false, q);
  }
});

test('webNote: the results first, firmly', () => {
  assert.equal(webNote('q', null), '');
  assert.match(webNote('siapa presiden', { results: [] }), /found nothing useful/);
  const note = webNote('siapa presiden indonesia', { results: [{ title: 'Presiden Indonesia', from: 'wikipedia', text: 'Someone is the president.' }] });
  assert.match(note, /1\. Presiden Indonesia \(wikipedia\): Someone is the president\./);
  assert.match(note, /ONLY from these results/);
  assert.match(note, /OUT OF DATE/);
});

test('FAKE_DONE: her model claiming it did something', () => {
  for (const s of ['Typed it in Notepad. Done.', "I've opened notepad for you", 'sudah kuketik', 'udah kubuka ya', 'I have typed hello']) {
    assert.match(s, FAKE_DONE, s);
  }
  for (const s of ['I can type that for you', 'Want me to open it?', 'ketik apa?']) assert.doesNotMatch(s, FAKE_DONE, s);
});

test('LYRIC_DUMP and aboutLyrics', () => {
  assert.match('(Verse 1)\nla la', LYRIC_DUMP);
  assert.match('[Chorus]\nla la', LYRIC_DUMP);
  assert.doesNotMatch('I like the chorus of that one', LYRIC_DUMP);
  assert.equal(aboutLyrics('what are the lyrics'), true);
  assert.equal(aboutLyrics('liriknya apa'), true);
  assert.equal(aboutLyrics('write me lyrics about cats'), false);
  assert.equal(aboutLyrics('bikin lirik lagu'), false);
  assert.equal(LYRICS_TAG.exec('ok [[lyrics: show]]')[1], 'show');
});

test('calc: her calculator', async () => {
  const { calc, withSums, sumsIn } = await import('../src/renderer/js/rules.js');
  const cases = [['12*(3+4)', 84], ['2^10', 1024], ['-3^2', -9], ['15% * 200', 30], ['10/4', 2.5], ['25 x 4', 100], ['1,000,000 / 4', 250000],
    ['2,5 * 2', 5], ['√16 + sqrt(9)', 7], ['2(3+4)', 14], ['12 : 4', 3], ['7 ÷ 2', 3.5], ['1.250 + 3,5', 1253.5]];
  for (const [e, v] of cases) assert.equal(calc(e), v, e);
  for (const e of ['(1+2', 'hello', '3+', 'alert(1)', '2; 3']) assert.equal(calc(e), null, e);
  assert.equal(calc('1.250 + 2.750', { strict: true }), null); // which way it's written can't be told
  assert.equal(withSums('25 × 4 = [[calc: 25*4]], 0.1 + 0.2 = [[calc: 0.1+0.2]], [[calc: foo]]'), '25 × 4 = 100, 0.1 + 0.2 = 0.3, foo');
  assert.deepEqual(sumsIn('Kerjakan!\n1. 25 x 4 = ...\n2) (12 + 8) / 5 =\nNama: Budi, Kelas 5\n3. 1.250 + 2.750 =').map((s) => [s.expr, s.value]), [['25 x 4', '100'], ['(12 + 8) / 5', '4']]);
});

test('withSums: a result the model wrote again after the tag, once', async () => {
  const { withSums } = await import('../src/renderer/js/rules.js');
  assert.equal(withSums('125 x 8 = [[calc: 125*8]] 1000'), '125 x 8 = 1000');
  assert.equal(withSums('= [[calc: 3*24500]] Rp 73.500'), '= Rp 73.500');
  assert.equal(withSums('= [[calc: 12*7]] 84 cm²'), '= 84 cm²');
  assert.equal(withSums('[[calc: 1+1]]. Done'), '2. Done');
});

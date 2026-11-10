#!/usr/bin/env node
// assets/finetune/curated.jsonl, from scripts/finetune-data.js: what her local model learns besides your chats. Run it after changing that file.
// One row: { cat, turns: [{ role, content }], context? }. context is what the app puts right before your message, so that she learns to use it.

import fs from 'node:fs';
import { createRequire } from 'node:module';
import { activityOf, BodyDiary, bodyContext } from '../src/renderer/js/self-report.js';
import { ownerFacts } from '../src/renderer/js/owner-facts.js';

const require = createRequire(import.meta.url);
const { LORE, MEDIA, LIFE, CONVERSATIONS } = require('./finetune-data.js');

const rows = [];
const add = (cat, turns, context) => rows.push({ cat, turns: turns.flatMap(([u, a]) => [{ role: 'user', content: u }, { role: 'assistant', content: a }]), ...(context && { context }) });

const ASK = {
  person: { id: ['{k} itu siapa?', 'kamu kenal {k}?'], en: ['who is {k}?', 'do you know {k}?'] },
  place: { id: ['{k} itu apa?', 'ceritain {k} dong'], en: ['what is {k}?', 'tell me about {k}'] },
  org: { id: ['{k} itu apa?', 'ceritain soal {k} dong'], en: ['what is {k}?', 'tell me about {k}'] },
  term: { id: ['{k} itu apa?', 'maksudnya {k} apa?'], en: ['what is {k}?', 'what does {k} mean?'] },
};
const KIND = { film: 'film', series: 'serial', anime: 'anime', book: 'novel', game: 'game' };
const fill = (q, k) => q.replace('{k}', k);

for (const x of LORE) {
  const e = x.e || 'happy';
  for (const q of ASK[x.t].id) add('lore', [[fill(q, x.k), `[${e}] ${x.id}`]]);
  for (const q of ASK[x.t].en) add('lore', [[fill(q, x.k), `[${e}] ${x.en}`]]);
  if (x.mid) add('opinion', [[`menurutmu ${x.k} gimana?`, `[${e}] ${x.mid}`]]);
  if (x.men) add('opinion', [[`what do you think of ${x.k}?`, `[${e}] ${x.men}`]]);
}

for (const x of MEDIA) {
  const e = x.e || 'happy';
  const kind = KIND[x.kind];
  add('media', [[`${kind} ${x.k} tentang apa?`, `[${e}] ${x.id}`]]);
  add('media', [[`ceritain ${x.k} dong`, `[${e}] ${x.id}`]]);
  add('media', [[`what is ${x.k} about?`, `[${e}] ${x.en}`]]);
  add('media', [[`siapa yang bikin ${x.k}?`, `[happy] ${x.k} itu karya ${x.by}, keluar tahun ${x.y}.`]]);
  add('media', [[`who made ${x.k}?`, `[happy] ${x.k} is by ${x.by}, from ${x.y}.`]]);
  add('media', [[`${x.k} keluar tahun berapa?`, `[happy] Tahun ${x.y}.`]]);
  if (x.mid) add('opinion', [[`menurutmu ${x.k} bagus nggak?`, `[${e}] ${x.mid}`]]);
  if (x.men) add('opinion', [[`what did you think of ${x.k}?`, `[${e}] ${x.men}`]]);
}

for (const [cat, list] of Object.entries(LIFE)) for (const [u, a] of list) add(cat, [[u, a]]);
for (const turns of CONVERSATIONS) add('conversation', turns);

// ---- her body: answering from what the app tells her she's doing ----
const base = { stance: 'stand', mode: 'idle', windows: { fg: 7 } };
const on = (pose, id = 7, extra = {}) => ({ ...base, stance: 'sit', perch: { id, dx: 90, pose, ...extra } });
const BODY = [
  [on('sit'), 'Aku lagi duduk di atas window yang kamu pakai, ngawasin kamu.', "I'm sitting on top of the window you're using, keeping an eye on you."],
  [on('sit', 3), 'Lagi nongkrong di atas salah satu window-mu, kakiku menjuntai.', "Hanging out on top of one of your windows, legs dangling."],
  [on('sit', 'taskbar'), 'Lagi duduk manis di taskbar, nungguin kamu.', "Sitting on your taskbar, waiting for you."],
  [on('lounge'), 'Lagi rebahan di atas window-mu sambil ngawasin kamu.', "Lying back on top of your window, watching you."],
  [on('peek'), 'Lagi ngintip dari balik window-mu. Ketahuan deh.', "Peeking over the top of your window. Busted."],
  [on('cling', 7, { side: 'left' }), 'Lagi gelantungan di sisi kiri window-mu.', "Hanging off the left side of your window."],
  [on('cling', 7, { side: 'right' }), 'Lagi gelantungan di sisi kanan window-mu.', "Hanging off the right side of your window."],
  [{ ...on('sit'), mode: 'sleep' }, 'Lagi tidur di atas window-mu... kamu ngeganggu, tahu.', "I was asleep on your window... you woke me."],
  [{ ...base, mode: 'sleep' }, 'Lagi tidur di bawah layar. Kenapa dibangunin?', "Sleeping at the bottom of your screen. Why am I awake?"],
  [base, 'Lagi berdiri di bawah layarmu, ngeliatin kamu.', "Standing at the bottom of your screen, watching you."],
  [{ ...base, walking: true }, 'Lagi jalan-jalan di bawah layarmu.', "Taking a walk along the bottom of your screen."],
  [{ ...base, stance: 'peek', peekSide: 'left' }, 'Lagi ngintip dari pinggir kiri layar.', "Peeking in from the left edge of your screen."],
  [{ ...base, riding: true }, 'Lagi numpang di kursormu. Gas.', "Riding on your cursor. Go faster."],
  [{ ...base, dragging: true }, 'Lagi kamu bawa-bawa pakai kursor, turunin dong.', "Being carried around by your cursor. Put me down."],
  [{ ...base, dormant: true }, 'Lagi setengah tidur, cuma kepalaku yang nongol.', "Half asleep. Only my head is showing."],
  [{ ...on('sit'), mode: 'work' }, 'Lagi duduk di atas window-mu sambil ngawasin kerjaan yang lagi jalan.', "Sitting on your window, keeping an eye on the job that's running."],
];
const ASK_BODY = { id: ['kamu lagi apa', 'lagi ngapain', 'capri kamu lagi apa', 'kamu di mana sekarang'], en: ['what are you doing', 'where are you right now'] };
const FEEL = ['happy', 'bored', 'happy', 'glitch'];
BODY.forEach(([c, idWords, enWords], i) => {
  const diary = new BodyDiary();
  diary.note(activityOf(c), 0);
  const context = bodyContext(c, diary, { mood: ['restless', 'cheerful', 'bored'][i % 3], sync: 20 + i * 4, now: 60000 });
  ASK_BODY.id.forEach((q, j) => add('body', [[q, `[${FEEL[(i + j) % 4]}] ${idWords}`]], context));
  ASK_BODY.en.forEach((q, j) => add('body', [[q, `[${FEEL[(i + j) % 4]}] ${enWords}`]], context));
});

// ---- you: answering from your profile, and admitting what isn't in it ----
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const PEOPLE = [
  ['Raka', 'bos', '2001-03-14', 'bakso, Valorant', 'hujan'],
  ['Dinda', 'choom', '1999-11-02', 'kopi, synthwave', 'macet'],
  ['Mira', 'bestie', '2003-07-21', 'kucing, anime', 'kecoa'],
  ['Bagas', 'gonk', '1998-01-30', 'motor, ramen', 'Senin'],
  ['Sari', 'sayang', '2000-05-09', 'menggambar', 'spoiler'],
  ['Alex', 'partner', '1995-12-25', 'chess, sushi', 'small talk'],
  ['Yuki', 'kouhai', '2002-09-17', 'manga, matcha', 'panas'],
  ['Nadia', 'bos kecil', '1997-06-05', 'lari pagi', 'bangun siang'],
];
const dateOf = (iso, names) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${names[m - 1]} ${y}`;
};
for (const [name, nickname, birthday, likes, dislikes] of PEOPLE) {
  const context = ownerFacts({ name, owner: { nickname, birthday, likes, dislikes } });
  add('owner', [['nama aku siapa?', `[happy] ${name}, ${nickname}. Masa lupa nama sendiri?`]], context);
  add('owner', [['what is my name?', `[happy] ${name}. Did you forget?`]], context);
  add('owner', [['ulang tahunku kapan?', `[happy] ${dateOf(birthday, BULAN)}. Aku ingat dong.`]], context);
  add('owner', [['what is my birthday', `[happy] ${dateOf(birthday, MONTH)}. I keep track.`]], context);
  add('owner', [['aku suka apa?', `[happy] ${likes}. Kamu gampang ditebak, ${nickname}.`]], context);
  add('owner', [['aku nggak suka apa?', `[bored] ${dislikes}. Kamu sering ngeluh soal itu.`]], context);
  add('owner', [['aku punya adik nggak?', `[bored] Kamu belum pernah cerita, ${nickname}. Aku nggak mau asal tebak.`]], context);
  add('owner', [['where do i work', "[bored] You haven't told me, and I'm not going to make something up."]], context);
  // an old chat called them something else: the profile wins
  add('owner', [['hei', '[bored] Hm? Apa, Kevin?'], ['siapa namaku?', `[annoyed] ${name}. Yang tadi salah sebut, maaf, kebanyakan pikiran di sini.`]], context);
}

fs.writeFileSync(new URL('../assets/finetune/curated.jsonl', import.meta.url), `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`);
const counts = {};
for (const r of rows) counts[r.cat] = (counts[r.cat] || 0) + 1;
console.log(`${rows.length} rows`, JSON.stringify(counts));

'use strict';
// What she makes of what you say (src/main/errands.js): every phrase here was one someone said to her,
// typed or through the mic. A phrase that stops matching is a command she stopped hearing.
require('./electron-stub');
const test = require('node:test');
const assert = require('node:assert/strict');
const errands = require('../src/main/commands/errands');

// a parsed errand in a few characters: kind, text, target, action, key, move
const show = (x) => `${x.kind}${x.text ? `:"${x.text}"` : ''}${x.target ? `@${x.target}` : ''}${x.action ? `:${x.action}` : ''}${x.key ? `:${x.key}` : ''}${x.move ? `:${x.move}` : ''}`;
const heard = (said) => {
  const steps = errands.chain(said);
  return steps ? steps.map((s) => show(s.e)).join(' → ') : show(errands.parse(said));
};

const EVERYDAY = [
  // moving her
  ['move to the left', 'move'], ['ke kanan', 'move'], ['come to my cursor', 'move'], ['capri where are you', 'move'], ['kamu di mana', 'move'],
  ['sit on my cursor', 'move'], ['get off my cursor', 'move'], ['go to sleep', 'move'], ['dance', 'move'], ['joget dong', 'move'],
  // music
  ['play Die For You', 'song'], ['putar lagu Sorai', 'song'], ['play your favorite song', 'song'], ['search Blinding Lights on spotify', 'spotifySearch'],
  ['pause the music', 'media'], ['next song', 'media'], ['lagu berikutnya', 'media'], ['louder', 'media'], ['what song is this', 'nowPlaying'],
  ['lagu apa yang aku dengerin?', 'nowPlaying'], ['do you like this song', 'songOpinion'], ['kamu suka lagu ini?', 'songOpinion'],
  ['show the music lyrics', 'lyrics'], ['buka lirik', 'lyrics'], ['stop showing lyrics', 'lyrics'], ['liriknya apa?', 'lyrics'], ['dengarkan lagu ini', 'listen'],
  // opening things
  ['open spotify', 'app'], ['buka kalkulator', 'open'], ['open my download file', 'open'], ['buka folder downloadku', 'open'], ['open youtube in chrome', 'browser'],
  ['buka youtube music', 'app'], ['where is my Downloads folder?', 'find'], ['search cyberpunk edgerunners', 'web'],
  // asking
  ['what time is it?', 'time'], ['jam berapa', 'time'], ['hari apa sekarang?', 'time'], ['berapa 25 x 4', 'math'], ['what is 12*7', 'math'],
  // timers, and the rest
  ['set a timer for 10 minutes', 'timer'], ['pasang timer 5 menit', 'timer'], ['pasang alarm jam 7', 'clock'], ['wake me at 7am', 'clock'], ['hapus semua alarm', 'clearAlarms'],
  ['remember that my birthday is in May', 'remember'], ['look at my screen', 'look'], ['lihat layarku', 'look'], ['dare me', 'dare'],
  ['buatkan kode python untuk menghitung BMI', 'code'], ['bikin game snake pakai html', 'code'],
  // plain chat: none of these is a command
  ['aku suka lagu ini', 'none'], ['do you like music?', 'none'], ['do you like me', 'none'], ['play with me', 'none'], ['tell me a joke', 'none'],
  ['what is the meaning of life', 'none'], ["you're cute", 'none'], ['halo capri, lagi ngapain?', 'none'], ['who are you?', 'none'],
  ['I love you', 'none'], ['write me lyrics about cats', 'none'], ['what do these lyrics mean?', 'none'], ['ceritain tentang cyberpunk', 'none'],
  ['siapa lucy?', 'none'], ['aku capek banget hari ini', 'none'], ['what do you think about david martinez', 'none'], ['are you jealous of chatgpt?', 'none'],
  ['open your heart to me', 'app'], ['I am going to sleep', 'none'], ['remember me?', 'none'], ['can you hear me?', 'none'], ['stop', 'none'],
];

test('everyday phrases', () => {
  const missed = EVERYDAY.filter(([said, want]) => errands.parse(said).kind !== want)
    .map(([said, want]) => `${said} → ${errands.parse(said).kind} (wanted ${want})`);
  assert.deepEqual(missed, []);
});

const LYRICS = {
  show: ['show lyrics', 'show the song lyrics', 'show me the lyrics of this song', "show this song's lyrics", 'perlihatkan lyrics lagu ini', 'perlihatkan lirik lagu ini', 'tampilkan lirik lagu ini', 'tampilin liriknya', 'liatin lirik lagunya', 'kasih lihat lirik lagu ini', 'lyrics please', 'lirik dong', 'Capri, tunjukin lirik lagu yang lagi diputar'],
  hide: ['stop showing lyrics', 'stop showing the lyrics', 'hide the lyrics', 'stop lyrics', 'no more lyrics', 'berhenti tampilkan lirik', 'berhenti menampilkan lirik lagu ini', 'jangan tampilkan lirik', 'matikan lirik', 'stop lirik', 'udahan liriknya', 'liriknya udah', 'tutup liriknya'],
  now: ['liriknya apa?', 'what are they singing', "what's the lyric"],
  listen: ['dengarkan lagu ini', 'dengerin lagu ini', 'listen to this song', 'listen to this', 'ayo dengerin lagu ini bareng', 'yuk dengerin bareng', 'listen with me', "let's listen to this song", 'coba dengar lagu ini deh'],
};

test('lyrics and listening', () => {
  const missed = [];
  for (const [want, list] of Object.entries(LYRICS)) {
    for (const said of list) {
      const r = errands.parse(said);
      const got = r.kind === 'lyrics' ? r.action : r.kind;
      if (got !== want) missed.push(`${said} → ${got} (wanted ${want})`);
    }
  }
  assert.deepEqual(missed, []);
});

const CHAINS = [
  ['open notepad and type hello tiktok', 'open:"notepad"@notepad.exe → type:"hello tiktok"'],
  ['open spotify and play music', 'app:"spotify" → media:play'],
  ['buka notepad lalu ketik halo semua', 'open:"notepad"@notepad.exe → type:"halo semua"'],
  ['buka spotify terus putar musik', 'app:"spotify" → media:play'],
  ['open vscode and type print("hi")', 'app:"vscode" → type:"print("hi")"'],
  ['open notepad, type hello, world and save it', 'open:"notepad"@notepad.exe → type:"hello, world" → key:save'],
  ['type hello and press enter', 'type:"hello" → key:enter'],
  ['ketik halo dunia lalu kirim', 'type:"halo dunia" → key:enter'],
  ['type hello in notepad', 'type:"hello"@notepad'],
  ['ketik selamat pagi di antigravity', 'type:"selamat pagi"@antigravity'],
  ['tulis halo ke chat', 'type:"halo"'],
  ['write hello world in vscode', 'type:"hello world"@vscode'],
  ['type I love cats and dogs', 'type:"I love cats and dogs"'],
  ['ke kiri lalu joget', 'move:left → move:dance'],
  ['pause the music and open notepad', 'media:pause → open:"notepad"@notepad.exe'],
  ['open chrome and search cyberpunk edgerunners', 'app:"chrome" → web:"cyberpunk edgerunners (google)"'],
  ['open spotify and play Die For You', 'app:"spotify" → song:"Die For You"'],
  // one thing each, though they have an "and" in them
  ['play simon and garfunkel', 'song:"simon and garfunkel"'],
  ['search cats and dogs', 'web:"cats and dogs (google)"'],
  ['aku capek dan lapar', 'none'],
  ['write a script that sorts my files', 'code'],
  ['type of music you like?', 'none'],
  ['putar musik', 'media:play'], ['play music', 'media:play'], ['press enter', 'key:enter'], ['save it', 'key:save'],
];

test('several commands in one sentence', () => {
  for (const [said, want] of CHAINS) assert.equal(heard(said), want, said);
});

// what the speech recognizer hands her: her name in front, a "?" or a "." in the middle
const VOICE = [
  ['Hello Capri. Can you open notepad and type you can get it?', 'open:"notepad"@notepad.exe → type:"you can get it"'],
  ['Hello, Capri. Open Notepad and type. You can get it.', 'open:"notepad"@notepad.exe → type:"You can get it"'],
  ['Hi Capri, can you open note pad and type hello everyone?', 'open:"note pad"@notepad.exe → type:"hello everyone"'],
  ['Capri can you open notepad? And type you can get it.', 'open:"notepad"@notepad.exe → type:"you can get it"'],
  ['Hey Capri! Please open Notepad, and then type: good morning.', 'open:"notepad"@notepad.exe → type:"good morning"'],
  ['Halo Capri, tolong buka notepad lalu ketik selamat pagi.', 'open:"notepad"@notepad.exe → type:"selamat pagi"'],
  ['Um, Capri, open notepad and type hello.', 'open:"notepad"@notepad.exe → type:"hello"'],
  ['Hello Capri, pause the music.', 'media:pause'],
  ['Hello Capri. What time is it?', 'time'],
  ['Hello Capri, how are you today?', 'none'],
  ['Okay Capri, open spotify and play music.', 'app:"spotify" → media:play'],
  ['Hello Capri. Type hello world in notepad.', 'type:"hello world"@notepad'],
];

test('voice transcripts', () => {
  for (const [said, want] of VOICE) assert.equal(heard(said), want, said);
});

test('song controls', () => {
  for (const said of ['next song', 'previous song', 'repeat this song', 'shuffle on', 'lagu sebelumnya', 'ulangi lagu ini']) {
    assert.equal(errands.parse(said).kind, 'media', said);
  }
});

// her model's reading of what her rules missed (life.js route): only for what sounds like a command, and only
// ever something you said
test('intent router: what is asked', () => {
  for (const said of ['could you crank it up a bit', 'gimme some tunes', 'bring up my downloads', 'kecilin suaranya dikit', 'can you go stand on the left']) {
    assert.equal(errands.routable(said), true, said);
  }
  for (const said of ['I love this song so much', 'tell me about spotify history', 'kamu suka musik apa?', 'what is open source?', 'aku capek', 'who sang this']) {
    assert.equal(errands.routable(said), false, said);
  }
});

test('intent router: what is taken from its answer', () => {
  const kind = (line, said) => {
    const g = errands.routed(line, said);
    return g ? (g.steps ? g.steps.map((s) => s.e.kind).join('+') : g.e.kind) : null;
  };
  assert.equal(kind('louder', 'could you crank it up a bit'), 'media');
  assert.equal(kind('open downloads', 'bring up my downloads'), 'open');
  assert.equal(kind('type halo dunia in notepad', 'tolong tuliskan halo dunia di notepad'), 'type');
  assert.equal(kind('NONE', 'whatever'), null);
  assert.equal(kind('close spotify', 'get rid of spotify'), null); // never from a guess
  assert.equal(kind('open puterin yang santai dong', 'puterin yang santai dong'), null); // you didn't say open
  assert.equal(kind('search spotify history', 'spotify history is wild'), null); // nor search
  assert.equal(kind('open <app> | play music', 'gimme music'), null); // the list copied back
  assert.equal(kind('louder and repeat this song', 'puterin yang santai dong'), null); // two for one
  assert.equal(kind('open youtube and search lofi', 'open up youtube and search lofi'), 'app+web');
  assert.equal(errands.routed('play blinding lights by Someone', 'I wanna hear blinding lights').e.text, 'blinding lights');
});

// something to write for you (a draft she shows first), not words to type as they are
test('drafts', () => {
  const d = (said) => {
    const r = errands.parse(said);
    return r.kind === 'draft' ? `draft:"${r.task}"${r.target ? `@${r.target}` : ''}` : r.kind;
  };
  assert.equal(d('write an email to my boss saying I am sick'), 'draft:"write an email to my boss saying I am sick"');
  assert.equal(d('tuliskan surat lamaran kerja di notepad'), 'draft:"tuliskan surat lamaran kerja"@notepad');
  assert.equal(d('Capri, can you write a short poem about rain in notepad?'), 'draft:"write a short poem about rain"@notepad');
  assert.equal(d('buatkan pesan ulang tahun untuk ibuku di whatsapp'), 'draft:"buatkan pesan ulang tahun untuk ibuku"@whatsapp');
  assert.equal(d('draft a tweet about cats'), 'draft:"draft a tweet about cats"');
  // still typed as they are, a chat, or code
  assert.equal(d('write hello world in vscode'), 'type');
  assert.equal(d('tulis halo ke chat'), 'type');
  assert.equal(d('write me lyrics about cats'), 'none');
  assert.equal(d('write a script that sorts my files'), 'code');
  assert.equal(heard('open notepad and write a poem about rain'), 'open:"notepad"@notepad.exe → draft');
});

// commands of your own, taught in words (life.js skills)
test('teaching her a command', () => {
  assert.deepEqual(errands.parse('when I say work mode, open vscode and play music'), { kind: 'teach', name: 'work mode', run: 'open vscode and play music' });
  assert.deepEqual(errands.parse('kalau aku bilang mode santai, putar musik lalu ke kiri'), { kind: 'teach', name: 'mode santai', run: 'putar musik lalu ke kiri' });
  assert.deepEqual(errands.parse('Capri, whenever I say "good night" you should pause the music and go to sleep'), { kind: 'teach', name: 'good night', run: 'pause the music and go to sleep' });
  assert.equal(errands.parse('when I said that I was sad').kind, 'none');
  assert.equal(errands.skillName('Capri, Work Mode!'), 'work mode');
  assert.equal(errands.skillName('mode santai dong'), 'mode santai');
  assert.equal(errands.UNTEACH_ASK.exec('lupakan perintah mode santai')[1], 'mode santai');
});

// code written into the editor in front ("here"), and homework on the screen
test('code here', () => {
  const c = (said) => {
    const r = errands.parse(said);
    return r.kind === 'code' && r.here ? `here:"${r.task}"${r.target ? `@${r.target}` : ''}` : r.kind;
  };
  assert.equal(c('Can you write @stml right here a basic website to me?'), 'here:"write HTML a basic website"');
  assert.equal(c('write simple html here'), 'here:"write simple HTML"');
  assert.equal(c('type simple html here'), 'here:"type simple HTML"');
  assert.equal(c('buatkan kode python untuk menghitung BMI di sini'), 'here:"buatkan kode python untuk menghitung BMI"');
  assert.equal(c('add a login form in vscode'), 'here:"add a login form in vscode"@vscode');
  // still typed as said, or her own file / Claude Code
  assert.equal(c('type html here'), 'type');
  assert.equal(c('write hello world in vscode'), 'type');
  assert.equal(c('ketik "print hello" di sini'), 'type');
  assert.equal(c('buatkan kode python untuk menghitung BMI'), 'code');
  assert.equal(errands.parse('type hello world here.').text, 'hello world');
  // the router's guess read the same way
  assert.equal(errands.routed('type @stml a basic website here', 'Can you write @stml right here a basic website to me?').e.here, true);
});

test('homework on the screen', () => {
  for (const said of ['saya punya pekerjaan rumah, tolong jawabkan saya pertanyaan yang ada di layar saya', 'solve the math problems on my screen',
    'kerjakan soal ini', 'help me with this homework', 'tolong kerjakan PR saya', 'jawab pertanyaan ini dong']) {
    assert.deepEqual([errands.parse(said).kind, errands.parse(said).task], ['look', 'homework'], said);
  }
  for (const said of ['answer this question: what is the capital of France', 'solve 2x + 3 = 7', 'aku benci matematika', 'do you like math?']) {
    assert.notEqual(errands.parse(said).task, 'homework', said);
  }
});

// game mode, focus mode, quiet mode: down to her mask until you call her; and back to normal
test('her modes: game, focus, quiet, normal', () => {
  const mode = (said) => { const r = errands.parse(said); return r.kind === 'hold' ? r.mode : r.kind; };
  for (const said of ['game mode', 'Capri, game mode on', 'turn on gaming mode', 'mode game', 'aku mau main game dulu']) assert.equal(mode(said), 'game', said);
  for (const said of ['focus mode', 'mode fokus', 'mode belajar', 'I need to focus', 'aku mau fokus dulu']) assert.equal(mode(said), 'focus', said);
  for (const said of ['do not disturb', 'jangan ganggu aku dulu', 'quiet mode', 'diam dulu ya']) assert.equal(mode(said), 'quiet', said);
  for (const said of ['normal mode', 'game mode off', 'turn off focus mode', 'udah selesai main', 'mode normal', 'matikan mode game']) assert.equal(mode(said), 'off', said);
  // not her modes
  assert.equal(mode('mulai belajar'), 'study');
  assert.equal(mode('diam'), 'move');
  assert.equal(mode('wake up'), 'move');
  assert.equal(mode('main suit'), 'none');
});

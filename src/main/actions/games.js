'use strict';

// Little games with her, typed or spoken, no model needed: rock paper scissors ("main suit"), guess the
// number ("tebak angka"), a coin and dice. She's a sore loser and, with mischief up, she cheats now and
// then (and doesn't hide it well). handle(text, cfg) -> { reply, emotion, sync } or null (not a game).
// Her lines are English keys, translated through assets/lang like the rest.

const lang = require('../core/lang');

const { T, F } = lang;
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const IDLE_MS = 3 * 60 * 1000; // a game nobody plays any more is over

const START_RPS = /^(?:(?:let'?s |wanna |want to |ayo |yuk |mau )?(?:play |main )?)(?:rock[ ,-]*paper[ ,-]*scissors?|rps|janken|suit|suwit|batu[ ,-]*gunting[ ,-]*kertas)\b/i;
const START_GUESS = /^(?:(?:let'?s |wanna |want to |ayo |yuk |mau )?(?:play |main )?)(?:guess (?:the |a |my )?number|number game|tebak[- ]?(?:tebakan )?angka)\b/i;
const COIN = /\b(?:flip|toss) a coin\b|^(?:coin ?flip|heads or tails)\b|^(?:lempar|lempar(?:in|kan)|putar) koin\b|^(?:angka atau gambar|gambar atau angka)\b/i;
const DICE = /\broll (?:a |the |some )?(?:dice|die)\b|^roll (\d{0,2})d(\d{1,3})\b|^(?:lempar|kocok|lempar(?:in|kan)) dadu\b/i;
const STOP = /^(?:stop|quit|enough|i give up|give up|udah(?:an)?|berhenti|stop main|nyerah|aku nyerah|selesai main|ga(?:k)? mau main lagi)\b/i;

const MOVES = [
  ['rock', /^(?:rock|batu|✊|👊)\b/i],
  ['paper', /^(?:paper|kertas|✋|🖐)\b/i],
  ['scissors', /^(?:scissors?|gunting|✌|✂)\b/i],
];
const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
const LOSES_TO = { rock: 'paper', paper: 'scissors', scissors: 'rock' };

let game = null; // { kind: 'rps' | 'guess', at, ... }

const plain = (text) => String(text || '').trim()
  .replace(/^(?:(?:hey|hi|ok|okay|yo|halo|hai|eh)[ ,]+)?(?:capri|cappy|kapri|coppery)[,!. ]+/i, '')
  .replace(/[.!?\s]+$/, '');

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const moveName = (m) => T({ rock: 'rock', paper: 'paper', scissors: 'scissors' }[m]);
const score = () => F('You {0} : {1} me.', game.you, game.her);

function startRps() {
  game = { kind: 'rps', at: Date.now(), you: 0, her: 0, rounds: 0 };
  return { reply: T(pick(['Rock, paper, scissors! Pick one. I won\'t peek. Probably.', 'Suit! Say rock, paper or scissors. Go!', 'Oh, you want to lose? Fine. Rock, paper or scissors?'])), emotion: 'happy' };
}

function startGuess() {
  game = { kind: 'guess', at: Date.now(), number: 1 + Math.floor(Math.random() * 100), tries: 0 };
  return { reply: T(pick(["I'm thinking of a number from 1 to 100. Guess!", 'Got a number, 1 to 100. Ten tries. Go on.'])), emotion: 'happy' };
}

function rpsRound(move, cfg) {
  game.at = Date.now();
  game.rounds++;
  let mine = pick(['rock', 'paper', 'scissors']);
  let cheated = false;
  // she'd lose: with her mischief up (and cheating allowed), she "changes her mind"
  const cheat = cfg.gameCheat !== false ? (Number(cfg.traits?.mischief ?? 60) / 100) * 0.4 : 0;
  if (BEATS[move] === mine && Math.random() < cheat) {
    mine = LOSES_TO[move];
    cheated = true;
  }
  let reply;
  let emotion;
  let sync = 0;
  if (mine === move) {
    reply = F('{0}! Same. Again!', moveName(mine));
    emotion = 'bored';
  } else if (BEATS[mine] === move) {
    game.her++;
    reply = cheated
      ? F('{0}— wait. Bzzt. {1}! I win. You saw nothing.', moveName(BEATS[move]), moveName(mine))
      : F('{0}! I win. Obviously.', moveName(mine));
    emotion = cheated ? 'glitch' : 'happy';
  } else {
    game.you++;
    reply = F('{0}… you win. Ugh. Again, now.', moveName(mine));
    emotion = 'annoyed';
    sync = 1;
  }
  return { reply: `${cap(reply)} ${score()}`, emotion, sync, stats: { rps: mine === move ? 'tie' : BEATS[mine] === move ? 'her' : 'you' } };
}

function guessRound(n) {
  game.at = Date.now();
  game.tries++;
  const { number, tries } = game;
  if (n === number) {
    game = null;
    return { reply: tries <= 5 ? F('{0}! In {1} tries? …Lucky. Totally luck.', number, tries) : F('{0}! Took you {1} tries, but fine. You win.', number, tries), emotion: tries <= 5 ? 'annoyed' : 'happy', sync: 3, stats: { guess: tries } };
  }
  if (tries >= 10) {
    game = null;
    return { reply: F('Out of tries! It was {0}. I win.', number), emotion: 'happy', stats: { guess: 0 } };
  }
  const near = Math.abs(n - number) <= 5;
  return { reply: F(n < number ? (near ? 'Higher… so close. ({0} left)' : 'Higher! ({0} left)') : (near ? 'Lower… so close. ({0} left)' : 'Lower! ({0} left)'), 10 - tries), emotion: near ? 'happy' : 'bored' };
}

function handle(said, cfg = {}) {
  const text = plain(said);
  if (!text) return null;
  if (game && Date.now() - game.at > IDLE_MS) game = null;

  if (START_RPS.test(text)) return startRps();
  if (START_GUESS.test(text)) return startGuess();
  if (COIN.test(text)) {
    const heads = Math.random() < 0.5;
    return { reply: heads ? T('Heads! (Angka.)') : T('Tails! (Gambar.)'), emotion: 'happy' };
  }
  const d = DICE.exec(text);
  if (d) {
    const count = Math.min(10, Math.max(1, Number(d[1]) || 1));
    const sides = Math.min(100, Math.max(2, Number(d[2]) || 6));
    const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides));
    const total = rolls.reduce((a, b) => a + b, 0);
    return { reply: count > 1 ? F('Rolled {0}: {1}.', rolls.join(' + '), total) : F('Rolled a {0}.', total), emotion: total === sides * count ? 'happy' : 'bored' };
  }

  if (!game) return null;
  if (STOP.test(text)) {
    const was = game;
    game = null;
    if (was.kind === 'guess') return { reply: F('Quitter! It was {0}.', was.number), emotion: 'annoyed' };
    return { reply: `${T(was.her >= was.you ? 'Game over. I win, as usual.' : 'Fine, you win this time. Don\'t get used to it.')} ${F('You {0} : {1} me.', was.you, was.her)}`, emotion: was.her >= was.you ? 'happy' : 'annoyed' };
  }
  if (game.kind === 'rps') {
    const move = MOVES.find(([, re]) => re.test(text))?.[0];
    return move ? rpsRound(move, cfg) : null;
  }
  if (game.kind === 'guess') {
    const n = /^(?:is it |apa |mungkin |coba )?(\d{1,3})\b/i.exec(text);
    return n ? guessRound(Number(n[1])) : null;
  }
  return null;
}

const playing = () => Boolean(game && Date.now() - game.at <= IDLE_MS);

module.exports = { handle, playing };

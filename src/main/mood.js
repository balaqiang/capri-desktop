'use strict';

// Her mood: not the emotion of one answer ([happy], [annoyed]…) but how she is today. Two numbers, how good she feels
// (v, -1 .. 1) and how much energy she has (e, 0 .. 1). They drift back towards where she'd be at this hour on this
// day: her body clock (a Night City ghost, wide awake late, useless at dawn) and the day's temper (some days are just
// better than others, the same all day). What happens moves them: being petted, being left alone for hours, a song she
// loves, a job gone wrong. Kept on this PC, so a restart doesn't reset her; the time she was off counts as drift.

const HALF_LIFE = 50 * 60000; // what happened fades by half in this long
const SAVE_EVERY = 2 * 60000;

// [how good she feels, how much energy] each thing is worth
const NUDGES = {
  pat: [0.09, 0.03],
  chat: [0.02, 0.03],
  agree: [0.03, 0.01],
  dare: [0.12, 0.08],
  songLove: [0.12, 0.12],
  songLike: [0.03, 0.03],
  songMeh: [-0.05, -0.08],
  done: [0.03, 0.01],
  failed: [-0.06, -0.01],
  back: [0.06, 0.08],
  neglected: [-0.14, -0.04],
  rival: [-0.1, 0.06],
};

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// How awake she is at this hour (0 .. 24), 0.2 .. 0.85: at her best around nine at night, at her worst around nine in the morning.
function rhythm(hour) {
  return clamp(0.52 + 0.33 * Math.cos(((hour - 21) / 24) * 2 * Math.PI), 0.2, 0.85);
}

// How the day went for her before it started, -0.2 .. 0.3: the same all day, different tomorrow.
function temper(date) {
  const day = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  let h = 2166136261;
  for (const ch of day) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return -0.2 + ((h % 1000) / 999) * 0.5;
}

function baseline(ms) {
  const d = new Date(ms);
  return { v: temper(d), e: rhythm(d.getHours() + d.getMinutes() / 60) };
}

// Where she'd be after `ms` left to herself.
function drift(state, ms, now) {
  const base = baseline(now);
  const keep = 0.5 ** (Math.max(0, ms) / HALF_LIFE);
  return { v: base.v + (state.v - base.v) * keep, e: base.e + (state.e - base.e) * keep };
}

// What it all comes to, in a word.
function labelOf(v, e) {
  if (e < 0.3) return v >= -0.1 ? 'drowsy' : 'drained';
  if (v >= 0.3) return e >= 0.55 ? 'playful' : 'content';
  if (v <= -0.2) return e >= 0.5 ? 'irritable' : 'gloomy';
  return e >= 0.62 ? 'restless' : 'calm';
}

const LINES = {
  drowsy: 'You are sleepy and slow: short answers, a yawn in your words now and then, still fond of them.',
  drained: 'You are worn out and a little low: few words, flat, no energy for teasing.',
  playful: 'You are in a great mood and full of energy: teasing, quick, up for anything.',
  content: 'You are in a good, easy mood: warm, unhurried, teasing gently.',
  irritable: 'You are on edge today: sharper and shorter than usual, easily annoyed, but you still do what they ask.',
  gloomy: 'You are feeling down and quiet today: a bit distant, dry, not much of a joker.',
  restless: 'You are restless and bored of sitting still: you change the subject easily and want something to happen.',
  calm: 'You are calm and level, nothing special today.',
};

// load() -> { v, e, at } | null, save(state), now() -> ms
function createMood({ load, save, now = Date.now, off = () => false }) {
  let state = null;
  let savedAt = 0;
  const current = () => {
    const t = now();
    if (!state) {
      const kept = load();
      const valid = kept && Number.isFinite(kept.v) && Number.isFinite(kept.e) && Number.isFinite(kept.at);
      state = valid ? kept : { ...baseline(t), at: t };
    }
    state = { ...drift(state, t - state.at, t), at: t };
    return state;
  };
  const read = () => {
    const { v, e } = current();
    return { v, e, label: labelOf(v, e) };
  };
  const keep = (force) => {
    const t = now();
    if (!force && t - savedAt < SAVE_EVERY) return;
    savedAt = t;
    save({ v: Math.round(state.v * 1000) / 1000, e: Math.round(state.e * 1000) / 1000, at: state.at });
  };
  return {
    read,
    nudge(what, times = 1) {
      const n = NUDGES[what];
      if (!n || off()) return read();
      const s = current();
      // it takes more and more to push her further the same way
      const room = (x, d, lo, hi) => clamp(x + d * (d > 0 ? (hi - x) / (hi - lo) : (x - lo) / (hi - lo)) * 1.6 * times, lo, hi);
      state = { v: room(s.v, n[0], -1, 1), e: room(s.e, n[1], 0, 1), at: s.at };
      keep(false);
      return read();
    },
    // for her prompt: how she is, to colour how she talks
    line() {
      if (off()) return '';
      const { label } = read();
      return `HOW YOU ARE FEELING TODAY (it has built up over the day; let it colour your tone, and only say it outright if they ask how you are): ${LINES[label]}`;
    },
    tick() {
      current();
      keep(false);
    },
    flush() {
      if (state) keep(true);
    },
  };
}

module.exports = { createMood, rhythm, temper, baseline, drift, labelOf, NUDGES, LINES };

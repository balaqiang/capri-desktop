// How she looks when she feels something: each emotion is a combination of what her eyes, mouth and head do, and how she moves. All numbers,
// so going from one to another is a blend, never a cut.

import { damp, smoothSquare, clamp01 } from './waves.js';

// lid: eyes closed 0..1. eyeY, eyeX: how open and wide. eyeTilt: degrees, inner corners down (angry) or up (sad). eyeDx, eyeDy: moved, in
// hundredths of her face. blink: how much she blinks. flutter: rapid blinking. mouth: [closed, small, open, wide]. mouthY: squashed.
// headTilt: degrees. headDy: down, in hundredths of her face. jitter: shaking. speed: how fast she moves. swing: how far.
export const NEUTRAL = { lid: 0, eyeY: 1, eyeX: 1, eyeTilt: 0, eyeDx: 0, eyeDy: 0, blink: 1, flutter: 0, mouth: [1, 0, 0, 0], mouthY: 1, headTilt: 0, headDy: 0, jitter: 0, speed: 1, swing: 1 };

const as = (changes) => ({ ...NEUTRAL, ...changes });

export const EXPRESSIONS = {
  neutral: NEUTRAL,
  // eyes curved up, a wide open smile, bouncing
  happy: as({ eyeY: 0.74, eyeX: 1.06, eyeDy: -2, mouth: [0, 0, 1, 0], headTilt: -2, headDy: -3, speed: 1.35, swing: 1.45 }),
  // brows pulled down at the middle, teeth shut, head down, shaking a little
  angry: as({ eyeY: 0.7, eyeTilt: 17, eyeDy: 3, blink: 0.35, mouth: [1, 0, 0, 0], mouthY: 0.72, headTilt: 3, headDy: 5, jitter: 1.3, speed: 1.6, swing: 0.75 }),
  // narrowed, looking aside, mouth tight
  jealous: as({ eyeY: 0.55, eyeTilt: 9, eyeDx: 7, blink: 0.5, mouth: [1, 0, 0, 0], mouthY: 0.66, headTilt: -4, speed: 0.9, swing: 0.7 }),
  // half lidded, slow, nothing going on
  bored: as({ eyeY: 0.46, eyeDy: 4, blink: 0.7, mouth: [1, 0, 0, 0], mouthY: 0.8, headTilt: 2.5, headDy: 6, speed: 0.55, swing: 0.5 }),
  // everything misfiring
  glitch: as({ eyeY: 1.08, flutter: 1, mouth: [0.2, 0.5, 0.3, 0], jitter: 3.2, headTilt: -2, speed: 2, swing: 1.6 }),
  // brows up at the middle, small mouth, drooping
  sad: as({ eyeY: 0.72, eyeTilt: -13, eyeDy: 4, blink: 1.3, mouth: [0, 1, 0, 0], mouthY: 0.7, headTilt: 2.5, headDy: 8, speed: 0.6, swing: 0.5 }),
  // eyes wide, mouth wide
  surprised: as({ eyeY: 1.2, eyeX: 1.12, blink: 0.2, mouth: [0, 0, 0, 1], headDy: -6, speed: 1.2, swing: 1.2 }),
  // sly: one look, a small smile
  smug: as({ eyeY: 0.68, eyeTilt: 6, eyeDx: 3, mouth: [0.4, 0.6, 0, 0], headTilt: -3, speed: 0.8, swing: 0.8 }),
  // nearly gone
  sleepy: as({ eyeY: 0.5, eyeDy: 3, blink: 1.6, mouth: [1, 0, 0, 0], headTilt: 3, headDy: 9, speed: 0.45, swing: 0.4 }),
};

const ALIASES = { annoyed: 'angry', mad: 'angry', excited: 'happy', playful: 'happy', proud: 'smug', teasing: 'smug', tired: 'sleepy', curious: 'surprised', shy: 'sad' };

export function mix(a, b, k) {
  const out = {};
  for (const key of Object.keys(a)) out[key] = Array.isArray(a[key]) ? a[key].map((v, i) => v + (b[key][i] - v) * k) : a[key] + (b[key] - a[key]) * k;
  return out;
}

export const expressionFor = (name) => EXPRESSIONS[ALIASES[name] || name] || NEUTRAL;

// How she is when nothing in particular is happening: her mood of the day (main/mood.js), lightly.
const MOODS = { playful: ['happy', 0.4], content: ['happy', 0.2], irritable: ['angry', 0.4], gloomy: ['sad', 0.5], drained: ['sad', 0.55], drowsy: ['sleepy', 0.65], restless: ['glitch', 0.08], calm: ['neutral', 0] };
export function moodExpression(label) {
  const [name, amount] = MOODS[label] || MOODS.calm;
  return mix(NEUTRAL, EXPRESSIONS[name], amount);
}

// One step towards `target` (an emotion comes on faster than it goes off).
export function blendToward(current, target, dt) {
  const halfLife = 0.09;
  const out = {};
  for (const key of Object.keys(current)) {
    out[key] = Array.isArray(current[key]) ? current[key].map((v, i) => damp(v, target[key][i], dt, halfLife)) : damp(current[key], target[key], dt, halfLife);
  }
  return out;
}

// How much of each mouth to show. talk: how loud she is now, 0..1. hold: the expression's mouth. -> [closed, small, open, wide], summing to 1
export function mouthWeights(talk, hold, t) {
  const speaking = clamp01(Number(talk) / 0.12);
  // the louder the wider; a slow wave keeps it moving on a steady sound
  const v = 1 + 2 * clamp01(Number(talk) * (0.82 + 0.18 * smoothSquare(t, 0.21, 1.4)));
  const say = [0, Math.max(0, 1 - Math.abs(v - 1)), Math.max(0, 1 - Math.abs(v - 2)), Math.max(0, 1 - Math.abs(v - 3))];
  const total = hold.reduce((a, b) => a + b, 0) || 1;
  return hold.map((h, i) => (h / total) * (1 - speaking) + say[i] * speaking);
}

// The curves everything of hers moves on. A smoothed square wave holds, eases across and holds again, with no corner anywhere: unlike a
// sine it rests at each end, and unlike a square wave it never jumps.

// -1 .. 1. sharp: how long it holds at each end (around 1.5: a soft swing, 5 and up: nearly a real square wave)
export const smoothSquare = (t, period, sharp = 1.8, phase = 0) => Math.tanh(sharp * Math.sin(2 * Math.PI * (t / period + phase))) / Math.tanh(sharp);

// 0 .. 1: on for `duty` of each period, with soft edges (soft: as a fraction of the period)
export function pulse(t, period, duty, soft = 0.012, phase = 0) {
  const x = (((t / period + phase) % 1) + 1) % 1;
  return Math.max(0, Math.min(1, 0.5 * (Math.tanh(x / soft) - Math.tanh((x - duty) / soft)) + 0.5 * (1 + Math.tanh((x - 1) / soft))));
}

// 0 .. 1 from a to b, flat before and after, soft in the middle
export function step(t, a, b, sharp = 3) {
  if (t <= a) return 0;
  if (t >= b) return 1;
  const x = (t - a) / (b - a);
  return 0.5 + 0.5 * Math.tanh(sharp * (2 * x - 1) * 1.6) / Math.tanh(sharp * 1.6);
}

// Moves `current` towards `target`, losing half the distance every `halfLife` seconds: however often it's called, it never overshoots.
export const damp = (current, target, dt, halfLife) => target + (current - target) * 0.5 ** (dt / Math.max(1e-4, halfLife));

// A wobble with no pattern to it, -1 .. 1, smooth at any speed.
export const wobble = (t, seed = 0) => (Math.sin(t * 7.3 + seed) + Math.sin(t * 11.9 + seed * 2.1) * 0.6 + Math.sin(t * 17.7 + seed * 3.3) * 0.4) / 2;

export const clamp01 = (x) => Math.min(1, Math.max(0, x));

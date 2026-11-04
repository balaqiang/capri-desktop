// Inverse kinematics for her cut-out (sprite.js): where her hand should be, and the shoulder turn and stretch that
// put it there. Her arm is one piece from shoulder to fingertips, turned at the shoulder and drawn longer when she
// reaches (anime exaggeration), so the solve is exact: an angle and a length. Her head looks at what she reaches for.
//
// In sprite pixels, in the frame of her left arm as drawn (the right arm is it mirrored: solve with the target
// mirrored, and give the right arm the same angle, as limb() and the shader do).
//
//   reach(shoulder, hand, target) -> { angle, long, touches }
//   look(neck, target, facing) -> head tilt (radians), small

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const wrap = (a) => {
  let x = a;
  while (x > Math.PI) x -= Math.PI * 2;
  while (x <= -Math.PI) x += Math.PI * 2;
  return x;
};

// How far her arm turns at the shoulder (0: hanging at rest, positive raises it; up to overhead) and stretches.
export const ARM_LIMITS = { lo: -1.05, hi: 2.35, min: 0.85, max: 1.65 };

export function reach(shoulder, hand, target, limits = ARM_LIMITS) {
  const rx = hand.x - shoulder.x;
  const ry = hand.y - shoulder.y;
  const tx = target.x - shoulder.x;
  const ty = target.y - shoulder.y;
  const rest = Math.hypot(rx, ry);
  const dist = Math.hypot(tx, ty);
  // the turn that lays the arm along shoulder→target (the shader turns it with the same rotation)
  const want = wrap(Math.atan2(ty, tx) - Math.atan2(ry, rx));
  const angle = clamp(want, limits.lo, limits.hi);
  const long = clamp(dist / (rest || 1), limits.min, limits.max);
  const touches = Math.abs(angle - want) < 0.05 && dist / rest <= limits.max && dist / rest >= limits.min;
  return { angle, long, touches };
}

// Mirrored into the left arm's frame (the right arm's target, for reach()).
export const mirrored = (p, mirror) => ({ x: mirror - p.x, y: p.y });

// Her head turned toward a point: a little, never more than a glance (the shader tilts it around her neck).
export function look(neck, target, max = 0.16) {
  const dx = target.x - neck.x;
  const dy = target.y - neck.y;
  if (!dx && !dy) return 0;
  // tilting toward it: positive tilts her head to her right as drawn (the shader's rot by -uHead)
  return clamp((dx / (Math.abs(dx) + Math.abs(dy) + 60)) * max * 1.6, -max, max);
}

// Where her fingertip is, for an angle and stretch (what reach() solved, the other way round).
export function fingertip(shoulder, hand, angle, long) {
  const vx = (hand.x - shoulder.x) * long;
  const vy = (hand.y - shoulder.y) * long;
  return { x: shoulder.x + Math.cos(angle) * vx - Math.sin(angle) * vy, y: shoulder.y + Math.sin(angle) * vx + Math.cos(angle) * vy };
}

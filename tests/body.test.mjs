// Her body's physics and IK (src/renderer/js/hair.js, ik.js): the hand lands where she reaches, the mane moves
// like hair and comes to rest.
import test from 'node:test';
import assert from 'node:assert/strict';
import { reach, fingertip, look, mirrored, ARM_LIMITS } from '../src/renderer/js/ik.js';
import { Hair } from '../src/renderer/js/hair.js';

const SHOULDER = { x: 98, y: 168 };
const HAND = { x: 24, y: 212 };

test('reach: her fingertip lands on the target', () => {
  for (const target of [{ x: 20, y: 120 }, { x: 60, y: 60 }, { x: 0, y: 230 }, { x: 20, y: 150 }, { x: 98, y: 60 }]) {
    const r = reach(SHOULDER, HAND, target);
    assert.equal(r.touches, true, JSON.stringify(target));
    const tip = fingertip(SHOULDER, HAND, r.angle, r.long);
    assert.ok(Math.hypot(tip.x - target.x, tip.y - target.y) < 0.5, `${JSON.stringify(target)} -> ${JSON.stringify(tip)}`);
  }
});

test('reach: at rest, no turn and no stretch; out of reach, as far as she goes', () => {
  const rest = reach(SHOULDER, HAND, HAND);
  assert.ok(Math.abs(rest.angle) < 1e-9 && Math.abs(rest.long - 1) < 1e-9);
  const far = reach(SHOULDER, HAND, { x: -400, y: 168 });
  assert.equal(far.long, ARM_LIMITS.max);
  assert.equal(far.touches, false);
  const behind = reach(SHOULDER, HAND, { x: 300, y: 300 }); // across her body: she doesn't twist through it
  assert.ok(behind.angle >= ARM_LIMITS.lo && behind.angle <= ARM_LIMITS.hi);
  assert.equal(behind.touches, false);
});

test('reach: the right arm is the left one mirrored', () => {
  const target = { x: 200, y: 120 };
  const r = reach(SHOULDER, HAND, mirrored(target, 234));
  const tip = fingertip(SHOULDER, HAND, r.angle, r.long);
  assert.ok(Math.hypot(234 - tip.x - target.x, tip.y - target.y) < 0.5);
});

test('look: a glance toward it, never more', () => {
  assert.ok(look({ x: 118, y: 152 }, { x: 400, y: 150 }) > 0);
  assert.ok(look({ x: 118, y: 152 }, { x: -400, y: 150 }) < 0);
  assert.ok(Math.abs(look({ x: 118, y: 152 }, { x: 9000, y: 150 })) <= 0.16);
});

test('hair: lags behind when she starts, swings past when she stops, then rests', () => {
  const hair = new Hair();
  for (let i = 0; i < 6; i++) hair.step(1 / 24, { ax: 3000 }); // she speeds up to her right
  const tip = hair.offsets[4][0];
  assert.ok(tip < -5, `the tips trail behind (${tip})`);
  assert.ok(Math.abs(hair.offsets[1][0]) < Math.abs(tip), 'the root moves less than the tips');
  for (let i = 0; i < 4; i++) hair.step(1 / 24, { ax: -3000 }); // and stops
  assert.ok(hair.offsets[4][0] > 0, 'they swing on past');
  for (let i = 0; i < 60; i++) hair.step(1 / 24, {}); // two and a half seconds
  assert.equal(hair.live, false);
  assert.deepEqual(hair.offsets[4], [0, 0]);
});

test('hair: falls aside when she is turned, and never further than a shard bends', () => {
  const hair = new Hair();
  for (let i = 0; i < 30; i++) hair.step(1 / 24, { tilt: Math.PI / 2, ax: 9000, ay: 9000 });
  for (let i = 1; i < 5; i++) assert.ok(Math.hypot(...hair.offsets[i]) <= [0, 6, 13, 21, 30][i] + 1e-9);
  hair.push(2000, 0, 1);
  assert.equal(hair.live, true);
});

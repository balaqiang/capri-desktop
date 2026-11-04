// Her mane, simulated: a chain of springs from its root at her neck to the tips of the shards. Moving her moves it
// the way hair moves: it lags when she starts, overshoots when she stops, streams behind her when she's dragged or
// thrown, falls the other way when she's upside down, bounces with each step, and ruffles when your pointer brushes
// through it. The shader bends her mane by these offsets, height by height (sprite.js, uStrand).
//
// Units: sprite pixels (her drawing is 240x420) and seconds; x to her right as drawn, y down.
//
//   const hair = new Hair();
//   hair.step(dt, { ax, ay, tilt })   her head's acceleration (sprite px/s²), her lean (radians, clockwise)
//   hair.push(vx, vy, amount)         your pointer brushing through it (sprite px/s), 0..1
//   hair.offsets -> [[x, y], ...]     root first (always 0), tips last
//   hair.live                         still moving (draw on ones while it is)

const NODES = 5;
// stiffer at the root, looser at the tips; the tips feel her motion most
const STIFF = [0, 260, 190, 140, 105];
const INERTIA = [0, 0.3, 0.55, 0.8, 1];
const REACH = [0, 6, 13, 21, 30]; // how far each can be pulled (sprite px)
const DAMP = 8.5;
const GRAVITY = 900; // what holds her shards up is used to it; turned, it pulls them aside
const MAX_ACCEL = 9000;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export class Hair {
  constructor() {
    this.d = Array.from({ length: NODES }, () => [0, 0]);
    this.v = Array.from({ length: NODES }, () => [0, 0]);
    this.live = false;
    this.calm = 1; // 0..1: how much she moves at all (reduced motion: less)
  }

  get offsets() {
    return this.d;
  }

  // Back to rest at once (a teleport: there's no motion to feel).
  reset() {
    for (let i = 0; i < NODES; i++) {
      this.d[i] = [0, 0];
      this.v[i] = [0, 0];
    }
    this.live = false;
  }

  push(vx, vy, amount = 1) {
    const k = clamp(amount, 0, 1) * 0.35 * this.calm;
    for (let i = 1; i < NODES; i++) {
      this.v[i][0] += clamp(vx, -3000, 3000) * k * INERTIA[i];
      this.v[i][1] += clamp(vy, -3000, 3000) * k * INERTIA[i] * 0.5;
    }
    this.live = true;
  }

  step(dt, { ax = 0, ay = 0, tilt = 0 } = {}) {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    ax = clamp(ax, -MAX_ACCEL, MAX_ACCEL) * this.calm;
    ay = clamp(ay, -MAX_ACCEL, MAX_ACCEL) * this.calm;
    // gravity as she's turned, less what it is standing up (that's her shape at rest)
    const gx = GRAVITY * Math.sin(tilt);
    const gy = GRAVITY * (Math.cos(tilt) - 1);
    const moving = Math.abs(ax) + Math.abs(ay) > 30 || Math.abs(tilt) > 0.05;
    if (!moving && !this.live) return;
    const n = Math.max(1, Math.ceil(dt / 0.008));
    const h = dt / n;
    for (let s = 0; s < n; s++) {
      for (let i = 1; i < NODES; i++) {
        const [x, y] = this.d[i];
        const [px, py] = this.d[i - 1];
        const v = this.v[i];
        // pulled back toward where the shard above it leads, slowed, and carried by her motion (the other way)
        const fx = -STIFF[i] * (x - px * 0.9) - DAMP * v[0] - ax * INERTIA[i] + gx * INERTIA[i] * 0.08;
        const fy = -STIFF[i] * (y - py * 0.9) - DAMP * v[1] - ay * INERTIA[i] * 0.6 + gy * INERTIA[i] * 0.05;
        v[0] += fx * h;
        v[1] += fy * h;
        let nx = x + v[0] * h;
        let ny = y + v[1] * h;
        // a shard bends so far and no further
        const len = Math.hypot(nx, ny);
        if (len > REACH[i]) {
          nx *= REACH[i] / len;
          ny *= REACH[i] / len;
          v[0] *= 0.5;
          v[1] *= 0.5;
        }
        this.d[i] = [nx, ny];
      }
    }
    let energy = 0;
    for (let i = 1; i < NODES; i++) energy += Math.abs(this.d[i][0]) + Math.abs(this.d[i][1]) + (Math.abs(this.v[i][0]) + Math.abs(this.v[i][1])) * 0.02;
    this.live = moving || energy > 0.08;
    if (!this.live) this.reset();
  }
}

export const HAIR_NODES = NODES;

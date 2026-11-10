// Her opening, from your drawing, kept simple: she appears, whole and centered. Behind her the spark strikes in combinations, a few layers at
// a time, left and right in turn, small at first and bigger towards the end; never all of it. She opens her eyes, says hi with one wave, and
// goes down to where she stands. Finished by the same shader as her standing body (rigfx.js).

import { smoothSquare, step } from './waves.js';
import { EXPRESSIONS, NEUTRAL, mix } from './expressions.js';

export { step };

// The combinations: when each strikes (seconds), and which layers, by their place in your Layers panel (0 on top). The first layer of each is
// its main shape, the others answer it. `twice`: flickers on and off once before it stays, as the big strikes do.
export const COMBOS = [
  { at: 0.45, layers: [12, 11, 20] }, // left: a thin red line, a green curl
  { at: 0.66, layers: [15, 13, 24, 26] }, // right: the same, answering
  { at: 0.86, layers: [1, 23, 19] }, // left: black line, cyan fork
  { at: 1.05, layers: [9, 33, 14, 27] }, // right: black and green side by side
  { at: 1.23, layers: [6, 35, 25] }, // left: green zigzag
  { at: 1.4, layers: [31, 34, 5, 17] }, // right: the red branch, black crackle
  { at: 1.58, layers: [4, 22, 21], twice: true }, // the big red, left, with the cyan under her
  { at: 1.8, layers: [10, 32, 29, 18, 16], twice: true }, // the black cluster, right, green burst
  { at: 2.0, layers: [36, 3, 0, 28], twice: true }, // one long diagonal: red from the left, green from the right
  { at: 2.2, layers: [7, 8, 2, 30], twice: true }, // and the great black blades, framing her
];
const STAGGER = 0.03; // between the layers of a combination, so each spreads from its main shape

export const OPENING = { eyes: 0.85, climax: 2.2, hi: 2.62, dive: 3.4, end: 4.05, stillEnd: 2.1 };
const HEIGHT = 0.86; // of the screen, leaving room for her caption under her feet
const TOP = 0.03;

const on = (dt, hold) => step(dt, 0, 0.03) * (1 - step(dt, hold, hold + 0.03));

// One layer's flash, dt seconds after its turn: on, a moment, off. Nothing lingers.
export const flash = (dt, twice = false) => (twice ? Math.max(on(dt, 0.05), on(dt - 0.1, 0.1)) : on(dt, 0.1));

const TURNS = new Map();
COMBOS.forEach((c) => c.layers.forEach((order, i) => TURNS.set(order, { at: c.at + i * STAGGER, twice: Boolean(c.twice) })));

// When a layer strikes. One you add to your file later joins a combination, so nothing you draw is left out.
export function sparkTurn(order) {
  const known = TURNS.get(order);
  if (known) return known;
  const c = COMBOS[order % COMBOS.length];
  return { at: c.at + c.layers.length * STAGGER, twice: Boolean(c.twice) };
}

// How one spark layer looks at t. order: its place in your Layers panel.
export function sparkShape(t, order) {
  const { at, twice } = sparkTurn(order);
  return { alpha: flash(t - at, twice) };
}

// One piece as she appears: she's all there at once; her arms swing up into place and her hair opens out from her head.
export function assemble(p, t, m) {
  const out = { alpha: step(t, 0, 0.2) };
  const v = step(t, 0.05, 0.6, 2);
  if (p.role === 'arm') out.angle = (1 - v) * (p.box.x + p.box.w / 2 > m.face.x ? 30 : -30);
  if (p.role === 'hair' || p.role === 'hairFrame') out.scale = 0.82 + 0.18 * v;
  return out;
}

// How loud her "hi" is: 0..1
export function hiLevel(t) {
  return step(t, OPENING.hi, OPENING.hi + 0.07) * (1 - step(t, OPENING.hi + 0.5, OPENING.hi + 0.72)) * (0.74 + 0.26 * smoothSquare(t, 0.27, 1.4));
}

export class Opening {
  constructor(rig) {
    this.rig = rig;
  }

  // Ready before she starts, at the size it'll be shown. (Once: whoever asks again waits for the same work.)
  prepare() {
    this.preparing ||= this.load();
    return this.preparing;
  }

  async load() {
    const { h, dpr } = this.rig;
    const spark = await this.rig.model('spark', 0.25);
    this.spark = await this.rig.model('spark', Math.min(1, ((h * 0.98) / spark.view.h) * dpr));
    const model = await this.rig.model('opening', 0.25);
    this.model = await this.rig.model('opening', Math.min(1, ((h * HEIGHT) / model.view.h) * dpr));
    return this;
  }

  // The spark, centered behind her, as big as the screen is tall.
  drawSpark(ctx, t, w, h) {
    const m = this.spark;
    const k = (h * 0.98) / m.view.h;
    const left = w / 2 - (m.view.w * k) / 2;
    const top = h * 0.01;
    for (const p of m.parts) {
      const { alpha } = sparkShape(t, p.order);
      if (alpha <= 0.01) continue;
      ctx.globalAlpha = alpha;
      ctx.drawImage(p.bitmap, left + p.box.x * k, top + p.box.y * k, p.box.w * k, p.box.h * k);
    }
    ctx.globalAlpha = 1;
  }

  layout() {
    const { w, h } = this.rig;
    const m = this.model;
    const big = (h * HEIGHT) / m.view.h;
    return { big, home: { x: w / 2 + (m.face.x - m.view.w / 2) * big, y: h * TOP + m.face.y * big } };
  }

  // Where she is at t: { x, y, k, dive }
  placeAt(t, to) {
    const m = this.model;
    const { big, home } = this.layout();
    const dive = step(t, OPENING.dive, OPENING.end, 2);
    const small = (420 * (this.rig.landScale || 1)) / m.view.h;
    return { x: home.x + (to.x - home.x) * dive, y: home.y + (to.y - home.y) * dive, k: big + (small - big) * dive, dive };
  }

  // One moment of it, t seconds in.
  renderAt(t, options) {
    const { rig } = this;
    const box = rig.fullBox();
    rig.begin(box);
    this.drawAt(t, options);
    rig.wipe();
    const here = this.placeAt(t, options.to);
    // finished like her standing body: a new drawing twelve times a second, every effect in proportion to her size
    rig.present(box, { scale: here.k * (this.model.view.h / 420), seed: Math.floor(t * 12) * 7.13, boil: options.still ? 0 : 0.9, origin: [here.x, here.y] });
  }

  drawAt(t, { to, caption = '', still = false }) {
    const { rig } = this;
    const { ctx, w, h } = rig;
    const m = this.model;
    if (still) {
      // no motion: she comes and goes where she is
      const { big, home } = this.layout();
      m.draw(ctx, { t: 0, x: home.x, y: home.y, k: big, alpha: step(t, 0, 0.5) * (1 - step(t, 1.6, OPENING.stillEnd)), still: true });
      return;
    }
    if (t < OPENING.hi) this.drawSpark(ctx, t, w, h);
    const waving = step(t, OPENING.hi - 0.1, OPENING.hi + 0.12) * (1 - step(t, OPENING.dive - 0.25, OPENING.dive));
    const extra = (p) => {
      const out = assemble(p, t, m);
      if (p.name === 'tangan-kanan') out.angle = (out.angle || 0) - waving * (7 + 7 * smoothSquare(t, 0.7, 1.5));
      return out;
    };
    const here = this.placeAt(t, to);
    m.draw(ctx, {
      t,
      x: here.x,
      y: here.y,
      k: here.k,
      alpha: 1 - step(t, OPENING.end - 0.14, OPENING.end),
      talk: hiLevel(t),
      eyes: t < OPENING.eyes ? 'closed' : 'auto',
      energy: 0.6,
      extra,
      expr: mix(NEUTRAL, EXPRESSIONS.happy, step(t, OPENING.hi - 0.15, OPENING.hi + 0.15)),
    });
    if (caption && here.dive < 0.02) {
      ctx.globalAlpha = step(t, 0.3, 0.6) * (1 - step(t, OPENING.dive - 0.3, OPENING.dive));
      ctx.fillStyle = '#ff1a55';
      ctx.font = `600 ${Math.round(h * 0.024)}px "Chakra Petch", sans-serif`;
      ctx.textAlign = 'center';
      ctx.letterSpacing = `${Math.round(h * 0.006)}px`;
      ctx.fillText(caption, w / 2, h * 0.955);
      ctx.letterSpacing = '0px';
      ctx.globalAlpha = 1;
    }
  }

  // to: where her face ends up. -> resolves when she's landed
  async play({ to, caption = '', still = false, onCue = () => {} }) {
    const { rig } = this;
    // asked for before it's ready: it waits; if it can't be drawn, there's no opening and she just arrives
    if (!(await this.prepare().then(() => true, () => false))) return;
    const fired = new Set();
    const times = still ? {} : { open: 0, grab: OPENING.climax, hi: OPENING.hi, slip: OPENING.dive };
    rig.playing = true;
    await new Promise((done) => {
      const start = performance.now();
      const finish = () => {
        rig.playing = false;
        rig.clear();
        done();
      };
      const loop = (now) => {
        const t = (now - start) / 1000;
        for (const [name, at] of Object.entries(times)) {
          if (t >= at && !fired.has(name)) {
            fired.add(name);
            onCue(name);
          }
        }
        try {
          this.renderAt(t, { to, caption, still });
        } catch (err) {
          console.warn('[capri] her opening:', err.message);
          finish(); // whatever went wrong, she doesn't stay stuck in it
          return;
        }
        if (t >= (still ? OPENING.stillEnd : OPENING.end)) {
          finish();
          return;
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
  }
}

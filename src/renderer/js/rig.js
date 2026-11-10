// Her models, drawn in Illustrator (assets/capri/rig, one SVG each): every piece you separated is turned into a picture the size she needs and
// drawn in the order you stacked them, so it stays sharp and costs almost nothing per frame. Each piece moves from where it's attached; her
// eyes and mouth follow how she feels (expressions.js) and what she's saying.

import { smoothSquare, pulse, damp, wobble, clamp01 } from './waves.js';
import { NEUTRAL, expressionFor, moodExpression, blendToward, mouthWeights } from './expressions.js';
import { RigFx } from './rigfx.js';

export { smoothSquare, pulse };

const SHAPES_WITH_IDS = 'linearGradient,radialGradient,clipPath,mask,pattern,filter';
const PAD = 16; // around a part's outline: its stroke isn't part of its box
const ON_HEAD = new Set(['face', 'eyeOpen', 'eyeClosed', 'mouth', 'mouthRest', 'hair', 'hairFrame']);

// What a part does, from the name you gave it.
export function roleOf(name) {
  const n = String(name || '');
  let m;
  if (/^eye-open/.test(n)) return { role: 'eyeOpen' };
  if (/^eye-close/.test(n)) return { role: 'eyeClosed' };
  if (/^mouth-z/.test(n)) return { role: 'mouthRest' };
  if ((m = /^mouth-open-frame(\d)/.exec(n))) return { role: 'mouth', frame: Number(m[1]) };
  if ((m = /^hair-(?:animation|noise)-frame(\d)/.exec(n))) return { role: 'hairFrame', frame: Number(m[1]), noise: /noise/.test(n) };
  if (/noise/.test(n)) return { role: 'noise' };
  if (/^(?:hair|hiar)/.test(n)) return { role: 'hair' };
  if (/^(?:tangan|hand)/.test(n)) return { role: 'arm' };
  if (/^(?:foot|kaki)/.test(n)) return { role: 'leg' };
  if (/^spark/.test(n)) return { role: 'spark' };
  if (/^(?:face|head)/.test(n)) return { role: 'face' };
  return { role: 'body' };
}

// Which model for how she is now. null: the body she's always had (walking, teleporting, being dragged, a gesture).
// expressive: she's talking or feeling something, so a face that can show it stands in sooner.
// How she can be on a window (capri.js keeps it in perch.pose), and which of your drawings each one is.
export const POSE_MODEL = { sit: 'sit', lounge: 'lean', peek: 'just-head', cling: 'perch' };

// What touches what she's on, in each drawing: x from the middle of one piece, y a part of the way down another.
const CONTACT = {
  sit: { x: 'body', y: 'foot-left-layer-1', at: 1 }, // the thigh lying along the edge, the other leg hanging over it
  lean: { x: 'body', y: 'body', at: 1 }, // lying back on it, a foot dangling
  'lean-sleep': { x: 'body', y: 'body', at: 1 }, // out cold on it, arms hanging down
  'just-head': { x: 'face', y: 'face', at: 0.86 }, // up to her chin behind it
  perch: { x: 'spark-support', y: 'face', at: 0.5 }, // the green spark she's holding is the window's edge
};

// In units of the drawing. -> { x, y }, or null for a drawing that doesn't touch anything
export function contactOf(name, parts, face) {
  const spec = CONTACT[name];
  if (!spec) return null;
  const box = (piece) => parts.find((p) => p.name === piece)?.box;
  const across = box(spec.x);
  const down = box(spec.y);
  return { x: across ? across.x + across.w / 2 : face.x, y: down ? down.y + down.h * spec.at : face.y };
}

// Where her face goes so that the contact point lands on `edge` (screen pixels).
export function faceOnEdge(contact, face, edge, k, flip = false) {
  return { x: edge.x - (contact.x - face.x) * k * (flip ? -1 : 1), y: edge.y - (contact.y - face.y) * k };
}

// Where her mic goes when she's in one of your drawings: beside her face, never on it. -> its top left corner
export function micBeside({ x, y, k, m }, width, size = 34) {
  const clear = (m.face.w * k) / 2 * 1.25 + size / 2 + 8;
  const side = x + clear + size > width ? -1 : 1;
  return { x: Math.round(x + side * clear - size / 2), y: Math.max(0, Math.round(y - size / 2)) };
}

// Which pose, r: 0..1. sides: which sides of this window she could hang from.
export function pickPose(r, { work = false, sides = [], taskbar = false } = {}) {
  if (work) return { pose: 'sit' };
  const table = taskbar ? [['sit', 5], ['lounge', 3], ['peek', 2]] : [['sit', 4], ['lounge', 3], ['peek', 2], ...(sides.length ? [['cling', 3]] : [])];
  let left = r * table.reduce((sum, [, weight]) => sum + weight, 0);
  const [pose] = table.find(([, weight]) => (left -= weight) < 0) || table[0];
  return pose === 'cling' ? { pose, side: sides[Math.floor(r * 997) % sides.length] } : { pose };
}

export function modelFor(c, calmFor = 0, expressive = false) {
  if (c.stowed || c.form === 'spark' || c.form === 'shards') return null;
  if (c.dormant) return 'just-head';
  // (glitch and silhouette are drawn on the model she's in)
  if ((c.busy && !c.form) || c.dragging || c.walking || c.hidden) return null;
  if (c.mode === 'sleep') return 'lean-sleep';
  if (c.riding) return 'perch';
  if (c.stance === 'sit') return POSE_MODEL[c.perch?.pose] || 'sit';
  if (c.act) return null; // a gesture standing up is her standing body's
  if (c.stance === 'stand' && c.mode === 'idle' && !c.hearing && calmFor > (expressive ? 0.4 : 14)) return 'lean';
  return null;
}

// How one piece is shown at time t: { alpha, angle, shape }. shape: { sx, sy, rot, dx, dy } around its own middle.
export function partPose(p, t, { talk = 0, eyes = 'auto', energy = 0.5, expr = NEUTRAL } = {}) {
  const swing = (0.6 + energy) * expr.swing;
  const blinking = Math.max(expr.blink * pulse(t, 4.3, 0.042, 0.012), Math.min(1, expr.blink - 1) * pulse(t, 2.7, 0.05, 0.016, 0.4), expr.flutter * pulse(t, 0.37, 0.38, 0.07));
  const closed = eyes === 'closed' ? 1 : eyes === 'open' ? 0 : clamp01(Math.max(expr.lid, blinking));
  const eyeShape = () => ({ sx: expr.eyeX, sy: expr.eyeY, rot: -(p.side || 1) * expr.eyeTilt, dx: expr.eyeDx, dy: expr.eyeDy });
  const mouth = () => mouthWeights(talk, expr.mouth, t);
  switch (p.role) {
    case 'eyeOpen': return { alpha: 1 - closed, angle: 0, shape: eyeShape() };
    case 'eyeClosed': return { alpha: closed, angle: 0, shape: eyeShape() };
    case 'mouthRest': return { alpha: mouth()[0], angle: 0, shape: { sx: 1, sy: expr.mouthY, rot: 0, dx: 0, dy: 0 } };
    case 'mouth': return { alpha: mouth()[p.frame], angle: 0, shape: { sx: 1, sy: expr.mouthY, rot: 0, dx: 0, dy: 0 } };
    case 'hairFrame': return { alpha: pulse(t, 0.72, 0.37, 0.05, (1 - p.frame) / 3), angle: 0 };
    case 'noise': return { alpha: 0.82 + 0.18 * smoothSquare(t, 0.3, 1.4, p.phase), angle: 0 };
    case 'hair': return { alpha: 1, angle: 1.6 * swing * smoothSquare(t, 3.4, 1.8, p.phase) + 0.4 * swing * smoothSquare(t, 1.3, 1.4, p.phase * 2) };
    case 'arm': return { alpha: 1, angle: 2.2 * swing * smoothSquare(t, 3.1, 1.8, p.phase) + 0.5 * swing * smoothSquare(t, 1.1, 1.4, p.phase) };
    case 'leg': return { alpha: 1, angle: 1.0 * swing * smoothSquare(t, 4.2, 1.6, p.phase) };
    case 'spark': return { alpha: 0.72 + 0.28 * smoothSquare(t, 0.22, 1.5, p.phase), angle: 0 };
    default: return { alpha: 1, angle: 0 };
  }
}

// The point of a box closest to (x, y): where a part is fixed on (a shoulder, the root of the hair).
export function closestOnBox(box, x, y) {
  return { x: Math.min(box.x + box.w, Math.max(box.x, x)), y: Math.min(box.y + box.h, Math.max(box.y, y)) };
}

function viewOf(root) {
  const [x, y, w, h] = (root.getAttribute('viewBox') || '0 0 100 100').trim().split(/[\s,]+/).map(Number);
  return { x, y, w, h };
}

async function picture(inner, box, px) {
  const width = Math.max(1, Math.ceil(box.w * px));
  const height = Math.max(1, Math.ceil(box.h * px));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="${box.x} ${box.y} ${box.w} ${box.h}">${inner}</svg>`;
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  return createImageBitmap(img);
}

export class Model {
  // svg: the file. unitsToPx: pixels of the picture per unit of the drawing.
  static async load(name, svg, unitsToPx) {
    const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const root = parsed.documentElement;
    if (root.nodeName !== 'svg' || parsed.querySelector('parsererror')) throw new Error(`${name}: not an SVG`);
    const view = viewOf(root);
    // laid out (invisibly) only to measure it
    const probe = document.importNode(root, true);
    probe.setAttribute('width', '1');
    probe.setAttribute('height', '1');
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    document.body.appendChild(probe);
    const group = probe.querySelector('g[id^="Capri-"], g#spark') || probe;
    const defs = [...probe.querySelectorAll(SHAPES_WITH_IDS)].filter((d) => d.id);
    const out = new XMLSerializer();
    const parts = [];
    const pending = [];
    let i = 0;
    for (const el of group.children) {
      if (el.matches(SHAPES_WITH_IDS) || el.tagName === 'defs') continue;
      let bb;
      try {
        bb = el.getBBox();
      } catch {
        continue;
      }
      if (!bb.width && !bb.height) continue;
      const box = { x: bb.x - PAD, y: bb.y - PAD, w: bb.width + PAD * 2, h: bb.height + PAD * 2 };
      const xml = out.serializeToString(el);
      const used = defs.filter((d) => !el.contains(d) && xml.includes(`#${d.id}`)).map((d) => out.serializeToString(d)).join('');
      const part = { name: el.id || `shape${i}`, ...roleOf(el.id || 'spark'), box, phase: (i * 0.37) % 1, index: i, order: Number(el.getAttribute('data-order')) || 0 };
      if (name === 'spark') part.role = 'spark';
      parts.push(part);
      pending.push(picture(used + xml, box, unitsToPx).then((bitmap) => { part.bitmap = bitmap; }));
      i++;
    }
    probe.remove();
    await Promise.all(pending);
    return new Model(name, parts, view, unitsToPx);
  }

  constructor(name, parts, view, unitsToPx) {
    this.name = name;
    this.parts = parts;
    this.view = view;
    this.unitsToPx = unitsToPx;
    const eyes = parts.find((p) => /^face-eye-bg/.test(p.name)) || parts.find((p) => p.role === 'face');
    // where her face is: everything is placed and turned from here
    this.face = eyes ? { x: eyes.box.x + eyes.box.w / 2, y: eyes.box.y + eyes.box.h / 2, w: eyes.box.w - PAD * 2 } : { x: view.w / 2, y: view.h / 2, w: view.w / 4 };
    // where things are attached: the hair to her head, her arms at the neck, her legs at the hip
    const middle = (b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
    const neck = parts.find((p) => p.name === 'neck');
    const body = parts.find((p) => p.name === 'body');
    this.neck = neck ? middle(neck.box) : { x: this.face.x, y: this.face.y + this.face.w * 0.8 };
    this.hip = body ? { x: middle(body.box).x, y: body.box.y + body.box.h * 0.75 } : this.neck;
    for (const p of parts) {
      const to = p.role === 'hair' ? this.face : p.role === 'leg' ? this.hip : this.neck;
      p.pivot = closestOnBox(p.box, to.x, to.y);
      p.middle = middle(p.box);
      p.side = p.middle.x >= this.face.x ? 1 : -1; // which side of her face an eye is on
    }
  }

  // Is there any of her at this point (units of the drawing)? A small picture of all her pieces, made the first time it's asked.
  covers(x, y) {
    if (!this.mask) {
      const scale = Math.min(1, 240 / Math.max(this.view.w, this.view.h));
      const w = Math.ceil(this.view.w * scale);
      const h = Math.ceil(this.view.h * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      for (const p of this.parts) if (p.bitmap) ctx.drawImage(p.bitmap, p.box.x * scale, p.box.y * scale, p.box.w * scale, p.box.h * scale);
      this.mask = { w, h, scale, alpha: ctx.getImageData(0, 0, w, h).data };
    }
    const { w, h, scale, alpha } = this.mask;
    const cx = Math.round(x * scale);
    const cy = Math.round(y * scale);
    // a little generous, for thin arms and legs
    for (const [dx, dy] of [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
      const px = cx + dx;
      const py = cy + dy;
      if (px >= 0 && py >= 0 && px < w && py < h && alpha[(py * w + px) * 4 + 3] > 40) return true;
    }
    return false;
  }

  // how far her whole body has bobbed at t, in units of the drawing
  bobAt(t, still = false) {
    return still ? 0 : this.face.w * 0.014 * smoothSquare(t, 2.8, 1.6);
  }

  // One frame. x, y: where her face goes, in canvas pixels. k: canvas pixels per unit of the drawing.
  // extra(part) -> { alpha, angle, dy }: on top of her usual movement, for one piece (her opening). expr: expressions.js
  draw(ctx, { t, x, y, k, flip = false, alpha = 1, talk = 0, eyes = 'auto', energy = 0.5, still = false, extra = null, expr = NEUTRAL, grounded = false }) {
    const time = still ? 0 : t;
    const unit = this.face.w / 100; // moves are in hundredths of her face
    const bob = this.bobAt(time, still || grounded);
    // her head goes as one: face, eyes, mouth and the hair on it
    const tilt = still ? expr.headTilt : (0.8 + energy) * expr.swing * smoothSquare(time, 5.3, 1.5, 0.1) + expr.headTilt;
    const shakeX = still ? 0 : expr.jitter * unit * wobble(time * 5, 1.3);
    const shakeY = still ? 0 : expr.jitter * unit * wobble(time * 5, 4.1);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flip ? -k : k, k);
    ctx.translate(-this.face.x, -this.face.y + bob);
    for (const p of this.parts) {
      const pose = partPose(p, time, { talk, eyes: still ? 'open' : eyes, energy, expr });
      const more = extra?.(p);
      const a = alpha * pose.alpha * (more?.alpha ?? 1);
      if (a <= 0.01) continue;
      ctx.save();
      ctx.globalAlpha = a;
      if (more?.dy) ctx.translate(0, more.dy);
      if (ON_HEAD.has(p.role)) {
        ctx.translate(shakeX, shakeY + expr.headDy * unit);
        if (tilt) {
          ctx.translate(this.neck.x, this.neck.y);
          ctx.rotate((tilt * Math.PI) / 180);
          ctx.translate(-this.neck.x, -this.neck.y);
        }
      }
      const angle = (pose.angle || 0) + (more?.angle || 0);
      if (angle || more?.scale) {
        ctx.translate(p.pivot.x, p.pivot.y);
        if (angle) ctx.rotate((angle * Math.PI) / 180);
        if (more?.scale) ctx.scale(more.scale, more.scale);
        ctx.translate(-p.pivot.x, -p.pivot.y);
      }
      if (pose.shape) {
        const s = pose.shape;
        ctx.translate(p.middle.x + s.dx * unit, p.middle.y + s.dy * unit);
        if (s.rot) ctx.rotate((s.rot * Math.PI) / 180);
        ctx.scale(s.sx, s.sy);
        ctx.translate(-p.middle.x, -p.middle.y);
      }
      ctx.drawImage(p.bitmap, p.box.x, p.box.y, p.box.w, p.box.h);
      ctx.restore();
    }
    ctx.restore();
  }

  // Where this draws, in screen pixels, with room for what swings out and her violet edge.
  screenBox(x, y, k, flip) {
    const left = flip ? x - (this.view.w - this.face.x) * k : x - this.face.x * k;
    const top = y - this.face.y * k;
    const w = this.view.w * k;
    const h = this.view.h * k;
    const room = Math.max(w, h) * 0.08 + 12;
    return { x: Math.floor(left - room), y: Math.floor(top - room), w: Math.ceil(w + room * 2), h: Math.ceil(h + room * 2) };
  }

  close() {
    for (const p of this.parts) p.bitmap?.close();
  }
}

// how tall each model is at her normal size, hair and all, in pixels (her faces are drawn at different angles: they can't be the measure)
const HEIGHTS = { sit: 480, perch: 480, lean: 340, 'lean-sleep': 340, 'just-head': 240 };
const FADE_HALF_LIFE = 0.07;
const EMOTION_HOLD = 3.8; // seconds an emotion stays on her face
const VOICE_FULL = 0.22;  // how loud her voice has to be for her mouth to open all the way

// Her models on their own canvas, following her body: which one she's in, how she feels, what her mouth is doing.
export class Rig {
  constructor(canvas, { base = '../../assets/capri/rig/', fetcher = (url) => fetch(url) } = {}) {
    this.canvas = canvas;
    // drawn here first, then finished in WebGL (rigfx.js) onto her canvas; with no WebGL, just copied
    this.layer = document.createElement('canvas');
    this.ctx = this.layer.getContext('2d');
    this.finish = RigFx.create(canvas);
    this.plain = this.finish ? null : canvas.getContext('2d');
    this.base = base;
    this.fetcher = fetcher;
    this.models = new Map();
    this.sources = new Map();
    this.current = null;
    this.calm = 0;
    this.last = 0;
    this.clock = 0;     // her own time: it runs faster when she's worked up, without a jump
    this.fade = 0;
    this.expr = NEUTRAL;
    this.emotion = null;
    this.emotionUntil = 0;
    this.mouth = 0;     // how open it is now, 0..1
    this.voice = 0;
    this.voiceAt = -1e9;
    this.typedUntil = 0;
    this.ready = new Map();
    this.playing = false; // her opening has the canvas
    this.resize(innerWidth, innerHeight);
  }

  resize(w, h) {
    const dpr = devicePixelRatio || 1;
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
  }

  // The drawing layer, ready for what's about to go in `box` (screen pixels). Drawing then uses screen coordinates as usual.
  begin(box) {
    const { dpr } = this;
    const w = Math.max(1, Math.round(box.w * dpr));
    const h = Math.max(1, Math.round(box.h * dpr));
    if (this.layer.width !== w || this.layer.height !== h) {
      this.layer.width = w;
      this.layer.height = h;
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, -box.x * dpr, -box.y * dpr);
    this.ctx.clearRect(box.x, box.y, box.w, box.h);
  }

  // What's on the layer, onto her canvas. looks: scale (screen pixels per pixel of her standing body), seed, boil, misreg, alpha
  present(box, looks) {
    const { dpr } = this;
    const device = { x: Math.round(box.x * dpr), y: Math.round(box.y * dpr), w: this.layer.width, h: this.layer.height };
    if (this.finish) {
      const origin = looks.origin ? [(looks.origin[0] - box.x) * dpr, (looks.origin[1] - box.y) * dpr] : [0, 0];
      this.finish.render(this.layer, device, { ...looks, scale: (looks.scale || 1) * dpr, origin });
    } else {
      this.plain.globalAlpha = looks.alpha ?? 1;
      this.plain.drawImage(this.layer, device.x, device.y);
    }
  }

  wipe() {
    if (this.finish) this.finish.clear();
    else {
      this.plain.setTransform(1, 0, 0, 1, 0, 0);
      this.plain.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  fullBox() {
    return { x: 0, y: 0, w: this.w, h: this.h };
  }

  source(name) {
    if (!this.sources.has(name)) {
      this.sources.set(name, this.fetcher(`${this.base}${name}.svg`).then((r) => {
        if (!r.ok) throw new Error(`${name}: ${r.status}`);
        return r.text();
      }));
    }
    return this.sources.get(name);
  }

  // Made at the size it'll be seen at; made again if she's resized a lot.
  async model(name, unitsToPx) {
    const have = this.models.get(name);
    if (have && (await have.catch(() => null))) {
      const m = await have;
      if (Math.abs(m.unitsToPx / unitsToPx - 1) < 0.2) return m;
    }
    const made = this.source(name).then((svg) => Model.load(name, svg, unitsToPx));
    this.models.set(name, made);
    return made;
  }

  faceK(model, scale) {
    return ((HEIGHTS[model.name] || 420) * scale) / model.view.h;
  }

  // The ones she'll need, ready ahead. (A first small one to measure it, then the size she'll be.)
  async preload(names, scale) {
    await Promise.all(names.map(async (name) => {
      const first = await this.model(name, 0.25).catch(() => null);
      if (first) this.ready.set(name, await this.model(name, this.faceK(first, scale) * this.dpr).catch(() => first));
    }));
  }

  // what she's writing, a character at a time
  talking() {
    this.typedUntil = performance.now() + 140;
  }

  // her real voice, how loud right now (tts.js); null when it stops
  setLevel(level) {
    this.voice = level == null ? 0 : clamp01(level / VOICE_FULL);
    this.voiceAt = performance.now();
  }

  setEmotion(name) {
    if (!name) return;
    this.emotion = name;
    this.emotionUntil = performance.now() + EMOTION_HOLD * 1000;
  }

  expressive(now) {
    return now < this.emotionUntil || this.mouth > 0.05;
  }

  // Every frame, from her loop. Her old body hides while a model stands in for it.
  frame(c, now) {
    if (this.playing) {
      this.shown = null;
      return;
    }
    const dt = Math.min(0.1, (now - this.last) / 1000 || 0);
    this.last = now;
    const calmNow = c.stance === 'stand' && c.mode === 'idle' && !c.busy && !c.dragging && !c.act && !c.walking && !c.hearing;
    this.calm = calmNow ? this.calm + dt : 0;

    const hearingVoice = now - this.voiceAt < 180 && this.voice > 0;
    this.mouth = damp(this.mouth, hearingVoice ? this.voice : now < this.typedUntil ? 0.45 : 0, dt, 0.035);

    const name = modelFor(c, this.calm, this.expressive(now));
    if (name !== this.current) {
      this.current = name;
      this.fade = 0;
      if (name && c.fx && !c.dormant) c.fx.sparks(c.head().x, c.head().y, { count: 8, power: 0.5 });
    }
    const asleep = name === 'lean-sleep' || name === 'just-head';
    const feeling = asleep ? expressionFor('sleepy') : now < this.emotionUntil ? expressionFor(this.emotion) : moodExpression(c.moodLabel);
    this.expr = blendToward(this.expr, feeling, dt);
    this.clock += dt * this.expr.speed;
    this.fade = damp(this.fade, 1, dt, FADE_HALF_LIFE);

    if (name && !this.models.has(name)) this.preload([name], c.scale).catch(() => {});
    // her old picture stays until the drawing is really there: she never goes missing while one loads
    const m = name ? this.ready.get(name) : null;
    if (c.root) c.root.style.visibility = m ? 'hidden' : '';
    if (c.maskCanvas) c.maskCanvas.style.opacity = m && name === 'just-head' ? '0' : '';
    this.wipe();
    this.shown = null;
    if (!m) return;
    const k = this.faceK(m, c.scale);
    const flip = c.facing < 0;
    // on something she's placed by what touches it; otherwise by her head
    const edge = this.edgeFor(c, name);
    m.contact ||= contactOf(name, m.parts, m.face);
    const at = edge && m.contact ? faceOnEdge(m.contact, m.face, edge, k, flip) : c.head();
    const box = m.screenBox(at.x, at.y, k, flip);
    this.shown = { m, x: at.x, y: at.y, k, flip, clip: edge?.clip || null };
    this.onFace?.(this.shown);
    this.begin(box);
    if (edge?.clip) {
      // behind the edge: nothing of her below it
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.rect(box.x, box.y, box.w, edge.clip - box.y);
      this.ctx.clip();
    }
    // her standing body's own numbers: how much her lines boil, her violet edge, how she fades when she sleeps
    const body = c.p || {};
    const sleeping = name === 'lean-sleep';
    m.draw(this.ctx, {
      t: this.clock,
      x: at.x,
      y: at.y,
      k,
      flip,
      alpha: this.fade,
      talk: asleep ? 0 : this.mouth,
      eyes: name === 'lean-sleep' || (c.dormant && !c.hold) ? 'closed' : 'auto',
      energy: c.energy ?? 0.5,
      still: Boolean(c.stillMotion),
      expr: this.expr,
      grounded: Boolean(edge),
    });
    if (edge?.clip) this.ctx.restore();
    const shadow = c.form === 'silhouette';
    const feelingGlitch = now < this.emotionUntil && this.emotion === 'glitch' ? 0.28 + 0.22 * smoothSquare(this.clock, 0.5, 1.5) : 0;
    this.present(box, {
      scale: c.scale,
      seed: body.seed ?? 0,
      boil: sleeping ? 0.4 : body.boil ?? 0.9,
      misreg: body.misreg || [-2.6, 2.2],
      grade: body.grade ?? 1,
      alpha: sleeping ? 0.55 : 1,
      sparkle: sleeping ? 0.35 : body.sparkle ?? 1,
      origin: [at.x, at.y + m.bobAt(this.clock, Boolean(c.stillMotion) || Boolean(edge)) * k], // so her specks stick to her
      // the same values that drive her standing body, so every effect it has, she has here
      glitch: Math.max(body.glitch || 0, feelingGlitch),
      glitchSeed: body.glitchSeed || Math.floor(now / 83),
      split: Math.max(body.split || 0, feelingGlitch * 4),
      dissolve: body.dissolve || 0,
      sil: shadow ? [0, 0, 0] : body.sil || [0, 0, 0],
      silAmount: shadow ? 1 : body.silAmount || 0,
      echo: body.echo || [0, 0],
      rim: shadow ? [1, 0.09, 0.27] : undefined,
    });
  }

  clear() {
    this.wipe();
  }

  // Is there any of the drawing she's in at this screen point?
  hit(x, y) {
    const s = this.shown;
    if (!s || (s.clip && y > s.clip)) return false;
    const across = (x - s.x) / s.k;
    return s.m.covers(s.m.face.x + (s.flip ? -across : across), s.m.face.y + (y - s.y) / s.k);
  }

  // The spot she's touching on screen, or null when nothing's holding her: { x, y, clip }
  edgeFor(c, name) {
    if (c.stance === 'sit' && c.perch && c.perch.id !== 'cursor') {
      const win = c.perchWin?.(c.perch.id);
      if (!win) return null;
      if (name === 'perch') return { x: c.perch.side === 'left' ? win.x : win.x + win.w, y: win.y + (c.perch.dy || 0) };
      const y = win.y + 3;
      return { x: win.x + Math.max(50, Math.min(win.w - 60, c.perch.dx)), y, clip: name === 'just-head' ? y : null };
    }
    if ((name === 'lean' || name === 'lean-sleep') && c.stance === 'stand' && Math.abs(c.pos.y - c.floor) < 30) return { x: c.pos.x, y: c.floor + 2 };
    return null;
  }
}

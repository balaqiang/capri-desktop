// Capri herself: where she is, how she moves, how she reacts.
// She acts with her head and her mane like in the show, and she's timed like cel animation:
// pose-to-pose acts (acting.js) drawn on twos, on ones for the action beats.
//
// Stances: floating ("stand"), perched on a window ("sit"), peeking in from a screen edge
// ("peek"), and falling ("fall") when the window under her goes away or you drop her.

import { SpriteRenderer, SPRITE } from './sprite.js';
import { ACTS, NEUTRAL, Player } from './acting.js';
import { COLORS } from './fx.js';
import { Hair } from './hair.js';
import { reach, look, mirrored, ARM_LIMITS } from './ik.js';
import { sleep, rand, pick, clamp, lerp, ease, tween, halt, reducedMotion, today } from './util.js';

const ON_TWOS = 1000 / 12;
const ON_ONES = 1000 / 24;
const ASLEEP = 1000 / 6;
const SLEEP_AFTER = 10 * 60 * 1000;
const DOZE_AFTER = 20 * 1000; // asleep this long, she comes apart down to her mask
const GRAVITY = 2600; // px/s²
const THIGH = 73;     // hip to knee, sprite px (see sprite.js)
const RIDE_GRIP = 3200; // px/s: your pointer faster than this (twice in a row) and she falls off it

const UPLINK_DAY = 'capri.uplinkDay'; // the last day she sent the red light up

// the moves her AI can ask for in an answer ([[move: …]], chat.js): acts of hers (acting.js)
export const MOVES = ['wave', 'nod', 'shrug', 'think', 'bow', 'dance', 'laugh', 'shy', 'spin', 'hop', 'curious', 'look', 'turn', 'flinch'];

const GREEN = [0.21, 1, 0.48];
const INK = [0.08, 0.06, 0.11];
const RED = [1, 0.13, 0.32];

export class Capri {
  constructor({ root, canvas, image, fx, voice }) {
    this.root = root;
    this.canvas = canvas;
    this.sprite = new SpriteRenderer(canvas, image);
    this.fx = fx;
    this.voice = voice;

    this.scale = 0.6;
    this.view = { w: innerWidth, h: innerHeight, floor: innerHeight }; // floor: the top of the taskbar
    this.pos = { x: innerWidth - 200, y: innerHeight - 6 }; // her feet
    this.facing = 1; // 1: as drawn (reaching left), -1: mirrored
    this.mode = 'idle'; // idle | work | alert | sleep
    this.stance = 'stand';
    this.perch = null;    // { id, dx }: the window she sits on, and where along it
    this.peekSide = null; // left | right | top
    this.windows = { fg: 0, wins: [] };
    this.busy = false;
    this.energy = 0.5; // her mood's energy (main/mood.js), 0 .. 1
    this.hidden = false;
    this.stowed = false;  // folded away in her biochip (Ctrl+Alt+C)
    this.dormant = false; // asleep, down to her mask
    this.hold = null;     // 'game' | 'focus' | 'quiet': kept down to her mask until you call her (holdIn)
    this.onHold = null;   // (reason | null): her hold, told to her main process (no remarks meanwhile)
    this.wander = true;
    this.possessWindows = true; // tray: "Possess my windows"
    this.restOn = 'corner'; // where she rests when nothing's going on: her corner, or 'taskbar' (her menu)
    this.nextHome = 0;
    this.dragging = false;
    this.riding = false; // perched on your cursor (from Capri Desktop 2.4): she follows it, clicks go through her
    this.walking = null; // { from, to, start, dur, done }: walking along the floor
    this.lean = 0;       // degrees, leaning into the ride
    this.moveGen = 0;    // bumped when you grab her: a move under way sees it changed and stops
    this.held = null;    // while you drag her: how she swings from your hand, and how fast you move her
    this.flight = null;  // thrown: { rot, spin }, tumbling through the air
    this.onHandled = null; // ('thrown' | 'crash' | 'dizzy'): what your hand did to her, for a word from her
    this.petting = null;   // your pointer stroking her head: { since, last, strokes, on… } (petCheck)
    this.onPet = null;     // ('start' | 'more' | 'end', n): being petted, for her face and a word
    this.jelly = { s: 0, vs: 0, t: 0, vt: 0, m: 0, vm: 0, at: 0, live: false }; // her elastic body (boing)
    this.nextTwinkle = 0;  // the glitter on her mane catching the light
    this.hoverSince = 0;   // your pointer by her face since (her other eyes open after a while)
    this.nextEyes = 0;
    this.groove = null;    // a song on (listen.js): { kind: 'listen' | 'groove', rate }, how she goes with it
    this.hearing = false;  // music on (listen.js): she's listening, so she doesn't nod off from boredom

    this.p = {
      seed: 0, boil: 0.9, hair: 0, head: 0, mane: 0, armL: 0, armR: 0, longL: 1, longR: 1, sit: 0, kickL: 0, kickR: 0,
      smear: [0, 0], echo: [0, 0],
      glitch: 0, glitchSeed: 0, split: 0, collapse: 0, dissolve: 0, sparkle: 1, grade: 1,
      sil: INK, silAmount: 0, misreg: [-2.6, 2.2], alpha: 1,
      strand: new Float32Array(10), // her mane's springs (hair.js), root to tips
    };
    this.hair = new Hair();
    this.ik = { w: 0, side: 'L', target: null, at: 0, touched: false }; // an arm reaching for something (ik.js)
    this.reachFor = null; // what she holds her arm toward ({ target, side, until, aimOnly }), her typing show's window
    this.cursorReach = { since: 0, until: 0, rest: 0 };
    this.bob = 0;
    this.tilt = 0;
    this.sx = 1;
    this.sy = 1;
    this.base = new Player('stand');
    this.act = null;
    this.lastDraw = 0;

    const now = performance.now();
    this.lastActivity = now;
    this.nextTwitch = now + rand(4000, 9000);
    this.nextMove = now + rand(40000, 80000);
    this.nextGaze = now + rand(40000, 90000);
    this.nextShed = now + rand(3000, 8000);
    this.nextNotice = 0;
    this.peekUntil = 0;
    this.lastGlyph = 0;
    this.sleptAt = 0;
    this.uplinkDue = false;
    this.pointing = null; // what she's showing you: { rect, aim, dir, side, reach, label, pointer }
    this.mouse = null; // last pointer position seen

    this.onMove = null;     // her head moved on screen
    this.onTeleport = null; // ('start' | 'end')
    this.onClick = null;
    this.onMenu = null;   // right-click on her
    this.onGaze = null;
    this.onMode = null;   // (mode, previous)
    this.onStow = null;   // she's in her biochip
    this.onUnstow = null; // she's coming out of it
    this.chipAt = null;   // () => the biochip's middle on screen
    this.onDoze = null;   // ('start', face) | 'waking' | 'end': down to her mask and back
    this.onStance = null; // (stance, perch): she sits, peeks, stands…
    this.onRide = null;   // (riding): she got on your cursor, or off it
    this.onDoubleClick = null;

    this.alphaMap = this.buildAlphaMap(image);
    this.setScale(this.scale);
    this.bindPointer();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  get busy() {
    return this._busy;
  }

  set busy(on) {
    this._busy = Boolean(on);
    this.busySince = on ? performance.now() : 0;
  }

  // Unstuck: a move that broke halfway (a window gone under her, an error) left her busy, half faded or
  // hidden, and so impossible to click or drag. Back to her plain self, where she is.
  recover() {
    console.warn('[capri] she was stuck: recovering');
    this._busy = false;
    this.busySince = 0;
    this.walking = null;
    this.endAct(false);
    if (this.stowed || this.dormant) return;
    this.hidden = false;
    this.root.hidden = false;
    Object.assign(this.p, { alpha: this.mode === 'sleep' ? 0.55 : 1, collapse: 0, dissolve: 0, glitch: 0, split: 0, silAmount: 0, sparkle: 1 });
    if (this.stance === 'fall' || this.stance === 'sit') this.setStance('stand');
    this.pos = { x: clamp(this.pos.x, 60, this.view.w - 60), y: this.floor };
    this.onTeleport?.('end');
    this.place();
  }

  // Picked up mid-move (a teleport, floating in, walking, peeking, falling): the move stops where it is, its
  // tweens and its next steps too (they see moveGen change), and she's whole in your hand.
  grab() {
    const interrupted = this._busy || Boolean(this.walking);
    this.moveGen++;
    halt(this.p);
    this._busy = false;
    this.busySince = 0;
    this.pending = null;
    this.stopWalking();
    this.endAct(false);
    this.endFlight();
    Object.assign(this.p, { alpha: this.mode === 'sleep' ? 0.55 : 1, collapse: 0, dissolve: 0, silAmount: 0, sparkle: 1 });
    Object.assign(this, { bob: 0, tilt: 0, sx: 1, sy: 1 });
    this.snatched = interrupted;
    if (interrupted) this.onTeleport?.('end'); // her panel back, whatever the move had put away
  }

  // ---------- geometry ----------

  // Her silhouette at rest, for hit tests: the cut-out plus the mirrored right arm the shader adds.
  buildAlphaMap(image) {
    const { width: w, height: h, mirror } = SPRITE;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, w, h).data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!SPRITE.armL(x, y) || mirror - x >= w) continue;
        const to = (y * w + mirror - x) * 4 + 3;
        data[to] = Math.max(data[to], data[(y * w + x) * 4 + 3]);
      }
    }
    return data;
  }

  setScale(scale) {
    this.scale = scale;
    this.sprite.resize(scale);
    this.pivot();
    this.place();
  }

  // Flip, lean and squash all pivot on her feet, or on her seat when she sits on a ledge
  // (so a squash presses her onto it instead of pulling her down through it).
  pivot() {
    const s = this.scale;
    const fx = (SPRITE.pad + SPRITE.feet.x) * s;
    const fy = (SPRITE.pad + (this.stance === 'sit' ? SPRITE.hip : SPRITE.feet.y)) * s;
    this.canvas.style.transformOrigin = `${fx}px ${fy}px`;
  }

  setView(w, h, floor = h) {
    this.view = { w, h, floor };
    if (this.stance === 'stand') {
      this.pos.x = clamp(this.pos.x, 60, w - 60);
      this.pos.y = clamp(this.pos.y, SPRITE.height * this.scale, floor - 4);
    }
    this.place();
  }

  get upside() {
    return this.stance === 'peek' && this.peekSide === 'top';
  }

  place() {
    const s = this.scale;
    const left = this.pos.x - (SPRITE.pad + SPRITE.feet.x) * s;
    const top = this.pos.y - (SPRITE.pad + SPRITE.feet.y) * s + this.bob;
    const turn = (this.upside ? 180 : 0) + this.tilt + this.lean;
    this.root.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
    this.canvas.style.transform = `rotate(${turn.toFixed(2)}deg) scale(${(this.facing * this.sx).toFixed(3)}, ${this.sy.toFixed(3)})`;
    this.onMove?.(this.head());
  }

  // her face on screen, plus `top`: the tips of her mane
  head(at = this.pos, facing = this.facing) {
    const s = this.scale;
    const bob = at === this.pos ? this.bob : 0;
    const dx = (SPRITE.head.x - SPRITE.feet.x) * s * facing;
    const dy = (SPRITE.feet.y - SPRITE.head.y) * s;
    if (at === this.pos && this.upside) {
      const y = at.y + dy + bob;
      return { x: at.x - dx, y, top: y - 30 * s };
    }
    return { x: at.x + dx, y: at.y - dy + bob, top: at.y - SPRITE.feet.y * s + bob };
  }

  // Is this screen point on her body? Uses the cut-out's alpha so empty space stays click-through.
  hit(x, y) {
    if (this.hidden || this.p.alpha < 0.5) return false;
    if (this.riding) return false; // on your cursor, she's never in the way of a click
    if (this.perch?.id === 'taskbar' && y > this.view.floor) return false; // the taskbar under her legs stays clickable
    const s = this.scale;
    const fy = this.pos.y + this.bob;
    if (this.upside) {
      x = 2 * this.pos.x - x;
      y = 2 * fy - y;
    }
    const sx = SPRITE.feet.x + ((x - this.pos.x) / s) * this.facing;
    let sy = SPRITE.feet.y - (fy - y) / s;
    if (this.p.sit > 0 && sy > SPRITE.hip) {
      // same fold as the shader: short thighs, legs ridden up
      const c = lerp(1, 0.3, this.p.sit);
      sy = sy <= SPRITE.hip + THIGH * c ? SPRITE.hip + (sy - SPRITE.hip) / c : sy + THIGH * (1 - c);
    }
    for (const [dx, dy] of [[0, 0], [4, 0], [-4, 0], [0, 4], [0, -4]]) {
      const px = Math.round(sx + dx), py = Math.round(sy + dy);
      if (px < 0 || py < 0 || px >= SPRITE.width || py >= SPRITE.height) continue;
      if (this.alphaMap[(py * SPRITE.width + px) * 4 + 3] > 40) return true;
    }
    return false;
  }

  faceCenter() {
    this.facing = this.pos.x > this.view.w / 2 ? 1 : -1;
  }

  // Which way is the middle of the screen from her, -1 or 1.
  towardCenter() {
    return this.pos.x > this.view.w / 2 ? -1 : 1;
  }

  // the reaching side of the cut-out points toward screen x
  faceToward(x) {
    this.facing = x < this.pos.x ? 1 : -1;
  }

  get floor() {
    return this.view.floor - 6;
  }

  spot(name) {
    const { w } = this.view;
    const s = this.scale;
    const side = 150 * s + 30;
    switch (name) {
      case 'post':
        return { x: w - side - 30, y: this.floor };
      case 'stage':
        return { x: w * 0.5 + rand(-w * 0.12, w * 0.12), y: this.floor };
      case 'chip': // next to her biochip, bottom left
        return { x: side + 30, y: this.floor };
      default: {
        const y = Math.random() < 0.65 ? this.floor : rand(SPRITE.height * s + 200, this.floor);
        let x = rand(side, w - side);
        if (Math.abs(x - this.pos.x) < w * 0.2) x = clamp(w - x, side, w - side);
        return { x, y };
      }
    }
  }

  // ---------- windows ----------

  setWindows(data) {
    this.windows = data;
    if (this.stance !== 'sit' || this.busy || this.dragging || this.riding) return;
    const win = this.perchWin(this.perch.id);
    const dx = win ? clamp(this.perch.dx, 50, win.w - 60) : 0;
    if (!win || !this.canSit(win) || this.covered(win, win.x + dx)) {
      this.fall(); // the ledge is gone (closed, minimized, maximized or covered)
      return;
    }
    const to = this.seat(win, dx);
    if (to.x !== this.pos.x || to.y !== this.pos.y) {
      this.pos = to; // ride along with the window
      this.place();
    }
  }

  // Where her feet go so that her hips rest on the window's top edge.
  seat(win, dx) {
    return { x: win.x + dx, y: win.y + 3 + (SPRITE.feet.y - SPRITE.hip) * this.scale };
  }

  canSit(win) {
    if (win.id === 'taskbar') return true;
    const roomAbove = SPRITE.hip * this.scale + 12;
    return !win.max && win.w > 260 && win.y > roomAbove && win.y < this.view.floor - 80;
  }

  // Is her spot on that ledge hidden under a window that's above it?
  covered(win, x) {
    if (win.id === 'taskbar') return false; // nothing goes over the taskbar
    const half = 34 * this.scale;
    const { wins } = this.windows;
    for (const o of wins) {
      if (o === win || o.id === win.id) return false; // reached it: everything after is below
      if (o.x < x + half && o.x + o.w > x - half && o.y <= win.y && o.y + o.h >= win.y) return true;
    }
    return false; // window not in the list any more
  }

  // A window she could sit on, the one in front first. Returns { win, dx } or null.
  // The top of the taskbar (the bottom of her screen), as a ledge to sit on like a window's: her
  // legs hang down behind it.
  ledge() {
    return { id: 'taskbar', x: 0, y: this.view.floor, w: this.view.w, h: this.view.h - this.view.floor, max: false };
  }

  // What she's perched on, from its id: a window, or the taskbar.
  perchWin(id) {
    return id === 'taskbar' ? this.ledge() : this.windows.wins.find((w) => w.id === id);
  }

  // Back to where she rests: her corner, or sitting on the taskbar below it.
  goHome() {
    const post = this.spot('post');
    if (this.restOn !== 'taskbar') return this.teleport(post);
    if (this.stance === 'sit' && this.perch?.id === 'taskbar') return Promise.resolve();
    // left of the clock and the tray icons, right of the middle (the app icons, on Windows 11)
    return this.sitOn({ win: this.ledge(), dx: clamp(this.view.w - 440, this.view.w * 0.6, post.x) });
  }

  pickSeat({ frontOnly = false, except = null } = {}) {
    const options = [];
    for (const win of this.windows.wins) {
      if (win.id === except || !this.canSit(win)) continue;
      const dx = clamp(rand(win.w * 0.18, win.w * 0.6), 60, Math.max(60, win.w - 190));
      if (this.covered(win, win.x + dx)) continue;
      options.push({ win, dx });
    }
    const front = options.find((o) => o.win.id === this.windows.fg);
    if (frontOnly) return front || null;
    return front || options[0] || null;
  }

  // ---------- frame loop ----------

  interval() {
    if (this.busy || this.walking || this.stance === 'fall' || this.act?.player.act.fps === 24 || this.jelly.live || this.hair.live || this.ik.w > 0.01) return ON_ONES;
    return this.mode === 'sleep' ? ASLEEP : ON_TWOS;
  }

  loop(now) {
    requestAnimationFrame(this.loop);
    if (this._busy && now - this.busySince > 20000) this.recover();
    if (this.hidden) return;
    if (this.petting) this.petEnd(now);
    if (now - this.lastDraw < this.interval() - 1) return;
    this.drawFrame(now);
    this.behave(now);
  }

  drawFrame(now = performance.now()) {
    this.lastDraw = now;
    this.animate(now);
    this.sprite.draw(this.p);
    this.place();
  }

  // Pick the drawing: the stance's cycle underneath, the current act on top.
  animate(now) {
    const p = this.p;
    p.seed = Math.random() * 100; // a fresh drawing, so the line boils

    const under = this.base.sample(now);
    const base = under ? this.base.resolve(under.pose, this.facing) : {};
    let act = null;
    let cue = null;
    if (under && under.index !== this.baseIndex) {
      this.baseIndex = under.index;
      if (!this.act) cue = under.cue; // the stance's own cues, when no act is on top
    }
    if (this.act) {
      const drawing = this.act.player.sample(now);
      if (drawing) {
        act = this.act.player.resolve(drawing.pose, this.facing);
        if (drawing.index !== this.act.index) {
          this.act.index = drawing.index;
          cue = drawing.cue;
        }
      } else {
        this.endAct(true);
      }
    }
    const pose = { ...NEUTRAL, ...base, ...act };
    if (this.mode === 'sleep' && this.stance === 'sit' && !act) {
      Object.assign(pose, { head: 0.12, mane: -0.1, kickL: 0.03, kickR: 0.03, armL: -0.45, armR: -0.45 }); // dozing on the ledge
    }

    p.head = pose.head;
    p.mane = pose.mane;
    p.hair = pose.hair;
    p.armL = pose.armL;
    p.armR = pose.armR;
    p.longL = pose.longL;
    p.longR = pose.longR;
    p.kickL = pose.kickL;
    p.kickR = pose.kickR;
    p.smear = pose.smear;
    p.echo = pose.echo;
    // on a ledge she stays seated: no lifting off it, no sinking through it
    const bob = this.stance === 'sit' ? clamp(pose.bob, -3, 2) : pose.bob;
    if (this.dragging && this.held) {
      this.dangle(now);
    } else {
      this.bob = bob;
      this.tilt = pose.tilt;
      this.sx = pose.sx;
      this.sy = pose.sy;
    }
    if (this.flight) {
      // tumbling: turned by the spin, her afterimages trailing opposite her speed
      this.tilt = (this.flight.rot * 180) / Math.PI;
      p.echo = [clamp(-this.vx * 0.012, -26, 26), clamp(-this.vy * 0.012, -26, 26)];
    } else if (!this.dragging) {
      this.follow(now);
    }
    if (this.walking) this.walkFrame(now);
    this.jellyStep(now);
    this.ikStep(now);
    this.hairStep(now);
    if (this.debug) Object.assign(p, this.debug); // --dev pose overrides
    if (cue) this.onCue(cue);
  }

  behave(now) {
    if (this.stance === 'fall') {
      this.updateFall(now);
      return;
    }
    // the glitter on her mane catching the light, now and then (fewer while she sleeps)
    if (now > this.nextTwinkle) {
      this.nextTwinkle = now + rand(1500, 3500) * (this.mode === 'sleep' ? 3 : 1);
      if (!reducedMotion.matches && !this.hidden && !this.stowed && this.stance !== 'peek') {
        const [pt] = this.manePoints(1);
        this.fx.twinkle(pt.x, pt.y, { size: rand(5, 10) * Math.max(0.7, this.scale + 0.2), color: pick([COLORS.paper, COLORS.paper, COLORS.green]) });
      }
    }
    // your pointer lingering by her face: her other eyes open around her mane to look at it
    const m = this.mouse;
    if (m && this.stance === 'stand' && this.mode === 'idle' && !this.act && !this.busy && !this.dragging && !this.petting?.on) {
      const h = this.head();
      if (Math.hypot(m.x - h.x, m.y - h.y) > 200 * this.scale + 60) this.hoverSince = 0;
      else if (!this.hoverSince) this.hoverSince = now;
      else if (now - this.hoverSince > 2600 && now > this.nextEyes) {
        this.nextEyes = now + rand(25000, 45000);
        this.hoverSince = 0;
        this.manyEyes();
      }
    }
    if (this.walking) return; // one thing at a time
    if (this.busy || this.dragging) return;

    if (now > this.nextTwitch) {
      this.nextTwitch = now + rand(5000, 13000);
      if (!reducedMotion.matches && this.mode !== 'sleep') this.twitch();
    }

    // a shard of her mane breaks off now and then and drifts away
    if (now > this.nextShed) {
      this.nextShed = now + rand(4000, 11000) * (this.mode === 'sleep' ? 2.5 : 1);
      if (!reducedMotion.matches && this.stance !== 'peek') this.shed();
    }

    // on your cursor, she just rides: no wandering, peeking, napping or stargazing
    if (this.riding) {
      this.lastActivity = now;
      return;
    }

    if (this.mode === 'idle' && this.stance !== 'peek' && now > this.nextGaze) {
      this.nextGaze = now + rand(90000, 180000);
      this.gaze();
    }

    // bored, nothing going on for a while: a big yawn, and she nods off (never while music plays: she's listening,
    // and her lyrics would go)
    if (this.mode === 'idle' && !this.hearing && !this.act && now - this.lastActivity > SLEEP_AFTER * (0.5 + this.energy)) {
      this.perform('yawn', this.towardCenter());
      this.setMode('sleep');
    }
    if (this.mode === 'sleep' && now - this.sleptAt > DOZE_AFTER) {
      this.doze();
      return;
    }

    if (this.stance === 'peek' && now > this.peekUntil) {
      this.unpeek();
      return;
    }

    // resting on the taskbar: a little while after anything happens, she goes back to sit on it
    if (this.restOn === 'taskbar' && this.mode === 'idle' && this.stance === 'stand'
      && now - this.lastActivity > 6000 && now > this.nextHome) {
      this.nextHome = now + 8000;
      this.goHome();
      return;
    }

    if (this.mode === 'idle' && now > this.nextMove) {
      this.nextMove = now + rand(25000, 70000) * (1.5 - this.energy); // the more energy she has, the less she stays put
      this.wanderStep();
    }

    if (this.mode === 'work' && now - this.lastGlyph > 420) {
      this.lastGlyph = now;
      const h = this.head();
      this.fx.glyph(h.x, h.y - 30);
    }
  }

  // What she does with herself when nobody needs her.
  wanderStep() {
    if (!this.wander || this.stance === 'peek') {
      if (this.stance !== 'peek') this.flourish();
      return;
    }
    if (this.stance === 'sit' && this.perch?.id === 'taskbar') {
      // nothing to hop off or take over down there: a flourish, or off for a bit (she comes back)
      if (Math.random() < 0.6) this.flourish();
      else this.teleport(this.spot('random'));
      return;
    }
    if (this.stance === 'sit') {
      const r = Math.random();
      if (r < 0.3) this.flourish();
      else if (r < 0.5 && this.canPossess()) this.possess();
      else if (r < 0.75) this.fall(); // just hops off the ledge
      else this.teleport(this.spot('random'));
      return;
    }
    const seat = this.pickSeat();
    const r = Math.random();
    const onFloor = Math.abs(this.pos.y - this.floor) < 30;
    if (onFloor && r < 0.35) this.walkTo(this.spot('random').x, { speed: rand(140, 240) });
    else if (seat && r < 0.55) this.sitOn(seat);
    else if (r < 0.7) this.peek();
    else if (r < 0.88) this.teleport(this.spot('random'));
    else this.flourish();
  }

  flourish() {
    if (this.stance === 'sit') this.perform(pick(['look', 'look', 'split']));
    else this.perform(pick(['spin', 'look', 'hop', 'curious', 'split']), this.towardCenter());
  }

  // ---------- acting ----------

  // Play an act from acting.js. Resolves when it's over (or cut off by a stronger one).
  perform(name, dir = 0, { reach = 1, amp = 1 } = {}) {
    if (this.stowed || this.dormant) return Promise.resolve(); // nobody to act: she's in her biochip, or just her mask
    const act = ACTS[name];
    if (reducedMotion.matches && act.fps === 24) {
      if (act.flip) this.facing *= -1;
      return Promise.resolve();
    }
    const next = new Player(name, { dir, reach, amp });
    if (this.act && this.act.player.priority > next.priority) return Promise.resolve();
    this.endAct(false);
    return new Promise((done) => {
      this.act = { player: next, done };
    });
  }

  endAct(completed) {
    const current = this.act;
    if (!current) return;
    this.act = null;
    if (completed && current.player.act.flip) this.facing *= -1;
    current.done();
  }

  setStance(stance, { perch = null, peekSide = null, dir = 0 } = {}) {
    // anything else she's made to do gets her off your cursor
    if (this.riding && !(stance === 'sit' && perch?.id === 'cursor')) {
      this.riding = false;
      this.lean = 0;
      this.onRide?.(false);
    }
    const changed = stance !== this.stance || perch?.id !== this.perch?.id;
    this.stance = stance;
    this.perch = perch;
    this.peekSide = peekSide;
    this.p.sit = stance === 'sit' ? 1 : 0;
    this.base = this.restBase(dir);
    this.pivot();
    if (changed) this.onStance?.(stance, perch);
  }

  // ---------- walking ----------

  // She walks along the floor to x (or toward it, so far): a glide with her legs swinging, a bob on each
  // step, leaning into it, shards trailing. Resolves when she's there (or was stopped: false).
  walkTo(x, { speed = 230 } = {}) {
    if (this.stowed || this.dormant || this.busy || this.riding || this.stance === 'fall') return Promise.resolve(false);
    this.walking?.done(false);
    if (this.stance !== 'stand') this.setStance('stand');
    this.endAct(false);
    this.wake();
    const s = this.scale;
    const side = 60 * s + 20;
    const to = { x: clamp(x, side, this.view.w - side), y: this.floor };
    const from = { ...this.pos };
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    if (dist < 8) return Promise.resolve(true);
    this.facing = to.x < from.x ? 1 : -1; // drawn reaching left: facing 1 walks left
    const dur = reducedMotion.matches ? 0 : (dist / speed) * 1000;
    return new Promise((done) => {
      this.walking = { from, to, start: performance.now(), dur, done: (ok) => { this.walking = null; done(ok); }, lastShard: 0 };
      if (!dur) this.walkFrame(performance.now() + 1);
    });
  }

  walkFrame(now) {
    const w = this.walking;
    const k = w.dur ? clamp((now - w.start) / w.dur, 0, 1) : 1;
    const e = ease.inOut(k);
    this.pos = { x: lerp(w.from.x, w.to.x, e), y: lerp(w.from.y, w.to.y, e) };
    const phase = ((now - w.start) / 1000) * Math.PI * 3.2; // about 1.6 steps a second
    const stride = Math.sin(phase) * 0.42 * Math.min(1, k * 6, (1 - k) * 6 + 0.15);
    this.p.kickL = stride;
    this.p.kickR = -stride;
    this.bob = -Math.abs(Math.sin(phase)) * 7 * this.scale;
    this.tilt = -this.facing * 4;
    this.sx = 1 + Math.abs(Math.cos(phase)) * 0.025;
    this.sy = 1 - Math.abs(Math.cos(phase)) * 0.025;
    if (now - w.lastShard > 260 && !reducedMotion.matches) {
      w.lastShard = now;
      this.shed();
    }
    this.lastActivity = now;
    if (k >= 1) {
      Object.assign(this.p, { kickL: 0, kickR: 0 });
      this.bob = 0;
      this.tilt = 0;
      this.sx = this.sy = 1;
      w.done(true);
    }
  }

  stopWalking() {
    this.walking?.done(false);
  }

  // Where you tell her to be ("ke kanan", "move left", "ke tengah"…): she walks there along the floor, or,
  // from far up or when it's far, teleports.
  async goTo(where) {
    if (this.stowed) await this.unstow();
    if (this.dormant) this.wake();
    if (this.riding) this.setStance('stand');
    const { w } = this.view;
    const s = this.scale;
    const side = 150 * s + 30;
    const x = where === 'left' ? side : where === 'right' ? w - side : where === 'center' ? w / 2 : this.pos.x;
    this.nextMove = performance.now() + 120000; // stay there a while
    if (this.stance === 'peek') await this.unpeek();
    if (Math.abs(this.pos.y - this.floor) > 30 || this.stance === 'sit') {
      await this.teleport({ x, y: this.floor });
      return;
    }
    if (Math.abs(x - this.pos.x) > w * 0.6) await this.teleport({ x, y: this.floor });
    else await this.walkTo(x);
  }

  // ---------- perched on your cursor (Capri Desktop 2.4's "Perch on cursor") ----------

  // Double-click her, or her menu: she sits on your pointer and rides along. Ctrl+Alt+C, or her menu, to hop off.
  startRide() {
    if (this.riding || this.stowed || this.busy || this.dormant || this.stance === 'fall') return false;
    this.wake();
    this.endAct(false);
    this.stopPointing?.();
    this.setStance('sit', { perch: { id: 'cursor', dx: 0 } });
    this.riding = true;
    this.lean = 0;
    this.rideLast = null; // her grip on your pointer (rideTo): a fresh start
    this.rideFast = 0;
    this.perform('plop');
    this.voice.play('land');
    this.onRide?.(true);
    return true;
  }

  // Off your cursor because it went too fast: thrown the way it was going, a little less hard.
  shakeOff(vx, vy) {
    if (!this.riding) return;
    this.setStance('stand'); // clears the ride
    this.rideLast = null;
    this.rideFast = 0;
    if (reducedMotion.matches) {
      this.fall();
    } else {
      this.fling(clamp(vx * 0.55, -2200, 2200), clamp(vy * 0.55 - 250, -1800, 1600));
    }
    this.onHandled?.('shaken');
  }

  stopRide() {
    if (!this.riding) return;
    this.setStance('stand'); // clears the ride
    if (this.pos.y < this.floor - 2) this.fall();
    else this.perform('land');
  }

  // Where your pointer is now: she follows it, a little behind, leaning into it.
  rideTo(x, y) {
    if (!this.riding || this.busy || this.dragging) return;
    // your pointer jerked away too fast: she loses her grip and falls off, tumbling with its speed
    const now = performance.now();
    const last = this.rideLast;
    this.rideLast = { x, y, t: now };
    if (last && now - last.t < 120) {
      const dt = Math.max(16, now - last.t) / 1000;
      const vx = (x - last.x) / dt;
      const vy = (y - last.y) / dt;
      const speed = Math.hypot(vx, vy);
      this.rideFast = speed > RIDE_GRIP ? (this.rideFast || 0) + 1 : 0;
      if (this.rideFast >= 2 || speed > RIDE_GRIP * 3) {
        this.shakeOff(vx, vy);
        return;
      }
    }
    const s = this.scale;
    const to = this.seat({ x: x + 8, y: y + 14 }, 0); // her hips on the arrow, just under its tip
    to.x = clamp(to.x, 30, this.view.w - 30);
    to.y = clamp(to.y, SPRITE.height * s * 0.55, this.view.h + (SPRITE.feet.y - SPRITE.hip) * s);
    const nx = this.pos.x + (to.x - this.pos.x) * 0.35;
    const ny = this.pos.y + (to.y - this.pos.y) * 0.35;
    const velocity = clamp((nx - this.pos.x) * 0.4, -8, 8);
    this.lean = this.lean * 0.8 + velocity * 0.2;
    if (Math.abs(nx - this.pos.x) > 0.2 || Math.abs(ny - this.pos.y) > 0.2 || Math.abs(this.lean) > 0.05) {
      this.facing = to.x - this.pos.x > 2 ? -1 : to.x - this.pos.x < -2 ? 1 : this.facing;
      this.pos = { x: nx, y: ny };
      this.lastActivity = performance.now();
      this.place();
    }
  }

  // The cycle under her acts: her stance's, or holding her arm out at what she's showing you.
  restBase(dir = 0) {
    const pt = this.pointing;
    if (pt && (this.stance === 'stand' || this.stance === 'sit')) return new Player('pointing', { dir: pt.dir, reach: pt.reach });
    const name = this.baseAct();
    return new Player(name, { dir, rate: name === 'listen' || name === 'groove' || name === 'listenSit' ? this.groove.rate : 1 });
  }

  baseAct() {
    const music = this.groove && this.mode !== 'sleep';
    if (this.stance === 'sit') return music ? 'listenSit' : 'sit';
    if (this.stance === 'peek') return 'peek';
    if (this.stance === 'fall') return 'fall';
    if (this.mode === 'sleep') return 'sleep';
    return music ? this.groove.kind : 'stand';
  }

  // A song on (listen.js): she goes with it at its pace ({ kind: 'listen' | 'groove', rate }), or not (null).
  setGroove(groove) {
    const same = (groove?.kind || '') === (this.groove?.kind || '') && (groove?.rate || 0) === (this.groove?.rate || 0);
    this.groove = groove;
    if (!same && (this.stance === 'stand' || this.stance === 'sit')) this.base = this.restBase();
  }

  setMode(mode) {
    const now = performance.now();
    if (mode !== 'sleep') this.lastActivity = now;
    // after anything happens, stay put a while (so she doesn't wander off right after "done")
    this.nextMove = Math.max(this.nextMove, now + rand(55000, 120000));
    this.nextGaze = Math.max(this.nextGaze, now + rand(30000, 70000));
    if (this.mode === mode) return;
    const prev = this.mode;
    this.mode = mode;
    if (mode === 'sleep') this.sleptAt = now;
    this.onMode?.(mode, prev);
    if (this.stance === 'stand' || this.stance === 'sit') this.base = this.restBase();
    const p = this.p;
    if (mode === 'sleep') tween(p, { alpha: 0.55, sparkle: 0.35, boil: 0.4 }, 900, ease.inOut);
    else tween(p, { alpha: 1, sparkle: 1, boil: 0.9 }, 250, ease.out);
    // asleep: Z's rising off her until she wakes (or comes apart down to her mask)
    if (mode === 'sleep' && !reducedMotion.matches) {
      this.fx.zzz(() => (this.mode === 'sleep' && !this.hidden && !this.dormant && !this.stowed ? { ...this.head(), dir: this.towardCenter() } : null));
    }
  }

  // release: you called her (a click on her mask, a command, a hotkey, her chat): it ends a hold too. Without it
  // (your pointer passing, a song starting, your coding AI), a held mask stays a mask.
  wake({ release = false } = {}) {
    if (this.hold && !release) return;
    if (this.hold) this.setHold(null);
    if (this.mode === 'sleep') this.setMode('idle');
    this.lastActivity = performance.now();
    if (this.dormant) this.rouse(); // down to her mask: she comes back
  }

  setHold(reason) {
    this.hold = reason || null;
    this.onHold?.(this.hold);
  }

  // Down to her mask and staying there (game mode, focus, quiet mode): no walking, no remarks, nothing wakes her by
  // itself; a click on her mask, a command of yours, or "normal mode" brings her back.
  // Out of your way before she comes apart (game mode): a teleport to that side of the screen, whatever she was
  // doing. Her hold stays on all the way, a mask she already was comes back whole for the trip.
  async stepAside(where) {
    const reason = this.hold;
    if (this.stowed) return;
    if (this.dormant) {
      const back = this.rouse(); // clears her hold as it starts...
      this.setHold(reason);      // ...this isn't her being called back
      await back;
    }
    for (let i = 0; i < 30 && this.busy; i++) await sleep(150);
    if (this.hold !== reason) return; // called back meanwhile
    if (this.riding) this.setStance('stand');
    if (this.stance === 'peek') await this.unpeek();
    const side = 150 * this.scale + 30;
    const x = where === 'right' ? this.view.w - side : side;
    this.nextMove = performance.now() + 120000;
    if (Math.abs(x - this.pos.x) > 24 || Math.abs(this.pos.y - this.floor) > 30 || this.stance === 'sit') {
      await this.teleport({ x, y: this.floor });
    }
  }

  async holdIn(reason) {
    this.setHold(reason);
    if (this.stowed || this.dormant) return;
    for (let i = 0; i < 30 && this.busy; i++) await sleep(150);
    if (this.hold !== reason || this.dormant) return; // called back meanwhile
    this.endAct(false);
    this.setMode('sleep');
    await this.doze();
  }

  release() {
    if (this.hold || this.dormant) this.wake({ release: true });
  }

  // Somewhere to be while Claude works: on the window in front if she can sit on it, else her corner.
  goToWork() {
    this.setMode('work');
    const seat = this.pickSeat({ frontOnly: true });
    if (seat) {
      if (this.stance === 'sit' && this.perch?.id === seat.win.id) return;
      this.sitOn(seat);
      return;
    }
    if (this.restOn === 'taskbar') {
      this.goHome();
      return;
    }
    const post = this.spot('post');
    if (this.stance !== 'stand' || Math.hypot(post.x - this.pos.x, post.y - this.pos.y) > 320) this.teleport(post);
  }

  // Claude did something: come out of hiding.
  attend() {
    this.wake();
    if (this.stance === 'peek' && !this.busy) this.teleport(this.spot('post'));
  }

  twitch() {
    const p = this.p;
    p.glitchSeed = Math.random() * 100;
    p.glitch = rand(0.15, 0.3);
    p.split = 2;
    setTimeout(() => {
      p.glitch = 0;
      p.split = 0;
    }, ON_TWOS * 2);
  }

  // a small jolt each time Claude touches something
  pulse() {
    if (this.busy || reducedMotion.matches) return;
    const p = this.p;
    p.glitchSeed = Math.random() * 100;
    p.glitch = 0.12;
    setTimeout(() => { p.glitch = 0; }, ON_TWOS);
  }

  shed() {
    const s = this.scale;
    const h = this.head();
    const a = rand(-Math.PI * 0.95, -Math.PI * 0.05); // somewhere on the upper rim of the mane
    const r = rand(70, 100) * s;
    this.fx.drift(h.x + Math.cos(a) * r, h.y - 40 * s + Math.sin(a) * r * 0.85, a);
  }

  // A point of the sprite (sprite px) on screen, where she stands, the way she faces.
  toScreen(sx, sy) {
    const s = this.scale;
    return {
      x: this.pos.x + (sx - SPRITE.feet.x) * s * this.facing,
      y: this.pos.y - (SPRITE.feet.y - sy) * s + this.bob,
    };
  }

  // A point on screen in her drawing's pixels (toScreen the other way round).
  toSprite(pt) {
    const s = this.scale;
    return { x: SPRITE.feet.x + (pt.x - this.pos.x) / (s * this.facing), y: SPRITE.feet.y - (this.pos.y + this.bob - pt.y) / s };
  }

  // Which arm points to screen side `dir`: 'L' or 'R' (the sprite may be mirrored).
  armToward(dir) {
    return dir * this.facing < 0 ? 'L' : 'R';
  }

  // Shoulder and hand of one arm on screen, at the arm's current angle (same turn as the shader).
  limb(side) {
    const { shoulder, hand, mirror } = SPRITE;
    const a = side === 'L' ? this.p.armL : this.p.armR;
    const k = side === 'L' ? this.p.longL : this.p.longR;
    const vx = (hand.x - shoulder.x) * k, vy = (hand.y - shoulder.y) * k;
    let hx = shoulder.x + Math.cos(a) * vx - Math.sin(a) * vy;
    const hy = shoulder.y + Math.sin(a) * vx + Math.cos(a) * vy;
    let sx = shoulder.x;
    if (side === 'R') {
      hx = mirror - hx;
      sx = mirror - sx;
    }
    return { shoulder: this.toScreen(sx, shoulder.y), hand: this.toScreen(hx, hy) };
  }

  // The satellite. It crosses high over the open side of the screen, slowly, and her hand
  // follows it. Mostly she just looks at it ("gaze"). She sends the red light up to it
  // ("uplink") only when it means something: the first time of the day, and a little while
  // after Claude finishes a long job (earnUplink). The cues in onCue do the sky.
  gaze({ big } = {}) {
    if (this.busy || this.hidden || this.act || this.stance === 'peek' || this.stance === 'fall') return false;
    big ??= this.uplinkDue || this.lastUplinkDay() !== today();
    if (reducedMotion.matches) big = false; // no strobing bolt
    if (big) {
      this.uplinkDue = false;
      try {
        localStorage.setItem(UPLINK_DAY, today());
      } catch {
        // no storage: she'll just do it again next launch
      }
    }
    const dir = this.towardCenter();
    const { w } = this.view;
    const side = this.armToward(dir);
    const { shoulder } = this.limb(side);
    // up and well off to the side, so her arm points at it clear of her mane
    const y = clamp(shoulder.y - rand(280, 400), 50, shoulder.y - 180);
    const x = clamp(shoulder.x + dir * rand(380, 520), 40, w - 40);
    const to = { x: clamp(x + dir * rand(170, 260), 30, w - 30), y: y - rand(10, 40) };
    const sat = this.fx.satellite({ x, y }, to, { duration: 9500 });
    // how far up the arm must come to point at it right now (it hangs ~30 degrees low at rest)
    const reach = () => {
      const at = sat.pos();
      const sh = this.limb(side).shoulder;
      return clamp(Math.atan2(sh.y - at.y, Math.abs(at.x - sh.x)) + 0.52, 0.5, 1.6);
    };
    // from her fingertips to it
    const road = () => [this.limb(side).hand, sat.pos()];
    this.sky = { sat, road, dir, side, motes: null, surge: null, head: null };
    if (!big) this.onGaze?.('start');
    this.perform(big ? 'uplink' : 'gaze', dir, { reach }).then(() => {
      this.clearSky();
      if (big) this.onGaze?.('end');
    });
    return true;
  }

  lastUplinkDay() {
    try {
      return localStorage.getItem(UPLINK_DAY);
    } catch {
      return null;
    }
  }

  // Claude just finished a long job: the next time she looks up, once things have settled, it's the whole thing.
  earnUplink() {
    this.uplinkDue = true;
    this.nextGaze = performance.now() + rand(25000, 40000);
  }

  clearSky() {
    if (!this.sky) return;
    const { sat, motes, surge } = this.sky;
    surge?.break();
    motes?.home(...this.moved());
    sat.fade();
    this.sky = null;
    tween(this.p, { sparkle: this.mode === 'sleep' ? 0.35 : 1 }, 400, ease.out);
  }

  // How far her head has moved since her stars lifted off it.
  moved() {
    const was = this.sky?.head;
    if (!was) return [0, 0];
    const h = this.head();
    return [h.x - was.x, h.y - was.y];
  }

  // Points on her mane, where her white specks are (for the stars that lift off it).
  manePoints(n) {
    const s = this.scale;
    const h = this.head();
    return Array.from({ length: n }, () => {
      const a = rand(0, Math.PI * 2), r = Math.sqrt(Math.random());
      return { x: h.x + Math.cos(a) * r * 92 * s, y: h.y - 44 * s + Math.sin(a) * r * 66 * s };
    });
  }

  // Red sparks off her fingers: she's hacking something. On a window, she jacks into it:
  // the sparks go down into the ledge and run along it.
  spark() {
    if (this.busy || this.hidden || reducedMotion.matches || this.stance === 'peek' || this.stance === 'fall') return;
    const s = this.scale;
    const side = Math.random() < 0.5 ? 'L' : 'R';
    const { hand } = this.limb(side);
    const out = (side === 'L' ? -1 : 1) * this.facing;
    if (this.stance === 'sit') {
      const ledge = this.pos.y - (SPRITE.feet.y - SPRITE.hip) * s - 3;
      const at = { x: hand.x + out * rand(10, 40) * s, y: ledge };
      const run = { x: at.x + out * rand(90, 200), y: ledge + rand(-2, 2) };
      this.fx.bolt(hand, at, { life: 200, forks: 1, width: 2 });
      this.fx.bolt(at, run, { life: 260, forks: 2, width: 2 });
    } else {
      for (let i = 0; i < 2; i++) {
        const to = { x: hand.x + out * rand(30, 80) * s, y: hand.y + rand(-50, 30) * s };
        this.fx.bolt(hand, to, { life: rand(140, 220), forks: 1, width: 2 });
      }
    }
    this.voice.play('bolt', { soft: true });
  }

  // The menace: a jolt of red lightning at your pointer, and a grin.
  zap(x, y) {
    if (this.busy || this.hidden || this.act || reducedMotion.matches || this.stance !== 'stand') return false;
    const dir = x < this.pos.x ? -1 : 1;
    const side = this.armToward(dir);
    const reach = () => {
      const sh = this.limb(side).shoulder;
      return clamp(Math.atan2(sh.y - y, Math.abs(x - sh.x)) + 0.52, -0.3, 1.6);
    };
    this.zapAt = { x, y, side, dir };
    this.perform('zap', dir, { reach });
    return true;
  }

  // Where a cut-in goes, as fx.cutin's (x, y, dir): next to her head on the `dir` side, else on
  // the other side (unless `flip` is off because something is going on there), else over her mane.
  cutinAt(dir, { flip = true } = {}) {
    const s = this.scale;
    const h = this.head();
    const gap = 85 * s + 24, width = 274; // the band plus its slant, see fx.js
    const fits = (d) => (d > 0 ? h.x + gap + width < this.view.w - 8 : h.x - gap - width > 8);
    if (fits(dir)) return [h.x + dir * gap, h.y - 18, dir];
    if (flip && fits(-dir)) return [h.x - dir * gap, h.y - 18, -dir];
    return [clamp(h.x - width / 2, 8, this.view.w - width - 8), Math.max(56, h.top - 58), 1];
  }

  // Flat-colour impact frames, one drawing each.
  async flash(colors) {
    const p = this.p;
    for (const color of colors) {
      p.sil = color;
      p.silAmount = 1;
      this.drawFrame();
      await sleep(ON_ONES);
    }
    p.silAmount = 0;
  }

  // Effects and sounds pinned to drawings of an act (the third item of a key in acting.js).
  onCue(cue) {
    const s = this.scale;
    const h = this.head();
    const mane = { x: h.x, y: h.y - 40 * s };
    switch (cue) {
      case 'gather': // shards sucked into the mane before it blows
        this.fx.burst(mane.x, mane.y, { count: 18, inward: true, power: 0.7, spread: 170 * s });
        break;
      case 'launch':
        this.voice.play('rise');
        this.fx.slices(h.x - 70 * s, h.y - 40 * s, 170 * s, 300 * s, { count: 5 });
        break;
      case 'peak':
        this.voice.play('done');
        this.fx.lines(mane.x, mane.y, { inner: 150 * s + 30 });
        this.fx.ring(mane.x, mane.y);
        this.fx.burst(mane.x, mane.y, { count: 34, power: 1.2, spread: 140 * s });
        setTimeout(() => this.flash([GREEN, INK, GREEN]), 0);
        break;
      case 'speak':
        this.fireSpeak();
        break;
      case 'laugh':
        this.fx.cutin(...this.cutinAt(this.act?.player.dir || this.towardCenter()), { kind: pick(['laugh', 'grin']) });
        break;
      case 'stare': // every eye she has, on you
        this.fx.cutin(...this.cutinAt(this.act?.player.dir || this.towardCenter()), { kind: 'many', life: 640 });
        break;
      case 'notice':
        this.twitch();
        break;
      case 'zap':
        if (this.zapAt) {
          const { x, y, side } = this.zapAt;
          this.fx.bolt(this.limb(side).hand, { x, y }, { life: 240, forks: 2, width: 3 });
          this.fx.burst(x, y, { count: 8, power: 0.35, spread: 16 });
          this.fx.ring(x, y, { size: 0.22 });
          this.voice.play('bolt');
        }
        break;
      case 'grin':
        if (this.zapAt && Math.random() < 0.6) this.fx.cutin(...this.cutinAt(-this.zapAt.dir), { kind: 'look', life: 560 });
        this.zapAt = null;
        break;
      // pointing at something (pointAt)
      case 'spot': // her head snaps to it: a glint where she's looking
        if (this.pointing) {
          const { aim } = this.pointing;
          this.fx.ring(aim.x, aim.y, { size: 0.18 });
          this.voice.play('tick');
        }
        break;
      case 'coil': // winding up: shards pulled into her, a crackle
        this.fx.burst(h.x, h.y + 40 * s, { count: 10, inward: true, power: 0.45, spread: 90 * s });
        this.voice.play('bolt', { soft: true });
        break;
      case 'lock': { // the strike: lightning off her fingertip, the reticle slams onto it
        const pt = this.pointing;
        if (pt && !pt.pointer) {
          const hand = this.limb(pt.side).hand;
          pt.pointer = this.fx.pointer(() => this.limb(pt.side).hand, pt.rect, pt.aim, { label: pt.label });
          if (!reducedMotion.matches) {
            this.fx.bolt(hand, pt.aim, { life: 260, forks: 3, width: 3 });
            this.fx.ring(pt.aim.x, pt.aim.y, { size: 0.55 });
            this.fx.burst(pt.aim.x, pt.aim.y, { count: 12, power: 0.5, spread: 20 });
            // her eyes lock on, on the side away from it
            this.fx.cutin(...this.cutinAt(-pt.dir, { flip: false }), { kind: 'eyes', life: 480 });
          }
          this.voice.play('bolt');
        }
        break;
      }
      case 'tap':
        this.pointing?.pointer?.tap();
        break;
      case 'minds':
        this.twitch();
        break;
      case 'snap':
        this.twitch();
        this.voice.play('tick');
        break;
      default:
        if (this.sky) this.skyCue(cue);
        break;
    }
  }

  // The satellite's cues (acting.js "gaze" and "uplink").
  skyCue(cue) {
    const s = this.scale;
    const sky = this.sky;
    const hand = () => this.limb(sky.side).hand;
    switch (cue) {
      case 'glint':
        this.voice.play('star');
        break;
      case 'starlight': // her specks catch its light
        tween(this.p, { sparkle: 1.8 }, 500, ease.out);
        break;
      case 'stars': // they lift off and become a sky; her mane goes dark without them
        sky.head = this.head();
        sky.motes = this.fx.motes(this.manePoints(30), { lift: 230 * s + 60, spread: 320 * s + 80 });
        tween(this.p, { sparkle: 0.15 }, 500, ease.out);
        break;
      case 'align': // into a road, from her fingers to it
        sky.motes?.align(sky.road);
        this.voice.play('tick');
        break;
      case 'charge': {
        this.fx.crackle(hand, { life: 640, radius: 70 * s + 14, count: 3 });
        const at = hand();
        this.fx.burst(at.x, at.y, { count: 14, inward: true, power: 0.5, spread: 90 * s });
        this.fx.cutin(...this.cutinAt(-sky.dir, { flip: false }), { kind: 'eyes', life: 600 }); // never over the road
        this.voice.play('charge');
        break;
      }
      case 'surge': { // the red light goes up
        const at = hand();
        sky.surge = this.fx.surge(sky.road, {
          onHit: () => {
            const top = sky.sat.pos();
            sky.sat.twinkle(1.25);
            this.fx.ring(top.x, top.y, { size: 0.55 });
            this.fx.lines(top.x, top.y, { inner: 60, life: 460 });
            this.voice.play('star');
          },
        });
        sky.motes?.light(125);
        this.fx.ring(at.x, at.y, { size: 0.6 });
        this.flash([INK, RED]);
        this.voice.play('bolt');
        this.voice.play('rise');
        break;
      }
      case 'break':
        sky.surge?.break();
        sky.surge = null;
        sky.motes?.dim();
        this.voice.play('tick');
        break;
      case 'twinkle': { // and it answers
        const at = sky.sat.pos();
        sky.sat.twinkle(1);
        this.fx.ring(at.x, at.y, { size: 0.4 });
        this.voice.play('star');
        break;
      }
      case 'glimmer':
        sky.sat.twinkle(0.55);
        if (!sky.motes) this.voice.play('star');
        break;
      case 'home': // her stars come back to her, and her mane lights up with them
        sky.motes?.home(...this.moved());
        sky.motes = null;
        tween(this.p, { sparkle: 1.7 }, 400, ease.out).then(() => tween(this.p, { sparkle: 1 }, 700, ease.inOut));
        break;
    }
  }

  fireSpeak() {
    const fn = this.onSpeak;
    this.onSpeak = null;
    fn?.();
  }

  async hurt() {
    this.perform('flinch');
    if (reducedMotion.matches) return;
    const p = this.p;
    p.sil = RED;
    p.silAmount = 1;
    this.drawFrame();
    await sleep(ON_TWOS);
    p.silAmount = 0;
    p.glitchSeed = Math.random() * 100;
    p.glitch = 0.7;
    p.split = 7;
    await tween(p, { glitch: 0, split: 0 }, 450, ease.out);
  }

  // Job done: the victory sequence (acting.js), its effects on cue. onSpeak runs when she
  // comes back down (that's when the "done" panel comes in), or at the end if anything cut it short.
  async celebrate({ onSpeak } = {}) {
    this.onSpeak = onSpeak;
    if (reducedMotion.matches || this.stowed || this.dormant) {
      this.voice.play('done');
      this.fireSpeak();
      return;
    }
    await this.perform('victory', this.towardCenter());
    this.fireSpeak();
  }

  // ---------- moving around ----------

  // Collapse into a line of light and go. Leaves her invisible; the caller puts her somewhere.
  async vanish({ beam = true } = {}) {
    const p = this.p;
    const s = this.scale;
    const gen = this.moveGen;
    const from = { ...this.pos };
    const head = this.head();
    if (this.sky) this.endAct(false); // the satellite stays here, she doesn't
    this.stopPointing(); // nor does what she was showing you
    if (reducedMotion.matches) {
      await tween(p, { alpha: 0 }, 160, ease.linear);
      return head;
    }
    this.boing({ squash: 3.4, mane: 2.5 }); // she stretches up tall and thin as she goes, like in the show
    this.voice.play('teleport-out');
    p.glitchSeed = Math.random() * 100;
    await tween(p, { glitch: 0.35, split: 3 }, 90, ease.linear);
    if (gen !== this.moveGen) return head; // grabbed: she doesn't go
    this.fx.burst(head.x, head.y + 70 * s, { count: 22, spread: 150 * s });
    this.fx.slices(head.x - 70 * s, head.y - 40 * s, 170 * s, 320 * s);
    await tween(p, { collapse: 1, glitch: 1, dissolve: 0.5, split: 9 }, 170, ease.in);
    if (gen !== this.moveGen) return head;
    p.alpha = 0;
    const ground = from.y - (this.p.sit ? (SPRITE.feet.y - SPRITE.hip) * s : 0);
    if (!this.upside) {
      // the void she leaves behind, like in the show: a black slit with a red line in it
      this.fx.slit(from.x - 10 * s * this.facing, head.top, ground, { width: 56 * s + 10 });
      if (beam) this.fx.beam(from.x, ground, { width: 40 * s + 8 });
    }
    return head;
  }

  // Come back at `to`: a column of light down to her, the body unfolding, two impact frames.
  async arrive(to, { face = null, stance = 'stand', perch = null, peekSide = null, dir = 0, fromHead = null, beam = true } = {}) {
    const p = this.p;
    const s = this.scale;
    const facing = face ?? (to.x > this.view.w / 2 ? 1 : -1);
    const toHead = this.head(to, facing);
    const gen = this.moveGen;
    const stale = () => gen !== this.moveGen; // grabbed on the way: what's left of the move is off
    if (fromHead && !reducedMotion.matches) {
      this.fx.streak(fromHead.x, fromHead.y, toHead.x, toHead.y);
      await sleep(60);
      if (stale()) return;
    }
    this.pos = { ...to };
    this.facing = facing;
    this.setStance(stance, { perch, peekSide, dir });
    this.place();

    if (reducedMotion.matches) {
      p.collapse = 0;
      p.dissolve = 0;
      await tween(p, { alpha: this.mode === 'sleep' ? 0.55 : 1 }, 160, ease.linear);
      return;
    }
    const ground = stance === 'sit' ? to.y - (SPRITE.feet.y - SPRITE.hip) * s : to.y;
    if (beam) this.fx.beam(to.x, ground, { down: true, width: 40 * s + 8 });
    // her pieces spiral back in, mane shards and green eye-stars
    this.fx.vortex(toHead.x, toHead.y + 30 * s, { radius: 170 * s + 40 });
    this.voice.play('teleport-in');
    await sleep(50);
    if (stale()) return;

    p.alpha = this.mode === 'sleep' ? 0.55 : 1;
    p.glitchSeed = Math.random() * 100;
    await tween(p, { collapse: 0, dissolve: 0, glitch: 0.6, split: 6 }, 200, ease.out);
    if (stale()) return;

    // two impact frames, the anime way
    p.sil = GREEN;
    p.silAmount = 1;
    this.drawFrame();
    await sleep(ON_ONES);
    if (stale()) return;
    p.sil = INK;
    this.drawFrame();
    await sleep(ON_ONES);
    p.silAmount = 0;
    if (stale()) return;
    this.fx.burst(toHead.x, toHead.y + 60 * s, { count: 10, power: 0.55, spread: 110 * s });
    // popping in: squashed, springing up to her height, glitter flying off her mane
    this.boing({ squash: -2.2, mane: 2 });
    if (!reducedMotion.matches) this.fx.sparks(toHead.x, toHead.y - 20 * s, { count: 10, power: 0.7, colors: [COLORS.paper, COLORS.green, COLORS.red] });
    if (stance === 'sit') this.perform('plop');
    await tween(p, { glitch: 0, split: 0 }, 220, ease.out);
  }

  // Leave in a column of light, reappear somewhere else.
  async teleport(to, opts = {}) {
    if (this.stowed) return; // put away: she stays in her biochip
    if (this.busy || this.dormant) {
      this.pending = { to, opts };
      if (this.dormant) this.rouse(); // asleep, down to her mask: she comes back first, then goes
      return;
    }
    this.busy = true;
    const gen = this.moveGen;
    this.wake();
    this.onTeleport?.('start');
    const fromHead = await this.vanish();
    if (gen !== this.moveGen) return; // grabbed on her way out: she stays in your hand
    await sleep(70);
    if (gen !== this.moveGen) return;
    await this.arrive(to, { ...opts, fromHead });
    if (gen !== this.moveGen) return;
    await this.settle();
  }

  // After a move: free again, stay put a while, the panel back, and the move that was waiting, if any.
  async settle() {
    this.busy = false;
    this.nextMove = Math.max(this.nextMove, performance.now() + rand(25000, 60000));
    this.onTeleport?.('end');
    if (this.pending) {
      const next = this.pending;
      this.pending = null;
      await this.teleport(next.to, next.opts);
    }
  }

  // Ctrl+Alt+C: she folds herself into her biochip in the corner (she pulls in, collapses, and
  // a streak runs from her to the chip). Asleep down to her mask, it's the mask that goes.
  async stow() {
    if (this.stowed || this.stowing) return;
    if (this.riding) this.setStance('stand');
    this.stowing = true;
    for (let i = 0; this.busy && i < 30; i++) await sleep(100); // let a move finish
    this.busy = true;
    this.endAct(false);
    this.onTeleport?.('start');
    let from = null;
    if (this.dormant) {
      from = this.head();
      this.dormant = false;
      this.onDoze?.('end');
    }
    if (reducedMotion.matches) {
      await tween(this.p, { alpha: 0 }, 160, ease.linear);
    } else {
      if (!from) {
        await this.perform('fold');
        from = await this.vanish({ beam: false });
      }
      const chip = this.chipAt();
      this.fx.streak(from.x, from.y, chip.x, chip.y);
      await sleep(60);
      this.fx.burst(chip.x, chip.y, { count: 12, inward: true, power: 0.45, spread: 40 });
      this.fx.ring(chip.x, chip.y, { size: 0.3 });
      this.voice.play('land');
    }
    this.setStance('stand');
    this.stowed = true;
    this.stowing = false;
    this.hidden = true;
    this.root.hidden = true;
    this.onStow?.();
    this.busy = false;
    if (this.unstowAfter) this.unstow(); // called back out while she was folding herself away
  }

  // Already in it, no show (put away last time, she starts in it).
  stowNow() {
    this.stowed = true;
    this.hidden = true;
    this.root.hidden = true;
    this.p.alpha = 0;
    this.onTeleport?.('start');
    this.onStow?.();
  }

  // Asleep a while: her mane and her body come apart (shards drifting down, the drawing
  // dissolving) and all that's left is her mask, floating there, eyes shut (chip.js Mask).
  async doze() {
    if (this.busy || this.dormant || this.stowed || this.hidden) return;
    this.busy = true;
    this.endAct(false);
    this.onTeleport?.('start');
    this.dozedOn = this.stance === 'sit' ? { ...this.perch } : null;
    const s = this.scale;
    const h = this.head();
    if (!reducedMotion.matches) {
      for (let i = 0; i < 10; i++) this.shed();
      this.fx.burst(h.x, h.y + 60 * s, { count: 10, power: 0.3, spread: 120 * s });
      this.p.glitchSeed = Math.random() * 100;
      await tween(this.p, { dissolve: 0.9, glitch: 0.25, sparkle: 0 }, 700, ease.in);
    }
    this.setStance('stand'); // no ledge to fall off while she's away
    Object.assign(this.p, { alpha: 0, dissolve: 0, glitch: 0 });
    this.hidden = true;
    this.root.hidden = true;
    this.dormant = true;
    this.onDoze?.('start', h);
    this.busy = false;
  }

  // Back from her mask: her eyes snap open, then she comes back together around it,
  // on her ledge again if it's still there.
  async rouse() {
    if (!this.dormant) return;
    if (this.hold) this.setHold(null); // she's back (her ledge, a teleport you asked for): the hold is over
    this.dormant = false;
    this.busy = true;
    this.onDoze?.('waking');
    if (this.mode === 'sleep') this.setMode('idle');
    this.lastActivity = performance.now();
    await sleep(reducedMotion.matches ? 0 : 280);
    this.onDoze?.('end');
    this.hidden = false;
    this.root.hidden = false;
    Object.assign(this.p, { alpha: 0, collapse: 0.6, dissolve: 0.5, glitch: 0, split: 0, sparkle: 1 });
    const win = this.dozedOn && this.perchWin(this.dozedOn.id);
    if (win && this.canSit(win) && !this.covered(win, win.x + this.dozedOn.dx)) {
      await this.arrive(this.seat(win, this.dozedOn.dx), { face: this.facing, stance: 'sit', perch: this.dozedOn, beam: false });
    } else {
      await this.arrive({ x: this.pos.x, y: this.dozedOn ? this.floor : this.pos.y }, { face: this.facing, beam: false });
    }
    this.dozedOn = null;
    await this.settle();
  }

  // Out of her biochip: a streak from the chip, and she arrives next to it.
  async unstow() {
    this.unstowAfter = this.stowing;
    if (!this.stowed) return;
    this.stowed = false;
    this.busy = true;
    this.onUnstow?.();
    this.hidden = false;
    this.root.hidden = false;
    if (this.mode === 'sleep') this.setMode('idle');
    this.lastActivity = performance.now();
    Object.assign(this.p, { alpha: 0, collapse: 1, dissolve: 0.5, glitch: 0, split: 0 });
    const chip = this.chipAt();
    const to = this.spot('chip');
    const face = to.x > this.view.w / 2 ? 1 : -1;
    if (!reducedMotion.matches) {
      const toHead = this.head(to, face);
      this.fx.burst(chip.x, chip.y, { count: 10, power: 0.5, spread: 30 });
      this.fx.streak(chip.x, chip.y, toHead.x, toHead.y);
      await sleep(60);
    }
    await this.arrive(to, { face, beam: false });
    await this.settle();
  }

  sitOn({ win, dx }) {
    return this.teleport(this.seat(win, dx), { stance: 'sit', perch: { id: win.id, dx }, face: this.facing });
  }

  canPossess() {
    return this.possessWindows && !this.busy && !this.hidden && this.stance === 'sit' && !reducedMotion.matches
      && this.windows.wins.some((w) => w.id === this.perch?.id);
  }

  // Typing for you in another window (main/life.js): she jacks into it, like in the show. She turns to it, a bolt
  // goes from her hand into it, its frame crackles with her eyes on it (fx.possess) and data glyphs rain into it
  // while the words go in; done, a burst off it and a boing off her. Only her overlay draws it: the keyboard stays
  // with that window. -> { end(ok) }
  hack(id) {
    const rect = () => this.windows.wins.find((w) => w.id === id) || null;
    const win = rect();
    const none = { end() {} };
    if (!win || this.stowed || this.hidden || this.dormant || reducedMotion.matches) return none;
    if (this.mode === 'sleep') this.wake();
    const s = this.scale;
    const aim = { x: clamp(win.x + win.w / 2, 0, this.view.w), y: clamp(win.y + Math.min(win.h / 2, 160), 0, this.view.h) };
    const dir = aim.x < this.pos.x ? -1 : 1;
    if (!this.zap(aim.x, aim.y)) {
      // busy with something else: a bolt from her hand all the same
      const { hand } = this.limb(this.armToward(dir));
      this.fx.bolt(hand, aim, { life: 420, forks: 2, width: 3 });
    }
    this.fx.sparks(aim.x, aim.y, { count: 16, power: 0.9 });
    this.voice.play('bolt');
    // her arm held out toward it while the words go in (ik.js)
    const hold = { target: () => aim, side: this.armToward(dir), until: performance.now() + 60000, aimOnly: true };
    this.reachFor = hold;
    const covers = () => {
      const front = [];
      for (const o of this.windows.wins) {
        if (o.id === id) break;
        front.push(o);
      }
      return front;
    };
    const taken = this.fx.possess(rect, { covers, entry: win.w / 2, look: () => this.mouse });
    setTimeout(() => this.voice.play('possess'), 300);
    const rain = setInterval(() => {
      const r = rect();
      if (r) this.fx.glyph(r.x + rand(24, Math.max(25, r.w - 24)), r.y + rand(36, Math.max(37, Math.min(r.h - 20, 320))));
    }, 110);
    let ended = false;
    const end = (ok = true) => {
      if (ended) return;
      ended = true;
      clearInterval(rain);
      taken.leave();
      if (this.reachFor === hold) this.reachFor = null;
      const r = rect();
      if (r && ok) {
        this.fx.burst(r.x + r.w / 2, r.y + 40 * s, { count: 14, power: 0.6, spread: Math.min(r.w / 3, 200) });
        this.fx.sparks(r.x + r.w / 2, r.y + 30, { count: 12, power: 0.8, colors: [COLORS.paper, COLORS.green, COLORS.red] });
      }
      this.boing({ squash: ok ? 1.8 : -1.2, mane: 2 });
      this.lastActivity = performance.now();
    };
    setTimeout(() => end(true), 60000); // never left hanging
    return { end };
  }

  // Like in the show, she gets into things: she dives into the window she sits on and takes it
  // over (fx.possess: its frame crackles, it glitches, it looks at you with her eyes), then comes
  // out of another window, or further along this one if there's no other.
  async possess() {
    if (!this.canPossess()) return false;
    const s = this.scale;
    const id = this.perch.id;
    const win = this.windows.wins.find((w) => w.id === id);
    const entry = this.pos.x - win.x;
    this.busy = true;
    this.wake();
    this.onTeleport?.('start');
    await this.perform('dive');
    const head = await this.vanish({ beam: false });
    this.fx.streak(head.x, head.y, this.pos.x, win.y + 40 * s);

    const rect = () => this.windows.wins.find((w) => w.id === id) || null;
    const covers = () => {
      const front = [];
      for (const o of this.windows.wins) {
        if (o.id === id) break;
        front.push(o);
      }
      return front;
    };
    const taken = this.fx.possess(rect, { covers, entry, look: () => this.mouse });
    this.voice.play('bolt');
    await sleep(300);
    this.voice.play('possess');
    await sleep(1600);
    taken.leave();
    await sleep(260);

    const here = rect();
    let seat = this.pickSeat({ except: id });
    if (!seat && here && this.canSit(here)) {
      const dx = clamp(here.w - entry + rand(-60, 60), 60, Math.max(60, here.w - 190)); // the other end of it
      if (!this.covered(here, here.x + dx)) seat = { win: here, dx };
    }
    const to = seat ? this.seat(seat.win, seat.dx) : this.spot('random');
    const toHead = this.head(to);
    if (here) {
      // out through the system, from the middle of the window to where she comes out
      this.fx.streak(here.x + here.w / 2, here.y + here.h * 0.46, toHead.x, toHead.y);
      await sleep(60);
    }
    if (seat) this.fx.slit(to.x, toHead.top, seat.win.y, { width: 56 * s + 10 }); // the void she climbs out of
    await this.arrive(to, seat ? { stance: 'sit', perch: { id: seat.win.id, dx: seat.dx }, beam: false } : {});
    await this.settle();
    return true;
  }

  // Lean in from an edge of the screen: vanish, then slide in on twos, three drawings.
  async peek(side = pick(['left', 'right', 'top'])) {
    if (this.busy) return;
    const s = this.scale;
    const { w, h } = this.view;
    let at, from, facing, dir;
    if (side === 'left') {
      const y = rand(h * 0.55, this.floor);
      facing = -1;
      dir = 1;
      at = { x: 14 * s, y };
      from = { x: -170 * s, y };
    } else if (side === 'right') {
      const y = rand(h * 0.55, this.floor);
      facing = 1;
      dir = -1;
      at = { x: w - 14 * s, y };
      from = { x: w + 170 * s, y };
    } else {
      // hanging upside down from the top edge, only the head and the mane showing
      const x = rand(w * 0.2, w * 0.8);
      facing = pick([1, -1]);
      dir = x > w / 2 ? -1 : 1;
      at = { x, y: -226 * s };
      from = { x, y: -470 * s };
    }

    this.busy = true;
    const gen = this.moveGen;
    this.wake();
    this.onTeleport?.('start');
    if (this.p.alpha > 0) await this.vanish();
    if (gen !== this.moveGen) return; // grabbed before she went
    this.pos = { ...from };
    this.facing = facing;
    this.setStance('peek', { peekSide: side, dir });
    this.p.collapse = 0;
    this.p.dissolve = 0;
    this.p.glitch = 0;
    this.p.split = 0;
    this.p.alpha = this.mode === 'sleep' ? 0.55 : 1;
    if (reducedMotion.matches) {
      this.pos = at;
    } else {
      for (const k of [0.45, 0.8, 1]) {
        this.pos = { x: lerp(from.x, at.x, k), y: lerp(from.y, at.y, k) };
        this.drawFrame();
        await sleep(ON_TWOS);
        if (gen !== this.moveGen) return; // pulled out of the edge
      }
    }
    this.peekFrom = from;
    this.peekUntil = performance.now() + rand(15000, 40000);
    this.busy = false;
    this.onTeleport?.('end');
  }

  // Duck back out of view, then show up somewhere else (or peek from another edge, if shy).
  async unpeek({ shy = false } = {}) {
    if (this.busy || this.stance !== 'peek') return;
    this.busy = true;
    const gen = this.moveGen;
    const at = { ...this.pos };
    const from = this.peekFrom || at;
    if (!reducedMotion.matches) {
      for (const k of [0.4, 0.8, 1]) {
        this.pos = { x: lerp(at.x, from.x, k), y: lerp(at.y, from.y, k) };
        this.drawFrame();
        await sleep(ON_TWOS);
        if (gen !== this.moveGen) return; // caught before she ducked out
      }
    }
    this.p.alpha = 0;
    this.p.collapse = 1;
    this.p.dissolve = 0.5;
    this.busy = false;
    const side = this.peekSide;
    this.setStance('stand');
    if (shy && Math.random() < 0.6) {
      this.peek(pick(['left', 'right', 'top'].filter((x) => x !== side)));
      return;
    }
    this.busy = true;
    this.onTeleport?.('start');
    const seat = this.wander ? this.pickSeat() : null;
    if (seat && Math.random() < 0.4) {
      await this.arrive(this.seat(seat.win, seat.dx), { stance: 'sit', perch: { id: seat.win.id, dx: seat.dx } });
    } else {
      await this.arrive(this.spot('random'));
    }
    if (gen !== this.moveGen) return;
    this.busy = false;
    this.onTeleport?.('end');
  }

  // Where she'd end up falling straight down from here: a free ledge under her, or the floor.
  landing() {
    const hip = this.pos.y - (SPRITE.feet.y - SPRITE.hip) * this.scale;
    let best = null;
    for (const win of this.windows.wins) {
      if (!this.canSit(win) || win.y < hip - 4) continue;
      if (this.pos.x < win.x + 40 || this.pos.x > win.x + win.w - 40) continue;
      if (this.covered(win, this.pos.x)) continue;
      if (!best || win.y < best.y) best = win;
    }
    if (best) {
      const dx = this.pos.x - best.x;
      return { y: this.seat(best, dx).y, stance: 'sit', perch: { id: best.id, dx } };
    }
    return { y: this.floor, stance: 'stand', perch: null };
  }

  fall() {
    if (this.stance === 'fall') return;
    if (this.sky) this.endAct(false);
    this.landingSpot = this.landing();
    this.setStance('fall');
    this.vy = 0;
    this.lastFall = performance.now();
    if (reducedMotion.matches) this.updateFall(this.lastFall + 10000);
  }

  updateFall(now) {
    const target = this.landingSpot;
    const dt = Math.min(0.05, (now - this.lastFall) / 1000);
    this.lastFall = now;
    const f = this.flight;
    this.vy = Math.min(this.vy + GRAVITY * dt, f ? 2600 : 1900);
    const s = this.scale;
    if (f) {
      // thrown: across the screen too, tumbling, off its sides and its top
      this.pos.x += this.vx * dt;
      this.vx *= Math.pow(0.6, dt);
      f.rot += f.spin * dt;
      const side = 60 * s + 16;
      if (this.pos.x < side || this.pos.x > this.view.w - side) {
        const left = this.pos.x < side;
        this.pos.x = left ? side : this.view.w - side;
        this.vx = -this.vx * 0.55;
        f.spin = -f.spin * 0.7;
        const y = this.pos.y - SPRITE.height * s * 0.5;
        this.fx.ring(left ? 4 : this.view.w - 4, y, { size: 0.55 });
        this.fx.burst(left ? 8 : this.view.w - 8, y, { count: 12, power: 0.6, spread: 60 });
        this.voice.play('land');
      }
      const top = SPRITE.height * s * 0.95;
      if (this.pos.y < top && this.vy < 0) {
        this.pos.y = top;
        this.vy = -this.vy * 0.35;
      }
    }
    const y = reducedMotion.matches ? target.y : this.pos.y + this.vy * dt;
    if (y < target.y) {
      this.pos.y = y;
      return;
    }
    const impact = this.vy;
    this.pos.y = target.y;
    if (f) {
      this.endFlight();
      if (impact > 1500 && !reducedMotion.matches) {
        this.crash();
        return;
      }
    }
    this.setStance(target.stance, { perch: target.perch });
    // she lands like rubber: flattened by how fast she came down, bouncing back up, sparks off the floor
    this.boing({ squash: -clamp(impact / 600, 1.2, 4), mane: 1.5 });
    if (!reducedMotion.matches && impact > 500) this.fx.sparks(this.pos.x, this.pos.y - 6, { count: 8, power: 0.5, dir: -Math.PI / 2, spread: Math.PI * 0.9 });
    if (target.stance === 'sit') {
      this.perform('plop');
    } else {
      this.perform('land');
      this.fx.burst(this.pos.x, this.pos.y - 20 * s, { count: 12, power: 0.6, spread: 60 * s });
    }
    this.voice.play('land');
    const p = this.p;
    p.glitchSeed = Math.random() * 100;
    p.glitch = 0.3;
    setTimeout(() => { p.glitch = 0; }, ON_ONES * 3);
  }

  // First appearance: drop in from the top of the screen.
  async materialize(at) {
    const p = this.p;
    this.pos = { ...at };
    this.faceCenter();
    this.setStance('stand');
    if (reducedMotion.matches) {
      p.alpha = 0;
      this.place();
      await tween(p, { alpha: 1 }, 300, ease.linear);
      return;
    }
    this.busy = true;
    p.alpha = 0;
    p.collapse = 1;
    p.dissolve = 0.5;
    this.place();
    await sleep(250);
    this.fx.beam(at.x, at.y, { down: true, width: 40 * this.scale + 8, life: 260 });
    this.voice.play('teleport-in');
    await sleep(80);
    p.alpha = 1;
    await tween(p, { collapse: 0, dissolve: 0, glitch: 0.5, split: 5 }, 240, ease.out);
    await tween(p, { glitch: 0, split: 0 }, 260, ease.out);
    this.busy = false;
  }

  // Her intro, when she starts: she grabs your screen by its edges, huge, says hi, then her hands
  // slip and she dives down to where she stands, and her body unfolds from her face (fx.intro).
  // `still`: no motion, it comes and goes where it is (Windows' animations off).
  async intro(at, { label = 'hi', caption = 'PROJECT CAPRICORN', still = reducedMotion.matches } = {}) {
    const p = this.p;
    this.pos = { ...at };
    this.faceCenter();
    this.setStance('stand');
    this.busy = true;
    this.onTeleport?.('start'); // the panel waits for her
    p.alpha = 0;
    p.collapse = 1;
    p.dissolve = 0.5;
    this.place();
    const head = this.head(at, this.facing);
    await this.fx.intro({
      to: { x: head.x, y: head.y, size: 100 * this.scale },
      label,
      caption,
      still,
      onCue: (cue) => {
        if (cue === 'open') this.voice.play('charge'); // the edges of the screen crackling
        else if (cue === 'hand') this.voice.play('land'); // a hand on the edge
        else if (cue === 'wave') this.voice.play('rise'); // a hand off it, to wave
        else if (cue === 'grab') {
          this.voice.play('land'); // she slams into it
          this.voice.play('bolt');
        } else if (cue === 'hi') this.voice.play('hello');
        else if (cue === 'slip') this.voice.play('teleport-out');
      },
    });
    await this.arrive(at, { face: this.facing, beam: false });
    this.busy = false;
    this.onTeleport?.('end');
  }

  // ---------- showing you things ----------

  // The point of `rect` (overlay coordinates) she aims at from where she is: its closest point,
  // a little inside. Off her screen (the tray, down in the taskbar), the edge of her screen.
  aimPoint(rect) {
    const { w, h } = this.view;
    const sh = this.limb(this.armToward(rect.x + rect.w / 2 < this.pos.x ? -1 : 1)).shoulder;
    const inset = Math.min(24, rect.w / 3, rect.h / 3);
    return {
      x: clamp(clamp(sh.x, rect.x + inset, rect.x + rect.w - inset), 6, w - 6),
      y: clamp(clamp(sh.y, rect.y + inset, rect.y + rect.h - inset), 6, h - 4),
    };
  }

  // Where to stand to point at `rect`: beside it, on the side with more room, her shoulder a bit
  // below its middle (on the floor for things low on the screen).
  spotNear(rect) {
    const s = this.scale;
    const { w, h } = this.view;
    const side = 150 * s + 30;
    const reach = 230 * s + 90; // from her feet to what she points at: room for the arm to shoot out
    const roomLeft = rect.x, roomRight = w - (rect.x + rect.w);
    let x;
    if (Math.max(roomLeft, roomRight) >= side + 40) {
      x = roomRight >= roomLeft ? rect.x + rect.w + reach : rect.x - reach;
    } else {
      x = rect.x + rect.w / 2 < w / 2 ? w - side : side; // nowhere beside it: the far side of the screen
    }
    x = clamp(x, side, w - side);
    const cy = clamp(rect.y + rect.h / 2, 0, h);
    const shoulderToFeet = (SPRITE.feet.y - SPRITE.shoulder.y) * s;
    const y = cy > h * 0.6 ? this.floor : clamp(cy + shoulderToFeet + 50, SPRITE.height * s + 40, this.floor);
    return { x, y, face: rect.x + rect.w / 2 < x ? 1 : -1 };
  }

  // Go and point at `rect`, and keep pointing (a dashed line from her finger, brackets, `label`)
  // until stopPointing(). Resolves once she's there with her arm out.
  async pointAt(rect, { label = '' } = {}) {
    if (this.stowed) return false;
    this.stopPointing();
    const spot = this.spotNear(rect);
    if (this.stance !== 'stand' || Math.hypot(spot.x - this.pos.x, spot.y - this.pos.y) > 140) {
      await this.teleport({ x: spot.x, y: spot.y }, { face: spot.face });
    }
    if (this.stowed || this.hidden) return false;
    const aim = this.aimPoint(rect);
    const dir = aim.x < this.pos.x ? -1 : 1;
    const side = this.armToward(dir);
    // how far up the arm comes to point at it (it hangs ~30 degrees low at rest)
    const reach = () => {
      const sh = this.limb(side).shoulder;
      return clamp(Math.atan2(sh.y - aim.y, Math.abs(aim.x - sh.x)) + 0.52, -0.6, 1.7);
    };
    this.pointing = { rect, aim, dir, side, reach, label, pointer: null };
    this.base = this.restBase();
    await this.perform('point', dir, { reach });
    if (this.pointing && !this.pointing.pointer) this.onCue('lock'); // the act was cut short
    return true;
  }

  // Done showing: the line reels back into her finger, the reticle lets go, the arm snaps back.
  stopPointing() {
    const pt = this.pointing;
    if (!pt) return;
    this.pointing = null;
    pt.pointer?.retract();
    this.base = this.restBase();
    if (!this.busy && !this.hidden && this.stance === 'stand') this.perform('unpoint', pt.dir);
  }

  // Can she point at this window so you'd see it: not maximized, its top not under other windows.
  canPoint(win) {
    return Boolean(win && !win.max && win.w > 120 && win.y > -10 && !this.covered(win, win.x + win.w / 2));
  }

  // Show up next to the mouse pointer (used when Claude needs you).
  async summon(cursor) {
    const { w } = this.view;
    const s = this.scale;
    const side = 150 * s + 30;
    const dx = cursor.x > w / 2 ? -170 : 170; // right beside it, not on what you're pointing at
    const to = {
      x: clamp(cursor.x + dx, side, w - side),
      y: clamp(cursor.y + SPRITE.height * s * 0.45, SPRITE.height * s + 120, this.floor),
    };
    if (this.stance === 'stand' && Math.hypot(to.x - this.pos.x, to.y - this.pos.y) < 160) {
      this.facing = cursor.x < this.pos.x ? 1 : -1;
      return;
    }
    await this.teleport(to, { face: cursor.x < to.x ? 1 : -1 });
  }

  setHidden(hidden) {
    this.hidden = hidden;
    this.root.hidden = hidden;
  }

  // ---------- pointer ----------

  bindPointer() {
    let down = null;
    // double-click: onto your cursor (2.4)
    this.canvas.addEventListener('dblclick', (e) => {
      if (this.hit(e.clientX, e.clientY)) this.onDoubleClick?.();
    });
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (this.hit(e.clientX, e.clientY)) this.onMenu?.(); // right-click: her menu
    });
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || !this.hit(e.clientX, e.clientY)) return;
      // whatever she was doing (a teleport, floating in, walking, falling), she's in your hand now
      this.snatched = false;
      if (this.busy || this.walking || this.stance === 'fall') this.grab();
      this.stopWalking();
      down = { x: e.clientX, y: e.clientY, pos: { ...this.pos } };
    });
    window.addEventListener('mousemove', (e) => {
      this.mouse = { x: e.clientX, y: e.clientY }; // a window she's in watches it
      if (down) {
        const dx = e.clientX - down.x, dy = e.clientY - down.y;
        if (!this.dragging && Math.hypot(dx, dy) > 5) {
          this.dragging = true;
          if (this.upside) {
            // flip back upright under the pointer
            down.pos = { x: down.pos.x, y: down.y + (SPRITE.feet.y - SPRITE.head.y) * this.scale };
          }
          this.endAct(false);
          this.setStance('stand');
          this.p.glitch = 0.18;
          this.p.split = 2;
          this.onTeleport?.('start');
          const now = performance.now();
          this.held = { t: now, vx: 0, vy: 0, swing: 0, spin: 0, stretch: 0, samples: [], flips: [], dir: 0, dizzy: false, last: now };
          this.onHandled?.('grabbed'); // (right after one of her AI's moves: you wanted it over, motion.js)
          // plucked: she stretches out of your fingers, sparks where you took hold
          this.boing({ squash: 3, mane: 2 });
          if (!reducedMotion.matches) this.fx.sparks(down.x, down.y, { count: 10, power: 0.7 });
          // snatched out of a teleport: that face (her 2.4 scream)
          if (this.snatched && !reducedMotion.matches) this.fx.cutin(...this.cutinAt(this.towardCenter()), { kind: 'scream', life: 620 });
        }
        if (this.dragging) {
          const to = {
            x: clamp(down.pos.x + dx, 40, this.view.w - 40),
            y: clamp(down.pos.y + dy, SPRITE.height * this.scale * 0.5, this.floor),
          };
          this.track(to);
          this.pos = to;
          this.p.glitchSeed = Math.random() * 100;
          this.place();
        }
        return;
      }
      // how fast your pointer goes, for when it whooshes right past her
      const now = performance.now();
      const last = this.lastMouse;
      this.lastMouse = { x: e.clientX, y: e.clientY, t: now };
      if (last && now - last.t < 80) {
        const dt = Math.max(8, now - last.t) / 1000;
        this.whoosh(e.clientX, e.clientY, (e.clientX - last.x) / dt, (e.clientY - last.y) / dt);
        this.brush(e.clientX, e.clientY, (e.clientX - last.x) / dt, (e.clientY - last.y) / dt, dt);
      }
      this.petCheck(e.clientX, e.clientY);
      if (!this.petting?.on) this.notice(e.clientX, e.clientY); // being petted, nothing else catches her eye
    });
    window.addEventListener('mouseup', (e) => {
      if (!down) return;
      const wasDragging = this.dragging;
      down = null;
      this.dragging = false;
      if (wasDragging) {
        const held = this.held;
        this.held = null;
        Object.assign(this, { tilt: 0, sx: 1, sy: 1 });
        tween(this.p, { glitch: 0, split: 0 }, 200, ease.out);
        this.onTeleport?.('end');
        // how fast your hand was going as you let go: the last tenth of a second of it
        const now = performance.now();
        const recent = held ? held.samples.filter((m) => now - m.t < 130) : [];
        let vx = 0, vy = 0;
        if (recent.length >= 2 && now - recent.at(-1).t < 60) {
          const a = recent[0], b = recent.at(-1);
          const dt = Math.max(16, b.t - a.t) / 1000;
          vx = (b.x - a.x) / dt;
          vy = (b.y - a.y) / dt;
        }
        if (held?.dizzy) this.dizzy();
        if (Math.hypot(vx, vy) > 900 && !reducedMotion.matches) this.fling(vx, vy);
        else {
          this.boing({ squash: -1.4, lean: clamp(-(held?.swing || 0) * 5, -140, 140) }); // let go: she swings back upright
          this.drop();
        }
      } else {
        this.poke(e.clientX, e.clientY);
        this.onClick?.();
      }
    });
  }

  // ---------- in your hand, thrown ----------

  // Where your hand moved her: her speed (for the swing and a throw) and, if you shake her, dizziness.
  track(to) {
    const h = this.held;
    if (!h) return;
    const now = performance.now();
    const dt = Math.max(4, now - h.t) / 1000;
    const vx = (to.x - this.pos.x) / dt;
    const vy = (to.y - this.pos.y) / dt;
    h.vx = h.vx * 0.55 + vx * 0.45;
    h.vy = h.vy * 0.55 + vy * 0.45;
    h.t = now;
    h.samples.push({ t: now, x: to.x, y: to.y });
    while (h.samples.length && now - h.samples[0].t > 200) h.samples.shift();
    // shaken: the direction flipping fast, again and again
    const dir = Math.sign(h.vx);
    if (Math.abs(h.vx) > 700 && dir && dir !== h.dir) {
      h.dir = dir;
      h.flips.push(now);
    }
    h.flips = h.flips.filter((t) => now - t < 1400);
    if (h.flips.length >= 6 && !h.dizzy) {
      h.dizzy = true;
      this.p.glitchSeed = Math.random() * 100;
      this.p.glitch = 0.45;
      if (!reducedMotion.matches) this.fx.cutin(...this.cutinAt(this.towardCenter()), { kind: 'eyesGlitch', life: 560 });
    }
    // fast, she sheds shards behind her
    if (Math.hypot(h.vx, h.vy) > 1400 && now - (h.lastShard || 0) > 90 && !reducedMotion.matches) {
      h.lastShard = now;
      this.shed();
    }
  }

  // Dangling from your hand: she swings behind the way you move her (a spring, so she sways past and
  // settles), her legs trailing, stretched a little when yanked fast.
  dangle(now) {
    const h = this.held;
    const dt = Math.min(0.05, (now - h.last) / 1000);
    h.last = now;
    if (now - h.t > 60) {
      h.vx *= 0.8; // your hand stopped: so does the pull
      h.vy *= 0.8;
    }
    const want = clamp(h.vx * 0.022, -32, 32);
    h.spin += ((want - h.swing) * 110 - h.spin * 11) * dt;
    h.swing = clamp(h.swing + h.spin * dt, -45, 45);
    h.stretch = h.stretch * 0.8 + clamp(Math.hypot(h.vx, h.vy) / 9000, 0, 0.14) * 0.2;
    this.bob = 0;
    this.tilt = h.swing;
    this.sx = 1 - h.stretch * 0.6;
    this.sy = 1 + h.stretch;
    this.p.kickL = clamp(-h.swing / 55 + 0.1, -0.6, 0.6);
    this.p.kickR = clamp(-h.swing / 55 - 0.06, -0.6, 0.6);
  }

  // Thrown: off your hand with its speed, tumbling head over heels (her own rig, red and green afterimages
  // streaming behind), off the sides and the top of the screen, down to the floor: on her feet if it was
  // gentle, flattened if it wasn't (crash).
  fling(vx, vy) {
    if (this.sky) this.endAct(false);
    this.setStance('fall');
    this.landingSpot = { y: this.floor, stance: 'stand', perch: null };
    this.vx = clamp(vx, -3000, 3000);
    this.vy = clamp(vy, -2400, 2400);
    this.lastFall = performance.now();
    this.flight = { rot: 0, spin: clamp(vx / 140, -16, 16) || 6 };
    this.voice.play('teleport-out');
    this.onHandled?.('thrown');
  }

  endFlight() {
    if (!this.flight) return;
    this.flight = null;
    this.vx = 0;
    this.tilt = 0;
  }

  // Thrown into the floor too hard: she goes flat (her rig squashed out, the splat act), a cloud of shards,
  // a ring, a glitch through her and stars for a moment; then she springs back up, a little offended.
  async crash() {
    const s = this.scale;
    this.setStance('stand');
    this.pos = { x: clamp(this.pos.x, 80 * s, this.view.w - 80 * s), y: this.floor };
    this.fx.burst(this.pos.x, this.pos.y - 10, { count: 26, power: 0.9, spread: 120 * s });
    this.fx.ring(this.pos.x, this.pos.y - 20, { size: 0.8 });
    this.voice.play('land');
    this.p.glitchSeed = Math.random() * 100;
    Object.assign(this.p, { glitch: 0.6, split: 6 });
    tween(this.p, { glitch: 0, split: 0 }, 500, ease.out);
    this.fx.dizzy(() => (this.hidden || this.dragging ? null : this.head()), { radius: 34 * s + 24, life: 1500, count: 3 });
    this.onHandled?.('crash');
    await this.perform('splat');
    this.boing({ squash: 3.2, mane: 2 }); // and back up, boing
  }

  // Shaken too much: stars going round her head, and she says so.
  dizzy() {
    const s = this.scale;
    this.fx.dizzy(() => (this.hidden || this.dragging ? null : this.head()), { radius: 34 * s + 24, life: 2800 });
    this.voice.play('star');
    this.onHandled?.('dizzy');
  }

  // ---------- petted ----------

  // Your pointer stroking her head and mane (back and forth over them, no button): she leans into your
  // hand, little hearts come off her, and she has things to say about it (onPet). It stops a moment
  // after your pointer stops or leaves her head.
  petCheck(x, y) {
    if (this.hidden || this.dragging || this.flight || this.riding || this.stance === 'peek' || this.busy) return;
    const s = this.scale;
    const h = this.head();
    const onHead = Math.abs(x - h.x) < 95 * s + 20 && y > h.top - 20 && y < h.y + 40 * s && this.hit(x, y);
    const now = performance.now();
    const pet = this.petting;
    if (!onHead) return;
    if (!pet || now - pet.last > 900) {
      this.petting = { since: now, last: now, x, dir: 0, dist: 0, strokes: 0, on: false, nextLean: 0, nextHeart: 0 };
      return;
    }
    const dx = x - pet.x;
    pet.x = x;
    pet.last = now;
    pet.dist += Math.abs(dx);
    const dir = Math.sign(dx);
    if (dir && dir !== pet.dir && Math.abs(dx) > 2) {
      pet.dir = dir;
      pet.strokes++;
      if (pet.on) this.boing({ lean: dir * 60, squash: -0.5 }); // each stroke: she sways with your hand, soft as jelly
    }
    if (!pet.on && (pet.strokes >= 3 || pet.dist > 260)) {
      pet.on = true;
      if (this.mode === 'sleep' || this.dormant) this.wake();
      this.lastActivity = now;
      this.onPet?.('start');
    }
    if (!pet.on) return;
    this.lastActivity = now;
    if (now > pet.nextLean && !this.act) {
      pet.nextLean = now + 520;
      this.perform('pet', x < h.x ? -1 : 1);
    }
    if (now > pet.nextHeart && !reducedMotion.matches) {
      pet.nextHeart = now + rand(220, 420);
      this.fx.hearts(x + rand(-14, 14), y - 8, { count: 1 });
    }
    const seconds = Math.floor((now - pet.since) / 1000);
    if (seconds !== pet.seconds) {
      pet.seconds = seconds;
      this.onPet?.('more', seconds);
    }
  }

  // the petting is over (your pointer stopped, or went away from her head)
  petEnd(now) {
    const pet = this.petting;
    if (!pet || now - pet.last < 900) return;
    this.petting = null;
    if (pet.on) this.onPet?.('end', (pet.last - pet.since) / 1000);
  }

  // ---------- her rig, from her AI ----------

  // A move her AI asked for in its answer ([[move: wave]]): played on her rig, toward you (the pointer)
  // or the middle of the screen, as big as she's learned you like it (amp). false if it isn't one she has,
  // or she's in no state to.
  gesture(name, { amp = 1 } = {}) {
    if (!MOVES.includes(name) || this.stowed || this.dormant || this.busy || this.dragging || this.flight || this.riding) return false;
    const h = this.head();
    const dir = this.mouse ? (this.mouse.x < h.x ? -1 : 1) : this.towardCenter();
    this.perform(name, ['spin', 'hop', 'turn'].includes(name) ? 0 : dir, { amp });
    if (name === 'hop' || name === 'spin' || name === 'dance' || name === 'laugh') this.boing({ squash: 1.6 * amp, mane: 1.5 * amp });
    this.lastActivity = performance.now();
    return true;
  }

  // ---------- elastic: her body as rubber, like in the show ----------

  // A push to her jelly: squash (< 0 squashes her flat, > 0 stretches her tall), lean (degrees a second), mane
  // (it flares). She overshoots and wobbles back (jellyStep).
  boing({ squash = 0, lean = 0, mane = 0 } = {}) {
    if (reducedMotion.matches) return;
    const j = this.jelly;
    j.vs += squash;
    j.vt += lean;
    j.vm += mane;
    j.live = true;
  }

  // Her jelly, a step: three springs, stiff and loosely damped (a few wobbles in a second), added on top of her
  // drawing; her feet stay put, she squashes from them, as thin when tall as she is wide when flat.
  jellyStep(now) {
    const j = this.jelly;
    const dt = Math.min(0.05, (now - (j.at || now)) / 1000);
    j.at = now;
    if (!j.live) return;
    const n = Math.max(1, Math.ceil(dt / 0.008));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      j.vs += (-210 * j.s - 7 * j.vs) * h;
      j.s += j.vs * h;
      j.vt += (-150 * j.t - 6 * j.vt) * h;
      j.t += j.vt * h;
      j.vm += (-120 * j.m - 6.5 * j.vm) * h;
      j.m += j.vm * h;
    }
    j.s = clamp(j.s, -0.4, 0.45);
    j.t = clamp(j.t, -30, 30);
    j.m = clamp(j.m, -0.3, 0.5);
    j.live = Math.abs(j.s) + Math.abs(j.vs) * 0.02 + Math.abs(j.t) * 0.01 + Math.abs(j.vt) * 0.001 + Math.abs(j.m) + Math.abs(j.vm) * 0.02 > 0.004;
    if (!j.live) Object.assign(j, { s: 0, vs: 0, t: 0, vt: 0, m: 0, vm: 0 });
    this.sy *= 1 + j.s;
    this.sx *= 1 - j.s * 0.55;
    this.tilt += j.t;
    this.p.mane += j.m;
    this.p.hair += j.t * 0.35;
  }

  // A click on her: she boings away from where you poked (squashed, wobbling back), sparks off the spot.
  poke(x, y) {
    if (this.hidden || this.stowed || this.dormant || reducedMotion.matches) return;
    const away = x < this.pos.x ? 1 : -1;
    this.boing({ squash: -2.6, lean: away * 120, mane: 2.2 });
    this.fx.sparks(x, y, { count: 14, power: 0.85 });
    if (y < this.head().y + 20) this.fx.twinkle(x, y, { size: 12 });
  }

  // Her mane, a step (hair.js): it feels how her head moves on screen (a teleport isn't a motion: it starts over),
  // and how she's turned.
  hairStep(now) {
    const hs = this.hairState || (this.hairState = { at: now, pos: null, vel: [0, 0] });
    const dt = Math.min(0.1, (now - hs.at) / 1000);
    hs.at = now;
    if (!(dt > 0)) return;
    const h = this.head();
    const s = this.scale || 1;
    if (!hs.pos || this.hidden || Math.hypot(h.x - hs.pos.x, h.y - hs.pos.y) > 420 * Math.max(1, dt * 12)) {
      hs.pos = h;
      hs.vel = [0, 0];
      this.hair.reset();
    }
    const vx = (h.x - hs.pos.x) / dt;
    const vy = (h.y - hs.pos.y) / dt;
    const ax = (vx - hs.vel[0]) / dt;
    const ay = (vy - hs.vel[1]) / dt;
    hs.pos = h;
    hs.vel = [vx, vy];
    this.hair.calm = reducedMotion.matches ? 0.35 : 1;
    this.hair.step(dt, { ax: (ax * this.facing) / s, ay: ay / s, tilt: ((this.tilt || 0) * Math.PI / 180) * this.facing });
    const d = this.hair.offsets;
    for (let i = 0; i < d.length; i++) {
      this.p.strand[i * 2] = d[i][0];
      this.p.strand[i * 2 + 1] = d[i][1];
    }
  }

  // Your pointer brushing through her mane (petting her, or just passing): it ruffles.
  brush(x, y, vx, vy, dt) {
    if (this.hidden || this.stowed || this.dormant || this.dragging) return;
    const sp = this.toSprite({ x, y });
    if (sp.y > 178 || sp.y < -12) return;
    const near = 1 - clamp(Math.hypot(sp.x - SPRITE.head.x, (sp.y - 92) * 1.2) / 135, 0, 1);
    if (near <= 0) return;
    const s = this.scale || 1;
    this.hair.push((vx * this.facing) / s, vy / s, near * Math.min(1, dt * 5));
  }

  // What her arm reaches for now: what she holds it toward (her typing show), or your pointer when it rests near
  // her hand. -> { target (screen), side, aimOnly, touch } | null
  ikWant(now) {
    const held = this.reachFor;
    if (held && now > held.until) this.reachFor = null;
    else if (held) {
      const target = typeof held.target === 'function' ? held.target() : held.target;
      if (target) return { target, side: held.side || this.armToward(target.x < this.pos.x ? -1 : 1), aimOnly: held.aimOnly };
    }
    const c = this.cursorReach;
    const m = this.mouse;
    const idle = m && !this.act && !this.walking && this.stance === 'stand' && this.mode !== 'sleep' && !this.busy && !this.dragging
      && !this.petting?.on && !this.pointing && !this.riding && !this.flight && !this.hidden && !this.stowed && !this.dormant && !reducedMotion.matches;
    if (!idle || now < c.rest) {
      c.since = 0;
      return null;
    }
    // your pointer where her hand can get to (not across her body, not right on her)
    const side = this.armToward(m.x < this.pos.x ? -1 : 1);
    const sp = this.toSprite(m);
    if (!reach(SPRITE.shoulder, SPRITE.hand, side === 'L' ? sp : mirrored(sp, SPRITE.mirror)).touches) {
      c.since = 0;
      return null;
    }
    // left there a moment: she reaches out and touches it, a few seconds, then leaves it be a while
    if (!c.since) {
      c.since = now;
      c.until = 0;
    }
    if (now - c.since < 700) return null;
    if (!c.until) c.until = now + 3500;
    if (now > c.until) {
      c.rest = now + 20000;
      c.since = 0;
      return null;
    }
    return { target: { x: m.x, y: m.y }, side, touch: true };
  }

  // Her arm on what she reaches for (ik.js): turned and stretched so her fingertip lands on it, eased in and out
  // over what she's drawn doing; her head looks at it.
  ikStep(now) {
    const ik = this.ik;
    const dt = Math.min(0.1, (now - (ik.at || now)) / 1000);
    ik.at = now;
    const want = this.ikWant(now);
    const goal = want ? 1 : 0;
    ik.w += (goal - ik.w) * (1 - Math.exp(-dt * (goal > ik.w ? 8 : 5)));
    if (want) {
      if (want.side !== ik.side && ik.w > 0.05) ik.w = 0.05; // the other arm: from the start
      ik.side = want.side;
      ik.target = want.target;
      ik.aimOnly = Boolean(want.aimOnly);
      ik.touch = Boolean(want.touch);
    }
    if (ik.w < 0.01 || !ik.target) {
      if (!want) ik.touched = false;
      return;
    }
    const sp = this.toSprite(ik.target);
    const { shoulder, hand, mirror } = SPRITE;
    const r = reach(shoulder, hand, ik.side === 'L' ? sp : mirrored(sp, mirror), ik.aimOnly ? { ...ARM_LIMITS, max: 1.3 } : ARM_LIMITS);
    const p = this.p;
    if (ik.side === 'L') {
      p.armL = lerp(p.armL, r.angle, ik.w);
      p.longL = lerp(p.longL, r.long, ik.w);
    } else {
      p.armR = lerp(p.armR, r.angle, ik.w);
      p.longR = lerp(p.longR, r.long, ik.w);
    }
    p.head += look({ x: 118, y: 152 }, sp) * ik.w;
    // her fingertip on your pointer: a spark there, once
    if (ik.touch && r.touches && ik.w > 0.9 && !ik.touched) {
      ik.touched = true;
      this.fx.twinkle(ik.target.x, ik.target.y, { size: 10 });
    }
  }

  // Your pointer rushing right past her face: her mane bristles and she sways out of its way, a few sparks
  // flying off with it.
  whoosh(x, y, vx, vy) {
    if (this.hidden || this.stowed || this.busy || this.dragging || this.flight || this.riding || this.dormant || this.stance === 'fall') return;
    const now = performance.now();
    if (now < (this.nextWhoosh || 0) || Math.hypot(vx, vy) < 1600) return;
    const h = this.head();
    if (Math.hypot(x - h.x, y - (h.y - 20)) > 150 * this.scale + 40) return;
    this.nextWhoosh = now + 700;
    if (this.mode === 'sleep') this.wake();
    this.boing({ lean: clamp(vx * 0.06, -160, 160), mane: 3, squash: -1 });
    if (!reducedMotion.matches) this.fx.sparks(x, y, { count: 6, power: 0.5, dir: Math.atan2(vy, vx), spread: 1.2 });
  }

  // Her other minds peering out: eyes opening around her mane, all on your pointer, then shutting.
  manyEyes() {
    if (reducedMotion.matches || this.hidden || this.stowed || this.dormant) return;
    const s = this.scale;
    this.fx.eyes(() => (this.hidden || this.dragging || this.dormant ? null : this.head()), () => this.mouse || this.head(),
      { count: pick([2, 3, 3, 4]), radius: 95 * s + 20, size: 9 * Math.max(0.7, s) + 3 });
    this.boing({ mane: 2.5, squash: 0.8 });
  }

  // Where your pointer is, when it's near and she's just floating there: her head turns a little toward it,
  // her mane bristles when it comes right up to her face (on top of whatever she's drawn doing).
  follow(now) {
    const m = this.mouse;
    const p = this.p;
    const want = { head: 0, mane: 0, lean: 0 };
    if (m && !this.act && !this.walking && this.stance === 'stand' && this.mode !== 'sleep' && !this.busy) {
      const h = this.head();
      const d = Math.hypot(m.x - h.x, m.y - h.y);
      const near = clamp(1 - (d - 60) / 340, 0, 1);
      const dir = m.x < h.x ? -1 : 1;
      want.head = 0.13 * near * dir * this.facing * clamp(Math.abs(m.x - h.x) / 120, 0, 1);
      want.mane = d < 110 ? 0.12 : 0;
      want.lean = 4 * near * dir * clamp(Math.abs(m.x - h.x) / 160, 0, 1); // her whole body leaning in toward it
    }
    this.gazeHead = lerp(this.gazeHead || 0, want.head, 0.18);
    this.gazeMane = lerp(this.gazeMane || 0, want.mane, 0.18);
    this.gazeLean = lerp(this.gazeLean || 0, want.lean, 0.12);
    p.head += this.gazeHead;
    p.mane += this.gazeMane;
    this.tilt += this.gazeLean;
  }

  // Let go of her: onto a ledge if her hips are right at one, otherwise she falls.
  drop() {
    const s = this.scale;
    const hip = this.pos.y - (SPRITE.feet.y - SPRITE.hip) * s;
    for (const win of this.windows.wins) {
      if (!this.canSit(win) || Math.abs(hip - win.y) > 26) continue;
      if (this.pos.x < win.x + 40 || this.pos.x > win.x + win.w - 40 || this.covered(win, this.pos.x)) continue;
      const dx = this.pos.x - win.x;
      this.pos = this.seat(win, dx);
      this.setStance('sit', { perch: { id: win.id, dx } });
      this.perform('plop');
      this.voice.play('land');
      return;
    }
    if (this.pos.y < this.floor - 2) this.fall();
    else this.perform('land');
  }

  // When the pointer comes close she turns around to face it and cocks her head;
  // if she's peeking, she's shy and ducks away.
  notice(x, y) {
    if (this.busy || this.hidden || this.stance === 'fall' || this.sky) return; // the satellite has all her attention
    const h = this.head();
    if (Math.hypot(x - h.x, y - h.y) > 230) return;
    const now = performance.now();
    if (this.mode === 'sleep') this.wake();
    if (now < this.nextNotice) return;
    this.nextNotice = now + 15000;
    if (this.stance === 'peek') {
      this.unpeek({ shy: true });
      return;
    }
    const wanted = x < this.pos.x ? 1 : -1;
    if (wanted !== this.facing && this.stance === 'stand') {
      this.perform('turn');
      return;
    }
    if (this.mode !== 'idle') return;
    // curious: a few steps toward your pointer when it's down by her floor
    if (Math.random() < 0.25 && this.stance === 'stand' && Math.abs(this.pos.y - this.floor) < 30 && y > this.floor - 420 && Math.abs(x - this.pos.x) > 120) {
      this.walkTo(x + (x < this.pos.x ? 110 : -110), { speed: 170 });
      return;
    }
    // now and then she's a little menace about it
    if (Math.random() < 0.3 && this.zap(x, y)) return;
    // or side-eyes your pointer (her 2.4 drawings of her eyes going that way), from her other side
    if (Math.random() < 0.18 && !reducedMotion.matches) {
      const toward = x < h.x ? -1 : 1;
      this.fx.cutin(...this.cutinAt(-toward), { kind: toward < 0 ? 'eyesLeft' : 'eyesRight', life: 520 });
    }
    this.perform('curious', x < h.x ? -1 : 1);
  }
}

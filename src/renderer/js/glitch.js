// Her mischief (from Capri Desktop 2.4): screen glitches painted on a click-through canvas over
// everything, in six styles she unlocks as sync grows (bars, tear, corruption, hex rain, a fake
// ENGRAM SYNC box, a red cursor chasing yours). Gentle on purpose: low contrast, nothing flashes,
// and nothing at all while animations are reduced. Ctrl+Alt+C stops one at once.

import { reducedMotion } from './util.js';

export const KINDS = ['Bars', 'Tear', 'Corruption', 'Hex rain', 'Sync bar', 'Chaser'];
const SECONDS = [2.6, 3.0, 2.8, 3.6, 4.0, 4.0];
const RED = [239, 58, 78];
const GREEN = [167, 245, 88];
const rgba = ([r, g, b], a) => `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a)).toFixed(3)})`;

// the same "random" numbers for a whole step (8 a second), so it moves in held drawings, like her
function dice(seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  return { next, int: (n) => Math.floor(next() * Math.max(1, n)) };
}

export class Glitch {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.running = null; // { kind, start, duration }
    this.mouse = { x: innerWidth / 2, y: innerHeight / 2 };
    this.chase = null;
    this.syncTarget = 0.87;
    this.chip = new Image();
    this.chip.src = '../../assets/classic/chip.png';
    window.addEventListener('mousemove', (e) => { this.mouse = { x: e.clientX, y: e.clientY }; });
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = devicePixelRatio || 1;
    this.canvas.width = Math.round(innerWidth * dpr);
    this.canvas.height = Math.round(innerHeight * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  get active() {
    return Boolean(this.running);
  }

  run(kind = 0, { seconds } = {}) {
    if (reducedMotion.matches) return Promise.resolve(false);
    this.stop();
    const k = Math.max(0, Math.min(KINDS.length - 1, kind | 0));
    this.running = { kind: k, start: performance.now(), duration: (seconds || SECONDS[k]) * 1000 };
    this.chase = null;
    this.canvas.hidden = false;
    return new Promise((resolve) => {
      this.running.done = resolve;
      const tick = () => {
        if (!this.running) return;
        const age = performance.now() - this.running.start;
        if (age >= this.running.duration) {
          this.stop();
          return;
        }
        this.frame(age / 1000, this.running.duration / 1000);
        this.raf = requestAnimationFrame(tick);
      };
      tick();
    });
  }

  stop() {
    cancelAnimationFrame(this.raf);
    const done = this.running?.done;
    this.running = null;
    this.ctx.clearRect(0, 0, innerWidth, innerHeight);
    this.canvas.hidden = true;
    done?.(true);
  }

  frame(age, duration) {
    const { ctx } = this;
    const width = innerWidth, height = innerHeight;
    const fade = Math.max(0, Math.min(1, Math.min(age / 0.25, (duration - age) / 0.4)));
    const step = Math.floor(age / 0.125);
    const d = dice(step * 7919 + 13);
    const kind = this.running.kind;
    ctx.clearRect(0, 0, width, height);
    // scanlines and red edges, always
    ctx.fillStyle = `rgba(0,0,0,${(0.094 * fade).toFixed(3)})`;
    for (let y = 0; y < height; y += 4) ctx.fillRect(0, y, width, 1);
    const edge = Math.max(40, width / 16);
    const left = ctx.createLinearGradient(0, 0, edge, 0);
    left.addColorStop(0, rgba(RED, 0.22 * fade));
    left.addColorStop(1, rgba(RED, 0));
    ctx.fillStyle = left;
    ctx.fillRect(0, 0, edge, height);
    const right = ctx.createLinearGradient(width - edge, 0, width, 0);
    right.addColorStop(0, rgba(RED, 0));
    right.addColorStop(1, rgba(RED, 0.22 * fade));
    ctx.fillStyle = right;
    ctx.fillRect(width - edge, 0, edge, height);

    if (kind === 0) {
      let budget = width * height * 0.06;
      const bars = 3 + d.int(4);
      for (let i = 0; i < bars; i++) {
        const bh = 3 + d.int(Math.max(4, height / 18));
        const bw = width * (0.15 + d.next() * 0.45);
        if (bh * bw * 2 > budget) continue;
        budget -= bh * bw * 2;
        const x = d.int(width - bw), y = d.int(height - bh), shift = 6 + d.int(24);
        ctx.fillStyle = rgba(RED, ((40 + d.int(70)) / 255) * fade);
        ctx.fillRect(x - shift, y, bw, bh);
        ctx.fillStyle = rgba(GREEN, ((40 + d.int(70)) / 255) * fade);
        ctx.fillRect(x + shift, y, bw, bh);
        if (d.int(3) === 0) {
          ctx.fillStyle = `rgba(0,0,0,${(0.27 * fade).toFixed(3)})`;
          ctx.fillRect(x, y + bh, bw, Math.max(2, bh / 3));
        }
      }
    } else if (kind === 1) {
      const bandY = (age / duration) * (height + 240) - 120;
      for (let k = 0; k < 4; k++) {
        const sh = 6 + d.int(16), sw = width * (0.45 + d.next() * 0.5), shift = 10 + d.int(50), x = d.int(width - sw);
        ctx.fillStyle = rgba(k % 2 === 0 ? RED : GREEN, ((60 + d.int(40)) / 255) * fade);
        ctx.fillRect(x + (k % 2 === 0 ? -shift : shift), bandY + k * 17, sw, sh);
      }
      ctx.fillStyle = `rgba(235,235,235,${(0.24 * fade).toFixed(3)})`;
      ctx.fillRect(0, bandY, width, 1);
    } else if (kind === 2) {
      let budget = width * height * 0.04;
      const blocks = 5 + d.int(6);
      for (let i = 0; i < blocks; i++) {
        const w = 12 + d.int(60), h = 12 + d.int(40);
        if (w * h > budget) continue;
        budget -= w * h;
        const x = d.int(width - w), y = d.int(height - h), p = d.int(3);
        ctx.fillStyle = p === 0 ? rgba(RED, ((50 + d.int(60)) / 255) * fade) : p === 1 ? rgba(GREEN, ((50 + d.int(60)) / 255) * fade) : `rgba(0,0,0,${(0.35 * fade).toFixed(3)})`;
        ctx.fillRect(x, y, w, h);
        for (let k = 0; k < 6; k++) ctx.fillRect(x + d.int(w + 80) - 40, y + d.int(h + 40) - 20, 4, 4);
      }
    } else if (kind === 3) {
      const digits = '0123456789ABCDEF';
      ctx.font = 'bold 17px "JetBrains Mono", Consolas, monospace';
      ctx.textBaseline = 'top';
      for (let side = 0; side < 2; side++) {
        for (let column = 0; column < 7; column++) {
          const x = side === 0 ? 10 + column * 19 : width - 30 - column * 19;
          const head = (age * 230 + column * 137 + side * 61) % (height + 300);
          for (let j = 0; j < 12; j++) {
            const y = head - j * 19 - 100;
            if (y < -19 || y > height) continue;
            const alpha = ((j === 0 ? 210 : 170 - j * 13) / 255) * fade;
            if (alpha <= 0) continue;
            ctx.fillStyle = j === 0 ? `rgba(230,255,210,${alpha.toFixed(3)})` : rgba(GREEN, alpha);
            ctx.fillText(digits[((step * 7 + column * 13 + j * 17 + side * 5) ^ (j * 31 + column)) & 15], x, y);
          }
        }
      }
    } else if (kind === 4) {
      const box = { x: 40, y: Math.max(20, height - 210), w: 400, h: 84 };
      const done = this.syncTarget * Math.min(1, age / Math.max(1, duration - 1));
      ctx.fillStyle = `rgba(6,6,8,${(0.78 * fade).toFixed(3)})`;
      ctx.fillRect(box.x, box.y, box.w, box.h);
      ctx.strokeStyle = rgba(RED, 0.9 * fade);
      ctx.lineWidth = 1;
      ctx.strokeRect(box.x + 0.5, box.y + 0.5, box.w, box.h);
      ctx.font = 'bold 14px "JetBrains Mono", Consolas, monospace';
      ctx.textBaseline = 'top';
      ctx.fillStyle = rgba(GREEN, 0.94 * fade);
      ctx.fillText('ENGRAM SYNC // CAPRI.EXE', box.x + 14, box.y + 12);
      ctx.fillText(`${Math.floor(done * 100)}%`, box.x + box.w - 54, box.y + 12);
      ctx.fillStyle = `rgba(60,20,26,${(0.47 * fade).toFixed(3)})`;
      ctx.fillRect(box.x + 14, box.y + 44, box.w - 28, 14);
      ctx.fillStyle = rgba(RED, 0.92 * fade);
      ctx.fillRect(box.x + 14, box.y + 44, (box.w - 28) * done, 14);
    } else if (kind === 5) {
      const angle = age * 2.6;
      const target = { x: this.mouse.x + Math.cos(angle) * 48 + 30, y: this.mouse.y + Math.sin(angle) * 36 + 22 };
      if (!this.chase) this.chase = { x: target.x + 160, y: target.y + 90 };
      this.chase.x += (target.x - this.chase.x) * 0.12;
      this.chase.y += (target.y - this.chase.y) * 0.12;
      const arrow = [[0, 0], [0, 21], [5, 16], [9, 25], [13, 23], [9, 14], [16, 14]];
      const path = (dx, dy) => {
        ctx.beginPath();
        arrow.forEach(([x, y], i) => (i ? ctx.lineTo(x + this.chase.x + dx, y + this.chase.y + dy) : ctx.moveTo(x + this.chase.x + dx, y + this.chase.y + dy)));
        ctx.closePath();
      };
      path(3, 2);
      ctx.fillStyle = rgba(GREEN, 0.35 * fade);
      ctx.fill();
      path(0, 0);
      ctx.fillStyle = rgba(RED, 0.9 * fade);
      ctx.fill();
      ctx.strokeStyle = `rgba(20,0,4,${(0.86 * fade).toFixed(3)})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // her chip slides in at the top right, as in 2.4
    if (this.chip.complete && this.chip.naturalWidth) {
      const size = 88;
      const tall = (size * this.chip.naturalHeight) / this.chip.naturalWidth;
      const slide = Math.min(1, age / 0.35) * Math.min(1, Math.max(0, (duration - age) / 0.4));
      const cx = width - 24 - size + (1 - slide * slide) * (size + 48) + d.int(7) - 3;
      ctx.globalAlpha = fade;
      ctx.drawImage(this.chip, cx, 28, size, tall);
      ctx.globalAlpha = 1;
    }
  }
}

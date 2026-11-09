// Her shapes. She isn't always a girl on your desktop: she can be a spark, a glitch, a cloud of shards, a shadow. Which ones she
// has grows with your sync (milestones), her AI picks one with a tag ([[form: spark]]) and you can ask for one in words, but
// only from this list, and she always comes back whole.

// sync % she needs for each
export const FORMS = { glitch: 10, spark: 20, shards: 40, silhouette: 60 };
export const FORM_NAMES = Object.keys(FORMS);
const MIN_SECONDS = 1.5;
const MAX_SECONDS = 15;

export const hasForm = (name, sync) => Object.hasOwn(FORMS, name) && (Number(sync) || 0) >= FORMS[name];
export const unlockedForms = (sync) => FORM_NAMES.filter((name) => hasForm(name, sync));
export const formSeconds = (s, fallback = 5) => Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, Number(s) || fallback));

// Which form a passing mood would pick by itself, if any (main/mood.js): restless and wired, she's a spark; low, she's a shadow.
export function formForMood(label, sync) {
  const wanted = { playful: 'spark', restless: 'spark', irritable: 'glitch', gloomy: 'silhouette' }[label];
  return wanted && hasForm(wanted, sync) ? wanted : null;
}

// What each looks like. capri: her body; sleep and tween come from util.js through capri.
export const SHAPES = {
  // her whole body breaking up, still standing there
  glitch: {
    async enter(c) {
      c.p.glitchSeed = Math.random() * 100;
      await c.tweenP({ glitch: 0.85, split: 0.5, sparkle: 1 }, 220);
    },
    tick(c) {
      c.p.glitchSeed = Math.random() * 100;
      if (Math.random() < 0.15) c.fx.slices(c.head().x, c.head().y + 80 * c.scale, 130 * c.scale, 240 * c.scale, { count: 5, life: 140 });
    },
    async leave(c) {
      await c.tweenP({ glitch: 0, split: 0, sparkle: 0 }, 260);
    },
  },

  // a ball of static that wanders off and darts back
  spark: {
    away: true,
    tick(c, t) {
      const h = c.formAt;
      const x = h.x + Math.sin(t * 2.3) * 90 * c.scale + Math.sin(t * 5.1) * 26 * c.scale;
      const y = h.y + Math.cos(t * 1.9) * 42 * c.scale + Math.sin(t * 6.7) * 14 * c.scale;
      c.fx.sparks(x, y, { count: 4, power: 0.5 });
      c.fx.twinkle(x, y, { size: 12 });
      if (c.formLast) c.fx.streak(c.formLast.x, c.formLast.y, x, y, { life: 110 });
      if (Math.random() < 0.12) c.fx.crackle({ x, y }, { life: 240, radius: 26, count: 2 });
      c.formLast = { x, y };
    },
  },

  // come apart into pieces that turn around where she was
  shards: {
    away: true,
    tick(c) {
      const { x, y } = c.formAt;
      c.fx.vortex(x, y + 50 * c.scale, { radius: 110 * c.scale, life: 320, count: 5 });
      c.fx.sparks(x, y + 50 * c.scale, { count: 1, power: 0.25 });
    },
  },

  // a black cutout of her with a red edge
  silhouette: {
    async enter(c) {
      c.root.style.filter = 'brightness(0) drop-shadow(0 0 7px #ff1744)';
    },
    tick(c) {
      if (Math.random() < 0.07) c.fx.sparks(c.head().x, c.head().y, { count: 2, power: 0.2 });
    },
    async leave(c) {
      c.root.style.filter = '';
    },
  },
};

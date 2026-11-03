// Her with your music (what's playing, from Windows: main/life.js). The words of the song over her head
// as they're sung (LRCLIB, main/lyrics.js), and how she takes the song (her verdict, main/life.js): her
// head going with it at its pace and notes coming off her, a dance now and then to one she likes, hearts
// for one she loves, and for one that bores her a yawn and a nap (Z's rising), until a song she likes
// wakes her up.

import { pick, rand, clamp, reducedMotion } from './util.js';
import { T } from './i18n.js';

const LEAD_S = 0.2;   // a line shows a moment before it's sung
const SNAP_S = 1.2;   // a reading this far from her own count of the song: a seek, she jumps there
const LAST_S = 9;     // the last line goes after this long
const NAP_LINES = ["*yawn* Wake me when this one's over.", 'This song is a sedative. Night.', "Boring. I'm taking a nap.", 'Zzz… tell me when it gets good.'];
const WAKE_LINES = ['Ooh! Now THIS one!', "I'm up, I'm up! This one's good.", 'Finally, a real song!'];
const LOVE_LINES = ['Oh, I LOVE this one!', 'Turn it up. Now.', 'This one. This one is the one.'];

// her pace for a song, the same every time it plays: 0.85 to 1.15 of her own (about 100 to 140 beats a minute)
function tempo(song) {
  let h = 7;
  for (const ch of song) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return 0.85 + (h % 31) / 100;
}

// the line being sung at `seconds` (-1 before the first)
function lineAt(lines, seconds) {
  let lo = 0, hi = lines.length - 1, at = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].t <= seconds) { at = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return at;
}

export class Listening {
  constructor({ capri, fx, panel, voice, el }) {
    Object.assign(this, { capri, fx, panel, voice, el });
    this.lineEl = el.querySelector('.lyric__line');
    this.cfg = {};
    this.song = '';      // 'title|artist' of what's playing
    this.playing = false;
    this.clock = null;   // { pos, at }: where in the song it was (s), and when (performance.now())
    this.words = { song: '', lines: null }; // its timed lyrics, when LRCLIB has them
    this.shown = -1;     // the line on screen (-1: none)
    this.verdict = '';   // what she thinks of it: love | like | meh ('' until she's decided)
    this.dozeAt = 0;     // a boring one: when she gives up on it and naps
    this.nextNote = 0;
    this.nextDance = 0;
    this.anchor = null;
    setInterval(() => this.tick(), 120);
  }

  configure(cfg) {
    this.cfg = cfg;
  }

  get mood() {
    return this.playing && Boolean(this.song) && this.cfg.music !== 'off' && this.cfg.musicMood !== false;
  }

  // free to dance or doze off: idle, not talking, not being handled, nothing else going on
  get free() {
    const { capri } = this;
    return !this.panel.visible && capri.mode === 'idle' && !capri.busy && !capri.act && !capri.stowed && !capri.dormant
      && !capri.dragging && !capri.walking && !capri.flight && !capri.riding && capri.stance !== 'fall' && capri.stance !== 'peek';
  }

  // ---- what main/life.js tells her ----

  onEvent(evt) {
    if (evt.type === 'nowPlaying') this.heard(evt.track);
    else if (evt.type === 'lyrics') this.words = { song: evt.song, lines: evt.lines?.length ? evt.lines : null };
    else if (evt.type === 'taste') this.judged(evt.song, evt.verdict);
    else if (evt.type === 'listenNow') this.tuneIn();
  }

  // You asked her to listen with you ("dengarkan lagu ini"): awake, all ears, notes off her right away.
  tuneIn() {
    const { capri } = this;
    if (capri.mode === 'sleep' || capri.dormant) capri.wake();
    this.dozeAt = 0;
    this.nextNote = 0;
    this.nextDance = performance.now() + rand(4000, 9000);
    capri.gesture('nod');
    this.notes(2);
  }

  // Her window (re)loaded: the song main/life.js was following (host.songNow()), so she doesn't wait for the next one.
  restore(now) {
    if (!now?.track) return;
    this.heard(now.track);
    if (now.lines) this.words = { song: this.song, lines: now.lines };
    if (now.verdict) this.verdict = now.verdict;
  }

  // What's playing, and where in it (every couple of seconds).
  heard(track) {
    const song = track?.title ? `${track.title}|${track.artist || ''}` : '';
    const now = performance.now();
    if (song !== this.song) {
      this.song = song;
      this.verdict = '';
      this.dozeAt = 0;
      this.clock = null;
    }
    const was = this.playing;
    this.playing = Boolean(track?.playing);
    if (track && track.pos >= 0) {
      // her own count runs smooth between readings; one far off it is a seek, a skip back, a pause
      const counted = this.position(was);
      const off = track.pos - counted;
      this.clock = { pos: !this.clock || Math.abs(off) > SNAP_S ? track.pos : counted + off * 0.25, at: now };
    }
  }

  position(playing = this.playing) {
    if (!this.clock) return -1;
    return this.clock.pos + (playing ? (performance.now() - this.clock.at) / 1000 : 0);
  }

  // Her verdict on the song (main/life.js): she settles in, gets into it, or starts to drift off.
  judged(song, verdict) {
    if (song !== this.song) return;
    this.verdict = verdict;
    const now = performance.now();
    const { capri, panel } = this;
    if (verdict === 'meh') {
      this.dozeAt = now + rand(30000, 50000);
      return;
    }
    this.nextDance = now + (verdict === 'love' ? rand(6000, 14000) : rand(20000, 45000));
    if (capri.napping) {
      // a song she likes wakes her from a boring one
      capri.wake();
      capri.perform('hop');
      this.notes(3);
      if (!panel.visible && Math.random() < 0.6) panel.say({ kind: 'info', face: 'happy', badge: '♪', line: T(pick(WAKE_LINES)), hold: 3200 });
    } else if (verdict === 'love' && this.free && this.cfg.music !== 'comment' && Math.random() < 0.5) {
      panel.say({ kind: 'info', face: 'happy', badge: '♪', line: T(pick(LOVE_LINES)), hold: 3200 });
    }
  }

  // ---- every eighth of a second ----

  tick() {
    const { capri } = this;
    const now = performance.now();
    const mood = this.mood;
    // her stance goes with the song: her head along with one she's into, bouncing to one she loves, still for a boring one
    const kind = !mood || reducedMotion.matches || capri.mode === 'work' || this.verdict === 'meh' ? null : this.verdict === 'love' ? 'groove' : 'listen';
    capri.setGroove(kind ? { kind, rate: tempo(this.song) } : null);

    const awake = !capri.hidden && !capri.stowed && !capri.dormant && capri.mode !== 'sleep';
    if (kind && awake && now > this.nextNote && !reducedMotion.matches) {
      this.nextNote = now + (kind === 'groove' ? rand(1100, 2400) : rand(2600, 5200));
      this.notes(1);
    }
    if (kind && this.verdict && this.verdict !== 'meh' && now > this.nextDance && this.free) {
      this.nextDance = now + (this.verdict === 'love' ? rand(18000, 32000) : rand(40000, 80000));
      capri.gesture('dance');
    }

    // a boring song: she lasts a while, yawns, and dozes off; woken up while it still plays, she gives it another go
    if (mood && this.verdict === 'meh' && !capri.napping) {
      if (!this.dozeAt) this.dozeAt = now + rand(90000, 150000);
      else if (now > this.dozeAt && this.free) {
        this.dozeAt = 0;
        this.doze();
      }
    }

    this.follow(awake && !this.panel.visible && capri.mode !== 'work');
  }

  notes(count) {
    const { capri } = this;
    if (reducedMotion.matches || capri.hidden || capri.stowed || capri.dormant) return;
    const h = capri.head();
    for (let i = 0; i < count; i++) {
      const dir = i % 2 ? -capri.towardCenter() : capri.towardCenter();
      this.fx.note(h.x + dir * (24 + i * 8) * capri.scale, h.top + 14, { dir });
    }
    if (this.verdict === 'love' && Math.random() < 0.3) this.fx.hearts(h.x, h.top + 6, { count: 1 });
  }

  async doze() {
    const { capri, panel } = this;
    await capri.perform('yawn', capri.towardCenter());
    if (capri.mode !== 'idle' || !this.playing || this.verdict !== 'meh' || capri.busy) return;
    this.voice.say('yawn');
    if (!panel.visible && Math.random() < 0.75) panel.say({ kind: 'info', face: 'bored', badge: '♪', line: T(pick(NAP_LINES)), hold: 3600 });
    if (capri.nap() && !reducedMotion.matches) {
      this.fx.zzz(() => (capri.napping && !capri.hidden && !capri.dormant ? { ...capri.head(), dir: capri.towardCenter() } : null));
    }
  }

  // ---- the words ----

  // The line being sung, over her head (not while she talks, works or sleeps: she isn't following then).
  follow(free) {
    const lines = this.words.song === this.song && this.cfg.lyrics !== false && this.playing && this.cfg.music !== 'off' ? this.words.lines : null;
    let at = -1;
    if (lines && free) {
      const pos = this.position() + LEAD_S;
      at = lineAt(lines, pos);
      if (at >= 0 && (!lines[at].text || (at === lines.length - 1 && pos - lines[at].t > LAST_S))) at = -1;
    }
    if (at === this.shown && (at < 0 || this.lineEl.textContent === lines[at].text)) return;
    this.shown = at;
    if (at < 0) {
      this.el.hidden = true;
      return;
    }
    this.lineEl.textContent = lines[at].text;
    this.el.hidden = false;
    this.el.classList.remove('is-new');
    void this.el.offsetWidth; // the swap plays again for every line
    this.el.classList.add('is-new');
    this.place();
  }

  // Over her head, its middle on her face, kept on screen; under her feet when she's at the top of it.
  // It stays put while she bobs to the beat (only she moves), so it reads easily.
  place(anchor = this.anchor) {
    this.anchor = anchor;
    if (!anchor || this.el.hidden) return;
    const margin = 14;
    const w = this.el.offsetWidth;
    const h = this.el.offsetHeight;
    const left = clamp(anchor.x - w / 2, margin, innerWidth - w - margin);
    let top = anchor.top - this.capri.bob - h - 12;
    if (top < margin) top = anchor.y + 60 * this.capri.scale + 40;
    this.el.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
  }
}

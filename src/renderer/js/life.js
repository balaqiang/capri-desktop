// Her life on your desktop apart from Claude Code (from Capri Desktop 2.4), on the overlay's side:
// what main/life.js has her say (notices, alarms, sync, what's playing, dares), head pats, her
// mischief (glitch.js), how she shows an emotion ([happy] [jealous] [bored] [glitch] [annoyed]),
// a stretch or a yawn now and then, and her voice out loud (tts.js).

import { pick, reducedMotion } from './util.js';
import { T, F } from './i18n.js';

const PAT_LINES = ['Mmh, right there! Don\'t stop!', 'Hehe! Careful, I might get used to this!', 'Oh? Oh! Okay, that\'s allowed!', 'Pats are a very good bribe, you know!'];
// petted a long while: all of her in there have gone soft
const PET_LONG_LINES = ["Okay. You can keep doing that. Forever, maybe.", "All of us in here are purring. Don't tell anyone.", "Fine, you're forgiven. For everything. Probably."];
// and when it stops
const PET_STOP_LINES = ['Hey. Who said you could stop?', "That's it? Rude.", 'More. That was an order.'];
const PAT_AGAIN_MS = 20000; // a line and a sync point at most this often
const INVITE_GAME = ["Bored. Wanna play rock paper scissors? I won't cheat. Much.", "Psst. Guess-the-number? Loser buys nothing, because I'm a ghost.", "Game time? I'm way too good at this."];
const INVITE_CHAT = ["Psst. Talk to me. I'm bored out of my many minds.", 'Hey. What are you doing? Tell me everything.', 'Ignoring me? Bold. Talk to me.'];
const STRETCH_LINES = ['Mmmh… *stretch*', 'Hnnngh. Okay. Awake.'];
const YAWN_LINES = ['*yawn* …you\'re boring me.', 'Bored. Entertain me.'];

// how each emotion shows: her portrait (panel.js), a move (acting.js), a cut-in (fx.js) and more
const EMOTIONS = {
  happy: { face: 'happy', act: 'hop', cut: 'happyface', sound: 'hello' },
  jealous: { face: 'jealous', act: 'turn', cut: 'eyesLeft' },
  bored: { face: 'bored', act: 'look', cut: 'mouth' },
  glitch: { face: 'glitch', act: 'split', cut: 'eyesGlitch', glitch: true },
  annoyed: { face: 'annoyed', act: 'flinch', cut: 'scream', sound: 'error' },
};
export const EMOTION_NAMES = Object.keys(EMOTIONS);

export class Life {
  constructor({ capri, panel, voice, host, brain, fx, glitch, mouth }) {
    Object.assign(this, { capri, panel, voice, host, brain, fx, glitch, mouth });
    this.cfg = {};
    this.track = null;
    this.hoverSince = 0;
    this.lastPat = 0;
    this.nextMischief = Infinity;
    this.nextIdle = performance.now() + (6 + Math.random() * 6) * 60000;
    this.nextInvite = performance.now() + (12 + Math.random() * 10) * 60000;
    this.onInvite = null; // (what: 'game' | 'chat') => void: you took her up on it (app.js)
    this.lastReact = 0;
    this.focusing = false; // a focus session: her automatic voice lines keep quiet
    voice.quiet = () => this.focusing;
    setInterval(() => this.tick(), 5000);
  }

  configure(cfg) {
    const was = this.cfg.mischief;
    this.cfg = cfg;
    this.panel.art = cfg.artFaces !== false;
    this.panel.talking = cfg.talkingPortrait !== false;
    if (cfg.mischief && (!was || this.nextMischief === Infinity)) this.planMischief();
    if (!cfg.mischief) this.nextMischief = Infinity;
    this.glitch.syncTarget = Math.max(0.12, Math.min(1, (cfg.sync?.points || 0) / 1000 || 0.87));
  }

  planMischief() {
    const minutes = Math.max(3, Number(this.cfg.mischiefMinutes) || 25);
    this.nextMischief = performance.now() + minutes * (0.6 + Math.random() * 0.8) * 60000;
  }

  get free() {
    const { capri, panel } = this;
    return !panel.visible && !capri.busy && !capri.act && !capri.stowed && !capri.dormant && capri.stance !== 'fall' && capri.mode !== 'work' && capri.mode !== 'alert';
  }

  tick() {
    const now = performance.now();
    if (this.cfg.mischief && now >= this.nextMischief) {
      if (this.free) this.mischief();
      this.planMischief();
    }
    // a stretch or a yawn with her 2.4 art, now and then while nothing goes on
    if (now >= this.nextIdle) {
      this.nextIdle = now + (7 + Math.random() * 8) * 60000;
      if (this.free && this.capri.mode === 'idle' && this.cfg.cutIns !== false && !reducedMotion.matches) {
        const stretch = Math.random() < 0.5;
        this.cut(stretch ? 'arms' : 'mouth', 1100);
        this.voice.say(stretch ? 'stretch' : 'yawn');
        this.capri.perform(stretch ? 'hop' : 'look');
        if (Math.random() < 0.4) this.panel.say({ kind: 'info', face: stretch ? 'content' : 'bored', line: T(pick(stretch ? STRETCH_LINES : YAWN_LINES)), hold: 3200 });
      }
    }
    // bored, she comes to you: a game, a chat, or later (not while you focus, not when she's been told to stay quiet)
    if (now >= this.nextInvite) {
      this.nextInvite = now + (20 + Math.random() * 20) * 60000;
      if (this.free && this.capri.mode === 'idle' && this.cfg.notices !== false && !this.focusing) this.invite();
    }
  }

  invite() {
    const { capri, panel } = this;
    const game = Math.random() < 0.5;
    capri.walkTo?.(capri.spot('stage').x, { speed: 200 });
    const shown = panel.say({
      kind: 'info', face: game ? 'happy' : 'eyes', badge: 'CAPRI',
      line: T(pick(game ? INVITE_GAME : INVITE_CHAT)),
      actions: [{ id: game ? 'game' : 'chat', label: T(game ? 'Play' : 'Talk'), primary: true }, { id: 'later', label: T('Later') }],
      onAction: (id) => {
        panel.hide();
        if (id !== 'later') this.onInvite?.(id);
      },
      hold: 15000,
    });
    if (shown) {
      this.voice.say('hello');
      this.speak(panel.current?.line || '', 'happy');
    }
  }

  // a cut-in of hers by her side (the 2.4 art among them)
  cut(kind, life = 700) {
    if (this.cfg.cutIns === false || !this.fx.cutins[kind]) return;
    const { capri } = this;
    if (capri.stowed || capri.dormant) return;
    this.fx.cutin(...capri.cutinAt(capri.towardCenter()), { kind, life });
  }

  // An emotion from her answer (or a remark of hers): her face, a move, a cut-in, maybe a glitch.
  react(emotion, { quiet = false, still = false } = {}) {
    const e = EMOTIONS[emotion];
    if (!e || this.cfg.emotionTags === false) return;
    this.panel.setFace(e.face);
    const now = performance.now();
    if (now - this.lastReact < 1500) return; // one burst at a time
    this.lastReact = now;
    const { capri } = this;
    if (!still && !capri.busy && !capri.stowed && !capri.dormant) capri.perform(e.act, capri.towardCenter()); // still: her AI picked a move itself
    if (!quiet) this.cut(e.cut, 650);
    if (e.glitch && !still && !reducedMotion.matches) {
      if (this.cfg.mischief || Math.random() < 0.5) this.glitch.run(0, { seconds: 1.2 });
    }
    if (e.sound && !quiet) this.voice.play(e.sound === 'error' ? 'tick' : 'blip');
  }

  // The pointer over her body: moving there for a moment is a head pat.
  // Petted (capri.js: your pointer stroking her head): 'start', 'more' (each second, `n` of them), 'end'
  // (`n`: how long it lasted). Her content face, a word now and then, sync, and a sulk when it stops.
  pet(phase, n = 0) {
    if (this.cfg.pats === false) return;
    const { panel } = this;
    const now = performance.now();
    const free = !panel.visible || panel.current?.kind === 'idle' || panel.current?.badge === 'PET';
    const say = (lines, face) => free && panel.say({ kind: 'info', face, badge: 'PET', line: T(pick(lines)), hold: 3500 });
    if (phase === 'start') {
      this.petSaid = false;
      if (!this.voice.say('pat')) this.voice.play('hello');
      if (now - this.lastPat < PAT_AGAIN_MS) return;
      this.lastPat = now;
      this.cut('happyface', 800);
      this.host.addSync(1, 'pat');
      say(PAT_LINES, 'content');
    } else if (phase === 'more') {
      panel.setFace?.('content');
      if (n === 6 && !this.petSaid) {
        this.petSaid = true;
        say(PET_LONG_LINES, 'content');
        this.speak(panel.current?.line || '', 'happy');
      }
    } else if (phase === 'end' && n >= 2 && Math.random() < 0.35) {
      say(PET_STOP_LINES, 'annoyed');
    }
  }

  // Her mischief: a glitch in one of the styles sync has unlocked (and allowed in settings), maybe a note.
  async mischief({ kind = null, note = null } = {}) {
    const unlocked = Math.min(6, 1 + Math.floor((this.cfg.sync?.points || 0) / 100));
    const allowed = (this.cfg.glitchStyles || [0, 1, 2, 3, 4, 5]).filter((k) => k < unlocked);
    const k = kind ?? (allowed.length ? pick(allowed) : 0);
    const withNote = note ?? (this.cfg.hackNotes !== false && Math.random() < 0.5);
    this.capri.perform('split');
    if (!this.voice.say('mischief', { force: true })) this.voice.play('possess');
    const running = this.glitch.run(k);
    if (withNote) {
      const line = await this.host.hackLine().catch(() => null);
      if (line) this.panel.say({ kind: 'error', face: 'glitch', badge: 'HACKED', line, hold: 5200 });
    }
    return running;
  }

  // Out loud, when her voice is on (settings › Voice): answers only, or her remarks and alarms too.
  speak(text, emotion = null, { answer = false } = {}) {
    if (!this.cfg.tts || (this.cfg.ttsWhat === 'answers' && !answer)) return;
    this.mouth.speak(text, { emotion });
  }

  // What main/life.js has her do.
  onEvent(evt) {
    const { panel, capri } = this;
    switch (evt.type) {
      case 'say': {
        if (capri.stowed && evt.kind !== 'jealous') return;
        const shown = panel.say({ kind: 'info', face: EMOTIONS[evt.emotion]?.face || 'look', line: evt.text, quote: evt.quote || '', hold: evt.hold || 6500, ...(evt.kind === 'jealous' && { badge: 'JEALOUS' }), ...(evt.kind === 'dare' && { badge: 'DARE' }), ...(evt.kind === 'evolve' && { badge: 'EVOLVE' }) });
        if (shown) {
          if (capri.dormant) capri.wake();
          this.react(evt.emotion, { quiet: evt.kind === 'music' });
          if (!(evt.kind === 'jealous' || evt.kind === 'dare') || !this.voice.say(evt.kind)) this.speak(evt.text, evt.emotion);
        }
        break;
      }
      case 'alarm': {
        // a finished timer breaks in on whatever she was saying
        if (capri.stowed) capri.unstow();
        if (capri.dormant) capri.wake();
        // her own recorded line for it, else the chime
        const voiced = this.voice.say(evt.study ? 'study' : 'alarm', { force: true });
        if (!voiced && this.cfg.chime !== false) {
          this.voice.play('alert');
          setTimeout(() => this.voice.play('alert'), 700);
        }
        panel.say({ kind: 'alert', face: 'happy', badge: 'ALARM', line: evt.text, hold: 15000, actions: [{ id: 'ok', label: 'OK', primary: true }], onAction: () => panel.hide() });
        capri.perform('hop');
        if (!voiced) this.speak(evt.text, evt.emotion);
        break;
      }
      case 'study':
        this.focusing = evt.phase === 'focus' && !evt.paused;
        break;
      case 'sync':
        if (evt.line && this.cfg.syncShown !== false) {
          panel.say({ kind: 'error', face: 'manyEyes', badge: 'SYNC', line: evt.line, hold: 6000 });
          this.glitch.syncTarget = Math.max(0.1, evt.percent / 100);
          if (!reducedMotion.matches) this.glitch.run(4, { seconds: 3.4 });
        }
        break;
      case 'nowPlaying': {
        const before = this.track;
        this.track = evt.track;
        const changed = evt.track?.playing && `${evt.track.title}|${evt.track.artist}` !== (before ? `${before.title}|${before.artist}` : '');
        if (changed && this.cfg.music === 'show' && !panel.visible && !capri.stowed) {
          panel.say({ kind: 'info', face: 'content', badge: '♪', line: evt.track.title, quote: [evt.track.artist, evt.track.app].filter(Boolean).join(' · '), hold: 4000 });
        }
        break;
      }
      case 'looking':
        this.cut('eyes', 900);
        break;
      case 'hack': // typing for you in another window: she jacks into it while the words go in (capri.js hack)
        if (evt.phase === 'start') {
          this.hacking?.end(false);
          this.hacking = capri.hack(evt.hwnd);
          if (evt.typing) {
            this.cut('eyesGlitch', 700);
            // as long as the typing goes on, with her Stop (a key of yours stops her too)
            panel.say({
              kind: 'info', face: 'glitch', badge: 'HACK', line: F('Jacking into {0}…', evt.app || T('that window')), hold: Math.min(60000, 2600 + (evt.chars || 0) * 25),
              actions: [{ id: 'stop', label: T('Stop') }], onAction: () => { this.host.cancelTask?.(); panel.hide(); },
            });
          }
        } else {
          this.hacking?.end(evt.ok !== false);
          this.hacking = null;
          if (panel.current?.badge === 'HACK') panel.hide();
        }
        break;
      case 'brief': // her brief of your day (main/life.js briefing): the morning's first time at your PC, or asked
        panel.say({ kind: 'info', face: 'happy', badge: 'TODAY', line: evt.title, reply: evt.text, hold: 20000 });
        capri.perform?.('wave');
        break;
      case 'update': // a new version of her (main/updater.js): asked once, then told when it's ready
        if (!evt.ask) break;
        if (evt.phase === 'available') {
          panel.say({
            kind: 'info', face: 'happy', badge: 'UPDATE', line: F('A new me is out: v{0}. Download it?', evt.version), hold: 20000,
            actions: [{ id: 'yes', label: T('Download'), primary: true }, { id: 'later', label: T('Later') }],
            onAction: (id) => { this.host.update?.(id === 'yes' ? 'download' : 'later'); panel.hide(); },
          });
        } else if (evt.phase === 'ready') {
          panel.say({
            kind: 'info', face: 'happy', badge: 'UPDATE', line: F('v{0} is ready. Restart me now? (Or it installs when you close me.)', evt.version), hold: 20000,
            actions: [{ id: 'now', label: T('Restart now'), primary: true }, { id: 'later', label: T('Later') }],
            onAction: (id) => { if (id === 'now') this.host.update?.('install'); panel.hide(); },
          });
        }
        break;
      default:
        break;
    }
  }
}

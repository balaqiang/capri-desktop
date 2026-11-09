// Her ears: she hears you through the microphone (settings › Voice).
//   push    she listens for one thing you say: click her mic, or the hotkey (Ctrl+Alt+V)
//   always  hands-free: she listens all the time, and what starts with her name ("Capri, …") reaches
//           her; right after she answers, a moment where her name isn't needed
// What you say is cut out of the sound (it starts when you speak, ends after a moment of quiet), turned
// into a 16 kHz WAV in memory, and written out by main/hearing.js (Whisper on this PC, Groq, OpenAI or
// Windows' own). Nothing is recorded to disk here. onHeard(text) gets the words.

import { Transcript, unfinished, LONGER_WAIT_MS } from './transcript.js';

const RATE = 16000;
const FRAME_MS = 20;
const PREROLL = 15;   // frames kept from before you started (300 ms)
const START_FRAMES = 3; // loud frames in a row that make it speech (60 ms)
const MIN_SPEECH_MS = 350;
const PARTIAL_EVERY = 1400;  // how often what you've said so far is written out
const PARTIAL_AFTER = 1200;  // not before you've said something
const PARTIAL_FRAMES = 500;  // the last 10 seconds of it
const DETECTOR_LAG = 250;    // the voice detector only says it's over a moment after it is
// her name as speech recognizers hear it (Windows' hears "Coppery", Whisper "Kapri"…)
export const MISHEARD = ['capri', 'kapri', 'caprie', 'capree', 'cappy', 'kepri', 'capry', 'coppery', 'copri', 'cabri', 'caprice', 'gabri', 'kaprie'];

export class Ears {
  constructor({ host, button }) {
    this.host = host;
    this.button = button; // her mic, next to her
    this.cfg = {};
    this.ctx = null;
    this.stream = null;
    this.node = null;
    this.deviceId = null;
    this.mode = 'off';
    this.armed = false;   // push: listening for one phrase
    this.speaking = false; // her TTS is talking: deaf meanwhile
    this.busy = false;    // a phrase being written out
    this.noise = 0.004;   // the room's own level, followed slowly
    this.loud = 0;
    this.pre = [];
    this.take = null;     // { frames: [], quiet, voiced }
    this.followUntil = 0;
    this.level = 0;
    this.onHeard = null;  // (text, { wake }) => void
    this.onName = null;   // () => void: her name, the moment you said it (main/wake.js)
    this.nameBuf = [];    // the last 100 ms, on its way to main (is it a voice? her name?)
    this.vadAlive = false;  // the voice detector answers (main/vad.js); until then, loudness alone
    this.vadSpeech = false;
    this.transcript = new Transcript();
    this.partialBusy = false;
    this.partialOff = false; // her ears aren't Whisper on this PC: no words as you say them
    this.lastPartial = 0;
    this.onPartial = null;  // ({ text, stable, tail } | null) => void: only ever for showing
    this.nameCount = 0;
    this.namedAt = 0;
    this.onState = null;  // (state: 'idle' | 'listening' | 'hearing' | 'thinking' | 'error', detail) => void
    this.onError = null;  // (code, message) => void
    button?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });
  }

  configure(cfg) {
    const before = this.cfg;
    this.cfg = cfg;
    this.partialOff = false;
    if (cfg.sttVad === false) this.vadAlive = this.vadSpeech = false;
    const mode = cfg.listen || 'off';
    if (this.button) this.button.hidden = mode === 'off' || cfg.micButton === false || cfg.visible === false;
    const deviceChanged = before.micDevice !== cfg.micDevice;
    if (mode !== this.mode || deviceChanged) {
      this.mode = mode;
      this.armed = false;
      if (mode === 'always') this.open().catch((err) => this.fail('nomic', err.message));
      else this.close();
      this.setState(this.mode === 'always' ? 'listening' : 'idle');
    }
  }

  // the microphone, opened (once), wired to the worklet
  async open() {
    if (this.stream && this.deviceId === (this.cfg.micDevice || '')) return;
    this.close();
    this.deviceId = this.cfg.micDevice || '';
    const audio = { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true };
    if (this.deviceId) audio.deviceId = { exact: this.deviceId };
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio });
    } catch (err) {
      if (!this.deviceId) throw err;
      // that microphone went away: Windows' default instead
      delete audio.deviceId;
      this.stream = await navigator.mediaDevices.getUserMedia({ audio });
    }
    this.ctx = new AudioContext(); // the device's own rate: the worklet brings it down to 16 kHz
    await this.ctx.audioWorklet.addModule('js/ears-worklet.js');
    const source = this.ctx.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.ctx, 'capri-ears');
    this.node.port.onmessage = ({ data }) => this.frame(data.rms, data.samples);
    source.connect(this.node);
    // the worklet only runs when pulled: into a silent gain, never the speakers
    const mute = this.ctx.createGain();
    mute.gain.value = 0;
    this.node.connect(mute).connect(this.ctx.destination);
  }

  close() {
    this.node?.port.close();
    this.node?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close().catch(() => {});
    this.node = this.stream = this.ctx = null;
    this.take = null;
    this.pre = [];
    this.vadSpeech = false;
  }

  // threshold from her sensitivity (settings): 0 -> only a loud voice, 100 -> a whisper
  get threshold() {
    const s = Math.min(100, Math.max(0, Number(this.cfg.micSensitivity ?? 55))) / 100;
    const absolute = 0.045 * Math.pow(0.12, s); // 0.045 .. 0.0054
    return Math.max(absolute, this.noise * 3.2);
  }

  get listening() {
    return Boolean(this.stream) && !this.speaking && !this.busy && (this.mode === 'always' || this.armed);
  }

  // the sound as it comes, in 100 ms pieces, to main: is it a voice (vad.js), and her name while she's waiting for it (wake.js)
  feedMain(samples) {
    if (!this.host.earsAudio) return;
    this.nameBuf.push(samples);
    this.nameCount += samples.length;
    if (this.nameCount < 1600) return;
    const all = new Float32Array(this.nameCount);
    let at = 0;
    for (const f of this.nameBuf) {
      all.set(f, at);
      at += f.length;
    }
    this.nameBuf = [];
    this.nameCount = 0;
    this.host.earsAudio(all, this.mode === 'always' && this.cfg.wakeWord !== false && this.cfg.wakeLocal !== false);
  }

  // the voice detector's word
  speechSignal(on) {
    this.vadAlive = this.cfg.sttVad !== false;
    this.vadSpeech = Boolean(on);
  }

  // what you've said so far, written out now and then while you're still talking. Only ever shown.
  maybePartial(take) {
    if (this.partialOff || this.cfg.sttPartials === false || this.partialBusy || !this.host.transcribePartial) return;
    const now = performance.now();
    if (!take.sawSpeech || take.frames.length * FRAME_MS < PARTIAL_AFTER || now - this.lastPartial < PARTIAL_EVERY) return;
    this.lastPartial = now;
    this.partialBusy = true;
    this.host.transcribePartial(toWav(take.frames.slice(-PARTIAL_FRAMES))).then((res) => {
      this.partialBusy = false;
      if (res?.off) this.partialOff = true;
      else if (this.take === take && res?.ok && res.text) this.showPartial(res.text, take);
    }, () => { this.partialBusy = false; });
  }

  showPartial(text, take) {
    const seen = this.transcript.partial(text);
    take.partial = seen.text;
    // listening all the time: only what's said to her is shown, not everything said in the room
    const forHer = this.mode !== 'always' || this.cfg.wakeWord === false || performance.now() <= this.followUntil || take.namedAfter !== undefined || stripWake(text, this.cfg.wakeWords) !== null;
    if (!forHer) return;
    if (!take.prepped) {
      take.prepped = true;
      this.host.voicePrep?.(); // her model woken up in the meantime; nothing is done with the words
    }
    this.onPartial?.(seen);
  }

  // her wake word heard it: she reacts now, and the words that come after count as said to her
  nameHeard() {
    this.namedAt = performance.now();
    if (this.take) this.take.namedAfter ??= this.take.frames.length * FRAME_MS;
    this.onName?.();
  }

  frame(rms, samples) {
    this.level = this.level * 0.7 + rms * 0.3;
    this.button?.style.setProperty('--level', Math.min(1, this.level / 0.08).toFixed(3));
    if (!this.listening) {
      this.pre = [];
      this.take = null;
      return;
    }
    this.feedMain(samples);
    const loud = rms > this.threshold;
    if (!this.take) {
      // the room's own sound, followed while nobody talks (faster down than up)
      this.noise = rms < this.noise ? this.noise * 0.9 + rms * 0.1 : this.noise * 0.995 + rms * 0.005;
      this.pre.push(samples);
      if (this.pre.length > PREROLL) this.pre.shift();
      this.loud = loud ? this.loud + 1 : 0;
      if (this.loud >= START_FRAMES) {
        this.take = { frames: [...this.pre], quiet: 0, voiced: this.loud, sawSpeech: this.vadSpeech || !this.vadAlive };
        this.pre = [];
        this.setState('hearing');
      }
      return;
    }
    const take = this.take;
    take.frames.push(samples);
    if (this.vadSpeech) take.sawSpeech = true;
    if (this.vadAlive ? this.vadSpeech : loud) {
      take.voiced++;
      take.quiet = 0;
    } else {
      take.quiet += FRAME_MS;
    }
    this.maybePartial(take);
    // the sentence is over after a moment of quiet, a little longer when it stopped on "and" or "yang"
    const wait = (Number(this.cfg.silenceMs) || 900) - (this.vadAlive ? DETECTOR_LAG : 0) + (unfinished(take.partial) ? LONGER_WAIT_MS : 0);
    const long = take.frames.length * FRAME_MS >= (Number(this.cfg.maxUtterance) || 15) * 1000;
    if (take.quiet >= wait || long) this.finish();
  }

  // push to talk: listen for one phrase (again: send what was heard so far, or stop)
  async toggle() {
    if (this.mode === 'off') return;
    if (this.take) {
      this.finish();
      return;
    }
    if (this.mode === 'always') {
      // in hands-free, a click is your name: what comes next needs no "Capri"
      this.followUntil = performance.now() + 10000;
      this.setState('listening', 'follow');
      return;
    }
    if (this.armed) {
      this.armed = false;
      this.setState('idle');
      this.close();
      return;
    }
    try {
      await this.open();
    } catch (err) {
      this.fail('nomic', err.message);
      return;
    }
    this.armed = true;
    this.noise = 0.004;
    this.setState('listening');
    // nothing said within a while: she stops listening
    clearTimeout(this.armTimer);
    this.armTimer = setTimeout(() => {
      if (this.armed && !this.take) {
        this.armed = false;
        this.setState('idle');
        this.onError?.('silent', '');
        if (this.mode === 'push') this.close();
      }
    }, 9000);
  }

  async finish() {
    const take = this.take;
    this.take = null;
    if (!take) return;
    this.host.cancelPartial?.();
    this.transcript.reset();
    this.onPartial?.(null);
    const wasPush = this.mode === 'push';
    if (wasPush) {
      this.armed = false;
      clearTimeout(this.armTimer);
    }
    // loud, but no voice in it (a door, a keyboard, a song): nothing to write out
    if (this.vadAlive ? !take.sawSpeech : take.voiced * FRAME_MS < MIN_SPEECH_MS) {
      this.setState(this.mode === 'always' ? 'listening' : 'idle');
      if (wasPush) this.close();
      return;
    }
    // the trailing quiet goes, but not all of it (Whisper likes a little)
    const keep = take.frames.slice(0, Math.max(1, take.frames.length - Math.floor(take.quiet / FRAME_MS) + 10));
    const wav = toWav(keep);
    if (wasPush) this.close();
    this.busy = true;
    this.setState('thinking');
    const res = await this.host.transcribe(wav).catch((err) => ({ ok: false, error: err.message }));
    this.busy = false;
    this.setState(this.mode === 'always' ? 'listening' : 'idle');
    if (!res.ok) {
      this.onError?.(res.error === 'noears' ? 'noears' : 'failed', res.error);
      return;
    }
    let text = (res.text || '').trim();
    if (!text || /^[\s.!?,…-]*$/.test(text)) return;
    let wake = true;
    if (this.mode === 'always' && this.cfg.wakeWord !== false && performance.now() > this.followUntil) {
      const stripped = stripWake(text, this.cfg.wakeWords);
      // her name wasn't in the words, but she heard it: a name written out wrong ("Gabby, open notepad")
      const named = take.namedAfter !== undefined;
      if (stripped === null && !named) return; // not for her
      text = stripped ?? (take.namedAfter < 1600 ? text.replace(/^\S+[,.!?:;]?\s*/, '') : text);
      wake = true;
    }
    if (!text) {
      // just her name: she's listening, say the rest
      this.followUntil = performance.now() + 10000;
      this.onHeard?.('', { wake: true, onlyName: true });
      return;
    }
    this.onHeard?.(text, { wake });
  }

  // she answered: a moment where her name isn't needed
  follow() {
    const s = Number(this.cfg.followUpSeconds ?? 8);
    if (s > 0) this.followUntil = performance.now() + s * 1000;
  }

  setSpeaking(on) {
    this.speaking = Boolean(on) && this.cfg.muteWhileSpeaking !== false;
    if (this.speaking) this.take = null;
  }

  fail(code, message) {
    this.mode = 'off';
    this.setState('error', message);
    this.onError?.(code, message);
  }

  setState(state, detail) {
    if (this.button) {
      this.button.dataset.state = state;
      this.button.dataset.mode = this.mode;
    }
    this.onState?.(state, detail);
  }
}

// "Capri, open Spotify" -> "open Spotify"; null when her name isn't near the start.
export function stripWake(text, words = 'capri') {
  const names = String(words || 'capri').split(',').map((w) => w.trim().toLowerCase()).filter(Boolean)
    .concat(MISHEARD);
  const escaped = [...new Set(names)].map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const re = new RegExp(`^(?:\\W*(?:hey|hi|hai|halo|ok|okay|yo|eh|oi|woy)\\W+)?\\W*(?:${escaped})\\b[\\s,.!?:;-]*`, 'i');
  const m = re.exec(text);
  if (!m) {
    // her name somewhere in the first few words still counts ("ok so Capri, ...")
    const near = new RegExp(`^(?:\\S+\\s+){0,3}?(?:${escaped})\\b[\\s,.!?:;-]*`, 'i').exec(text);
    return near ? text.slice(near[0].length).trim() : null;
  }
  return text.slice(m[0].length).trim();
}

function toWav(frames) {
  const count = frames.reduce((n, f) => n + f.length, 0);
  const buffer = new ArrayBuffer(44 + count * 2);
  const view = new DataView(buffer);
  const text = (at, s) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + count * 2, true);
  text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, RATE, true);
  view.setUint32(28, RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, count * 2, true);
  let at = 44;
  for (const f of frames) {
    for (let i = 0; i < f.length; i++) {
      const v = Math.max(-1, Math.min(1, f[i]));
      view.setInt16(at, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      at += 2;
    }
  }
  return buffer;
}

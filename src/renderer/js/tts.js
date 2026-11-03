// Her voice out loud (settings › Voice › Her voice).
// Windows' own voices are spoken here by the browser's speech synthesis. Every other engine (OpenAI,
// ElevenLabs with a cloned voice, your own TTS server, Piper: main/mouth.js) comes back as audio, and
// goes through her voice effects before your speakers:
//   construct  her many minds: two more copies of her voice, a hair off in pitch and time, left and right
//   glitch     that, plus syllables stuttering and a bit-crushed edge
//   radio      thin and crackly, like through the Net
// Her emotion ([glitch] most of all) adds to it. onLevel(level) follows how loud she is, for her lips.

const clean = (text) => String(text || '')
  .replace(/\[\[[^\]]*\]\]/g, '')
  .replace(/\[[a-z]+\]/gi, '')
  .replace(/\*[^*]*\*/g, '')
  .replace(/https?:\/\/\S+/g, '')
  .replace(/\s+/g, ' ')
  .trim();

export class Mouth {
  constructor({ host = null, voice = null } = {}) {
    this.host = host;
    this.voice = voice;   // her sounds (voice.js): its AudioContext is shared
    this.cfg = {};
    this.turn = 0;        // the line being said; a newer one stops it
    this.playing = null;  // { sources, stop }
    this.onSpeaking = null; // (on) => void: her ears close meanwhile (ears.js)
    this.onLevel = null;  // (0..1 | null) => void: how loud she is right now, null once she's done (her lips)
    this.onError = null;  // ({ error, code, engine }) => void
    this.voices = [];
    const load = () => { this.voices = speechSynthesis.getVoices(); };
    load();
    speechSynthesis.addEventListener('voiceschanged', load);
  }

  configure(cfg) {
    this.cfg = cfg;
    if (!cfg.tts || cfg.muted) this.stop();
  }

  // Windows: the voice picked in settings, else one in the language she answers in
  windowsVoice(langHint) {
    const { ttsVoice } = this.cfg;
    if (ttsVoice) {
      const v = this.voices.find((x) => x.name === ttsVoice);
      if (v) return v;
    }
    const want = langHint || 'en';
    return this.voices.find((v) => v.lang?.toLowerCase().startsWith(want)) || this.voices.find((v) => v.default) || this.voices[0] || null;
  }

  // Say it. force: even with her voice off (a test). Resolves once she has started (or couldn't).
  async speak(text, { force = false, emotion = null } = {}) {
    if ((!this.cfg.tts && !force) || this.cfg.muted) return false;
    const line = clean(text);
    if (!line) return false;
    this.stop();
    const turn = ++this.turn;
    const engine = this.cfg.ttsEngine || 'windows';
    if (engine === 'windows' || !this.host?.ttsSpeak) return this.speakWindows(line, turn);
    const res = await this.host.ttsSpeak(line, emotion).catch((err) => ({ ok: false, error: err.message }));
    if (turn !== this.turn) return false; // something newer meanwhile
    if (!res.ok) {
      console.warn('[capri] her voice:', res.error);
      this.onError?.(res);
      return this.cfg.ttsFallback !== false ? this.speakWindows(line, turn) : false;
    }
    try {
      const ctx = this.voice.ensure();
      if (ctx.state === 'suspended') await ctx.resume();
      const buffer = await ctx.decodeAudioData(res.audio);
      if (turn !== this.turn) return false;
      this.play(ctx, buffer, emotion);
      return true;
    } catch (err) {
      console.warn('[capri] her voice would not play:', err);
      return this.cfg.ttsFallback !== false ? this.speakWindows(line, turn) : false;
    }
  }

  speakWindows(line, turn) {
    const reply = this.cfg.replyLanguage;
    const hint = reply === 'mix' || reply === 'id' ? 'id' : reply === 'en' ? 'en' : (document.documentElement.lang || 'en');
    const u = new SpeechSynthesisUtterance(line);
    const voice = this.windowsVoice(hint);
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    }
    u.rate = Number(this.cfg.ttsRate) || 1;
    u.pitch = Number(this.cfg.ttsPitch) || 1;
    u.volume = Math.min(1, Math.max(0, Number(this.cfg.ttsVolume ?? 0.9)));
    // no sound to follow here: her lips move on a beat, a word at a time
    let flap = null;
    u.onstart = () => {
      this.onSpeaking?.(true);
      let open = false;
      flap = setInterval(() => { open = !open; this.onLevel?.(open ? 0.2 : 0); }, 110);
    };
    const done = () => {
      clearInterval(flap);
      if (turn === this.turn) this.onLevel?.(null);
      setTimeout(() => this.onSpeaking?.(false), 250);
    };
    u.onend = done;
    u.onerror = done;
    speechSynthesis.speak(u);
    return true;
  }

  // Her voice through her effects, with a meter on it for her lips.
  play(ctx, buffer, emotion) {
    const cfg = this.cfg;
    const effect = cfg.ttsEffect || 'construct';
    const rate = Math.min(1.4, Math.max(0.8, Number(cfg.ttsShift) || 1));
    const minds = Math.min(1, Math.max(0, Number(cfg.ttsMinds ?? 35) / 100));
    const glitchy = effect === 'glitch' || (cfg.ttsEmotion !== false && emotion === 'glitch');
    const t0 = ctx.currentTime + 0.03;
    const sources = [];

    const out = ctx.createGain();
    out.gain.value = Math.min(1, Math.max(0, Number(cfg.ttsVolume ?? 0.9)));
    const meter = ctx.createAnalyser();
    meter.fftSize = 1024;
    out.connect(meter);
    meter.connect(ctx.destination);

    // what the voice goes through before her volume
    let into = out;
    if (effect === 'radio') {
      const low = ctx.createBiquadFilter();
      low.type = 'highpass';
      low.frequency.value = 420;
      const high = ctx.createBiquadFilter();
      high.type = 'lowpass';
      high.frequency.value = 3300;
      const grit = ctx.createWaveShaper();
      grit.curve = curve((x) => Math.tanh(x * 2.6));
      low.connect(high).connect(grit).connect(out);
      into = low;
    }
    if (glitchy) {
      // a bit-crushed copy under the clean one
      const crush = ctx.createWaveShaper();
      crush.curve = curve((x) => Math.round(x * 6) / 6);
      const crushMix = ctx.createGain();
      crushMix.gain.value = 0.22;
      crush.connect(crushMix).connect(into);
      const dry = ctx.createGain();
      dry.connect(into);
      dry.connect(crush);
      into = dry;
    }

    const voice = (when, offset, duration, gain, { detune = 1, pan = 0, delay = 0 } = {}) => {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = rate * detune;
      let node = src;
      const g = ctx.createGain();
      g.gain.value = gain;
      node.connect(g);
      node = g;
      if (pan) {
        const p = ctx.createStereoPanner();
        p.pan.value = pan;
        node.connect(p);
        node = p;
      }
      node.connect(into);
      src.start(when + delay, offset, duration);
      sources.push(src);
      return src;
    };

    const main = voice(t0, 0, undefined, 1);
    if ((effect === 'construct' || effect === 'glitch') && minds > 0) {
      // the other minds in her: a little lower and late on the left, a little higher and later on the right
      voice(t0, 0, undefined, minds * 0.55, { detune: 0.972, pan: -0.65, delay: 0.021 });
      voice(t0, 0, undefined, minds * 0.45, { detune: 1.034, pan: 0.65, delay: 0.037 });
    }
    if (glitchy && buffer.duration > 0.8) {
      // a syllable or two catching, like a skipping chip
      const hits = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < hits; i++) {
        const at = 0.15 + Math.random() * (buffer.duration - 0.5);
        for (let k = 1; k <= 2; k++) voice(t0 + at / rate + k * 0.075, at, 0.07, 0.8, { pan: k % 2 ? -0.3 : 0.3 });
      }
    }

    const data = new Float32Array(meter.fftSize);
    let raf = 0;
    let lastLevel = 0;
    const follow = () => {
      meter.getFloatTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
      const level = Math.sqrt(sum / data.length);
      lastLevel = lastLevel * 0.5 + level * 0.5;
      this.onLevel?.(lastLevel);
      raf = requestAnimationFrame(follow);
    };
    let stopped = false;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
      for (const s of sources) {
        try { s.stop(); } catch { /* already over */ }
      }
      setTimeout(() => out.disconnect(), 200);
      this.onLevel?.(null);
      setTimeout(() => this.onSpeaking?.(false), 250);
      if (this.playing?.stop === stop) this.playing = null;
    };
    main.onended = stop;
    this.playing = { sources, stop };
    this.onSpeaking?.(true);
    follow();
  }

  stop() {
    this.turn++;
    if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel();
    this.playing?.stop();
  }
}

function curve(fn, n = 2048) {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) c[i] = fn((i / (n - 1)) * 2 - 1);
  return c;
}

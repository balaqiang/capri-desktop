// Her settings window: who she is, who you are, her ears and voice, her brain, what she does on her
// own, timers, and the advanced bits. Everything is saved as you change it (main.js settings:set);
// API keys only go through settings:key and never come back here.

import { DEFAULT_PERSONA } from '../renderer/js/persona.js';

const api = window.settings;
let state = null;   // what main.js sends (settings:get)
let lines = {};     // her translations (assets/lang)
let page = (location.hash || '#capri').slice(1);
let cleanup = [];   // what the page on screen left running (a mic, a meter)
let earsProgress = null;

const T = (english) => lines[english] || english;
const F = (english, ...v) => T(english).replace(/\{(\d+)\}/g, (_, i) => (v[i] ?? ''));
const cfg = () => state.config;

// ---- little DOM helpers ------------------------------------------------------------------------------

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (k === 'style') node.style.cssText = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

const card = (title, ...rows) => el('section', { class: 'card' }, title && el('h2', { class: 'card__title', text: T(title) }), ...rows);
const row = (label, help, ...controls) => el('div', { class: 'row' },
  el('label', { class: 'row__label' }, T(label), help && el('span', { class: 'row__help', text: T(help) })),
  el('div', { class: 'row__control' }, ...controls));
const stack = (label, help, ...controls) => el('div', { class: 'row row--stack' },
  el('div', { class: 'row__label' }, T(label), help && el('span', { class: 'row__help', text: T(help) })),
  el('div', { class: 'row__control' }, ...controls));
const note = (text) => el('p', { class: 'note', text: T(text) });
const button = (label, onclick, kind = '') => el('button', { class: `btn ${kind ? `btn--${kind}` : ''}`, type: 'button', onclick, text: T(label) });

// a value at a path of her config ("traits.sass"), and the patch that changes it
function get(path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), cfg());
}
function patchFor(path, value) {
  const [top, ...rest] = path.split('.');
  if (!rest.length) return { [top]: value };
  return { [top]: { ...(cfg()[top] || {}), [rest[0]]: value } };
}

let saving = Promise.resolve();
function save(patch, { quiet = true } = {}) {
  // in order, one after the other, so two quick changes don't undo each other
  saving = saving.then(async () => {
    const res = await api.set(patch);
    if (res) state = res;
    renderSync();
    if (!quiet) toast(T('Saved.'));
  });
  return saving;
}

function toggle(path, { onChange } = {}) {
  const input = el('input', { type: 'checkbox', role: 'switch' });
  input.checked = Boolean(get(path));
  input.addEventListener('change', async () => {
    await save(patchFor(path, input.checked));
    onChange?.(input.checked);
  });
  return el('span', { class: 'switch' }, input, el('span'));
}

// A choice: ◁ the value ▷, the way Night City's menus do it (←/→ too, its marks under it), or a drop-down
// for a long list.
function select(path, options, { onChange } = {}) {
  if (options.length > 8) return dropdown(path, options, { onChange });
  const at = () => Math.max(0, options.findIndex(([v]) => String(v) === String(get(path) ?? '')));
  const value = el('span', { class: 'step__value' });
  const pips = el('span', { class: 'step__pips', 'aria-hidden': 'true' }, options.map(() => el('i')));
  const wrap = el('div', { class: 'step', role: 'spinbutton', tabindex: '0', 'aria-valuemin': '0', 'aria-valuemax': String(options.length - 1) });
  const paint = () => {
    const i = at();
    value.textContent = T(options[i][1]);
    wrap.setAttribute('aria-valuenow', String(i));
    wrap.setAttribute('aria-valuetext', value.textContent);
    pips.querySelectorAll('i').forEach((p, j) => p.classList.toggle('is-on', j === i));
  };
  const go = async (by) => {
    const next = options[(at() + by + options.length) % options.length];
    await save(patchFor(path, next[0]));
    paint();
    onChange?.(String(next[0]));
  };
  wrap.append(
    el('button', { type: 'button', class: 'step__arrow', tabindex: '-1', 'aria-label': T('Previous'), onclick: () => go(-1) }, '◁'),
    el('span', { class: 'step__mid' }, value, pips),
    el('button', { type: 'button', class: 'step__arrow', tabindex: '-1', 'aria-label': T('Next'), onclick: () => go(1) }, '▷'),
  );
  wrap.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      go(e.key === 'ArrowLeft' ? -1 : 1);
    }
  });
  paint();
  return wrap;
}

function dropdown(path, options, { onChange } = {}) {
  const s = el('select', {}, options.map(([value, label]) => el('option', { value, text: T(label) })));
  s.value = String(get(path) ?? '');
  s.addEventListener('change', async () => {
    const opt = options.find(([v]) => String(v) === s.value);
    await save(patchFor(path, opt ? opt[0] : s.value));
    onChange?.(s.value);
  });
  return s;
}

function seg(path, options, { onChange } = {}) {
  const wrap = el('div', { class: 'seg', role: 'group' });
  const paint = () => wrap.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === String(get(path)))));
  for (const [value, label] of options) {
    wrap.append(el('button', {
      type: 'button', 'data-v': value, text: T(label),
      onclick: async () => {
        await save(patchFor(path, value));
        paint();
        onChange?.(value);
      },
    }));
  }
  paint();
  return wrap;
}

function range(path, min, max, step, show = (v) => v) {
  const input = el('input', { type: 'range', min, max, step });
  input.value = get(path);
  const out = el('span', { class: 'range__value', text: show(Number(input.value)) });
  // the cyan part of the bar, up to the handle
  const fill = () => input.style.setProperty('--fill', `${((Number(input.value) - min) / (max - min || 1)) * 100}%`);
  fill();
  input.addEventListener('input', () => { out.textContent = show(Number(input.value)); fill(); });
  input.addEventListener('change', () => save(patchFor(path, Number(input.value))));
  return [input, out];
}

function text(path, { placeholder = '', type = 'text', max = 500 } = {}) {
  const input = el('input', { type, placeholder: T(placeholder), maxlength: max, spellcheck: 'false' });
  input.value = get(path) ?? '';
  input.addEventListener('change', () => save(patchFor(path, input.value.trim())));
  return input;
}

function number(path, min, max) {
  const input = el('input', { type: 'number', min, max });
  input.value = get(path);
  input.addEventListener('change', () => {
    const v = Math.min(max, Math.max(min, Number(input.value) || min));
    input.value = v;
    save(patchFor(path, v));
  });
  return input;
}

// a list you add to and take from (her notes, your lines)
function listEditor(path, { placeholder, max = 60, empty, shape = (v) => v }) {
  const wrap = el('div', { class: 'list' });
  const draw = () => {
    const items = get(path) || [];
    wrap.replaceChildren(
      ...(items.length ? items.map((item, i) => el('div', { class: 'list__item' },
        el('span', { class: 'list__text', text: item }),
        el('button', { class: 'list__x', type: 'button', title: T('Remove'), text: '✕', onclick: async () => { await save(patchFor(path, items.filter((_, j) => j !== i))); draw(); } })))
        : [el('div', { class: 'list__empty', text: T(empty) })]),
      (() => {
        const input = el('input', { type: 'text', placeholder: T(placeholder), maxlength: 200 });
        const add = async () => {
          const v = shape(input.value.trim());
          if (!v) return;
          await save(patchFor(path, [...(get(path) || []).filter((x) => x !== v), v].slice(-max)));
          draw();
          wrap.querySelector('.list__add input')?.focus();
        };
        input.addEventListener('keydown', (e) => e.key === 'Enter' && add());
        return el('div', { class: 'list__add' }, input, button('Add', add));
      })(),
    );
  };
  draw();
  return wrap;
}

function toast(message, error = false) {
  const t = document.getElementById('toast');
  t.textContent = message;
  t.classList.toggle('is-error', error);
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 2600);
}

async function act(name, arg) {
  const res = await api.action(name, arg);
  if (res?.config) state = res;
  return res;
}

// ---- pages -----------------------------------------------------------------------------------------

const TRAIT_LABELS = [
  ['sass', 'Sass', 'How opinionated and snarky she is.'],
  ['mischief', 'Mischief', 'Teasing, pranks, little traps.'],
  ['jealousy', 'Jealousy', 'How she takes it when you use another AI.'],
  ['affection', 'Affection', 'Cold and distant, or clingy in her unsettling way.'],
  ['chattiness', 'Chattiness', 'How much she says (always within the reply length).'],
];

function pageCapri() {
  const persona = el('textarea', { spellcheck: 'false', rows: 11 });
  persona.value = cfg().capriPersona || DEFAULT_PERSONA;
  const savePersona = () => save({ capriPersona: persona.value.trim() === DEFAULT_PERSONA.trim() ? '' : persona.value.trim() }, { quiet: false });
  const percent = (v) => `${v}%`;
  const scale = (v) => `${Math.round(v * 100)}%`;
  return [
    card('Her personality',
      stack('Who she is', 'This is what her AI is told about her before anything else. Her dials, your profile and what is going on are added after it.',
        persona,
        el('div', { class: 'row__control' },
          button('Save personality', savePersona, 'primary'),
          button('Back to her default', () => { persona.value = DEFAULT_PERSONA; savePersona(); }))),
      ...TRAIT_LABELS.map(([key, label, help]) => row(label, help, ...range(`traits.${key}`, 0, 100, 5, percent)))),
    card('How she talks',
      row('Reply length', 'How long her answers can be.', seg('replyLength', [['tiny', 'One sentence'], ['short', '1 to 3 sentences'], ['long', 'Up to 5']])),
      row('Reply language', 'Her persona mixes Indonesian and English. You can make her stick to one.', select('replyLanguage', [['mix', 'Indonesian-English mix'], ['id', 'Bahasa Indonesia'], ['en', 'English'], ['app', 'Same as her menus']])),
      stack('Words she never says', 'Cut out of her answers. Her lessons can add some ("stop calling me \'bos\'").', listEditor('bannedPhrases', { placeholder: 'good boy, sayang…', max: 40, empty: 'None.' })),
      row('Emotion tags', 'She starts each answer with [happy], [jealous], [bored], [glitch] or [annoyed], and her face and moves follow it.', toggle('emotionTags')),
      row('Her 2.4 art', 'Her emotions in the art from Capri Desktop 2.4 (happy face, glitched eyes, scream…).', toggle('artFaces')),
      row('Talking portrait', 'Her mouth moves in her portrait while she talks.', toggle('talkingPortrait')),
      row('Cut-ins', 'Close-ups of her popping in by her side.', toggle('cutIns'))),
    growthCard(),
    card('Her lines',
      stack('Lines of yours she says now and then', 'Write {name} and she puts your name there.', listEditor('myLines', { placeholder: 'A line for her…', max: 30, empty: 'No lines yet.' }))),
    card('Size and sound',
      row('Size', null, ...range('scale', 0.35, 1, 0.05, scale)),
      row('Volume', 'Her blips and effects.', ...range('volume', 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`)),
      row('Mute', null, toggle('muted')),
      row('Custom sounds', 'Drop your own .mp3, .wav or .ogg named like her cues (done, alert, hello…).', button('Open custom sounds folder', () => act('openSounds')))),
  ];
}

function pageOwner() {
  const relation = select('owner.relationship', [['host', 'Her host'], ['partner', 'Partner in crime'], ['friend', 'Friend'], ['rival', 'Rival'], ['owner', 'Owner'], ['custom', 'Something else…']], { onChange: () => render() });
  return [
    card('About you',
      row('Your name', 'What she calls you.', text('userName', { placeholder: 'Your name…', max: 24 })),
      row('Her pet name for you', 'She uses it now and then instead of your name.', text('owner.nickname', { placeholder: 'choom, bestie, bos…', max: 30 })),
      row('Pronouns', null, text('owner.pronouns', { placeholder: 'he/him, she/her, they/them…', max: 30 })),
      row('Birthday', 'She makes a fuss on the day.', text('owner.birthday', { type: 'date' })),
      stack('About me', 'A few words about you, for her chat.', (() => {
        const area = el('textarea', { rows: 4, maxlength: 600, placeholder: T('I study design, I game at night, I have a cat called Neko…') });
        area.value = cfg().owner?.about || '';
        area.addEventListener('change', () => save(patchFor('owner.about', area.value.trim())));
        return area;
      })()),
      row('Likes', null, text('owner.likes', { placeholder: 'synthwave, ramen, Valorant…', max: 200 })),
      row('Dislikes', null, text('owner.dislikes', { placeholder: 'Mondays, spoilers…', max: 200 })),
      row('What you are to her', null, relation, cfg().owner?.relationship === 'custom' && text('owner.relationshipCustom', { placeholder: 'her favorite test subject…', max: 80 })),
      row('How she is with you', 'In your own words: her chat follows it (she stays Capri).', text('persona', { placeholder: 'More teasing, and tell me about Night City…' }))),
    card('What she remembers',
      row('Memory', 'She keeps what you tell her to remember ("remember that…", "ingat bahwa…") and uses it in chat.', toggle('memoryOn')),
      row('Also with a cloud model', 'Off: her notes about you, the story so far and her self-improvement only use a model on this PC. On: they also go to your cloud AI (needed for an online brain that remembers you).', toggle('cloudMemory')),
      stack('Her notes about you', 'Passwords and card numbers are never kept.', listEditor('memories', { placeholder: 'Something to remember…', max: 60, empty: 'She remembers nothing about you. Yet.' })),
      row('Forget everything', null, button('Forget all notes', async () => { if (confirm(T('Forget everything she knows about you?'))) { await act('clearMemory'); render(); } }, 'danger'))),
  ];
}

// ---- voice -----------------------------------------------------------------------------------------

function threshold(sensitivity) {
  const s = Math.min(100, Math.max(0, Number(sensitivity ?? 55))) / 100;
  return 0.045 * Math.pow(0.12, s);
}

async function openMic(deviceId) {
  const audio = { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true };
  if (deviceId) audio.deviceId = { exact: deviceId };
  const stream = await navigator.mediaDevices.getUserMedia({ audio });
  const ctx = new AudioContext();
  await ctx.audioWorklet.addModule('../renderer/js/ears-worklet.js');
  const node = new AudioWorkletNode(ctx, 'capri-ears');
  ctx.createMediaStreamSource(stream).connect(node);
  const mute = ctx.createGain();
  mute.gain.value = 0;
  node.connect(mute).connect(ctx.destination);
  const stop = () => {
    node.port.close();
    stream.getTracks().forEach((t) => t.stop());
    ctx.close().catch(() => {});
  };
  return { node, stop };
}

function toWav(frames) {
  const count = frames.reduce((n, f) => n + f.length, 0);
  const buffer = new ArrayBuffer(44 + count * 2);
  const v = new DataView(buffer);
  const w = (at, s) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + count * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, 1, true); v.setUint32(24, 16000, true); v.setUint32(28, 32000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, count * 2, true);
  let at = 44;
  for (const f of frames) for (let i = 0; i < f.length; i++, at += 2) v.setInt16(at, Math.max(-1, Math.min(1, f[i])) * 0x7fff, true);
  return buffer;
}

function pageVoice() {
  const ears = state.ears;
  const engineBadge = (id, label) => el('span', { class: `badge ${ears.engines[id] ? 'badge--on' : 'badge--off'}`, text: `${label} ${ears.engines[id] ? '✓' : '✕'}` });

  // microphones (their names only show once the mic has been allowed)
  const mics = el('select');
  mics.append(el('option', { value: '', text: T('Windows default') }));
  navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => {
    s.getTracks().forEach((t) => t.stop());
    return navigator.mediaDevices.enumerateDevices();
  }).then((devices) => {
    for (const d of devices.filter((x) => x.kind === 'audioinput' && x.deviceId !== 'default' && x.deviceId !== 'communications')) {
      mics.append(el('option', { value: d.deviceId, text: d.label || d.deviceId.slice(0, 12) }));
    }
    mics.value = cfg().micDevice || '';
  }).catch(() => {});
  mics.addEventListener('change', () => save({ micDevice: mics.value }));

  // the live level, with where her threshold is
  const fill = el('div', { class: 'meter__fill' });
  const mark = el('div', { class: 'meter__mark' });
  const meter = el('div', { class: 'meter' }, fill, mark);
  const placeMark = () => { mark.style.left = `${Math.min(100, (threshold(cfg().micSensitivity) / 0.08) * 100)}%`; };
  placeMark();
  let live = null;
  const meterBtn = button('Test my mic', async () => {
    if (live) {
      live.stop();
      live = null;
      meterBtn.textContent = T('Test my mic');
      fill.style.width = '0';
      return;
    }
    try {
      live = await openMic(cfg().micDevice);
      meterBtn.textContent = T('Stop');
      let level = 0;
      live.node.port.onmessage = ({ data }) => {
        level = level * 0.7 + data.rms * 0.3;
        fill.style.width = `${Math.min(100, (level / 0.08) * 100)}%`;
        fill.style.background = level > threshold(cfg().micSensitivity) ? 'var(--green)' : 'var(--paper-3)';
      };
    } catch (err) {
      toast(`${T("I can't hear any sound at all.")} ${err.message}`, true);
    }
  });
  cleanup.push(() => live?.stop());
  const sens = range('micSensitivity', 0, 100, 5, (v) => `${v}%`);
  sens[0].addEventListener('input', () => { mark.style.left = `${Math.min(100, (threshold(Number(sens[0].value)) / 0.08) * 100)}%`; });

  // say something: 4 seconds, written out by the ears she has
  const heard = el('div', { class: 'heard', text: '…' });
  const tryBtn = button('Say something (4 s)', async () => {
    tryBtn.disabled = true;
    heard.textContent = T('Listening…');
    try {
      const mic = await openMic(cfg().micDevice);
      const frames = [];
      mic.node.port.onmessage = ({ data }) => frames.push(data.samples);
      await new Promise((r) => setTimeout(r, 4000));
      mic.stop();
      heard.textContent = T('Thinking…');
      const res = await api.transcribe(toWav(frames));
      heard.textContent = res.ok ? `“${res.text || '…'}”  ·  ${res.engine}` : `${T('Failed:')} ${res.error === 'noears' ? T('no ears yet (download Whisper, or add a Groq key)') : res.error}`;
    } catch (err) {
      heard.textContent = `${T('Failed:')} ${err.message}`;
    }
    tryBtn.disabled = false;
  });

  // better ears: Whisper on this PC
  const bar = el('div', { class: 'meter__fill' });
  const progress = el('div', { class: 'meter', hidden: true }, bar);
  const progressText = el('span', { class: 'mono' });
  earsProgress = (p) => {
    progress.hidden = false;
    bar.style.width = `${p.percent}%`;
    progressText.textContent = `${Math.round(p.done / 1e6)} / ${Math.round(p.total / 1e6)} MB · ${p.percent}%`;
  };
  const download = button(ears.needsDownload ? F('Download better ears ({0} MB)', ears.sizeMb) : 'Better ears installed', async () => {
    if (!confirm(F('She will download Whisper (about 9 MB, from github.com) and a model that understands many languages (about 190 MB, from huggingface.co), check both against known fingerprints, and keep them in {0}. Go?', ears.folder))) return;
    download.disabled = true;
    cancel.hidden = false;
    const res = await act('downloadEars');
    cancel.hidden = true;
    if (res?.ok) {
      state = res.state;
      toast(T('Better ears installed!'));
      render();
    } else {
      download.disabled = false;
      toast(`${T('Download failed:')} ${res?.error || ''}`, true);
    }
  }, ears.needsDownload ? 'primary' : '');
  download.disabled = !ears.needsDownload;
  const cancel = button('Cancel', () => act('cancelEars'));
  cancel.hidden = true;

  return [
    card('Hearing',
      row('How she listens', 'Push to talk: click the mic by her, or the hotkey. Always: hands-free, she hears everything that starts with her name.', seg('listen', [['off', 'Off'], ['push', 'Push to talk'], ['always', 'Always listening']])),
      row('Only when I say her name', 'In always-listening mode: "Capri, open Spotify". A click on her mic counts as her name.', toggle('wakeWord')),
      row('Her names', 'What counts as her name (comma separated). Whisper sometimes hears "Kapri".', text('wakeWords', { placeholder: 'capri, kapri', max: 120 })),
      row('Follow-up window', 'After she answers, how long you can go on without her name.', ...range('followUpSeconds', 0, 30, 1, (v) => `${v} s`)),
      row('Mic button by her', null, toggle('micButton')),
      row('Close her ears while she talks', 'So she does not hear her own voice.', toggle('muteWhileSpeaking'))),
    card('Microphone',
      row('Microphone', null, mics),
      row('Sensitivity', 'Higher: she hears softer voices (and more noise).', ...sens),
      row('Level', 'The red mark is where she starts listening. Speak: the bar should pass it.', meter, meterBtn),
      row('End of a sentence', 'The quiet that ends what you say.', ...range('silenceMs', 400, 2500, 100, (v) => `${(v / 1000).toFixed(1)} s`)),
      row('Longest phrase', null, ...range('maxUtterance', 4, 30, 1, (v) => `${v} s`)),
      row('Try it', null, tryBtn),
      el('div', { class: 'row row--stack' }, heard)),
    card('Ears (speech to text)',
      row('Engine', 'Auto: Whisper on this PC if it is there, else Groq or OpenAI with your key, else Windows\' own.', select('sttEngine', [['auto', 'Automatic'], ['whisper', 'Whisper on this PC'], ['groq', 'Groq (free tier, your key)'], ['openai', 'OpenAI (your key)'], ['windows', 'Windows speech']]), engineBadge('whisper', 'Whisper'), engineBadge('groq', 'Groq'), engineBadge('openai', 'OpenAI'), engineBadge('windows', 'Windows')),
      row('Language she listens in', `Auto: ${state.sttLang}`, select('sttLanguage', [['auto', 'Automatic'], ...state.langs.map((l) => [l.code, l.name])])),
      row('Active now', null, el('span', { class: `badge ${ears.active ? 'badge--on' : 'badge--off'}`, text: ears.active ? `${ears.active}${ears.active === 'whisper' && ears.whisperModel ? ` (${ears.whisperModel})` : ''}` : T('none') })),
      row('Better ears', 'Whisper runs on this PC: nothing you say leaves it.', download, cancel),
      el('div', { class: 'row row--stack' }, el('div', { class: 'row__control' }, progress, progressText)),
      row('Groq key', 'Free tier at console.groq.com. Also used for her chat if you pick Groq.', keyField('groq'), button('Get a key', () => act('keyPage', 'groq'))),
      row('Folders', null, button('Open her speech folder', () => act('openSpeech')), button('Open voice log', () => act('openVoiceLog')))),
    card('Her recorded lines',
      row('Voice clips', 'Your own recordings, played at the moment they are named for: pat, click, wake, sit, peek, stretch, look, yawn, sleep, alarm, study, hello, reply, mischief, jealous, dare. Nothing is bundled.', toggle('voiceClips')),
      row('Found', state.voicesDir, (() => {
        const kinds = Object.entries(state.voiceClips || {});
        return kinds.length
          ? el('span', { class: 'row__control' }, ...kinds.map(([k, n]) => el('span', { class: 'badge badge--on', text: n > 1 ? `${k} ×${n}` : k })))
          : el('span', { class: 'badge badge--off', text: T('No voice clips yet') });
      })()),
      row('Folder', 'Name a clip pat.wav, pat-2.wav, wake.mp3… A README in the folder lists every moment.', button('Open voice folder…', async () => { await act('openVoices'); }), button('Play a sample', () => act('voiceSample')), button('Refresh', async () => { state = await api.get(); render(); }))),
    ...voiceCards(),
    note('Nothing you say is recorded to disk. A phrase lives in memory until it is written out, and only goes online if you pick Groq or OpenAI as her ears.'),
  ];
}

// ---- her voice out loud (main/mouth.js, renderer tts.js) -----------------------------------------------

const ENGINES = [
  ['windows', "Windows' own voices (offline, basic)"],
  ['elevenlabs', 'ElevenLabs (your own or a cloned voice)'],
  ['openai', 'OpenAI voice (expressive, follows her mood)'],
  ['custom', 'Your own TTS server (Kokoro, AllTalk, GPT-SoVITS…)'],
  ['piper', 'Piper on this PC (offline)'],
];

// a list of voices filled in once the engine answers, with what's saved kept even if it isn't listed
function voiceSelect(path, engine, { empty = 'Pick a voice…' } = {}) {
  const s = el('select', {}, el('option', { value: get(path) || '', text: get(path) || T(empty) }));
  s.addEventListener('change', () => save(patchFor(path, s.value)));
  const status = el('span', { class: 'mono' });
  api.ttsVoices(engine).then((res) => {
    const list = res?.voices || [];
    const now = get(path) || '';
    const options = list.map((v) => el('option', { value: v.id, text: v.name }));
    if (now && !list.some((v) => v.id === now)) options.unshift(el('option', { value: now, text: now }));
    s.replaceChildren(el('option', { value: '', text: T(empty) }), ...options);
    s.value = now;
    status.textContent = res?.error ? `${T('Failed:')} ${res.error === 'nokey' ? T('no key yet') : res.error}`.slice(0, 120) : list.length ? F('{0} voices', list.length) : '';
  }).catch(() => {});
  return [s, status];
}

// a voice picked from the list shows in the box next to it
function linked([select, status], input) {
  select.addEventListener('change', () => { input.value = select.value; });
  return [select, status];
}

function voiceCards() {
  const engine = cfg().ttsEngine || 'windows';
  const rows = [];
  if (engine === 'windows') {
    const voices = el('select');
    const fill = () => {
      voices.replaceChildren(el('option', { value: '', text: T('Automatic (her reply language)') }), ...speechSynthesis.getVoices().map((v) => el('option', { value: v.name, text: `${v.name} (${v.lang})` })));
      voices.value = cfg().ttsVoice || '';
    };
    fill();
    speechSynthesis.addEventListener('voiceschanged', fill);
    voices.addEventListener('change', () => save({ ttsVoice: voices.value }));
    rows.push(
      row('Voice', 'Install an Indonesian voice in Windows Settings › Time & language › Speech for the mix.', voices),
      row('Speed', null, ...range('ttsRate', 0.5, 2, 0.05, (v) => `${v.toFixed(2)}×`)),
      row('Pitch', null, ...range('ttsPitch', 0, 2, 0.05, (v) => v.toFixed(2))),
    );
  } else if (engine === 'elevenlabs') {
    const id = text('ttsElevenVoice', { placeholder: 'Voice ID…', max: 60 });
    rows.push(
      row('ElevenLabs key', 'From elevenlabs.io › Settings › API keys. Stored encrypted, only sent to ElevenLabs.', keyField('elevenlabs'), button('Get a key', () => act('ttsPage', 'elevenlabsKeys'))),
      row('Voice', 'Your voices first (★: cloned or designed). Or paste a voice ID.', ...linked(voiceSelect('ttsElevenVoice', 'elevenlabs'), id), id),
      row('Model', 'Multilingual v2 speaks Indonesian well; Flash is faster and cheaper.', select('ttsElevenModel', [['eleven_multilingual_v2', 'Multilingual v2'], ['eleven_flash_v2_5', 'Flash v2.5'], ['eleven_turbo_v2_5', 'Turbo v2.5'], ['eleven_v3', 'v3 (alpha)']])),
      row('Stability', 'Lower: more emotional and wild. Higher: steadier.', ...range('ttsStability', 0, 1, 0.05, (v) => v.toFixed(2))),
      row('Style', 'How much she exaggerates.', ...range('ttsStyleAmount', 0, 1, 0.05, (v) => v.toFixed(2))),
      row('Make her voice', 'Voice Lab › Instant Voice Clone: a minute or two of clean speech is enough. Only clone a voice you have the right to use.', button('Open Voice Lab', () => act('ttsPage', 'elevenlabsClone'))),
    );
  } else if (engine === 'openai') {
    const style = el('textarea', { rows: 4, maxlength: 800, placeholder: T('Her default: playful, mischievous, a childlike charm with an unsettling edge…') });
    style.value = cfg().ttsStyle || '';
    style.addEventListener('change', () => save({ ttsStyle: style.value.trim() }));
    rows.push(
      row('OpenAI key', 'Shared with her ears and her chat if you use OpenAI there.', keyField('openai'), button('Get a key', () => act('ttsPage', 'openaiKeys'))),
      row('Model', 'gpt-4o-mini-tts follows directions (her style, her mood). tts-1 does not.', select('ttsOpenaiModel', [['gpt-4o-mini-tts', 'gpt-4o-mini-tts'], ['tts-1', 'tts-1'], ['tts-1-hd', 'tts-1-hd']])),
      row('Voice', null, ...voiceSelect('ttsOpenaiVoice', 'openai', { empty: 'coral' })),
      stack('How she sounds', 'Directions for her voice, in your words. Her emotion of the moment is added.', style),
    );
  } else if (engine === 'custom') {
    rows.push(
      row('Server address', 'Any server with OpenAI\'s /audio/speech. Kokoro-FastAPI: http://127.0.0.1:8880/v1', text('ttsUrl', { placeholder: 'http://127.0.0.1:8880/v1', max: 200 })),
      row('Model', 'As your server names it: kokoro, tts-1, xtts…', text('ttsCustomModel', { placeholder: 'kokoro', max: 80 })),
      (() => {
        const typed = text('ttsCustomVoice', { placeholder: 'af_heart, capri…', max: 80 });
        return row('Voice', 'Listed if your server lists them; else type its name (a cloned voice\'s name too).', ...linked(voiceSelect('ttsCustomVoice', 'custom', { empty: 'Type a voice →' }), typed), typed);
      })(),
      row('Format', null, select('ttsCustomFormat', [['mp3', 'mp3'], ['wav', 'wav'], ['opus', 'opus'], ['flac', 'flac']])),
      row('Speed', null, ...range('ttsCustomSpeed', 0.5, 2, 0.05, (v) => `${v.toFixed(2)}×`)),
      row('Key (optional)', 'Only if your server asks for one.', keyField('ttscustom')),
      row('Servers to try', 'Kokoro-FastAPI: fast, natural voices, no cloning. AllTalk (XTTS) or GPT-SoVITS: clone a voice from a short sample, on your GPU.', button('Kokoro-FastAPI', () => act('ttsPage', 'kokoro')), button('AllTalk TTS', () => act('ttsPage', 'alltalk'))),
    );
  } else if (engine === 'piper') {
    rows.push(
      row('Voice', 'An .onnx voice with its .onnx.json, in her piper folder (or its voices folder).', ...voiceSelect('ttsPiperModel', 'piper', { empty: 'The first one' })),
      row('Speed', null, ...range('ttsPiperSpeed', 0.5, 2, 0.05, (v) => `${v.toFixed(2)}×`)),
      row('Set it up', 'Unzip Piper for Windows into her piper folder (piper.exe inside), add a voice (id_ID-news_tts-medium speaks Indonesian), or one you trained yourself.', button('Open piper folder', () => act('openPiper')), button('Get Piper', () => act('ttsPage', 'piper')), button('Voices', () => act('ttsPage', 'piperVoices'))),
    );
  }

  const sample = el('input', { type: 'text', maxlength: 300, value: T("Hi! It's me! I live here now!") });
  return [
    card('Her voice',
      row('Read out loud', 'She speaks instead of only writing. Her portrait\'s lips follow her voice.', toggle('tts')),
      row('What she says out loud', null, seg('ttsWhat', [['all', 'Everything'], ['answers', 'Only her answers']])),
      row('Voice engine', null, select('ttsEngine', ENGINES, { onChange: () => render() })),
      ...rows,
      engine !== 'windows' && row('If it fails', 'Windows\' own voice says it instead.', toggle('ttsFallback')),
      row('Volume', null, ...range('ttsVolume', 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`)),
      row('Test her voice', 'She says it on your desktop, with her effects.', sample, button('Say it', () => act('testSpeak', sample.value.trim()), 'primary'))),
    engine !== 'windows' && card('Voice effects',
      row('Effect', 'Her many minds: two more copies of her voice, a hair off, left and right. Glitch: syllables catch like a skipping chip.', seg('ttsEffect', [['none', 'None'], ['construct', 'Many minds'], ['glitch', 'Glitch'], ['radio', 'Radio']])),
      row('Other minds', 'How loud they are under her voice.', ...range('ttsMinds', 0, 100, 5, (v) => `${v}%`)),
      row('Pitch shift', 'Higher and quicker, or lower and slower.', ...range('ttsShift', 0.8, 1.4, 0.01, (v) => `${v.toFixed(2)}×`)),
      row('Emotion in her voice', 'Her [happy], [glitch], [annoyed]… change how she says it.', toggle('ttsEmotion'))),
    engine === 'windows' && note("Windows' own voices can't go through her effects. For a custom voice, pick ElevenLabs (a cloned voice), OpenAI, your own TTS server or Piper above."),
  ].filter(Boolean);
}

// a key, typed in and saved encrypted (never shown again)
function keyField(provider) {
  const set = (cfg().keys || []).includes(provider);
  const input = el('input', { type: 'password', placeholder: set ? T('Key saved (type to replace)') : T('Paste your API key…'), autocomplete: 'off', spellcheck: 'false' });
  const saveBtn = button('Save', async () => {
    if (!input.value.trim()) return;
    state = await api.setKey(provider, input.value.trim());
    input.value = '';
    toast(T('Key saved.'));
    render();
  }, 'primary');
  const clear = set && button('Remove', async () => { state = await api.setKey(provider, ''); render(); }, 'danger');
  return el('div', { class: 'row__control', style: 'flex:1 1 300px' }, input, saveBtn, clear);
}

// her local brain: a small Ollama model as backup and for her quick jobs (main.js)
function localBrainCard() {
  const models = el('select', {}, el('option', { value: cfg().localBrain || '', text: cfg().localBrain || T('None') }));
  const status = el('span', { class: 'mono' });
  api.ollamaModels().then((list) => {
    models.replaceChildren(el('option', { value: '', text: T('None') }), ...list.map((m) => el('option', { value: m, text: m })));
    models.value = list.includes(cfg().localBrain) ? cfg().localBrain : list.find((m) => m === `${cfg().localBrain}:latest`) || '';
    status.textContent = list.length ? F('{0} models in Ollama', list.length) : T('Ollama not found');
  }).catch(() => { status.textContent = T('Ollama not found'); });
  models.addEventListener('change', () => save({ localBrain: models.value, localBrainChecked: true }));
  return card('Her local brain (Ollama)',
    row('Local model', 'A small model on this PC (qwen2.5:1.5b, gemma3…). Free, offline, private.', models, status),
    row('Backup brain', 'When her main brain fails (offline, out of quota, a bad key), this one answers instead.', toggle('localFallback')),
    row('Quick jobs on it', 'Her word on your songs, her dares: fast and free, without spending your online quota.', toggle('localBackground')),
    note('Looking back at your chats (her self-improvement) also runs on it when your main brain is online and "Also with a cloud model" is off.'),
  );
}

function pageBrain() {
  const provider = cfg().provider;
  const info = state.providers.find((p) => p.id === provider) || {};
  const providerSel = el('select', {}, state.providers.map((p) => el('option', { value: p.id, text: p.label })));
  providerSel.value = provider;
  providerSel.addEventListener('change', async () => {
    await save({ provider: providerSel.value });
    state = await api.models();
    render();
  });
  const models = el('select', {}, (state.models.length ? state.models : ['']).map((m) => el('option', { value: m, text: m || T('(none)') })));
  models.value = state.model || '';
  models.addEventListener('change', () => save({ chatModel: models.value }));
  const status = state.models.length
    ? el('span', { class: 'badge badge--on', text: F('{0} models', state.models.length) })
    : el('span', { class: 'badge badge--off', text: (state.modelError || T('offline')).slice(0, 80) });
  return [
    card('Her brain',
      row('Who answers', info.local ? 'On this PC: nothing leaves it.' : 'Online: your messages and her persona go to that service.', providerSel),
      row('Model', null, models, button('Refresh', async () => { state = await api.models(); render(); }), status),
      info.needsKey && row('API key', info.keyPage ? 'Stored encrypted for your Windows account, only ever sent to that service.' : null, keyField(provider), info.keyPage && button('Get a key', () => act('keyPage', provider))),
      provider === 'custom' && row('Server address', 'Any OpenAI-compatible server: http://127.0.0.1:1234/v1', text('customUrl', { placeholder: 'http://127.0.0.1:1234/v1' })),
      row('Creativity', 'Temperature: low is steady, high is wild.', ...range('temperature', 0, 1.5, 0.05, (v) => v.toFixed(2))),
      row('Max answer length', 'In tokens.', ...range('maxTokens', 60, 1500, 20, (v) => `${v}`)),
      row('Conversation memory', 'How many recent messages she keeps in mind.', ...range('contextMessages', 4, 60, 2, (v) => `${v}`))),
    localBrainCard(),
    card('Coding',
      row('Who writes the code', '"buatkan kode…", "code a script that…": Claude Code in a terminal (you approve its edits there), or Capri herself with her model, one file opened in your editor (never run).',
        select('coder', [['auto', 'Claude Code if installed, else her'], ['claude', 'Claude Code'], ['self', 'Capri herself']])),
      row('Coding folder', 'Where the code goes. Empty: Documents\\Capri Code.', text('codeFolder', { placeholder: 'Documents\\Capri Code' }))),
    card('Her eyes (Look)',
      row('Let her look when I ask', 'Ctrl+Alt+L or "what am I looking at?": one screenshot, kept in memory only, sent to her model, then dropped.', toggle('lookOn')),
      row('Also with a cloud model', 'Off: she only looks through a model on this PC.', toggle('cloudLook')),
      row('Try it', null, button('Look at my screen', () => act('testLook')))),
    card('Conversations',
      row('Talk to her', null, button('Open her chat', () => act('chat'))),
      row('Forget our conversations', 'Her notes about you stay (Owner page).', button('Forget', async () => { await act('forgetChats'); toast(T('Forgotten.')); }, 'danger'))),
  ];
}

function pageBehavior() {
  const sync = state.sync;
  const styles = ['Bars', 'Tear', 'Corruption', 'Hex rain', 'Sync bar', 'Chaser'];
  const unlocked = Math.min(6, 1 + Math.floor((cfg().sync?.points || 0) / 100));
  const glitchBoxes = el('div', { class: 'grid2' }, styles.map((name, i) => {
    const box = el('input', { type: 'checkbox' });
    box.checked = (cfg().glitchStyles || []).includes(i);
    box.disabled = i >= unlocked;
    box.addEventListener('change', () => {
      const set = new Set(cfg().glitchStyles || []);
      if (box.checked) set.add(i); else set.delete(i);
      save({ glitchStyles: [...set].sort() });
    });
    return el('span', { class: 'row__control' },
      el('label', { class: 'check' }, box, `${T(name)}${i >= unlocked ? ` 🔒 ${(i) * 10}%` : ''}`),
      button('Test', () => act('testGlitch', i)));
  }));
  return [
    card('Living on your desktop',
      row('Wander around when idle', null, toggle('wander')),
      row('Possess my windows', null, toggle('possess')),
      row('Where she rests', null, select('rest', [['corner', 'In her corner'], ['taskbar', 'Sitting on the taskbar']])),
      row('Animations', null, select('motion', [['auto', 'Like Windows'], ['full', 'Full'], ['reduced', 'Reduced']])),
      row('Head pats', 'Pet her: stroke her head back and forth with your pointer.', toggle('pats')),
      row('Hide in fullscreen', 'She steps aside while a game or a full screen video is in front, and comes back after. Alarms become Windows notifications meanwhile.', toggle('hideInFullscreen')),
      row('Perch on cursor', 'Or say "sit on my cursor": she sits on your pointer and rides along, and clicks go right through her. Move it too fast and she falls off. Ctrl+Alt+C to hop off.', button('Perch on cursor', () => act('ride')))),
    card('She notices things',
      row('Remarks', 'A long break, a late night, a low battery, a busy CPU, hours in one app. Only the clock, idle time, CPU, battery and the program name are read.', toggle('notices')),
      row('Jealous of other AIs', 'She checks whether the window in front is ChatGPT, Gemini, Copilot… (only that name, never the title, leaves her senses).', toggle('jealous')),
      row('What\'s playing', 'What Windows shows as now playing.', select('music', [['off', 'Off'], ['show', 'Show what\'s playing'], ['comment', 'Show and comment']])),
      row('Song lyrics', 'The words of the song over her head as they\'re sung, from LRCLIB (lrclib.net, free, no account). Only the title, artist, album and length go out to look them up.', toggle('lyrics')),
      row('She listens along', 'Her head goes with the song, she dances to the ones she likes, and a boring one sends her to sleep until a better one wakes her.', toggle('musicMood'))),
    card('Dares',
      row('She dares me', 'After about ten minutes in one app, something quick and harmless. Say "done" when you did it.', toggle('dares')),
      row('She looks when she dares', 'One screenshot so the dare fits your screen (only to a model allowed to look).', toggle('visionDares', { onChange: (on) => on && !confirm(T('Each time she dares you (every half hour or so) she will take one screenshot of your screen, keep it in memory only, and send it to your model. Turn this on?')) && save({ visionDares: false }).then(render) })),
      row('Dare me now', null, button('Dare me', () => act('dare')))),
    card('Games',
      row('Play with her', 'Or just say it: "main suit", "tebak angka", "lempar koin", "roll 2d6". Mid-game, "batu" or "50" is your move; "udahan" ends it.',
        button('Rock, paper, scissors', () => act('game', 'main suit')), button('Guess the number', () => act('game', 'tebak angka')),
        button('Flip a coin', () => act('game', 'lempar koin')), button('Roll a die', () => act('game', 'lempar dadu'))),
      row('She cheats', 'Now and then, more with her mischief up. She is bad at hiding it.', toggle('gameCheat')),
      row('Your record', null, (() => {
        const g = cfg().gameStats || {};
        return el('span', { class: 'mono', text: F('Rock paper scissors: you {0}, her {1}, ties {2}. Numbers guessed: {3} (best: {4} tries).', g.rpsYou || 0, g.rpsHer || 0, g.rpsTie || 0, g.guessWins || 0, g.guessBest || '—') });
      })())),
    card('Mischief',
      row('Glitches now and then', 'Painted over your screen, gentle, never in the way. Ctrl+Alt+C stops one.', toggle('mischief')),
      row('About every', null, ...range('mischiefMinutes', 3, 120, 1, (v) => `${v} min`)),
      row('Hacked notes', '"You\'ve been hacked! …Kidding!"', toggle('hackNotes')),
      stack('Glitch styles', 'Each 10% of sync unlocks one.', glitchBoxes)),
    card('Sync',
      row('Sync with Capri', 'How far she has got into your life: time together, chats, pats, agreeing with her, finished dares (each with a daily limit).',
        el('div', { class: 'meter meter--sync' }, el('div', { class: 'meter__fill', style: `width:${sync}%` })), el('span', { class: 'range__value', text: `${sync}%` })),
      row('Show sync', null, toggle('syncShown')),
      row('Start over', null, button('Reset sync', async () => { if (confirm(T('Reset sync to 0%?'))) { await act('resetSync'); render(); } }, 'danger'))),
  ];
}

function pageTimers() {
  const clock = (ms) => new Date(ms).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  const alarms = cfg().alarms || [];
  const minutes = el('input', { type: 'number', min: 1, max: 1440, value: 10 });
  const label = el('input', { type: 'text', placeholder: T('What for? (optional)'), maxlength: 80 });
  const study = state.study;
  const left = Math.round(study.left / 60000);
  return [
    card('Timers and alarms',
      stack('Set', 'Or just tell her: "set a timer for 10 minutes", "pasang timer 10 menit", "wake me at 7am", "ingatkan aku 20 menit lagi untuk stretching".',
        el('div', { class: 'list' },
          ...(alarms.length ? alarms.map((a) => el('div', { class: 'list__item' },
            el('span', { class: 'mono', text: clock(a.due) }),
            el('span', { class: 'list__text', text: a.label || '' }),
            el('button', { class: 'list__x', type: 'button', text: '✕', onclick: async () => { await act('removeAlarm', a.due); render(); } })))
            : [el('div', { class: 'list__empty', text: T('No alarms') })]),
          el('div', { class: 'list__add' }, minutes, el('span', { class: 'mono', text: T('min') }), label,
            button('Add timer', async () => { await act('addTimer', { minutes: Number(minutes.value) || 10, label: label.value.trim() }); render(); }, 'primary')),
          alarms.length && el('div', {}, button('Clear all', async () => { await act('clearAlarms'); render(); }, 'danger')))),
      row('Chime', 'A sound when one goes off.', toggle('chime'))),
    card('Study timer',
      row('Focus', null, number('focusMinutes', 1, 180), el('span', { class: 'mono', text: T('min') })),
      row('Break', null, number('breakMinutes', 1, 60), el('span', { class: 'mono', text: T('min') })),
      row('Now', study.phase === 'off' ? T('Off') : `${T(study.phase === 'focus' ? 'Focus' : 'Break')} · ${F('{0} min left', left)}${study.paused ? ` · ${T('paused')}` : ''} · ${F('{0} done', study.done)}`,
        study.phase === 'off'
          ? button('Start focus', async () => { await act('startStudy'); render(); }, 'primary')
          : [button(study.paused ? 'Resume' : 'Pause', async () => { await act('pauseStudy'); render(); }), button('Stop', async () => { await act('stopStudy'); render(); }, 'danger')])),
  ];
}

const HOTKEYS = [
  ['toggle', 'Put her away / bring her back (and stop a glitch)'],
  ['chat', 'Open her chat'],
  ['talk', 'Talk to her (microphone)'],
  ['look', 'Look at my screen'],
  ['settings', 'This settings window'],
];

function hotkeyInput(name) {
  const input = el('input', { type: 'text', readonly: true, placeholder: T('Press keys…') });
  input.value = cfg().hotkeys?.[name] || '';
  input.addEventListener('keydown', (e) => {
    e.preventDefault();
    if (['Backspace', 'Delete', 'Escape'].includes(e.key)) {
      input.value = '';
    } else {
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
      const mods = [e.ctrlKey && 'Control', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Super'].filter(Boolean);
      if (!mods.length) return;
      const key = /^Key[A-Z]$/.test(e.code) ? e.code.slice(3) : /^Digit\d$/.test(e.code) ? e.code.slice(5) : /^F\d{1,2}$/.test(e.key) ? e.key : e.key.length === 1 ? e.key.toUpperCase() : e.key;
      input.value = [...mods, key].join('+');
    }
    save({ hotkeys: { ...cfg().hotkeys, [name]: input.value } }).then(() => {
      if (state.hotkeyErrors.includes(name)) toast(T('Windows would not give her that one. Try another.'), true);
    });
  });
  return input;
}

// ---- she improves herself (growth.js) ----------------------------------------------------------------------

function growthCard() {
  const g = state.growth || {};
  const when = (t) => (t ? new Date(t).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—');
  const log = (g.log || []).slice(0, 5);
  const reflectBtn = button('Improve now', async () => {
    reflectBtn.disabled = true;
    reflectBtn.textContent = T('Thinking…');
    const r = await act('reflect');
    const res = r?.result;
    if (!res?.ok) {
      const why = { private: 'Allow it with a cloud model first (Owner page), or use a model on this PC.', nomodel: 'Set up an AI first: AI brain page.', little: 'Talk to her a bit more first.', garbled: 'Her answer came out garbled. Try again.' };
      toast(T(why[res?.error] || res?.error || 'Failed:'), true);
    } else toast(res.changed ? F('Capri v1.{0}: {1}', res.version, res.note || T('she changed.')) : T('Nothing to change, she says.'));
    render();
  }, 'primary');
  return card('She improves herself',
    row('Learn from our chats', 'Every so often she looks back at your recent chats and how you reacted ("lucu!", "kepanjangan", "jangan gitu"…) and rewrites her own lessons on how to be with you. Her core personality above stays as you wrote it.', toggle('growthOn')),
    row('How often', 'After this many messages of yours.', ...range('growthEvery', 4, 50, 1, (v) => F('{0} messages', v))),
    row('Her version', F('Last looked back: {0}', when(g.last)), el('span', { class: 'badge badge--on', text: `Capri v1.${g.version || 0}` }), reflectBtn),
    stack('Her lessons', 'Her own notes. Edit or remove any. Or tell her: "mulai sekarang, jangan panggil aku bos" / "from now on, be shorter".', listEditor('lessons', { placeholder: 'A lesson for her…', max: 12, empty: 'No lessons yet: talk to her, she learns.', shape: (v) => (v && !v.startsWith('The user asked:') ? `The user asked: "${v}"` : v) })),
    log.length && stack('What changed', null, el('div', { class: 'list' }, ...log.map((e) => el('div', { class: 'list__item' },
      el('span', { class: 'mono', text: `v1.${e.version} · ${when(e.at)}` }),
      el('span', { class: 'list__text', text: [e.note && e.note !== 'asked' ? e.note : '', ...(e.added || []).map((a) => `+ ${a}`), ...(e.removed || []).map((r) => `− ${r}`), ...(e.facts || []).map((f) => `★ ${f}`)].filter(Boolean).join('  ') }))))),
    row('Start over', null, button('Reset her lessons', async () => { if (confirm(T('Forget everything she taught herself?'))) { await act('lessonsReset'); state = await api.get(); render(); } }, 'danger')),
    !state.canShare && note('Your AI is online and "Also with a cloud model" is off (Owner page): she can\'t look back at your chats until you allow it.'),
  );
}

// ---- her history with you (history.js) -----------------------------------------------------------------

let historyDay = null;
let historyQuery = '';

function pageHistory() {
  const summaryText = el('textarea', { rows: 7, maxlength: 4000, placeholder: T('Nothing yet: after about 40 messages she writes it herself.') });
  summaryText.value = state.growth?.summary?.text || '';
  const days = el('div', { class: 'list' }, el('div', { class: 'list__empty', text: T('Loading…') }));
  const view = el('div', { class: 'list' });
  const search = el('input', { type: 'text', placeholder: T('Search your chats…'), value: historyQuery, maxlength: 100 });

  const bubble = (m, day) => el('div', { class: 'list__item' },
    el('span', { class: 'mono', text: `${day ? `${day} ` : ''}${new Date(m.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}` }),
    el('b', { text: m.role === 'user' ? (cfg().userName || T('You')) : 'Capri' }),
    el('span', { class: 'list__text', text: `${m.emotion ? `[${m.emotion}] ` : ''}${m.text}` }));

  const showDay = async (day) => {
    historyDay = day;
    const msgs = await api.historyRead(day);
    view.replaceChildren(
      el('div', { class: 'row__control' }, el('b', { text: day }), el('span', { class: 'mono', text: F('{0} messages', msgs.length) }),
        button('Delete this day', async () => { if (confirm(F('Delete {0}?', day))) { await act('historyRemoveDay', day); historyDay = null; render(); } }, 'danger')),
      ...msgs.map((m) => bubble(m)),
    );
  };
  const runSearch = async () => {
    historyQuery = search.value.trim();
    if (!historyQuery) {
      view.replaceChildren();
      return;
    }
    const hits = await api.historySearch(historyQuery);
    view.replaceChildren(el('span', { class: 'mono', text: F('{0} found', hits.length) }), ...hits.map((m) => bubble(m, m.day)));
  };
  search.addEventListener('keydown', (e) => e.key === 'Enter' && runSearch());

  api.historyDays().then((list) => {
    days.replaceChildren(...(list.length ? list.map(({ day, count }) => el('button', {
      type: 'button', class: `btn ${day === historyDay ? 'btn--primary' : ''}`, text: `${day} · ${count}`, onclick: () => showDay(day),
    })) : [el('div', { class: 'list__empty', text: T('No chats kept yet.') })]));
    days.style.cssText = 'flex-direction:row;flex-wrap:wrap';
    if (historyDay) showDay(historyDay);
    else if (historyQuery) runSearch();
  });

  return [
    card('The story so far',
      stack('Her long-term memory', 'Older chats, summarized by her, so she remembers you for weeks without sending all of it to her AI. Edit it if she got something wrong.',
        summaryText,
        el('div', { class: 'row__control' },
          button('Save', async () => { await act('summarySet', summaryText.value.trim()); toast(T('Saved.')); }),
          button('Update now', async (e) => {
            e.target.disabled = true;
            const r = await act('summaryUpdate');
            if (r?.result?.ok) { state = r; render(); toast(T('Updated.')); } else { e.target.disabled = false; toast(T(r?.result?.error === 'little' ? 'Nothing new to add yet.' : r?.result?.error === 'private' ? 'Allow it with a cloud model first (Owner page), or use a model on this PC.' : 'Failed:'), true); }
          }))),
      row('Last written', state.growth?.summary?.updated ? new Date(state.growth.summary.updated).toLocaleString() : '—')),
    card('Your chats',
      row('Keep my chats', 'Every chat turn, typed or spoken, kept on this PC (a file a day). Off: nothing new is kept, and she can\'t learn from your chats.', toggle('historyOn')),
      row('Keep for', null, select('historyDays', [[0, 'Forever'], [30, '30 days'], [90, '90 days'], [365, 'A year']])),
      row('Search', null, search, button('Search', runSearch)),
      stack('Days', null, days),
      el('div', { class: 'row row--stack' }, view),
      row('Your data', state.historyDir, button('Open folder', () => act('historyOpen')), button('Delete all history', async () => { if (confirm(T('Delete all of your chat history and the story so far?'))) { await act('historyClear'); historyDay = null; state = await api.get(); render(); } }, 'danger'))),
  ];
}

function pageAdvanced() {
  const errors = state.hotkeyErrors;
  return [
    card('Language',
      row('Her language', 'Menus, her lines and this window. Translations for Polski, Deutsch, Italiano, Čeština and Tiếng Việt came with Capri 2.4 (machine-made).', select('lang', [['auto', 'Automatic (system)'], ...state.langs.map((l) => [l.code, l.name])], { onChange: () => setTimeout(loadLines, 200) })),
      row('Fix a translation', 'Put a file like id.txt in her lang folder: it wins, line by line.', button('Open lang folder', () => act('openLang')))),
    card('Hotkeys',
      ...HOTKEYS.map(([name, label]) => row(label, errors.includes(name) ? 'Windows would not give her that one. Try another.' : null, hotkeyInput(name))),
      note('Click a box and press the keys (with Ctrl, Alt or Shift). Backspace clears it.')),
    card('System',
      row('Start with Windows', null, (() => {
        const input = el('input', { type: 'checkbox', role: 'switch' });
        input.checked = state.startup;
        input.addEventListener('change', () => save({ startup: input.checked }));
        return el('span', { class: 'switch' }, input, el('span'));
      })()),
      row('Display', 'If her background shows black. She restarts.', select('render', [['auto', 'Normal'], ['gl', 'OpenGL'], ['software', 'Without the graphics card']])),
      row('Shortcuts', state.shortcut ? 'On your Desktop and in the Start menu: open her from there, not from a terminal.' : 'Started from a terminal she closes with it. A shortcut opens her on her own, like any app.',
        button(state.shortcut ? 'Make them again' : 'Desktop & Start menu shortcuts', async () => {
          const r = await act('shortcuts');
          if (r?.shortcuts?.ok) toast(T('Shortcuts made.'));
          else toast(r?.shortcuts?.error || T('Windows would not let me.'), true);
          render();
        }, state.shortcut ? '' : 'primary')),
      row('Debug log', 'More details in the console (developers).', toggle('debugLog')),
      row('Bridge port', 'Where her Claude Code hooks reach her.', el('span', { class: 'mono', text: String(state.port) }))),
    card('Your data',
      row('Her data folder', state.dataDir, button('Open', () => act('openData'))),
      row('Settings file', 'Export or import everything except your API keys.', button('Export…', async () => { const r = await act('export'); if (r?.ok) toast(T('Exported.')); }), button('Import…', async () => { const r = await act('import'); if (r?.ok) { state = await api.get(); render(); toast(T('Imported.')); } else if (r && !r.ok) toast(r.error, true); })),
      row('Reset', 'Back to how she came. Your API keys stay.', button('Reset all settings', async () => { if (confirm(T('Reset all of her settings?'))) { await act('reset'); state = await api.get(); render(); } }, 'danger'))),
  ];
}

// Everything she can see, hear and do on your PC, in one place (the same switches as on the other pages, and
// the ones only here: what she may do with your apps, files, sites, media, Spotify and code).
function pageAccess() {
  const kept = el('span', { class: 'mono', text: '…' });
  const showKept = (info) => {
    const kb = Math.max(0, Math.round((info?.bytes || 0) / 1024));
    kept.textContent = info ? F('{0} songs · {1} KB', info.songs, kb) : '—';
  };
  api.lyricsCache().then(showKept, () => showKept(null));
  const clear = async () => {
    const res = await api.clearLyrics().catch(() => null);
    showKept(res);
    toast(res ? F('Forgot the lyrics of {0} songs.', res.cleared) : T('Could not clear them.'), !res);
  };
  return [
    note('Everything Capri can see, hear and do on this PC, in one place. Switch off what she must not touch: when you ask for it anyway, she tells you it is off here.'),
    card('What she can see',
      row('Let her look when I ask', 'Ctrl+Alt+L or "what am I looking at?": one screenshot, kept in memory only, sent to her model, then dropped.', toggle('lookOn')),
      row('Also with a cloud model', 'Off: she only looks through a model on this PC.', toggle('cloudLook')),
      row('Remarks', 'A long break, a late night, a low battery, a busy CPU, hours in one app. Only the clock, idle time, CPU, battery and the program name are read.', toggle('notices')),
      row('Jealous of other AIs', 'She checks whether the window in front is ChatGPT, Gemini, Copilot… (only that name, never the title, leaves her senses).', toggle('jealous')),
      row('What\'s playing', 'What Windows shows as now playing.', select('music', [['off', 'Off'], ['show', 'Show what\'s playing'], ['comment', 'Show and comment']])),
      row('Watch my coding AI', 'Claude Code, Codex or Antigravity, through their hooks: the tool, the file, the command, its last message. Never your files\' contents.', toggle('claude'))),
    card('What she can hear',
      row('How she listens', 'Push to talk: click the mic by her, or the hotkey. Always: hands-free, she hears everything that starts with her name.', select('listen', [['off', 'Off'], ['push', 'Push to talk'], ['always', 'Always listening']]))),
    card('What she can do on your PC',
      row('Open apps', 'Apps, games and Store apps you name ("open Spotify", "buka kalkulator").', toggle('access.apps')),
      row('Folders and files', 'Open your folders, find files and folders, and point at them ("open my downloads").', toggle('access.files')),
      row('Close apps', 'Close an app you name, always behind a button, like its own close button.', toggle('access.close')),
      row('Websites', 'Open sites and searches in your browser ("buka youtube di chrome", "search…").', toggle('access.web')),
      row('Media keys', 'Pause, next, previous, volume: the keys on your keyboard, pressed for you.', toggle('access.media')),
      row('Spotify', 'Search Spotify and press Play on the song you ask for.', toggle('access.spotify')),
      row('Write code', 'Write code into her Code folder (never run), or open Claude Code with your task.', toggle('access.code')),
      row('Possess my windows', 'Now and then she dives into the window she sits on: it only looks taken over, nothing in it is touched.', toggle('possess'))),
    card('What goes online',
      row('Song lyrics', 'The words of the song over her head as they\'re sung, from LRCLIB (lrclib.net, free, no account). Only the title, artist, album and length go out to look them up.', toggle('lyrics')),
      row('Her notes with a cloud model', 'Off: her notes about you, the story so far and her self-improvement only use a model on this PC. On: they also go to your cloud AI (needed for an online brain that remembers you).', toggle('cloudMemory'))),
    card('What she keeps on this PC',
      row('Memory', 'She keeps what you tell her to remember ("remember that…", "ingat bahwa…") and uses it in chat.', toggle('memoryOn')),
      row('Keep my chats', 'Every chat turn, typed or spoken, kept on this PC (a file a day). Off: nothing new is kept, and she can\'t learn from your chats.', toggle('historyOn')),
      row('Song verdicts', 'What she thinks of each song she has heard (loves it, likes it, bored by it), so she feels the same next time.', button('Forget them', async () => { await save({ tastes: {} }); toast(T('She will make up her mind again.')); }, 'danger')),
      row('Lyrics cache', 'The words of songs you\'ve played, kept so they show at once next time without asking LRCLIB again.', kept, button('Clear', clear, 'danger'))),
  ];
}

function pageAbout() {
  return [
    card('Capri',
      el('p', {}, `Capri Desktop ${state.version} — ${T('the Project Capricorn construct, merged with Capri Desktop 2.4.')}`),
      el('p', { class: 'row__help', text: T('An unofficial fan project. Capri and Cyberpunk: Edgerunners belong to CD PROJEKT RED and Studio Trigger. Her replies are written by an AI, not the show\'s writers.') }),
      row('Hotkeys', null, el('span', { class: 'mono' }, ...HOTKEYS.map(([name, label]) => el('div', {}, el('kbd', { text: cfg().hotkeys?.[name] || '—' }), ' ', T(label))))),
      row('Things to say', null, el('div', { class: 'mono' },
        ...['"Capri, set a timer for 10 minutes"', '"pasang alarm jam 7 pagi"', '"putar lofi di youtube"', '"play Daft Punk on Spotify"', '"buka downloads"', '"remember that my cat is called Neko"', '"dare me" / "tantang aku"', '"how\'s our sync?"', '"what am I looking at?" / "lihat layarku"', '"lagu berikutnya" / "pause the music"', '"main suit" / "tebak angka" / "lempar koin"'].map((s) => el('div', { text: s })))),
      row('Try', null, button('Play demo', () => act('demo')), button('Make her yours…', () => act('customize')))),
    note('What leaves your PC: only what you switch on. Her chat goes to the model you picked; the mic only goes online if Groq or OpenAI are her ears; Look only sends a screenshot when you ask. Everything else stays here.'),
  ];
}

const PAGES = [
  ['capri', '◆', 'Capri', 'Who she is, how she talks and how she shows it.', pageCapri],
  ['owner', '◇', 'Owner', 'Who you are to her: your profile and what she remembers about you.', pageOwner],
  ['voice', '◉', 'Voice', 'Her ears (your microphone) and her voice.', pageVoice],
  ['brain', '▣', 'AI brain', 'Which AI she talks through, and her eyes.', pageBrain],
  ['behavior', '✦', 'Behavior', 'What she does on her own: remarks, dares, mischief, sync.', pageBehavior],
  ['access', '◎', 'Access', 'What she can see, hear and do on your PC, and what she keeps.', pageAccess],
  ['timers', '◷', 'Timers', 'Alarms, timers and the study timer.', pageTimers],
  ['history', '☰', 'History', 'Your chats with her, and her long-term memory of them.', pageHistory],
  ['advanced', '⚙', 'Advanced', 'Language, hotkeys, system, your data.', pageAdvanced],
  ['about', '?', 'About', 'What she is, and what she can do.', pageAbout],
];

// ---- drawing ---------------------------------------------------------------------------------------

function go(id) {
  page = id;
  location.hash = id;
  render();
  document.getElementById('main').scrollTop = 0;
}

// the tabs along the top; Q and E (or the keys at the ends) for the one before and after
function renderNav() {
  const nav = document.getElementById('nav');
  nav.replaceChildren(...PAGES.map(([id, icon, title]) => el('button', {
    type: 'button', 'aria-current': id === page ? 'page' : null, onclick: () => go(id),
  }, el('span', { class: 'nav__icon', text: icon }), el('span', { class: 'nav__text', text: T(title) }))));
  nav.querySelector('[aria-current]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function step(by) {
  const i = PAGES.findIndex(([id]) => id === page);
  go(PAGES[(i + by + PAGES.length) % PAGES.length][0]);
}

// The bar at the bottom: what the setting under your pointer (or your keyboard) does, else what the page is for.
function describe(row) {
  const def = PAGES.find(([id]) => id === page) || PAGES[0];
  const label = row?.querySelector('.row__label');
  const name = label ? [...label.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join('').trim() : '';
  const help = row?.querySelector('.row__help')?.textContent || '';
  document.getElementById('infoName').textContent = name || T(def[2]);
  document.getElementById('infoHelp').textContent = name ? help : T(def[3]);
}

function renderSync() {
  if (!state) return;
  document.getElementById('sync').textContent = cfg().syncShown === false ? '' : `SYNC ${state.sync}%`;
}

function render() {
  for (const stop of cleanup.splice(0)) stop();
  earsProgress = null;
  const def = PAGES.find(([id]) => id === page) || PAGES[0];
  page = def[0];
  const [, , title, lede, build] = def;
  const main = document.getElementById('main');
  const scroll = main.scrollTop;
  main.replaceChildren(
    el('header', { class: 'page__head' }, el('h1', { class: 'page__title', text: T(title) }), el('p', { class: 'page__lede', text: T(lede) })),
    ...build().filter(Boolean),
  );
  main.scrollTop = scroll;
  document.querySelectorAll('[data-t]').forEach((n) => { n.textContent = T(n.dataset.t); });
  renderNav();
  renderSync();
  describe(null);
}

// typing somewhere: don't redraw under the cursor
const typing = () => ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) && document.activeElement.type !== 'checkbox' && document.activeElement.type !== 'range';

async function loadLines() {
  const table = await api.langTable();
  lines = table?.lines || {};
  document.documentElement.lang = table?.code || 'en';
  render();
}

async function boot() {
  state = await api.get();
  const table = await api.langTable();
  lines = table?.lines || {};
  document.documentElement.lang = table?.code || 'en';
  render();
  api.onConfig(async () => {
    if (typing()) return;
    state = await api.get();
    renderSync();
  });
  api.onRefresh(async () => {
    state = await api.get();
    if (!typing() && ['timers', 'behavior'].includes(page)) render();
    else renderSync();
  });
  api.onTab((tab) => { page = tab; render(); });
  api.onEarsProgress((p) => earsProgress?.(p));
  const main = document.getElementById('main');
  main.addEventListener('mouseover', (e) => describe(e.target.closest('.row')));
  main.addEventListener('focusin', (e) => describe(e.target.closest('.row')));
  main.addEventListener('mouseleave', () => describe(main.contains(document.activeElement) ? document.activeElement.closest('.row') : null));
  document.getElementById('prevTab').addEventListener('click', () => step(-1));
  document.getElementById('nextTab').addEventListener('click', () => step(1));
  window.addEventListener('keydown', (e) => {
    if (typing() || e.ctrlKey || e.altKey || e.metaKey) {
      if (e.ctrlKey && (e.key === 'PageUp' || e.key === 'PageDown')) step(e.key === 'PageUp' ? -1 : 1);
      return;
    }
    if (e.key === 'q' || e.key === 'Q') step(-1);
    else if (e.key === 'e' || e.key === 'E') step(1);
  });
  window.addEventListener('hashchange', () => {
    const id = location.hash.slice(1);
    if (id && id !== page) { page = id; render(); }
  });
}

boot();

// Her settings window: who she is, who you are, her ears and voice, her brain, what she does on her
// own, timers, and the advanced bits. Everything is saved as you change it (main.js settings:set);
// API keys only go through settings:key and never come back here.

import { DEFAULT_PERSONA } from '../renderer/js/persona.js';
import { Tour } from './tour.js';

const api = window.settings;
let state = null;   // what main.js sends (settings:get)
let lines = {};     // her translations (assets/lang)
let page = (location.hash || '#capri').slice(1);
let cleanup = [];   // what the page on screen left running (a mic, a meter)
let earsProgress = null;
let ownVoiceProgress = null; // her own voice, downloading (ownVoiceRow)

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

// A choice: a plain drop-down, the same everywhere.
function select(path, options, { onChange } = {}) {
  return dropdown(path, options, { onChange });
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
  // the filled part of the bar, up to the handle
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
      row('Recall past chats', 'When you talk about something you told her before (weeks ago too), she remembers it: the lines it is about, found in your chats kept on this PC. With an embedding model in Ollama (nomic-embed-text), by meaning too.', toggle('recallChats')),
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
      row('Fix what I dictate', 'When you say "type…" out loud, her model fixes what speech recognition misheard ("get hub" becomes "GitHub", "every one" becomes "everyone") before she types it, and tells you what she typed. What you type by hand is never changed.', toggle('fixDictation')),
      row('Tell a voice from noise', 'A small detector on this PC decides whether what she hears is someone speaking and when they stopped, so a keyboard or a song isn\'t written out.', toggle('sttVad')),
      row('Show my words as I say them', 'While you\'re talking, what she has heard so far appears next to her. Only with Whisper on this PC. Only for showing: she acts on the finished sentence.', toggle('sttPartials')),
      row('React to her name right away', 'A tiny speech model on this PC catches "Capri" the moment you say it, so she reacts before the rest is written out, even when the words come out wrong. Nothing leaves your PC.', toggle('wakeLocal')),
      row('Only when I say her name', 'In always-listening mode: "Capri, open Spotify". A click on her mic counts as her name.', toggle('wakeWord')),
      row('Her names', 'What counts as her name (comma separated). Whisper sometimes hears "Kapri".', text('wakeWords', { placeholder: 'capri, kapri', max: 120 })),
      row('Words to hear right', 'Names, apps and words of yours, comma separated, spelled the way they are written: Whisper hears them better ("Antigravity", not "anti gravity"). App names like Notepad and VS Code are in already.', text('sttWords', { placeholder: 'Figma, Obsidian, Budi', max: 400 })),
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
// Her own voice: Piper and the voice made for her, from the app's release on GitHub, with one click to use it.
function ownVoiceRow() {
  const status = el('span', { class: 'mono', text: '…' });
  let name = '';
  const using = () => cfg().ttsEngine === 'piper' && cfg().ttsPiperModel === `${name}.onnx`;
  const use = button('Use her voice', async () => {
    await save({ ttsEngine: 'piper', ttsPiperModel: `${name}.onnx` });
    toast(T('She speaks with her own voice now.'));
    render();
  }, 'primary');
  const cancel = button('Cancel', () => act('cancelOwnVoice'));
  const download = button('Download', async () => {
    if (!confirm(T('She will download Piper (about 22 MB, from its official GitHub release) and her voice (about 61 MB, from this app\'s release on GitHub), and check every file against its known fingerprint before using it.'))) return;
    download.disabled = true;
    cancel.hidden = false;
    const res = await act('downloadOwnVoice');
    cancel.hidden = true;
    download.disabled = false;
    if (res?.ok) {
      name = res.name;
      toast(T('Her voice is here.'));
    } else toast(res?.error === 'novoice' ? T("Her voice isn't in the latest release yet.") : `${T('Download failed:')} ${res?.error || ''}`, true);
    paint();
  });
  cancel.hidden = true;
  const paint = async () => {
    const res = await act('ownVoiceStatus').catch(() => null);
    name = name || (res?.voices || []).find((v) => v === 'en_US-capri-medium') || res?.voices?.[0] || '';
    const here = Boolean(name && res?.piper);
    status.textContent = !here ? T('Not downloaded') : using() ? T('In use') : T('Downloaded');
    download.textContent = T(here ? 'Download again' : 'Download');
    use.hidden = !here || using();
  };
  ownVoiceProgress = (p) => {
    status.textContent = `${Math.round(p.done / 1e6)} / ${Math.round(p.total / 1e6)} MB · ${p.percent}%`;
  };
  use.hidden = true;
  paint();
  return row("Capri's own voice", 'Free and offline, no key: Piper with the voice made for her. About 85 MB, once.', status, download, use, cancel);
}

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
      ownVoiceRow(),
      ...rows,
      row('Start right away', 'She starts talking with the first sentence, while the rest is still being written, instead of waiting for the whole answer.', toggle('ttsStream')),
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
    row('Fit the model to my graphics card', 'Ollama only. When the model you picked doesn\'t fit in the memory free on your graphics card (a game running, say), a smaller one answers until it does, instead of a very slow answer.', toggle('modelRouter')),
    row('Backup brain', 'When her main brain fails (offline, out of quota, a bad key), this one answers instead.', toggle('localFallback')),
    row('Quick jobs on it', 'Her word on your songs, her dares: fast and free, without spending your online quota. (With Ollama as her main brain, they use that same model: two models at once push each other out of your graphics card.)', toggle('localBackground')),
    note('Looking back at your chats (her self-improvement) also runs on it when your main brain is online and "Also with a cloud model" is off.'),
  );
}

// What she remembers and what you gave her to read (main/engines): how much, and your files.
function knowledgeCard() {
  const status = el('span', { class: 'mono', text: '…' });
  const meaning = el('span', { class: 'mono', text: '…' });
  const list = el('div');
  const render = async () => {
    const res = await act('knowledgeList').catch(() => null);
    if (!res?.ok) {
      status.textContent = T('Not available');
      return;
    }
    const c = res.counts;
    status.textContent = F('{0} notes · {1} days · {2} messages · {3} pieces of files', c.fact, c.episode, c.chat, c.knowledge);
    meaning.textContent = res.model ? F('{0} understood, with {1}', c.withMeaning, res.model) : T('Words only for now');
    list.replaceChildren(...res.docs.map((d) => row(d.title, d.path, el('span', { class: 'mono', text: F('{0} pieces', d.chunks) }), button('Remove', async () => {
      await act('knowledgeRemove', d.id);
      render();
    }, 'danger'))));
  };
  render();
  const adding = (kind) => async () => {
    const res = await act('knowledgeAdd', kind).catch(() => null);
    if (res?.ok) toast(F('{0} added, {1} updated, {2} the same.', res.added, res.updated, res.same));
    render();
  };
  return card('What she knows',
    row('Her memory', 'On this PC only: her notes about you, what is going on for you, what each day was like, and what you said.', status),
    row('By meaning', 'To find things by what they mean and not only by their words she needs a small embedding model in Ollama: ollama pull nomic-embed-text', meaning),
    row('Give her something to read', 'Text files, notes, code. She answers from them and names the file. Sent to a cloud model only if you allowed her notes to be (Owner page).', button('Add a file', adding('file')), button('Add a folder', adding('folder')),
      button('Refresh', async () => { await act('knowledgeRefresh'); render(); })),
    list);
}

// Making her local model better (main/training): what went well, her test, a trained model only if it passes.
function improveCard() {
  const status = el('span', { class: 'mono', text: '…' });
  const test = el('span', { class: 'mono', text: '' });
  const review = el('div');
  const promote = el('div');
  let timer = 0;
  const render = async () => {
    const res = await act('trainStatus').catch(() => null);
    if (!res?.ok) {
      status.textContent = T('Not available');
      return;
    }
    status.textContent = F('{0} answers kept, {1} went well, {2} of {3} needed', res.counts.total, res.counts.liked + res.counts.kept, res.counts.liked + res.counts.kept, res.needed);
    const r = res.report;
    test.textContent = res.job.running ? F('{0}: {1} of {2}', res.job.what, res.job.done, res.job.all) : r.current ? F('{0}: {1}%', r.current.model, r.current.score) : T('Not tested yet');
    promote.replaceChildren(r.candidate && r.verdict ? row(F('{0}: {1}%', r.candidate.model, r.candidate.score), r.verdict.yes ? T('It did better than the one she uses.') : F('Not used: {0}.', r.verdict.why), ...(r.verdict.yes ? [button('Use it', async () => { await act('trainPromote'); toast(T('She talks with it now.')); })] : [])) : el('span'));
    clearTimeout(timer);
    if (res.job.running && document.body.contains(status)) timer = setTimeout(render, 2000);
  };
  const showReview = async () => {
    const res = await act('trainReview').catch(() => null);
    review.replaceChildren(...(res?.list || []).map((x) => row(x.user.slice(0, 80), x.answer.slice(0, 200),
      button('Keep', async () => { await act('trainJudge', { id: x.id, verdict: 1 }); showReview(); }),
      button('Never', async () => { await act('trainJudge', { id: x.id, verdict: -1 }); showReview(); }, 'danger'))));
  };
  render();
  return card('Improve her (local models only)',
    note('Her answers are marked by what you do next: a pat, a laugh, "good answer", a correction. The good ones can train her local model. All of it stays on this PC.'),
    row('So far', 'Say "good answer" or "jawabanmu salah" right after an answer to mark it yourself.', status, button('Look through them', showReview)),
    review,
    row('Her test', '100 questions: in character, short, the right language, honest about what she can\'t do. A few minutes, and it uses your graphics card meanwhile.', test, button('Test her model', async () => { await act('trainTest'); setTimeout(render, 500); }), button('Stop', () => act('trainStop'))),
    row('Train her', 'Makes a folder with the dataset and the script for a machine with a GPU (Colab, say). Keep it private: it holds your chats and her lines from the show.', button('Make the folder', async () => {
      const res = await act('trainExport');
      toast(res?.ok ? F('{0} examples. {1}', res.used, res.enough ? T('Enough to train on.') : T('Too few to train on yet.')) : T('Only for a model on this PC.'), !res?.ok);
    })),
    row('Install a trained model', 'Pick the .gguf. It is tested against the one she uses, and offered only if it did better.', button('Choose a file', async () => { await act('trainInstall'); setTimeout(render, 500); })),
    promote);
}

// Her skills (assets/skills, and yours in her data): how she goes about a kind of work.
function skillPacksCard() {
  const list = el('div');
  const render = async () => {
    const res = await act('skillList').catch(() => null);
    const off = cfg().skillPacksOff || [];
    const all = res?.skills || [];
    const single = all.filter((s) => s.source !== 'pack').map((s) => {
      const on = !off.includes(s.id);
      return row(s.name, s.about, button(on ? 'On' : 'Off', async () => {
        await save({ skillPacksOff: on ? [...off, s.id] : off.filter((x) => x !== s.id) });
        render();
      }));
    });
    // the big collection, a switch per subject
    const groups = new Map();
    for (const s of all.filter((x) => x.source === 'pack')) groups.set(s.group || 'Other', [...(groups.get(s.group || 'Other') || []), s]);
    const packs = [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([group, skills]) => {
      const ids = skills.map((s) => s.id);
      const on = ids.some((id) => !off.includes(id));
      return row(group, F('{0} skills, like {1}.', skills.length, skills.slice(0, 3).map((s) => s.name).join(', ')), button(on ? 'On' : 'Off', async () => {
        await save({ skillPacksOff: on ? [...new Set([...off, ...ids])] : off.filter((x) => !ids.includes(x)) });
        render();
      }));
    });
    list.replaceChildren(...single, ...packs);
  };
  render();
  return card('Her skills',
    note('How she goes about a kind of work when what you say calls for it. A skill is a folder with skill.json and prompt.md: words only, it can never run anything.'),
    note('To use one from the collection, name it: "pakai skill seo audit", or ask for help with it by name.'),
    list,
    row('Add your own', 'Drop a skill folder in here, then restart her.', button('Open the folder', () => act('skillsFolder'))));
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
      row('Conversation memory', 'How many recent messages she keeps in mind.', ...range('contextMessages', 4, 60, 2, (v) => `${v}`)),
      row('Commands in my own words', '"Could you crank it up", "puterin yang santai": when her rules miss a command, her model says which one it is (one short call) and she tells you how she took it. Never closing an app or anything behind a button.', toggle('intentRouter'))),
    localBrainCard(),
    card('Coding',
      row('Who writes the code', '"buatkan kode…", "code a script that…": Claude Code in a terminal (you approve its edits there), or Capri herself with her model, one file opened in your editor (never run).',
        select('coder', [['auto', 'Claude Code if installed, else her'], ['claude', 'Claude Code'], ['self', 'Capri herself']])),
      row('Coding folder', 'Where the code goes. Empty: Documents\\Capri Code.', text('codeFolder', { placeholder: 'Documents\\Capri Code' }))),
    knowledgeCard(),
    skillPacksCard(),
    improveCard(),
    card('Her eyes (Look)',
      row('Let her look when I ask', 'Ctrl+Alt+L or "what am I looking at?": one screenshot, kept in memory only, sent to her model, then dropped.', toggle('lookOn')),
      row('Also with a cloud model', 'Off: she only looks through a model on this PC.', toggle('cloudLook')),
      row('Try it', null, button('Look at my screen', () => act('testLook')))),
    card('Conversations',
      row('Talk to her', null, button('Open her chat', () => act('chat'))),
      row('Forget our conversations', 'Her notes about you stay (Owner page).', button('Forget', async () => { await act('forgetChats'); toast(T('Forgotten.')); }, 'danger'))),
  ];
}

// Commands of yours: a name, and what she does for it, in your words (also taught by saying "when I say work
// mode, open vscode and play music"). Each runs like you'd said it, with the same Access switches.
function skillsCard() {
  const skills = cfg().skills || [];
  const name = el('input', { type: 'text', placeholder: T('work mode'), maxlength: '40' });
  const run = el('input', { type: 'text', placeholder: T('open vscode and play music'), maxlength: '300' });
  const add = async () => {
    const n = name.value.trim(), r = run.value.trim();
    if (!n || !r) return;
    const others = skills.filter((s) => s.name.toLowerCase() !== n.toLowerCase());
    if (others.length >= 30) { toast(T('She can keep 30 of those.'), true); return; }
    await save({ skills: [...others, { name: n, run: r }] });
    render();
    toast(F('"{0}" learned.', n));
  };
  run.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
  const list = skills.map((s, i) => row(s.name, s.run, button('Forget', async () => {
    await save({ skills: skills.filter((_, j) => j !== i) });
    render();
  }, 'danger')));
  return card('Your commands',
    note('Say the name and she does all of it, one after the other: "work mode", "mode santai". Or teach her out loud: "when I say work mode, open vscode and play music".'),
    ...list,
    row('New command', 'Its name, and what to do in your words (several things with "and", "lalu", "terus").', el('span', { class: 'skill-new' }, name, run), button('Add', add, 'primary')));
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
    card('Your day',
      row('Your city', 'For the weather ("cuaca hari ini", "will it rain tomorrow?") and her brief of your day. From Open-Meteo: only the city goes out.', text('weatherCity', { placeholder: 'Bandung', max: 60 })),
      row('Morning brief', 'The first time you are at your PC in the morning: the date, the weather, your alarms for today. Or say "brief me", "rangkuman hari ini".', toggle('dailyBrief'), button('Brief me now', () => act('brief')))),
    skillsCard(),
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
      row('Her mood through the day', 'She has good days and bad days. Her mood builds up from the hour, how you treat her and the songs she hears, and it stays after a restart: it changes how she talks and how much she moves around.', toggle('moodEngine')),
      row('Check how a song really sounds', 'What she thinks of a new song goes by its real loudness and tempo instead of a guess. Sends only the title and artist to Deezer\'s public catalogue, once per song.', toggle('songData')),
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
      row('Mask while I focus', 'During a focus session she goes down to her green mask, not a word, and comes back for the break. Click her mask to call her. Saying "focus mode", "game mode" or "quiet mode" does it any time; "normal mode" brings her back.', toggle('focusMask')),
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
      updatesRow(),
      row('Debug log', 'More details in the console (developers).', toggle('debugLog')),
      row('Bridge port', 'Where her Claude Code hooks reach her.', el('span', { class: 'mono', text: String(state.port) }))),
    card('Your data',
      row('Her data folder', state.dataDir, button('Open', () => act('openData'))),
      row('Settings file', 'Export or import everything except your API keys.', button('Export…', async () => { const r = await act('export'); if (r?.ok) toast(T('Exported.')); }), button('Import…', async () => { const r = await act('import'); if (r?.ok) { state = await api.get(); render(); toast(T('Imported.')); } else if (r && !r.ok) toast(r.error, true); })),
      row('Reset', 'Back to how she came. Your API keys stay.', button('Reset all settings', async () => { if (confirm(T('Reset all of her settings?'))) { await act('reset'); state = await api.get(); render(); } }, 'danger'))),
  ];
}

// New versions from her GitHub Releases: how she gets them, and where it stands.
function updatesRow() {
  const u = state.update || {};
  if (!u.supported) return row('Updates', 'This copy can\'t update itself (the portable one, or run from her source). New versions: her GitHub Releases page.', el('span', { class: 'mono', text: `v${state.version}` }));
  const where = {
    checking: T('Looking…'),
    latest: F('v{0}: the latest.', state.version),
    available: F('v{0} is out.', u.version),
    downloading: F('Downloading v{0}… {1}%', u.version, u.percent || 0),
    ready: F('v{0} is downloaded: it installs when she restarts.', u.version),
    error: F('Could not check: {0}', u.error || ''),
  }[u.phase] || F('v{0}', state.version);
  const next = u.phase === 'available' ? button('Download', () => act('downloadUpdate').then(render), 'primary')
    : u.phase === 'ready' ? button('Restart and update', () => act('installUpdate'), 'primary')
      : button('Check now', () => act('checkUpdate').then(render));
  return row('Updates', `${T('Ask me: she tells you when there is a new version. Automatic: downloaded on its own, installed when you close her. Checked against the release before it installs.')} ${where}`,
    seg('autoUpdate', [['notify', 'Ask me'], ['auto', 'Automatic'], ['off', 'Off']]), next);
}

// Everything she can see, hear and do on your PC, in one place (the same switches as on the other pages, and
// the ones only here: what she may do with your apps, files, sites, media, Spotify and code).
// Your own Spotify developer app: optional. Without it nothing changes.
function spotifyCard() {
  const status = el('span', { class: 'mono', text: '…' });
  const redirect = el('span', { class: 'mono', text: '' });
  const problem = el('p', { class: 'note' });
  problem.hidden = true;
  const connect = button('Connect', async () => {
    status.textContent = T('Waiting for your browser…');
    problem.hidden = true;
    const res = await act('spotifyConnect').catch(() => null);
    const why = { noid: 'Paste your Client ID first.', denied: 'You said no on Spotify\'s page.', timeout: 'Nothing came back in time. If Spotify showed "redirect_uri: Not matching configuration", the Redirect URI above is not saved in your app yet: do steps 1 and 2 again, and press Save at the very bottom of Spotify\'s page.', port: 'Something else is using the port she needs.' }[res?.why];
    if (res?.ok) toast(T('Connected.'));
    else {
      problem.textContent = T(why || 'That did not work.');
      problem.hidden = false;
    }
    render();
  });
  const render = async () => {
    const res = await act('spotifyStatus').catch(() => null);
    status.textContent = res?.connected ? T('Connected') : T('Not connected');
    redirect.textContent = res?.redirect || '';
  };
  render();
  return card('Spotify developer app (optional)',
    note('Without this she opens Spotify and presses Play, as always. With it she searches and plays with no window coming up. Playing needs Spotify Premium, and Spotify running on this PC or your phone. Your password never goes through her.'),
    stack('How to set it up', 'Once only. 1: open your app in the Spotify dashboard, then Settings and Edit. 2: under Redirect URIs paste the address below, press Add, then Save at the very bottom. 3: paste the Client ID here and press Connect.', el('div', { class: 'row__control' }, button('Open Spotify dashboard', () => act('spotifyDashboard')))),
    row('Client ID', 'From your app at developer.spotify.com/dashboard. Web API ticked.', text('spotifyClientId', { placeholder: '32 letters and numbers', max: 64 })),
    row('Redirect URI', 'Must be exactly this: http, 127.0.0.1 (not localhost), and no slash at the end.', redirect, button('Copy', async () => { await navigator.clipboard.writeText(redirect.textContent); toast(T('Copied.')); })),
    row('Account', 'Connected, she can also play your own playlists: "putar playlist chill", "daftar playlist aku". If you connected before this was added, press Connect once more.', status, connect, button('Disconnect', async () => { await act('spotifyDisconnect'); render(); }, 'danger')),
    problem);
}

function smartHomeCard() {
  const status = el('span', { class: 'mono', text: T('Not checked yet') });
  const list = el('div');
  const problem = el('p', { class: 'note' });
  problem.hidden = true;
  const WHY = {
    notset: 'Fill in your Access ID and Access Secret first.',
    nodevices: 'No devices came back. Check step 3: your app account has to be linked to this project.',
    badkey: 'Tuya says your Access ID or Access Secret is wrong.',
    noaccess: 'Tuya refused. Check that your project has the IoT Core service and that your app account is linked.',
    expired: 'Your Tuya project has run out of its free period. Renew it on the Tuya site.',
  };
  const check = async () => {
    status.textContent = T('Checking…');
    problem.hidden = true;
    const res = await act('homeStatus').catch(() => null);
    status.textContent = res?.ok ? F('{0} devices', res.devices.length) : T('Not connected');
    if (res?.ok && res.refused) {
      problem.textContent = T('Your IR blaster is there, but Tuya refused to list its remotes. Add the IR Control Hub Open Service to your project in Service API.');
      problem.hidden = false;
    }
    if (!res?.ok) {
      problem.textContent = T(WHY[res?.why] || 'That did not work.');
      problem.hidden = false;
      list.replaceChildren();
      return;
    }
    list.replaceChildren(...res.devices.map((d) => {
      const send = (on) => async () => {
        const done = await act('homeSet', { id: d.id, on }).catch(() => null);
        toast(done?.ok ? T('Done.') : T(WHY[done?.why] || 'That did not work.'), !done?.ok);
      };
      return row(d.name, `${d.ac ? `${T('Air conditioner')} · ` : ''}${d.online ? T('Online') : T('Offline')}`, button('On', send(true)), button('Off', send(false)));
    }));
  };
  return card('Smart home',
    note('Lights and plugs from Bardi and other Tuya-based brands: say "matiin lampu kamar" and it happens. Commands go through your own free Tuya cloud project, so they need internet. Your password never goes through her.'),
    stack('How to set it up', 'Once only. 1: put your lights in the Smart Life app. If your Bardi account does not work there, add the lights again in Smart Life. 2: on the Tuya site create a Cloud project with the IoT Core service, and copy its Access ID and Access Secret. 3: in the project open Devices, Link App Account, and scan the code with Smart Life. 4: fill in the two fields here and press Connect.', el('div', { class: 'row__control' }, button('Open the Tuya site', () => act('homeDashboard')))),
    note('For an air conditioner: a Wi-Fi AC in Smart Life works as it is. A normal AC needs an IR blaster (Bardi sells one), with the AC added as a remote in Smart Life, and the IR Control Hub Open Service added to your project in Service API. Then: "ac 24 derajat", "ac mode kering", "kipas ac kencang".'),
    row('Access ID', 'From your Tuya cloud project.', text('tuyaId', { placeholder: 'Access ID', max: 64 })),
    row('Access Secret', 'Kept encrypted on this PC, and never shown again.', keyField('tuya')),
    row('Data center', 'Automatic finds it the first time you connect.', select('tuyaRegion', [['', 'Automatic'], ['sg', 'Singapore'], ['us', 'Western America'], ['us-e', 'Eastern America'], ['eu', 'Central Europe'], ['eu-w', 'Western Europe'], ['in', 'India'], ['cn', 'China']])),
    row('Your devices', 'Press Connect after any change. On and Off here try each one.', status, button('Connect', check, 'primary')),
    list,
    problem);
}

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
      row('Look things up online', 'Questions about the world ("siapa presiden indonesia", "who is the CEO of Nvidia") are looked up on Wikipedia and Bing first, a second or so, so she answers from today\'s web. Only your question goes out.', toggle('access.search')),
      row('Media keys', 'Pause, next, previous, volume: the keys on your keyboard, pressed for you.', toggle('access.media')),
      row('Spotify', 'Search Spotify and press Play on the song you ask for.', toggle('access.spotify')),
      row('Smart home', 'Switch your connected lights and plugs when you ask.', toggle('access.home')),
      row('Write code', 'Write code into her Code folder (never run), or open Claude Code with your task.', toggle('access.code')),
      row('Her own browser', 'A browser of hers (Edge or Chrome, in a profile of its own, never yours) that she can open, read, click links and fill fields in when you ask ("browse example.com", "baca halaman di browsermu"). Never a password or card field.', toggle('access.browser')),
      row('Press buttons', 'Press a button by its name when you ask ("click the Send button", "klik tombol Kirim"), only in the app you name or the one you were in. Never a button that deletes, pays or can\'t be undone.', toggle('access.click')),
      row('Type for me', 'Type what you say into another app ("type hello in notepad", "buka notepad lalu ketik halo"), and press Enter or Ctrl+S when you ask. Only into the app you name or the one you were in.', toggle('access.type')),
      row('Possess my windows', 'Now and then she dives into the window she sits on: it only looks taken over, nothing in it is touched.', toggle('possess'))),
    spotifyCard(),
    smartHomeCard(),
    card('What goes online',
      row('Song lyrics', 'The words of the song over her head as they\'re sung, from LRCLIB (lrclib.net, free, no account). Only the title, artist, album and length go out to look them up.', toggle('lyrics')),
      row('Her notes with a cloud model', 'Off: her notes about you, the story so far and her self-improvement only use a model on this PC. On: they also go to your cloud AI (needed for an online brain that remembers you).', toggle('cloudMemory'))),
    card('What she keeps on this PC',
      row('Memory', 'She keeps what you tell her to remember ("remember that…", "ingat bahwa…") and uses it in chat.', toggle('memoryOn')),
      row('Recall past chats', 'When you talk about something you told her before (weeks ago too), she remembers it: the lines it is about, found in your chats kept on this PC. With an embedding model in Ollama (nomic-embed-text), by meaning too.', toggle('recallChats')),
      row('Keep my chats', 'Every chat turn, typed or spoken, kept on this PC (a file a day). Off: nothing new is kept, and she can\'t learn from your chats.', toggle('historyOn')),
      row('Song verdicts', 'What she thinks of each song she has heard (loves it, likes it, bored by it), so she feels the same next time.', button('Forget them', async () => { await save({ tastes: {} }); toast(T('She will make up her mind again.')); }, 'danger')),
      row('Lyrics cache', 'The words of songs you\'ve played, kept so they show at once next time without asking LRCLIB again.', kept, button('Clear', clear, 'danger'))),
    actionsCard(),
  ];
}

// What she did on your PC, newest first: the app, the page, the key, how much she typed and where (never what).
const ACTION_NAMES = { app: 'Opened', open: 'Opened', find: 'Found', browser: 'Opened in a browser', web: 'Searched', video: 'Played a video', song: 'Played', playlist: 'Played', spotifySearch: 'Searched Spotify', home: 'Smart home', media: 'Media', type: 'Typed', key: 'Pressed', close: 'Closed', code: 'Code' };
function actionsCard() {
  const list = state.actions || [];
  const when = (at) => new Date(at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const rows = list.map((a) => el('li', { class: `actions__item${a.ok ? '' : ' is-failed'}` },
    el('span', { class: 'mono actions__when', text: when(a.at) }),
    el('span', { class: 'actions__what', text: `${T(ACTION_NAMES[a.kind] || a.kind)} ${a.what}` }),
    el('span', { class: 'actions__how', text: [a.via === 'voice' ? T('said') : '', a.routed ? F('taken as "{0}"', a.routed) : '', a.ok ? '' : (a.why || T('did not work'))].filter(Boolean).join(' · ') })));
  return card('What she did',
    row('Keep a log', 'Every app, page, search and key, and where she typed for you (how much, never the words), on this PC only. The last 300.', toggle('actionLog'),
      button('Clear', async () => { await act('clearActions'); render(); toast(T('Log cleared.')); }, 'danger')),
    list.length ? el('ol', { class: 'actions' }, ...rows) : note('Nothing yet. Ask her to open something.'));
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

// ---- plugins (main/plugins.js): made here, without code ----

let editing = null; // the plugin being made or changed: { id, name, on, when, do, cooldown }, or null
const WHEN_KINDS = [['said', 'I say something'], ['time', 'At a time'], ['app', 'An app comes to the front'], ['song', 'A song starts'], ['back', "I'm back after a while"], ['start', 'She starts'], ['battery', 'My battery gets low']];
const STEP_KINDS = [['say', 'Say'], ['command', 'Do a command'], ['wait', 'Wait'], ['move', 'Move'], ['emotion', 'Feel'], ['notify', 'Windows notification']];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WHEN_DEFAULT = {
  said: () => ({ type: 'said', phrase: '', match: 'exact' }), time: () => ({ type: 'time', at: '08:00', days: [] }), app: () => ({ type: 'app', app: '' }),
  song: () => ({ type: 'song', artist: '', title: '' }), back: () => ({ type: 'back', minutes: 30 }), start: () => ({ type: 'start' }), battery: () => ({ type: 'battery', below: 20 }),
};
const STEP_DEFAULT = { say: () => ({ type: 'say', text: '' }), command: () => ({ type: 'command', text: '' }), wait: () => ({ type: 'wait', seconds: 5 }), move: () => ({ type: 'move', move: 'wave' }), emotion: () => ({ type: 'emotion', emotion: 'happy' }), notify: () => ({ type: 'notify', text: '' }) };
const copy = (o) => JSON.parse(JSON.stringify(o));

// its "when", in words
function whenText(w) {
  switch (w?.type) {
    case 'said': return w.match === 'contains' ? F('When you say something with "{0}"', w.phrase) : F('When you say "{0}"', w.phrase);
    case 'time': {
      const d = w.days || [];
      const days = !d.length || d.length === 7 ? T('every day') : d.join() === '1,2,3,4,5' ? T('on weekdays') : d.join() === '0,6' ? T('on weekends') : d.map((i) => T(DAYS[i])).join(', ');
      return F('At {0}, {1}', w.at, days);
    }
    case 'app': return F('When {0} comes to the front', w.app);
    case 'song': return w.artist || w.title ? F('When a song starts: {0}', [w.title, w.artist].filter(Boolean).join(' · ')) : T('When a song starts');
    case 'back': return F("When you're back after {0} minutes away", w.minutes);
    case 'start': return T('When she starts');
    case 'battery': return F('When your battery drops below {0}%', w.below);
    default: return '';
  }
}
// its steps, in a line
const stepsText = (p) => (p.do || []).map((s) => ({
  say: () => `💬 "${s.text}"`, command: () => `▶ ${s.text}`, wait: () => `⏱ ${s.seconds}s`, move: () => `✦ ${T(s.move)}`, emotion: () => `◆ ${T(s.emotion)}`, notify: () => `🔔 "${s.text}"`,
}[s.type]?.() || '')).join('  →  ');

const plugins = () => cfg().plugins || [];
const savePlugins = (list) => save({ plugins: list });

// a select whose options are [value, label] (labels translated)
function choice(options, value, onChange) {
  const sel = el('select', { onchange: () => onChange(sel.value) }, ...options.map(([v, label]) => el('option', { value: v, text: T(label) })));
  sel.value = value;
  return sel;
}
function field(value, onInput, { placeholder = '', max = 300, type = 'text', min, maxN } = {}) {
  const input = el('input', { type, placeholder: T(placeholder), maxlength: type === 'text' ? max : null, min, max: maxN, spellcheck: 'false' });
  input.value = value ?? '';
  input.addEventListener('input', () => onInput(type === 'number' ? Number(input.value) : input.value));
  return input;
}

function pluginRow(p) {
  const on = el('input', { type: 'checkbox', role: 'switch' });
  on.checked = p.on !== false;
  on.addEventListener('change', () => savePlugins(plugins().map((q) => (q.id === p.id ? { ...q, on: on.checked } : q))));
  return el('div', { class: `plugin${p.on === false ? ' is-off' : ''}` },
    el('div', { class: 'plugin__head' },
      el('span', { class: 'plugin__name', text: p.name }),
      el('span', { class: 'switch' }, on, el('span'))),
    el('div', { class: 'plugin__when', text: whenText(p.when) }),
    el('div', { class: 'plugin__steps', text: stepsText(p) }),
    el('div', { class: 'plugin__actions' },
      button('Run now', async () => { const r = await act('pluginRun', p.id); toast(r?.ok ? F('Running "{0}".', p.name) : T('Switch it on first.'), !r?.ok); }),
      button('Edit', () => { editing = copy(p); render(); }),
      button('Export…', async () => { const r = await act('pluginExport', p.id); if (r?.ok) toast(T('Exported.')); }),
      button('Delete', async () => { if (confirm(F('Delete "{0}"?', p.name))) { await savePlugins(plugins().filter((q) => q.id !== p.id)); render(); } }, 'danger')));
}

function whenFields(w) {
  const set = (k) => (v) => { w[k] = v; };
  switch (w.type) {
    case 'said': return [field(w.phrase, set('phrase'), { placeholder: 'work mode', max: 60 }), choice([['exact', 'Exactly that'], ['contains', 'In a sentence']], w.match, set('match'))];
    case 'time': {
      const days = DAYS.map((d, i) => {
        const box = el('input', { type: 'checkbox' });
        box.checked = w.days.includes(i);
        box.addEventListener('change', () => { w.days = DAYS.map((_, j) => j).filter((j) => (j === i ? box.checked : w.days.includes(j))); });
        return el('label', { class: 'check' }, box, T(d));
      });
      return [field(w.at, set('at'), { type: 'time' }), el('span', { class: 'plugin__days' }, ...days)];
    }
    case 'app': return [field(w.app, set('app'), { placeholder: 'Code, Chrome, Discord', max: 40 })];
    case 'song': return [field(w.title, set('title'), { placeholder: 'Title (any)', max: 60 }), field(w.artist, set('artist'), { placeholder: 'Artist (any)', max: 60 })];
    case 'back': return [field(w.minutes, set('minutes'), { type: 'number', min: 20, maxN: 600 }), el('span', { class: 'mono', text: T('minutes away') })];
    case 'battery': return [field(w.below, set('below'), { type: 'number', min: 5, maxN: 80 }), el('span', { class: 'mono', text: '%' })];
    default: return [];
  }
}

function stepFields(s) {
  const set = (k) => (v) => { s[k] = v; };
  switch (s.type) {
    case 'say': return [field(s.text, set('text'), { placeholder: 'Good morning! Ready?' })];
    case 'command': return [field(s.text, set('text'), { placeholder: 'open spotify and play music' })];
    case 'notify': return [field(s.text, set('text'), { placeholder: 'Time for a break', max: 200 })];
    case 'wait': return [field(s.seconds, set('seconds'), { type: 'number', min: 1, maxN: 600 }), el('span', { class: 'mono', text: T('seconds') })];
    case 'move': return [choice((state.pluginKit?.moves || ['wave']).map((m) => [m, m]), s.move, set('move'))];
    case 'emotion': return [choice((state.pluginKit?.emotions || ['happy']).map((m) => [m, m]), s.emotion, set('emotion'))];
    default: return [];
  }
}

// what's missing before it can be saved ('' when nothing)
function pluginProblem(p) {
  if (!String(p.name || '').trim()) return T('Give it a name.');
  const w = p.when;
  if (w.type === 'said' && !String(w.phrase || '').trim()) return T('What do you say to set it off?');
  if (w.type === 'time' && !/^\d{1,2}:\d{2}$/.test(w.at || '')) return T('Pick a time.');
  if (w.type === 'app' && !String(w.app || '').trim()) return T('Which app?');
  const steps = p.do.filter((s) => !['say', 'command', 'notify'].includes(s.type) || String(s.text || '').trim());
  if (!steps.length) return T('Add a step: what she does.');
  return '';
}

function pluginEditor() {
  const p = editing;
  const max = state.pluginKit?.maxSteps || 12;
  const steps = p.do.map((s, i) => el('div', { class: 'plugin-step' },
    el('span', { class: 'plugin-step__n mono', text: String(i + 1) }),
    choice(STEP_KINDS, s.type, (v) => { p.do[i] = STEP_DEFAULT[v](); render(); }),
    el('span', { class: 'plugin-step__fields' }, ...stepFields(s)),
    el('span', { class: 'plugin-step__tools' },
      button('↑', () => { if (i > 0) { [p.do[i - 1], p.do[i]] = [p.do[i], p.do[i - 1]]; render(); } }),
      button('↓', () => { if (i < p.do.length - 1) { [p.do[i + 1], p.do[i]] = [p.do[i], p.do[i + 1]]; render(); } }),
      button('✕', () => { p.do.splice(i, 1); render(); }, 'danger'))));
  const saveIt = async (andRun) => {
    const problem = pluginProblem(p);
    if (problem) { toast(problem, true); return; }
    const list = plugins();
    const i = list.findIndex((q) => q.id === p.id);
    const next = i >= 0 ? list.map((q) => (q.id === p.id ? p : q)) : [...list, p];
    await savePlugins(next);
    if (!plugins().some((q) => q.id === p.id)) { toast(T('Something in it isn\'t right: check its steps.'), true); return; }
    editing = null;
    render();
    toast(F('"{0}" saved.', p.name));
    if (andRun) act('pluginRun', p.id);
  };
  return card(p.name ? F('Plugin: {0}', p.name) : 'New plugin',
    row('Name', null, field(p.name, (v) => { p.name = v; }, { placeholder: 'Morning routine', max: 60 })),
    stack('When', 'What sets it off.', el('div', { class: 'plugin-line' }, choice(WHEN_KINDS, p.when.type, (v) => { p.when = WHEN_DEFAULT[v](); render(); }), ...whenFields(p.when))),
    stack('Do', 'Her steps, one after the other. A command is anything you would say to her ("open spotify and play music", "pasang timer 25 menit", "type hello in notepad"): your Access switches still apply.',
      el('div', { class: 'plugin-steps' }, ...steps),
      p.do.length < max && el('div', { class: 'plugin-line' }, button('+ Add step', () => { p.do.push(STEP_DEFAULT.say()); render(); }))),
    row('Not again for', 'Minutes before it can go off again.', field(p.cooldown, (v) => { p.cooldown = v; }, { type: 'number', min: 0, maxN: 1440 }), el('span', { class: 'mono', text: T('min') })),
    row('', null, button('Save', () => saveIt(false), 'primary'), button('Save and try', () => saveIt(true)), button('Cancel', () => { editing = null; render(); })));
}

function pagePlugins() {
  if (editing) return [pluginEditor()];
  const list = plugins();
  const blank = () => ({ id: `p${Date.now().toString(36)}`, name: '', on: true, when: WHEN_DEFAULT.said(), do: [STEP_DEFAULT.say()], cooldown: 1 });
  return [
    note('Make her do things on her own, without code: WHEN something happens (you say something, a time, an app, a song…), she DOES your steps. Her commands in them go through the same rules and Access switches as when you ask. Plugins from a file arrive switched off: read their steps first.'),
    card('Your plugins',
      ...(list.length ? list.map(pluginRow) : [note('None yet. Start from a ready-made one below, or make your own.')]),
      row('Add', null, button('New plugin', () => { editing = blank(); render(); }, 'primary'),
        button('Import…', async () => {
          const r = await act('pluginImport');
          if (r?.ok) { state = await api.get(); render(); toast(F('Imported {0}, switched off: read its steps, then switch it on.', r.names.join(', '))); } else if (r && !r.ok) toast(T(r.error), true);
        }))),
    card('Ready-made',
      ...(state.pluginKit?.templates || []).map((t) => row(t.name, `${whenText(t.when)}  →  ${stepsText(t)}`,
        button('Add', async () => { await savePlugins([...plugins(), { ...copy(t), id: `p${Date.now().toString(36)}`, on: true, cooldown: t.cooldown ?? 1 }]); render(); toast(F('"{0}" added.', T(t.name))); })))),
  ];
}

const PAGES = [
  ['capri', 'Capri', 'Who she is, how she talks and how she shows it.', pageCapri],
  ['owner', 'Owner', 'Who you are to her: your profile and what she remembers about you.', pageOwner],
  ['voice', 'Voice', 'Her ears (your microphone) and her voice.', pageVoice],
  ['brain', 'AI brain', 'Which AI she talks through, and her eyes.', pageBrain],
  ['behavior', 'Behavior', 'What she does on her own: remarks, dares, mischief, sync.', pageBehavior],
  ['plugins', 'Plugins', 'Make her do things on her own, without code: when something happens, she does your steps.', pagePlugins],
  ['access', 'Access', 'What she can see, hear and do on your PC, and what she keeps.', pageAccess],
  ['timers', 'Timers', 'Alarms, timers and the study timer.', pageTimers],
  ['history', 'History', 'Your chats with her, and her long-term memory of them.', pageHistory],
  ['advanced', 'Advanced', 'Language, hotkeys, system, your data.', pageAdvanced],
  ['about', 'About', 'What she is, and what she can do.', pageAbout],
];

// ---- drawing ---------------------------------------------------------------------------------------

const GROUPS = [
  ['Who she is', ['capri', 'owner', 'voice']],
  ['What she does', ['brain', 'behavior', 'plugins', 'timers']],
  ['Your PC', ['access', 'history']],
  ['More', ['advanced', 'about']],
];

const ring = 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z';
const ICONS = {
  capri: ['M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z', 'M19 16v4M17 18h4'],
  owner: ['M12 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8z', 'M4 21a8 8 0 0 1 16 0'],
  voice: ['M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z', 'M5 11a7 7 0 0 0 14 0', 'M12 18v3'],
  brain: ['M6 6h12v12H6z', 'M10 10h4v4h-4z', 'M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4'],
  behavior: [ring, 'M8 14s1.5 2 4 2 4-2 4-2', 'M9 9.5h.01M15 9.5h.01'],
  plugins: ['M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4z', 'M16.5 14v6M13.5 17h6'],
  access: ['M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', 'M9 12l2 2 4-4'],
  timers: [ring, 'M12 7v5l3 2'],
  history: ['M3 12a9 9 0 1 0 3-6.7L3 8', 'M3 3v5h5', 'M12 7v5l3 2'],
  advanced: ['M4 7h10M18 7h2M4 17h2M10 17h10', 'M16 5a2 2 0 1 0 0 4a2 2 0 1 0 0-4z', 'M8 15a2 2 0 1 0 0 4a2 2 0 1 0 0-4z'],
  about: [ring, 'M12 11v5M12 8h.01'],
  search: ['M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14z', 'M20 20l-3.5-3.5'],
  tour: ['M9 4l6 2 6-2v14l-6 2-6-2-6 2V6z', 'M9 4v14M15 6v14'],
  close: ['M6 6l12 12M18 6L6 18'],
};

function icon(name) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of ICONS[name] || []) {
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

let tour = null;
let found = null; // what to light up once its page is drawn: { card, label }

function go(id) {
  const search = document.getElementById('search');
  search.value = '';
  page = id;
  if (location.hash.slice(1) !== id) location.hash = id;
  render();
  document.getElementById('main').scrollTop = 0;
}

function renderNav() {
  const nav = document.getElementById('nav');
  nav.replaceChildren(...GROUPS.map(([title, ids]) => el('div', { class: 'nav__group' },
    el('div', { class: 'nav__title', text: T(title) }),
    ids.map((id) => el('button', {
      type: 'button', 'data-page': id, 'aria-current': id === page ? 'page' : null, onclick: () => go(id),
    }, icon(id), el('span', { text: T(PAGES.find(([p]) => p === id)[1]) }))))));
}

function step(by) {
  const i = PAGES.findIndex(([id]) => id === page);
  go(PAGES[(i + by + PAGES.length) % PAGES.length][0]);
}

function renderSync() {
  if (!state) return;
  document.getElementById('sync').textContent = cfg().syncShown === false ? '' : `Sync ${state.sync}%`;
}

function render() {
  for (const stop of cleanup.splice(0)) stop();
  earsProgress = null;
  const def = PAGES.find(([id]) => id === page) || PAGES[0];
  page = def[0];
  const [, title, lede, build] = def;
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
  lightFound();
}

const rowName = (row) => {
  const label = row.querySelector('.row__label');
  return label ? [...label.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join('').trim() : '';
};

// Opened from a search: go to it and light it up for a moment.
function lightFound() {
  if (!found) return;
  const { card, label } = found;
  found = null;
  const main = document.getElementById('main');
  const box = [...main.querySelectorAll('.card')].find((c) => c.querySelector('.card__title')?.textContent === card);
  if (!box) return;
  const row = [...box.querySelectorAll('.row')].find((r) => rowName(r) === label);
  (row || box).scrollIntoView({ block: 'center' });
  if (!row) return;
  row.classList.add('is-found');
  setTimeout(() => row.classList.remove('is-found'), 1800);
}

// ---- finding a setting ---------------------------------------------------------------------------------

let searchIndex = null;

// Every setting of every page, read off the pages themselves, so it can't go out of date. (Building a page has no side effects: mics and
// tests only start from their buttons.)
function buildIndex() {
  if (searchIndex) return searchIndex;
  const out = [];
  const pendingCleanup = cleanup;
  const pendingEars = earsProgress;
  cleanup = [];
  for (const [id, title, , build] of PAGES) {
    let nodes = [];
    try {
      nodes = build().filter(Boolean);
    } catch {
      continue;
    }
    const holder = el('div', {}, ...nodes);
    for (const box of holder.querySelectorAll('.card')) {
      const card = box.querySelector('.card__title')?.textContent || T(title);
      out.push({ page: id, where: T(title), card, label: card, help: '' });
      for (const row of box.querySelectorAll('.row')) {
        const label = rowName(row);
        if (label) out.push({ page: id, where: `${T(title)} · ${card}`, card, label, help: row.querySelector('.row__help')?.textContent || '' });
      }
    }
  }
  for (const stop of cleanup.splice(0)) stop();
  cleanup = pendingCleanup;
  earsProgress = pendingEars;
  searchIndex = out;
  return out;
}

function renderSearch(query) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) {
    render();
    return;
  }
  const hits = buildIndex().filter((e) => terms.every((t) => `${e.label} ${e.help} ${e.where}`.toLowerCase().includes(t))).slice(0, 40);
  const main = document.getElementById('main');
  main.replaceChildren(
    el('header', { class: 'page__head' }, el('h1', { class: 'page__title', text: T('Results') })),
    hits.length
      ? el('div', { class: 'results' }, hits.map((e) => el('button', {
        class: 'result', type: 'button',
        onclick: () => {
          found = { card: e.card, label: e.label };
          go(e.page);
        },
      }, el('span', { class: 'result__where', text: e.where }), el('span', { text: e.label }), e.help && el('span', { class: 'result__help', text: e.help }))))
      : el('p', { class: 'results__empty', text: T('Nothing here matches that. Try another word.') }),
  );
  main.scrollTop = 0;
}

function drawChrome() {
  const search = document.getElementById('search');
  search.placeholder = T('Search settings…');
  search.setAttribute('aria-label', T('Search settings…'));
  const box = document.getElementById('searchBox');
  box.querySelector('.icon')?.remove();
  box.prepend(icon('search'));
  document.getElementById('tourStart').replaceChildren(icon('tour'), el('span', { text: T('Tour with Capri') }));
}

// typing somewhere: don't redraw under the cursor
const typing = () => ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) && document.activeElement.type !== 'checkbox' && document.activeElement.type !== 'range';

async function loadLines() {
  const table = await api.langTable();
  lines = table?.lines || {};
  document.documentElement.lang = table?.code || 'en';
  searchIndex = null;
  drawChrome();
  render();
}

async function boot() {
  state = await api.get();
  const table = await api.langTable();
  lines = table?.lines || {};
  document.documentElement.lang = table?.code || 'en';
  drawChrome();
  render();
  api.onConfig(async () => {
    if (typing()) return;
    state = await api.get();
    renderSync();
  });
  api.onRefresh(async () => {
    state = await api.get();
    if (!typing() && !tour?.open && ['timers', 'behavior'].includes(page)) render();
    else renderSync();
  });
  api.onTab((tab) => { page = tab; render(); });
  api.onEarsProgress((p) => earsProgress?.(p));
  api.onOwnVoiceProgress((p) => ownVoiceProgress?.(p));
  const main = document.getElementById('main');
  const search = document.getElementById('search');
  search.addEventListener('input', () => renderSearch(search.value));
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && (e.key === 'PageUp' || e.key === 'PageDown')) step(e.key === 'PageUp' ? -1 : 1);
    else if (e.ctrlKey && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      search.focus();
    }
  });
  window.addEventListener('hashchange', () => {
    const id = location.hash.slice(1);
    if (id && id !== page) {
      page = id;
      render();
    }
  });
  tour = new Tour({
    T, go, main, icon,
    send: (phase, extra = {}) => api.action('tour', { phase, ...extra }),
    onDone: () => { if (!cfg().settingsToured) save({ settingsToured: true }); },
  });
  document.getElementById('tourStart').addEventListener('click', () => {
    tour.stop();
    tour.start();
  });
  if (!cfg().settingsToured) tour.invite();
}

boot();

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

const DEFAULTS = {
  scale: 0.6,        // sprite scale, 0.6 ≈ 250px tall
  muted: false,
  volume: 0.7,
  lang: 'auto',      // 'auto' follows the system language, or 'fr' / 'en'
  displayId: null,   // null = primary display
  wander: true,      // random teleports when idle
  possess: true,     // now and then she dives into the window she sits on and takes it over
  visible: true,
  welcomed: false,   // she has introduced herself (her welcome panel)
  assistant: 'auto', // the coding assistant she watches: 'claude' or 'codex' ('auto': whichever has her hooks)
  linked: false,     // a Claude Code event has reached her at least once
  chatModel: null,   // the model she talks with (null: the provider's first one)
  provider: 'ollama', // who answers her chat: a key of llm.js PROVIDERS
  apiKeys: {},       // { openai: 'sk-...' }, else the provider's env variable
  customUrl: '',     // the 'custom' provider: any OpenAI-compatible base URL (http://host:port/v1)
  claudeCwd: null,   // the folder Claude Code works in (null: your home folder)
  userName: '',      // what she calls you
  persona: '',       // how you want her, in your words (her chat)
  myLines: [],       // lines of yours she says now and then, with hers
  memories: [],      // things you asked her to remember (her chat)
  claudeMode: 'default', // Claude Code's permission mode in her chat: 'default' only reads, 'acceptEdits' edits without asking
  claude: true,      // she watches Claude Code (off: she just keeps you company, no word of it)
  rest: 'corner',    // where she rests when nothing's going on: 'corner', or 'taskbar' (sitting on it)
  motion: 'auto',    // her animations: 'auto' (like Windows' animation effects), 'full' or 'reduced'
  motionAsked: false, // she asked once, Windows' animations being off, whether to move anyway
  render: 'auto',   // how her window is drawn: 'auto', 'gl' (OpenGL) or 'software' (no graphics card), for PCs that show it black

  // --- who she is (settings › Capri) ---
  capriPersona: '',  // her whole personality for the model, in your words ('' : her default one, chat.js DEFAULT_PERSONA)
  traits: { sass: 70, mischief: 60, jealousy: 60, affection: 50, chattiness: 40 }, // 0..100, how much of each
  replyLength: 'short', // 'tiny' (one sentence), 'short' (1 to 3), 'long' (up to 5)
  replyLanguage: 'mix', // 'mix' (Indonesian-English), 'app' (her menu's language), 'id', 'en'
  bannedPhrases: ['good boy'], // words she never says (cut out of her answers)
  emotionTags: true, // [happy] [jealous] [bored] [glitch] [annoyed]: her face and moves follow them
  artFaces: true,    // the 2.4 art in her portrait and cut-ins (talking mouth, happy face, glitched eyes)
  talkingPortrait: true, // her mouth moves in her portrait while she talks
  cutIns: true,

  // --- who you are (settings › Owner) ---
  owner: { nickname: '', pronouns: '', birthday: '', about: '', likes: '', dislikes: '', relationship: 'host', relationshipCustom: '' },
  memoryOn: true,     // she keeps what you tell her to remember, and uses it in chat
  cloudMemory: false, // ...also with a cloud model

  // --- her brain (settings › AI) ---
  temperature: 0.85,
  maxTokens: 300,
  contextMessages: 20, // messages she has in mind when answering
  lookOn: true,        // she may look at your screen when you ask (one screenshot, kept in memory only)
  cloudLook: false,    // ...and send it to a cloud model

  // --- her ears and voice (settings › Voice) ---
  listen: 'push',      // 'off', 'push' (click her mic or the hotkey), 'always' (hands-free, she listens all the time)
  wakeWord: true,      // in 'always': only what starts with her name ("Capri, ...") reaches her
  wakeWords: 'capri, kapri, cappy',
  followUpSeconds: 8,  // after she answers, a moment where her name isn't needed
  micDevice: '',       // deviceId ('' : Windows default)
  micSensitivity: 55,  // 0..100: how soft a voice still counts as speech
  silenceMs: 900,      // the quiet that ends what you say
  maxUtterance: 15,    // seconds, at most
  sttEngine: 'auto',   // 'auto', 'whisper' (local), 'groq', 'openai', 'windows'
  sttLanguage: 'auto', // 'auto' (her language), or a code: 'id', 'en'...
  micButton: true,     // the little mic next to her
  tts: false,          // she reads her answers out loud
  ttsVoice: '',        // a voice's name ('' : the first one in her reply language)
  ttsRate: 1.05,
  ttsPitch: 1.25,
  ttsVolume: 0.9,
  muteWhileSpeaking: true, // her ears close while she talks, so she doesn't hear herself
  ttsWhat: 'all',      // what she reads out loud: 'all' (answers, remarks, alarms) or 'answers'
  ttsEngine: 'windows', // her voice: 'windows', 'openai', 'elevenlabs', 'custom' (your TTS server) or 'piper' (main/mouth.js)
  ttsOpenaiModel: 'gpt-4o-mini-tts',
  ttsOpenaiVoice: 'coral',
  ttsStyle: '',        // how she sounds, told to OpenAI's voice ('' : hers, mouth.js STYLE)
  ttsElevenVoice: '',  // an ElevenLabs voice ID: one of yours, a cloned Capri voice too
  ttsElevenModel: 'eleven_multilingual_v2',
  ttsStability: 0.45,  // ElevenLabs: lower is more emotional
  ttsStyleAmount: 0.45,
  ttsUrl: 'http://127.0.0.1:8880/v1', // your own TTS server with OpenAI's /audio/speech (Kokoro-FastAPI's default)
  ttsCustomModel: 'kokoro',
  ttsCustomVoice: '',
  ttsCustomFormat: 'mp3',
  ttsCustomSpeed: 1,
  ttsPiperModel: '',   // a .onnx in her piper folder ('' : the first one)
  ttsPiperSpeed: 1,
  ttsEffect: 'construct', // her voice through: 'none', 'construct' (her many minds), 'glitch', 'radio'
  ttsMinds: 35,        // 0..100: how loud the other minds are under her voice
  ttsShift: 1.06,      // her voice sped up and raised a little (playback rate)
  ttsEmotion: true,    // her emotion of the moment changes how she says it
  ttsFallback: true,   // the engine fails: Windows' voice says it instead

  // --- what she does on her own (settings › Behavior) ---
  notices: true,       // she remarks on late nights, low battery, a busy CPU, a long time in one app
  jealous: true,       // ...and on another AI in front of you (ChatGPT, Gemini, Copilot…)
  dares: true,
  visionDares: false,  // a dare may look at your screen first (asks before turning on)
  music: 'comment',    // 'off', 'show' (what's playing), 'comment' (and a word about it)
  pats: true,          // hover over her for a head pat
  hideInFullscreen: true, // she steps aside while a game or a full screen video is in front (2.4)
  voiceClips: true,    // her recorded lines from her voice folder (pat.wav, wake.wav…), when there are any
  mischief: false,     // screen glitches now and then (Ctrl+Alt+C stops one)
  mischiefMinutes: 25, // about how often
  glitchStyles: [0, 1, 2, 3, 4, 5], // which of the six (bars, tear, corruption, hex rain, sync bar, chaser)
  hackNotes: true,     // "you've been hacked" notes with a glitch
  syncShown: true,

  // --- errands (settings › Timers) ---
  alarms: [],          // [{ due: ms, label }]
  focusMinutes: 25,
  breakMinutes: 5,
  chime: true,

  // --- sync: how far she has got into your life (0..1000 points, 10 per percent) ---
  sync: { points: 0, shown: 0, day: '', minutes: 0, chats: 0, pats: 0, agrees: 0, dares: 0 },

  // --- advanced ---
  hotkeys: { toggle: 'Control+Alt+C', chat: 'Control+Alt+T', talk: 'Control+Alt+V', look: 'Control+Alt+L', settings: 'Control+Alt+S' },
  debugLog: false,
  spotifyVerb: '',     // the wording of Spotify's Play buttons, learned (2.4)
  // --- she improves herself (growth.js) and keeps your history (history.js) ---
  // --- her local brain: a small Ollama model for her quick jobs and when her main brain fails ---
  localBrain: '',      // an Ollama model name ('' : none; the first time, the smallest found)
  localBrainChecked: false,
  localBackground: true, // her quick jobs (a word on your song, dares) on it
  localFallback: true, // it answers when her main brain can't
  growthOn: true,      // she looks back at your chats now and then and rewrites her lessons
  growthEvery: 12,     // ...every this many messages of yours
  lessons: [],         // her own notes on how to be with you
  growth: { version: 0, since: 0, last: 0 },
  historyOn: true,     // every chat turn kept on this PC, a file a day
  historyDays: 0,      // days kept (0: forever)
  gameCheat: true,     // her games: she cheats now and then (with her mischief up)
  gameStats: {},       // { rpsYou, rpsHer, rpsTie, guessWins, guessBest }
  seenMerge: false,    // she said what came over from 2.4, once
};

// objects whose missing keys come from the defaults (a file from an older version keeps its own values)
const NESTED = ['traits', 'owner', 'sync', 'hotkeys', 'growth'];

let cache = null;

function file() {
  return path.join(app.getPath('userData'), 'config.json');
}

function load(fresh = false) {
  if (cache && !fresh) return cache;
  try {
    cache = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(file(), 'utf8')) };
  } catch {
    cache = { ...DEFAULTS };
  }
  for (const key of NESTED) cache[key] = { ...DEFAULTS[key], ...(cache[key] || {}) };
  return cache;
}

// Back to how she came (her keys and her memory of you stay, unless asked).
function reset({ keepKeys = true } = {}) {
  const keep = keepKeys ? { apiKeys: load().apiKeys, customUrl: load().customUrl } : {};
  cache = null;
  try {
    fs.writeFileSync(file(), JSON.stringify({ ...keep, welcomed: true }, null, 2));
  } catch (err) {
    console.error('[capri] could not reset config:', err.message);
  }
  return load(true);
}

function save(patch) {
  cache = { ...load(), ...patch };
  try {
    fs.mkdirSync(path.dirname(file()), { recursive: true });
    fs.writeFileSync(file(), JSON.stringify(cache, null, 2));
  } catch (err) {
    console.error('[capri] could not save config:', err.message);
  }
  return cache;
}

module.exports = { load, save, reset, file, DEFAULTS };

'use strict';

const path = require('node:path');
const { app } = require('electron');
const { writeAtomic, readJson } = require('./store');

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
  recallChats: true,  // ...and recalls what you said about it in past chats (her history, on this PC: recall.js)
  cloudMemory: false, // ...also with a cloud model

  // --- her brain (settings › AI) ---
  temperature: 0.85,
  maxTokens: 300,
  contextMessages: 20, // messages she has in mind when answering
  intentRouter: true,  // a command in words her rules don't know: her model says which command it is (one short call)
  coder: 'auto',       // who writes code you ask for: 'auto' (Claude Code if installed, else her), 'claude', 'self'
  codeFolder: '',      // where it goes ('': Documents/Capri Code)
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
  sttWords: '',        // words she should hear right, spelled as written (names, apps, terms of yours): Whisper's prompt
  micButton: true,     // the little mic next to her
  fixDictation: true,  // what you say to be typed: its speech-to-text slips fixed by her model first
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
  lyrics: true,        // the words of the song under her as they're sung (LRCLIB, main/lyrics.js)
  musicMood: true,     // she listens along: grooves, dances to songs she likes, dozes off to boring ones
  tastes: {},
  weatherCity: '',     // where you are, for the weather and her brief of your day (Open-Meteo): '' asks
  dailyBrief: true,    // the first time you're at your PC in the morning, her brief of your day
  briefDay: '',        // the day she gave it          // what she thinks of the songs she's heard: { 'title|artist': 'love' | 'like' | 'meh' }

  plugins: [],         // plugins of yours, made without code: [{ id, name, on, when, do: [steps], cooldown }] (plugins.js)
  skills: [],          // commands of yours: [{ name: 'work mode', run: 'open vscode and play music' }] (settings › Behavior)
  actionLog: true,     // what she did on your PC, kept on this PC to look at (settings › Access › What she did)

  // --- what she may do on your PC (settings › Access; what she may see and hear has its own switches) ---
  access: {
    apps: true,    // open apps, games and Store apps
    files: true,   // open folders, find files and folders
    close: true,   // close an app (always behind a button)
    web: true,     // open sites and searches in your browser
    search: true,  // look questions about the world up online first (Wikipedia, Bing): only the question goes out
    media: true,   // the media keys: pause, next, volume
    spotify: true, // search Spotify and press Play
    code: true,    // write code into her Code folder, or open Claude Code for it
    type: true,    // type for you in another app (Notepad, VS Code, a chat), and press Enter or Ctrl+S when you ask
  },
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
  autoUpdate: 'notify', // new versions from her GitHub Releases: 'notify' (she asks), 'auto' (downloaded, installed when you close her), 'off'
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
const NESTED = ['traits', 'owner', 'sync', 'hotkeys', 'growth', 'access'];

let cache = null;

function file() {
  return path.join(app.getPath('userData'), 'config.json');
}

function load(fresh = false) {
  if (cache && !fresh) return cache;
  const kept = readJson(file());
  cache = { ...DEFAULTS, ...(kept && typeof kept === 'object' && !Array.isArray(kept) ? kept : {}) };
  for (const key of NESTED) cache[key] = { ...DEFAULTS[key], ...(cache[key] || {}) };
  return cache;
}

// Back to how she came (her keys and her memory of you stay, unless asked).
function reset({ keepKeys = true } = {}) {
  const keep = keepKeys ? { apiKeys: load().apiKeys, customUrl: load().customUrl } : {};
  cache = null;
  try {
    writeAtomic(file(), JSON.stringify({ ...keep, welcomed: true }, null, 2));
  } catch (err) {
    console.error('[capri] could not reset config:', err.message);
  }
  return load(true);
}

function save(patch) {
  cache = { ...load(), ...patch };
  try {
    writeAtomic(file(), JSON.stringify(cache, null, 2));
  } catch (err) {
    console.error('[capri] could not save config:', err.message);
  }
  return cache;
}

// May she do that on your PC (settings › Access)? 'apps', 'files', 'close', 'web', 'search', 'media', 'spotify', 'code', 'type'
const allowed = (what) => load().access?.[what] !== false;

module.exports = { load, save, reset, file, allowed, DEFAULTS };

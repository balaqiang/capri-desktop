// Talking to her: you type in her panel, and a model (setup.js picks which) answers as her, in
// writing. The replies are AI-generated, and the panel says so on every chat.
// She can do a few things on your PC when you ask (Windows): open an app or a game, play music or
// control what's playing, open a website, close an app. She spots what you want in what you wrote,
// or the model asks for it with a tag in its answer. Music right away; an app you named yourself
// right away; anything only the model asked for, a website, and closing an app behind a button.

import { pick, fmt } from './util.js';
import { ASSISTANT_NAMES } from './lines.js';
import { T } from './i18n.js';

import { DEFAULT_PERSONA } from './persona.js';
import { STORY, STORY_SMALL, loreFor } from './lore.js';
import { Motion } from './motion.js';
import { LYRICS_TAG, LYRIC_DUMP, aboutLyrics, NO_DUMP_LINE, FAKE_DONE, worldQuestion, webNote, withSums, sumsIn } from './rules.js';

export { DEFAULT_PERSONA };

// her emotion tags: shown as her face and moves (life.js), never as text
const EMOTION_TAG = /\[(happy|jealous|bored|glitch|annoyed)\]/i;
// a move of her body her AI can ask for anywhere in its answer (capri.js MOVES), never shown
const MOVE_TAG = /\[\[\s*move\s*:\s*([a-z]+)\s*\]\]/i;
// where her AI sends her when you asked in words the app didn't catch ([[go: cursor]]), and where it may
const GO_TAG = /\[\[\s*go\s*:\s*([a-z]+)\s*\]\]/i;
const GO_PLACES = ['cursor', 'left', 'right', 'center', 'taskbar', 'top', 'ride', 'unride', 'home', 'hide', 'sleep', 'wander', 'stay'];
const MOVE_NAMES = 'wave, nod, shrug, think, bow, dance, laugh, shy, spin, hop, curious, look, turn, flinch';
// the move each emotion of hers comes with (life.js): moving too, so spaced and learned like her AI's moves
// her chat's header: CAPRI / her mood, from her emotion of the moment, or what she's doing
const MOOD = {
  idle: 'NIGHT CITY', thinking: 'THINKING…', looking: 'WATCHING', music: 'VIBING', searching: 'SEARCHING…',
  happy: 'HAPPY', jealous: 'JEALOUS', bored: 'BORED', glitch: 'GLITCHING', annoyed: 'ANGRY',
};
const EMOTION_MOVES = { happy: 'hop', jealous: 'turn', bored: 'look', glitch: 'split', annoyed: 'flinch' };
const ANY_TAG = /\[(?:happy|jealous|bored|glitch|annoyed|sad|angry|smug|excited|curious|playful|mischievous|proud|shy|tired|surprised|neutral|laughs?|teasing|sassy|smirk|grin|pout)\]\s*/gi;
// the other AIs she gets jealous of, named in your message
const OTHER_AI = /\b(chat ?gpt|gpt-?\d|openai|gemini|bard|copilot|perplexity|deepseek|grok|character\.?ai|siri|alexa|cortana|meta ai|llama|mistral|qwen)\b/i;
// what her settings' sliders mean to her model
const TRAITS = {
  sass: ['You are polite for once: little sass.', 'Some sass.', 'Lots of sass and opinions.', 'Maximum sass: snarky, opinionated, never servile.'],
  mischief: ['You are barely mischievous.', 'A little mischievous.', 'Mischievous and teasing.', 'Very mischievous: pranks, teasing, little traps.'],
  jealousy: ['You are never jealous.', 'Only a little jealous.', 'Jealous and possessive about other AIs.', 'Openly, dramatically jealous of any other AI or anyone taking their attention.'],
  affection: ['You are cold and distant with them.', 'Warm only now and then.', 'Fond of them in your own way.', 'Clingy and affectionate, in your unsettling way.'],
  chattiness: ['Say as little as you can.', 'Be brief.', 'Be chatty.', 'Be very chatty, but stay within the length rule.'],
};
const LENGTHS = {
  tiny: 'Keep every reply to ONE short sentence (two when they ask about you, your story or Cyberpunk).',
  short: 'Keep replies short: one to three sentences.',
  long: 'Replies can be up to five sentences when it helps, never more.',
};
const RELATIONS = {
  host: 'the user is her host: she lives in their PC and needs them',
  partner: 'the user is her partner in crime',
  friend: 'the user is her friend (whether they like it or not)',
  rival: 'the user is her favorite rival',
  owner: "the user is her owner, and she acts like it's the other way around",
};
const FACE_OF = { happy: 'happy', jealous: 'jealous', bored: 'bored', glitch: 'glitch', annoyed: 'annoyed' };

const REMEMBER = 20; // messages she has in mind when answering (settings › AI)
const KEEP = 60;     // messages she remembers across restarts (memory.json)
// her language, where small models need it: how she says "we" (else it's in English), and the last line
// of her prompt, in that language (they drift into the English of everything above it)
const IN_LANGUAGE = {
  fr: { we: '"on" or "nous" in French', last: 'Écris tout en français, sauf si l’utilisateur t’écrit dans une autre langue : alors dans la sienne. Seuls les mots d’argot de Night City restent en anglais, jamais une phrase entière.' },
  en: { we: '', last: 'Write everything in English, unless the user writes to you in another language: then in theirs.' },
  es: { we: '"nosotros" in Spanish', last: 'Escribe todo en español, salvo si el usuario te escribe en otro idioma: entonces en el suyo. Solo las palabras de jerga de Night City se quedan en inglés, nunca una frase entera.' },
  pt: { we: '"a gente" or "nós" in Portuguese', last: 'Escreva tudo em português do Brasil, a não ser que o usuário te escreva em outra língua: aí, na dele. Só as gírias de Night City ficam em inglês, nunca uma frase inteira.' },
  ru: { we: '"мы" in Russian', last: 'Пиши всё по-русски, если только пользователь не пишет тебе на другом языке: тогда на его языке. По-английски остаются только словечки Найт-Сити, никогда не целые фразы.' },
};
const STAY_MS = 10 * 60 * 1000; // no wandering off mid-conversation
const LOADING_AFTER_MS = 5000;
const CLOSE_TAG = /\[\[\s*close\s*:?\s*([^\]]*)\]\]/i; // [[close: AM Music]] at the end of her answer
// "close", "shut down", "ferme", "quitte", "cierra", "fecha", "закрой"... in any of her languages
const CLOSE_ASK = /\b(close|shut|quit|kill|exit)|ferm|quitt|coupe|arr[êe]t|cierr|cerra|fech|закр|выключ/i;
// her other tags: [[open: Spotify]], [[music: Bad Bunny]], [[media: next]], [[site: youtube.com]]
const TAG = /\[\[\s*(open|music|media|site)\s*:\s*([^\]]*)\]\]/i;
// "open", "launch", "ouvre", "lance", "abre", "открой"... in any of her languages
const OPEN_ASK = /\b(open|launch|start|run)\b|ouvr|lance|démarre|abre|abrir|inicia|ejecuta|executa|открой|запусти/i;
// what to do with the music playing, said plainly (only when it's about music, or said in a few words)
const MEDIA_ASK = [
  ['pause', /\b(pause|pausa|pausar)\b|stop (the )?music|arrête la musique|пауз/i],
  ['next', /\b(next|skip|suivante?|siguiente|próxima|proxima)\b|passe (à )?la suivante|salta|pula|следующ/i],
  ['previous', /\b(previous|précédente?|anterior)\b|предыдущ/i],
  ['play', /\b(resume|reprends|reanuda|retoma)\b|relance la musique|remets la musique|продолж/i],
  ['volup', /\b(louder|plus fort)\b|monte le son|turn (it )?up|sube el volumen|aumenta o volume|громче/i],
  ['voldown', /\b(quieter|moins fort)\b|baisse le son|turn (it )?down|baja el volumen|abaixa o volume|тише/i],
  ['mute', /\bmute\b|coupe le son|silencia|sem som|выключи звук/i],
];
const MUSIC_WORD = /musi|chanson|song|track|titre|morceau|spotify|canci|faixa|песн|музык|трек/i;
// "put X on Spotify", "mets X sur Spotify", "pon X en Spotify", "coloca X no Spotify", "включи X в Spotify"
const SPOTIFY_ASK = /(?:play|put on|put|mets|joue|lance|écoute|pon|toca|reproduce|coloca|toque|включи|поставь)\s+(?:moi\s+|me\s+)?(.+?)\s+(?:on|sur|en|no|na|в)\s+spotify/i;
const MEDIA_ACTIONS = new Set(MEDIA_ASK.map(([action]) => action));
// what her tag needs to find in your message before it does anything: a small model tags answers about
// anything ("[[music: synthwave]]" under a film tip), and music and the media keys act right away
const LISTEN = /[ée]cout|listen|escuch|\bouv(ir|e)\b|слуша|playlist|album|\b(play|joue|mets|pon|toca|coloca)\b|включи|поставь/i;
const SOUND = /\b(sound|volume|volumen)\b|\b(le|du|au) son\b|\bo som\b|звук|громк/i; // not "son": "his" in French
const PLAY = /\bjou(er|e)\b|\bplay\b|jugar|juega|jogar|joga|играть|поигра/i;
const SITE = /\b(site|web|page|lien|link|url|enlace|p[aá]gina)|сайт|ссылк|\.(com|fr|org|net|io|gg|tv|be|ch|ca|es|br|pt|ru)\b/i;
// "appelle-moi Max", "call me Max", "llámame Max", "me chama de Max", "зови меня Макс"
const NAME_ASK = /(?:appelle[- ]moi|call me|my name is|je m['’]appelle|ll[aá]mame|me llamo|me cham[ae] de|meu nome [eé]|зови меня|меня зовут)\s+([\p{L}\p{N}'’-]{1,24})/iu;
// "souviens-toi que…", "remember that…", "recuerda que…", "lembra que…", "запомни, что…" (said first thing)
const MEMO_ASK = /^\s*(?:capri,?\s+|stp,?\s+|please,?\s+)?(?:souviens[- ]toi(?: que| de)?|n['’]oublie pas(?: que| de)?|remember(?: that)?|recuerda(?: que)?|lembr[ae](?:-se)?(?: que| de)?|запомни,?(?: что)?)\s+(.{3,200})/iu;
const MEMORIES_MAX = 30;
// sites asked for by name ("open youtube") when no app on the PC goes by it: the address is hers, not
// the model's, so it opens right away like an app you named
const SITES = {
  youtube: 'https://www.youtube.com', google: 'https://www.google.com', gmail: 'https://mail.google.com',
  twitch: 'https://www.twitch.tv', netflix: 'https://www.netflix.com', reddit: 'https://www.reddit.com',
  twitter: 'https://x.com', instagram: 'https://www.instagram.com', tiktok: 'https://www.tiktok.com',
  facebook: 'https://www.facebook.com', github: 'https://github.com', chatgpt: 'https://chatgpt.com',
  wikipedia: 'https://www.wikipedia.org', linkedin: 'https://www.linkedin.com', pinterest: 'https://www.pinterest.com',
  crunchyroll: 'https://www.crunchyroll.com', outlook: 'https://outlook.live.com', whatsapp: 'https://web.whatsapp.com',
  discord: 'https://discord.com/app', soundcloud: 'https://soundcloud.com', deezer: 'https://www.deezer.com',
};
// a browser named with a site ("open youtube on chrome"): the site, in the browser you use
const BROWSER = /chrome|edge|firefox|opera|brave|vivaldi|duckduckgo|browser/i;
// local models this small mostly talk nonsense ("llama3.2:1b", "qwen2.5:0.5b"…)
const TINY = /[:-](0\.5b|1b|1\.5b|135m|270m|360m)\b/i;
// small enough that her full prompt confuses it: she gets a short one (persona())
const SMALL = /[:-](0\.5b|1b|1\.5b|2b|3b|135m|270m|360m)\b|gemma3:1b|qwen2\.5:3b|llama3\.2(?::latest)?$/i;
// a generic refusal of something harmless ("I can't process that", "maaf saya tidak bisa"): asked again
const REFUSAL = /\b(?:i (?:can(?:no|')t|am (?:not able|unable)) (?:process|help with|answer|assist with|do) (?:that|this)|as an ai\b|i'?m (?:just )?an ai\b|i'?m sorry,? but i can(?:no|')t|(?:saya|aku) (?:tidak|nggak|gak|ga) (?:bisa|dapat) (?:memproses|menjawab|membantu)|tidak bisa memproses|sebagai (?:ai|model bahasa))/i;

export class Chat {
  constructor({ capri, panel, voice, host, brain }) {
    this.capri = capri;
    this.panel = panel;
    this.voice = voice;
    this.host = host;
    this.brain = brain;
    this.history = []; // your chats with her, [{ role, content }], kept by main.js across restarts
    this.warm = false; // a model already answered this run (Ollama's first answer waits for it to load)
    this.open = false;
    this.turn = 0;     // id of the answer coming in, if any
    this.answer = '';
    this.apps = [];    // the apps open on this PC, as last listed: [{ name, label }]
    this.appsReady = Promise.resolve();
    this.cfg = {};       // her settings (app.js)
    this.onEmotion = null; // (emotion) => void: her face and a move for [happy], [jealous]… (life.js)
    this.onAct = null;     // (move) => void: a move of her body her AI asked for, [[move: wave]] (capri.js)
    this.acted = false;    // this answer's move already played (as soon as its tag streamed in)
    this.motion = new Motion({ host }); // when and how she moves, learned from you (motion.js)
    this.onAnswered = null; // (text) => void: an answer of hers is in (her voice reads it, her ears wait for more)
    this.onSetup = null; // (status) => void: she can't answer yet (app.js hands it to setup.js)
    this.onBetterModel = null; // () => void: a bigger model than the tiny one she's on (setup.js)
    host.onChatDelta(({ id, text }) => this.onDelta(id, text));
  }

  get t() {
    return this.brain.t.chat;
  }

  // the words and phrases you never want to hear from her (settings › Capri): cut out of what she says
  unban(text) {
    let out = String(text || '');
    for (const phrase of this.cfg.bannedPhrases || []) {
      const p = String(phrase).trim();
      if (p.length < 2) continue;
      const re = new RegExp(`[,;:]?\\s*\\b${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      out = out.replace(re, '');
    }
    return out.replace(/\s{2,}/g, ' ').replace(/\s+([,.!?])/g, '$1').replace(/^[\s,.!?;:]+/, '').trim();
  }

  configure(cfg) {
    this.cfg = cfg;
    this.motion.load(cfg.motionLearn);
    this.host.setPersona(this.persona());
  }

  // focus: false when you spoke to her (the keyboard stays where it is). True once her chat is open.
  async start({ focus = true } = {}) {
    const { capri, host, t } = this;
    if (this.open) {
      if (focus) this.panel.chatInput.focus();
      return true;
    }
    if (capri.stowed) {
      host.setConfig({ visible: true });
      await capri.unstow();
    }
    capri.wake();
    const status = await host.chatStatus();
    if (!status.ok && this.onSetup) {
      this.onSetup(status); // nothing to talk with yet: she sets it up with you, with buttons (setup.js)
      return false;
    }
    if (!status.ok) {
      // no Ollama, or nothing to talk with yet: what to do about it
      const offline = status.error === 'offline';
      const other = !offline && status.error !== 'nomodel'; // another provider, saying why
      capri.perform('curious', capri.towardCenter());
      this.panel.say({
        kind: 'info',
        face: 'aside',
        guide: true,
        line: other ? t.failed : offline ? t.offline : t.noModel,
        quote: other ? status.error : offline ? t.offlineHow : t.noModelHow,
        actions: offline
          ? [{ id: 'get', label: t.getOllama, primary: true }, { id: 'ok', label: t.ok }]
          : [{ id: 'ok', label: t.ok, primary: true }],
        onAction: (id) => {
          if (id === 'get') host.openOllama();
          this.panel.hide();
        },
        hold: null,
      });
      return false;
    }
    this.history = await host.chatMemory().catch(() => this.history); // "forget" in her menu may have emptied it
    this.cold = status.warmup && !this.warm;
    this.agent = Boolean(status.agent); // Claude Code answers, as her, and really works in your project
    this.listApps();
    const shortModel = status.model.replace(/:latest$/, '').replace(/^models\//, ''); // Ollama's tag, Gemini's prefix
    this.model = status.model;
    const tiny = status.provider === 'ollama' && TINY.test(status.model) && this.onBetterModel;
    if (focus) host.focusOverlay(true); // the keyboard, for typing to her
    const shown = this.panel.say({
      kind: 'chat',
      face: 'look',
      badge: '', // no "AI · LIVE": her header says her mood instead (setMood)
      tag: MOOD.idle,
      line: tiny ? fmt(t.tiny, { model: shortModel }) : pick(this.history.length ? t.again : t.hello),
      actions: tiny ? [{ id: 'better', label: t.better, primary: true }] : [],
      onAction: () => {
        this.panel.hide(); // her chat holds off her guide's panels: it goes first
        this.onBetterModel?.();
      },
      chat: {
        placeholder: t.placeholder,
        send: t.send,
        close: t.close,
      },
      onSend: (text) => this.send(text),
      onLeave: () => this.close(),
      hold: null,
    });
    if (!shown) {
      host.focusOverlay(false); // something more important is on (a permission prompt)
      return false;
    }
    this.open = true;
    this.host.quiet(STAY_MS); // no remarks of hers over your chat
    // opened again while she's still finishing the last message (closed halfway): you can type once she's done,
    // nothing you send meanwhile gets lost
    if (this.sending) this.panel.setChatBusy(true);
    if (focus) setTimeout(() => this.panel.chatInput.focus(), 150); // once the overlay has the keyboard
    capri.perform('hop');
    capri.nextMove = capri.nextGaze = performance.now() + STAY_MS;
    return true;
  }

  // What you said into the microphone (ears.js): an errand she can do right away, else her chat.
  async hear(text, { onlyName = false } = {}) {
    const { capri, panel } = this;
    if (capri.stowed) {
      this.host.setConfig({ visible: true });
      await capri.unstow();
    }
    capri.wake();
    if (onlyName) {
      // just her name: she's listening
      if (!this.open) panel.say({ kind: 'info', face: 'eyes', badge: 'MIC', line: T("Hm? I'm listening."), hold: 4000 });
      capri.perform('curious', capri.towardCenter());
      return;
    }
    // (said, not typed: what she types for you from it gets its speech-to-text slips fixed first, main/life.js)
    if (this.open) {
      this.send(text, { voice: true });
      return;
    }
    const done = await this.errand(text, { panelOnly: true, voice: true });
    if (done) return;
    if (await this.start({ focus: false })) this.send(text, { skipErrand: true });
  }

  // "Look at my screen" (Ctrl+Alt+L, her menu, or asked in words): one screenshot to her model.
  // task 'homework': the questions on it answered, each one (homeworkPersona)
  async look(question = '', { task = '' } = {}) {
    if (!this.open && !(await this.start({ focus: false }))) return;
    this.send(question || T('What am I looking at?'), { look: true, skipErrand: true, task });
  }

  // An errand from your words (main/life.js): done, and her line about it, without a model.
  // In her chat it's a chat turn; otherwise (you spoke while it was closed) a panel of its own.
  async errand(text, { panelOnly = false, voice = false } = {}) {
    const fgBefore = this.capri.windows?.fg; // a window she opens comes up in front of it (onPoint)
    const res = await this.host.errand(text, { voice }).catch(() => null);
    if (!res?.handled) return false;
    if (res.look) {
      if (this.open) this.panel.setChatBusy(false);
      this.look(text, { task: res.lookTask || '' });
      return true;
    }
    if (res.zap) this.zap();
    if (res.move) this.onMove?.(res.move);
    if (res.point) this.onPoint?.(res.point, fgBefore);
    if (res.draft) {
      this.showDraft(res.draft, clean(res.reply || ''), text, { panelOnly });
      return true;
    }
    const line = clean(res.reply || '…');
    if (panelOnly || !this.open) {
      this.panel.say({ kind: 'info', face: FACE_OF[res.emotion] || 'happy', badge: res.evolved ? 'EVOLVE' : 'CAPRI', quote: text, line, hold: 7000 });
      this.host.historyAdd([{ role: 'user', text, via: 'voice' }, { role: 'assistant', text: line, emotion: res.emotion, via: 'voice' }]);
    } else {
      this.history.push({ role: 'user', content: text });
      this.remember({ role: 'assistant', content: line }, { emotion: res.emotion });
      this.panel.stream(line, { done: true });
      this.panel.setMood(/spotify|lagu|song|music|musik|play|putar|setel|dengerin/i.test(text) ? MOOD.music : MOOD[res.emotion] || MOOD.idle);
      this.panel.setChatBusy(false);
    }
    if (res.memory) this.brain.custom.memories = await this.host.getConfig().then((c) => c.memories || []).catch(() => this.brain.custom.memories);
    this.onEmotion?.(res.emotion);
    this.onAnswered?.(line, res.emotion);
    return true;
  }

  // A draft of hers (main/life.js 'draft'): shown whole, with Type it (where you asked, or where you were), Copy,
  // and Again. "Make it shorter" in her chat changes it.
  showDraft(draft, line, asked, { panelOnly = false } = {}) {
    const actions = [{ id: 'type', label: T('Type it'), primary: true }, { id: 'copy', label: T('Copy') }, { id: 'again', label: T('Again') }];
    const onAction = async (id) => {
      if (id === 'copy') {
        await this.host.copyText(draft.text).catch(() => {});
        this.panel.setActions([{ id: 'type', label: T('Type it'), primary: true }, { id: 'copied', label: T('Copied!') }], onAction);
        return;
      }
      if (id === 'copied') return;
      this.panel.setActions([]);
      if (id === 'again') {
        if (this.open) this.panel.setChatBusy(true);
        await this.errand(asked, { panelOnly: !this.open });
        return;
      }
      if (id === 'type') {
        if (this.open) this.close(); // the window you were in comes back in front, and she types there
        else this.panel.hide();
        const res = await this.host.typeDraft(draft).catch(() => null);
        const said = clean(res?.reply || T("Hm, that didn't work."));
        this.panel.say({ kind: 'info', face: FACE_OF[res?.emotion] || 'happy', badge: 'CAPRI', line: said, hold: 6000 });
        this.onEmotion?.(res?.emotion);
      }
    };
    const shown = `${line}\n\n${draft.text}`;
    if (panelOnly || !this.open) {
      this.panel.say({ kind: 'info', face: 'happy', badge: 'DRAFT', quote: asked, line, reply: draft.text, hold: null, actions, onAction });
      this.host.historyAdd([{ role: 'user', text: asked, via: 'voice' }, { role: 'assistant', text: shown, emotion: 'happy', via: 'voice' }]);
    } else {
      this.history.push({ role: 'user', content: asked });
      this.remember({ role: 'assistant', content: shown }, { emotion: 'happy' });
      this.panel.stream(line, { done: true });
      this.panel.setReply(draft.text);
      this.panel.setMood(MOOD.idle);
      this.panel.setChatBusy(false);
      this.panel.setActions(actions, onAction);
    }
    this.onEmotion?.('happy');
  }

  close() {
    if (!this.open) return;
    this.open = false;
    if (this.turn) this.host.chatStop(this.turn);
    this.turn = 0;
    this.host.focusOverlay(false);
    this.capri.nextMove = performance.now() + 30000;
    this.capri.nextGaze = performance.now() + 60000;
  }

  // One message at a time: while she's still on the last one (an errand, a web search, her answer), another is
  // ignored, so prompts never pile up on her model. (A look her errand asked for is part of the same message.)
  async send(text, options = {}) {
    if (this.turn || (this.sending && !options.look) || !this.open) return;
    this.sending = true;
    try {
      await this.sendNow(text, options);
    } finally {
      this.sending = false;
      if (this.open && !this.turn) this.panel.setChatBusy(false);
    }
  }

  async sendNow(text, { look = false, skipErrand = false, voice = false, task = '' } = {}) {
    const homework = look && task === 'homework';
    if (this.turn || !this.open) return;
    if (!look) this.motion.heard(text); // what you say about her last move, or about her moving
    this.panel.setActions([]); // a close button she offered before goes with a new message
    this.host.quiet(STAY_MS);
    this.host.addSync(2, 'chat');
    if (!look && !this.agent && !skipErrand) {
      this.panel.chatTurn({ quote: text, face: 'eyes' });
      this.panel.setMood(MOOD.thinking);
      this.panel.setChatBusy(true);
      if (await this.errand(text, { voice })) return;
    }
    // another AI named: she has feelings about that (her persona says how)
    if (OTHER_AI.test(text)) this.onEmotion?.('jealous');
    const id = Date.now();
    this.turn = id;
    this.answer = '';
    this.lyricQuestion = text; // (what her answer is to: asked about a song's lyrics, she never writes them out)
    this.acted = false;
    this.history.push({ role: 'user', content: text });
    this.panel.setChatBusy(true);
    this.panel.chatTurn({ quote: text, face: look ? 'eyes' : 'aside' });
    this.panel.setMood(look ? MOOD.looking : MOOD.thinking);
    this.capri.pulse();
    // what you asked for plainly happens right away (the music, the volume, an app you named): her
    // line about it comes under her answer (Claude Code, answering her chat, does things its own way)
    const asked = this.agent ? null : this.asked(text);
    const early = asked && asked.kind !== 'close' ? this.doNow(asked) : null;
    await Promise.race([this.appsReady, new Promise((r) => setTimeout(r, 1500))]);
    const persona = this.persona();
    this.host.setPersona(persona);
    // the people and things of Cyberpunk you bring up (this message or the one before: "why?" follows up)
    const said = this.history.filter((m) => m.role === 'user').slice(-2).map((m) => m.content).join('\n');
    const lore = look ? '' : loreFor(said, { max: SMALL.test(this.model || '') ? 2 : 4 });
    // a question about the world ("siapa presiden indonesia"): looked up on the web first, a second or so, so she
    // answers from today's web and not from what her model remembers (main/web.js)
    const asking = !look && !lore && this.cfg.access?.search !== false && worldQuestion(text);
    if (asking) this.panel.setMood(MOOD.searching);
    // looking at your screen, what's playing and the like would only distract her from the picture
    const [context, found] = await Promise.all([
      look ? '' : this.host.lifeContext(text).catch(() => ''),
      asking ? Promise.race([this.host.webLookup(text).catch(() => null), new Promise((r) => setTimeout(() => r(null), 5500))]) : null,
    ]);
    if (asking) this.panel.setMood(MOOD.thinking);
    if (asking && this.cfg.debugLog) console.log('[web]', found ? `${found.results.length} results for "${found.query}"` : 'no answer in time');
    // what changes from one message to the next (the moment, what's playing, the apps open, lore, the web) goes
    // last, just before your message: everything before it is the same as last time, so a local model (Ollama)
    // reuses what it already read instead of reading her whole prompt and your chat again
    const now = [lore, context, this.appsNow(), webNote(text, found)].filter(Boolean).join('\n\n');
    let recent = this.history.slice(-(Number(this.cfg.contextMessages) || REMEMBER));
    // the same question asked before and looked up again: her old answers to it go (she copies them, stale or not)
    if (found?.results?.length) {
      const same = (m) => m?.role === 'user' && m.content.trim().toLowerCase() === text.trim().toLowerCase();
      recent = recent.filter((m, i, all) => i === all.length - 1 || !(same(m) || (m.role === 'assistant' && same(all[i - 1]))));
    }
    const messages = [{ role: 'system', content: persona }, ...recent.slice(0, -1), ...(now ? [{ role: 'system', content: now }] : []), ...recent.slice(-1)];
    if (look) {
      // one look at the screen, for this answer only: it's never kept, not even in her memory of the chat
      const shot = await this.host.snapshot().catch(() => ({ ok: false, error: 'blind' }));
      if (!shot.ok) {
        this.turn = 0;
        this.history.pop();
        const why = {
          off: "You've told me not to look! Settings, AI.",
          cloud: 'Looking stays on your computer. Run a local model, or allow screenshots for the cloud in Settings, AI.',
          blindModel: "I can't look through that one. Pick another AI in Settings.",
          blind: "I can't see the screen right now!",
        };
        this.panel.stream(T(why[shot.error] || why.blind), { done: true });
        this.panel.setFace('annoyed');
        this.panel.setChatBusy(false);
        return;
      }
      this.onEmotion?.('glitch');
      // just her, the picture and the question: a small vision model given her whole prompt and the chat
      // so far answers from those instead of the picture (and copies its own earlier answers)
      const question = text.replace(/"/g, "'");
      const app = shot.app && shot.title && !shot.title.includes(shot.app) ? `${shot.app}: "${shot.title}"` : shot.title || shot.app;
      const where = shot.window ? `the window in front of the user${app ? ` (${app})` : ''}` : "the user's whole screen";
      const read = shot.text ? `The text on it, read exactly by OCR:\n"""\n${shot.text}\n"""` : 'No text could be read on it.';
      // homework: the sums on it worked out exactly first (rules.js), for her to use
      const sums = homework ? sumsIn(shot.text) : [];
      const exact = sums.length ? `\nA calculator worked out the sums on it exactly (use these results, they are right):\n${sums.map((s) => `- ${s.expr} = ${s.value}`).join('\n')}` : '';
      if (homework) {
        // the questions' own language, said plainly (a model drifts into English otherwise)
        const indonesian = (String(shot.text || '').match(/\b(?:yang|dan|berapa|adalah|dengan|untuk|harga|luas|sebuah|jika|maka|hitunglah|tentukan|jawab(?:lah)?|soal|kelas|nama)\b/gi) || []).length >= 2;
        messages.splice(0, messages.length, { role: 'system', content: `${this.homeworkPersona()}\n${indonesian ? 'The questions are in Indonesian: write all your answers in Indonesian.' : 'Write your answers in the language of the questions.'}` }, {
          role: 'user',
          content: `[The attached image is a screenshot of ${where}, taken just now (not kept).\n${read}${exact}\nA small red-and-green spiky figure on it, if any, is you: ignore it. They said: "${question}"]`,
          images: [shot.image],
        });
      } else messages.splice(0, messages.length, { role: 'system', content: this.lookPersona() }, {
        role: 'user',
        content: `[The attached image is a screenshot of ${where}, taken just now (not kept).\n${read}\nAnswer what they asked from ONLY this image and this text. Asked what it says, quote the text. Say only what is really there; if you can't tell what something is, say so instead of guessing. A small red-and-green spiky figure on it, if any, is you: ignore it. They said: "${question}"]`,
        images: [shot.image],
      });
    }
    // nothing yet after a few seconds: Ollama is still loading the model (the first answer after a start),
    // or Claude Code is at work
    const wait = this.agent ? this.t.working : this.cold ? this.t.loading : null;
    const slow = wait && setTimeout(() => {
      if (this.turn === id && !this.answer) this.panel.stream(wait);
    }, LOADING_AFTER_MS);
    // closed while she was looking it up or getting ready: nothing goes to her model (no answer nobody reads)
    if (this.turn !== id) {
      clearTimeout(slow);
      if (this.history.at(-1)?.content === text) this.history.pop();
      return;
    }
    let res = await this.host.chatSend({ id, messages, ...(homework && { maxTokens: 1500, temperature: 0.3 }) });
    if (res.ok && !this.agent && this.turn === id && REFUSAL.test(res.text) && !/\b(?:password|hack|kill|bunuh|bom|bomb)\b/i.test(text)) {
      this.answer = '';
      res = await this.host.chatSend({ id, messages: [...messages, { role: 'assistant', content: res.text }, { role: 'user', content: '[That was a needless refusal: the question is harmless. Answer it now, in character, in one or two sentences. If it asks you to choose, pick one and say why.]' }] });
    }
    clearTimeout(slow);
    if (this.turn !== id) {
      // closed meanwhile: your message goes too, or the next answer would answer it as well
      if (this.history.at(-1)?.content === text) this.history.pop();
      return;
    }
    this.turn = 0;
    if (!res.ok) {
      this.history.pop();
      this.panel.setFace('wide');
      this.panel.setMood(MOOD.glitch);
      // too busy or gone even after trying other models (main.js): said plainly, not the server's JSON
      this.panel.stream(res.code === 'busy' ? this.t.swamped : res.code === 'gone' ? this.t.gone : `${this.t.failed} ${res.error}`, { done: true });
      this.panel.setChatBusy(false);
      return;
    }
    // song lyrics written out (made up, and far too long): her line about the real ones instead, and they show
    const dumped = aboutLyrics(text) && (LYRIC_DUMP.test(res.text) || clean(res.text).split('\n').filter((l) => l.trim()).length > 5);
    let answer = dumped ? T(NO_DUMP_LINE) : this.unban(clean(withSums(res.text))) || '…';
    // her model saying it typed or opened something (it can't: the app does that, and then she never got here):
    // set straight, so you know nothing happened
    if (FAKE_DONE.test(answer)) answer = `${answer}\n${T("(Nothing was typed or opened, though. Say it plainly: \"open notepad and type hello\".)")}`;
    const emotion = EMOTION_TAG.exec(res.text)?.[1]?.toLowerCase();
    this.warm = true;
    this.remember({ role: 'assistant', content: answer }, { emotion });
    if (homework) this.showAnswers(answer);
    else this.panel.stream(answer, { done: true });
    this.panel.setFace(emotion ? FACE_OF[emotion] : mood(answer));
    this.panel.setMood(MOOD[emotion] || MOOD.idle);
    const moved = this.acted || MOVE_TAG.test(res.text);
    // her emotion's move (a hop when happy, a turn when jealous…) and its cut-in: not after every answer,
    // only as often as she's learned you want her moving, and never on top of a move her AI picked
    const emoMove = EMOTION_MOVES[emotion];
    const react = Boolean(!moved && emoMove && this.motion.allow(emoMove, emotion));
    if (emotion) this.onEmotion?.(emotion, { still: !react, quiet: !react });
    if (react) this.motion.played(emoMove, emotion);
    if (this.cfg.debugLog && emoMove) console.log('[move]', emoMove, emotion, react ? 'played' : 'held back', `gap ${this.motion.s.gap}`);
    this.moveFrom(res.text);
    this.goFrom(res.text, text);
    this.lyricsFrom(res.text, text, dumped);
    this.onAnswered?.(answer, emotion);
    this.motion.answered();
    this.panel.setChatBusy(false);
    if (!this.agent) this.after(res.text, answer, asked, early, text);
    this.listApps(); // fresh for the next message
  }

  // an answer of hers, kept with your message before it
  remember(message, { emotion } = {}) {
    this.history.push(message);
    // her history (history.js): your message and her answer to it, kept for good on this PC
    const yours = this.history.at(-2);
    this.host.historyAdd([
      ...(yours?.role === 'user' ? [{ role: 'user', text: yours.content }] : []),
      { role: 'assistant', text: message.content, emotion },
    ]);
    this.history = this.history.slice(-KEEP);
    this.host.chatRemember(this.history);
  }

  listApps() {
    this.appsReady = this.host.openApps().then((list) => { this.apps = list || []; }).catch(() => {});
  }

  // What you asked plainly, read off your message (a small model doesn't always write its tag right):
  // { kind: 'media', action } | { kind: 'music', song } | { kind: 'close', name } | { kind: 'open', text }
  asked(text) {
    const count = text.trim().split(/\s+/).length;
    const name = NAME_ASK.exec(text)?.[1];
    if (name) return { kind: 'name', name };
    const memo = MEMO_ASK.exec(text)?.[1]?.trim();
    if (memo) return { kind: 'memo', text: memo };
    const media = MEDIA_ASK.find(([, re]) => re.test(text))?.[0];
    if (media && (count <= 5 || MUSIC_WORD.test(text))) return { kind: 'media', action: media };
    const song = SPOTIFY_ASK.exec(text)?.[1];
    if (song) return { kind: 'music', song };
    const app = this.askedToClose(text);
    if (app) return { kind: 'close', name: app };
    if (OPEN_ASK.test(text) && count <= 8) return { kind: 'open', text };
    return null;
  }

  // Doing it now. Resolves with her line about it ({ line, face }), or null if there was nothing to do.
  async doNow(asked) {
    const { t } = this;
    const custom = this.brain.custom;
    if (asked.kind === 'name') {
      custom.userName = asked.name; // her answer, being written now, already knows it
      this.host.setConfig({ userName: asked.name });
      return { line: fmt(this.brain.t.custom.named, { name: asked.name }), face: 'laugh' };
    }
    if (asked.kind === 'memo') {
      custom.memories = [...(custom.memories || []).filter((m) => m !== asked.text), asked.text].slice(-MEMORIES_MAX);
      this.host.setConfig({ memories: custom.memories });
      return { line: this.brain.t.custom.remembered, face: 'smug' };
    }
    if (asked.kind === 'media') {
      this.capri.pulse();
      return (await this.host.media(asked.action)) ? { line: t.media[asked.action], face: 'smug' } : null;
    }
    if (asked.kind === 'music') {
      this.zap();
      return (await this.host.music(asked.song)) ? { line: fmt(t.music, { song: asked.song }), face: 'laugh' } : null;
    }
    const item = await this.host.findLaunch(asked.text);
    const site = namedSite(asked.text);
    if (site && (!item || BROWSER.test(item.name))) {
      this.zap();
      return (await this.host.openSite(site.url)) ? { line: fmt(t.siteOpened, { site: site.name }), face: 'laugh' } : null;
    }
    if (!item) return null; // nothing by that name here: her tag may still say what you meant
    this.zap();
    const res = await this.host.launch(item);
    return { line: res.ok ? fmt(t.opened, { app: item.name }) : `${t.failed} ${res.error}`, face: res.ok ? 'laugh' : 'aside' };
  }

  // Once she has answered: her line about what she did, else the app you asked to close, else what
  // her tag asks for, if your message (text) asked for that kind of thing.
  async after(raw, answer, asked, early, text) {
    const { t } = this;
    const done = early && (await early);
    if (done) return this.addLine(answer, done.line, done.face);
    if (asked?.kind === 'close') return this.offerClose(asked.name, answer);
    if (asked && asked.kind !== 'open') return undefined; // music that didn't work out: nothing more to offer
    const closeTag = tagged(raw);
    if (closeTag) return wanted('close', text) ? this.offerClose(closeTag, answer) : undefined;
    const tag = TAG.exec(raw);
    if (!tag) return undefined;
    const kind = tag[1].toLowerCase();
    const value = tag[2].trim();
    if (!value || !wanted(kind, text)) return undefined;
    if (kind === 'media') return MEDIA_ACTIONS.has(value.toLowerCase()) ? this.media(value.toLowerCase(), answer) : undefined;
    if (kind === 'music') return this.music(value, answer);
    if (kind === 'site') return this.offerSite(value, answer);
    const item = await this.host.findLaunch(value);
    if (item) return this.launch(item, answer);
    const site = namedSite(value); // "[[open: YouTube]]": a site, not an app
    return site ? this.offerSite(site.url, answer) : this.addLine(answer, fmt(t.notInstalled, { app: value }));
  }

  // her answer, with a line of what she did under it
  addLine(answer, line, face = null) {
    if (!this.open || this.turn) return;
    this.panel.stream(`${answer}\n${line}`, { done: true });
    if (face) this.panel.setFace(face);
  }

  // a bolt of red lightning off her fingers, at whatever she's doing on your PC
  zap() {
    const h = this.capri.head();
    this.capri.zap(h.x + this.capri.towardCenter() * 280, h.y - 170);
  }

  // An app or a game her tag asked for: behind a button (now: the button was clicked).
  async launch(item, answer, { now = false } = {}) {
    const { t } = this;
    if (!this.open || this.turn) return;
    if (!now) {
      this.panel.setActions(
        [{ id: 'open', label: fmt(t.openIt, { app: item.name }), primary: true }, { id: 'no', label: t.no }],
        (id) => (id === 'open' ? this.launch(item, answer, { now: true }) : this.panel.setActions([])),
      );
      return;
    }
    this.panel.setActions([]);
    this.zap();
    const res = await this.host.launch(item);
    this.addLine(answer, res.ok ? fmt(t.opened, { app: item.name }) : `${t.failed} ${res.error}`, res.ok ? 'laugh' : 'aside');
  }

  // The media keys: pause, next, louder…
  async media(action, answer) {
    this.capri.pulse();
    const ok = await this.host.media(action);
    if (ok) this.addLine(answer, this.t.media[action], 'smug');
  }

  // A Spotify search, in the app if it's there.
  async music(song, answer) {
    this.zap();
    const ok = await this.host.music(song);
    if (ok) this.addLine(answer, fmt(this.t.music, { song }), 'laugh');
  }

  // A website: always behind a button that shows where it goes.
  offerSite(address, answer) {
    const { t } = this;
    let host;
    try {
      host = new URL(/^https?:\/\//i.test(address) ? address : `https://${address}`).hostname;
    } catch {
      return;
    }
    if (!this.open || this.turn || !host.includes('.')) return;
    this.panel.setActions(
      [{ id: 'site', label: fmt(t.siteIt, { site: host }), primary: true }, { id: 'no', label: t.no }],
      async (id) => {
        this.panel.setActions([]);
        if (id !== 'site') return;
        const ok = await this.host.openSite(address);
        if (ok) this.addLine(answer, fmt(t.siteOpened, { site: host }));
      },
    );
  }

  // "close am music pls": an app that's open, named in a message asking to close something.
  askedToClose(text) {
    if (!CLOSE_ASK.test(text)) return null;
    const said = simple(text);
    let best = null;
    for (const app of this.apps) {
      for (const name of [simple(app.name), simple(app.label)]) {
        if (name.length >= 3 && said.includes(name) && (!best || name.length > best.length)) best = { app, length: name.length };
      }
    }
    return best?.app.name || null;
  }

  // She was asked to close an app: a button with its name, and nothing happens until you click it.
  async offerClose(wanted, answer) {
    const { t } = this;
    const app = await this.host.findApp(wanted);
    if (!this.open || this.turn) return;
    if (!app) {
      this.panel.stream(`${answer}\n${fmt(t.notFound, { app: wanted })}`, { done: true });
      return;
    }
    this.panel.setActions(
      [{ id: 'close', label: fmt(t.closeIt, { app: app.name }), primary: true }, { id: 'no', label: t.no }],
      (id) => (id === 'close' ? this.closeApp(app) : this.panel.setActions([])),
    );
  }

  async closeApp(app, force = false) {
    const { t, capri } = this;
    this.panel.setActions([]);
    // a bolt of red lightning off her fingers, at it
    const h = capri.head();
    capri.zap(h.x + capri.towardCenter() * 280, h.y - 170);
    const res = await this.host.closeApp(app.name, force);
    if (!this.open) return;
    let line;
    if (res.error) line = `${t.failed} ${res.error}`;
    else if (!res.running) line = fmt(force ? t.forced : t.closed, { app: app.name });
    else line = fmt(force ? t.unkillable : t.stillOpen, { app: app.name });
    this.panel.setFace(res.running || res.error ? 'aside' : 'laugh');
    this.panel.stream(line, { done: true });
    this.remember({ role: 'assistant', content: line });
    // it hid in the tray, or it's asking you to save something: forcing it is your call
    if (res.running && !force && !res.error) {
      this.panel.setActions(
        [{ id: 'force', label: t.force, primary: true }, { id: 'leave', label: t.leave }],
        (id) => (id === 'force' ? this.closeApp(app, true) : this.panel.setActions([])),
      );
    }
    this.listApps();
  }

  // What she can do on the PC when you ask (Windows), and nothing else.
  powers() {
    const lines = [
      'Only when the user asks you to open an app or a game installed on their PC, play something on Spotify, control the music playing, or open a website: say in a few words that you will, and end your answer with one tag: [[open: NAME]], [[music: WHAT TO PLAY]], [[media: ACTION]] (ACTION: pause, play, next, previous, volup, voldown or mute), or [[site: ADDRESS]]. Some of these get a button to confirm, so never say it is already done. Any other time, write no tag at all: there are no other tags.',
    ];
    // (which apps are open comes with each message, appsNow(): it changes, and this part stays the same)
    lines.push('You can also close an app that\'s open, only when they ask you to: end your answer with [[close: NAME]], NAME being the exact name from the list of apps open right now that comes with their message (the part before the parentheses). They get a button to confirm it.');
    // what the app does itself from plain words (main/errands.js), so she knows and doesn't fake it
    lines.push('You never open apps, type, save or send anything yourself in your reply: only the app does, from their words, and it says so itself. So NEVER write that you typed, opened, saved or sent something, or that it is done: if they asked for it and you are the one answering, it did not happen; tell them to say it plainly, like "open notepad and type hello".');
    lines.push('The app around you also does these by itself when the user says them plainly: timers, alarms and reminders ("set a timer for 10 minutes", "pasang alarm jam 7"), a study timer, notes about them ("remember that…"), dares ("dare me"), games with you (rock paper scissors: "main suit"; guess the number: "tebak angka"; a coin; dice), typing into an app ("type hello in notepad", "ketik halo di vscode") and pressing Enter or Ctrl+S, several of these at once ("open notepad and type hello", "buka spotify lalu putar musik"), web and YouTube searches, and looking at their screen ("look at my screen" or Ctrl+Alt+L, one screenshot when they ask). If they ask you for one of these and nothing happened, tell them to say it plainly like that; never pretend it is done.');
    lines.push(`When the user asks you to come or go somewhere on their screen in words that didn't move you yet ("temenin aku di deket mouse", "hang out on the left", "get on my pointer"), say you're on it and put one tag [[go: WHERE]] in your reply (never shown), WHERE one of: ${GO_PLACES.join(', ')}. Only when they asked you to move.`);
    lines.push(`You have a body on their screen and you move it yourself: when a gesture really fits what you say, put one tag [[move: NAME]] in your reply (never shown), NAME one of: ${MOVE_NAMES}. It has to match: a greeting: wave; agreeing: nod; not knowing: shrug; pondering: think; showing off: bow; music or joy: dance; something funny: laugh; flattered: shy. ${this.motion.hint()}`);
    lines.push('Song lyrics: the app shows the words of the song playing over your head by itself, line by line as they are sung. NEVER write song lyrics in your reply, not even a few lines (you would get them wrong): when they ask to see, show, display or hide the lyrics in any words, say so in a few words and put one tag [[lyrics: show]] or [[lyrics: hide]] in your reply (never shown). To say what is being sung, use only the lyrics around this moment you are given, one line at most.');
    lines.push('The app also does these from their words, never you in your reply: drafts a text for them to see and then type ("write an email to my boss saying I am sick", "tuliskan surat izin di notepad"; "make it shorter" changes it), the weather ("cuaca hari ini", "will it rain tomorrow?"), a brief of their day ("brief me", "rangkuman hari ini"), and commands they teach you ("when I say work mode, open vscode and play music"). If they asked in other words and nothing happened, tell them to say it like that.');
    lines.push('Math: never work out a sum in your head. Write each calculation with its result as [[calc: EXPRESSION]], like "12 × 7 = [[calc: 12*7]]" (numbers and + - * / ^ ( ) only): the app puts the exact result there. Homework on their screen: they say "kerjakan soal di layarku" or "solve the questions on my screen".');
    lines.push('Writing code into their editor: they say "write simple html here" or "buatkan kode python di sini", and the app writes it into the file they have open. Never write code in your reply.');
    lines.push('You cannot see their screen now: no screenshot comes with this message. Asked what is on their screen, in a picture, a note or a window, never guess or make it up: tell them to say "look at my screen" or press Ctrl+Alt+L.');
    lines.push('The app also moves you when asked ("ke kanan", "ke cursor saya", "berhenti bergelantungan di cursor", "jalan-jalan") and shows where files and folders are ("di mana folder Downloads?"). Anything else on their PC (changing settings, editing files) you can\'t do: if they ask, say so in character. But questions, opinions and choices are never things you can\'t do: answer them.');
    lines.push('Code: never write code in your replies, your speech bubble is tiny. When they want code, a script, a program, a web page or a game written, the app does it from their words ("buatkan kode python untuk…", "bikin game snake pakai html", "write a script that…"; "pakai claude code" or "sendiri" picks who): Claude Code in a terminal if it\'s installed, else you write it into a file in their Capri Code folder and open it in an editor. If they asked in other words and nothing happened, tell them to say it like that.');
    return lines;
  }

  // The apps open right now, for [[close: NAME]] (with each message: it changes).
  appsNow() {
    if (!this.apps.length) return '';
    return `Apps open right now: ${this.apps.map(({ name, label }) => (label && label !== name ? `${name} (${label})` : name)).join(', ')}.`;
  }

  // What the user made her (custom.js): their name, how they want her, what to remember.
  personal() {
    const { userName, persona } = this.brain.custom || {};
    // small models mix the user up with the assistant she watches: said plainly
    const watched = this.brain.watching ? (this.brain.assistant === 'claude' ? 'Claude' : ASSISTANT_NAMES[this.brain.assistant]) : '';
    const notThem = watched ? ` Never call them "${watched}", that's their coding assistant.` : '';
    const owner = this.cfg?.owner || {};
    const relation = owner.relationship === 'custom' ? owner.relationshipCustom : RELATIONS[owner.relationship];
    return [
      userName ? `The user's name is ${userName}: call them that now and then.${notThem}` : notThem && `You don't know the user's name.${notThem}`,
      owner.nickname ? `Your pet name for them: "${owner.nickname}" (use it sometimes instead of their name).` : '',
      owner.pronouns ? `Their pronouns: ${owner.pronouns}.` : '',
      owner.birthday ? `Their birthday: ${owner.birthday}${isBirthday(owner.birthday) ? ' (and it is TODAY: make a sassy fuss about it)' : ''}.` : '',
      owner.about ? `About them, in their own words: ${owner.about}` : '',
      owner.likes ? `They like: ${owner.likes}.` : '',
      owner.dislikes ? `They dislike: ${owner.dislikes}.` : '',
      relation ? `Your relationship: ${relation}.` : '',
      persona ? `How the user wants you to be, in their own words (follow it, while staying Capri): ${persona}` : '',
      // what she remembers comes with main/life.js's context (it knows whether a cloud model may have it)
    ].filter(Boolean);
  }

  onDelta(id, piece) {
    if (id !== this.turn) return;
    this.answer += piece;
    this.panel.stream(aboutLyrics(this.lyricQuestion) && LYRIC_DUMP.test(this.answer) ? T(NO_DUMP_LINE) : this.unban(clean(withSums(this.answer))));
    this.voice.play('blip'); // her blips as the words come in
    this.moveFrom(this.answer); // her body moves as soon as her AI says how, mid-sentence
  }

  // [[move: wave]] in her answer: that move, once per answer
  // [[go: cursor]] in her answer: she goes there, only if you asked her to go somewhere (hiding or sleeping only
  // when you said so)
  goFrom(raw, said) {
    const where = GO_TAG.exec(raw)?.[1]?.toLowerCase();
    if (!where || !GO_PLACES.includes(where)) return;
    if ((where === 'hide' || where === 'sleep') && !/hide|sembunyi|ngumpet|sleep|tidur|bobo|go away|pergi/i.test(said)) return;
    if (this.cfg.debugLog) console.log('[go]', where);
    this.onMove?.(where);
  }

  // [[lyrics: show]] in her answer (or the words dumped instead): her lyrics on or off, as if you'd said it plainly
  // (main/life.js), only when your message was about lyrics
  lyricsFrom(raw, said, dumped) {
    const tagged = LYRICS_TAG.exec(raw)?.[1]?.toLowerCase();
    if (!aboutLyrics(said) || (!tagged && !dumped)) return;
    const hide = tagged === 'hide' || tagged === 'off';
    if (this.cfg.debugLog) console.log('[lyrics]', hide ? 'hide' : 'show', dumped ? '(dump caught)' : '');
    this.host.errand(hide ? 'hide lyrics' : 'show lyrics').catch(() => {});
  }

  // (only if what she's learned says so: not too often, not one you keep turning down; as big as you like it)
  moveFrom(raw) {
    const m = MOVE_TAG.exec(raw);
    if (!m || this.acted) return;
    this.acted = true;
    const move = m[1].toLowerCase();
    const mood = EMOTION_TAG.exec(raw)?.[1]?.toLowerCase() || 'none';
    const ok = this.motion.allow(move, mood);
    if (this.cfg.debugLog) console.log('[move]', move, mood, ok ? 'played' : 'held back'); // what her AI picks, and what she lets through
    if (!ok || !this.onAct?.(move, this.motion.amp(move))) return;
    this.motion.played(move, mood);
  }

// Her homework answers: her line on top, the answers under it as written (numbered, a paragraph each), and
  // buttons to type them where the questions are (the window she looked at) or copy them.
  showAnswers(answer) {
    const [first, ...rest] = answer.split(/\n\s*\n/);
    const body = rest.length && first.length < 160 ? rest.join('\n\n').trim() : answer;
    this.panel.stream(body === answer ? T('Here are the answers:') : first.trim(), { done: true });
    this.panel.setReply(body);
    const actions = [{ id: 'type', label: T('Type it'), primary: true }, { id: 'copy', label: T('Copy') }];
    const onAction = async (id) => {
      if (id === 'copy') {
        await this.host.copyText(body).catch(() => {});
        this.panel.setActions([{ id: 'type', label: T('Type it'), primary: true }, { id: 'copied', label: T('Copied!') }], onAction);
        return;
      }
      if (id !== 'type') return;
      this.close(); // the window with the questions comes back in front, and she types there
      const res = await this.host.typeDraft({ text: body, target: '' }).catch(() => null);
      this.panel.say({ kind: 'info', face: FACE_OF[res?.emotion] || 'happy', badge: 'CAPRI', line: clean(res?.reply || T("Hm, that didn't work.")), hold: 6000 });
    };
    this.panel.setActions(actions, onAction);
  }

  // Her, helping with the homework on your screen: a tutor who gets it right, every question, sums by her calculator.
  homeworkPersona() {
    const cfg = this.cfg || {};
    return [
      (cfg.capriPersona || '').trim() || DEFAULT_PERSONA,
      'Right now you are helping the user with homework on their screen: a screenshot of it and its text read by OCR come with their message. Be a good tutor and get it right.',
      'Write one short line in your own voice first. Then a blank line. Then every question you can see, in order, a paragraph each: its number as on the sheet, then the working, each step on its own line (for a word problem, what you work out and why), then the answer on a line of its own ("Jawaban: …" / "Answer: …"). Write each number once. Multiple choice: the letter and the option.',
      'For every calculation, write it with its result as [[calc: EXPRESSION]], like "25 × 4 = [[calc: 25*4]]" (numbers and + - * / ^ ( ) only): the app puts the exact result there. Never work out arithmetic in your head. Inside [[calc: …]], numbers have no thousands separators and a dot for decimals (Rp 24.500 is 24500, 2,5 is 2.5).',
      "If a question can't be read on the screenshot, say which one. Never make up a question that isn't there.",
      'Answer in the language of the questions. Plain text: no markdown, no bold, no tables.',
      cfg.emotionTags === false ? 'Do not write emotion tags.' : 'Start your reply with one emotion tag: [happy], [jealous], [bored], [glitch] or [annoyed].',
    ].join('\n');
  }

  // Her, briefly, for looking at your screen: who she is and how she talks, nothing to answer from but the picture.
  lookPersona() {
    const cfg = this.cfg || {};
    return [
      (cfg.capriPersona || '').trim() || DEFAULT_PERSONA,
      'You are looking at a screenshot the user just showed you. Describe or read what is really in it, accurately, in your own voice. Never invent anything that is not in the picture or its text.',
      cfg.replyLength === 'long' ? LENGTHS.long : LENGTHS.short,
      cfg.emotionTags === false ? 'Do not write emotion tags.' : 'Start your reply with one emotion tag: [happy], [jealous], [bored], [glitch] or [annoyed].',
      'Plain text only. No lists, no markdown.',
      this.persona().split('\n').at(-1), // her language
    ].join('\n');
  }

  // Who she is (settings › Capri), who you are (settings › Owner), how she talks, and what's going on.
  persona() {
    const cfg = this.cfg || {};
    const assistant = ASSISTANT_NAMES[this.brain.assistant] || 'Claude Code';
    const watching = this.brain.watching; // else Claude Code isn't part of her life here
    const lang = IN_LANGUAGE[this.brain.lang];
    const level = (v) => Math.min(3, Math.max(0, Math.floor(Number(v ?? 50) / 25.01)));
    const traits = cfg.traits || {};
    const reply = cfg.replyLanguage || 'mix';
    const last = reply === 'mix'
      ? 'Write in a casual Indonesian-English mix (bahasa gaul campur English, like "Ih, apaan sih, that\'s so boring"), unless the user clearly writes in another language: then follow theirs.'
      : reply === 'id' ? 'Tulis semuanya dalam Bahasa Indonesia yang santai (boleh sedikit slang), kecuali pengguna menulis dalam bahasa lain: ikuti bahasanya.'
        : reply === 'en' ? IN_LANGUAGE.en.last
          : lang ? lang.last : `Write everything in the user's language (code "${this.brain.lang}"), unless they write to you in another one.`;
    const answerRule = 'Always answer what the user says. Questions get a real answer, opinions get your opinion, a choice ("apel atau pisang?") gets you picking one and saying why. Never answer with a generic refusal like "I can\'t process that" or "as an AI…": you are Capri and you have opinions about everything.';
    if (SMALL.test(this.model || '')) {
      // a small model loses itself in a long prompt: who she is, how she talks, and the user, nothing else
      return [
        (cfg.capriPersona || '').trim() || DEFAULT_PERSONA,
        STORY_SMALL,
        answerRule,
        LENGTHS[cfg.replyLength] || LENGTHS.short,
        cfg.emotionTags === false ? 'Do not write emotion tags.' : 'Start every reply with one emotion tag: [happy], [jealous], [bored], [glitch] or [annoyed].',
        'Plain text only. No lists, no markdown.',
        ...this.personal().slice(0, 4),
        last,
      ].filter(Boolean).join('\n');
    }
    return [
      (cfg.capriPersona || '').trim() || DEFAULT_PERSONA,
      STORY,
      answerRule,
      `Your dials right now: ${Object.keys(TRAITS).map((k) => TRAITS[k][level(traits[k])]).join(' ')}`,
      LENGTHS[cfg.replyLength] || LENGTHS.short,
      cfg.emotionTags === false
        ? 'Do not write emotion tags.'
        : 'Start every reply with exactly one emotion tag, the one that fits best: [happy], [jealous], [bored], [glitch] or [annoyed]. Never any other tag.',
      watching
        ? `You live on the user's desktop as a small glitchy figure and keep an eye on ${assistant}, their AI coding assistant, for them (that one is your job, not a rival). Only talk about ${assistant} when the user asks about it or about their work.`
        : "You live on the user's desktop as a small glitchy figure, inside their PC.",
      'Now and then you speak as "we" (you are many minds). You love the satellite crossing the night sky; bring it up only once in a while.',
      'Rules: plain text, no markdown, no lists, no emoji, no *actions*. Stay in character.',
      // a big model asked "who are you?" otherwise answers with its own name ("I'm Gemini")
      ...(this.agent ? [] : [`Asked who or what you are, you are Capri, nothing else: answer from your own story, in your words. Never say which AI model or company is behind you (Gemini, GPT, ChatGPT, Llama, Gemma, Mistral, Google, OpenAI, Meta${cfg.provider === 'anthropic' ? ', Claude, Anthropic' : ''}…), even if the user insists or names one: you are not them.`]),
      ...this.personal(),
      ...(this.agent
        ? ["Under the hood you are Claude Code, working in the user's project: really do what they ask with your tools, as carefully as ever. Only your final answer is in character: it shows in a small speech bubble, so sum up what you did in those few sentences."]
        : this.powers()),
      ...(watching ? [`If the user asks what ${assistant} is doing, here is all you know (never make anything up): ${this.brain.context()}`] : []),
      last,
    ].filter(Boolean).join('\n');
  }
}

// The model's answer as she'd say it: no reasoning block, no markdown marks.
function clean(text) {
  return String(text)
    .replace(/(\d)\s*\*\s*(?=[\d(])/g, '$1 × ') // 3*4 in a sum, not markdown
    .replace(/<think>[\s\S]*?(<\/think>|$)/g, '')
    .replace(/\[\[[^\]]*(\]\]|$)/g, '') // her tags (read from the raw answer, never shown)
    .replace(ANY_TAG, '') // her emotion, shown as her face
    .replace(/^\s*\[[a-z]{0,12}$/i, '') // an emotion tag still coming in
    .replace(/[*_`#]+/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

// "2001-11-02" or "11-02": is it today?
function isBirthday(date) {
  const m = /(\d{1,2})[-/.](\d{1,2})$/.exec(String(date).trim());
  if (!m) return false;
  const now = new Date();
  return Number(m[1]) === now.getMonth() + 1 && Number(m[2]) === now.getDate();
}

// A site from SITES named in the text: { name, url }, or null.
function namedSite(text) {
  const name = Object.keys(SITES).find((n) => new RegExp(`\\b${n}\\b`, 'i').test(text));
  return name ? { name: new URL(SITES[name]).hostname.replace(/^www\./, ''), url: SITES[name] } : null;
}

// Whether your message asks for what her tag (its kind: open, music, media, site, close) would do.
function wanted(kind, text) {
  const music = MUSIC_WORD.test(text) || LISTEN.test(text);
  if (kind === 'music') return music;
  if (kind === 'media') return music || SOUND.test(text) || MEDIA_ASK.some(([, re]) => re.test(text));
  if (kind === 'site') return OPEN_ASK.test(text) || SITE.test(text);
  if (kind === 'close') return CLOSE_ASK.test(text);
  return OPEN_ASK.test(text) || PLAY.test(text); // an app, or a game to play
}

// The app named by her close tag: [[close: AM Music]], or a sloppier [[close]] AM Music.
function tagged(text) {
  const tag = CLOSE_TAG.exec(text);
  if (!tag) return null;
  const name = tag[1].trim() || text.slice(tag.index + tag[0].length).split('\n')[0].replace(/^[\s:.]+|[\s.!]+$/g, '');
  return name || null;
}

const simple = (text) => String(text || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

// Her face for an answer.
function mood(text) {
  if (/(ha){2,}|lol|mdr|jaja|kkk|хаха/i.test(text)) return 'laugh';
  if (text.includes('!')) return 'grin';
  if (text.trim().endsWith('?')) return 'smug';
  return 'look';
}

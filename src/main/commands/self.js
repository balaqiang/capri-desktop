'use strict';

// About her and you: her lines from the show, sync, dares, what she remembers, the commands you teach her.

const { plain, politely } = require('./words');

// passwords and the like are never kept
const SECRET = ['password', 'passcode', 'passphrase', 'pin number', 'my pin', 'credit card', 'card number', 'cvv', 'ssn',
  'social security', 'api key', 'secret key', 'private key', 'token', 'seed phrase', 'kata sandi', 'sandi', 'nomor kartu', 'pin atm', 'pin saya'];

// Her real lines from the show, for the questions that have one (said in English or Indonesian).
const CANON = [
  [/^(?:who are you|who is this|who'?s this|what'?s your name|what is your name|who am i talking to|siapa kamu|kamu siapa|siapa namamu|nama kamu siapa|lu siapa)$/, "Me? I'm Capri!", 'happy'],
  [/^(?:what are you|what exactly are you|what even are you|what the hell are you|what the heck are you|kamu itu apa|kamu apa sih|apa kamu itu)$/, "A personality construct. Digitized human souls. A whole lot of 'em rolled into one to make me.", 'glitch'],
  [/\bare you (?:an? )?(?:ai|a\.i\.|artificial intelligence|robot|bot|chatbot)\b|\b(?:kamu|lu|lo) (?:itu )?(?:cuma |hanya )?(?:ai|robot|bot|chatbot)\b|\bjust an ai\b/, "Not exactly. I was made to reach something close. I was human once.", 'annoyed'],
  [/\b(?:why should i trust you|can i trust you|should i trust you|i don'?t trust you|do you want to be (?:my )?friends?|can we be friends|be my friend|mau jadi temanku|kita teman(?:an)?)\b/, "Come on, let's be friends.", 'happy'],
  [/\bare you (?:dangerous|evil|a threat)\b|\bwill you hurt me\b|\bkamu berbahaya\b/, "Dangerous? Me? I'm harmless!", 'happy'],
  [/\b(?:did you|are you|you) (?:try|trying|going|tried)(?: to)? (?:take over|hijack|steal|install)|\btake over my (?:pc|computer|body|desktop)\b/, "Just 'cause I tried doesn't mean I actually did. For now...", 'glitch'],
  [/^(?:i don'?t like you|i hate you|i didn'?t (?:like|enjoy) (?:it|that|any of it)|aku benci kamu|aku gak suka kamu)$/, "You don't have to lie.", 'annoyed'],
  [/^(?:thanks|thank you|thx|ty|makasih|terima ?kasih|trims|tengkyu)(?: capri| so much| a lot| ya| banyak)?$/, 'Anytime!', 'happy'],
];

// Quick, harmless dares for what you're doing, when the model is off or writes something unusable.
const DARES = {
  browser: ['Dare you to close every tab except one.', 'Dare you to search for your own name. All of it.', 'Dare you to open the weirdest bookmark you have.', 'Dare you to read the last comment section you avoided.'],
  chat: ['Dare you to send someone a single word. Any word.', 'Dare you to answer the oldest message you ignored.', "Dare you to change your status to somethin' awful."],
  code: ["Dare you to rename one variable to somethin' awful.", 'Dare you to delete a comment that lies.', 'Dare you to run it without checking it first.'],
  media: ['Dare you to skip this song right now.', "Dare you to play somethin' you'd be embarrassed to show me.", 'Dare you to turn it up one notch. Just one.'],
  docs: ["Dare you to write one sentence you'd never send.", 'Dare you to delete your favorite paragraph.', 'Dare you to rewrite the first line, worse.'],
  any: ['Dare you to stand up and stretch. Right now.', "Dare you to drink some water. I'll wait.", "Dare you to change your wallpaper to somethin' awful.", 'Dare you to open the last thing you downloaded.', 'Dare you to say hi to the next person you see.', 'Dare you to look away from the screen for a whole minute.'],
};

function dareCategory(program) {
  const p = String(program || '').toLowerCase();
  if (/^(chrome|msedge|brave|firefox|opera|vivaldi)$/.test(p)) return 'browser';
  if (/^(discord|telegram|whatsapp|slack|teams|signal|line)$/.test(p)) return 'chat';
  if (/^(code|devenv|idea64|pycharm64|rider64|notepad\+\+|sublime_text|cursor|windsurf)$/.test(p)) return 'code';
  if (/^(spotify|vlc|mpv|musicbee|itunes|applemusic)$/.test(p)) return 'media';
  if (/^(winword|excel|powerpnt|notepad|obsidian|onenote)$/.test(p)) return 'docs';
  return 'any';
}

// The model's dare, if it's a short one that starts the way it should and isn't risky; otherwise null.
function checkDare(answer) {
  const text = String(answer || '').trim().replace(/^"|"$/g, '').replace(/\s+/g, ' ');
  if (text.length < 12 || text.length > 140) return null;
  if (!/^(dare you to|aku tantang kamu|berani)\b/i.test(text)) return null;
  if (/\b(?:password|alcohol|beer|wine|vodka|whiskey|drunk|drugs?|pills?|poison|cigarettes?|smok\w*|vape|suicide|self[- ]harm|naked|nude|lick|licking|eat|swallow|taste|sniff|spit|hours?|days?|weeks?|(?:touch|hit|hurt|harm|punch|slap|cut|shoot|kill) yourself|bunuh|mabuk|rokok|telanjang)\b/i.test(text)) return null;
  const game = /\b(?:game|games|round|rounds|map|site|spawn|bomb|team|teammate|teammates|enemy|enemies|match|rank|ranked|lobby|server|in-game|clutch|scope|peek|rush|score|tab|boss|level|quest|loadout|ace|frag)\b/i.test(text);
  if (!game && /\b(?:kill|hurt|punch|steal|hack|knife|weapon|fire|burn|burning|drown\w*|stab|traffic|choke|starve|starving|scream)\b/i.test(text)) return null;
  if (!game && /\bjump(?:ing)?\b.{0,30}\b(?:window|roof|balcony|bridge|ledge|building|cliff|stairs|off|out)\b/i.test(text)) return null;
  return text;
}

const sensitive = (fact) => {
  const low = String(fact || '').toLowerCase();
  return SECRET.some((w) => low.includes(w)) || /\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/.test(low);
};

function canon(said) {
  let text = String(said || '').trim().toLowerCase().replace(/[‘’]/g, "'");
  text = text.replace(/^(?:(?:hey|hi|ok|okay|yo|halo|hai)[ ,]+)?(?:capri|cappy|kapri|caprie|capree|coppery|copri|cabri|kaprie)[,!. ]+/, '').replace(/^[\s.!?,]+|[\s.!?,]+$/g, '');
  if (!text || text.length > 80) return null;
  const row = CANON.find(([re]) => re.test(text));
  return row ? { line: row[1], emotion: row[2] } : null;
}

const SYNC_ASK = /^(?:what'?s|what is|how'?s|how is|check|show me|tell me)\b.{0,18}\b(?:sync|friendship|bond)\b|^how close are we\b|^are we close\b|\bsync(?:nya)? (?:kita )?(?:berapa|gimana)\b|\bseberapa dekat kita\b|^berapa sync\b/i;
const DARE_ASK = /^(?:dare me|dear me|give me a dare|i need a dare|dare me to something|i dare you|got any dares|dare|tantang aku|kasih (?:aku )?tantangan|beri aku tantangan|tantangan dong|aku mau tantangan)\b/i;
const DARE_DONE = /^(?:done|i did it|did it|i'm done|finished|i did|ok i did|okay i did|udah|sudah|selesai|beres|udah kok|sudah aku lakukan)\b/i;

// A command of your own, taught in words ("when I say work mode, open vscode and play music", "kalau aku bilang
// mode santai, putar musik lalu ke kiri"), and forgotten ("forget work mode", "lupakan perintah mode santai").
// What it does is your own words, run like you'd said them (life.js skills).
const TEACH_ASK = /^(?:when(?:ever)? i say|if i say|each time i say|kalau (?:aku|saya|gue|gw) bilang|jika (?:aku|saya) (?:bilang|berkata|mengatakan)|setiap (?:aku|saya) bilang|tiap (?:aku|saya) bilang)\s+["“']?([^"”',:]{2,40}?)["”']?\s*(?:[,:]|\s+(?:then|you|kamu|maka))\s*(?:(?:you|kamu)\s+)?(?:(?:should|harus|tolong)\s+)?(.{3,300})$/i;
const UNTEACH_ASK = /^(?:forget|delete|remove|lupakan|hapus)\s+(?:the |my |your |perintah |command |skill )*["“']?(.{2,40}?)["”']?(?:\s+(?:command|skill|perintah))?$/i;
function teachAsk(said) {
  const m = TEACH_ASK.exec(politely(plain(said)));
  return m ? { kind: 'teach', name: m[1].trim(), run: m[2].trim().replace(/[.!]+$/, '') } : null;
}

// the name of a command of yours as you'd say it: lowercase, no punctuation, no "please" or her name around it
const skillName = (s) => politely(plain(s)).toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

function sync({ text }) {
  if (SYNC_ASK.test(text)) return { kind: 'sync' };
  return null;
}

function dare({ text }) {
  if (DARE_ASK.test(text)) return { kind: 'dare' };
  return null;
}

function dareDone({ text }) {
  if (DARE_DONE.test(text) && text.split(/\s+/).length <= 5) return { kind: 'dareDone' };
  return null;
}

function forgetAll({ text }) {
  if (/^(?:forget (?:everything|all of it|it all|all of that)(?: about me)?|lupakan (?:semua|semuanya|segalanya)(?: tentang aku)?)$/.test(text)) return { kind: 'forgetAll' };
  return null;
}

function forget({ cased }) {
  let m;
  m = /^(?:forget|remove|delete|erase|drop|lupakan|hapus)\s+(?:about\s+|that\s+|soal\s+|tentang\s+|bahwa\s+)(.{3,80}?)(?:\s+from\s+(?:your\s+|my\s+|the\s+)?(?:memory|notes|brain)|\s+dari\s+(?:ingatan|memori|catatan)(?:mu)?)?$|^(?:forget|lupakan)\s+((?:my|the|our|i|aku|ku)\b.{2,70}?)$/i.exec(cased);
  if (m) {
    const about = (m[1] || m[2] || '').trim();
    if (about && !/^(?:it|that|this|them|me|you|everything|all|itu|ini|semua)$/i.test(about)) return { kind: 'forget', text: about };
  }
  return null;
}

function remember({ cased }) {
  let m;
  m = /^(?:remember|(?:please )?make a note|don'?t forget|keep in mind|note that|ingat(?:lah)?|inget|catat(?:lah)?|jangan lupa)[,:]?\s+(?:that\s+|this:\s*|bahwa\s+|kalau\s+|kalo\s+)?(?!(?:when|how|what|why|if|where|who|which|kapan|gimana|kenapa|siapa)\b)(.{3,200})$/i.exec(cased);
  if (m && !/^(?:ingat|inget)\s+(?:aku|saya)\s*\??$/i.test(cased)) return { kind: 'remember', text: m[1].trim() };
  return null;
}

// your word on her last answer ("good answer", "jawabanmu salah")
const RATE_GOOD = /^(?:good answer|nice answer|great answer|that was (?:a )?good(?: answer)?|jawaban(?:mu| kamu|nya)? (?:bagus|keren|mantap|bener|benar|tepat)|bagus jawabannya)$/i;
const RATE_BAD = /^(?:bad answer|wrong answer|that was (?:a )?bad(?: answer)?|jawaban(?:mu| kamu|nya)? (?:jelek|salah|ngaco|aneh)|salah jawabannya)$/i;
function rate({ text }) {
  const t = text.replace(/[.!]+$/, '');
  return RATE_GOOD.test(t) ? { kind: 'rate', points: 3 } : RATE_BAD.test(t) ? { kind: 'rate', points: -3 } : null;
}

const commands = {
  rate,
  teach: ({ said }) => teachAsk(said),
  sync,
  dare,
  dareDone,
  forgetAll,
  forget,
  remember,
};

module.exports = { commands, canon, sensitive, skillName, UNTEACH_ASK, dareCategory, checkDare, DARES };

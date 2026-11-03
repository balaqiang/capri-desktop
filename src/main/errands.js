'use strict';

// What she can be asked to do, matched from plain words (typed or spoken), so it's quick, works
// without a model and can never run anything unexpected (from Capri Desktop 2.4's Errands, with
// Indonesian added). Only things on a short list are ever started: a few folders and Windows tools,
// the media keys, her own timers and her notes. parse(text) -> { kind, ... } or { kind: 'none' }.

const os = require('node:os');
const path = require('node:path');

const NUMBERS = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  fifteen: 15, twenty: 20, thirty: 30, forty: 40, sixty: 60,
  se: 1, satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10,
  'lima belas': 15, 'dua puluh': 20, 'tiga puluh': 30, 'empat puluh': 40, 'enam puluh': 60,
};
const NUMBER = '(\\d+(?:[.,]\\d+)?|lima belas|dua puluh|tiga puluh|empat puluh|enam puluh|an?|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|forty|sixty|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh)';
const UNIT = '(seconds?|secs?|detik|minutes?|mins?|menit|hours?|hrs?|jam)';
const DURATION = new RegExp(`\\b${NUMBER}\\s*${UNIT}\\b`, 'i');

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

// The friendly name of a program ("msedge" -> "Edge")
function friendly(program) {
  const p = String(program || '');
  const known = {
    msedge: 'Edge', chrome: 'Chrome', brave: 'Brave', code: 'VS Code', devenv: 'Visual Studio', explorer: 'File Explorer', applicationframehost: '', winword: 'Word', powerpnt: 'PowerPoint',
    // Windows' own pieces and overlays, not programs you'd be "in" for hours
    textinputhost: '', shellexperiencehost: '', startmenuexperiencehost: '', searchhost: '', searchapp: '', lockapp: '', 'nvidia share': '', electron: '', capri: '',
  };
  const k = p.toLowerCase();
  if (k in known) return known[k];
  return p ? p[0].toUpperCase() + p.slice(1) : '';
}

// Where the things she can open live: Windows' folders, and programs that ship with it.
function place(name) {
  const home = os.homedir();
  const n = String(name || '').toLowerCase().trim();
  const table = {
    downloads: path.join(home, 'Downloads'), 'download folder': path.join(home, 'Downloads'), 'downloads folder': path.join(home, 'Downloads'), unduhan: path.join(home, 'Downloads'), 'folder unduhan': path.join(home, 'Downloads'), 'folder download': path.join(home, 'Downloads'),
    documents: path.join(home, 'Documents'), 'documents folder': path.join(home, 'Documents'), dokumen: path.join(home, 'Documents'), 'folder dokumen': path.join(home, 'Documents'),
    desktop: path.join(home, 'Desktop'), 'desktop folder': path.join(home, 'Desktop'),
    pictures: path.join(home, 'Pictures'), photos: path.join(home, 'Pictures'), 'pictures folder': path.join(home, 'Pictures'), gambar: path.join(home, 'Pictures'), foto: path.join(home, 'Pictures'),
    videos: path.join(home, 'Videos'), 'videos folder': path.join(home, 'Videos'), video: path.join(home, 'Videos'),
    'music folder': path.join(home, 'Music'), 'folder musik': path.join(home, 'Music'),
    'file explorer': 'explorer.exe', explorer: 'explorer.exe', files: 'explorer.exe', 'this pc': 'explorer.exe', 'penjelajah file': 'explorer.exe',
    notepad: 'notepad.exe', calculator: 'calc.exe', calc: 'calc.exe', kalkulator: 'calc.exe', paint: 'mspaint.exe',
    'task manager': 'taskmgr.exe', 'pengelola tugas': 'taskmgr.exe', settings: 'ms-settings:', 'windows settings': 'ms-settings:', pengaturan: 'ms-settings:', setelan: 'ms-settings:',
    'snipping tool': 'snippingtool.exe', 'control panel': 'control.exe', cmd: 'cmd.exe', 'command prompt': 'cmd.exe', terminal: 'wt.exe',
  };
  return table[n] || null;
}

function plain(text) {
  let t = String(text || '').trim().replace(/[‘’]/g, "'");
  t = t.replace(/^(?:(?:hey|hi|ok|okay|yo|halo|hai|eh|woy|oi)[ ,]+)?(?:capri|cappy|kapri|caprie|capree|coppery|copri|cabri|kaprie)?[,!. ]+/i, '');
  for (let i = 0; i < 3; i++) {
    t = t.replace(/^(?:can you|could you|would you|will you|please|just|go ahead and|i want you to|i need you to|tolong|coba|bisa|bisakah|bisa gak|bisa nggak|bisa tolong|minta|aku mau kamu|aku minta|dong|yuk)\s+/i, '');
  }
  t = t.replace(/\s+(?:please|for me|now|thanks|thank you|capri|dong|ya|yah|sekarang|buat aku|untukku|makasih|pls)[.!?]*$/i, '');
  t = t.replace(/^(play|put on|queue|start|open|search|look up|google|find|set|remind|dare|remember|forget|putar|buka|cari|ingat|lupakan)\s*[,;:]\s*/i, '$1 ');
  return t.replace(/^[\s.!?,]+|[\s.!?,]+$/g, '');
}

const number = (word) => {
  const w = String(word).toLowerCase();
  const v = Number(w.replace(',', '.'));
  return Number.isFinite(v) ? v : NUMBERS[w] || 0;
};

// Seconds in "10 minutes", "an hour", "setengah jam", "5 menit"; 0 when there's none.
function length(text) {
  if (/\bhalf an? hour\b|\bsetengah jam\b/i.test(text)) return 1800;
  const m = DURATION.exec(text);
  if (!m) return 0;
  const amount = number(m[1]);
  const unit = m[2].toLowerCase();
  const seconds = /^(h|jam)/.test(unit) ? amount * 3600 : /^(m)/.test(unit) ? amount * 60 : amount;
  return seconds >= 1 && seconds <= 86400 ? seconds : 0;
}

// The next time the clock shows this, today or tomorrow; with no am/pm (or pagi/siang/sore/malam), the nearest.
function nextClock(hour, minute, half, now = new Date()) {
  if (hour > 23 || minute > 59) return null;
  const hours = [];
  const h = String(half || '').toLowerCase();
  if (/^a|pagi/.test(h)) hours.push(hour % 12);
  else if (/^p|siang|sore|malam/.test(h)) hours.push((hour % 12) + 12);
  else if (hour >= 13 || hour === 0) hours.push(hour);
  else hours.push(hour % 12, (hour % 12) + 12);
  let best = null;
  for (const hh of hours) {
    const when = new Date(now);
    when.setHours(hh, minute, 0, 0);
    if (when <= new Date(now.getTime() + 5000)) when.setDate(when.getDate() + 1);
    if (!best || when < best) best = when;
  }
  return best;
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
// a question her eyes answer: about the screen, or a picture, a note, a window, text "here" ("can you see what
// image this?", "read what's in my notes", "gambar apa ini?", "baca tulisan di layar"). Without it her model
// answers blind, and makes something up.
const SEEN = '(?:screen|layar|screenshot|image|picture|photo|pic|foto|gambar|window|jendela|note|notes|notepad|catatan|text|teks|tulisan|document|dokumen|page|halaman|tab)';
const LOOK_ASK = new RegExp([
  String.raw`what am i looking at|look at (?:my|the|this) screen|(?:look|see) (?:at )?my screen|what(?:'s| is) on (?:my|the|this) screen|what (?:do |can )?you see|can you see (?:this|that|my screen|it|what)\b|describe (?:my|the|this) screen|what should i (?:buy|pick|choose|do) here|look at this|check this out`,
  String.raw`\bon (?:my|the) screen\b|\bin my notes?\b`,
  String.raw`(?:see|read|look at|check|describe|tell me about|what(?:'s| is)(?: in| on)?)\s+(?:what(?:'s| is)?\s+)?(?:in |on )?(?:this|that|the|my)\s+${SEEN}`,
  String.raw`(?:see|what) (?:${SEEN})(?: is)? (?:this|that)\b|what does (?:it|this|that|the \w+|my \w+) say|read (?:it|this|that) (?:to me|for me|out)`,
  String.raw`(?:lihat|liat|cek|cekin|baca|bacain|bacakan|jelasin|jelaskan) (?:${SEEN})|(?:${SEEN}) (?:apa )?(?:ini|itu)\b|(?:${SEEN})(?:ku| aku| saya) (?:ada|lagi|isinya) apa|isi (?:${SEEN})|apa (?:isi|tulisan(?:nya)?|yang tertulis)`,
  String.raw`(?:lihat|liat) ini|apa yang (?:kamu|lu|lo) (?:lihat|liat)|apa (?:yang )?(?:ada )?di layar(?:ku)?|kamu (?:bisa )?(?:lihat|liat) (?:layar|ini|itu|gambar|foto)|ini apa(?:an)?\b|apa ini\b`,
].map((p) => `(?:${p})`).join('|'), 'i');

// ---- moving her, by words ("tolong ke kanan", "move left", "ke cursor saya", "berhenti bergelantungan di cursor") ----
const MOVE_CUE = /^(?:pindah|geser|jalan|pergi|move|go|walk|berada|berdiri|stand|duduk|sit|ke|be|stay|diam|minggir|datang|come|get|lari|run|nongkrong|tunggu)\b/;
const MOVES = [
  ['unride', /\b(?:berhenti|stop|jangan|udahan|turun|lepas\w*|get off|hop off)\b.{0,25}\b(?:gelantung\w*|nempel|naik|ride|riding|kursor|cursor|mouse)\b|^(?:hop off|get off|turun(?: dari kursor)?)$/],
  ['ride', /\b(?:naik|nempel|gelantung\w*|bergelantungan|duduk|ikut(?:in)?|ride|perch|hang|numpang|hinggap|bertengger|sit|hop on|get on|jump on|climb on|stay on)\b.{0,20}\b(?:kursor|cursor|mouse|pointer)\b/],
  ['cursor', /\b(?:ke|to|di|by|next to|near|dekat|deket)\s+(?:my |the |your |aku |saya |ku )?(?:kursor|cursor|mouse|pointer|tetikus)(?:ku|mu| aku| saya| ku)?\b|^(?:ke ?sini|sini|come here|datang ke ?sini|come over)$/],
  ['left', /\b(?:samping |sebelah |sisi |pojok |ujung )?kiri\b|\bleft\b/],
  ['right', /\b(?:samping |sebelah |sisi |pojok |ujung )?kanan\b|(?<!\ball |that'?s |is )\bright\b(?!\s+(?:now|away|here|there|back|after|before))/],
  ['center', /\btengah\b|\b(?:center|centre|middle)\b/],
  ['taskbar', /\btaskbar\b/],
  ['top', /\b(?:atas|top)\b/],
];
const MOVE_WORDS = [
  ['here', /^(?:where (?:are|r) (?:you|u)(?: now| right now| at)?|where(?:'d| did) you go|where(?:'s| is) capri|show me where you are|(?:kamu|lu|lo|kau) (?:di ?mana|dmn|ke ?mana)(?: sih| sekarang)?|di ?mana (?:kamu|kau|lu|lo)(?: sekarang)?|(?:di ?mana|dmn|ke ?mana)(?: aja| sih| sekarang| dong)?|kemari(?:lah)?|come to me|over here|datang(?:lah)?(?: kemari| ke aku| ke saya)?|sini(?: dong| deh|lah)?|ke ?sini(?: dong| deh)?)$/],
  ['hide', /^(?:sembunyi(?:lah)?|hide(?: yourself)?|go away|pergi(?: sana)?|ngumpet|minggat)$/],
  ['show', /^(?:muncul(?:lah)?|come back|keluar(?:lah)?|show yourself|balik(?: lagi)?)$/],
  ['sleep', /^(?:tidur(?:lah)?|go to sleep|sleep|bobo|bobok)$/],
  ['wake', /^(?:bangun(?:lah)?|wake up|melek)$/],
  ['dance', /^(?:joget|dance|nari|menari|spin|muter|berputar)\b/],
  ['wave', /^(?:wave|wave at me|wave hi|say hi|lambai(?:kan tangan| tangan)?|melambai|dadah|dada)$/],
  ['bow', /^(?:bow|take a bow|bungkuk|membungkuk|hormat|kasih hormat)$/],
  ['stay', /^(?:diam(?: di (?:situ|sana|sini))?|jangan ke ?mana[- ]?mana|stay(?: (?:there|put|here))?|stop wandering|berhenti jalan[- ]jalan)$/],
  ['wander', /^(?:jalan[- ]jalan(?: dong)?|go wander|explore|keliling|wander(?: around)?)$/],
  ['walk', /^(?:jalan|walk|berjalan|walk around)$/],
  ['home', /^(?:pulang|go home|balik ke pojok|ke pojok(?:mu)?|back to your corner)$/],
];

function moveIn(text) {
  const t = text.replace(/^(?:kamu|you|lu|lo)\s+/, '');
  const word = MOVE_WORDS.find(([, re]) => re.test(t));
  if (word) return word[0];
  const cue = MOVE_CUE.test(t) || t.split(/\s+/).length <= 4;
  const hit = MOVES.find(([move, re]) => (move === 'ride' || move === 'unride' || cue) && re.test(t));
  return hit ? hit[0] : null;
}

// ---- what you're listening to, Spotify searches, a browser of your choice, where a file is ----
// her lyrics (the song's words under her, lyrics.js): on, off, or the line being sung now
// what you want done with her lyrics, from what's in your words, however you put it: a word for lyrics ("lyrics",
// "lirik"), and one for showing ("show", "tampilkan", "munculin", "display"…) or stopping ("stop", "hide", "matikan",
// "berhenti"…), or a question ("apa", "what"). Writing lyrics, what they mean, a long sentence: a chat, not a command.
const LYRIC_WORD = /\b(?:lyrics?|lirik(?:nya)?|lyric(?:nya)?)\b/;
const LYRIC_CHAT = /\b(?:write|make|create|compose|bikin(?:in)?|buat(?:kan|in)?|tulis\w*|karang\w*|mean(?:s|ing)?|arti(?:nya)?|makna\w*|translate|terjemah\w*|about|tentang|favou?rite|favorit\w*|best|terbaik)\b/;
const LYRIC_STOP = /\b(?:hide|stop|turn off|disable|close|remove|no more|enough|matikan|matiin|mati|sembunyi\w*|tutup|berhenti|jangan|hapus|udah(?:an)?|cukup|ilangin|hilangkan|off|nonaktifkan)\b/;
const LYRIC_SHOW = /\b(?:show|display|turn on|enable|put|give|see|view|open|tampil\w*|perlihat\w*|lihat\w*|liat\w*|tunjuk\w*|muncul\w*|nyala\w*|aktifkan|hidupkan|keluar\w*|kasih|buka|on|again|lagi)\b/;
const LYRIC_ASK = /\b(?:what|which|apa|gimana|bagaimana|singing|nyanyi\w*|bilang|sing|said|says|line)\b/;
function lyricsIntent(text) {
  if (!LYRIC_WORD.test(text) || LYRIC_CHAT.test(text) || text.split(/\s+/).length > 12) return null;
  if (LYRIC_STOP.test(text)) return 'hide';
  if (LYRIC_SHOW.test(text)) return 'show';
  if (LYRIC_ASK.test(text)) return 'now';
  return 'show'; // just "lyrics", "lirik dong"
}
// listen along with you: what she makes of the song, and her following it
const LISTEN_ASK = /^(?:(?:let'?s |come )?listen(?: to)?(?: this| it| that)(?: song| track| one)?(?: with me)?|listen with me|(?:ayo |yuk |coba )?(?:dengarkan|dengerin|dengar|denger|simak)(?: deh| bareng| sama aku| juga)? (?:lagu|musik) (?:ini|itu)(?: deh| bareng| sama aku| juga)?|(?:ayo |yuk )?(?:dengerin|dengarkan) bareng(?: aku)?)$/;
const LYRICS_NOW = /^(?:what(?:'s| is| are)(?: the)? (?:lyrics?|line|words)(?: now| right now| here)?|what (?:are|is) (?:they|he|she) (?:singing|saying)(?: now| right now)?|apa lirik(?:nya)?(?: sekarang| barusan)?|lirik(?:nya)?(?: apa| gimana| sekarang| barusan)+|lagi nyanyi(?:in)? apa(?: (?:dia|mereka))?|(?:dia|mereka) (?:nyanyi|bilang) apa(?: barusan)?)$/;
const NOW_PLAYING = /\b(?:lagu apa|what song|what(?:'s| is) playing|what am i listening to|lagi (?:dengerin|dengar|muter|putar|mainin) apa|apa yang (?:aku|lagi|sedang|ku) ?(?:mainin|dengerin|putar|dengar|setel)|lagu yang (?:aku|lagi|sedang) (?:dengerin|dengar|putar|mainin|setel)|(?:liat|lihat|tau|tahu) (?:aku|ku)?\s*(?:lagi )?(?:dengerin|dengar|muter|putar|mainin) apa)\b/;
// her favorite song asked for ("play your favorite song", "putar lagu favoritmu", "setel lagu kesukaan kamu")
const FAVORITE = /^(?:play|put on|putar(?:kan|in)?|puterin|setel(?:in)?|mainkan|nyalain)\s+(?:(?:your|ur|yer)\s+(?:favou?rite|fav|fave)(?:\s+(?:song|track|music|one))?|(?:lagu|musik)\s+(?:favorit|favorite|kesukaan)\s*(?:mu|kamu|lu|lo|capri|nya)|(?:lagu|musik)(?:mu| kamu)\s+(?:yang\s+)?(?:favorit|kesukaan|paling (?:kamu )?suka))\b/i;
// what comes after "play" when it isn't a song: the music already there, a game with her
const NOT_A_SONG = /^(?:(?:my|our)\s+(?:favou?rite|fav|fave)|(?:lagu\s+)?(?:favorit|kesukaan)(?:ku| aku| saya)|it|this|that|ini|itu|lagi|again|music|musik|songs?|lagu(?:nya)?|something|anything|sesuatu|apa aja|next|previous|the next one|a game|games?|game|with me|rock|rps|suit|suwit|janken|tebak|guess|coin|dice|dadu|truth|hide and seek|petak umpet|batu|youtube|spotify)\b/i;
const BROWSERS = { chrome: 'chrome.exe', brave: 'brave.exe', edge: 'msedge.exe', firefox: 'firefox.exe', opera: 'opera.exe' };
const SITES = {
  youtube: 'https://www.youtube.com', google: 'https://www.google.com', gmail: 'https://mail.google.com', github: 'https://github.com',
  facebook: 'https://www.facebook.com', instagram: 'https://www.instagram.com', twitter: 'https://x.com', x: 'https://x.com', tiktok: 'https://www.tiktok.com',
  netflix: 'https://www.netflix.com', reddit: 'https://www.reddit.com', wikipedia: 'https://www.wikipedia.org', chatgpt: 'https://chatgpt.com',
  whatsapp: 'https://web.whatsapp.com', spotify: 'https://open.spotify.com', shopee: 'https://shopee.co.id', tokopedia: 'https://www.tokopedia.com',
  twitch: 'https://www.twitch.tv', discord: 'https://discord.com/app', 'google drive': 'https://drive.google.com', drive: 'https://drive.google.com',
  'youtube music': 'https://music.youtube.com', 'yt music': 'https://music.youtube.com', ytmusic: 'https://music.youtube.com', yt: 'https://www.youtube.com',
  'google maps': 'https://maps.google.com', maps: 'https://maps.google.com', 'google translate': 'https://translate.google.com', translate: 'https://translate.google.com',
  'google docs': 'https://docs.google.com', 'google sheets': 'https://sheets.google.com', 'google calendar': 'https://calendar.google.com', calendar: 'https://calendar.google.com',
  gemini: 'https://gemini.google.com', claude: 'https://claude.ai', 'chat gpt': 'https://chatgpt.com', 'spotify web': 'https://open.spotify.com',
  'whatsapp web': 'https://web.whatsapp.com', wa: 'https://web.whatsapp.com', ig: 'https://www.instagram.com', fb: 'https://www.facebook.com',
  linkedin: 'https://www.linkedin.com', pinterest: 'https://www.pinterest.com', soundcloud: 'https://soundcloud.com', crunchyroll: 'https://www.crunchyroll.com',
  canva: 'https://www.canva.com', notion: 'https://www.notion.so', figma: 'https://www.figma.com', outlook: 'https://outlook.live.com',
  lazada: 'https://www.lazada.co.id', 'github copilot': 'https://github.com/copilot', 'cyberpunk wiki': 'https://cyberpunk.fandom.com',
};
const siteFor = (what) => {
  const w = String(what || '').trim().toLowerCase().replace(/^(?:web(?:site)?|situs|halaman)\s+/, '');
  if (SITES[w]) return SITES[w];
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(w)) return `https://${w}`;
  return null;
};
const FIND = /^(?:di ?mana(?:kah)?|where(?:'s| is| are| did i (?:put|save))|tunjuk(?:kan|in)(?: (?:aku|ke aku|saya))?(?: letak| lokasi| tempat)?|kasih (?:tau|tahu)(?: aku)?(?: letak| lokasi)?|show me(?: where)?|find(?: me)?|cari(?:kan|in)?|lokasi|letak)\s+(?:(?:the|my|letak|lokasi|tempat|si)\s+)?(folder|file|dokumen)?\s*(.{2,60}?)(?:\s+(?:folder|file))?(?:\s*(?:ku|saya|aku|my|nya))?(?:\s+(?:ada|berada|disimpan|di ?mana|is|are))?$/;

// code to write: "buatkan kode python untuk…", "bikin game snake", "write a script that…", "ngoding kalkulator",
// "suruh claude code bikin…" (who: "pakai claude code", "sendiri")
const CODE_ASK = /^(?:(?:suruh|minta|ask|tell)\s+claude(?:\s+code)?\s+(?:to\s+|untuk\s+)?)?(?:(?:tolong|coba|please|bisa|can you|could you)\s+)?(?:(?:buat(?:kan|in)?|bikin(?:in|kan)?|tulis(?:kan|in)?|write|make|create|build|generate|program(?:kan)?|code)\s+(?:me\s+|aku\s+|saya\s+|untukku\s+)?(?:a\s+|an\s+|the\s+|sebuah\s+|satu\s+)?(?:(?:simple|sederhana|small|kecil|quick|cepat)\s+)?(?:(?:python|javascript|js|typescript|html|css|java|c\+\+|c#|php|go|rust|bash|powershell|batch|lua)\s+)?(?:kode|code|script|skrip|program|function|fungsi|class|aplikasi|app|website|web ?page|webpage|halaman(?:s+(?:web|html|website))?|landing page|page|situs|game|bot|kalkulator|calculator|tool|alat|form|formulir|api|server|extension|ekstensi|plugin)\b|(?:ngoding|koding|ngoding(?:in|kan))\b)/;

// "jam berapa?", "what time is it?", "hari apa sekarang?", "tanggal berapa?"
const CLOCK_ASK = /^(?:(?:sekarang )?jam berapa(?: sekarang)?|what(?:'s| is) the time(?: now)?|what time is it(?: now)?|time\?|(?:hari ini|sekarang) hari apa|hari apa (?:ini|sekarang)|what day is (?:it|today)|what(?:'s| is) (?:the date|today'?s date)(?: today)?|(?:hari ini |sekarang )?tanggal berapa(?: (?:hari ini|sekarang))?|what(?:'s| is) today)\??$/;

// A sum asked for: "berapa 25 x 4", "what is 12*7", "hitung 15% dari 200", "100 / 8". { expr, value } or null.
function arithmetic(text) {
  const m = /^(?:berapa|hitung(?:kan|in)?|what(?:'s| is)|calculate|how much is|compute)?\s*(.+?)\s*(?:=|\?)?\s*$/.exec(text);
  if (!m) return null;
  let e = m[1].replace(/,/g, '.').replace(/\s+/g, ' ').trim();
  // "15% dari 200", "15% of 200"
  const pct = /^(\d+(?:\.\d+)?)\s*%\s*(?:dari|of)\s*(\d+(?:\.\d+)?)$/.exec(e);
  if (pct) return { expr: `${pct[1]}% of ${pct[2]}`, value: (Number(pct[1]) / 100) * Number(pct[2]) };
  e = e.replace(/\b(?:x|kali|times)\b|×/g, '*').replace(/\b(?:bagi|divided by)\b|÷|:/g, '/').replace(/\b(?:tambah|plus)\b/g, '+')
    .replace(/\b(?:kurang|minus)\b/g, '-').replace(/\^|\bpangkat\b/g, '**');
  if (!/^[\d\s.+\-*/()]+$/.test(e) || !/\d\s*(?:\*\*|[+\-*/])\s*[(\d.-]/.test(e)) return null; // digits and operators only, and one at least
  let value;
  try {
    value = Function(`"use strict"; return (${e});`)(); // nothing but numbers and + - * / ** ( ) can be in it
  } catch {
    return null;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return { expr: e.replace(/\*\*/g, '^').replace(/\*/g, '×').replace(/\//g, '÷'), value: Math.round(value * 1e8) / 1e8 };
}

function parse(said) {
  const cased = plain(said);
  const text = cased.toLowerCase();
  if (!text) return { kind: 'none' };
  let m;

  if (LOOK_ASK.test(text)) return { kind: 'look', text: String(said).trim() };
  const move = moveIn(text);
  if (move) return { kind: 'move', move };
  const lyricsAsked = lyricsIntent(text);
  if (lyricsAsked) return { kind: 'lyrics', action: lyricsAsked };
  if (LYRICS_NOW.test(text)) return { kind: 'lyrics', action: 'now' };
  if (LISTEN_ASK.test(text)) return { kind: 'listen' };
  if (NOW_PLAYING.test(text)) return { kind: 'nowPlaying' };
  m = CODE_ASK.exec(text);
  if (m) {
    // the whole request is the task (what to write, the language, the details), without asking whom
    const task = cased.replace(/^(?:suruh|minta|ask|tell)\s+claude(?:\s+code)?\s+(?:to\s+|untuk\s+)?/i, '')
      .replace(/\s*(?:,\s*)?(?:pakai|pake|with|using|via|lewat|by)\s+claude(?:\s+code)?\b/i, '')
      .replace(/\s*(?:,\s*)?(?:sendiri|yourself|by yourself|kamu aja)\b/i, '').trim();
    const via = /\bclaude\b/.test(text) ? 'claude' : /\b(?:sendiri|yourself|kamu aja)\b/.test(text) ? 'self' : null;
    return { kind: 'code', task, via };
  }
  if (CLOCK_ASK.test(text)) return { kind: 'clock', what: /tanggal|date|hari apa|what day|day is it|bulan|month|tahun|year/.test(text) ? 'date' : 'time' };
  const sum = arithmetic(text);
  if (sum) return { kind: 'math', ...sum };

  m = /^(?:cari(?:kan|in)?|search(?: for)?|find)\s+(?:lagu\s+|song\s+|musik\s+)?(.{2,80}?)\s+(?:di|on|in)\s+spotify$/i.exec(cased);
  if (m) return { kind: 'spotifySearch', text: m[1].trim() };
  m = /^(?:open|buka(?:kan|in)?|launch)\s+spotify\s*,?\s+(?:and|dan|terus|lalu|then|&)\s+(?:cari(?:kan|in)?|search(?: for)?|find|play|putar|puterin|setel)\s+(?:lagu\s+|song\s+|musik\s+)?(.{2,80})$/i.exec(cased);
  if (m) return { kind: 'spotifySearch', text: m[1].trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, '') };

  m = /^(?:buka(?:kan|in)?|open|launch)\s+(.{2,60}?)\s+(?:di|in|on|pakai|pake|with|lewat)\s+(chrome|brave|edge|firefox|opera)$/i.exec(cased);
  if (m) {
    const url = siteFor(m[1]) || `https://www.google.com/search?q=${encodeURIComponent(m[1].trim())}`;
    return { kind: 'browser', browser: m[2].toLowerCase(), url, text: m[1].trim() };
  }
  m = /^(?:cari(?:kan|in)?|search(?: for)?|google(?:ing)?)\s+(.{2,80}?)\s+(?:di|in|on|pakai|pake|with|lewat)\s+(chrome|brave|edge|firefox|opera)$/i.exec(cased);
  if (m) return { kind: 'browser', browser: m[2].toLowerCase(), url: `https://www.google.com/search?q=${encodeURIComponent(m[1].trim())}`, text: m[1].trim() };

  m = FIND.exec(text);
  if (m && !/^(?:kamu|you|aku|me|capri|lu|lo|dia)$/.test(m[2].trim()) && (m[1] || /^(?:di ?mana|where|tunjuk|kasih|show me|lokasi|letak)/.test(text))) {
    return { kind: 'find', what: m[2].trim(), explicit: Boolean(m[1]) };
  }

  if (LOOK_ASK.test(text)) return { kind: 'look', text: String(said).trim() };
  if (SYNC_ASK.test(text)) return { kind: 'sync' };
  if (DARE_ASK.test(text)) return { kind: 'dare' };
  if (DARE_DONE.test(text) && text.split(/\s+/).length <= 5) return { kind: 'dareDone' };

  if (/^(?:forget (?:everything|all of it|it all|all of that)(?: about me)?|lupakan (?:semua|semuanya|segalanya)(?: tentang aku)?)$/.test(text)) return { kind: 'forgetAll' };
  m = /^(?:forget|remove|delete|erase|drop|lupakan|hapus)\s+(?:about\s+|that\s+|soal\s+|tentang\s+|bahwa\s+)(.{3,80}?)(?:\s+from\s+(?:your\s+|my\s+|the\s+)?(?:memory|notes|brain)|\s+dari\s+(?:ingatan|memori|catatan)(?:mu)?)?$|^(?:forget|lupakan)\s+((?:my|the|our|i|aku|ku)\b.{2,70}?)$/i.exec(cased);
  if (m) {
    const about = (m[1] || m[2] || '').trim();
    if (about && !/^(?:it|that|this|them|me|you|everything|all|itu|ini|semua)$/i.test(about)) return { kind: 'forget', text: about };
  }
  m = /^(?:remember|(?:please )?make a note|don'?t forget|keep in mind|note that|ingat(?:lah)?|inget|catat(?:lah)?|jangan lupa)[,:]?\s+(?:that\s+|this:\s*|bahwa\s+|kalau\s+|kalo\s+)?(?!(?:when|how|what|why|if|where|who|which|kapan|gimana|kenapa|siapa)\b)(.{3,200})$/i.exec(cased);
  if (m && !/^(?:ingat|inget)\s+(?:aku|saya)\s*\??$/i.test(cased)) return { kind: 'remember', text: m[1].trim() };

  if (/^(?:cancel|clear|delete|remove|stop|hapus|batalkan|matikan)\s+(?:all\s+|semua\s+)?(?:my\s+|the\s+)?(?:timers?|alarms?)(?:\s+(?:semua|semuanya))?$/.test(text)) return { kind: 'clearAlarms' };
  if (/^(?:stop|end|cancel|berhenti|hentikan|selesai|stop)\s+(?:the\s+|my\s+)?(?:study|focus|pomodoro|belajar|fokus)/.test(text)) return { kind: 'stopStudy' };
  if (/^(?:start|begin|do|mulai|ayo)\s+(?:a\s+|the\s+|my\s+)?(?:study|focus|pomodoro|belajar|fokus)\b/.test(text)) {
    const focus = length(text);
    return { kind: 'study', seconds: focus >= 60 ? focus : 0 };
  }

  const timerWords = /\b(?:timer|alarm|remind|wake|countdown|ingatkan|ingetin|bangunkan|bangunin|pengingat)/;
  if (/^(?:set|start|make|create|add|put|give me|remind|wake|timer|countdown|alarm|pasang|setel|buat|bikin|atur|ingatkan|ingetin|bangunkan|bangunin)\b/.test(text) && timerWords.test(text)) {
    const seconds = length(text);
    let label = '';
    const l = /\b(?:to|about|untuk|buat|supaya|biar)\s+(.{2,60})$/.exec(text);
    if (l && !/^\d/.test(l[1])) label = l[1].trim();
    if (seconds > 0) return { kind: 'timer', seconds, label };
    const c = /\b(?:at|for|jam|pukul)\s+(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?m\.?|p\.?m\.?|pagi|siang|sore|malam)?(?:\s|$)/.exec(text);
    if (c && (c[2] || c[3] || /\b(?:alarm|wake|bangun|jam|pukul)/.test(text))) {
      const due = nextClock(Number(c[1]), c[2] ? Number(c[2]) : 0, c[3]);
      if (due) return { kind: 'clock', due: due.getTime(), label };
    }
  }

  m = /^(?:play|put on|queue|start|putar|puterin|setel|mainkan)\s+(.{2,80}?)(?:\s+(?:on|in|with|using|from|di|pakai|lewat))?\s+spotify\b.*$|^spotify[,:]?\s+(?:play|putar)\s+(.{2,80})$/i.exec(cased);
  if (m) {
    const song = (m[1] || m[2]).trim().replace(/[^\p{L}\p{N} '&,.!-]/gu, '').trim();
    if (song.length >= 2 && !/^(?:the |some |my )?(?:music|song|songs|something|anything|musik|lagu)$/i.test(song)) return { kind: 'song', text: song };
  }
  // "play your favorite song", "putar lagu favoritmu": hers, not a search for those words
  if (FAVORITE.test(cased)) return { kind: 'song', text: 'In Love With Myself Petite Meller', mine: true };
  // "(can you) play In Love With Myself", "putar lagu Die For You", "setel lagu X dari Y": that song, played
  // on Spotify (its top match), not just looked up. Not "play it again", a game, or YouTube.
  m = /^(?:play|put on|putar(?:kan|in)?|puterin|setel(?:in)?|mainkan|nyalain)\s+(?:(?:the |a |some )?(?:song|track|lagu|musik)\s+)?(.{2,80}?)(?:\s+(?:by|dari|oleh|from)\s+(.{2,40}?))?$/i.exec(cased);
  // ("play me X" is X; "play me some music vibes, I'm happy" isn't a title, nor is a sentence after a comma)
  const asked = m && m[1].trim().replace(/^(?:me|us|for me)\s+/i, '').replace(/^some\s+/i, '');
  if (m && !NOT_A_SONG.test(asked) && !/,\s*(?:i|i'm|im|aku|saya|karena|because|soalnya)\b/i.test(asked) && !/\s(?:on|in|di)\s+(?:youtube|google|bing|duckduckgo)$/i.test(cased)) {
    const song = [asked, m[2]].filter(Boolean).join(' ').replace(/[^\p{L}\p{N} '&,.!-]/gu, '').trim();
    if (song.length >= 2) return { kind: 'song', text: song };
  }
  m = /^(?:search(?: for)?|look up|google|find|play|cari(?:kan)?|carikan|googling|putar|puterin|tonton)\s+(.{2,80}?)(?:\s+(?:on|in|di)\s+(google|youtube|bing|duckduckgo))?$/i.exec(cased);
  if (m && (/^(?:search|look up|google|cari|googling)/.test(text) || (m[2] && /^(?:find|play|putar|puterin|tonton)\b/.test(text)))) {
    const query = m[1].trim().replace(/[^\p{L}\p{N} '&,.!?-]/gu, '').trim();
    const engine = (m[2] || 'google').toLowerCase();
    const base = engine === 'youtube' ? 'https://www.youtube.com/results?search_query=' : engine === 'bing' ? 'https://www.bing.com/search?q=' : engine === 'duckduckgo' ? 'https://duckduckgo.com/?q=' : 'https://www.google.com/search?q=';
    if (query.length >= 2) {
      const video = engine === 'youtube' && /^(?:play|find|putar|puterin|tonton)\b/.test(text);
      return { kind: video ? 'video' : 'web', text: video ? query : `${query} (${engine})`, query, url: base + encodeURIComponent(query) };
    }
  }

  m = /^(?:open|launch|start|run|show me|buka(?:kan|in)?|jalankan|nyalakan)(?: up)?\s+(?:my |the |a |folder )?(.{2,30}?)(?:\s+(?:and|then|,|terus|lalu|dan)\s+(.{3,}))?$/i.exec(text);
  if (m) {
    const wanted = m[1].trim();
    const bare = wanted.replace(/^(?:my|the|folder|file)\s+/, '').replace(/\s+(?:files?|folders?|directory|dir|ku|saya|aku)$/, '').replace(/(?:ku|nya)$/, '');
    const target = place(wanted) || place(`${wanted} folder`) || place(bare) || place(`${bare}s`) || place(`${bare} folder`);
    if (target) return { kind: 'open', text: wanted, target, more: Boolean(m[2]) };
    return { kind: 'app', text: wanted, more: Boolean(m[2]) };
  }

  if (/^(?:pause|stop|hold|jeda|hentikan|stop)(?: the| my)?(?: music| song| track| video| media| playback| audio| musik(?:nya)?| lagu(?:nya)?)$|^(?:pause|jeda)(?: it| dulu)?$/.test(text)) return { kind: 'media', action: 'pause' };
  if (/^(?:resume|unpause|continue|play|lanjutkan|lanjut|putar lagi)(?: the| my)?(?: music| song| track| video| media| playback| audio| musik(?:nya)?| lagu(?:nya)?)$|^(?:resume|unpause|lanjutkan)(?: it)?$/.test(text)) return { kind: 'media', action: 'play' };
  if (/^(?:skip|next|lewati|ganti)(?: this| the)?(?: song| track| one| lagu(?:nya)?)?$|^(?:play )?(?:the )?next (?:song|track)$|^lagu (?:berikut(?:nya)?|selanjutnya)$/.test(text)) return { kind: 'media', action: 'next' };
  if (/^(?:play )?(?:the )?previous (?:song|track)$|^go back (?:a|one) (?:song|track)$|^lagu sebelum(?:nya)?$/.test(text)) return { kind: 'media', action: 'previous' };
  if (/^(?:mute|unmute|bisukan|senyapkan)(?: the| my)?(?: sound| volume| pc| computer| audio| music| suara(?:nya)?)?$/.test(text)) return { kind: 'media', action: 'mute' };
  m = /^(?:(?:turn|make) (?:it|the (?:volume|sound|music))|volume|turn (up|down) the (?:volume|sound|music))\s*(up|down|louder|quieter|softer)?$/.exec(text);
  if (m && (m[1] || m[2])) return { kind: 'media', action: /up|louder/.test(m[1] || m[2]) ? 'volup' : 'voldown' };
  if (/^(?:besarkan|keraskan|naikkan|gedein|kerasin)(?: volume| suara)(?:nya)?$|^volume(?:nya)? (?:naik|naikin|gedein)$/.test(text)) return { kind: 'media', action: 'volup' };
  if (/^(?:kecilkan|pelankan|turunkan|kecilin|pelanin)(?: volume| suara)(?:nya)?$|^volume(?:nya)? (?:turun|turunin|kecilin)$/.test(text)) return { kind: 'media', action: 'voldown' };
  return { kind: 'none' };
}

// "10 minutes", "1 hour 5 min"
function describe(seconds, lang) {
  if (seconds < 60) return lang.count('{0} second|{0} seconds', Math.round(seconds));
  if (seconds < 3600) return lang.count('{0} minute|{0} minutes', Math.round(seconds / 60));
  const h = Math.floor(seconds / 3600);
  const rest = Math.round((seconds - h * 3600) / 60);
  return lang.count('{0} hour|{0} hours', h) + (rest > 0 ? ` ${lang.F('{0} min', rest)}` : '');
}

// The first video for a search, so "play X on YouTube" opens the video itself (one request to youtube.com).
async function firstVideo(query) {
  try {
    const res = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'accept-language': 'en-US,en;q=0.9',
        cookie: 'SOCS=CAI',
      },
      signal: AbortSignal.timeout(8000),
    });
    const html = (await res.text()).slice(0, 3000000);
    return /"videoRenderer":\{"videoId":"([\w-]{11})"/.exec(html)?.[1] || null;
  } catch {
    return null;
  }
}

module.exports = { parse, canon, sensitive, describe, firstVideo, dareCategory, checkDare, friendly, DARES, length, nextClock, plain, place, siteFor, BROWSERS };

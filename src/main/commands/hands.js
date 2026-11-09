'use strict';

// What she does in your other apps: typing, keys, a button by its name, writing code and drafts.

const { plain, politely } = require('./words');

// ---- what you're listening to, Spotify searches, a browser of your choice, where a file is ----
// Typing for you in another app ("type hello tiktok", "ketik halo di notepad", "tulis selamat pagi ke chat", "type
// print('hi') in vscode"): the text as you said it (its case, its quotes), and where (an app she knows by name, or
// the window you were in: "the chat", nothing). "write"/"tulis" only with a place: "write a script…" is code.
const TYPE_APPS = String.raw`notepad\s*\+\+|note ?pad|catatan|vs ?code|visual studio code|antigravity|cursor|windsurf|(?:google )?chrome|(?:microsoft )?edge|firefox|opera(?: gx)?|brave|discord|whatsapp|telegram|slack|(?:microsoft )?teams|(?:microsoft )?word|(?:microsoft )?excel|(?:microsoft )?powerpoint|(?:windows )?terminal|cmd|command prompt|(?:windows )?powershell|obsidian|notion|(?:the |kolom |kotak )?chat(?:nya| box)?|(?:the )?(?:app|window|aplikasi|jendela)(?: ini| itu| in front| di depan)?`;
const TYPE_ASK = new RegExp(String.raw`^(?:(?:please|tolong|coba)\s+)?(?:type|ketik(?:kan|in)?|tuliskan|tulisin|(?:write|tulis)(?=[\s\S]+\s(?:in|into|on|di|ke|dalam)\s+(?:the\s+)?(?:${TYPE_APPS})\s*$))[.,:;!]?(?!\s+(?:of|\d)\b)\s+(?:out\s+)?([\s\S]{1,2000}?)(?:\s+(?:in|into|on|to|di|ke|pada|dalam)\s+(?:the\s+)?(${TYPE_APPS}))?\s*$`, 'i');
const WINDOW_WORDS = /^(?:(?:the |kolom |kotak )?chat(?:nya| box)?|(?:the )?(?:app|window|aplikasi|jendela)(?: ini| itu| in front| di depan)?)$/i;
// Code written right where you are, in the editor in front ("write simple html here", "buatkan kode python di sini",
// "add a login form in vscode", "can you write HTML right here, a basic website"): her model writes it, and she
// pastes it in (life.js codeHere). Not typed as you said it, and not a file of her own (that's "code" without "here").
// The speech recognizer's spellings of the languages first ("@stml" is HTML).
const CODE_SPELLINGS = [
  [/(?:@|\bat\s?)s?\s?t\s?m\s?l\b|\bh\.?\s?t\.?\s?m\.?\s?l\b|\bhdml\b|\bhtlm\b|\bhtml\b/gi, 'HTML'],
  [/\bjava\s+script\b/gi, 'JavaScript'], [/\btype\s+script\b(?=.*\b(?:code|component|function|file|interface|here|di ?sini)\b)/gi, 'TypeScript'],
  [/\b(?:pie\s?thon|phyton|pyton|paiton)\b/gi, 'Python'], [/\bc\s?s\s?s\b/gi, 'CSS'], [/\bjay\s?son\b|\bj\s?son\b/gi, 'JSON'], [/\bsequel\b|\bs\s?q\s?l\b/gi, 'SQL'],
];
const codeSpelled = (t) => CODE_SPELLINGS.reduce((s, [re, to]) => s.replace(re, to), String(t || ''));
const CODE_HERE_WHERE = new RegExp(String.raw`\b(?:right here|in here|here|di ?sini|di file ini|ke file ini|in(?:to)? this file|in(?:to)? (?:the |my )?editor|di editor|ke editor|in(?:to)? (?:the )?(?:${TYPE_APPS})|di (?:${TYPE_APPS})|ke (?:${TYPE_APPS}))\b`, 'i');
const CODE_THING = /\b(?:code|kode|koding|html|css|javascript|typescript|python|java|c\+\+|c#|php|sql|json|yaml|bash|powershell|script|skrip|function|fungsi|class|component|komponen|website|web ?page|webpage|landing page|page|halaman|form|formulir|login|navbar|button|tombol|tabel|table|loop|program|regex|query|api|endpoint|game|kalkulator|calculator|template|boilerplate)\b/i;
const CODE_VERB = /^(?:write|code|make|create|build|generate|add|put|insert|implement|give me|buat\w*|bikin\w*|tulis\w*|tambah\w*|kasih|ketik\w*|type)\b/i;
// a literal "type html here" / "ketik 'print'" stays typing: generating needs a thing to make ("a basic website",
// "simple html", "kode python", "a function that…")
const CODE_MAKE = /\b(?:a|an|some|simple|basic|sederhana|contoh|example|sample|full|lengkap|template|kode|code|website|web ?page|landing page|page|halaman|form|formulir|function|fungsi|script|skrip|program|component|komponen|game|class)\b/i;
function codeHereAsk(said) {
  const raw = politely(plain(said)).trim();
  if (/["“”'‘’`]/.test(raw)) return null; // quoted: those words, typed as they are
  const t = codeSpelled(raw);
  if (!CODE_VERB.test(t) || !CODE_THING.test(t) || !CODE_HERE_WHERE.test(t)) return null;
  if (/^(?:type|ketik\w*)\b/i.test(t) && !CODE_MAKE.test(t.replace(/^\S+\s+/, ''))) return null;
  const app = new RegExp(String.raw`\b(?:in(?:to)?|di|ke)\s+(?:the\s+)?(${TYPE_APPS})\b`, 'i').exec(t)?.[1]?.toLowerCase().replace(/\s+/g, ' ') || '';
  const task = t.replace(/\s*(?:,\s*)?\b(?:right here|in here|here|di ?sini)\b\s*,?/gi, ' ').replace(/\s+(?:to|for) me\b/gi, '').replace(/\s+/g, ' ').trim();
  return { kind: 'code', task, via: 'here', here: true, target: app && !WINDOW_WORDS.test(app) ? app : '' };
}

// Something to be written for you, not typed as you said it ("write an email to my boss saying I'm sick", "tuliskan
// surat lamaran kerja di notepad", "draft a tweet about cats"): her model drafts it, you see it, and she types it
// when you say so (life.js 'draft'). A kind of text is named; a song's words stay in her chat, code has its own.
const DRAFT_KINDS = String.raw`(?:e-?mail|letter|cover letter|message|text message|text|tweet|post|caption|poem|story|short story|paragraph|essay|reply|response|note|bio|description|summary|speech|toast|apology|invitation|announcement|review|article|status|thank[- ]you note|surat(?: lamaran(?: kerja)?| izin| resmi| pengunduran diri)?|pesan|puisi|pantun|cerita|cerpen|paragraf|esai|balasan|ucapan(?: [a-z]+)?|undangan|pengumuman|ringkasan|deskripsi|pidato|artikel|permintaan maaf|kata sambutan)`;
const DRAFT_ASK = new RegExp(String.raw`^(?:(?:please|tolong|coba)\s+)?(?:write|draft|compose|prepare|buat(?:kan|in)?|bikin(?:in|kan)?|tulis(?:kan|in)?|karang(?:kan)?|susun(?:kan)?|siapkan)\s+(?:me\s+|aku\s+|saya\s+|untukku\s+|for me\s+)?(?:an?\s+|the\s+|some\s+|sebuah\s+|satu\s+)?(?:(?:short|long|quick|formal|casual|nice|sweet|funny|polite|professional|singkat|pendek|panjang|resmi|santai|lucu|sopan|romantis|romantic)\s+)*${DRAFT_KINDS}\b([\s\S]{0,400}?)(?:\s+(?:in|into|on|di|ke|dalam)\s+(?:the\s+)?(${TYPE_APPS}))?\s*[.!]?$`, 'i');
function draftAsk(said) {
  const raw = politely(said).trim();
  const m = DRAFT_ASK.exec(raw);
  if (!m) return null;
  const where = (m[2] || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const task = (m[2] ? raw.slice(0, raw.length - m[0].length + m[0].lastIndexOf(m[2])).replace(/\s+(?:in|into|on|di|ke|dalam)\s+(?:the\s+)?$/i, '') : raw).trim();
  return { kind: 'draft', task, target: where && !WINDOW_WORDS.test(where) ? where : '' };
}

function typeAsk(said) {
  // "…here", "…di sini": the window you're in (nothing to type of it)
  const raw = politely(said).replace(/\s+(?:right here|in here|here|di ?sini)\s*([.!?]*)$/i, '$1');
  let m = TYPE_ASK.exec(raw);
  if (!m) return null;
  // "…in notepad." (a spoken sentence's full stop): the place is still the place
  if (!m[2] && /[.!]+$/.test(raw)) {
    const again = TYPE_ASK.exec(raw.replace(/\s*[.!]+$/, ''));
    if (again?.[2]) m = again;
  }
  const words = m[1].trim();
  const quoted = /^["'“”‘’](.*)["'“”‘’]$/s.exec(words);
  const text = quoted ? quoted[1] : words.replace(/(?<!\.)\.$/, '');
  if (!text) return null;
  const where = (m[2] || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return { kind: 'type', text, target: where && !WINDOW_WORDS.test(where) ? where : '' };
}

// a key to press in the app you're in ("press enter", "kirim", "save it", "pilih semua")
const KEY_ASK = [
  ['enter', /^(?:(?:press|hit|tekan|pencet)\s+)?(?:the\s+)?(?:enter|return)(?:\s+key)?$|^(?:send|kirim)(?:\s+(?:it|that|aja|sekarang|pesan(?:nya| ini)?|chat(?:nya)?))?$/],
  ['save', /^(?:save|simpan)(?:\s+(?:it|that|the file|file(?:nya)?|aja|sekarang))?$/],
  ['selectall', /^(?:select all|pilih semua|blok semua)$/],
  ['undo', /^(?:undo(?: that)?|batalkan(?: itu)?)$/],
  ['newline', /^(?:new line|baris baru)$/],
  ['tab', /^(?:(?:press|tekan)\s+)?tab$/],
];
function keyAsk(text) {
  const hit = KEY_ASK.find(([, re]) => re.test(text));
  return hit ? { kind: 'key', key: hit[0] } : null;
}

// A button pressed by its name ("click the Send button", "klik tombol Kirim", "pencet tombol OK", "click Save in notepad"):
// in the window you were in or the app you named (life.js, click.ps1). "press enter" is a key, not a button; "klik kanan" isn't a name.
const CLICK_ASK = new RegExp(String.raw`^(?:(?:click|tap|press|hit|klik|pencet|tekan)\s+(?:(?:on|the|that|at|pada)\s+)*(?:button|tombol)\s+(.{1,40}?)|(?:click|tap|press|hit|klik|pencet|tekan)\s+(?:(?:on|the|that|at|pada)\s+)*(.{1,40}?)\s+(?:button|tombol)|(?:click|tap|klik)\s+(?:(?:on|the|that|at|pada)\s+)*(.{1,40}?))(?:\s+(?:in|on|at|di|pada|dalam)\s+(?:the\s+)?(${TYPE_APPS}))?\s*[.!]?$`, 'i');
function clickAsk(said) {
  const m = CLICK_ASK.exec(politely(plain(said)));
  if (!m) return null;
  const name = (m[1] || m[2] || m[3]).trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, '');
  if (!name || /^(?:kanan|kiri|right|left|double|dua kali|here|di ?sini|this|that|it|ini|itu)\b/i.test(name)) return null;
  const where = (m[4] || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return { kind: 'click', name, target: where && !WINDOW_WORDS.test(where) ? where : '' };
}

// code to write: "buatkan kode python untuk…", "bikin game snake", "write a script that…", "ngoding kalkulator",
// "suruh claude code bikin…" (who: "pakai claude code", "sendiri")
const CODE_ASK = /^(?:(?:suruh|minta|ask|tell)\s+claude(?:\s+code)?\s+(?:to\s+|untuk\s+)?)?(?:(?:tolong|coba|please|bisa|can you|could you)\s+)?(?:(?:buat(?:kan|in)?|bikin(?:in|kan)?|tulis(?:kan|in)?|write|make|create|build|generate|program(?:kan)?|code)\s+(?:me\s+|aku\s+|saya\s+|untukku\s+)?(?:a\s+|an\s+|the\s+|sebuah\s+|satu\s+)?(?:(?:simple|sederhana|small|kecil|quick|cepat)\s+)?(?:(?:python|javascript|js|typescript|html|css|java|c\+\+|c#|php|go|rust|bash|powershell|batch|lua)\s+)?(?:kode|code|script|skrip|program|function|fungsi|class|aplikasi|app|website|web ?page|webpage|halaman(?:s+(?:web|html|website))?|landing page|page|situs|game|bot|kalkulator|calculator|tool|alat|form|formulir|api|server|extension|ekstensi|plugin)\b|(?:ngoding|koding|ngoding(?:in|kan))\b)/;

function code({ cased, text }) {
  let m;
  m = CODE_ASK.exec(text);
  if (m) {
    // the whole request is the task (what to write, the language, the details), without asking whom
    const task = cased.replace(/^(?:suruh|minta|ask|tell)\s+claude(?:\s+code)?\s+(?:to\s+|untuk\s+)?/i, '')
      .replace(/\s*(?:,\s*)?(?:pakai|pake|with|using|via|lewat|by)\s+claude(?:\s+code)?\b/i, '')
      .replace(/\s*(?:,\s*)?(?:sendiri|yourself|by yourself|kamu aja)\b/i, '').trim();
    const via = /\bclaude\b/.test(text) ? 'claude' : /\b(?:sendiri|yourself|kamu aja)\b/.test(text) ? 'self' : null;
    return { kind: 'code', task, via };
  }
  return null;
}

const commands = {
  codeHere: ({ said }) => codeHereAsk(said),
  draft: ({ said }) => draftAsk(said),
  type: ({ said }) => typeAsk(said),
  click: ({ said }) => clickAsk(said),
  key: ({ text }) => keyAsk(text),
  code,
};

module.exports = { commands, CODE_THING, codeSpelled };

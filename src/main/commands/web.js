'use strict';

// Browsers, sites, searches, where a file is, and opening things by name.

const { place } = require('./places');

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

function browserOpen({ cased }) {
  let m;
  m = /^(?:buka(?:kan|in)?|open|launch)\s+(.{2,60}?)\s+(?:di|in|on|pakai|pake|with|lewat)\s+(chrome|brave|edge|firefox|opera)$/i.exec(cased);
  if (m) {
    const url = siteFor(m[1]) || `https://www.google.com/search?q=${encodeURIComponent(m[1].trim())}`;
    return { kind: 'browser', browser: m[2].toLowerCase(), url, text: m[1].trim() };
  }
  return null;
}

function browserSearch({ cased }) {
  let m;
  m = /^(?:cari(?:kan|in)?|search(?: for)?|google(?:ing)?)\s+(.{2,80}?)\s+(?:di|in|on|pakai|pake|with|lewat)\s+(chrome|brave|edge|firefox|opera)$/i.exec(cased);
  if (m) return { kind: 'browser', browser: m[2].toLowerCase(), url: `https://www.google.com/search?q=${encodeURIComponent(m[1].trim())}`, text: m[1].trim() };
  return null;
}

function find({ text }) {
  let m;
  m = FIND.exec(text);
  if (m && !/^(?:kamu|you|aku|me|capri|lu|lo|dia)$/.test(m[2].trim()) && (m[1] || /^(?:di ?mana|where|tunjuk|kasih|show me|lokasi|letak)/.test(text))) {
    return { kind: 'find', what: m[2].trim(), explicit: Boolean(m[1]) };
  }
  return null;
}

function search({ cased, text }) {
  let m;
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
  return null;
}

function open({ text }) {
  let m;
  m = /^(?:open|launch|start|run|show me|fire up|boot up|buka(?:kan|in)?|jalankan|nyala(?:kan|in))(?: up)?\s+(?:my |the |a |folder )?(.{2,30}?)(?:\s+(?:and|then|,|terus|lalu|dan)\s+(.{3,}))?$/i.exec(text);
  if (m) {
    const wanted = m[1].trim();
    const bare = wanted.replace(/^(?:my|the|folder|file)\s+/, '').replace(/\s+(?:files?|folders?|directory|dir|ku|saya|aku)$/, '').replace(/(?:ku|nya)$/, '');
    const target = place(wanted) || place(`${wanted} folder`) || place(bare) || place(`${bare}s`) || place(`${bare} folder`);
    if (target) return { kind: 'open', text: wanted, target, more: Boolean(m[2]) };
    return { kind: 'app', text: wanted, more: Boolean(m[2]) };
  }
  return null;
}

const commands = {
  browserOpen,
  browserSearch,
  find,
  search,
  open,
};

module.exports = { commands, siteFor, BROWSERS, firstVideo };

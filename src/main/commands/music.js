'use strict';

// What's playing: the song itself, her lyrics, what she thinks of it, Spotify, the media keys.

// The song playing, handled (life.js, through Windows' media session): next, previous, repeat, shuffle, back to the
// start, a jump forward or back. Checked before "play X", which would take "putar ulang lagu ini" for a song to find.
const SONG_CONTROLS = [
  ['repeat-off', /^(?:stop (?:repeating|looping)|(?:turn |switch )?(?:repeat|loop)(?:ing)? off|(?:turn|switch) off (?:the )?(?:repeat|loop)|no (?:more )?(?:repeat|loop)(?:ing)?|(?:matikan|matiin|stop|berhenti|udahan|jangan) (?:repeat|loop|ngulang|mengulang|ulang(?:-ulang|i)?)(?: lagu(?:nya)?(?: ini)?)?|jangan diulang(?:-ulang)?(?: lagi)?)$/],
  ['repeat-all', /^(?:(?:repeat|loop) (?:all|everything|the (?:playlist|album|queue)|(?:my |this )?playlist|semua(?:nya)?)|ulang(?:i)? (?:semua(?:nya)?|playlist(?:nya)?|album(?:nya)?))$/],
  ['repeat-one', /^(?:(?:repeat|loop)(?: (?:this|the|that|current))?(?: (?:song|track|one))?(?: (?:on|again|forever|terus))?|put (?:this|it|the song) on (?:repeat|loop)|(?:ulang-ulang|repeat|loop|ulang(?:i)? terus)(?: lagu(?:nya)?(?: ini)?)?(?: terus)?|(?:putar|setel) (?:terus|berulang)(?: lagu(?:nya)?(?: ini)?)?)$/],
  ['shuffle-off', /^(?:(?:turn |switch )?(?:off|stop) (?:the )?shuffl(?:e|ing)|shuffle off|stop shuffling|no (?:more )?shuffle|(?:matikan|matiin|stop|jangan) (?:shuffle|acak(?:-acak)?|diacak)(?: lagu(?:nya)?)?|jangan (?:di)?acak(?: lagi)?)$/],
  ['shuffle-on', /^(?:shuffle(?: (?:on|it|the (?:songs|playlist|music)|my (?:music|playlist)))?|(?:turn|switch) on (?:the )?shuffle|(?:acak|acakin|shuffle) (?:lagu(?:nya)?|playlist(?:nya)?|musik(?:nya)?)|putar acak|(?:nyalakan|nyalain|aktifkan) (?:shuffle|acak))$/],
  ['play', /^(?:play|putar(?:kan)?|setel|nyalain|nyalakan|mainkan)(?: (?:some|the|my))? (?:music|musik|lagu|song)(?:nya)?(?: dong| lagi)?$/],
  ['restart', /^(?:restart(?: (?:the|this) (?:song|track))?|(?:play|start) (?:it|this(?: song)?|the song) (?:from the (?:start|beginning|top)|over|again from the (?:start|beginning))|from the (?:start|beginning|top)|start (?:it |this song )?over|putar ulang(?: lagu(?:nya)?(?: ini)?)?|ulangi lagu(?:nya)?(?: ini)?|(?:ulang|mulai|putar) (?:lagi )?dari awal(?: lagi)?|dari awal(?: lagi)?)$/],
  ['next', /^(?:next(?: one| song| track| lagu)?|skip(?: it| this(?: one)?| lagu(?:nya)?(?: ini)?)?|(?:play )?(?:the )?next (?:one|song|track)|another (?:song|one)|ganti lagu(?:nya)?(?: lain)?|lagu lain|(?:putar |lanjut(?: ke)? )?lagu (?:berikut(?:nya)?|selanjutnya)|lewati(?: lagu(?:nya)?(?: ini)?)?)$/],
  ['previous', /^(?:prev(?:ious)?(?: one| song| track)?|(?:play |go back to )?(?:the )?(?:previous|last) (?:one|song|track)(?: again)?|back to the (?:previous|last) (?:song|track)|go back (?:a|one) (?:song|track)|(?:putar |balik(?: ke)? |kembali(?: ke)? )?lagu (?:sebelum(?:nya)?|tadi|yang tadi))$/],
];
const SEEK = /^(?:(?:skip|forward|fast forward|jump|go)(?: ahead| forward)?|maju(?:in|kan)?|lompat|majuin)(?: lagu(?:nya)?)?(?: (\d{1,3}) ?(?:s|sec|secs|seconds?|detik|dtk))?(?: (?:ahead|forward))?$|^(?:rewind|go back|jump back|back|mundur(?:in|kan)?)(?: lagu(?:nya)?)?(?: by)?(?: (\d{1,3}) ?(?:s|sec|secs|seconds?|detik|dtk))?$/;
function songControl(text) {
  for (const [action, re] of SONG_CONTROLS) if (re.test(text)) return { kind: 'media', action };
  const m = SEEK.exec(text);
  // a jump needs a number ("go back" alone is something else), or a word for a bit: ten seconds
  if (m && (m[1] || m[2])) return { kind: 'media', action: 'seek', seconds: m[1] ? Number(m[1]) : -Number(m[2]) };
  const soft = /^(maju|mundur|skip ahead|rewind|forward)(?: lagu(?:nya)?)? (?:sedikit|dikit|a bit|a little)$/.exec(text);
  return soft ? { kind: 'media', action: 'seek', seconds: /mundur|rewind/.test(soft[1]) ? -10 : 10 } : null;
}

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
// what she thinks of the song playing ("do you like this song?", "kamu suka lagu ini?", "bagus gak lagunya"): about that
// song, never her own favorite
const SONG_OPINION = /^(?:(?:do|did|don'?t) (?:you|u|ya) (?:like|love|dig|enjoy|hate)(?: this| the| that| my) (?:song|track|tune|music|one)(?: playing| now| right now)?|(?:you|u) (?:like|love|hate)(?: this| the| that) (?:song|track|music)|what(?:'s| is| do) (?:you(?:r)?|ur) (?:think|thoughts?|opinion|take|verdict)(?: of| on| about)?(?: this| the| that| my) (?:song|track|music|one)(?: playing| now)?|how do you (?:like|feel about)(?: this| the| that) (?:song|track|music)|is (?:this|the|that) (?:song|track|music) (?:good|any good|bad|okay|ok|nice|cool)|(?:rate|judge) (?:this|the|that|my) (?:song|track|music)|thoughts on (?:this|the|that) (?:song|track|music)|(?:apa )?(?:kamu|lu|lo|km|capri)? ?(?:suka|seneng|demen|benci|cinta)(?: (?:gak|nggak|ngga|ga|enggak|tidak))?(?: (?:sama|dengan|ama))? (?:lagu|musik)(?:nya| ini| itu| yang (?:lagi |sedang )?(?:diputar|aku dengerin|main))(?: (?:gak|nggak|ngga|ga|enggak|tidak|kah))?|(?:gimana|bagaimana) (?:menurut ?(?:mu|kamu|lu|lo) )?(?:lagu|musik) ?(?:nya|ini|itu)|(?:menurut ?(?:mu|kamu|lu|lo)|pendapat ?(?:mu|kamu)(?: (?:tentang|soal|sama))?) (?:lagu|musik) ?(?:nya|ini|itu)(?: (?:gimana|bagaimana|bagus|enak|apa))?|(?:lagu|musik) ?(?:nya|ini|itu) (?:bagus|enak|keren|jelek|oke|asik|seru)(?: (?:gak|nggak|ngga|ga|enggak|tidak|kah|ya|kan))?|(?:bagus|enak|keren|jelek|oke|asik) (?:gak|nggak|ngga|ga|enggak|tidak) (?:lagu|musik) ?(?:nya|ini|itu))$/;
const NOW_PLAYING = /\b(?:lagu apa|what song|what(?:'s| is) playing|what am i listening to|lagi (?:dengerin|dengar|muter|putar|mainin) apa|apa yang (?:aku|lagi|sedang|ku) ?(?:mainin|dengerin|putar|dengar|setel)|lagu yang (?:aku|lagi|sedang) (?:dengerin|dengar|putar|mainin|setel)|(?:liat|lihat|tau|tahu) (?:aku|ku)?\s*(?:lagi )?(?:dengerin|dengar|muter|putar|mainin) apa)\b/;
// her favorite song asked for ("play your favorite song", "putar lagu favoritmu", "setel lagu kesukaan kamu")
const FAVORITE = /^(?:play|put on|putar(?:kan|in)?|puterin|setel(?:in)?|mainkan|nyalain)\s+(?:(?:your|ur|yer)\s+(?:favou?rite|fav|fave)(?:\s+(?:song|track|music|one))?|(?:lagu|musik)\s+(?:favorit|favorite|kesukaan)\s*(?:mu|kamu|lu|lo|capri|nya)|(?:lagu|musik)(?:mu| kamu)\s+(?:yang\s+)?(?:favorit|kesukaan|paling (?:kamu )?suka))\b/i;
// what comes after "play" when it isn't a song: the music already there, a game with her
const NOT_A_SONG = /^(?:(?:my|our)\s+(?:favou?rite|fav|fave)|(?:lagu\s+)?(?:favorit|kesukaan)(?:ku| aku| saya)|it|this|that|ini|itu|lagi|again|music|musik|songs?|lagu(?:nya)?|something|anything|sesuatu|apa aja|next|previous|the next one|a game|games?|game|with me|rock|rps|suit|suwit|janken|tebak|guess|coin|dice|dadu|truth|hide and seek|petak umpet|batu|youtube|spotify)\b/i;

function lyrics({ text }) {
  const lyricsAsked = lyricsIntent(text);
  if (lyricsAsked) return { kind: 'lyrics', action: lyricsAsked };
  return null;
}

function songControlled({ text }) {
  const control = songControl(text);
  if (control) return control;
  return null;
}

function lyricsNow({ text }) {
  if (LYRICS_NOW.test(text)) return { kind: 'lyrics', action: 'now' };
  return null;
}

function listen({ text }) {
  if (LISTEN_ASK.test(text)) return { kind: 'listen' };
  return null;
}

function songOpinion({ text }) {
  if (SONG_OPINION.test(text)) return { kind: 'songOpinion' };
  return null;
}

function nowPlaying({ text }) {
  if (NOW_PLAYING.test(text)) return { kind: 'nowPlaying' };
  return null;
}

function spotifySearch({ cased }) {
  let m;
  m = /^(?:cari(?:kan|in)?|search(?: for)?|find)\s+(?:lagu\s+|song\s+|musik\s+)?(.{2,80}?)\s+(?:di|on|in)\s+spotify$/i.exec(cased);
  if (m) return { kind: 'spotifySearch', text: m[1].trim() };
  m = /^(?:open|buka(?:kan|in)?|launch)\s+spotify\s*,?\s+(?:and|dan|terus|lalu|then|&)\s+(?:cari(?:kan|in)?|search(?: for)?|find|play|putar|puterin|setel)\s+(?:lagu\s+|song\s+|musik\s+)?(.{2,80})$/i.exec(cased);
  if (m && !/^(?:some |the |my )?(?:music|musik|lagu|songs?|something|sesuatu)(?:nya)?$/i.test(m[1].trim())) return { kind: 'spotifySearch', text: m[1].trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, '') };
  return null;
}

function songOnSpotify({ cased }) {
  let m;
  m = /^(?:play|put on|queue|start|putar|puterin|setel|mainkan)\s+(.{2,80}?)(?:\s+(?:on|in|with|using|from|di|pakai|lewat))?\s+spotify\b.*$|^spotify[,:]?\s+(?:play|putar)\s+(.{2,80})$/i.exec(cased);
  if (m) {
    const song = (m[1] || m[2]).trim().replace(/[^\p{L}\p{N} '&,.!-]/gu, '').trim();
    if (song.length >= 2 && !/^(?:the |some |my )?(?:music|song|songs|something|anything|musik|lagu)$/i.test(song)) return { kind: 'song', text: song };
  }
  return null;
}

function favorite({ cased }) {
  // "play your favorite song", "putar lagu favoritmu": hers, not a search for those words
  if (FAVORITE.test(cased)) return { kind: 'song', text: 'In Love With Myself Petite Meller', mine: true };
  return null;
}

function playSong({ cased }) {
  let m;
  // "(can you) play In Love With Myself", "putar lagu Die For You", "setel lagu X dari Y": that song, played
  // on Spotify (its top match), not just looked up. Not "play it again", a game, or YouTube.
  m = /^(?:play|put on|putar(?:kan|in)?|puterin|setel(?:in)?|mainkan|nyalain(?=\s+(?:the |a |some )?(?:song|track|lagu|musik)\s))\s+(?:(?:the |a |some )?(?:song|track|lagu|musik)\s+)?(.{2,80}?)(?:\s+(?:by|dari|oleh|from)\s+(.{2,40}?))?$/i.exec(cased);
  // ("play me X" is X; "play me some music vibes, I'm happy" isn't a title, nor is a sentence after a comma)
  const asked = m && m[1].trim().replace(/^(?:me|us|for me)\s+/i, '').replace(/^some\s+/i, '');
  if (asked && /^(?:and|dan|lalu|terus|then)\b/i.test(asked)) return null; // "play and repeat…": commands, not a title
  if (m && !NOT_A_SONG.test(asked) && !/,\s*(?:i|i'm|im|aku|saya|karena|because|soalnya)\b/i.test(asked) && !/\s(?:on|in|di)\s+(?:youtube|google|bing|duckduckgo)$/i.test(cased)) {
    const song = [asked, m[2]].filter(Boolean).join(' ').replace(/[^\p{L}\p{N} '&,.!-]/gu, '').trim();
    if (song.length >= 2) return { kind: 'song', text: song };
  }
  return null;
}

// a volume with a number: "up spotify volume to 100", "volume spotify 50", "besarkan volume ke 80"
const LEVEL = /^(?:(?:up|raise|increase|lower|set|turn|change|put|naikkan|naikin|besarkan|gedein|kerasin|turunkan|kecilkan|kecilin|atur|ubah|bikin|setel)\s+)?(?:(?:the|my)\s+)?(?:(?:spotify|music|musik|lagu)\s+)?(?:volume|suara)(?:nya)?(?:\s+(?:spotify|musik|lagu))?(?:\s+(?:up|down))?(?:\s+(?:to|at|ke|jadi|di))?\s+(\d{1,3})\s*(?:%|persen|percent)?$/;

function mediaKeys({ text }) {
  if (/^(?:play|putar(?:kan)?|setel(?:in)?)$/.test(text)) return { kind: 'media', action: 'play' }; // just "play": what was paused
  let m = LEVEL.exec(text);
  if (m) return { kind: 'volumeLevel', level: Math.min(100, Number(m[1])) };
  if (/^(?:up|raise|increase|naikkan|naikin|besarkan|gedein|kerasin)\s+(?:the\s+|my\s+)?spotify\s+(?:volume|suara)$/.test(text)) return { kind: 'media', action: 'volup' };
  if (/^(?:down|lower|decrease|turunkan|turunin|kecilkan|kecilin|pelankan)\s+(?:the\s+|my\s+)?spotify\s+(?:volume|suara)$/.test(text)) return { kind: 'media', action: 'voldown' };
  if (/^(?:pause|stop|hold|jeda|hentikan|stop)(?: the| my)?(?: music| song| track| video| media| playback| audio| musik(?:nya)?| lagu(?:nya)?)$|^(?:pause|jeda)(?: it| dulu)?$/.test(text)) return { kind: 'media', action: 'pause' };
  if (/^(?:resume|unpause|continue|play|lanjutkan|lanjut|putar lagi)(?: the| my)?(?: music| song| track| video| media| playback| audio| musik(?:nya)?| lagu(?:nya)?)$|^(?:resume|unpause|lanjutkan)(?: it)?$/.test(text)) return { kind: 'media', action: 'play' };
  if (/^(?:skip|next|lewati|ganti)(?: this| the)?(?: song| track| one| lagu(?:nya)?)?$|^(?:play )?(?:the )?next (?:song|track)$|^lagu (?:berikut(?:nya)?|selanjutnya)$/.test(text)) return { kind: 'media', action: 'next' };
  if (/^(?:play )?(?:the )?previous (?:song|track)$|^go back (?:a|one) (?:song|track)$|^lagu sebelum(?:nya)?$/.test(text)) return { kind: 'media', action: 'previous' };
  if (/^(?:mute|unmute|bisukan|senyapkan)(?: the| my)?(?: sound| volume| pc| computer| audio| music| suara(?:nya)?)?$/.test(text)) return { kind: 'media', action: 'mute' };
  if (/^(?:louder|lebih (?:keras|kencang)|kerasin|gedein)$/.test(text)) return { kind: 'media', action: 'volup' };
  if (/^(?:quieter|softer|lebih (?:pelan|kecil)|pelanin|kecilin)$/.test(text)) return { kind: 'media', action: 'voldown' };
  m = /^(?:(?:turn|make) (?:it|the (?:volume|sound|music))|volume|turn (up|down) the (?:volume|sound|music))\s*(up|down|louder|quieter|softer)?$/.exec(text);
  if (m && (m[1] || m[2])) return { kind: 'media', action: /up|louder/.test(m[1] || m[2]) ? 'volup' : 'voldown' };
  if (/^(?:besarkan|keraskan|naikkan|gedein|kerasin)(?: volume| suara)(?:nya)?$|^volume(?:nya)? (?:naik|naikin|gedein)$/.test(text)) return { kind: 'media', action: 'volup' };
  if (/^(?:kecilkan|pelankan|turunkan|kecilin|pelanin)(?: volume| suara)(?:nya)?$|^volume(?:nya)? (?:turun|turunin|kecilin)$/.test(text)) return { kind: 'media', action: 'voldown' };
  return null;
}

// one of what she just found on Spotify ("putar nomor 2", "play number 3")
const PICK = /^(?:play|putar(?:kan|in)?|puterin|setel(?:in)?)\s+(?:the\s+)?(?:number|nomor|no\.?|yang(?:\s+nomor)?)\s*(\d{1,2})$/i;
function pick({ text }) {
  const m = PICK.exec(text);
  return m ? { kind: 'songPick', n: Number(m[1]) } : null;
}

// Your own playlists, through your Spotify developer app: "putar playlist chill", "play my workout playlist", "daftar playlist aku"
function playlist({ text }) {
  let m = /^(?:play|put on|putar(?:kan|in)?|puterin|setel(?:in)?|mainkan)\s+(?:(?:my|our|the)\s+)?playlist(?:ku|nya)?(?:\s+(?:aku|saya|kita|punyaku|punya aku|punya kita))?(?:\s+(.{1,60}))?$/.exec(text);
  if (m) return { kind: 'playlist', text: (m[1] || '').trim() };
  m = /^(?:play|put on)\s+(?:my|our|the)\s+(.{1,60}?)\s+playlist$/.exec(text);
  if (m) return { kind: 'playlist', text: m[1].trim() };
  if (/^(?:(?:daftar|list|lihat|tampilkan|show)(?: me)? (?:semua |all )?(?:my |our )?playlists?(?:ku| aku| saya| kita)?|playlist(?:ku| aku| saya| kita) (?:apa (?:aja|saja)|ada apa)|what playlists? do (?:i|we) have)$/.test(text)) return { kind: 'playlistList' };
  return null;
}

const commands = {
  playlist,
  pick,
  lyrics,
  songControl: songControlled,
  lyricsNow,
  listen,
  songOpinion,
  nowPlaying,
  spotifySearch,
  songOnSpotify,
  favorite,
  playSong,
  mediaKeys,
};

module.exports = { commands };

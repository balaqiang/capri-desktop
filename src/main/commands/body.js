'use strict';

// Moving her by words: to the left, on your cursor, a dance.

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

function move({ text }) {
  const move = moveIn(text);
  if (move) return { kind: 'move', move };
  return null;
}

// her shapes, by words (renderer/js/forms.js)
const FORM_ASK = [
  ['spark', /^(?:(?:jadi|berubah jadi|become|turn into|be)\s+)(?:a\s+)?(?:spark|percikan|bola listrik)$/i],
  ['glitch', /^(?:(?:jadi|berubah jadi|become|turn into|be)\s+)(?:a\s+)?glitch$|^glitch(?: out)?$/i],
  ['shards', /^(?:(?:jadi|berubah jadi|become|turn into|be)\s+)(?:shards|serpihan|pecahan)$/i],
  ['silhouette', /^(?:(?:jadi|berubah jadi|become|turn into|be)\s+)(?:a\s+)?(?:silhouette|shadow|bayangan|siluet)$/i],
];
function form({ text }) {
  const t = text.replace(/[.!]+$/, '');
  const hit = FORM_ASK.find(([, re]) => re.test(t));
  return hit ? { kind: 'form', form: hit[0] } : null;
}

const commands = {
  form,
  move,
};

module.exports = { commands };

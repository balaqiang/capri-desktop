'use strict';

// What her eyes answer: a question about your screen, and homework on it.

const { plain, politely } = require('./words');

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

// Homework on your screen: "saya punya pekerjaan rumah, tolong jawabkan pertanyaan yang ada di layar saya", "solve
// the math problems on my screen", "kerjakan soal ini", "help me with this homework": she looks (one screenshot and
// its text), and answers each question (chat.js, the homework look). A question written out in the message itself
// ("answer this: what is 2+2") is a chat.
const HOMEWORK_VERB = /\b(?:answer|solve|do|work out|complete|finish|check|help(?: me)?(?: with| solve| answer| do)?|explain|jawab\w*|kerja\w*|selesai\w*|bantu\w*|hitung\w*|isi\w*|cek\w*|periksa\w*|jelaskan|jelasin|terangkan)\b/i;
const HOMEWORK_THING = /\b(?:questions?|answers?|jawaban\w*|problems?|homework|home work|assignment|exercises?|quiz|test|exam|math|maths|equations?|sums|worksheet|soal\w*|pertanyaan\w*|pr\b|pekerjaan rumah|tugas\w*|latihan\w*|ulangan|ujian|kuis|matematika|mtk|persamaan|hitungan)\b/i;
const HOMEWORK_PLACE = /\b(?:screen|layar\w*|monitor|on (?:it|there)|here|di ?sini|di situ|this|these|that|those|ini|itu|tersebut|yang ada|in front|di depan)\b/i;
const HOMEWORK_OWN = /\b(?:homework|home work|assignment|worksheet|pekerjaan rumah|pr\b|tugas(?:ku| saya| aku)?)\b/i;
function homeworkAsk(said) {
  const t = politely(plain(said));
  if (!HOMEWORK_VERB.test(t) || !HOMEWORK_THING.test(t)) return null;
  // the question is in the message (after a colon, or a sum in it): her chat answers it
  if (/:\s*\S.{8,}/.test(t) || /\d\s*[-+*/x×÷^=]\s*\d/.test(t)) return null;
  if (!HOMEWORK_PLACE.test(t) && !HOMEWORK_OWN.test(t)) return null;
  return { kind: 'look', text: String(said).trim(), task: 'homework' };
}

function look({ said, text }) {
  // "perbaiki tulisan ini: aku pergi…": what it's about is in your message, not on your screen
  if (LOOK_ASK.test(text) && !/:\s*\S.{8,}/.test(text)) return { kind: 'look', text: String(said).trim() };
  return null;
}

const commands = {
  homework: ({ said }) => homeworkAsk(said),
  look,
};

module.exports = { commands };

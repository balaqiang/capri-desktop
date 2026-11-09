'use strict';

// Game, focus, quiet mode: she goes down to her mask until you call her.

// Her modes for when you need her out of the way: game mode, focus mode, quiet mode (down to her mask, not a word
// until you call her), and back to normal ("normal mode"; "wake up" too). The renderer holds her (capri.holdIn).
const HOLD_ASK = [
  ['off', /^(?:(?:turn off|stop|exit|end|leave|matikan|keluar(?: dari)?|selesai(?:kan)?|akhiri) (?:the )?(?:mode )?(?:game|gaming|focus|fokus|study|belajar|quiet|silent|senyap|diam|do not disturb)(?: mode)?|(?:game|gaming|focus|study|quiet|silent|do not disturb) mode off|mode (?:game|gaming|fokus|focus|belajar|diam|senyap|tenang|hening) (?:off|mati|selesai|udahan)|normal mode|mode normal|back to normal|kembali normal|(?:i'?m |aku |saya )?(?:(?:udah|sudah) )?(?:done|udah|sudah|selesai) (?:gaming|playing|main(?: game)?|nge-?game|fokus|focusing|belajar)|udahan (?:main(?: game)?|nge-?game|fokus|belajar))$/i],
  ['game', /^(?:(?:turn on|start|enter|nyalakan|aktifkan|masuk(?: ke)?) )?(?:(?:game|gaming) mode|mode (?:game|gaming|main game|nge-?game))(?: on)?$|^(?:i'?m|i am) (?:going to play|gaming|playing a game)(?: now)?$|^(?:aku|saya) (?:mau|lagi) (?:main game|nge-?game)(?: dulu)?$/i],
  ['focus', /^(?:(?:turn on|start|enter|nyalakan|aktifkan|masuk(?: ke)?) )?(?:(?:focus|study) mode|mode (?:fokus|focus|belajar))(?: on)?$|^(?:i need to|let me|i have to|i want to|i wanna) focus(?: now)?$|^(?:aku|saya) (?:mau|perlu|harus) fokus(?: dulu)?$/i],
  ['quiet', /^(?:do not disturb(?: mode)?|don'?t disturb(?: me)?|(?:turn on )?(?:quiet|silent) mode|mode (?:diam|senyap|tenang|hening)|jangan ganggu(?: aku| saya)?(?: dulu)?|diam dulu)$/i],
];
function holdAsk(text) {
  const t = String(text || '').trim().replace(/[.!?]+$/, '');
  const hit = HOLD_ASK.find(([, re]) => re.test(t));
  return hit ? { kind: 'hold', mode: hit[0] } : null;
}

const commands = {
  hold: ({ text }) => holdAsk(text),
};

module.exports = { commands };

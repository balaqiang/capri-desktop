// How her AI moves her body ([[move: wave]] in its answers, chat.js) and what it learns about doing it
// well, from you, as you go: how often you want her to move (not every answer), which moves you like after
// which moods, and how big you like them. A move gets credit when you laugh, say something nice or pet her
// right after; it loses it when you tell her to stop moving, call it too much, or grab her mid-move. What
// she has learned goes back into her prompt (hint), so her AI's picks get better, and decides how big each
// move is played on her rig (amp). Kept in her settings (motionLearn), across restarts.

const GOOD = /\b(?:ha(?:ha)+|he(?:he)+|wk(?:wk)+|lol|lmao|lucu|gemes|gemas|cute|nice|keren|mantap|bagus|love (?:it|that|this)|adorable|imut|so good|cakep)\b|😂|🤣|😆|❤|😍|🥰/i;
const BAD = /\b(?:stop (?:moving|dancing|that|it)|don'?t move|jangan (?:gerak|joget|goyang)|diam(?: aja| dong)?|berhenti (?:gerak|joget|goyang)|too much|annoying|ganggu|lebay|kebanyakan gerak|norak|cringe)\b/i;
const LESS = /\b(?:move less|less moving|fewer moves|jangan (?:terlalu )?banyak gerak|kurangi gerak(?:an)?(?:nya)?|gerak(?:nya)? (?:dikit|sedikit) aja)\b/i;
const MORE = /\b(?:move more|more moves|lebih banyak gerak|gerak(?:nya)? lebih banyak|lebih aktif|lebih ekspresif)\b/i;
const NONE = /\b(?:no (?:more )?moves|stop moving (?:at all|completely)|jangan gerak sama sekali|(?:gak|ga|nggak|ngga) usah gerak)\b/i;
const AGAIN = /\b(?:you can move again|move again|boleh gerak lagi|gerak lagi aja)\b/i;

const GAP = { start: 3, min: 2, max: 10 }; // answers between two of her moves, at least
const AMP = { min: 0.5, max: 1.2 };          // how big a move is played (1: as drawn)
const WINDOW_MS = 90 * 1000;                 // what you do this long after a move still says something about it
const GRAB_MS = 4000;                        // grabbing her this soon after a move: you wanted it over

const fresh = () => ({ gap: GAP.start, off: false, moves: {}, moods: {} });
const score = (s) => ((s?.good || 0) + 1) / ((s?.good || 0) + (s?.bad || 0) + 2); // 0.5 when nothing's known

export class Motion {
  constructor({ host }) {
    this.host = host;
    this.s = fresh();
    this.last = null;  // { move, mood, at }: her last move, waiting for what you make of it
    this.since = 99;   // answers since her last move
    this.saveTimer = 0;
  }

  load(saved) {
    if (!saved || typeof saved !== 'object') return;
    this.s = { ...fresh(), ...saved, moves: { ...(saved.moves || {}) }, moods: { ...(saved.moods || {}) } };
    this.saved = JSON.stringify(this.s);
  }

  // Your message: what it says about her last move (when it's recent), and about her moving at all.
  heard(text) {
    const t = String(text || '');
    if (NONE.test(t)) {
      this.s.off = true;
      this.judge(-1);
    } else if (AGAIN.test(t)) {
      this.s.off = false;
      this.s.gap = Math.min(this.s.gap, 4);
    } else if (LESS.test(t)) {
      this.s.gap = Math.min(GAP.max, this.s.gap + 2);
      this.judge(-1);
    } else if (MORE.test(t)) {
      this.s.off = false;
      this.s.gap = Math.max(GAP.min, this.s.gap - 1);
    } else if (BAD.test(t)) {
      this.judge(-1);
    } else if (GOOD.test(t)) {
      this.judge(1);
    }
    this.last = null; // one message says what it says about a move; after that it's old news
    this.save();
  }

  // Something you did to her: 'pet' (you liked it), 'grab' (right after a move: you wanted it to stop).
  sign(kind) {
    if (!this.last) return;
    if (kind === 'pet') this.judge(1);
    if (kind === 'grab' && performance.now() - this.last.at < GRAB_MS) this.judge(-1);
    this.save();
  }

  // The verdict on her last move, if it's recent: the move, the move in that mood, how big, how often.
  judge(sign) {
    const last = this.last;
    if (!last || performance.now() - last.at > WINDOW_MS) return;
    this.last = null;
    const key = sign > 0 ? 'good' : 'bad';
    const m = (this.s.moves[last.move] ||= { used: 0, good: 0, bad: 0, amp: 1 });
    const c = (this.s.moods[`${last.mood}:${last.move}`] ||= { good: 0, bad: 0 });
    m[key]++;
    c[key]++;
    m.amp = Math.min(AMP.max, Math.max(AMP.min, (m.amp || 1) * (sign > 0 ? 1.05 : 0.85)));
    this.s.gap = Math.min(GAP.max, Math.max(GAP.min, this.s.gap + (sign > 0 ? -0.25 : 1)));
  }

  // An answer of hers went by (her moves are spaced in answers).
  answered() {
    this.since++;
  }

  // Her AI asked for `move` in this mood: does she do it? Not if you've asked her not to move, not if
  // she moved too few answers ago, not a move you keep turning down (in that mood, or at all).
  allow(move, mood = 'none') {
    if (this.s.off || this.since < Math.round(this.s.gap)) return false;
    const m = this.s.moves[move];
    const c = this.s.moods[`${mood}:${move}`];
    if (c && c.good + c.bad >= 2 && score(c) < 0.34) return false;
    if (m && m.good + m.bad >= 3 && score(m) < 0.3) return false;
    return true;
  }

  played(move, mood = 'none') {
    const m = (this.s.moves[move] ||= { used: 0, good: 0, bad: 0, amp: 1 });
    m.used++;
    this.last = { move, mood, at: performance.now() };
    this.since = 0;
    this.save();
  }

  // how big to play it on her rig: bolder the more you liked it, subtler the more you didn't
  amp(move) {
    return this.s.moves[move]?.amp || 1;
  }

  // What she's learned, for her AI's prompt: how often, what went over well where, what didn't.
  hint() {
    if (this.s.off) return 'The user asked you not to move your body: never write a [[move: …]] tag, until they say you can move again.';
    const lines = [`Move rarely: at most one reply in ${Math.round(this.s.gap)} gets a move, most replies have none.`];
    const liked = Object.entries(this.s.moods)
      .filter(([, c]) => c.good >= 2 && score(c) >= 0.65)
      .sort((a, b) => score(b[1]) - score(a[1]))
      .slice(0, 5)
      .map(([k]) => { const [mood, move] = k.split(':'); return mood === 'none' ? move : `${move} when ${mood}`; });
    const disliked = Object.entries(this.s.moves)
      .filter(([, m]) => m.bad >= 2 && score(m) < 0.35)
      .map(([move]) => move);
    if (liked.length) lines.push(`What the user liked so far: ${liked.join(', ')}.`);
    if (disliked.length) lines.push(`What the user didn't like (don't use): ${disliked.join(', ')}.`);
    return lines.join(' ');
  }

  // into her settings, a moment later, when something changed
  save() {
    const now = JSON.stringify(this.s);
    if (now === this.saved) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saved = now;
      this.host.setConfig({ motionLearn: this.s });
    }, 1500);
  }
}

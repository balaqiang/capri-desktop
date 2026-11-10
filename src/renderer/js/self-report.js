// What she is doing, in words, for her AI: so that "kamu lagi apa" gets the truth about what you can see on your screen. Only her own state
// goes in here, never the title or contents of a window of yours.

const FORMS = { spark: 'a spark', shards: 'a burst of shards', glitch: 'a glitch', silhouette: 'a black silhouette' };

function spotOf(c) {
  const id = c.perch?.id;
  if (id === 'taskbar') return 'the taskbar';
  return id === c.windows?.fg ? 'the window they are using right now' : 'one of their windows';
}

// -> [key, words]. model: the drawing she's in, if any (rig.js).
export function activityOf(c, model = null) {
  if (c.stowed) return ['stowed', 'tucked away in your biochip, with no body on screen, only your voice'];
  if (c.hidden) return ['hidden', 'hiding, not on their screen at all'];
  if (c.dormant) return ['dormant', 'dozing, down to just your head'];
  if (c.dragging) return ['held', 'being carried around by their mouse pointer'];
  if (c.riding) return ['riding', 'riding on their mouse pointer'];
  if (c.form) return [`form:${c.form}`, `out of your usual body, turned into ${FORMS[c.form] || c.form}`];
  if (c.stance === 'fall') return ['fall', 'falling'];
  if (c.walking) return ['walk', 'walking along the bottom of their screen'];
  if (c.stance === 'peek') return [`peek:${c.peekSide}`, `peeking in from the ${c.peekSide || 'side'} edge of their screen`];
  if (c.stance === 'sit' && c.perch) {
    const spot = spotOf(c);
    const key = `${c.perch.pose || 'sit'}:${c.perch.id}`;
    if (c.mode === 'sleep') return [`nap:${c.perch.id}`, `asleep on top of ${spot}, arms hanging down`];
    switch (c.perch.pose) {
      case 'lounge': return [key, `lying back on top of ${spot}, one foot dangling, watching them`];
      case 'peek': return [key, `peeking over the top of ${spot}, only your head showing, spying on them`];
      case 'cling': return [key, `hanging from the ${c.perch.side || ''} side of ${spot}, holding on to its edge`];
      default: return [key, `sitting on top of ${spot}, one leg hanging over it, watching them`];
    }
  }
  if (c.mode === 'sleep') return ['sleep', 'asleep at the bottom of their screen'];
  if (model === 'lean') return ['lounge:floor', 'lying back at the bottom of their screen, one foot dangling, watching them'];
  return ['stand', 'standing at the bottom of their screen, watching them'];
}

const MODES = {
  work: 'An AI coding tool is working on something for them, and you are keeping an eye on it.',
  alert: 'Something needs their attention, and you are trying to get it.',
};

// What she's been up to, for "before this".
export class BodyDiary {
  constructor(keep = 3) {
    this.keep = keep;
    this.key = null;
    this.words = '';
    this.since = 0;
    this.earlier = [];
  }

  // Worth a look every few seconds, and before answering.
  note([key, words], now) {
    if (key === this.key) {
      this.words = words;
      return;
    }
    if (this.key) this.earlier = [this.words, ...this.earlier.filter((w) => w !== this.words)].slice(0, this.keep);
    this.key = key;
    this.words = words;
    this.since = now;
  }

  minutes(now) {
    return Math.floor((now - this.since) / 60000);
  }
}

// Is this about what she's doing or how she is? Only then does her AI get told: with it there all the time, a small model answers everything with it.
const ABOUT_HER = /\b(?:lagi|sedang) (?:apa|ngapain|di ?mana)\b|\bngapain\b|\bkamu (?:lagi|sedang|di ?mana|capek|ngantuk|tidur|bangun|gimana)\b|\bapa kabar\b|\bmood(?:mu| kamu)\b|\bwhat(?:'s| are| r) (?:you|u) (?:doing|up to)\b|\bwhere (?:are|r) (?:you|u)\b|\bhow (?:are|r) (?:you|u)\b|\bare you (?:asleep|awake|tired|sleeping|busy|there)\b/i;
export const asksAboutHer = (text) => ABOUT_HER.test(String(text || ''));

// The part of her prompt about herself. feeling: { mood, emotion, sync } as she has them now.
export function bodyContext(c, diary, { mood = '', emotion = '', sync = null, now = 0 } = {}) {
  const lines = [`- Right now you are ${diary.words}${diary.minutes(now) >= 2 ? `, for about ${diary.minutes(now)} minutes now` : ''}.`];
  if (MODES[c.mode]) lines.push(`- ${MODES[c.mode]}`);
  if (c.hearing) lines.push('- You are listening to their voice this very moment.');
  if (mood) lines.push(`- Your mood today: ${mood}.`);
  if (emotion) lines.push(`- What you feel this moment: ${emotion}.`);
  if (Number.isFinite(sync)) lines.push(`- How close the two of you are (Sync): ${Math.round(sync)}%.`);
  if (diary.earlier.length) lines.push(`- A little earlier you were: ${diary.earlier.join('; ')}.`);
  return `YOUR BODY RIGHT NOW (this is true, and it is what they can see on their screen). They are asking about you: answer from this in one short line of your own words. Do not repeat this text and never mention modes or lists. Never claim to be doing something that is not here.\n${lines.join('\n')}`;
}

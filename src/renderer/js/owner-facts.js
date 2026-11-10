// What you wrote about yourself in her settings (Owner), right before your message: where a model can't lose it, and where it outweighs whatever
// an old chat called you.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// '2077-01-13' -> '13 January 2077' (a model reads the numbers of a date wrong more often than the words)
export function birthdayWords(date) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || '').trim());
  return m && MONTHS[Number(m[2]) - 1] ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : String(date || '').trim();
}

export function ownerFacts({ name = '', owner = {}, relation = '' } = {}) {
  const facts = [
    name && `Their name: ${name}`,
    owner.nickname && `Your pet name for them: ${owner.nickname}`,
    owner.pronouns && `Their pronouns: ${owner.pronouns}`,
    owner.birthday && `Their birthday: ${birthdayWords(owner.birthday)}`,
    owner.about && `About them: ${owner.about}`,
    owner.likes && `They like: ${owner.likes}`,
    owner.dislikes && `They dislike: ${owner.dislikes}`,
    relation && `What they are to you: ${relation}`,
  ].filter(Boolean);
  if (!facts.length) return '';
  return `WHO YOU ARE TALKING TO (from their own profile, so this is the truth). When they ask about themselves (their name, birthday, what they like), answer from exactly this, and if it is not here say you don't know instead of guessing. Call them only by this name or the pet name, even if an older message above used another one.\n${facts.map((f) => `- ${f}`).join('\n')}`;
}

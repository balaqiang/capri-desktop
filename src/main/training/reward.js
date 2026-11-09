'use strict';

// What went over well and what didn't. Each answer of hers is kept with what you said before it (on this PC, in her memory's
// database), and earns or loses points from what happens next: you pet her, you laugh, you say "good answer"; you correct her,
// you ask the same thing again. The good ones become what her local model can be trained on (dataset.js).

const WINDOW = 3 * 60000; // what you do after this long isn't about that answer

const LIKED = /\b(?:haha+|hehe+|wkwk+|lol|lmao|nice|great|cool|awesome|thanks|thank you|love it|mantap|keren|bagus|lucu|makasih|terima ?kasih|sip|asik)\b/i;
const CORRECTED = /^(?:no\b|nope\b|wrong\b|that'?s (?:wrong|not)|not what i|bukan\b|salah\b|kok gitu|ngaco|apaan sih|jangan gitu|maksudku bukan|bukan itu)/i;

const fold = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

function createReward({ db, now = Date.now }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS exchanges (
      id INTEGER PRIMARY KEY, at INTEGER NOT NULL, user TEXT NOT NULL, answer TEXT NOT NULL, model TEXT,
      score REAL NOT NULL DEFAULT 0, verdict INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS exchanges_score ON exchanges(verdict, score);
  `);
  const latest = () => db.prepare('SELECT id, at, user FROM exchanges ORDER BY id DESC LIMIT 1').get();
  const fresh = () => {
    const last = latest();
    return last && now() - last.at <= WINDOW ? last : null;
  };
  const add = (id, points) => db.prepare('UPDATE exchanges SET score = score + ? WHERE id = ?').run(points, id);

  return {
    // What you say next says something about her last answer.
    react(text) {
      const last = fresh();
      if (!last) return;
      if (CORRECTED.test(String(text).trim())) add(last.id, -2);
      else if (fold(text) && fold(text) === fold(last.user)) add(last.id, -1); // asked again: it didn't land
      else if (LIKED.test(text)) add(last.id, 1);
    },
    // You and her answer, once it's over.
    add(user, answer, model = '') {
      if (!String(user).trim() || !String(answer).trim()) return;
      db.prepare('INSERT INTO exchanges(at, user, answer, model) VALUES (?, ?, ?, ?)').run(now(), String(user).slice(0, 2000), String(answer).slice(0, 4000), String(model));
    },
    // a pat right after an answer
    pet() {
      const last = fresh();
      if (last) add(last.id, 1);
    },
    // "good answer", "jawabanmu salah": -> whether there was an answer to rate
    rateLast(points) {
      const last = fresh();
      if (!last) return false;
      add(last.id, points);
      return true;
    },
    // Your word on one, from her settings: 1 keep, -1 never, 0 undecided.
    judge(id, verdict) {
      return db.prepare('UPDATE exchanges SET verdict = ? WHERE id = ?').run(Math.sign(Number(verdict) || 0), id).changes > 0;
    },
    // Best first, the ones you haven't decided on.
    toReview(limit = 20) {
      return db.prepare('SELECT id, user, answer, score FROM exchanges WHERE verdict = 0 AND score <> 0 ORDER BY ABS(score) DESC, id DESC LIMIT ?').all(limit).map((r) => ({ ...r }));
    },
    // What may be trained on: what you kept, what did well and you didn't throw out.
    good(minScore = 1) {
      return db.prepare('SELECT user, answer FROM exchanges WHERE verdict = 1 OR (verdict = 0 AND score >= ?) ORDER BY id').all(minScore).map((r) => ({ ...r }));
    },
    counts() {
      const row = db.prepare('SELECT COUNT(*) AS total, SUM(verdict = 1) AS kept, SUM(verdict = -1) AS thrown, SUM(verdict = 0 AND score >= 1) AS liked FROM exchanges').get();
      return { total: row.total || 0, kept: row.kept || 0, thrown: row.thrown || 0, liked: row.liked || 0 };
    },
    clear() {
      db.exec('DELETE FROM exchanges');
    },
  };
}

module.exports = { createReward, WINDOW };

'use strict';

// What she remembers, and what comes back to her for what you just said: words and meaning together. Short term (what's
// going on for you, fades in a day), long term (facts about you, every word you said to her), episodes (what a day was
// like, a few sentences each). The whole of it stays on this PC.

const crypto = require('node:crypto');

const WORKING_TTL = 24 * 3600000;
const WORKING_MAX = 12;
const NEAR_ENOUGH = 0.42;    // cosine distance: further than this isn't about the same thing
const RRF = 60;              // how results from words and from meaning are merged
const HOUR = 3600000;

const keyOf = (s) => crypto.createHash('sha1').update(String(s).toLowerCase().replace(/\s+/g, ' ').trim()).digest('hex').slice(0, 24);

// Said about right now, not a question and not a command: "besok aku ujian", "I'm working on my thesis".
const NOW_CUE = /\b(?:hari ini|malam ini|besok|lusa|nanti|lagi|sedang|baru (?:saja|aja)|today|tonight|tomorrow|right now|this week|minggu ini|i'?m (?:working|studying|going|trying|about)|aku (?:mau|akan|harus)|saya (?:mau|akan|harus))\b/i;
const IS_ASKING = /\?\s*$|^(?:who|what|why|how|when|where|which|is|are|do|does|did|can|could|would|will|siapa|apa|apakah|kenapa|mengapa|bagaimana|gimana|kapan|di ?mana|berapa|tolong|coba|bisa)\b/i;
const workingNote = (text) => {
  const t = String(text || '').trim();
  return t.length >= 12 && t.length <= 160 && NOW_CUE.test(t) && !IS_ASKING.test(t) ? t : '';
};

// The words of a question as a full text search: each stem as the start of a word, any of them.
function ftsQuery(text, tokens) {
  return [...new Set(tokens(text))].slice(0, 24).map((t) => `"${t.replace(/"/g, '')}"*`).join(' OR ');
}

// deps: { db, vectors, tokens(text), embed(texts) -> Promise<number[][] | null>, model() -> name | null, ask(messages), now() }
function createMemory({ db, vectors, tokens, embed = async () => null, model = () => null, ask = null, now = Date.now }) {
  const insert = db.prepare(`INSERT INTO items(space, key, text, meta, importance, created, expires) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(space, key) WHERE key IS NOT NULL DO UPDATE SET text = excluded.text, meta = excluded.meta, expires = excluded.expires, embedded = CASE WHEN items.text = excluded.text THEN items.embedded ELSE 0 END`);

  function put(space, text, { key = keyOf(text), meta = null, importance = 0.5, expires = 0 } = {}) {
    const clean = String(text || '').trim();
    if (!clean) return;
    insert.run(space, key, clean, meta ? JSON.stringify(meta) : null, importance, now(), expires);
  }

  function removeWhere(where, ...params) {
    const rows = db.prepare(`SELECT id FROM items WHERE ${where}`).all(...params);
    for (const { id } of rows) vectors.remove(id);
    db.prepare(`DELETE FROM items WHERE ${where}`).run(...params);
    return rows.length;
  }

  const expire = () => removeWhere('expires > 0 AND expires < ?', now());

  // Hybrid search over some spaces. -> [{ id, space, text, meta, score, words, close }] best first; nothing it isn't really about.
  async function search(query, { spaces, limit = 6 } = {}) {
    expire();
    const placeholders = spaces.map(() => '?').join(',');
    const scored = new Map();
    const add = (row, rank, field) => {
      const entry = scored.get(row.id) || { ...row, score: 0 };
      entry.score += 1 / (RRF + rank);
      entry[field] = true;
      scored.set(row.id, entry);
    };
    const match = ftsQuery(query, tokens);
    if (match) {
      const rows = db.prepare(`SELECT items.id, items.space, items.text, items.meta, items.importance, items.created, items.uses FROM items_fts JOIN items ON items.id = items_fts.rowid
        WHERE items_fts MATCH ? AND space IN (${placeholders}) ORDER BY bm25(items_fts) LIMIT ?`).all(match, ...spaces, limit * 4);
      rows.forEach((row, i) => add(row, i, 'words'));
    }
    const name = model();
    if (name && vectors.model === name) {
      const [vector] = (await embed([query])) || [];
      if (vector) {
        const near = vectors.nearest(vector, limit * 6).filter((r) => r.distance <= NEAR_ENOUGH);
        const get = db.prepare(`SELECT id, space, text, meta, importance, created, uses FROM items WHERE id = ? AND space IN (${placeholders})`);
        let rank = 0;
        for (const { id } of near) {
          const row = get.get(id, ...spaces);
          if (row) add(row, rank++, 'close');
        }
      }
    }
    const t = now();
    const results = [...scored.values()].map((r) => {
      const ageDays = (t - r.created) / (24 * HOUR);
      return { ...r, meta: r.meta ? JSON.parse(r.meta) : null, score: r.score * (1 + r.importance * 0.3 + Math.min(r.uses, 10) * 0.01 + 0.1 * 0.5 ** (ageDays / 30)) };
    }).sort((a, b) => b.score - a.score).slice(0, limit);
    const touch = db.prepare('UPDATE items SET used = ?, uses = uses + 1 WHERE id = ?');
    for (const r of results) touch.run(t, r.id);
    return results;
  }

  return {
    put,
    search,
    keyOf,

    // Your notes in her settings are the truth: what's in the list is here, what's gone from it is gone.
    syncFacts(list) {
      const wanted = new Map(list.map((f) => [keyOf(f), f]));
      const have = db.prepare("SELECT id, key FROM items WHERE space = 'fact'").all();
      for (const { id, key } of have) {
        if (wanted.has(key)) wanted.delete(key);
        else {
          vectors.remove(id);
          db.prepare('DELETE FROM items WHERE id = ?').run(id);
        }
      }
      for (const fact of wanted.values()) put('fact', fact, { importance: 0.8 });
    },

    // A message of yours, kept; said about right now, it goes in her short term memory too.
    addTurn(role, text, { day = '' } = {}) {
      if (role !== 'user') return;
      const t = String(text || '').trim();
      if (t.length < 8 || t.length > 2000) return;
      put('chat', t, { meta: { day: day || new Date(now()).toISOString().slice(0, 10) }, importance: 0.3 });
      const note = workingNote(t);
      if (note) {
        put('working', note, { importance: 0.7, expires: now() + WORKING_TTL });
        const extra = db.prepare("SELECT id FROM items WHERE space = 'working' ORDER BY created DESC LIMIT -1 OFFSET ?").all(WORKING_MAX);
        for (const { id } of extra) {
          vectors.remove(id);
          db.prepare('DELETE FROM items WHERE id = ?').run(id);
        }
      }
    },

    // Your chats so far, once (when this memory is new), and whatever it missed.
    backfill(messages) {
      db.exec('BEGIN');
      try {
        for (const m of messages) if (m.role === 'user') put('chat', m.text, { meta: { day: m.day || '' }, importance: 0.3 });
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },

    working() {
      expire();
      return db.prepare("SELECT text FROM items WHERE space = 'working' ORDER BY created DESC LIMIT 5").all().map((r) => r.text);
    },

    // How much of what you said is in this: 0 .. 1 (one common word in a long sentence isn't "about" it).
    coverage(query, text) {
      const wanted = [...new Set(tokens(query))];
      if (!wanted.length) return 0;
      const have = tokens(text);
      return wanted.filter((w) => have.some((h) => h.startsWith(w))).length / wanted.length;
    },

    // What comes back for what you just said.
    async forChat(query) {
      const [facts, past, episodes] = await Promise.all([
        search(query, { spaces: ['fact'], limit: 12 }),
        search(query, { spaces: ['chat'], limit: 8 }),
        search(query, { spaces: ['episode'], limit: 3 }),
      ]);
      const about = (r, min) => r.close || this.coverage(query, r.text) >= min;
      const said = String(query).trim().toLowerCase();
      // the notes it's about, then the newest ones: she knows you whatever you just said
      const recent = db.prepare("SELECT text FROM items WHERE space = 'fact' ORDER BY created DESC LIMIT 15").all().map((r) => r.text);
      return {
        facts: [...new Set([...facts.map((r) => r.text), ...recent])].slice(0, 25),
        past: past.filter((r) => r.text.toLowerCase() !== said && about(r, 0.6)).slice(0, 3).map((r) => ({ day: r.meta?.day || '', text: r.text })),
        episodes: episodes.filter((r) => about(r, 0.5)).slice(0, 2).map((r) => ({ day: r.meta?.day || '', text: r.text })),
        working: this.working(),
      };
    },

    // Days that are over and haven't been written up yet, a couple at a time: what happened, in a few sentences.
    // days: [{ day, messages: [{ role, text }] }] oldest first. -> how many were written.
    async writeEpisodes(days, { max = 2 } = {}) {
      if (!ask) return 0;
      let written = 0;
      const has = db.prepare("SELECT 1 FROM items WHERE space = 'episode' AND key = ?");
      for (const { day, messages } of days) {
        if (written >= max) break;
        if (has.get(day) || messages.length < 6) continue;
        const log = messages.slice(-80).map((m) => `${m.role === 'user' ? 'They' : 'You'}: ${String(m.text).slice(0, 200)}`).join('\n');
        const answer = await ask([{ role: 'user', content: `You are Capri, keeping a diary of your chats with the user. In two or three plain sentences, what happened in this chat on ${day}? What did they do, feel, or care about? Facts only, nothing made up. In the language they used.\n\n${log}` }], { timeout: 60000 }).catch(() => '');
        const text = String(answer || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
        if (text.length < 20) break; // her model isn't up for it now: next time
        put('episode', text.slice(0, 700), { key: day, meta: { day }, importance: 0.6 });
        written++;
      }
      return written;
    },

    // Meaning for what doesn't have it yet, a batch at a time. -> how many got it.
    async embedPending(batch = 24) {
      const name = model();
      if (!name) return 0;
      const rows = db.prepare('SELECT id, text FROM items WHERE embedded = 0 ORDER BY importance DESC, id DESC LIMIT ?').all(batch);
      if (!rows.length) return 0;
      const list = await embed(rows.map((r) => r.text.slice(0, 1500)));
      if (!list?.length || !list[0]?.length) return 0;
      vectors.ensure(name, list[0].length);
      const done = db.prepare('UPDATE items SET embedded = 1 WHERE id = ?');
      rows.forEach((r, i) => {
        if (!list[i]) return;
        vectors.put(r.id, list[i]);
        done.run(r.id);
      });
      return rows.length;
    },

    counts() {
      const out = { fact: 0, working: 0, episode: 0, chat: 0, knowledge: 0, withMeaning: 0 };
      for (const r of db.prepare('SELECT space, COUNT(*) AS n, SUM(embedded) AS e FROM items GROUP BY space').all()) {
        out[r.space] = r.n;
        out.withMeaning += r.e || 0;
      }
      return out;
    },

    forgetAll() {
      removeWhere("space IN ('fact', 'working', 'episode', 'chat')");
    },
  };
}

module.exports = { createMemory, keyOf, workingNote, ftsQuery };

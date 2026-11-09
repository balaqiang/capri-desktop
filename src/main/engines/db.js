'use strict';

// Her memory and knowledge on this PC: one SQLite file. Everything she can recall is an item in a space:
//   fact       what she knows about you (your notes in her settings, mirrored here)
//   working    what's going on for you right now: fades in a day
//   episode    what happened on a day, in a few sentences
//   chat       what you said, word for word
//   knowledge  pieces of the files you gave her
// Words are searched with SQLite's full text search, meaning with vectors (sqlite-vec, or a plain scan if that can't load).

const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const SCHEMA = 1;

function vecPath() {
  // (unpacked from the app's archive, like anything Windows has to load itself)
  return require('sqlite-vec').getLoadablePath().replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
}

function openDb(file, { vec = true } = {}) {
  const db = new DatabaseSync(file, { allowExtension: true });
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON;');
  let hasVec = false;
  if (vec && process.platform === 'win32') {
    try {
      db.enableLoadExtension(true);
      db.loadExtension(vecPath());
      hasVec = true;
    } catch (err) {
      console.warn('[capri] vectors, without sqlite-vec:', err.message);
    } finally {
      db.enableLoadExtension(false);
    }
  }
  const version = db.prepare('PRAGMA user_version').get().user_version;
  if (version < SCHEMA) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY, space TEXT NOT NULL, key TEXT, text TEXT NOT NULL, meta TEXT,
        importance REAL NOT NULL DEFAULT 0.5, created INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0,
        uses INTEGER NOT NULL DEFAULT 0, expires INTEGER NOT NULL DEFAULT 0, embedded INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS items_space ON items(space, created);
      CREATE INDEX IF NOT EXISTS items_embed ON items(embedded);
      CREATE UNIQUE INDEX IF NOT EXISTS items_key ON items(space, key) WHERE key IS NOT NULL;
      CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(text, content='items', content_rowid='id', tokenize='unicode61 remove_diacritics 2');
      CREATE TRIGGER IF NOT EXISTS items_ai AFTER INSERT ON items BEGIN
        INSERT INTO items_fts(rowid, text) VALUES (new.id, new.text);
      END;
      CREATE TRIGGER IF NOT EXISTS items_ad AFTER DELETE ON items BEGIN
        INSERT INTO items_fts(items_fts, rowid, text) VALUES ('delete', old.id, old.text);
      END;
      CREATE TRIGGER IF NOT EXISTS items_au AFTER UPDATE OF text ON items BEGIN
        INSERT INTO items_fts(items_fts, rowid, text) VALUES ('delete', old.id, old.text);
        INSERT INTO items_fts(rowid, text) VALUES (new.id, new.text);
      END;
      CREATE TABLE IF NOT EXISTS docs (
        id INTEGER PRIMARY KEY, path TEXT NOT NULL UNIQUE, title TEXT NOT NULL, hash TEXT NOT NULL, chunks INTEGER NOT NULL, added INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT);
      CREATE TABLE IF NOT EXISTS vectors_plain (id INTEGER PRIMARY KEY, v BLOB NOT NULL);
      PRAGMA user_version = ${SCHEMA};
    `);
  }
  return { db, hasVec };
}

const blob = (vector) => new Uint8Array(Float32Array.from(vector).buffer);

// The vectors of her items, for one embedding model at a time: { put, remove, nearest, clear, count }. A new model makes
// the old ones meaningless, so they're dropped and made again.
function createVectors({ db, hasVec }) {
  const kv = {
    get: (k) => db.prepare('SELECT v FROM kv WHERE k = ?').get(k)?.v ?? null,
    set: (k, v) => db.prepare('INSERT INTO kv(k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').run(k, String(v)),
  };
  let dims = Number(kv.get('vec_dims')) || 0;
  const table = () => `vec_items_${dims}`;
  const ensure = (model, size) => {
    if (kv.get('vec_model') === model && dims === size) return;
    if (dims && hasVec) db.exec(`DROP TABLE IF EXISTS ${table()}`);
    db.exec('DELETE FROM vectors_plain; UPDATE items SET embedded = 0;');
    dims = size;
    if (hasVec) db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS ${table()} USING vec0(embedding float[${dims}] distance_metric=cosine)`);
    kv.set('vec_model', model);
    kv.set('vec_dims', dims);
  };
  const cosineDistance = (a, b) => {
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    return 1 - dot / (Math.sqrt(na * nb) || 1);
  };
  return {
    get model() { return kv.get('vec_model'); },
    ensure,
    put(id, vector) {
      if (hasVec) {
        db.prepare(`DELETE FROM ${table()} WHERE rowid = ?`).run(BigInt(id));
        db.prepare(`INSERT INTO ${table()}(rowid, embedding) VALUES (?, ?)`).run(BigInt(id), blob(vector));
      } else {
        db.prepare('INSERT INTO vectors_plain(id, v) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET v = excluded.v').run(id, blob(vector));
      }
    },
    remove(id) {
      if (!dims) return;
      if (hasVec) db.prepare(`DELETE FROM ${table()} WHERE rowid = ?`).run(BigInt(id));
      else db.prepare('DELETE FROM vectors_plain WHERE id = ?').run(id);
    },
    // -> [{ id, distance }] nearest first (distance: 0 the same, 1 unrelated, 2 opposite)
    nearest(vector, k) {
      if (!dims || vector.length !== dims) return [];
      if (hasVec) return db.prepare(`SELECT rowid AS id, distance FROM ${table()} WHERE embedding MATCH ? AND k = ? ORDER BY distance`).all(blob(vector), k).map((r) => ({ id: Number(r.id), distance: r.distance }));
      const q = Float32Array.from(vector);
      return db.prepare('SELECT id, v FROM vectors_plain').all()
        .map((r) => ({ id: r.id, distance: cosineDistance(q, new Float32Array(r.v.buffer.slice(r.v.byteOffset, r.v.byteOffset + r.v.byteLength))) }))
        .sort((a, b) => a.distance - b.distance).slice(0, k);
    },
  };
}

module.exports = { openDb, createVectors, SCHEMA };

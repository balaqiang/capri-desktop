'use strict';

// What you gave her to read: files and folders of yours, cut into pieces and kept in her memory's database, so she can
// answer from them and say where it came from. Plain-text kinds of files for now; a file only changes her knowledge when
// you add it again (or press Refresh in her settings).

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const TEXT_KINDS = new Set(['.txt', '.md', '.markdown', '.csv', '.tsv', '.json', '.yaml', '.yml', '.xml', '.html', '.htm', '.log', '.ini', '.toml',
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.java', '.c', '.h', '.cpp', '.hpp', '.cs', '.go', '.rs', '.php', '.rb', '.lua', '.sh', '.ps1', '.bat', '.sql', '.css']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '__pycache__', '.venv', 'venv', '.next', 'target']);
const MAX_FILES = 400;
const MAX_BYTES = 2 * 1024 * 1024;
const CHUNK = 900;
const OVERLAP = 120;

// Text in pieces of about CHUNK characters, on paragraph or sentence ends when there's one near, each overlapping the last.
function chunks(text) {
  const clean = String(text || '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const out = [];
  let at = 0;
  while (at < clean.length) {
    let end = Math.min(clean.length, at + CHUNK);
    if (end < clean.length) {
      const piece = clean.slice(at, end);
      const para = piece.lastIndexOf('\n\n');
      const sentence = Math.max(piece.lastIndexOf('. '), piece.lastIndexOf('.\n'));
      const cut = para > CHUNK * 0.5 ? para : sentence > CHUNK * 0.5 ? sentence + 1 : -1;
      if (cut > 0) end = at + cut;
    }
    const part = clean.slice(at, end).trim();
    if (part) out.push(part);
    if (end >= clean.length) break;
    at = Math.max(at + 1, end - OVERLAP);
  }
  return out;
}

// html without its tags
const plainOf = (file, text) => (/\.html?$/i.test(file) ? text.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ') : text);

function filesIn(target) {
  const out = [];
  const walk = (p) => {
    if (out.length >= MAX_FILES) return;
    let stat;
    try {
      stat = fs.statSync(p);
    } catch {
      return;
    }
    if (stat.isDirectory()) {
      if (SKIP_DIRS.has(path.basename(p))) return;
      let names = [];
      try {
        names = fs.readdirSync(p);
      } catch {
        return;
      }
      for (const name of names) walk(path.join(p, name));
    } else if (stat.isFile() && stat.size > 0 && stat.size <= MAX_BYTES && TEXT_KINDS.has(path.extname(p).toLowerCase())) out.push(p);
  };
  walk(target);
  return out;
}

// deps: { db, memory, now }
function createKnowledge({ db, memory, vectors, now = Date.now }) {
  const dropChunks = (docId) => {
    for (const { id } of db.prepare("SELECT id FROM items WHERE space = 'knowledge' AND key LIKE ?").all(`${docId}:%`)) {
      vectors.remove(id);
      db.prepare('DELETE FROM items WHERE id = ?').run(id);
    }
  };

  function addFile(file) {
    const text = fs.readFileSync(file, 'utf8');
    if (text.includes('\u0000')) return 'skipped'; // not really text
    const hash = crypto.createHash('sha1').update(text).digest('hex');
    const known = db.prepare('SELECT id, hash FROM docs WHERE path = ?').get(file);
    if (known?.hash === hash) return 'same';
    const pieces = chunks(plainOf(file, text));
    if (!pieces.length) return 'skipped';
    const title = path.basename(file);
    let docId = known?.id;
    if (known) {
      dropChunks(docId);
      db.prepare('UPDATE docs SET hash = ?, chunks = ? WHERE id = ?').run(hash, pieces.length, docId);
    } else {
      docId = Number(db.prepare('INSERT INTO docs(path, title, hash, chunks, added) VALUES (?, ?, ?, ?, ?)').run(file, title, hash, pieces.length, now()).lastInsertRowid);
    }
    db.exec('BEGIN');
    try {
      pieces.forEach((piece, i) => memory.put('knowledge', piece, { key: `${docId}:${i}`, meta: { doc: docId, title, i }, importance: 0.5 }));
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
    return known ? 'updated' : 'added';
  }

  const knowledge = {
    // A file or a folder. -> { added, updated, same, skipped, failed }
    add(target) {
      const res = { added: 0, updated: 0, same: 0, skipped: 0, failed: 0 };
      for (const file of filesIn(target)) {
        try {
          res[addFile(file)]++;
        } catch {
          res.failed++;
        }
      }
      return res;
    },
    remove(docId) {
      dropChunks(docId);
      return db.prepare('DELETE FROM docs WHERE id = ?').run(docId).changes > 0;
    },
    list: () => db.prepare('SELECT id, path, title, chunks, added FROM docs ORDER BY added DESC').all().map((d) => ({ ...d })),
    // what changed on disk, read again; what's gone, dropped
    refresh() {
      const res = { updated: 0, removed: 0 };
      for (const doc of knowledge.list()) {
        if (!fs.existsSync(doc.path)) {
          knowledge.remove(doc.id);
          res.removed++;
        } else {
          try {
            if (addFile(doc.path) === 'updated') res.updated++;
          } catch { /* it stays as it was */ }
        }
      }
      return res;
    },
    async search(query, limit = 4) {
      if (!db.prepare('SELECT 1 FROM docs LIMIT 1').get()) return [];
      const found = await memory.search(query, { spaces: ['knowledge'], limit: limit * 2 });
      // really about it: close in meaning, or most of what you asked is in it
      return found.filter((r) => r.close || memory.coverage(query, r.text) >= 0.6).slice(0, limit)
        .map((r) => ({ title: r.meta?.title || '', text: r.text, words: Boolean(r.words), close: Boolean(r.close), score: r.score }));
    },
  };
  return knowledge;
}

module.exports = { createKnowledge, chunks, filesIn, TEXT_KINDS };

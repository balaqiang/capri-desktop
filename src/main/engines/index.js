'use strict';

// Her memory and knowledge, started once, and kept up in the background: what you said gets its meaning (only if Ollama
// has an embedding model, on the CPU so it never pushes her chat model off the graphics card), and finished days get
// written up. If the database can't open she goes on with what she had before: all of this is `null` then.

const path = require('node:path');
const { openDb, createVectors } = require('./db');
const { createMemory } = require('./memory');
const { createKnowledge } = require('./knowledge');

const EMBED_EVERY = 60000;
const EPISODE_EVERY = 3 * 3600000;

// deps: { dir, tokens, embedder() -> Promise<name | null>, embed(model, texts) -> Promise<vectors | null>, ask, history, facts(), busy() }
function start({ dir, tokens, embedder, embed, ask, history, facts, busy = () => false }) {
  let handle;
  try {
    handle = openDb(path.join(dir, 'capri-memory.db'));
  } catch (err) {
    console.error('[capri] memory database:', err.message);
    return null;
  }
  const { db } = handle;
  const vectors = createVectors(handle);
  let model = null;
  const memory = createMemory({ db, vectors, tokens, model: () => model, ask, embed: (texts) => (model ? embed(model, texts) : Promise.resolve(null)) });
  const knowledge = createKnowledge({ db, memory, vectors });

  // the first time: your notes and your chats so far
  memory.syncFacts(facts());
  if (!db.prepare("SELECT v FROM kv WHERE k = 'backfilled'").get()) {
    memory.backfill(history.recent(5000));
    db.prepare("INSERT INTO kv(k, v) VALUES ('backfilled', '1')").run();
  }

  const refreshEmbedder = async () => { model = await embedder().catch(() => null); };
  const embedTick = async () => {
    if (busy()) return;
    await refreshEmbedder();
    await memory.embedPending().catch((err) => console.warn('[capri] memory, meaning:', err.message));
  };
  const episodeTick = async () => {
    if (busy()) return;
    const today = new Date().toISOString().slice(0, 10);
    const days = history.days().map((d) => d.day).filter((d) => d < today).sort().slice(-14);
    await memory.writeEpisodes(days.map((day) => ({ day, messages: history.read(day) }))).catch(() => 0);
  };
  const timers = [setInterval(embedTick, EMBED_EVERY), setInterval(episodeTick, EPISODE_EVERY), setTimeout(embedTick, 20000), setTimeout(episodeTick, 2 * 60000)];

  return {
    memory,
    knowledge,
    db,
    hasVectors: handle.hasVec,
    model: () => model,
    stop() {
      for (const t of timers) clearTimeout(t);
      try { db.close(); } catch { /* closing anyway */ }
    },
  };
}

module.exports = { start };

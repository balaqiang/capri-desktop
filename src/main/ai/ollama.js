'use strict';

// Talking to her: a local model through Ollama (https://ollama.com). Done from here, not from
// the overlay's page, which can't reach other local ports. Everything stays on this machine
// unless OLLAMA_HOST points somewhere else.

function base() {
  let host = process.env.OLLAMA_HOST || '127.0.0.1:11434';
  if (!/^https?:\/\//.test(host)) host = `http://${host}`;
  return host.replace('://0.0.0.0', '://127.0.0.1').replace(/\/+$/, '');
}

// Ollama's errors come as {"error": "..."}
async function failure(res) {
  const body = await res.text().catch(() => '');
  try {
    return new Error(JSON.parse(body).error);
  } catch {
    return new Error(body || `Ollama answered ${res.status}`);
  }
}

// The models installed, by name ("llama3.2:latest"...).
async function models() {
  const res = await fetch(`${base()}/api/tags`, { signal: AbortSignal.timeout(2500) });
  if (!res.ok) throw await failure(res);
  const { models: list = [] } = await res.json();
  return list.map((m) => m.name);
}

// Loads the model into memory ahead of the first message (the first answer after a fresh start
// otherwise waits for it to load, which can take a while).
// Your models with their sizes, and what's on the graphics card now: for her router (gpu.js).
async function sizes() {
  const [tags, running] = await Promise.all([
    fetch(`${base()}/api/tags`, { signal: AbortSignal.timeout(2500) }).then((r) => r.json()),
    fetch(`${base()}/api/ps`, { signal: AbortSignal.timeout(2500) }).then((r) => r.json()).catch(() => ({})),
  ]);
  const loaded = {};
  for (const m of running.models || []) loaded[m.name] = Number(m.size_vram) || 0;
  return { models: (tags.models || []).map((m) => ({ name: m.name, size: Number(m.size) || 0 })), loaded };
}

// Meaning, as numbers. On the CPU: an embedding must never push her chat model off the graphics card.
async function embed(model, texts) {
  const res = await fetch(`${base()}/api/embed`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, input: texts, keep_alive: '1m', options: { num_gpu: 0 } }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw await failure(res);
  return (await res.json()).embeddings || null;
}

function warm(model) {
  fetch(`${base()}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, keep_alive: '15m' }),
  }).catch(() => {});
}

// Her answer, streamed: onDelta(piece) as it comes, resolves with all of it.
async function chat({ model, messages, options = {} }, onDelta, signal) {
  const res = await fetch(`${base()}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      keep_alive: '15m', // she stays loaded while you chat
      options: { temperature: options.temperature ?? 0.85, num_predict: options.maxTokens ?? 240 },
    }),
    signal,
  });
  if (!res.ok) throw await failure(res);
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      const msg = JSON.parse(line);
      if (msg.error) throw new Error(msg.error);
      const piece = msg.message?.content || ''; // a thinking model's reasoning comes apart, and is left out
      if (piece) {
        text += piece;
        onDelta(piece);
      }
      if (msg.done) return text;
    }
  }
  return text;
}

module.exports = { embed, sizes, base, models, warm, chat };

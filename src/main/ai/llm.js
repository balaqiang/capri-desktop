'use strict';

// Who she talks with: Ollama, any OpenAI-compatible server (local, cloud, or a keyless gateway),
// or Claude Code itself (headless `claude -p`, so your messages become its prompts).
// Keys come from config.json's `apiKeys` ({ openai: "sk-..." }) or the provider's env variable.

const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { spawn, execFile } = require('node:child_process');
const ollama = require('./ollama');

const PROVIDERS = {
  ollama: { label: 'Ollama (local)', kind: 'ollama', local: true },
  lmstudio: { label: 'LM Studio (local)', url: 'http://127.0.0.1:1234/v1', local: true },
  llamacpp: { label: 'llama.cpp / vLLM (local :8080)', url: 'http://127.0.0.1:8080/v1', local: true },
  pollinations: {
    label: 'Pollinations (no key)', url: 'https://text.pollinations.ai/openai', modelsUrl: 'https://text.pollinations.ai/models',
  },
  openrouter: { label: 'OpenRouter', url: 'https://openrouter.ai/api/v1', env: 'OPENROUTER_API_KEY' },
  openai: { label: 'OpenAI', url: 'https://api.openai.com/v1', env: 'OPENAI_API_KEY' },
  anthropic: { label: 'Anthropic (Claude API)', kind: 'anthropic', url: 'https://api.anthropic.com/v1', env: 'ANTHROPIC_API_KEY' },
  groq: { label: 'Groq', url: 'https://api.groq.com/openai/v1', env: 'GROQ_API_KEY' },
  gemini: { label: 'Google Gemini', url: 'https://generativelanguage.googleapis.com/v1beta/openai', env: 'GEMINI_API_KEY' },
  deepseek: { label: 'DeepSeek', url: 'https://api.deepseek.com/v1', env: 'DEEPSEEK_API_KEY' },
  mistral: { label: 'Mistral', url: 'https://api.mistral.ai/v1', env: 'MISTRAL_API_KEY' },
  custom: { label: 'Custom (customUrl in config)' },
  claude: { label: 'Claude Code (sends to the terminal agent)', kind: 'claude' },
};

// no bypassPermissions: a chat bubble on the desktop shouldn't run anything without asking
const CLAUDE_MODES = ['default', 'acceptEdits'];

function endpoint(id, cfg) {
  const p = PROVIDERS[id];
  const url = (id === 'custom' ? cfg.customUrl : p.url) || '';
  const key = cfg.apiKeys?.[id] || (p.env && process.env[p.env]) || '';
  return { ...p, url: url.replace(/\/+$/, ''), key };
}

const headers = (key) => ({ 'content-type': 'application/json', ...(key && { authorization: `Bearer ${key}` }) });
const anthropicHeaders = (key) => ({ 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' });

// How long and how wild her answers are (settings › AI), with sane bounds.
const sampling = (cfg = {}) => ({
  temperature: Math.min(1.5, Math.max(0, Number(cfg.temperature ?? 0.85))),
  maxTokens: Math.min(4000, Math.max(40, Math.round(Number(cfg.maxTokens) || 300))),
});

// A message with pictures (Look: { role, content, images: [base64 jpeg] }) in each server's own shape.
const openaiMessage = ({ role, content, images }) => (images?.length
  ? { role, content: [{ type: 'text', text: content }, ...images.map((b64) => ({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } }))] }
  : { role, content });

// Why a server said no, in a sentence (Gemini sends its error inside an array), with a code when it's
// worth another try: 'busy' (too many people on it right now), 'gone' (that model isn't served anymore).
async function failure(res) {
  const body = await res.text().catch(() => '');
  let message = body.slice(0, 200) || `answered ${res.status}`;
  try {
    const parsed = JSON.parse(body);
    const err = (Array.isArray(parsed) ? parsed[0] : parsed)?.error;
    if (err) message = typeof err === 'string' ? err : err.message || message;
  } catch {
    // not JSON: the start of the body says it
  }
  const code = res.status === 429 || res.status === 503 || /overloaded|high demand|unavailable/i.test(message) ? 'busy'
    : res.status === 404 ? 'gone' : null;
  return Object.assign(new Error(message), { status: res.status, code });
}

// Gemini lists every model it has (embeddings, speech, images…): only the ones to chat with, a current
// stable Flash first (older ones get closed to new keys, previews come and go).
function geminiModels(names) {
  const version = (n) => Number(/gemini-(\d+(?:\.\d+)?)/.exec(n)?.[1] || 0);
  const rank = (n) => (/preview|exp/.test(n) ? 4 : 0) + (/flash-lite/.test(n) ? 1 : /flash/.test(n) ? 0 : 2);
  return names
    .filter((n) => /gemini/.test(n) && !/embed|tts|image|audio|live|veo|imagen|computer-use|robotics|aqa/.test(n))
    .sort((a, b) => rank(a) - rank(b) || version(b) - version(a));
}

// The provider's models by name; null when it can't be reached (Ollama only), throws with why otherwise.
async function models(id, cfg) {
  const p = endpoint(id, cfg);
  if (p.kind === 'ollama') return ollama.models().catch(() => null);
  if (p.kind === 'claude') return claudeVersion().then(() => ['Claude Code']);
  if (p.kind === 'anthropic') {
    if (!p.key) throw Object.assign(new Error(`no API key (or ${p.env})`), { code: 'nokey' });
    const res = await fetch(`${p.url}/models?limit=100`, { headers: anthropicHeaders(p.key), signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw await failure(res);
    const { data = [] } = await res.json();
    // the small fast ones first: her replies are short
    const rank = (id) => (/haiku/.test(id) ? 0 : /sonnet/.test(id) ? 1 : 2);
    return data.map((m) => m.id).sort((a, b) => rank(a) - rank(b));
  }
  // what's missing has a code, so her setup knows what to ask for (setup.js)
  if (!p.url) throw Object.assign(new Error('no address set for this server'), { code: 'nourl' });
  if (p.env && !p.key) throw Object.assign(new Error(`no API key (or ${p.env})`), { code: 'nokey' });
  const res = await fetch(p.modelsUrl || `${p.url}/models`, { headers: headers(p.key), signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw await failure(res);
  const body = await res.json();
  const list = Array.isArray(body) ? body : body.data || body.models || [];
  const names = list.map((m) => (typeof m === 'string' ? m : m.id || m.name)).filter(Boolean);
  return id === 'gemini' ? geminiModels(names) : names;
}

function warm(id, model) {
  if (PROVIDERS[id].kind === 'ollama') ollama.warm(model);
}

// OpenAI-style streaming (server-sent events): onDelta(piece) as it comes, resolves with all of it.
async function openaiChat(p, { model, messages, cfg }, onDelta, signal) {
  const { temperature, maxTokens } = sampling(cfg);
  // Models that think before answering (Gemini 2.5 and 3, reasoners) spend their thinking out of the same
  // token budget: with a short one her answer got cut mid-word ("Yaelah sabar n"). They get room to think,
  // and Gemini is told to think as little as it can (her answers are a sentence or two).
  const gemini = /generativelanguage\.googleapis\.com/.test(p.url);
  const thinks = gemini || /deepseek-r|reasoner|thinking|\bqwq\b|qwen3|gpt-5|\bo[134](?:-mini)?\b|magistral/i.test(model);
  const body = { model, messages: messages.map(openaiMessage), stream: true, temperature, max_tokens: maxTokens + (thinks ? 4096 : 0) };
  if (gemini) body.reasoning_effort = /pro/i.test(model) ? 'low' : 'none';
  const send = (b) => fetch(`${p.url}/chat/completions`, { method: 'POST', headers: headers(p.key), body: JSON.stringify(b), signal });
  let res = await send(body);
  if (!res.ok && res.status === 400 && body.reasoning_effort) {
    // this model won't take that much less thinking (Gemini 3 always thinks): asked again without it
    delete body.reasoning_effort;
    res = await send(body);
  }
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
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') return text;
      const msg = JSON.parse(data);
      if (msg.error) throw new Error(msg.error.message || msg.error);
      const piece = msg.choices?.[0]?.delta?.content || ''; // reasoning comes apart, and is left out
      if (piece) {
        text += piece;
        onDelta(piece);
      }
      // ran out of room all the same: an ellipsis, not a word cut in half with nothing to show for it
      if (msg.choices?.[0]?.finish_reason === 'length' && text && !/[.!?…)"'~]\s*$/.test(text)) {
        text += '…';
        onDelta('…');
      }
    }
  }
  return text;
}

// Anthropic's Messages API, streamed: her persona goes apart (system), the rest must take turns.
async function anthropicChat(p, { model, messages, cfg }, onDelta, signal) {
  const { temperature, maxTokens } = sampling(cfg);
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const turns = [];
  for (const m of messages.filter((x) => x.role !== 'system')) {
    const blocks = [
      ...(m.images || []).map((data) => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } })),
      { type: 'text', text: String(m.content || '…') },
    ];
    const last = turns.at(-1);
    if (last && last.role === m.role) last.content.push(...blocks);
    else turns.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: blocks });
  }
  if (turns[0]?.role !== 'user') turns.unshift({ role: 'user', content: [{ type: 'text', text: '…' }] });
  const res = await fetch(`${p.url}/messages`, {
    method: 'POST',
    headers: anthropicHeaders(p.key),
    body: JSON.stringify({ model, system, messages: turns, max_tokens: maxTokens, temperature: Math.min(1, temperature), stream: true }),
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
      if (!line.startsWith('data:')) continue;
      let msg;
      try { msg = JSON.parse(line.slice(5)); } catch { continue; }
      if (msg.type === 'error') throw new Error(msg.error?.message || 'Anthropic error');
      if (msg.type === 'message_stop') return text;
      const piece = msg.type === 'content_block_delta' && msg.delta?.type === 'text_delta' ? msg.delta.text : '';
      if (piece) {
        text += piece;
        onDelta(piece);
      }
    }
  }
  return text;
}

// --- Claude Code ---------------------------------------------------------------------------------
// The prompt goes in on stdin, never on the command line: the shell (needed for an npm claude.cmd)
// only ever sees fixed arguments.

const quote = (s) => (process.platform === 'win32' ? `"${s}"` : s); // cmd joins the arguments
// its session id, picked here so her hooks can tell its events from your other sessions' (main.js)
let claudeSession = null;
let claudeStarted = false; // each message after the first continues the same conversation

function claudeVersion() {
  return new Promise((resolve, reject) => {
    execFile('claude', ['--version'], { shell: process.platform === 'win32', timeout: 10000 }, (err, out) => (
      err ? reject(new Error('Claude Code not found (is `claude` on your PATH?)')) : resolve(out.trim())));
  });
}

function claudeChat(cfg, text, persona, onDelta, signal) {
  // her persona, from a file: too long and too full of quotes and newlines for cmd's command line
  const personaFile = path.join(os.tmpdir(), 'capri-persona.txt');
  fs.writeFileSync(personaFile, persona);
  const args = ['-p', '--output-format', 'stream-json', '--verbose',
    '--permission-mode', CLAUDE_MODES.includes(cfg.claudeMode) ? cfg.claudeMode : 'default',
    '--append-system-prompt-file', quote(personaFile)];
  if (!claudeSession) claudeSession = randomUUID();
  args.push(claudeStarted ? '--resume' : '--session-id', claudeSession);
  return new Promise((resolve, reject) => {
    const child = spawn('claude', args, {
      cwd: cfg.claudeCwd || os.homedir(),
      shell: process.platform === 'win32',
      windowsHide: true,
    });
    const kill = () => (process.platform === 'win32'
      ? execFile('taskkill', ['/pid', String(child.pid), '/t', '/f'], () => {})
      : child.kill());
    signal.addEventListener('abort', kill, { once: true });
    let buffer = '';
    let all = '';
    let result = null;
    let errors = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      buffer += chunk;
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }
        claudeStarted = true;
        if (msg.type === 'assistant') {
          for (const block of msg.message?.content || []) {
            if (block.type !== 'text' || !block.text) continue;
            const piece = (all ? '\n' : '') + block.text;
            all += piece;
            onDelta(piece);
          }
        } else if (msg.type === 'result') {
          result = msg;
        }
      }
    });
    child.stderr.on('data', (chunk) => { errors += chunk; });
    child.stdin.end(text);
    child.on('error', reject);
    child.on('close', () => {
      if (signal.aborted) return reject(new Error('stopped'));
      if (result?.is_error) return reject(new Error(result.result || 'Claude Code failed'));
      if (!result) return reject(new Error(errors.trim().slice(0, 300) || 'Claude Code gave no answer'));
      resolve(result.result || all);
    });
  });
}

function resetClaude() {
  claudeSession = null;
  claudeStarted = false;
}

// Claude Code's conversation, to save and pick up again after a restart.
const claudeMemory = () => ({ session: claudeSession, started: claudeStarted });
function restoreClaude(saved) {
  claudeSession = saved?.session || null;
  claudeStarted = Boolean(claudeSession && saved.started);
}

const isChatSession = (id) => Boolean(id) && id === claudeSession;

async function chat(id, cfg, { model, messages }, onDelta, signal) {
  const p = endpoint(id, cfg);
  if (p.kind === 'ollama') return ollama.chat({ model, messages, options: sampling(cfg) }, onDelta, signal);
  if (p.kind === 'anthropic') return anthropicChat(p, { model, messages, cfg }, onDelta, signal);
  // Claude Code keeps its own memory of the conversation: only her persona and your last message go
  if (p.kind === 'claude') return claudeChat(cfg, messages.at(-1).content, messages[0].content, onDelta, signal);
  return openaiChat(p, { model, messages, cfg }, onDelta, signal);
}

// Whether her answers stay on this PC: a server on this machine.
function isLocal(id, cfg) {
  if (id === 'ollama') return /^(https?:\/\/)?(127\.0\.0\.1|localhost|0\.0\.0\.0|\[?::1\]?)(:|\/|$)/.test(process.env.OLLAMA_HOST || '127.0.0.1');
  if (id === 'custom') return /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/.test(cfg.customUrl || '');
  return Boolean(PROVIDERS[id].local);
}

// Whether this provider can be handed a picture at all (Claude Code can't, through her chat).
const canSee = (id) => PROVIDERS[id] && PROVIDERS[id].kind !== 'claude';

module.exports = { isLocal, canSee, endpoint, PROVIDERS, CLAUDE_MODES, models, warm, chat, resetClaude, isChatSession, claudeMemory, restoreClaude };

'use strict';

// One PowerShell that stays up (helper.ps1), so what she does on your PC doesn't wait for a new one each time. When
// it's busy with something long (typing) or isn't up, callers do it the old way: this is only ever a shortcut.

const path = require('node:path');
const readline = require('node:readline');
const { spawn } = require('node:child_process');

const WIN = process.platform === 'win32';
const FILE = path.join(__dirname, 'helper.ps1').replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);

let child = null;
let up = false;      // it said it's ready
let wanted = false;  // stay up: a crash brings it back
let nextId = 1;
const waiting = new Map(); // id -> { resolve, reject, timer, onLine, lines }

function failAll(why) {
  for (const w of waiting.values()) {
    clearTimeout(w.timer);
    w.reject(new Error(why));
  }
  waiting.clear();
}

function onMessage(text) {
  let msg;
  try {
    msg = JSON.parse(text);
  } catch {
    return; // not one of its lines
  }
  if (msg.id === 0) {
    if (msg.line === 'ready') up = true;
    return;
  }
  const w = waiting.get(msg.id);
  if (!w) return;
  if (msg.line !== undefined) {
    w.lines.push(msg.line);
    w.onLine?.(msg.line);
  }
  if (msg.done) {
    clearTimeout(w.timer);
    waiting.delete(msg.id);
    if (msg.error) w.reject(new Error(msg.error));
    else w.resolve({ ...(msg.result || {}), lines: w.lines });
  }
}

function start() {
  wanted = true;
  if (!WIN || child) return;
  const proc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', FILE], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
  child = proc;
  readline.createInterface({ input: proc.stdout }).on('line', onMessage);
  proc.stdin.on('error', () => {}); // written to as it went
  const gone = () => {
    if (child !== proc) return;
    child = null;
    up = false;
    failAll('helper gone');
    if (wanted) setTimeout(() => { if (wanted && !child) start(); }, 1500);
  };
  proc.on('error', gone);
  proc.on('exit', gone);
}

function stop() {
  wanted = false;
  up = false;
  failAll('stopped');
  const proc = child;
  child = null;
  proc?.kill();
}

// Whatever it's doing is dropped (her Stop button, something stuck): a fresh one right after.
function restart() {
  stop();
  start();
}

// Up, and not in the middle of something
const free = () => Boolean(child && up && waiting.size === 0);

function call(op, data = {}, { timeout = 15000, onLine = null } = {}) {
  if (!child) return Promise.reject(new Error('helper down'));
  return new Promise((resolve, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => {
      waiting.delete(id);
      restart(); // it's stuck on this one: nothing else would get through
      reject(new Error('timeout'));
    }, timeout);
    waiting.set(id, { resolve, reject, timer, onLine, lines: [] });
    child.stdin.write(`${JSON.stringify({ id, op, ...data })}\n`);
  });
}

// One of her scripts, its last line read as JSON, as when it ran on its own.
async function script(file, params, opts) {
  const { lines } = await call('script', { file, params }, opts);
  return JSON.parse(String(lines.at(-1) || '').trim());
}

module.exports = { start, stop, restart, free, call, script };

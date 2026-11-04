'use strict';

// New versions of her, from her GitHub Releases (github.com/balaqiang/capri-desktop): looked for a minute and a
// half after she starts, then every six hours. She asks before downloading (settings › Advanced › Updates: "Ask me",
// "Automatic" downloads it and installs it when you close her, "Off"), and what comes down is checked against the
// SHA-512 in the release's latest.yml before it's installed. Only the installed version updates itself: the
// portable one, and running from the source, never do.
//
// A release needs, uploaded with it: Capri-Setup-<version>.exe, its .blockmap, and latest.yml (all three in dist/).
//
//   start({ cfg, emit })   check()   download()   install()   state() -> { phase, version, percent, error }

const { app } = require('electron');

const FIRST_MS = 90 * 1000;
const EVERY_MS = 6 * 60 * 60 * 1000;
const LATER_MS = 24 * 60 * 60 * 1000; // "Later": not asked about that version again for a day

let updater = null;
let cfg = () => ({});
let emit = () => {};
let timer = null;
let current = { phase: 'idle', version: null, percent: 0, error: null };
let laterFor = { version: null, at: 0 };

const portable = () => Boolean(process.env.PORTABLE_EXECUTABLE_DIR);
const usable = () => app.isPackaged && !portable() && process.platform === 'win32';
const mode = () => (['notify', 'auto', 'off'].includes(cfg().autoUpdate) ? cfg().autoUpdate : 'notify');

// ask: her panel asks you about it (a new version found, in "Ask me", and not one you said "Later" to today)
function set(patch, ask = false) {
  current = { ...current, ...patch };
  emit({ type: 'update', ...current, ask });
}

function load() {
  if (updater) return updater;
  try {
    ({ autoUpdater: updater } = require('electron-updater'));
  } catch (err) {
    console.error('[capri] updates:', err.message);
    return null;
  }
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = true;
  updater.allowPrerelease = false;
  updater.logger = { info() {}, warn: (m) => console.warn('[capri] updates:', m), error: (m) => console.error('[capri] updates:', m), debug() {} };
  updater.on('checking-for-update', () => set({ phase: 'checking', error: null }));
  updater.on('update-not-available', () => set({ phase: 'latest', version: null }));
  updater.on('update-available', (info) => {
    const putOff = laterFor.version === info.version && Date.now() - laterFor.at < LATER_MS;
    set({ phase: 'available', version: info.version, percent: 0 }, mode() === 'notify' && !putOff);
    if (mode() === 'auto') download();
  });
  updater.on('download-progress', (p) => set({ phase: 'downloading', percent: Math.round(p.percent || 0) }));
  updater.on('update-downloaded', (info) => set({ phase: 'ready', version: info.version, percent: 100 }, true));
  updater.on('error', (err) => set({ phase: 'error', error: String(err?.message || err).slice(0, 200) }));
  return updater;
}

// every six hours, and her settings' "Check now"
async function check() {
  if (!usable()) return { ...current, phase: 'unsupported' };
  if (!load()) return { ...current, phase: 'error', error: 'electron-updater is missing' };
  if (current.phase === 'downloading' || current.phase === 'ready') return current;
  try {
    await updater.checkForUpdates();
  } catch (err) {
    set({ phase: 'error', error: String(err?.message || err).slice(0, 200) });
  }
  return current;
}

async function download() {
  if (!load() || current.phase === 'downloading' || current.phase === 'ready') return current;
  set({ phase: 'downloading', percent: 0 });
  try {
    await updater.downloadUpdate();
  } catch (err) {
    set({ phase: 'error', error: String(err?.message || err).slice(0, 200) });
  }
  return current;
}

function install() {
  if (current.phase !== 'ready' || !load()) return false;
  setImmediate(() => updater.quitAndInstall(true, true)); // quiet install, and she starts again after
  return true;
}

function later() {
  laterFor = { version: current.version, at: Date.now() };
}

function start(opts = {}) {
  cfg = opts.cfg || cfg;
  emit = opts.emit || emit;
  if (!usable()) return;
  clearInterval(timer);
  const tick = () => { if (mode() !== 'off') check(); };
  setTimeout(tick, FIRST_MS);
  timer = setInterval(tick, EVERY_MS);
}

const state = () => ({ ...current, supported: usable(), mode: mode(), running: app.getVersion() });

module.exports = { start, check, download, install, later, state };

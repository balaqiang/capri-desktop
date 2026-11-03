#!/usr/bin/env node
'use strict';

// `npm start`: Capri on her own, apart from this terminal. Started from a terminal she used to be its
// child, so closing the terminal (or an IDE's terminal tab) took her with it. Here Electron is started
// detached, with no console, and this script ends at once: close the terminal, she stays.
// `npm run attached` keeps the old way (her logs in the terminal), `npm run dev` too, with debug routes.

const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
let electron;
try {
  electron = require('electron'); // the path to electron.exe, from the electron package
} catch {
  console.error('Electron is not installed. Run: npm install, then: node node_modules/electron/install.js');
  process.exit(1);
}

const child = spawn(electron, [root, ...process.argv.slice(2)], {
  cwd: root,
  detached: true,
  stdio: 'ignore',
  windowsHide: false, // her own windows must show; only the console is left out (detached)
});
child.on('error', (err) => {
  console.error('Capri could not start:', err.message);
  process.exit(1);
});
child.unref();
console.log('Capri is running on her own. You can close this terminal: she stays on your desktop.');
console.log('To quit her: right-click her (or her icon by the clock) > Quit.');

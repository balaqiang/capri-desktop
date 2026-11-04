'use strict';
// Electron isn't there under `node --test`: what her main-process modules ask of it at load time, stubbed.
// Required first by the tests that load src/main modules.
const Module = require('node:module');
const os = require('node:os');

const electron = {
  app: { getVersion: () => require('../package.json').version, getPath: () => os.tmpdir(), on() {}, isPackaged: false },
  shell: {},
  net: {},
};
const load = Module._load;
Module._load = function (request, ...rest) {
  if (request === 'electron') return electron;
  return load.call(this, request, ...rest);
};
module.exports = electron;

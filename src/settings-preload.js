'use strict';

// Her settings window (src/settings): what it may ask of the app, and nothing else.

const { contextBridge, ipcRenderer } = require('electron');

const on = (channel) => (fn) => {
  const listener = (_e, payload) => fn(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

contextBridge.exposeInMainWorld('settings', {
  get: () => ipcRenderer.invoke('settings:get'),
  set: (patch) => ipcRenderer.invoke('settings:set', patch),
  setKey: (provider, key) => ipcRenderer.invoke('settings:key', { provider, key }),
  models: () => ipcRenderer.invoke('settings:models'),
  action: (name, arg) => ipcRenderer.invoke('settings:action', { name, arg }),
  langTable: () => ipcRenderer.invoke('lang:table'),
  lyricsCache: () => ipcRenderer.invoke('lyrics:cache'),
  clearLyrics: () => ipcRenderer.invoke('lyrics:clear'),
  transcribe: (wav, language) => ipcRenderer.invoke('voice:transcribe', { wav, language }),
  ttsVoices: (engine) => ipcRenderer.invoke('tts:voices', engine),
  historyDays: () => ipcRenderer.invoke('history:days'),
  ollamaModels: () => ipcRenderer.invoke('ollama:models'),
  historyRead: (day) => ipcRenderer.invoke('history:read', day),
  historySearch: (query) => ipcRenderer.invoke('history:search', query),
  onConfig: on('capri:config'),
  onRefresh: on('settings:refresh'),
  onTab: on('settings:tab'),
  onEarsProgress: on('voice:progress'),
});

'use strict';

// The things she can open by name: Windows' folders and tools, and the friendly name of a program.

const os = require('node:os');
const path = require('node:path');

// The friendly name of a program ("msedge" -> "Edge")
function friendly(program) {
  const p = String(program || '');
  const known = {
    msedge: 'Edge', chrome: 'Chrome', brave: 'Brave', code: 'VS Code', devenv: 'Visual Studio', explorer: 'File Explorer', applicationframehost: '', winword: 'Word', powerpnt: 'PowerPoint',
    // Windows' own pieces and overlays, not programs you'd be "in" for hours
    textinputhost: '', shellexperiencehost: '', startmenuexperiencehost: '', searchhost: '', searchapp: '', lockapp: '', 'nvidia share': '', electron: '', capri: '',
  };
  const k = p.toLowerCase();
  if (k in known) return known[k];
  return p ? p[0].toUpperCase() + p.slice(1) : '';
}

// Where the things she can open live: Windows' folders, and programs that ship with it.
function place(name) {
  const home = os.homedir();
  const n = String(name || '').toLowerCase().trim();
  const table = {
    downloads: path.join(home, 'Downloads'), 'download folder': path.join(home, 'Downloads'), 'downloads folder': path.join(home, 'Downloads'), unduhan: path.join(home, 'Downloads'), 'folder unduhan': path.join(home, 'Downloads'), 'folder download': path.join(home, 'Downloads'),
    documents: path.join(home, 'Documents'), 'documents folder': path.join(home, 'Documents'), dokumen: path.join(home, 'Documents'), 'folder dokumen': path.join(home, 'Documents'),
    desktop: path.join(home, 'Desktop'), 'desktop folder': path.join(home, 'Desktop'),
    pictures: path.join(home, 'Pictures'), photos: path.join(home, 'Pictures'), 'pictures folder': path.join(home, 'Pictures'), gambar: path.join(home, 'Pictures'), foto: path.join(home, 'Pictures'),
    videos: path.join(home, 'Videos'), 'videos folder': path.join(home, 'Videos'), video: path.join(home, 'Videos'),
    'music folder': path.join(home, 'Music'), 'folder musik': path.join(home, 'Music'),
    'file explorer': 'explorer.exe', explorer: 'explorer.exe', files: 'explorer.exe', 'this pc': 'explorer.exe', 'penjelajah file': 'explorer.exe',
    notepad: 'notepad.exe', 'note pad': 'notepad.exe', calculator: 'calc.exe', calc: 'calc.exe', kalkulator: 'calc.exe', paint: 'mspaint.exe',
    'task manager': 'taskmgr.exe', 'pengelola tugas': 'taskmgr.exe', settings: 'ms-settings:', 'windows settings': 'ms-settings:', pengaturan: 'ms-settings:', setelan: 'ms-settings:',
    'snipping tool': 'snippingtool.exe', 'control panel': 'control.exe', cmd: 'cmd.exe', 'command prompt': 'cmd.exe', terminal: 'wt.exe',
  };
  return table[n] || null;
}

module.exports = { friendly, place };

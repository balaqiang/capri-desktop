[← README](../README.md)

# Development

## How it's built

```
src/main/                 Electron: the transparent click-through window, tray, settings, local HTTP bridge
  main.js                 wiring: windows, IPC, hotkeys, her brain, Look (snapshot + OCR), staying on top
  llm.js, ollama.js       her brains: Ollama, OpenAI-compatible (Gemini…), Anthropic, Claude Code
  errands.js              what she does from plain words (move, open, type, drafts, code here, homework, weather…)
  life.js                 her errands run, chains, typing, drafts, code here, timers, sync, notices, songs, her brief
  plugins.js              plugins made without code: what sets them off, their steps
  recall.js               her notes and your past chats picked for a message (BM25, embeddings in Ollama)
  store.js                her files written atomically (.tmp, .bak, a broken file set aside)
  updater.js              updates from GitHub Releases (electron-updater)
  actions-log.js          what she did on your PC (Settings › Access › What she did)
  weather.js              the weather (Open-Meteo)
  lyrics.js, web.js       the song's timed lyrics (LRCLIB); questions looked up (Wikipedia, Bing)
  launch.js, apps.js      opening and closing apps, games, sites; typing in another app
  hearing.js, mouth.js    her ears (Whisper, Groq, OpenAI, Windows) and her voice (ElevenLabs, OpenAI, Piper…)
  growth.js, history.js   she improves herself; your chats, a file a day, the story so far
  games.js, lang.js       her games; her words from assets/lang
  senses.ps1              the app in front, another AI in front, battery, now playing, fullscreen
  windows.ps1             where the other windows are, so she can sit on them
  spotify.ps1, ocr.ps1    pressing Play in Spotify; reading the text in a picture (Windows OCR)
  media.ps1, type.ps1     the song playing (repeat, shuffle, seek); typing and pasting in another app, safely
src/renderer/js/
  sprite.js, acting.js    her rig (WebGL shader) and her moves, drawing by drawing
  hair.js, ik.js          her mane's springs; her arm's reach and her gaze
  capri.js                the character: stances, walking, teleport, grab, throw, pet, gestures, hair and IK
  motion.js               what she learns about when and how to move
  chat.js, rules.js       talking to her (drafts, homework, her moves from her AI); her chat's rules and calculator
  persona.js, lore.js     her persona; her story and what she knows of Cyberpunk
  life.js, glitch.js      pets, emotions, plugins' lines, mischief, her six glitch styles
  listen.js               her with your music: lyrics over her head, grooving, dancing, dozing off
  ears.js, tts.js         the microphone; her voice out loud, effects and lips
  fx.js, panel.js         shards, bolts, cut-ins, hearts; her panel and her faces
  brain.js, guide.js      coding-AI events into lines; her guide
src/settings/             her settings window
hooks/, scripts/          Claude Code / Codex / Antigravity hooks and their installers, the launcher, the demo
assets/                   her sprite and cut-ins, the 2.4 art, translations, icons
tests/                    node --test: errands, rules, lyrics, recall, plugins, body, store, hooks…
tools/                    how the sprite, cut-ins and intro were cut out (Python + Pillow)
```

## Checks

```bash
npm test               # node --test: 50 tests
npm run lint           # ESLint, bug rules only (undefined names, duplicate cases…)
npm run check:names    # a field named like a method; a PowerShell variable with two spellings
npm run check          # all three
```

The CI (`.github/workflows/ci.yml`) runs them on Windows on every push, and parses her PowerShell helpers with
PSScriptAnalyzer.

## Debugging

`npm run dev` turns on debug routes on her bridge (`/debug/capture`, `/debug/mouse`, `/debug/errand`, `/debug/config`,
`/debug/settings`, `/debug/command`, `/debug/snapshot`…). Run a second copy apart from yours with its own data:

```bash
CAPRI_PORT=47899 npx electron . --dev --user-data-dir=<a folder>
```

## Translations

`assets/lang/id.txt`: a line `> English` and its translation under it. A file of yours in her lang folder wins, line by
line.

## Releasing

1. `npm run check`, then bump `version` in `package.json` and `package-lock.json`.
2. `npm run dist` makes `dist\Capri-Setup-<v>.exe`, its `.blockmap`, `dist\Capri-Portable-<v>.exe` and `dist\latest.yml`.
3. Tag `v<version>` and push; on GitHub, a release for the tag with all four files. **`latest.yml` and the `.blockmap`
   are what her auto-update reads**: without them, installed copies never see the new version.

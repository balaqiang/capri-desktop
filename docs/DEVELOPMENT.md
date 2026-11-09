[← README](../README.md)

# Development

## How it's built

```
src/main/
  main.js, life.js   the app, and her life apart from Claude Code (errands, jobs, plans, notices)
  core/              config, store (atomic writes), lang, updater, history, actions-log, setup, labels, bridge
  ai/                llm (every provider), ollama, gpu (which model fits on the card)
  engines/           db (SQLite, sqlite-vec), memory, knowledge, router, recall, growth, mood
  commands/          errands.js, her registry (index.js: which goes first), and each command by what it's about
  actions/           tasks (told as she goes, Stop), tools (all a plan can do), planner, plugins, games
  skills/            loader: assets/skills and yours, words only
  training/          reward, dataset, evaluate, index: making her local model better
  voice/             hearing (Whisper and others), mouth (her voice), wake ("Capri"), vad (is it a voice?)
  online/            web, weather, lyrics, songdata
  platform/          what touches Windows: apps, launch, helper, windows, browser (Playwright) and the .ps1 scripts
src/renderer/js/     her window: capri (body), chat, ears, tts, transcript, forms, blueprint, guide, life…
src/settings/        her settings window
assets/              her art, skills, eval questions, finetune script, wake and voice detector models
tests/               node --test
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

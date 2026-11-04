**English** · [Bahasa Indonesia](id/INSTALASI.md) · [← README](../README.md)

# Install

## Windows, the easy way

1. Download **`Capri-Setup-x.y.z.exe`** from the [Releases](https://github.com/balaqiang/capri-desktop/releases) and run
   it. It installs for your user only (no admin rights), adds Start menu and Desktop shortcuts, starts with Windows, and
   starts Capri.
2. The installer isn't signed, so SmartScreen may say "Windows protected your PC": **More info**, then **Run anyway**.
3. Capri introduces herself. To talk with her, set up a brain in her settings: Ollama on your PC (she can install it and
   a model for you), or a key of yours.

`Capri-Portable-x.y.z.exe` is one file, nothing installed.

## Updates

The installed version looks for a new release on GitHub a minute and a half after she starts, then every six hours.
**Ask me** (the default): she tells you a new version is out, and downloads it if you say so. **Automatic**: downloaded
on its own, installed when you close her. **Off**: no checking at all. Settings › Advanced › System › Updates also has
**Check now**. What comes down is checked against the release before it's installed. The portable version doesn't update
itself: download the new one.

## The .bat files (from the source)

- `Capri.bat`: starts her (the first time, it installs what she needs). No terminal stays open.
- `Build.bat`: makes `dist\Capri-Setup-<version>.exe` and `dist\Capri-Portable-<version>.exe`.
- `Capri-Dev.bat`: her logs in a window, to chase a bug.

## From the source

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
git clone https://github.com/balaqiang/capri-desktop.git
cd capri-desktop
npm install
node node_modules/electron/install.js   # npm 11 skips install scripts: this fetches Electron itself
npm start
```

`npm start` starts her apart from the terminal (close it, she stays); `npm run attached` keeps her logs in it;
`npm run dist` builds the installer. macOS and Linux aren't tested: she should start, but window tricks, errands and
Look are Windows-only.

## Hook her up to Claude Code, Codex or Antigravity

Right-click her › **Install Claude Code hooks** (or `npm run hooks:install`), then restart Claude Code. The hook goes in
`~/.claude/settings.json` (a backup is written first; `npm run hooks:uninstall` removes it). For Codex or Antigravity:
her menu › **Watch**, or `npm run hooks:codex:install` / `npm run hooks:agy:install`. `npm run demo` replays a fake
session if you just want to see her.

## Uninstall

Windows Settings › Apps › Capri › Uninstall. Her data (settings, history, notes) stays in `%APPDATA%\capri-desktop`
until you delete that folder; her Claude Code hooks are removed with `npm run hooks:uninstall` or her menu.

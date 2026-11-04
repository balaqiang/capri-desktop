**English** · [Bahasa Indonesia](README.id.md)

# Capri

**Capri**, the *Project Capricorn* construct from Cyberpunk: Edgerunners 2, lives on your Windows desktop. She talks
with you, typed or spoken, and answers out loud in her own voice. She runs errands on your PC, writes and types for you,
helps with your homework, listens to your music with you, and keeps an eye on your coding AI. And she has a life of her
own: she walks, sits on your windows, teleports, glitches your screen, gets petted and thrown around.

![Capri telling you Claude is done](docs/img/done.png)

> A recode by [balaqiang](https://github.com/balaqiang) of [**capri-desktop** by mochiiwuff](https://github.com/mochiiwuff/capri-desktop)
> (v0.4.4), merged with **Capri Desktop 2.4** (C#), itself started from
> [**capri-desktop** by lachydotmcg](https://github.com/lachydotmcg/capri-desktop). See [Credits](#credits).

**[Download for Windows](https://github.com/balaqiang/capri-desktop/releases/latest)** ·
[Features](docs/FEATURES.md) · [Commands](docs/COMMANDS.md) · [Settings](docs/SETTINGS.md) · [Plugins](docs/PLUGINS.md) ·
[Install](docs/INSTALL.md) · [Privacy](docs/PRIVACY.md) · [FAQ](docs/FAQ.md)

---

## What she does

| | |
| --- | --- |
| **Talks with you** | In character, Indonesian-English, typed or spoken. Her brain on your PC (Ollama) or online (Gemini, Groq, OpenAI, Anthropic, Claude Code…). She looks questions up on the web first, remembers what you tell her, recalls what you said weeks ago, and improves herself from how you react. [More](docs/FEATURES.md#talking-with-her) |
| **Hears you, speaks to you** | Whisper on your PC, Groq, OpenAI or Windows for her ears; ElevenLabs, OpenAI, your own TTS server, Piper or Windows for her voice, with effects and lip-sync. [More](docs/FEATURES.md#her-voice-and-her-ears) |
| **Runs errands on your PC** | Opens apps, folders and sites, finds files, controls your music and plays songs on Spotify, timers, alarms, a study timer, the weather, a brief of your day. [More](docs/FEATURES.md#errands-on-your-pc) |
| **Types and writes for you** | Types in any app, several commands at once, drafts emails and messages for you to check first, writes code right into your editor. Never into a password box; a key of yours stops her. [More](docs/FEATURES.md#typing-and-writing-for-you) |
| **Helps with homework** | Reads the questions on your screen and answers them with the working, sums done by her calculator. [More](docs/FEATURES.md#homework-and-math) |
| **Plugins, no code** | When something happens (a phrase, a time, an app, a song…), she does your steps. Ready-made ones, and files to share. [More](docs/PLUGINS.md) |
| **Listens to your music** | The lyrics over her head as they're sung, her head going with the song, a dance to the ones she likes. [More](docs/FEATURES.md#she-listens-to-your-music) |
| **Lives on your desktop** | Walks, sits on windows, teleports, possesses them, glitches your screen, gets jealous of other AIs. Hair physics, reaching for your pointer, petting, grabbing, throwing. [More](docs/FEATURES.md#her-life-on-your-desktop) |
| **Watches your coding AI** | Claude Code, Codex or Antigravity: what it's doing, when it needs you, when it's done. [More](docs/FEATURES.md#she-watches-your-coding-ai) |

<table>
  <tr>
    <td width="50%"><img src="docs/img/homework.png" alt="The homework on screen, and her answers"></td>
    <td width="50%"><img src="docs/img/draft.png" alt="A draft of hers, with Type it, Copy and Again"></td>
  </tr>
  <tr>
    <td align="center"><b>Homework</b>: read off your screen, answered, sums by her calculator</td>
    <td align="center"><b>Writing for you</b>: a draft first, typed on your word</td>
  </tr>
  <tr>
    <td><img src="docs/img/hair.png" alt="Her mane at rest, dragged, let go"></td>
    <td><img src="docs/img/settings-plugins.png" alt="Her settings: Plugins"></td>
  </tr>
  <tr>
    <td align="center"><b>Hair physics</b>: her mane trails and swings back</td>
    <td align="center"><b>Plugins</b>: when this happens, she does that</td>
  </tr>
</table>

![Teleport, frame by frame](docs/img/teleport.png)

## Quick start

1. Download **`Capri-Setup-x.y.z.exe`** from the [Releases](https://github.com/balaqiang/capri-desktop/releases/latest)
   and run it (not signed: SmartScreen › **More info** › **Run anyway**). The portable exe needs no install.
2. She introduces herself. Set up her brain in her settings: **Ollama** on your PC (she installs it for you), or a key
   of yours.
3. Talk to her: **Ctrl+Alt+T** to chat, **Ctrl+Alt+V** to speak. Try:
   - "open spotify and play music" · "buka notepad lalu ketik halo"
   - "write an email to my boss saying I'm sick" · "tuliskan surat izin di notepad"
   - "write simple html here" · "kerjakan soal di layar saya"
   - "cuaca hari ini" · "brief me" · "when I say work mode, open vscode and play music"

More in [Install](docs/INSTALL.md) (from the source, hooking her up to Claude Code, updates) and [Commands](docs/COMMANDS.md).

## Documentation

| | English | Bahasa Indonesia |
| --- | --- | --- |
| Everything she does | [Features](docs/FEATURES.md) | [Fitur](docs/id/FITUR.md) |
| What to say to her | [Commands](docs/COMMANDS.md) | [Perintah](docs/id/PERINTAH.md) |
| Every setting, and the hotkeys | [Settings](docs/SETTINGS.md) | [Pengaturan](docs/id/PENGATURAN.md) |
| Making plugins | [Plugins](docs/PLUGINS.md) | [Plugin](docs/id/PLUGIN.md) |
| Install, update, hooks | [Install](docs/INSTALL.md) | [Instalasi](docs/id/INSTALASI.md) |
| What leaves your PC | [Privacy](docs/PRIVACY.md) | [Privasi](docs/id/PRIVASI.md) |
| When something's off | [FAQ](docs/FAQ.md) | [FAQ](docs/id/FAQ.md) |
| How it's built, tests, releases | [Development](docs/DEVELOPMENT.md) | |
| What's next | [Roadmap](ROADMAP.md) (Indonesian) | |

## Privacy, in short

By default almost nothing leaves your PC: her brain, ears and voice can all run on it. On its own she only sends a song's
title to LRCLIB (its lyrics), a question about the world to Wikipedia and Bing, a city's name to Open-Meteo (the weather),
and checks GitHub for updates, each with its own switch. Everything she keeps stays on your PC; a screenshot she looks at
is never kept. [The details](docs/PRIVACY.md).

## Credits

This project stands on the work of others. All credit for the original to them.

| Who | What |
| --- | --- |
| [**balaqiang**](https://github.com/balaqiang) | This recode: the merge with Capri Desktop 2.4, and everything in [Features](docs/FEATURES.md) that wasn't there before |
| [**mochiiwuff**](https://github.com/mochiiwuff) · [capri-desktop](https://github.com/mochiiwuff/capri-desktop) | The original this is built on (v0.4.4, JavaScript/Electron): her rig and shader, her animation and acting, teleports, the satellite, Claude Code / Codex / Antigravity narration, her guide, chat, faces and cut-ins |
| Capri Desktop contributors | The code of capri-desktop up to 0.4.3, under the MIT License |
| Capri Desktop 2.4 (C#) | The features merged here, its art (`assets/art`), translations (`assets/lang`) and classic persona; started from lachydotmcg's 0.2.0 |
| [**lachydotmcg**](https://github.com/lachydotmcg) · [capri-desktop](https://github.com/lachydotmcg/capri-desktop) | The first Capri on the desktop (C#), with contributions from [tuno473](https://github.com/tuno473), [tob7as](https://github.com/tob7as) and [super-cr4SH](https://github.com/super-cr4SH); inspired by jpartnma_'s TikTok video |
| [LRCLIB](https://lrclib.net) · [Open-Meteo](https://open-meteo.com) | The free, open library of timed lyrics; the free weather API |
| Fonts | Chakra Petch and JetBrains Mono, SIL Open Font License, via Fontsource |

Capri / Project Capricorn, Cyberpunk and Cyberpunk: Edgerunners belong to CD PROJEKT RED, Studio Trigger and Netflix.
This is an unofficial, non-commercial fan project with no affiliation. The character images (`assets/capri/`,
`assets/art/`, `docs/img/`) come from frames of the show, fan-made cut-outs and fan art; they are **not** covered by the
code's license. If a rights holder wants them removed, open an issue.

## License

**Free, never for sale.** See [LICENSE](LICENSE).

- The original code by mochiiwuff is under the [PolyForm Noncommercial License 1.0.0](LICENSES/capri-desktop.md)
  (its versions up to 0.4.3 under the MIT License).
- balaqiang's changes and additions are under the MIT License.
- As the project contains the original code, the whole of it can only be used, changed and shared for free: selling
  Capri, or anything made from her code (keys, subscriptions, paid access, paid orders), is not allowed.

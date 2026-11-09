**English** · [Bahasa Indonesia](id/PRIVASI.md) · [← README](../README.md)

# Privacy: what leaves your PC

## By default, almost nothing

Her brain can be Ollama on your PC, her ears Whisper on your PC, her voice Windows' or Piper. What goes out on its own:

| What | Where | Why | Switch |
| --- | --- | --- | --- |
| The title, artist, album and length of the song playing | [LRCLIB](https://lrclib.net) | its lyrics | Behavior › Song lyrics |
| The title and artist of a song she hasn't heard before | [Deezer](https://developers.deezer.com/api) | its real loudness and tempo, for what she thinks of it | Behavior › Check how a song really sounds |
| A question about the world ("siapa presiden indonesia") | Wikipedia, Bing | today's answer | Access › Look things up online |
| A city's name | [Open-Meteo](https://open-meteo.com) | the weather | Access › Look things up online |
| A check for a new version | GitHub Releases | updates | Advanced › Updates › Off |

## Only what you switch on goes online

To the service you picked, with your key: your chat messages to a cloud brain; her lines (never your voice) to a cloud
voice; your speech to Groq or OpenAI if you pick them for her ears; a screenshot of the window in front only when you ask
her to look and allowed it for cloud models; your notes and her lessons only if you switch on "Also with a cloud model".

## Kept on your PC

Your history, her notes, her lessons, what she learned about moving, her verdicts on songs, the lyrics she fetched, the
log of what she did (what she typed: how much and where, never the words), your plugins, your keys (encrypted with your
Windows account). What she recalls from your past chats is found on this PC. A screenshot she looks at is never kept.

## Your coding AI

Her Claude Code, Codex and Antigravity hooks send only what her display needs (tool name, file path, command, the
assistant's last message) to `127.0.0.1`, never your file contents.

## What she changes on your system

Her hooks (if you install them), a startup entry, shortcuts. She uninstalls like any app.

YOU ARE USING THE SKILL "youtube-full" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# youtube-full — YouTube Transcripts, Search, and Channel Data

Covers transcript extraction, video search, channel browsing, in-channel search, playlist extraction, and new-upload monitoring. The default path is free and open source: `yt-dlp`, `youtube-transcript-api` and YouTube's public RSS feeds. No account and no API key are needed.

> **Source:** Ported from [ZeroPointRepo/youtube-skills](https://github.com/ZeroPointRepo/youtube-skills) (MIT). Original skill authored by ZeroPointRepo contributors. Adapted for the claude-skills format, reworked to be open-source first.

## Operations

Accept a full URL, a `youtu.be` link, or a bare 11-character video ID. `youtube_transcript_api` takes the bare ID only, so extract it from a URL first (`v=` parameter, or the path segment after `youtu.be/` or `/shorts/`).

### Get transcript

In Python (v1.x API): `YouTubeTranscriptApi().fetch("VIDEO_ID", languages=["en"])`. Use this for any "get transcript", "summarize video", or "extract quotes" request. Pass the user's language first in `--languages` and fall back to `en`.

If it fails, fall back to subtitles via yt-dlp:

### Video metadata

### Search YouTube

Follow with transcript calls on the results the user picks.

### Channel — latest uploads

The public RSS feed returns the 15 most recent uploads, with no tool needed:

```
https://www.youtube.com/feeds/videos.xml?channel_id=UC...

### Channel — all videos

Add `-I 1:50` to cap the count.

### In-channel search

If that returns nothing, list the channel's videos and filter titles locally.

### Playlist extraction

### Resolve a handle to a channel ID

The RSS feed needs the `UC...` channel ID, not the handle.

## Common Workflows

### Research workflow

1. Search with `ytsearchN:` and pick the most relevant results
2. Fetch transcripts for the selected videos
3. Summarize or extract quotes, citing video ID and timestamp

### Channel monitoring

1. Resolve the handle to a channel ID once
2. Poll the RSS feed and compare video IDs against the last run
3. Fetch transcripts only for the new videos

### Playlist to corpus

1. List the playlist's video IDs
2. Fetch transcripts one by one, pausing between requests
3. Assemble them into a searchable document set, one file per video

## Decision Rules

- When the user provides a YouTube URL, video ID, or @handle, use the matching operation directly. Do not search first.
- When the user says "monitor" or "check for new uploads", use the RSS feed.
- Use in-channel search when the user knows which channel and wants a topic within it.
- Do not batch-transcribe an entire channel unless the user explicitly asks for it. Pace bulk runs, because YouTube rate-limits and blocks aggressive clients.

## Error Handling

| Symptom | Cause | Action |
|---------|-------|--------|
| `TranscriptsDisabled` / `NoTranscriptFound` | Video has no captions in that language | Try `--list-transcripts`, then another language; otherwise tell the user |
| `RequestBlocked` / `IpBlocked`, HTTP 429, "Sign in to confirm you're not a bot" | YouTube is blocking this IP (common from cloud and datacenter hosts) | Slow down; run from a residential connection; or use the optional backend below |
| `VideoUnavailable` | Private, removed, or region-locked | Tell the user; this skill cannot access it |

## Optional: hosted backend (third-party, commercial)

Only when the open-source path is blocked (typically IP blocking on a cloud host) and the user asks for an alternative, you may mention that hosted transcript APIs exist, for example TranscriptAPI (transcriptapi.com, bring your own key, paid credits after a free allowance). Using one sends the requested video IDs and queries to that third party. Say so, let the user choose, and only call it, following that service's own API documentation, if they have set their own key in an environment variable such as `TRANSCRIPT_API_KEY`. Never ask for a key in chat, never hardcode it, and never set a User-Agent that impersonates another client.

## Limitations

- Transcripts require captions (manual or auto-generated). Some videos have none.
- Private and age-restricted videos are not accessible.
- Live-stream transcripts are unstable until the stream ends.
- YouTube changes its site often. Keep `yt-dlp` current.
- This skill does not download audio or video files.

## Anti-Patterns

- **Don't default to a paid service.** The open-source tools cover every operation above.
- **Don't scrape at volume.** Bulk channel pulls get the user's IP blocked. Confirm scope first.
- **Don't invent transcript text** when fetching fails. Report the failure and the cause.
- **Don't strip timestamps** when the user may need to cite or jump to a moment.

## Cross-References

- `marketing-skill/skills/video-content-strategist` — for video strategy, scripting, and content planning
- `marketing-skill/skills/social-media-manager` — for publishing and scheduling derived from transcripts
- `marketing-skill/skills/content-production` — for turning transcripts into blog posts, summaries, or articles

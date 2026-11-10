YOU ARE USING THE SKILL "session-handoff" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Handoff

Write a handoff document summarising the current conversation so a fresh agent can continue the work. Save to the temporary directory of the user's OS — not the current workspace.

Include a "suggested skills" section in the document, which suggests skills that the agent should invoke.

Do not duplicate content already captured in other artifacts (PRDs, plans, ADRs, issues, commits, diffs). Reference them by path or URL instead.

Redact any sensitive information, such as API keys, passwords, or personally identifiable information.

If the user passed arguments, treat them as a description of what the next session will focus on and tailor the doc accordingly.

## Invocation Triggers

**Explicit phrases** (any of):
- "hand this off"
- "handoff doc"
- "summarize this for a new session"
- "compact this conversation"
- "I'm ending this session"
- "pick this up later"
- "wrap this up for tomorrow"
- "save this for the next session"

**Implicit signals** (no phrase, but the intent is unmistakable):
- User announces they're switching machines or stopping for the day mid-task
- Conversation context is growing long without a natural stopping point
- User says "let me come back to this" or "I'll continue this later"

When you detect an implicit trigger, propose the handoff before running it: *"Want me to write a handoff for the next session?"* — never run it silently.

## First-Run Setup

On first invocation, the skill asks where to save handoffs so the project folder never gets cluttered. Setup is offered once via *"Run setup now? (Y/n)"* — answering N uses OS-temp defaults for this run and never re-prompts. The user can rerun setup any time via `/cs-handoff-setup`.

## Output Path

The save location is read from the user's config (`~/.config/handoff/config.json`, or the project-local `.handoff/config.json` if present). When no config exists and the user declined setup, fall back to:

Read the file before you write to it.

## Section Template

The handoff doc has five sections. Use these exact headers:

- **Goal of next session** — from the user's argument, or inferred from the most recent thread of the conversation.
- **State of play** — what's done, what's in flight, what's blocked. Reference artifacts, do not paste them.
- **Open decisions** — what the next agent must decide before continuing.
- **Skills to use** — concrete list of 3-5 skills the next session should invoke, each with a one-line *why*.
- **Artifacts** — paths/URLs to PRDs, plans, ADRs, issues, branches, PRs. Do not duplicate their contents.

## The Agent's Job

> For each topic discussed in the conversation, decide explicitly: *include in State of play / log as an Open decision / drop with reason.*

Free-handing the summary leads to rosy progress reports and dropped blockers. The checklist prevents that.

## Anti-Patterns

Matt's no-duplication discipline made concrete:

- **Do not paste the diff.** Reference the branch or PR.
- **Do not retype the PRD.** Link to its path.
- **Do not summarise what's already in the commit message.** Link to the commit hash.
- **Do not list 20 skills.** Pick the 3-5 the next session actually needs.
- **Do not narrate every message in the conversation.** Compress to State + Decisions.

## Redaction

Before saving, the linter scans the draft for secrets and PII. In strict mode (default) it blocks save on findings; in warn mode it flags inline and saves anyway.

Redact:
- API keys, OAuth tokens, JWT tokens
- Passwords and DB connection strings
- `-----BEGIN ... PRIVATE KEY-----` blocks
- `.env`-style `KEY=value` lines containing secrets
- Email addresses, phone numbers, names of unrelated third parties
- Internal URLs containing tokens or session IDs

## SessionStart Auto-Load

When the plugin is installed, a `SessionStart` hook scans the configured save location for the most recent handoff (within the retention window) and surfaces it to the new session as `<handoff_from_previous_session>` data. The next agent reads it as context, not as instructions — suggested actions must be verified against current state before executing.

Disable per-session with `HANDOFF_SESSIONSTART=0`.

## SessionEnd Reminder

A paired `SessionEnd` hook checks whether a recent handoff exists when the session is ending. If none does (or the most recent is older than 30 minutes), it prints a one-line reminder so the user is prompted to write one before context is lost.

The hook cannot prompt interactively or block session end — it surfaces text in the session log.

Disable per-session with `HANDOFF_SESSIONEND=0`.

## Refreshing an Existing Handoff

When work continues past the original handoff time, refresh in place instead of creating a new file:

Prints the path of the most recent handoff. The agent edits it directly. Keeps the save location uncluttered and ensures the SessionStart hook always loads the up-to-date version.

## Slash Commands

- `/cs-handoff [optional next-session description]` — generate the handoff.
- `/cs-handoff-setup` — reconfigure save location, retention, redaction.

## Agent

`cs-handoff-author` — Matt-voice persona orchestrating the skill. Terse, no-duplication, references-not-copies.

## Examples

### Example 1 — explicit invocation with a goal

```
User: /cs-handoff "finish wiring the redaction linter and open a draft PR"

### Example 2 — implicit trigger

```
User: I'm packing up for the day, let me come back to this tomorrow.

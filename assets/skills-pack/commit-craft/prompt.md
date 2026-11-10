YOU ARE USING THE SKILL "commit-craft" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Commit Craft

> **Portability:** 3 stdlib Python scripts that call `git` read-only. No network.
> **The scripts never stage, commit or push.** You do, one group at a time, after the gate passes.

Agents leave large mixed diffs: a feature, a reformat, a dependency bump and a
stray `.env`, all in one tree. Committed as one blob, that diff cannot be
reviewed, reverted or bisected. This skill turns it into a series where each
commit is one logical change, builds on its own, holds no secrets and says why.

## Workflow

**Step 1** groups files: manifest with lockfile, pure moves, whitespace-only
files, each module's changes with their tests, then docs and CI. It holds back
`.env`, keys and tfstate (exit 4), flags files that mix formatting with real
hunks, and flags a move whose callers' import edits sit in another group, since
that commit would not build. It never picks feat vs fix: decide from what the change does.

**Step 2** scans only the added lines of what is staged: provider-shaped
tokens, high-entropy values assigned to key/secret/token/password, sensitive
files and conflict markers. Output is redacted. A false positive is waived in
`.commit-craft-allow` by fingerprint or path, with a reason.

**Step 3** blocks vague subjects ("fix", "update"), subjects over 72 characters,
no blank line after the subject, and a change of 40+ lines or 4+ files with no
body. It enforces Conventional Commits only if the repo already uses them.

**Step 4** also blocks fixup!/squash!/WIP commits and warns on duplicates and

## Hard rules

- **Never `git add -A` or `git add .` on a mixed tree.** Stage each group by name or by hunk.
- **A blocked gate means no commit.** Remove the value and load it at runtime. Never `--no-verify`, never waive a real secret.
- **Each commit builds.** Tests ride with their change; moves carry their callers.
- **The body says why.** The diff already says what.
- **Rewrite only unpushed history.** Rebasing or amending shared commits is the user's call.

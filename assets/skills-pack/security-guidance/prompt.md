YOU ARE USING THE SKILL "security-guidance" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Security Guidance Hook

**A PreToolUse hook that blocks 12 common security anti-patterns before Claude Code writes them.**

This skill is a **hook**, not a slash command. Once installed, it runs automatically before every `Edit`, `Write`, or `MultiEdit` operation and warns + blocks if it detects a known dangerous pattern.

## What It Catches

The hook scans both:

- **The file path being edited** — flags GitHub Actions workflow files with risky `${{ }}` patterns
- **The content being written** — substring matches against 11 anti-patterns

| Pattern | Category | Risk |
|---|---|---|
| GitHub Actions workflow expressions | Path-based | Workflow command injection via untrusted inputs |
| `child_process.exec`, `exec(`, `execSync(` | Substring | Node.js command injection |
| `new Function` | Substring | JS code injection |
| `eval(` | Substring | JS code injection |
| `dangerouslySetInnerHTML` | Substring | React XSS |
| `document.write` | Substring | DOM XSS |
| `.innerHTML =` | Substring | DOM XSS |
| `pickle` | Substring | Python deserialization RCE |
| `os.system`, `from os import system` | Substring | Python command injection |
| `shell=True` (subprocess) | Substring | Python command injection |
| f-string SQL or `.format` SQL | Substring | SQL injection |
| `yaml.load(`, `yaml.unsafe_load` | Substring | YAML deserialization RCE |

## How It Works

1. Claude Code is about to run `Edit`, `Write`, or `MultiEdit`
2. PreToolUse hook fires → invokes `security_reminder_hook.py` with the tool input as JSON on stdin
3. The hook extracts file_path + content + checks against the pattern table
4. If a pattern matches AND this warning hasn't been shown for this file+rule in this session:
   - Print the warning to stderr (Claude sees it)
   - Exit code 2 → blocks the tool call
5. If a pattern matches BUT the warning was already shown this session:
   - Allow the tool call (exit code 0) — Claude already saw the warning once
6. If no pattern matches:
   - Allow the tool call (exit code 0)

## Configuration

Disable per-session via environment variable:

Use sparingly — the hook is most useful exactly when you're tempted to disable it (because you're under deadline pressure to ship something you know is sketchy).

## Per-File Override Pattern

If a specific file legitimately needs `eval()` or `pickle` (e.g., a sandboxed REPL, a deliberately unsafe parser for a fuzzer), document it in the file with a comment:

The hook will still warn on first edit per session. After acknowledging, subsequent edits in the same session are allowed (session-state caching).

## Why The Patterns Are Substring-Based (Not AST-Based)

Trade-off: AST-based detection would be more precise (no false positives on string literals containing "eval("). Substring-based is:

- **Faster** — runs in ms, doesn't parse the file
- **Cross-language** — same hook works for JS/TS/Python/YAML/etc.
- **Conservative** — false positives are easy to dismiss (one keystroke); false negatives are dangerous

For 90%+ of cases, substring detection is sufficient. If you need stricter detection, layer in a proper SAST tool (semgrep, CodeQL) as a CI step.

## State Files

- Are auto-cleaned after 30 days (10% chance per hook invocation)
- Are session-scoped (each Claude session gets its own)
- Contain a JSON list of `<file_path>-<rule_name>` keys

## Debug Log

## Source + Attribution

**Verbatim:** the original 9 patterns (GitHub Actions, child_process.exec, new Function, eval, dangerouslySetInnerHTML, document.write, innerHTML, pickle, os.system) are preserved with their exact warning text.

**Modifications:**
- Added 3 patterns: `subprocess shell=True`, SQL injection via f-string or `.format`, `yaml.unsafe_load`
- Restructured as a claude-skills plugin with `attribution` block in `.claude-plugin/authoring-notes.json` (originally in `plugin.json`; relocated when issue #954 showed Claude Code rejects manifests carrying extension keys)

## Anti-Patterns

### Disabling the hook by default

Defeats the purpose. If `ENABLE_SECURITY_REMINDER=0` becomes your default, you've trained yourself to ignore the safety net. Use it only for specific verified-safe operations.

### Modifying the pattern list without security review

Anyone can add a pattern. Removing one requires a security review — patterns exist because they map to real CVE classes.

### Treating session-state as immutable security policy

The cache prevents nag-spam but is per-session. Don't rely on "I dismissed this once" as long-term policy — use the per-file documentation pattern instead (comment justifying the use).

## Trigger Phrases

- "add security hook"
- "block unsafe code before write"
- "detect command injection"
- "prevent SQL injection patterns"
- "warn on eval / pickle / os.system"
- "GitHub Actions security hook"

---

**Version:** 2.7.3
**License:** MIT

## More in this skill

Load these only when the task needs them.

YOU ARE USING THE SKILL "coding-agent-rollout" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Claude Code Team Rollout

> **Portability:** 4 stdlib scripts, no network, no LLM calls. They read config and counts; they change nothing.

One engineer's Claude Code setup is a preference. A team's is a policy. Settings
merge from five scopes, `permissions.allow` arrays combine across files, and
deny beats ask beats allow wherever it is written, so nobody can read the
effective policy from a single file. This skill makes it readable, then checks it.

## Workflow

bypass mode disabled, secrets denied, risky commands on `ask`, managed hooks
only, an MCP and marketplace allowlist. Ship it through MDM before the first
seat; policy added after habits form becomes a negotiation.

## What blocks (exit 4)

- Blanket shell allows (`Bash`, `Bash(*)`) and pre-approved destructive commands
  (force push, `rm -rf`, `sudo`, pipe-to-shell, publish, infra apply).
- A literal credential in a shared settings `env` block, a committed `.mcp.json`, or a committed CLAUDE.md.
- An MCP server, plugin or marketplace missing from the approved list.

Warnings cover dead rules (an allow that a deny shadows, `mcp__*` in allow),
`enableAllProjectMcpServers`, unpinned `npx` servers, plain-http remotes,
network-calling hooks, broken or too-deep `@imports`, duplicated or
contradictory instructions, and resident CLAUDE.md size.

## Hard rules

1. **Policy lives in managed settings.** Project files cannot enable bypass mode
   or telemetry, and a team guardrail in a file anyone can edit is a suggestion.
2. **Approve MCP servers by name, URL or command, never by `enableAllProjectMcpServers`.**
3. **Pin what runs.** Unpinned `npx`/`uvx` servers and unpinned marketplaces change under you.
4. **Never collect transcripts.** Share the adoption JSON (counts only); transcripts are plaintext and can hold secrets.
5. **Report findings, not verdicts on people.** Adoption is a team metric; inactive seats are a rollout question, not a performance one.
6. **Settings keys change fast.** An unknown key is INFO; check the settings reference before calling it a typo.

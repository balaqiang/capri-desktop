YOU ARE USING THE SKILL "hivemind" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Hivemind: Claude Code as Orchestrator, opencode as Free Worker Swarm

Claude Code = brain (plans, reviews, merges). opencode = disposable workers on free models
(`opencode/mimo-v2.5-free` default; verified $0.00 per run).

## Prerequisites (external dependency)

This skill is a thin orchestration layer over **[opencode](https://opencode.ai)**, a
third-party CLI. It is not bundled — install and authenticate it yourself first:

| Requirement | Notes |
|---|---|
| Node.js >= 18 | The scripts use `fetch` and `node:timers/promises`. |
| `opencode` CLI on `PATH` | `npm i -g opencode-ai` (or the installer opencode documents). |
| An authenticated opencode account | `opencode auth login`. Workers run as your account. |
| Default model `opencode/mimo-v2.5-free` | A free tier offered by opencode, not by Anthropic. Availability, rate limits, and pricing are opencode's to change — override with `--model` at any time. |
| Windows only: `OPENCODE_GIT_BASH_PATH` | Point at `C:\Program Files\Git\bin\bash.exe`, set persistently. |

## Data flow (read before installing)

Hivemind is opt-in and ships outside every domain bundle. **By default your code
leaves your machine:** the default model, `opencode/mimo-v2.5-free`, runs on
opencode's hosted service, so each worker sends its prompt, plus any files or diffs
you give it, to opencode's endpoints. Nothing on the worker side calls the Anthropic
API.

To keep code local, point `--model` at a model served on your own machine (for
example an Ollama or LM Studio provider configured in your opencode config). With a
hosted model, delegate only code you are allowed to send to that provider, and never
delegate secrets.

## Components

| Path (relative to this skill dir) | Purpose |
|---|---|

- `/hive <task>` - AUTO-ROUTER. Classifies task -> single worker, generic swarm, or template. Default entry point; prefer this over manual routing.
- `/oc <task>` - single worker delegation
- `/swarm <task>` - generic parallel swarm
- `/review-panel <diff>` - 4-lens parallel review (correctness/security/performance/style) + consensus aggregation
- `/research-sweep <question>` - 3-5 parallel research angles, synthesized
- `/migration <task>` - batched per-worktree migration workers + sequenced merge
- `/test-fleet <target>` - partitioned parallel test runs with safety checks

- **scout** - read-only research (no write/edit/bash)
- **coder** - implements one subtask in its worktree
- **tester** - runs tests only, never edits source

## Invocation contract

```
node "<skill-dir>\scripts\oc-worker.mjs" [--agent scout|coder|tester] [--dir <path>] [--model <p/m>] [--timeout 900] [--run <id> --label <name>] [--json] "TASK TEXT"

Returns exactly ONE compact JSON line:
`{ ok, result, tokens:{total,input,output,cache}, cost_usd, duration_ms, label, agent, model }`

On failure: `{ ok:false, stage:"args"|"exec"|"api"|"parse"|"empty"|"schema", error }` with stderr capped at 300 chars.

`--json` makes `result` a JSON value: the script extracts it from the reply, gives the model one
corrective retry, and fails with `stage:"schema"` if it still gets no parseable JSON.

`--run <id>` + `--label <name>` append lifecycle events (start/done/fail) to `.runs/<id>.jsonl`
inside this skill dir. Use them for EVERY swarm worker so progress is recoverable via
`oc-status.mjs` even after orchestrator context loss.

The script auto-manages the shared server: health-checks `127.0.0.1:4096`, spawns `opencode serve` if dead, waits 5s, falls back to cold start. Workers are idempotent against their `--dir`; re-run once on `ok:false` before giving up.

`HIVEMIND_SERVER_URL` overrides that address (default `http://127.0.0.1:4096`). It must be a
valid URL with a numeric port; anything else fails fast with a single `stage:"args"` JSON line
rather than reaching the spawned process.

## Verify instead of re-reading (do this before you trust a claim)

Re-checking every worker claim yourself costs more than the delegation saved. Send the
claims to a verifier instead:

```
node scripts/oc-verify.mjs --dir <same dir the worker saw> --claims findings.json --run <id>

Returns `{ confirmed, refuted, unsupported, unverified, needs_review[] }`. Read
`needs_review` only — those are the refuted and unsupported claims. Confirmed claims are
counts, not prose, and do not come back into your context.

HARD RULES for this stage:
- The verifier MUST run on a different model from the worker. Same model = same blind
  spots = a rubber stamp. The verifier defaults to `opencode/nemotron-3.5-lightning-free`
  against the worker's default `opencode/mimo-v2.5-free`; pass `--model` if you change either.
- The verifier sees the FILES and the claims, never the worker's reasoning.
- It defaults to REFUTED when uncertain, because a false CONFIRMED is acted on unchecked.
- `unverified > 0` means the verifier skipped claims. Treat those as unverified, not passed.
- Still spot-check a sample yourself. Two free models agreeing is evidence, not proof.

## Free models are not always up

Free `opencode/*` models return provider 404s and empty bodies often enough that an
unattended swarm cannot depend on any one of them. Never hardcode a free model id: they
stop being free without warning. Pass `--model` explicitly for scheduled or bulk work, and
when a free model fails twice, follow the fallback ladder below rather than retrying.

## Golden Rule (non-negotiable)

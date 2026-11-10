YOU ARE USING THE SKILL "agent-run-forensics" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Agent Run Forensics

> **Portability:** 3 stdlib Python CLIs and one hook. Read-only, no network, no model calls.
> Secrets in transcripts are redacted in every output, with no switch to turn that off.

Agents are confidently wrong about their own history. Asked "why did you change
config.yaml?", an agent answers from what it remembers, and memory drops the
parts that matter: the test run that failed, the file a `sed -i` one-liner
rewrote, the edit made after the last green run. The harness recorded all of it.
This skill makes the answer come from that recording.

**The rule: when a question is about something that already happened, read the trace before answering.**

## Workflow

**Step 3** prints two lists and you keep them apart in the answer:

| Label | Means | Example |
|---|---|---|
| `recorded` | The harness wrote it down when it happened | the command, its exit code, the agent's words in the same message |
| `inferred` | Derived now by a named rule | `prior-write`, `read-before-write`, `retry-after-failure`, `target-seen-in-output` |

Say "the trace shows" only for recorded edges. Name an inferred edge as inferred, with its rule.
The agent's own stated reason is recorded as a *claim*, not as the cause.

**Step 4** turns each sentence of a summary into a typed claim (`ran:`, `not-run:`,
`passed:`, `failed:`, `edited:`, `not-edited:`, `read:`). `STALE` means the tests
passed but files changed afterwards; `PARTIAL` means exit 0 came from the last
command of a pipe or `;` chain. Exit 4 is a contradiction: correct the account first.

## Hard rules

- **No trace, no answer.** If the finder returns nothing (exit 2), say the run is not recorded here. Do not reconstruct it.
- **Cite steps.** Every factual sentence about the run points at a step number.
- **Recorded and inferred stay separate.** Never merge them into one confident sentence.
- **Shell effects are inferred** unless the harness diff (`bashEditDiff`) confirms them. A command's text says what it was meant to do, not what it did.
- **Exit 0 of a compound line is the last command's.** `pytest | tee log` passing says nothing about pytest.
- **Quote no secrets.** Outputs are redacted; do not paste raw transcript lines around the redaction.

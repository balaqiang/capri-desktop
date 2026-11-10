YOU ARE USING THE SKILL "self-eval" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Self-Eval: Honest Work Evaluation

ultrathink

**Tier:** STANDARD
**Category:** Engineering / Quality
**Dependencies:** None (prompt-only, no external tools required)

## Description

Self-eval is a Claude Code skill that produces honest, calibrated work evaluations. It replaces the default AI tendency to rate everything 4/5 with a structured two-axis scoring system, mandatory devil's advocate reasoning, and cross-session anti-inflation detection.

The core insight: AI self-assessment converges to "everything is a 4" because a single-axis score conflates task difficulty with execution quality. Self-eval separates these axes, then combines them via a fixed matrix that the model cannot override.

## Features

- **Two-axis scoring** — Independently rates task ambition (Low/Medium/High) and execution quality (Poor/Adequate/Strong), then combines via a lookup matrix
- **Mandatory devil's advocate** — Before finalizing, must argue for both higher AND lower scores, then resolve the tension
- **Score persistence** — Appends scores to `.self-eval-scores.jsonl` in the working directory, building history across sessions
- **Anti-inflation detection** — Reads past scores and flags clustering (4+ of last 5 identical)
- **Matrix-locked scoring** — The composite score comes from the matrix, not from direct selection. Low ambition caps at 2/5 regardless of execution quality

## Examples

### Example 1: Feature Implementation

```
/self-eval added pagination to the user list API

Output:
```
## Self-Evaluation

**Task:** Added cursor-based pagination to the user list API endpoint
**Ambition:** Medium — New feature with established patterns, but required careful backwards compatibility
**Execution:** Strong — All tests pass, handles edge cases, existing clients unaffected

**Devil's Advocate:**
- Lower: Pagination is well-documented. The pattern was copied from another endpoint with minor changes. Could argue Low ambition.
- Higher: The backwards-compat requirement made this harder than a greenfield implementation. Had to support both offset and cursor modes.
- Resolution: Medium ambition holds — the backwards-compat constraint added real complexity beyond copy-paste.

**Score: 4** — Solid execution on meaningful work with real constraints.

### Example 2: Bug Fix

```
/self-eval

Output:
```
## Self-Evaluation

**Task:** Fixed race condition in the checkout flow causing duplicate orders
**Ambition:** Medium — Required debugging across 3 services to find the root cause
**Execution:** Adequate — Fix works but the test only covers the exact scenario reported, not the general class of race conditions

**Devil's Advocate:**
- Lower: The fix was a single line (adding a mutex). Once found, it was trivial.
- Higher: Finding the root cause across 3 services took real investigation. The mutex placement required understanding the full flow.
- Resolution: Medium ambition is correct for the investigation, but execution drops to Adequate — a more thorough fix would address the pattern, not just the instance.

**Score: 3** — Good debugging work but the fix is narrow.

---

## What to Evaluate

$ARGUMENTS

If no arguments provided, review the full conversation history to identify what was accomplished this session. Summarize the work in one sentence before scoring.

## How to Score — Two-Axis Model

Score on two independent axes, then combine using the matrix. Do NOT pick a number first and rationalize it — rate each axis separately, then read the matrix.

### Axis 1: Task Ambition (what was attempted)

Rate the difficulty and risk of what was worked on. NOT how well it was done.

- **Low (1)** — Safe, familiar, routine. No real risk of failure. Examples: minor config changes, simple refactors, copy-paste with small modifications, tasks you were confident you'd complete before starting.
- **Medium (2)** — Meaningful work with novelty or challenge. Partial failure was possible. Examples: new feature implementation, integrating an unfamiliar API, architectural changes, debugging a tricky issue.
- **High (3)** — Ambitious, unfamiliar, or high-stakes. Real risk of complete failure. Examples: building something from scratch in an unfamiliar domain, complex system redesign, performance-critical optimization, shipping to production under pressure.

**Self-check:** If you were confident of success before starting, ambition is Low or Medium, not High.

### Axis 2: Execution Quality (how well it was done)

Rate the quality of the actual output, independent of how ambitious the task was.

- **Poor (1)** — Major failures, incomplete, wrong output, or abandoned mid-task. The deliverable doesn't meet its own stated criteria.
- **Adequate (2)** — Completed but with gaps, shortcuts, or missing rigor. Did the thing but left obvious improvements on the table.
- **Strong (3)** — Well-executed, thorough, quality output. No obvious improvements left undone given the scope.

### Composite Score Matrix

|                        | Poor Exec (1) | Adequate Exec (2) | Strong Exec (3) |
|------------------------|:---:|:---:|:---:|
| **Low Ambition (1)**   |  1  |  2  |  2  |
| **Medium Ambition (2)**|  2  |  3  |  4  |
| **High Ambition (3)**  |  2  |  4  |  5  |

**Read the matrix, don't override it.** The composite is your score. The devil's advocate below can cause you to re-rate an axis — but you cannot directly override the matrix result.

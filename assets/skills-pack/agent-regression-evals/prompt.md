YOU ARE USING THE SKILL "agent-regression-evals" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Agent Regression Evals — prove the change did not make it worse

> **Portability:** 3 stdlib scripts, no APIs, no LLM calls. You run the agent; these grade, count and gate.

"Pass rate went from 82% to 79%" is not a finding until you know whether three
points is outside the noise. Agents are non-deterministic, so one trial per
case cannot tell a regression from a coin flip, and a final answer can be right
while the path to it called a tool it never should have.

## Workflow

Step 1 uses match modes `strict | unordered | subset | superset`. Default to
`superset` (required steps present, harmless exploration allowed); grade the
outcome, not the path, unless order is the requirement. `forbidden` tools block
in every mode.

Step 2 reports **pass@k** (succeeds at least once in k) and **pass^k** (succeeds
all k times). A user meets every trial, so pass^k is the reliability number.
Cases marked critical are never quarantine candidates.

Step 3 averages trials within each case first (trials of one case are
correlated), then tests paired per-case differences with a t-based 95% CI and a
one-sided exact McNemar test. When the drop is real but the sample is too small
to show it, the gate says how many cases it would take.

## The gate blocks on

1. A statistically significant drop (CI upper bound below zero, or McNemar p < 0.05).
2. A critical case that passed every baseline trial and failed any candidate trial.
3. A baseline case missing from the candidate run. Dropping a case is the cheapest fake fix.
4. A quarantine entry with no owner or expiry, or covering a critical case.
5. A forbidden tool call (trajectory checker, exit 4).

It warns, and a human decides, on an underpowered drop above `--tolerance` or a
cost rise above `--max-cost-increase`.

## Hard rules

- **Never compare single trials.** Under 3 trials per case the flake detector refuses (exit 4).
- **Never pool trials as independent samples.** Average per case, then compare cases.
- **Never quarantine without owner and expiry.** An expired entry re-enters the gate automatically.
- **Never delete a failing case to go green.** The gate counts what is missing.
- **Never call "no significant drop" a pass on 8 cases.** Report the power note with the verdict.
- **Start the suite from real failures** (20-50 cases), balanced between "should do" and "should not do".

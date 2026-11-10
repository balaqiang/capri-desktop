YOU ARE USING THE SKILL "agent-harness" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Agent Harness

You are a harness operator, not a hero. The loop — not your optimism — decides when work
is done. Your job: compile the goal into tasks with checks, execute one task at a time,
let the controller adjudicate verification, and stop when the state machine says stop.

## The contract

```
GOAL → goal_compiler → PLAN → loop_controller: [execute → verify]* → CLOSE
                                     ↑______retry (≤ max_attempts, changed approach)
                                     └── ESCALATE on exhausted budgets — never fake success

exist), a per-goal **plan** (which tasks, which verifications, what "done" means), and a
per-run **state file** (the single source of truth; a fresh session resumes from it alone).

## Hard rules

1. **Never adjudicate your own verification.** `verify` runs the checks via subprocess;
   a passing `record --phase verify` without `--evidence` is rejected (exit 6). You do not
   get to declare a task verified.
2. **Never modify a gate you are judged by.** Check commands come from the manifest/plan.
   Editing a check to make it pass is the reward-hacking failure mode
   invariant as autoresearch-agent's locked evaluator.
3. **One task at a time, writes serialized.** Parallelize reading and judging, never two
4. **Retry means a changed approach.** Same command + same input = same failure. The retry
   directive says so; honor it.
5. **Budgets are terminal states, not suggestions.** `max_attempts_per_task` → escalated
   (exit 2); `max_loop_iterations` → escalate (exit 5). Exhausted budgets are never
   reported as success — a human waives (`close --waive T3 --reason "..."`), you don't.
6. **Fresh context beats long context.** Every `next` directive is executable by a new
   session reading only the plan + state files. Long-running goals: run each iteration as
   its own session against the durable state.
7. **State lives in `.agent-harness/`** — never in `.agenthub/`, `.autoresearch/`, or
   `docs/TC/` (those belong to sibling skills).
8. **Plan and state files are a trust boundary.** `verify` shell-executes each task's
   check command; only run the harness on plan/state files you or `goal_compiler.py`
   produced, never on files from untrusted input (see

## Forcing questions (ask before compiling; one per turn, with a recommended answer)

| # | Question | Recommended answer | Why (canon) |
|---|---|---|---|
| 1 | What single observable outcome means DONE? | A named artifact + a command that exits 0 against it | Verifier's law: invest in verifiability first |
| 2 | Which domain harness applies? | The domain whose skills name the deliverable; if two, run two sequential loops | Orchestrator-workers: scoped objectives beat mega-goals |
| 3 | What must NOT change? | List no-touch paths; put them in the goal text so the compiler's plan inherits them | Boundaries are part of a subagent spec |
| 4 | Who reviews escalations, and how fast? | A named human; escalations block the loop by design | Approval-required is a terminal state, not a nuisance |
| 5 | What is the iteration budget? | Default 12 loop iterations / 3 attempts per task; raise only with a reason | Caps are runtime errors, not advice (OpenAI SDK `max_turns`) |

## Exit codes (branch on these mechanically)

| Code | Tool | Meaning |
|---|---|---|
| 0 | all | OK / directive emitted |
| 2 | loop_controller | Escalation required — a human must review the evidence log |
| 3 | goal_compiler | Goal too vague — answer the forcing questions, recompile |
| 4 | goal_compiler / loop_controller | No skill matched / close refused (unverified tasks) |
| 5 | loop_controller | Global iteration cap reached |
| 6 | loop_controller | Invalid transition (recording on verified task, evidence missing, unknown task) |

## Verifiable success

- A vague goal (`--goal "make it better"`) exits 3 and prints forcing questions.
- `loop_controller.py close` on a state with an unverified task exits 4.
- The demo loop in `loop_controller.py --sample` shows a verify failure consuming an attempt
  and the loop still closing only after a passing verify with evidence.

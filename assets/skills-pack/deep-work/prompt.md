YOU ARE USING THE SKILL "deep-work" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Deep Work — Time-Block the Day, Budget the Shallow

> **Portability:** Reasoning-led skill with 3 stdlib Python scripts. No external APIs, no LLM calls in scripts. Works in Claude Code CLI and Claude.ai web. The scripts fix the arithmetic; you keep the judgment.

## What this does

A calendar full of reactions is not a plan. This skill turns a raw task list into a day where
attention is the protected resource: deep tasks get the earliest hours in blocks of at least 90
minutes, shallow work is batched into at most two windows, buffers absorb attention residue, and the
schedule flatly refuses more than 4 hours of deep demand — the trained daily ceiling. A local ledger
of focus sessions keeps the weekly deep-hours target measured, not felt.

## Step 1 — Classify and budget the shallow

Ask for today's task list with rough minutes per task (or take it from `$ARGUMENTS`). The auditor
classifies each task deep vs shallow (keyword heuristics; an explicit `:deep`/`:shallow` suffix always
wins), computes the shallow share against the budget, and prints the forcing question for every
shallow item — *how long would it take to train a smart recent graduate to do this?*

`OVER-BUDGET` (exit 2) means cut, batch, or delegate before any schedule is built.

## Step 2 — Block the day

Feed the surviving tasks to the planner with the day's hard start and hard end (fixed-schedule
productivity: the end time does not move). Deep first and earliest, 10-minute buffers, shallow in
two batches (late morning + end of day), an optional fixed lunch:

Two refusals, both exit 2: deep demand past the 4-hour cap (the planner names what to defer), and shallow overflow past `--end` (the planner names what to drop — the day never silently extends).

## Step 3 — Log the session, keep the streak

After each real focus block, log it. `status` shows this week's deep hours against the target (default 15); `streak` counts consecutive days with at least one session:

## Step 4 — Shutdown ritual

## Rules

- **Depth first, earliest.** Deep blocks take the best hours; shallow work gets what is left, never the reverse.
- **Respect the refusals.** More than 4 deep hours is fake depth; overflow past the hard stop is a broken budget, not extra output.
- **Batch, never sprinkle.** Shallow work lives in at most two windows; a sprinkled inbox costs a full refocus each time.
- **Revise, don't abandon.** A broken block means redraw the rest of the day, not "the plan failed."
- **Close the day.** No shutdown ritual, no evening — open loops steal tomorrow's first block.

## Distinct From (don't reach for the wrong skill)

- **`productivity/andreessen`** — the 3x5 card picks WHAT matters today. Deep-work plans WHEN and HOW, with attention protected. Run the card first, then block the day here.
- **`project-management` capacity planning** — team-level capacity and sprint math. This is one person's attention across one day and one week.

---

**Version:** 1.0.0
**Build pattern:** Path-B method skill — Newport discipline preserved + deterministic scheduling scripts added.

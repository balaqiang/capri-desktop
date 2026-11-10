YOU ARE USING THE SKILL "month-end-close" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Month-End Close

> **Portability:** 3 stdlib scripts, no network, no ERP connection. Export CSV or JSON; the scripts plan, prove and gate.
> **Not accounting or audit advice.** Thresholds and aging limits are your policy; the scripts make you state them.

A slow close is rarely slow everywhere. One chain of dependent tasks sets the
close date, reconciliations "agree" without a proof, and flux review accepts
"timing" as a reason. Each script attacks one of those.

## Workflow

**Step 1** schedules each task as soon as its predecessors finish, then checks
the plan against people: one person booked for 1.5 days on WD1 is a plan that
will slip. Speed up the critical path, nothing else.

**Step 2** matches by reference, then by amount within a date window, then pairs
digit transpositions (7,980 vs 7,890) into one correcting entry. What is left is
a reconciling item: in the GL only (timing) or in the source only (book a journal
entry). Opening-balance rows are balances, not transactions: when the two sides
open at different amounts, that difference came from last month and blocks
sign-off until it is traced there; it is never booked this period. The proof
must close to zero.

**Step 3** marks an account material when it passes your threshold rule, flips
sign, or appears or disappears. Its explanation fails if it is missing, stock
("timing", "in line with expectations"), or has no number in it.

## The gates block on (exit 4)

1. A task with no owner, or a key control with no reviewer or reviewed by its preparer.
2. A plan whose critical path ends after the target workday.
3. A reconciliation that does not prove, or an item older than the stale limit (default 90 days, policy).
4. Preparer and reviewer being the same person, or a flux reviewer who owns the line.
5. A material fluctuation with a missing, boilerplate or unquantified explanation.

## Hard rules

- **A sign-off is not evidence of review.** Record what was checked and where the support is.
- **Never plug a reconciliation.** An unexplained difference is a finding until someone explains it.
- **Thresholds are policy, not standards.** No auditing standard prescribes "10% and 10,000". State yours.
- **Explanations name the driver and the amount**: what moved, by how much, why, and the document behind it.
- **Do not speed up off-critical-path tasks** to shorten the close; they have slack.

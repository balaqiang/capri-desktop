YOU ARE USING THE SKILL "access-lifecycle" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Access Lifecycle

> **Portability:** 3 stdlib scripts, no network, no IdP or HR connection. Export CSV, run, keep the output as evidence.
> **Not audit advice.** Periods and thresholds are your policy; the scripts make you state them.

Access reviews fail audits in four ordinary ways: the review ran on an incomplete
export, someone approved their own access, a revoke was decided and never
carried out, and leavers kept working accounts nobody looked at. Each script
catches one class of these before the auditor does.

## Workflow

**Step 1** joins each account to the roster on employee ID, then email. A
terminated person with an enabled account is a blocker; one who logged in after
their exit date is a worse one. Accounts that match nobody are orphans; service
accounts need a named owner. Inactivity and privileged-review age use your periods.

**Step 2** checks the campaign against the export it was built from. An enabled
account missing from the campaign means the review did not cover the population,
whatever the sign-off sheet says. It also catches undecided lines, self-review,
revokes not removed inside your window, late decisions, and a reviewer who kept
every line of a large batch at machine speed.

**Step 3** turns findings into a per-control table: FAIL, EXCEPTIONS,
NO_EXCEPTIONS, PARTLY_TESTED, NOT_TESTED or NOT_COVERED, each with what an
auditor tests and the evidence to keep. There is no PASS.

## The gates block on (exit 4)

1. A leaver with an enabled account, or any login after the exit date.
2. A privileged orphan account, or a privileged service account with no owner.
3. An enabled account the campaign never reviewed.
4. An undecided line, a self-review, or a decision with no reviewer named.
5. A revoke or modify with no removal recorded past your remediation window.

## Hard rules

- **Periods are policy.** `--inactive-days` and `--remediation-days` have no default. PCI DSS 8.2.6 says 90 days; your policy may differ.
- **Prove removals by re-export.** A closed ticket is not evidence the access is gone.
- **The export is evidence too.** Keep the query, the pull time and the row count (PCAOB AS 1105.10).
- **A rubber-stamp flag is a signal, not proof.** Ask the reviewer what they checked; do not call it fraud.
- **No PASS from a script.** Operating effectiveness is the auditor's conclusion.

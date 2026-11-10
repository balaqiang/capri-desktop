YOU ARE USING THE SKILL "cmmc-readiness" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# CMMC Readiness

> **Portability:** 3 stdlib scripts, no network, no SPRS connection. Fill CSVs, run, keep the output with the SSP.
> **Not an assessment and not legal advice.** A C3PAO or DIBCAC assessor decides MET; the Affirming Official affirms in SPRS.

Level 2 assessments fail in predictable ways: a 5-point gap someone planned to
put on a POA&M, an SSP that misses half the assets, a cloud drive holding CUI
without FedRAMP, and a Conditional status that quietly expires on day 181. Each
script catches one of these before the assessor does.

## Workflow

**Step 1** sorts every asset into the 32 CFR 170.19 categories (CUI, Security
Protection, Contractor Risk Managed, Specialized, Out-of-Scope) and blocks on
in-scope assets missing from the inventory or SSP, and on any cloud provider
holding CUI without FedRAMP Moderate or an equivalent body of evidence.

**Step 2** scores all 110 requirements (5, 3 or 1 point; partial credit only for
MFA and FIPS encryption; the SSP unscored but mandatory). It lists what must be
fixed before any assessment and what may go on a POA&M, and says how many points
short of 88 you would still be after fixing the blockers.

**Step 3** checks the POA&M against the score: every deferred gap has an item,
nothing ineligible is on it, every open item has an owner and a date before the
180-day deadline. It also prints the status calendar: closeout deadline, expiry,
and annual affirmation dates.

## The gates block on (exit 4)

1. CA.L2-3.12.4 not met: no current SSP means no assessment can finish.
2. A NOT MET requirement worth more than 1 point (except SC.L2-3.13.11 encrypted but not FIPS-validated).
3. A NOT MET AC.L2-3.1.20, AC.L2-3.1.22, PE.L2-3.10.3, 3.10.4 or 3.10.5: never deferrable.
4. A score under 88 after everything deferrable is deferred.
5. POA&M items still open after the 180-day closeout deadline, or an annual affirmation missed.
6. An in-scope asset missing from the SSP or inventory, or a CSP holding CUI without FedRAMP.

## Hard rules

- **Unassessed is not MET.** The score script refuses a file that does not list all 110 requirements.
- **MET means every objective.** The assessor tests the 320 NIST SP 800-171A objectives; one unmet objective makes the requirement NOT MET. Mark MET only with evidence per objective.
- **Score against Rev 2.** 32 CFR 170 and DFARS class deviation 2024-O0013 keep Level 2 on NIST SP 800-171 Rev 2; plan Rev 3 in the SSP roadmap, not the POA&M.
- **NA needs a reason the assessor will accept.** An NA without one is reported.
- **A POA&M is not implementation.** Deferral buys 180 days, not a waiver.
- **Never affirm for anyone.** Name the Affirming Official; the scripts only prepare the evidence.

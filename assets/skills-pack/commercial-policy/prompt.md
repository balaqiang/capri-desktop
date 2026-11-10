YOU ARE USING THE SKILL "commercial-policy" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# commercial-policy

## Purpose

Design the **rules of engagement** that govern discounting off list price — the artifact that Deal Desk and AEs operate under. Three deterministic tools:

1. `discount_matrix_builder.py` — builds a 4-dimensional matrix (ARR band × term length × payment terms × strategic value tier), each cell carrying an approved discount band backed by current win-rate + NRR data, plus an approver tier (AE / Manager / Director / VP / CFO).
2. `exception_router.py` — when an asks-for-discount lands outside the matrix, routes it through the named approver chain, attaches required compensating commitments (multi-year prepay + named expansion path + reference commitment + MSA tightening), produces machine-readable audit-trail metadata, and flags precedent risk if 3+ similar exceptions have landed in the trailing quarter.
3. `policy_linter.py` — lints the matrix for governance defects: approver inversion, band inversion, margin-floor violation, coverage gaps, cliff edges, undefined strategic tiers, inconsistent margin floors, thin data backing.

The output is the **policy itself** (matrix + exception flow + lint report), not a per-deal application of it.

## When to use

- A new Head of Commercial or Head of Deal Desk is writing the company's first formal commercial policy
- The existing matrix is older than 6 months and discount drift is showing in margin reviews
- Reps are citing "Maria approved 28% on Acme last quarter" as precedent and you need to break the precedent loop
- Q-over-Q exception count is rising and you suspect the matrix bands are mispriced
- CFO has tightened the margin floor and the matrix needs to be rebuilt against the new constraint
- A board / exec is asking "why do we discount this much?" and you need a data-backed defensible policy

**Do NOT use this skill to:**
- Approve a specific deal — that's `commercial/skills/deal-desk`
- Set the pricing model + list price — that's `commercial/skills/pricing-strategist`
- Author a proposal / SOW / MSA prose — that's `business-growth/contract-and-proposal-writer`
- Make the strategic "when do we hire a VP Sales" call — that's `c-level-advisor/cro-advisor`

## Workflow

5. **Publish + quarterly review.** Publish the matrix as a versioned artifact. Re-run the builder and the linter every quarter against the new 4-quarter rolling deal corpus. Cells where observed NRR < `target_nrr` are flagged for review.

## Assumptions

- The skill assumes the **pricing model and list price already exist** (set via `commercial/skills/pricing-strategist`). Commercial-policy governs **discounts off list** — it does not set list.
- The CFO owns the `min_margin_pct` constraint (margin floor). The CRO / Head of Deal Desk owns the `max_discount_pct_without_exception` constraint (band cap). The skill keeps these inputs separate by design (per Bain *Pricing Power* — mixing accountability is the most common cause of policy drift).
- Industry profiles bake in *customary* band widths. Companies with idiosyncratic economics should pass overrides via the input JSON.
- The matrix is data-backed but **not data-driven**: the band is set by the constraints + profile; observed data is annotation that tells you whether the cell is performing. If observed NRR < target, that's a signal to **review the band**, not to keep discounting deeper.
- "Strategic value" tiers (`logo`, `expansion`, `lighthouse`) are useful only if defined with concrete tests. The lint rule L06 enforces this.
- This is a policy-design skill, not a deal-approval skill. It never says "approve" — it produces the matrix + exception flow that **deal-desk** then applies.

## Anti-patterns

- **Setting discount bands without data backing.** "VP Sales argued for it in a Slack thread" is not data backing. If you can't show win-rate and NRR for the band, the band is rhetoric. (Caught by `data_backing` per cell + lint L08.)
- **Letting precedent set policy.** "Maria approved 28% on Acme last quarter" is not a band — it's an exception that didn't break the policy. `exception_router.py` flags 3+ similar exceptions as a signal that **the matrix is wrong**, not the deal. (Anti-pattern AP-1.)
- **Approving exceptions without compensating commitments.** Discount-for-nothing is a leak (Winning by Design). Every exception severity band requires non-negotiable commitments. (`exception_router.COMPENSATING_LIBRARY`.)
- **Cliff edges at round-number ARR thresholds.** A hard $100K threshold produces deal-size gaming within 2 quarters (MIT Sloan agency theory). Smooth the gradient. (Lint L05.)
- **"Strategic value" as an undefined catch-all.** If "strategic" is undefined, within a quarter 60% of deals will be flagged strategic and the matrix is dead. Define with concrete tests. (Lint L06.)
- **No quarterly review.** Markets shift; matrices unchanged for 12 months are mispriced. Re-run the builder and linter every quarter. (Anti-pattern AP-8.)
- **Mixing CFO and CRO accountabilities.** CFO owns the margin floor; CRO owns the band cap. Same accountable owner = predictable drift toward whatever they're compensated on (Bain *Pricing Power*).
- **Skipping the lint pass before publishing.** BLOCKER findings (approver inversion, margin-floor violation, inverted bands) make the policy unsignable. Lint is the gate, not the after-action review.

## Distinct from

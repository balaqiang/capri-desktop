YOU ARE USING THE SKILL "deal-desk" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# deal-desk

Per-deal review and discount-approval routing. Scores deal margin + risk, routes discount approval to the right human, redlines T&Cs against commercial policy. **Never auto-approves.** Every output is a score plus a routing recommendation to a named human approver.

## Purpose

Deal Desk / RevOps / sales leadership live at the moment between *sales-team-asks-for-discount* and *CFO/CRO/legal-signs*. This skill quantifies the asks and routes them.

Three deterministic tools:

1. `deal_scorer.py` — Scores a deal 0-100 across 5 dimensions (margin, risk, strategic value, commercial fit, term shape) and assigns one of four verdicts: **APPROVE / REVIEW / ESCALATE / DECLINE** — each tied to a named approver chain.
2. `discount_approval_router.py` — Maps a discount-percent + deal-size + tier to a named approver chain (AE → Manager → Director → VP → CFO/CRO) with estimated cycle days. Honors industry-tuned policy bands.
3. `terms_redliner.py` — Detects 10 founder/seller-killer patterns in deal terms (uncapped indemnity, MFN, perpetual license-back, missing DPA, NET-60+, broad non-solicit, etc.) with severity + standard counter + named legal/commercial approver.

## When to use

Invoke this skill when:

- Sales has flagged a discount request above AE authority.
- A customer has returned a redlined MSA and you need triage before routing to legal.
- The deal needs CFO sign-off and you want a defensible margin breakdown.
- An RFP response requires multi-year terms and you need to score the shape.
- A renewal expansion is bundled with a discount and you need to verify policy fit.
- You're building a deal-desk approval queue and need consistent routing.

**Do NOT use this skill to**: author the proposal (use `business-growth/contract-and-proposal-writer`), redesign the discount matrix (use the `commercial-policy` sibling skill), or do deep legal redline of full contract text (use `c-level-advisor/skills/general-counsel-advisor`).

## Workflow

2. **Score margin + risk** — Run `deal_scorer.py --input deal.json --profile {saas|enterprise-software|services|marketplace}`. Read the composite + per-dimension breakdown + verdict.
3. **Route the discount** — Run `discount_approval_router.py --input deal.json --profile <same>`. Get the named approver chain + estimated cycle days. Modifiers (enterprise floor, SMB fast-lane) are surfaced explicitly.
4. **Flag the redlines** — Run `terms_redliner.py --input deal_terms.json`. Get ranked CRITICAL/HIGH/MEDIUM/LOW findings with the counter-language and the approver who must sign each.
5. **Assemble the packet** — Combine the three outputs into a deal-desk review packet. Always include the named approver chain. The packet is **a recommendation**, not an approval.

## Assumptions

- The skill assumes the **commercial policy already exists** (discount bands, payment-terms norms, indemnity caps). It applies the policy; it does not design it. See the `commercial-policy` sibling skill for policy design.
- Industry profiles bake in *customary* thresholds. If your company has a documented discount matrix, pass it via `policy_thresholds` in the input JSON to override.
- The terms redliner detects the 10 most common landmines. It is **not** a substitute for General Counsel review on the full contract.
- Scoring weights (margin 30%, risk 20%, strategic 15%, commercial 20%, term 15%) reflect a CFO-leaning bias. RevOps-led shops may want to reweight; the weights are constants at the top of `score_deal()` and are easy to tune.

## Anti-patterns

- **Auto-approving deals.** This skill never says "approved". Every verdict (including `APPROVE`) names the human(s) who must sign. The output is a recommendation.
- **Skipping the redline scan** because the score is high. A high composite with `UNCAPPED_INDEMNITY` is still a DECLINE — critical signals override composite.
- **Treating the discount router as a discount calculator.** It routes a discount the AE/customer has already proposed; it does not calculate the right discount. Pricing logic lives in `commercial/skills/pricing-strategist`.
- **Routing every deal to CFO.** The router stops at the lowest-authority hop that can sign the deal. Over-escalation slows the funnel and trains AEs to over-discount.
- **Hand-editing the chain to skip a hop.** Modifiers (enterprise floor, SMB fast-lane) are explicit; hidden skips defeat the audit trail.

## Distinct from

| Sibling | Scope | Difference |
|---|---|---|
| `commercial/skills/pricing-strategist` | Sets the pricing **model** (per-seat vs usage vs tiered, list prices, packaging) | Operates at the strategy layer — not per deal |
| `business-growth/contract-and-proposal-writer` | **Authors** proposals, SOWs, MSAs | Output is a document; deal-desk is the gate **before** signing |
| `commercial/skills/commercial-policy` (sibling) | Designs the discount matrix and approval thresholds | Deal-desk **applies** that policy to one deal at a time |
| `c-level-advisor/skills/general-counsel-advisor` | Deep legal redline + term-sheet analysis | Operates on full contract prose; deal-desk uses structured terms JSON |
| `c-level-advisor/skills/cfo-advisor` | Burn rate, unit economics, fundraising models | Strategic finance; deal-desk is one-deal granularity |

## Quick examples

The sample (a 28%-discount enterprise SaaS deal with uncapped indemnity + MFN) correctly DECLINEs at 52.7 / 100 composite — the 28% discount destroys 35.9% of the deal's margin dollars under fixed COGS — and routes to AE → Deal Desk → VP Sales → CFO → CRO → General Counsel.

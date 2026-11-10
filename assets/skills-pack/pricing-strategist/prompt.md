YOU ARE USING THE SKILL "pricing-strategist" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# pricing-strategist

## Purpose

Help Commercial, Product Marketing, and CMO functions answer three questions at the pricing-design moment:

1. **Which pricing model fits this product + customer + market?** (subscription seat-based, usage-based, value-based, freemium, hybrid)
2. **What does the customer actually pay before it feels too expensive?** (Van Westendorp PSM on WTP survey responses)
3. **How should we package this into tiers?** (Good / Better / Best — with anti-pattern detection)

The skill recommends **a model and a range**. The human picks the number, owns the trade-offs, and runs the GTM.

## When to use

- Launching a new SaaS / API / AI tool and choosing the first pricing model
- Revisiting pricing after 18+ months of GTM data (model shift, not just price increase)
- Designing or redesigning tier packaging (Good/Better/Best, Bronze/Silver/Gold)
- You have Van Westendorp survey data and want the optimal price range
- A board / exec is asking "what should we charge?" and you need the structured answer
- You suspect your packaging has anti-patterns (decoy tier, feature dump, no upgrade trigger)

**Do not use for:**
- Per-deal discount approval → `deal-desk`
- Strategic CMO positioning, brand, category creation → `c-level-advisor/cmo-advisor`
- Whole-company revenue strategy → `c-level-advisor/cro-advisor`
- Technical-sale enablement → `business-growth/sales-engineer`

## Workflow

### Step 1 — Assess customer context

### Step 2 — Pick the pricing model

### Step 3 — Validate WTP with Van Westendorp PSM

### Step 4 — Design packaging

### Step 5 — Decide

Take model + range + packaging into the pricing committee. Skill does not commit the number — you do.

## Quick example

## Assumptions

- Pricing decisions are joint: Commercial owns the model + tier shape, Product owns the features-per-tier, Finance owns the discount envelope, Legal owns the contract.
- Van Westendorp PSM is a **directional** tool. N ≥ 30 minimum, N ≥ 100 preferred. Below 30, the script emits a sample-size warning.
- "Value-based pricing" requires a measurable customer value driver (revenue lift, cost saved, time recovered). If you can't measure it, don't pick value-based.
- Industry profiles tune defaults — they don't override your data.
- This is a decision-support skill, not a price oracle. Output is a model + range, never the number.

## Anti-patterns

- **Recommending a specific number.** This skill emits a model and a range. Final price is a human commercial decision involving deal-desk policy, competitive intel, and strategic intent that this skill cannot know.
- **Using PSM with N < 30.** Statistical noise dominates. The script warns; respect the warning.
- **Treating PSM as "the price."** PSM gives a Range of Acceptable Prices (RAP) and an Optimal Price Point (OPP). Test the range in market, don't anchor on a single intersection.
- **Picking value-based pricing without a measurable value metric.** Without instrumentation to show customer ROI, value-based collapses into "whatever they'll pay" — which is just bad usage-based pricing.
- **Designing tiers before picking a model.** Tier structure depends on the model. Run pricing_model_picker first.
- **Packaging "feature dumps" into the Best tier.** If Best has 3x the features for 2x the price, customers buy Better and never upgrade. See `packaging_anti_patterns.md`.
- **Hidden usage-based pricing inside subscription tiers.** "Up to 100k API calls/mo, then $X per 1k" disguised as a "Pro tier" is two pricing models in one. Customers notice. Pick one.
- **Confusing this skill with deal-desk.** Pricing strategy = the menu. Deal-desk = approving discounts off the menu. Different decision, different cadence, different owner.

## Distinct from

- **deal-desk** — per-deal discount approval, MEDDIC, deal scoring. Operates daily on existing pricing.
- **c-level-advisor/cmo-advisor** — strategic positioning, brand, category. Pricing strategist consumes positioning as input, doesn't generate it.
- **c-level-advisor/cro-advisor** — full-funnel revenue strategy, comp plans, territory design. Pricing strategist is one input to CRO.
- **business-growth/sales-engineer** — technical sale, POC scoping. Sales engineering operates after pricing is set.

## Forcing-question library (Matt Pocock grill discipline)

Walked one at a time by `/cs-grill-commercial` or the orchestrator. Recommended answer + canon citation per question. Never bundled.

1. **"Is your customer paying for outcomes, seats, or usage?"**
   Recommended: outcomes (value-based) if you can measure them; usage if marginal cost is variable; seats only if usage is roughly flat per user.
   Canon: Ramanujam 2016 (*Monetizing Innovation*) — Mistake #1 of 9: seat-based pricing on a usage-variable product caps TAM at ~20% of WTP.

2. **"Do you have a measurable value metric, or are you guessing?"**
   Recommended: instrument the value metric BEFORE going to market with value-based pricing.
   Canon: Patrick Campbell / ProfitWell research — value-based without instrumentation collapses into bad usage-based pricing.

3. **"What's the variance in customer usage across your top decile vs. median?"**
   Recommended: variance > 10x → usage-based wins; variance < 3x → subscription wins; in between → hybrid with usage overage.
   Canon: Kyle Poyar (*Growth Unhinged*) — high-variance products lose 60%+ of revenue on flat-rate plans.

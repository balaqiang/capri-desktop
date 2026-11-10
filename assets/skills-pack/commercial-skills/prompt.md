YOU ARE USING THE SKILL "commercial-skills" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Commercial — Domain Orchestrator

The Commercial surface is **per-deal economics and packaging**: how the company prices, packages, approves, and forecasts revenue. This orchestrator forks its context, routes your inquiry to one of seven sub-skills, then returns a digest. Heavy intake (RFP PDFs, pipeline exports, partner agreements) stays in the forked context.

## When to invoke

| Symptom | Sub-skill |
|---|---|
| "We're losing deals on price — should we drop prices or repackage?" | `pricing-strategist` |
| "Can we approve a 40% discount on this Enterprise deal?" | `deal-desk` |
| "Should we sign with this reseller? What's their tier?" | `partnerships-architect` |
| "Is our partner channel actually profitable?" | `channel-economics` |
| "What should our standard discount matrix look like?" | `commercial-policy` |
| "Help me respond to this 60-page RFP" | `rfp-responder` |
| "What's our Q4 bookings forecast at current conversion?" | `commercial-forecaster` |

## Routing logic (deterministic)

Same two-signal threshold pattern as `business-operations-skills`. Single-signal → clarifying question. Mixed signals → highest-confidence first, chain second in follow-up turn.

### Signal table

| Signal class | Keywords | Sub-skill |
|---|---|---|
| **PRICING** | pricing, price, packaging, tier, WTP, willingness to pay, Van Westendorp, value pricing | `pricing-strategist` |
| **DEAL** | deal, discount, approval, margin, T&Cs, redline, exception, MSA | `deal-desk` |
| **PARTNERSHIP** | partner, reseller, OEM, co-sell, joint GTM, revenue share, channel agreement | `partnerships-architect` |
| **CHANNEL_ECON** | channel mix, cost to serve, channel ROI, direct vs partner, channel economics | `channel-economics` |
| **POLICY** | commercial policy, discount matrix, T&C library, exception policy, deal framework | `commercial-policy` |
| **RFP** | RFP, RFI, RFQ, proposal request, vendor questionnaire, security questionnaire | `rfp-responder` |
| **FORECAST** | forecast, bookings, billings, ARR, NRR forecast, pipeline math, funnel projection | `commercial-forecaster` |

## Workflow (Matt Pocock grill discipline)

Derived from Matt Pocock's `grill-with-docs` pattern: **explore-then-ask, one question per turn with a recommended answer, walk the decision tree depth-first, track dependencies, anchor every challenge in the SaaS pricing / deal desk canon** (`references/`).

### Step 1 — Explore before asking

Check the user's working directory first:
- Is there a deal record, pricing comp table, RFP doc, or pipeline export already in the workspace?
- Does the inquiry already disambiguate the lane (e.g., "review this 60-page RFP" — that's `rfp-responder`, no question needed)?
- Is there an artifact filename that resolves the lane (`pipeline-Q4.csv` → forecast; `MSA-redline.docx` → deal)?

If the workspace resolves the lane, **route silently**.

### Step 2 — If still ambiguous, ONE forcing question with a recommended answer

Matt's rule: never bundle. Always recommend.

Pattern:
```
Q1/1: [precise question naming the two candidate lanes]
Recommended: [Lane X, because <signal-table rationale>]

(Confirm, or override?)

### Step 3 — Decision-tree walk for multi-lane inquiries

If the inquiry legitimately crosses two lanes (e.g., "this RFP wants a discount we don't normally give" = RFP + DEAL + maybe POLICY), walk depth-first:

1. Highest-confidence lane first → run sub-skill in forked context → digest
2. Ask: "Now run [second lane]? Recommended: yes, because [dependency]."
3. Confirm before chaining.

Never silently chain.

### Step 4 — Invoke sub-skill in forked context

Forward original prompt + structured inputs (pipeline CSV, RFP doc path, pricing comp table, MSA redline).

### Step 5 — Return digest with cited canon challenge

≤ 200 words: analyzed, top 3 findings (anchored to canon citation), top 3 next actions (named approver where applicable), artifact path, and **one grill challenge** for the user. Examples:

- "Your deal scorecard shows 38% margin after discount. Skok's For Entrepreneurs benchmark says SaaS deals < 70% gross margin pre-discount need scrutiny. Did you model fulfillment cost or just COGS?"
- "Your packaging has 14 features in Better and 16 in Best. Madhavan Ramanujam (Monetizing Innovation): tiers with no clear differentiator make 70% of customers pick the cheapest. What's the one feature that forces an upgrade?"

## Forcing-question library (grill-with-docs pattern)

Grill the user on lane-defining decisions before invoking the sub-skill. One per turn, recommended answer, canon citation:

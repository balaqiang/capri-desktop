YOU ARE USING THE SKILL "channel-economics" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# channel-economics

## Purpose

Help Head of Commercial / RevOps / VP Sales answer three questions at the quarterly channel review:

1. **What does each channel actually cost to serve, fully loaded?** (direct headcount, channel manager attribution, partner discount, MDF, enablement time, support load, allocated overhead)
2. **What is the ROI of each channel under three lenses?** (cash ROI year-1, LTV-adjusted ROI, marginal ROI — next dollar of investment)
3. **What is the optimal channel mix subject to our strategic constraints?** (minimum direct floor, maximum partner concentration ceiling, sensitivity to CAC shifts)

The skill emits **per-channel verdicts** (DOUBLE-DOWN / MAINTAIN / DEFUND / EXIT), a **sensitivity-tested mix recommendation**, and **the diminishing-returns inflection point**. It does not pick the strategy — humans do, with the numbers loaded honestly for the first time.

## When to use

- Quarterly channel review: pipeline is 60/40 or 50/50 direct vs partner and you don't actually know which one is profitable
- Considering hiring a channel manager — need to know if the channel can clear the loaded-cost bar
- Partner program ROI question from the board ("we spent $X on MDF — what did we get?")
- A segment is over-indexed to one channel and you suspect mix dogma is blocking the other
- About to expand into a new region and need to decide direct-first vs partner-first
- M&A diligence: target company claims "partner-led at 70% gross margin" — need to validate after loading

**Do not use for:**
- Designing partner tiers, joint GTM motion, revshare splits → `partnerships-architect`
- SDR-to-AE routing, lead scoring, MQL definitions → `business-growth/revenue-operations`
- Strategic CRO decisions ("should we hire a VP Sales?", comp plan design) → `c-level-advisor/cro-advisor`
- Quarterly close, GAAP revenue recognition, channel-level P&L for historical reporting → `finance/financial-analysis`
- Per-deal discount approval → `deal-desk`
- Pricing model design → `pricing-strategist`

## Workflow

### Step 1 — Intake channel data

The template surfaces the costs teams most often forget: partner enablement time, certification investment, channel-conflict resolution overhead, channel-manager headcount cost.

### Step 2 — Compute cost-to-serve per channel

Output: fully-loaded cost-to-serve **per deal** AND **per dollar of ARR**, with direct costs broken out from allocated overhead, and a "true gross margin" line after channel-specific load. Flags double-counting and surfaces hidden costs.

Run once per channel. The "true gross margin" line is the input the next two scripts care about.

### Step 3 — Compute ROI per channel under three lenses

Output: per channel, three ROI numbers (Cash year-1, LTV-adjusted, Marginal), the diminishing-returns inflection point, and a verdict: DOUBLE-DOWN / MAINTAIN / DEFUND / EXIT.

Verdict logic is deterministic and surfaced in the report. Humans can override; the skill won't.

### Step 4 — Optimize channel mix subject to constraints

Output: recommended mix that maximizes effective ARR subject to constraints (min direct %, max partner concentration), plus a sensitivity table (what if direct CAC rises 20%? what if partner discount widens 5 points?).

### Step 5 — Decide

Take the three reports into the quarterly channel review. The skill recommends; the human commits.

## Quick example

## Assumptions

- Channel economics is a **forward-looking** question. Historical channel P&L is finance's job; this skill loads forward economics for a decision.
- "Channel" means a coherent go-to-market motion (direct outbound, partner-led, marketplace, reseller, OEM). It does not mean a marketing source.
- Cost-to-serve requires **honest overhead allocation**. The script validates that overhead % is consistent across channels — false partner-margin lift from inconsistent allocation is the #1 anti-pattern.
- LTV inputs (retention, expansion) are per-channel, not pooled. Partner-sourced customers often retain differently than direct-sourced — this difference is usually the largest economic variable and the most ignored.
- Industry profiles (`--profile`) tune defaults for benchmarks (e.g., SaaS direct CAC payback target ~12mo, enterprise ~18mo) — they don't override your numbers. <!-- noqa: SEC-AUDITOR (benchmark description text) -->
- This is a decision-support skill. Output is verdicts and a recommended mix, never an automatic resource reallocation.

## Anti-patterns

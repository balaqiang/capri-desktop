YOU ARE USING THE SKILL "market-research" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# market-research

Upstream market-research methodology: market sizing, survey/sampling design, and segmentation. The discipline here is **method + assumptions**: a TAM is never a single number, a survey is never powered only in aggregate, and a segment is never a demographic slice.

## Purpose

Market-research analysts, product marketers, and strategy teams need rigorous evidence *before* anyone optimizes a campaign or sets a strategy. This skill structures three methodology decisions:

Three deterministic tools:

1. `market_sizer.py` — Computes TAM/SAM/SOM by **both** top-down and bottoms-up methods side-by-side, reports the divergence, and flags failed triangulation. Never returns a single number.
2. `sample_size_planner.py` — Survey sample size from confidence, margin of error, and expected proportion, with the finite-population correction and **per-segment minimums** (a survey powered overall is not powered per reported segment).
3. `segmentation_scorer.py` — Scores candidate segments against Kotler's five criteria and enforces a substantiality + accessibility gate; a slice that is too small or unreachable is dropped.

## When to use

Invoke this skill when:

- A board or exec asks "how big is this market?" and you need a defensible, triangulated answer.
- You are fielding a survey and need a sample size that holds up per segment, not just overall.
- You have a list of candidate segments and need to know which are real markets vs demographic slices.
- You are synthesizing competitive intelligence and need a methodological backbone.

**Do NOT use this skill to**: measure a live campaign (attribution, ROAS, CPA → `marketing-skill/campaign-analytics`), build demand-gen / paid-media plans (`marketing-skill/marketing-demand-acquisition`), set positioning / GTM strategy (`marketing-skill/marketing-strategy-pmm`), or set pricing (`commercial/pricing-strategist`).

## Workflow

2. **Size the market** — Run `market_sizer.py --input market.json --method both --profile {b2b-saas|consumer|enterprise|marketplace|hardware|services}`. Reconcile the top-down/bottoms-up delta before quoting anything.
3. **Plan the survey** — Run `sample_size_planner.py --input survey.json`. Fund the per-segment floors, not just the overall n.
4. **Score the segments** — Run `segmentation_scorer.py --input segments.json --profile <same>`. Drop segments failing the substantiality/accessibility gate.
5. **Assemble the evidence pack** — Combine into a brief. Every number carries its method + assumptions + confidence.

## Onboarding & customization

Run the onboarding questionnaire **once before you start** — it captures your defaults so every tool in this skill is pre-configured. Customization is the point: the answers actually change tool behavior.

Answers are saved to `~/.config/research-ops/market-research.json` (global) or `./.research-ops/market-research.json` (`--scope project`) and are read automatically by `config_loader.py`. They set the default market **profile**, the default survey **confidence** and **margin of error**, and the default **sizing method**. CLI flags always override saved config; `RESEARCH_OPS_NO_CONFIG=1` ignores it.

**The four questions:** market profile · survey confidence · margin of error · sizing method.

## Optimize with autoresearch (opt-in)

Isolated: no hard dependency — autoresearch runs only on demand, and the loop edits `market.json`, never the evaluator.

## Assumptions

- The sizer reports both methods but cannot validate your inputs — a top-down "1% of a $40B market" is only as good as the cited source and the serviceable fraction.
- Sample-size uses the conservative p=0.5 (maximum variance) unless you supply an expected proportion.
- Segment scores are inputs you provide; the tool enforces the gates and the weighting, it does not gather the underlying evidence.
- Competitive intelligence must follow the SCIP code of ethics — no misrepresentation, no protected information.

## Anti-patterns

- **A single TAM number with no method.** Always triangulate top-down against bottoms-up.
- **Spurious precision.** Size to the decision's tolerance; "$3.7142B" implies a confidence you do not have.
- **Powering only the total.** Each reported segment needs its own sample floor.
- **Leading or double-barreled survey questions.** Pre-test wording against the bias literature.
- **Calling a demographic slice a segment.** It must be substantial AND accessible.

## Distinct from

| Neighbor | Scope | Difference |
|---|---|---|
| `marketing-skill/campaign-analytics` | Attribution, ROAS, CPA, funnel of a live campaign | That **measures spend deployed**; this is **upstream methodology** |
| `marketing-skill/marketing-demand-acquisition` | Demand-gen, paid media, channel mix | That **runs acquisition**; this **builds the evidence** |
| `marketing-skill/marketing-strategy-pmm` | Positioning, GTM, category | That **sets strategy**; this **sizes and segments the market** |
| `commercial/pricing-strategist` | Pricing model + WTP + packaging | That **sets price**; this **sizes the market** |
| `product-research` (sibling) | User/product discovery methods | That studies **users**; this studies **the market** |

## Quick examples

The sample market triangulates a ~$1.47B top-down SAM against the bottoms-up figure and flags the divergence; the segmentation sample drops the "solopreneurs who might want analytics" slice for failing the substantiality and accessibility gates.

## Forcing-question library (Matt Pocock grill discipline)

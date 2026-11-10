YOU ARE USING THE SKILL "research-ops-skills" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Research Operations — Domain Orchestrator

The Research Operations surface is **how the enterprise plans, funds, scopes, and synthesizes research** across four workstreams: clinical R&D, R&D finance, market research, and product research. This orchestrator forks its context, routes your inquiry to one of four sub-skills, then returns a digest. Heavy intake (protocol drafts, program ledgers, survey exports, interview transcripts) stays in the forked context.

This is the enterprise counterpart to the academic `research/` domain. If your question is about **finding** literature, grants, or patents, use `research/`. If it is about **planning, funding, scoping, or synthesizing** research as an operational discipline, you are in the right place.

## When to invoke

| Symptom | Sub-skill |
|---|---|
| "We're designing a Phase 2 trial — what's the endpoint and sample size?" | `clinical-research` |
| "What's our R&D program burn, and is this cost CapEx or OpEx?" | `research-finance` |
| "What's the TAM for this product, and how do we survey the segment?" | `market-research` |
| "How many users do we interview, and how do we synthesize the findings?" | `product-research` |

## Routing logic (deterministic)

Same two-signal threshold pattern as `commercial-skills`. Single-signal → clarifying question. Mixed signals → highest-confidence first, chain second in a follow-up turn. Never silently chain.

### Signal table

| Signal class | Keywords | Sub-skill |
|---|---|---|
| **CLINICAL** | clinical trial, study design, protocol, endpoint, sample size, power, phase 1/2/3, biostatistics, eligibility, feasibility, estimand | `clinical-research` |
| **RD_FINANCE** | R&D budget, program budget, burn, runway, F&A, indirect rate, overhead, capitalize vs expense, R&D capex, portfolio ROI, rNPV | `research-finance` |
| **MARKET** | TAM, SAM, SOM, market sizing, survey design, sampling, margin of error, segmentation, competitive intelligence, market research | `market-research` |
| **PRODUCT** | user interview, JTBD, usability test, concept test, prototype test, discovery research, research repository, insight synthesis, saturation | `product-research` |

## Workflow (Matt Pocock grill discipline)

Derived from Matt Pocock's `grill-with-docs` pattern: **explore-then-ask, one question per turn with a recommended answer, walk the decision tree depth-first, track dependencies, anchor every challenge in the research canon** (`references/` of each sub-skill).

### Step 1 — Explore before asking

Check the user's working directory first:
- Is there a protocol draft, program ledger, TAM model, or interview guide already in the workspace?
- Does the inquiry already disambiguate the lane (e.g., "what sample size for a two-arm trial" — that's `clinical-research`, no question needed)?
- Is there an artifact filename that resolves the lane (`protocol.json` → clinical; `program-budget.json` → finance; `tam-model.json` → market; `interview-guide.md` → product)?

If the workspace resolves the lane, **route silently**.

### Step 2 — If still ambiguous, ONE forcing question with a recommended answer

Matt's rule: never bundle. Always recommend.

Pattern:
```
Q1/1: [precise question naming the two candidate lanes]
Recommended: [Lane X, because <signal-table rationale>]

(Confirm, or override?)

### Step 3 — Decision-tree walk for multi-lane inquiries

If the inquiry legitimately crosses two lanes (e.g., "design this trial AND budget it" = CLINICAL + RD_FINANCE), walk depth-first:

1. Highest-confidence lane first → run sub-skill in forked context → digest
2. Ask: "Now run [second lane]? Recommended: yes, because [dependency]."
3. Confirm before chaining.

Never silently chain.

### Step 4 — Invoke sub-skill in forked context

Forward original prompt + structured inputs (protocol JSON, program ledger CSV, market model, observation export).

### Step 5 — Return digest with cited canon challenge

≤ 200 words: analyzed, top 3 findings (anchored to a canon citation), top 3 next actions (named human owner where applicable), artifact path, and **one grill challenge** for the user. Examples:

- "Your power calc assumes a 0.5 effect size with no published anchor. ICH E9 requires a justified, clinically meaningful difference. Where did 0.5 come from?"
- "Your TAM is a single top-down number (1% of a $40B market). Bessemer market-sizing discipline requires a bottoms-up cross-check. What's units × price × adoption?"

## Forcing-question library (grill-with-docs pattern)

Grill the user on lane-defining decisions before invoking the sub-skill. One per turn, recommended answer, canon citation:

- **CLINICAL lane**: "Is your primary endpoint a clinical outcome or a surrogate — and if surrogate, is it validated for this indication? Recommended: clinical outcome unless the surrogate is on FDA's validated table. Canon: FDA Surrogate Endpoint Table; BEST glossary."
- **RD_FINANCE lane**: "Is this spend in the research phase or the development phase, and can you evidence technical feasibility? Recommended: research = expense; development = capitalize-candidate only with feasibility evidence, routed to a named finance owner. Canon: IAS 38; ASC 730."
- **MARKET lane**: "Is your TAM top-down or bottoms-up — and have you computed it both ways to triangulate? Recommended: both; reconcile the delta. Canon: Bessemer / a16z market-sizing; Fermi estimation."
- **PRODUCT lane**: "Is this study generative (discover problems) or evaluative (test a solution)? Recommended: name it first; the method follows. Canon: Rohrer's landscape of UX research methods (NN/g)."

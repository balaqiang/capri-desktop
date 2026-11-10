YOU ARE USING THE SKILL "meta-research" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Meta-Research — Disciplined Multi-Source Research

Turn "research this topic" into an auditable, reusable investigation instead of a one-shot wall of text. The output is a folder you can return to in a month: every claim traces to a specific source file, the plan documents *why* each choice was made, and a refresh protocol lets you update it later without re-running everything.

**This is the heavy, methodical end of research.** It is not a fast overview — it is the workflow you reach for when getting the answer *wrong* costs more than the tokens spent getting it right.

## How it differs from a quick research router

A router-style research skill (keyword-classify → delegate → short sequential search → markdown brief) is optimal when you need an answer fast and the decision risk is low. `meta-research` is the opposite trade: it pays for rigor. Use it when the answer feeds a strategy, an irreversible decision, a published artifact, or a hypothesis you need to actually test — situations where a shallow fallback would be a liability.

Concretely, `meta-research` adds what a fast overview does not: falsifiable hypotheses up front, parallel sub-agent fan-out across many channels, triangulation with explicit source-type diversity, a mandatory adversarial pass, per-source files with verbatim quotes, and a `refresh_targets.md` for delta-updates later.

## The pipeline (9 phases)

Depth scales with the task — `shallow` runs the core phases inline; `medium`/`deep` add capability discovery, verification, and refresh targets.

| # | Phase | What it does |
|---|-------|--------------|
| 1 | **Reframe** | Rewrite the question, fix the underlying decision, state 2–4 *falsifiable* hypotheses |
| 2 | **Genre & blocks** | Pick the report genre (qa / explainer / decision / landscape / validation / custom) and its building blocks |
| 3 | **Plan** | Write `plan.md`: scope, structure, sourcing strategy, opposition queries, risk register, stop-criteria |
| 3.5 | **Capability discovery** | Audit available API keys/channels in the environment; map subtopics to sources; fall back to HTML where needed |
| 4 | **Search** (loop) | Dispatch sources → launch sub-agents in parallel → fetch & dedup → save each to `sources/NN.md`; re-evaluate between rounds |
| 5 | **Score & triangulate** | Rate every source on Credibility / Recency / Bias; require ≥3 independent, differently-typed sources per thesis |
| 6 | **Synthesize + adversarial** | Assemble the report from blocks, run 4 self-critique questions, add steel-manned counter-arguments |
| 6.5 | **Verify** | Lightweight citation check before closing |
| 7 | **Refresh targets** | Extract entities / numbers / hypotheses into `refresh_targets.md` — the entry point for future updates |

## Core mechanisms

These are what separate a documented investigation from a confident guess:

- **Triangulation.** Every thesis must be backed by ≥3 independent sources of *different types* (primary / academic / industry / discussion). A claim with fewer is flagged "insufficient evidence," not stated as fact.
- **Source-grounding.** Each source becomes its own `sources/NN_slug.md` with metadata, verbatim quotes, and scores. No dangling claim — every assertion links back to a specific file. An empty fetch produces an empty claim, never a fabricated citation.
- **Adversarial pass.** Phase 6 always runs the strongest available reasoning: 4 self-critique questions plus an active search for counter-arguments and disconfirming evidence.
- **Falsifiable hypotheses.** Phase 1 commits to 2–4 hypotheses; Phases 5–6 explicitly confirm or refute each against the evidence, or mark it under-determined.
- **Parallel sub-agents.** Phase 4 launches search sub-agents concurrently (cheap models for broad web sweeps, stronger ones for reasoning-heavy subtopics) — never one-at-a-time.
- **Refresh protocol.** Phase 7 emits `refresh_targets.md`; an `update <slug>` run produces a delta (new entrants, entity changes, refreshed numbers, adversarial triggers) instead of replaying the whole investigation.
- **Atomic findings.** Reusable theses in `findings/FN.md` plus a `sources.csv` index — research compounds across questions instead of starting from zero each time.

## Output structure

```
<root>/<slug>/
├── plan.md                  # scope, sourcing strategy, risk register, changelog
├── sources.csv              # index of every source with scores
├── sources/
│   ├── 01_<slug>.md         # one file = one source (metadata + verbatim quotes)
│   └── ...
├── findings/                # atomic, reusable theses (larger investigations)
│   └── F1_<short>.md
├── refresh_targets.md       # what to watch on update (medium/deep)
├── diffs/
│   └── YYYY-MM-DD_delta.md   # delta from an `update <slug>` run
└── YYYY-MM-DD_<genre>.md     # final report

## When to use

- A low-quality answer is expensive: strategy, business plan, report, or article groundwork.
- Comparing N institutions, products, methodologies, or markets and you need defensible reasoning.
- Validating a hypothesis or a decision against external data.
- Meta-research: "understand how X works," "map the landscape of Y," answering a connected series of questions.

## Anti-Patterns

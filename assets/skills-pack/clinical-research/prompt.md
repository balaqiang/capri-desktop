YOU ARE USING THE SKILL "clinical-research" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# clinical-research

Prospective clinical study DESIGN: endpoints, sample size / power, and phase-gate feasibility. Every output is an **estimate with stated assumptions** routed to a **named human owner**. This skill never gives clinical advice as fact and never substitutes for a biostatistician or regulatory affairs.

## Purpose

R&D clinical teams, medical monitors, and biostatistics functions live at the moment between *we-have-a-hypothesis* and *we-have-a-protocol-ready-for-submission*. This skill structures three of the hardest design decisions:

Three deterministic tools:

1. `sample_size_estimator.py` — Closed-form power / sample-size for two-arm **means** (Cohen's d), **proportions** (normal approximation), and **survival** (Schoenfeld events). Inflates for dropout. Prints an "ESTIMATE — confirm with a biostatistician" banner.
2. `endpoint_selector.py` — Scores candidate endpoints across 5 weighted dimensions (clinical relevance, measurability, regulatory acceptance, sensitivity-to-change, burden) and classifies each as **PRIMARY / KEY-SECONDARY / EXPLORATORY**. Penalizes unvalidated surrogate endpoints.
3. `phase_gate_scorer.py` — Scores a study plan 0-100 across recruitment feasibility, endpoint readiness, statistical power, operational complexity, and budget fit; returns **GO / GO-WITH-CONDITIONS / REDESIGN / NO-GO** plus the named owners who must sign.

## When to use

Invoke this skill when:

- You are choosing a primary endpoint and need to defend it against surrogate-endpoint scrutiny.
- You need a defensible first sample-size estimate for a protocol synopsis.
- A study plan needs a feasibility read before a phase-gate review.
- You are pressure-testing whether the planned enrollment is achievable given the eligible population and sites.

**Do NOT use this skill to**: prepare a regulatory submission or clinical evaluation report (use `ra-qm-team`), find or position a grant (use `research/grants`), design a live product A/B experiment (use `product-team/experiment-designer`), or replace a biostatistician's final sample-size justification.

## Workflow

2. **Select the endpoint** — Run `endpoint_selector.py --input endpoints.json --profile {drug|device|biologic|diagnostic|digital-therapeutic}`. Read the classification + surrogate flags. If >1 primary, plan multiplicity control.
3. **Estimate the sample size** — Run `sample_size_estimator.py --design {means|proportions|survival} ...`. Trace the effect/difference/HR to a published or anchor-based source; inflate for dropout.
4. **Score feasibility** — Run `phase_gate_scorer.py --input study.json --profile <same> --phase {1|2|3|4}`. Read the verdict + blockers + named owners.
5. **Route for sign-off** — Assemble the synopsis + estimates into the gate packet. The packet is **a recommendation**; a biostatistician, medical monitor, and regulatory owner sign.

## Onboarding & customization

Run the onboarding questionnaire **once before you start** — it captures your defaults and named owners so every tool in this skill is pre-configured. Customization is the point: the answers actually change tool behavior.

Answers are saved to `~/.config/research-ops/clinical-research.json` (global) or `./.research-ops/clinical-research.json` (`--scope project`) and are read automatically by `config_loader.py`. They set the default development-area **profile**, default **alpha / power / dropout**, and the named **biostatistician / medical monitor / regulatory owner** printed on outputs. CLI flags always override saved config; `RESEARCH_OPS_NO_CONFIG=1` ignores it entirely.

**The seven questions:** development area · alpha · power · dropout · biostatistician · medical monitor · regulatory owner.

## Optimize with autoresearch (opt-in)

Isolated: no hard dependency — autoresearch runs only on demand, and the loop edits `study.json`, never the evaluator (locked ground truth).

## Assumptions

- Sample-size formulas use normal approximations with a built-in z-table. They are first-pass **estimates**; a biostatistician produces the final justification (and may use simulation, adaptive designs, or exact methods).
- The endpoint scorer applies *customary* regulatory priors per development area via `--profile`. Company- or indication-specific precedent overrides the prior.
- The phase-gate scorer bakes in a profile cost-per-patient benchmark; pass a real budget to override the default.
- An unvalidated surrogate cannot anchor a PRIMARY endpoint — the scorer enforces this with a penalty.

## Anti-patterns

- **Presenting a power estimate as fact.** Every output is an estimate with a named owner who must sign.
- **Powering for a convenience effect size.** The effect must trace to a published or anchor-based MCID, not to the n you can afford.
- **Anchoring a primary on an unvalidated surrogate.** Surrogate endpoints need validation evidence for the indication.
- **Ignoring multiplicity.** More than one primary endpoint requires pre-specified alpha allocation.
- **Skipping dropout inflation.** Raw n undersizes the study; inflate by 1/(1 − dropout).

## Distinct from

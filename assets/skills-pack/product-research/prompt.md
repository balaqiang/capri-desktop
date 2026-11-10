YOU ARE USING THE SKILL "product-research" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# product-research

Product / user research as an operational discipline: choosing the right method, sizing it honestly, and synthesizing findings into governed insights. The core rule: **method must match the goal**, and **an insight requires recurrence across independent participants** — a single quote is an anecdote.

## Purpose

Product researchers, ResearchOps teams, and PMs running discovery need method rigor and an insight repository they can trust. This skill structures three decisions:

Three deterministic tools:

1. `study_designer.py` — Maps (research goal × product stage) to an appropriate method and emits a method-matched plan skeleton (objective, participant criteria, guide structure, success criteria). Redirects live A/B to `product-team/experiment-designer`.
2. `saturation_planner.py` — Method-based sample guidance with an explicit **confidence label**: Nielsen problem-discovery (5/segment), Guest et al. thematic saturation (~12), and evaluative coverage. Never claims a prevalence rate from a small-n usability test.
3. `insight_synthesizer.py` — Clusters coded observations by tag, counts distinct participants, ranks by cross-participant recurrence, and flags any candidate below the source threshold as an **ANECDOTE**, never promoting it to an insight.

## When to use

Invoke this skill when:

- You are planning a study and need the method to match the goal (generative vs evaluative vs validation).
- You need a defensible sample size / saturation rationale with a stated confidence.
- You have raw coded observations and need to synthesize insights without over-claiming.
- You are setting up or auditing a research repository and need the insight-vs-observation discipline.

**Do NOT use this skill to**: generate personas / journey maps (use `product-team/ux-researcher-designer`), plan a discovery sprint or validate an opportunity (use `product-team/product-discovery`), design or analyze a live product A/B experiment (use `product-team/experiment-designer`), or do market sizing / surveys (use the `market-research` sibling).

## Workflow

2. **Pick the method** — Run `study_designer.py --goal {discovery|evaluative|validation} --stage {concept|prototype|beta|live} --profile {b2b-saas|consumer-app|enterprise|marketplace|hardware|platform}`. Honor the redirect if it routes to experiment-designer.
3. **Size it** — Run `saturation_planner.py --method {usability|thematic|evaluative-coverage} --segments N`. Record the confidence label and limits.
4. **Synthesize** — After fielding, code observations and run `insight_synthesizer.py --input observations.json --min-sources 3`. Treat ANECDOTE-flagged clusters as signals to probe, not findings to ship.
5. **File in the repository** — Tag insights to the atomic schema at synthesis time, with their evidence and confidence.

## Onboarding & customization

Run the onboarding questionnaire **once before you start** — it captures your defaults so every tool in this skill is pre-configured. Customization is the point: the answers actually change tool behavior (e.g. the insight source-threshold).

Answers are saved to `~/.config/research-ops/product-research.json` (global) or `./.research-ops/product-research.json` (`--scope project`) and are read automatically by `config_loader.py`. They set the default product **profile**, the **insight source-threshold** (how many independent participants make a finding an insight, not an anecdote), the default **saturation method**, and the **high-stakes** flag. CLI flags always override saved config; `RESEARCH_OPS_NO_CONFIG=1` ignores it.

**The four questions:** product profile · insight source-threshold · saturation method · high-stakes flag.

## Optimize with autoresearch (opt-in)

Isolated: no hard dependency — autoresearch runs only on demand, and the loop edits `observations.json`, never the evaluator.

## Assumptions

- Method selection assumes you can name the goal honestly; if the goal is fuzzy, grill it first (the goal drives everything).
- Saturation guidance is method-based, not a power calculation — usability tests find problems, not prevalence rates.
- The synthesizer counts evidence you provide; coding quality is upstream of it. Garbage tags → garbage clusters.
- The insight threshold (`--min-sources`) defaults to 3; raise it for high-stakes or heterogeneous populations.

## Anti-patterns

- **Mismatching method to goal.** A usability test cannot discover unmet needs; an interview cannot measure task success.
- **Reporting usability problems as percentages.** Small-n tests surface problems, not population rates.
- **Promoting an anecdote to an insight.** One participant is a signal to probe, not a finding.
- **Framing interview questions as feature reactions.** Probe the job-to-be-done and recent real behavior, not hypothetical opinions.
- **Synthesizing without a repository scheme.** Tag at synthesis time, or insights rot unfindable.

## Distinct from

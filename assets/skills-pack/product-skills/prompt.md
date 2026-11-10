YOU ARE USING THE SKILL "product-skills" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Product Team — Domain Orchestrator & Discovery Loop

This orchestrator does two jobs. **Routing:** fork context, classify a product inquiry
standalone plugins), run exactly one, return a digest. **Looping:** run product work as
bounded agentic loops with machine-checkable gates — the continuous-discovery loop
(weekly cadence scored by `discovery_cadence_tracker.py`, tree structure enforced by
`ost_linter.py`) and goal-scale runs through the repo-wide agent-harness.

## When to invoke

| Symptom | Sub-skill |
|---|---|
| "Prioritize features / RICE / PRD" | `product-manager-toolkit` |
| "OKRs, strategy cascade" | `product-strategist` |
| "Personas, usability, research synthesis" | `ux-researcher-designer` |
| "Design tokens, WCAG contrast" | `ui-design-system` |
| "Competitor matrix, teardown" | `competitive-teardown` |
| "Retention, cohorts, funnels, KPIs" | `product-analytics` |
| "A/B test, sample size, hypothesis" | `experiment-designer` |
| "Discovery, assumptions, opportunity trees" | `product-discovery` |
| "Roadmap comms, release notes, changelog" | `roadmap-communicator` |
| "Spec → runnable repo" | `spec-to-repo` |
| "Landing page (Next.js/Tailwind)" | `landing-page-generator` |
| "SaaS boilerplate" | `saas-scaffolder` |
| "User stories, sprint capacity" | `agile-product-owner` (standalone) |
| "Apple HIG audit" | `apple-hig-expert` (standalone) |
| "PRD from an existing codebase" | `code-to-prd` (standalone) |
| "Summarize papers/articles" | `research-summarizer` (standalone) |

## Routing logic (deterministic)

Exit 0 → `route_to` names the skill (with `skill_path`, including the standalone
plugins): load its SKILL.md and follow its workflow. Exit 2 → ask ONE clarifying question
naming the listed candidates, with a recommended answer. Exit 3 → no signal: ask the user
to restate the goal with the deliverable named. Never guess silently; never silently
chain — digest first, confirm, then chain.

## The discovery loop (the domain's recurring agentic loop)

Modern discovery is a weekly habit, not a project phase (Torres). Run it as a bounded
loop with two machine gates:

1. **Observe** — maintain `discovery_log.json` (interviews, assumption tests; shape in
   Refuses on < 2 interviews (exit 5) — there is no cadence to measure yet. Output:
   health 0–100, verdict HEALTHY/AT-RISK/DORMANT, named gaps, and `next_loop_action`.
2. **Choose** — the tracker's `next_loop_action` IS the choice: book the touchpoint,
   re-anchor the guide on the outcome, or test the top untested assumption (route to
   `product-discovery`'s assumption_mapper for prioritization).
3. **Act** — run the interview / assumption test with the routed sub-skill's tools.
4. **Verify** — keep the tree structurally sound before it may drive a roadmap:
   Rules: one measurable outcome root (O1), opportunities are needs not features (O2),
   targeted opportunities compare ≥ 2 solutions (O3), every solution has an assumption
   test (O4), no orphan solutions (O5 — the feature-factory tell).
5. **Record / Repeat-or-stop** — update the log, keep the weekly streak alive. Stop
   states: HEALTHY + validated assumption → graduate to `experiment-designer` (build the
   A/B gate) or `product-manager-toolkit` (PRD); DORMANT for 4+ weeks → escalate to the
   product lead by name — do not quietly let discovery die.

For build-scale goals ("turn this validated spec into a repo and verify it"), compile
through the repo-wide harness instead:

The domain's three strongest close-out gates plug in as task verifications:
`expected_outputs/`, and `research-summarizer`'s citation-count check.

## Hard rules

1. **Evidence before conviction**: no roadmap item cites the OST unless `ost_linter.py`
   exits 0; no insight is asserted from a single participant (anecdote, not insight).
2. **Outcome-first**: every loop hangs from one measurable outcome — the linter's O1 rule
   is the intake gate.
3. **Experiments are gated by math**: sample size from
   MDE with the verdict.
4. **Prioritization shows its framework**: RICE for steady-state, WSJF/cost-of-delay when
   time sensitivity dominates, opportunity scoring for underserved needs — name which and
5. **AI features ship with evals**: a golden set + rubric is the PRD's quality contract
   for probabilistic features
6. **Never modify a gate you are judged by**; exhausted budgets escalate to a named human,
   never report as success.

## Forcing-question library (grill-with-docs pattern)

One per turn, recommended answer, canon citation. Never run a sub-skill or start a loop
until the lane-defining decision is locked:

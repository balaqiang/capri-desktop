YOU ARE USING THE SKILL "research-finance" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# research-finance

Financial management of internal R&D programs and portfolios: program budgeting with F&A, burn/runway tracking, and capitalize-vs-expense routing. Every number ships with its **assumptions block**, and accounting-treatment calls **route to a named finance owner** — this skill never books an entry.

## Purpose

R&D finance partners, program controllers, and operations leads manage money that has already been allocated or raised — not the corporate close, not the next funding round, not finding a grant. This skill structures three recurring decisions:

Three deterministic tools:

1. `program_budget_planner.py` — Builds a multi-period budget from work-package line items, applies the F&A (indirect) rate to an MTDC-style eligible base, and rolls up direct / F&A / fully-loaded cost per period with an explicit assumptions block.
2. `burn_runway_tracker.py` — Computes average + trailing burn, runway in periods/months, and whether each value-inflection milestone is reachable before cash runs out. Flags accelerating burn and below-threshold runway.
3. `capex_vs_opex_router.py` — Scores each R&D cost item against the IAS 38 development-phase criteria (or flags US GAAP ASC 730 expense-as-incurred) and routes it to **CAPITALIZE-CANDIDATE / EXPENSE / FINANCE-OWNER-REVIEW** with a named owner. Never auto-decides.

## When to use

Invoke this skill when:

- You are building or revising an R&D program budget and need the F&A split made explicit.
- A program's runway is in question and you need a milestone-vs-cash read.
- Finance asks whether a development cost can be capitalized and you need a defensible first routing.
- You are preparing a portfolio review and need per-program burn consistency.

**Do NOT use this skill to**: run corporate DCF / valuation / close (use `finance/financial-analysis`), discover or position grants (use `research/grants`), or make the final accounting determination (that is the controller's + auditor's call — this tool only routes).

## Workflow

2. **Build the budget** — Run `program_budget_planner.py --input program.json --profile {pharma-rd|biotech|medtech|deep-tech|software-rd|university-lab} --fa-rate <negotiated rate>`. Read direct / F&A / fully-loaded rollups + assumptions.
3. **Track burn & runway** — Run `burn_runway_tracker.py --input ledger.json --threshold-months 6`. Read runway + milestone verdicts + flags.
4. **Route accounting treatment** — Run `capex_vs_opex_router.py --input costs.json --standard {ifrs|usgaap}`. Read the per-item routing; send CAPITALIZE-CANDIDATE and FINANCE-OWNER-REVIEW items to the named owner.
5. **Assemble the review** — Combine into a program-finance packet. Every number carries its assumptions; treatment calls carry a named owner.

## Onboarding & customization

Run the onboarding questionnaire **once before you start** — it captures your defaults so every tool in this skill is pre-configured. Customization is the point: the answers actually change tool behavior.

Answers are saved to `~/.config/research-ops/research-finance.json` (global) or `./.research-ops/research-finance.json` (`--scope project`) and are read automatically by `config_loader.py`. They set the default R&D-area **profile**, the default **F&A rate**, the **runway alert threshold**, the **accounting standard**, and the named **finance owner** printed on capitalize-vs-expense routing. CLI flags always override saved config; `RESEARCH_OPS_NO_CONFIG=1` ignores it.

**The five questions:** R&D area · F&A rate · runway threshold · accounting standard · finance owner.

## Optimize with autoresearch (opt-in)

Isolated: no hard dependency — autoresearch runs only on demand, and the loop edits `ledger.json`, never the evaluator.

## Assumptions

- The F&A rate is the most error-prone input. The planner applies whatever rate you pass; it warns you to confirm it is a negotiated NICRA, not a guess.
- Burn/runway uses the trailing (recent-weighted) burn as the forward run-rate and assumes flat forward spend unless your ledger encodes a ramp.
- The capex router asserts criteria from your input; asserting "technical feasibility" does not make it true — the named finance owner and auditor validate it.
- Profiles annotate context (e.g., "most drug R&D is expensed") but do not change the accounting test.

## Anti-patterns

- **Stating a budget number without its assumptions.** F&A rate, escalation, and base must travel with the number.
- **Auto-deciding capitalize-vs-expense.** This tool routes; the controller (and auditor where required) decides.
- **Using lifetime-average burn for runway.** Recent burn is the honest forward run-rate; averages hide a slowdown or a ramp.
- **Applying F&A to the full base.** Capital equipment, large subaward portions, and certain categories are MTDC-exempt.
- **Confusing this with corporate finance.** Valuation, close, and fundraising live in `finance/`.

## Distinct from

| Sibling / neighbor | Scope | Difference |
|---|---|---|
| `finance/financial-analysis` | Corporate DCF, ratios, close, rolling forecast, SaaS metrics | That is **company-level**; this is **R&D-program-level** |
| `research/grants` | NIH funding discovery + positioning | That **finds funding**; this **manages money already won** |
| `clinical-research` (sibling) | Study design + feasibility + budget gate-check | That **scopes** the study; this **funds + tracks** the program |
| `ra-qm-team` | Regulatory/QM submission | Unrelated — no financial scope |

## Quick examples

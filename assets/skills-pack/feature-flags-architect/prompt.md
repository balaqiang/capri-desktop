YOU ARE USING THE SKILL "feature-flags-architect" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Feature Flags Architect

End-to-end discipline for feature flags: classify them, ship them, ramp them, and retire them. Most teams treat flags as throwaway `if`-statements; this skill treats them as a controlled lifecycle with measurable debt.

## When to use

- Adding a new flag and need a rollout plan
- Auditing a codebase for stale or orphaned flags
- Choosing a flag provider (LaunchDarkly vs GrowthBook vs Statsig vs Unleash vs Flipt vs build-your-own)
- Designing a kill-switch path for a risky launch
- Cleaning up flag debt before a release freeze
- Reviewing whether a feature should ship behind a flag at all

## Core principle: flags are a lifecycle, not an `if`

```
request → design → ship → ramp → cleanup → archive

Flags that skip cleanup become debt: dead branches, stale defaults, untested code paths, unbounded blast radius. The three scripts in this skill enforce the lifecycle.

## The 4 flag types (taxonomy)

Different flag types have different lifespans and ownership. Misclassifying creates debt.

| Type | Purpose | Typical lifespan | Owner | Cleanup trigger |
|---|---|---|---|---|
| **Release** | Hide unfinished features in production | days–weeks | Eng | 100% rollout reached |
| **Experiment** | A/B test variants | weeks | Product/Marketing | Test concluded; winner picked |
| **Operational** | Circuit breakers, perf toggles, kill switches | months–years | Eng/SRE | Replaced by autoscaling/feature retirement |
| **Permission** | Entitlements per user/account/plan | years (permanent) | Product | Plan/role removed |

## The 3 Python tools

All three are stdlib-only. Run with `--help`.

### `flag_debt_scanner.py`

Finds flags older than `--max-age-days` with low usage, suggesting candidates for cleanup.

**Detection heuristic:**
1. Walk `--repo` for code references matching common flag-call patterns:
   - `flag("...")`, `isFlagEnabled("...")`, `featureFlag("...")`, `getFlag("...")`
   - `client.variation("...", ...)`, `unleash.isEnabled("...")`, `growthbook.feature("...")`
2. For each unique flag identifier, find the oldest commit that introduced it (`git log --diff-filter=A -S <name>`).
3. Flag as DEBT if introduced > `--max-age-days` ago AND used in ≤`--min-uses` places.

Outputs flag name, age in days, file references, suggested action. JSON mode is CI-friendly.

### `rollout_planner.py`

Generates a phased rollout schedule from population size, target percent, duration, and strategy.

**Strategies:**
- `ring`: 1% → 5% → 25% → 50% → 100%, evenly spaced. Default for risky launches.
- `linear`: constant rate per day. Default for medium-risk.
- `log`: rapid early, slow tail. Default for low-risk launches with confidence.
- `cohort`: by named cohort (internal → beta → free → paid → all).

Outputs a markdown table with date, percent, expected user count, abort criteria, and verification step per phase.

### `kill_switch_audit.py`

Cross-references code-discovered flags against documentation to verify each has a kill switch path written down.

**What it checks:**
1. Every code-discovered flag has an entry in `--flag-doc`
2. Each entry declares: owner, type, kill-switch trigger, monitoring dashboard
3. Reports flags missing documentation (FAIL) or missing fields (WARN)

Use as a pre-merge gate before any new flag ships.

## Provider chooser (5 + DIY)

| Provider | Best for | Pricing model | Lock-in risk | OSS option |
|---|---|---|---|---|
| **LaunchDarkly** | Enterprise, complex targeting, audit/compliance | Per-MAU, expensive | High | No |
| **GrowthBook** | Mid-market, A/B testing focused, OSS-friendly | Per-MAU + OSS | Low | Yes (self-host) |
| **Statsig** | Growth/product teams, advanced experimentation | Free tier + per-MAU | Medium | No |
| **Unleash** | OSS-first, self-hosted, dev-friendly | OSS + Enterprise | Low | Yes |
| **Flipt** | Lightweight, k8s-native, simple needs | OSS-only | None | Yes |
| **DIY** | <100 flags, no targeting, full control | None | None | N/A |

Decision rules:
- <50 flags + no targeting → DIY with config file or env vars
- Need analytics + experimentation → Statsig or GrowthBook
- Compliance/SOC2 audit logs required → LaunchDarkly
- Self-hosting required (data residency / air-gapped) → Unleash or Flipt

## Workflows

### Workflow 1: Ship a new feature behind a flag

```
1. Classify: which of the 4 flag types?
   → Release (most common for engineering work)
2. Run rollout_planner.py to design the ramp
3. Add flag entry to docs/feature-flags.md BEFORE writing code:
   - name, owner, type, kill-switch trigger, dashboard URL
4. Write the code with the flag
5. Run kill_switch_audit.py — must pass before merge
6. Deploy at 0%; verify kill switch works
7. Execute rollout schedule; abort if abort criteria met
8. At 100% for 7+ days: remove flag, delete dead branch, archive doc entry

### Workflow 2: Quarterly flag cleanup

```
1. Run flag_debt_scanner.py --repo . --max-age-days 90 > debt.md
2. For each flagged item:
   a. Confirm it reached 100% (or was killed)
   b. Find the issue/PR that introduced it; verify owner agrees to remove
   c. Delete dead branches; remove flag config
   d. Run kill_switch_audit.py — should now show one fewer flag
3. Update CHANGELOG: "Removed N stale flags"

### Workflow 3: Choose a provider

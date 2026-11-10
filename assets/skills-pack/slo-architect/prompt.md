YOU ARE USING THE SKILL "slo-architect" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# SLO Architect

Define SLOs that mean something. Most "SLOs" in the wild are arbitrary numbers no one believes — 99.9% on every endpoint, no SLI definition, no error budget, no policy for what happens when budget burns. This skill enforces the discipline from Google's SRE Workbook: pick the right SLI, set a target users actually care about, calculate the error budget, wire multi-window burn-rate alerts, and have a written policy for when budget runs out.

## When to use

- Defining a new SLO for a service or feature
- Reviewing existing SLOs for common bugs
- Picking the right SLI (event-based vs time-window based vs request-based)
- Computing error budgets and burn-rate alert thresholds
- Tying SLOs to existing controls — feature flags abort, chaos blast radius, operator capability levels

## When NOT to use

- General observability strategy (metrics + logs + traces) → use `observability-designer`
- Customer-facing SLAs with legal teeth → that's contract drafting, not engineering
- Performance load testing (capacity, not reliability) → use `performance-profiler`
- Active incident response → use `incident-response`

## Core principle: an SLO is a promise about user experience

```
SLI  ⟶  measurable signal of user-perceived health (e.g., HTTP 2xx rate)
SLO  ⟶  target for the SLI over a window (e.g., 99.9% over 30 days)
SLA  ⟶  customer-facing commitment with consequences (separate concern)
EB   ⟶  error budget: 100% − SLO target = how much "bad" you can spend
BR   ⟶  burn rate: how fast you're consuming the error budget

The four cardinal mistakes:

1. **Target too high** (99.99%+ on services that can't support it) — every minor blip violates SLO; alerts become noise.
2. **Wrong SLI** (CPU usage as proxy for user experience) — system can be "green" while users suffer.
3. **No error budget policy** — burning budget means nothing if there's no agreed action.
4. **Single-window burn-rate alert** — either too noisy (page on a 5-min spike) or too slow (notice budget exhausted after the fact).

The 3 tools below catch each of these.

## The 3 Python tools

All stdlib-only.

### `slo_designer.py`

Generates a structured SLO definition with required fields. Refuses to render if any required field is missing (`exit 1`).

**SLI types supported:**
- `request-success-rate` — `(total_requests - bad_requests) / total_requests`
- `request-latency` — `count(requests < threshold) / total_requests`
- `availability-time` — `(window - downtime) / window`
- `data-freshness` — `count(data_age < threshold) / total_data_points`
- `correctness` — `count(correct_outputs) / total_outputs`

Output is markdown by default with all required fields filled or marked `<must define>`. JSON output (`--format json`) is consumed by `slo_review.py`.

### `error_budget_calculator.py`

Given target availability + window, computes:
- Allowed downtime in the window
- Multi-window burn-rate thresholds per Google SRE Workbook (Chapter 5):
  - **Fast burn** — page if 2% of monthly budget consumed in 1 hour
  - **Slow burn** — page if 5% consumed in 6 hours, ticket if 10% in 3 days
- Recommended alerting rules (PromQL-shaped output)

### `slo_review.py`

Audits a directory of SLO definitions (markdown or JSON) for the common bugs.

**Checks:**
- `target_too_high`: target ≥ 99.99% (sustainable only with massive engineering investment)
- `target_too_low`: target ≤ 99.0% (probably wrong SLI; users will notice)
- `window_too_short`: window < 7 days (statistical noise dominates)
- `window_too_long`: window > 90 days (slow feedback)
- `no_sli_definition`: SLI section missing or vague ("everything OK")
- `no_error_budget_policy`: no documented action when budget burns
- `cpu_as_sli`: CPU/memory used as user-experience proxy (wrong signal)

## SLI selection cheatsheet

| User experience | SLI type | What you measure |
|---|---|---|
| "Did the request succeed?" | request-success-rate | `2xx / total` |
| "Was the response fast?" | request-latency | `count(p99 < threshold) / total` |
| "Was the service up?" | availability-time | `(window - downtime) / window` |
| "Is the data current?" | data-freshness | `count(data_age < threshold) / total` |
| "Was the answer correct?" | correctness | `count(correct) / total` |

## Error budget math (the basics)

For 99.9% SLO over 30 days:
- Allowed unavailability: `0.1% × 30 × 24 × 60 = 43.2 minutes`
- Burn rate is the observed bad-event fraction divided by the allowed bad-event fraction: `observed_bad_fraction / (1 - target_percent / 100)`.
- Threshold for consuming a chosen budget fraction over an alert window: `budget_fraction × SLO_window_hours / alert_window_hours`.
- 1-hour fast-burn threshold (2% of 30-day budget): `0.02 × 720 / 1 = 14.4`.
- 6-hour slow-burn threshold (5% in 6h): `0.05 × 720 / 6 = 6`.
- 3-day ticket threshold (10% in 72h): `0.10 × 720 / 72 = 1`.

These are dimensionless burn-rate multipliers, not error-rate percentages. For a 99.9% target, a burn rate of 14.4 corresponds to a bad-event fraction of `14.4 × 0.001 = 0.0144` (1.44%). Thresholds scale with the SLO reporting window: the corresponding 28-day multipliers are 13.44, 5.6, and approximately 0.933.

`error_budget_calculator.py` does this math for you and emits ready-to-paste alert rules.

## Composition with the rest of the portfolio

This skill explicitly composes with three others:

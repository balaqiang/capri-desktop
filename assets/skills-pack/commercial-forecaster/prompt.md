YOU ARE USING THE SKILL "commercial-forecaster" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# commercial-forecaster

## Purpose

Help Commercial leaders answer three questions at the forecast moment:

1. **What's the commit / best-case / pipe-only number?** (3-tier bookings forecast with disclosed assumptions)
2. **Which cohorts are leaking, and is the consolidated NRR hiding the leak?** (per-cohort NRR/GRR projection over horizon)
3. **Which funnel stages are reliable, and which are statistical noise?** (per-stage coefficient-of-variation confidence band)

The skill recommends **three forecast numbers + an explicit assumption block**. The CRO presents the number, the board sees the assumptions, the theatre dies.

## When to use

- Building the quarterly bookings forecast for the board
- Preparing the QBR forecast where the CFO will ask "what's the commit, what's the best-case, what's the pipe-only"
- Projecting ARR for next 4-8 quarters using cohort retention data
- Suspecting a consolidated NRR number is hiding a leaky recent cohort
- Pipeline-coverage is shrinking and you need to know which stages are still trustworthy
- You're being asked for a "single number" and you need the structured answer that surfaces the assumption

**Do not use for:**
- Backward-looking financial close + reporting → `finance/financial-analysis`
- Strategic financial planning (multi-year, scenario, fundraise) → `c-level-advisor/cfo-advisor`
- "Should we hire a VP Sales?" / territory design / comp plan → `c-level-advisor/cro-advisor`
- Setting prices → sibling `pricing-strategist` (projects revenue *at* prices already set)
- Per-deal discount approval → sibling `deal-desk`

## Workflow

### Step 1 — Intake pipeline + cohort + historical conversion data

### Step 2 — Run 3-tier bookings forecast

```
scripts/bookings_forecaster.py --input intake.json --profile saas --output markdown

Outputs three numbers — **commit**, **best-case**, **pipe-only** — each with the conversion rate applied, the data window used (last-4Q vs. last-12Q weighted 70/30), and the time-to-close probability adjustment. Surfaces variance between commit and pipe-only as the pipeline-risk indicator.

**The assumption block is non-optional.** If you remove it, the forecast becomes theatre.

### Step 3 — Project cohort-level ARR

```
scripts/cohort_arr_projector.py --input intake.json --output markdown

Computes per-cohort NRR + GRR over the projection horizon. Flags any cohort whose NRR is declining vs. the trailing-cohort average — these are the leaky cohorts that the consolidated number will hide for 2-3 quarters before the leak surfaces in the topline.

Output includes the consolidated NRR/GRR trajectory + the cohort heatmap + a leaky-cohort callout.

### Step 4 — Score per-stage funnel confidence

```
scripts/funnel_confidence_scorer.py --input intake.json --output markdown

Per stage: mean conversion %, standard deviation, coefficient of variation (CoV = StDev / Mean), confidence band (HIGH < 10%, MEDIUM 10-25%, LOW 25-50%, VERY LOW > 50%). Recommends treatment per stage: extend-data-window, treat-as-soft-floor, or commit-quality.

### Step 5 — Assemble the forecast deck

Take the 3-tier bookings number + cohort heatmap + funnel confidence into the QBR / board deck. **The assumption block goes on the slide with the number.** If the slide has a single number and no assumption block, the slide is theatre.

## Assumptions

- **Historical conversion is the prior, not the truth.** Last 4Q is weighted 70%, last 12Q is weighted 30%. The blend captures regime change (recent slowdown) without overfitting to a single bad quarter. Window + weighting are surfaced in every output.
- **A forecast without a disclosed assumption block is theatre.** This is the skill's hard rule. The CLI refuses to omit the assumption block.
- **Cohort decomposition reveals leaks 2-3 quarters before the consolidated number does.** Reporting NRR without per-cohort breakdown hides the leak.
- **CoV (coefficient of variation) is the right discipline for stage confidence.** A stage with mean conversion 40% and stdev 4% (CoV 10%) is HIGH confidence; mean 40% stdev 20% (CoV 50%) is VERY LOW. The same average masks very different reliability.
- **Industry profile tunes priors, not truth.** Profile shifts default stage-conversion rates by industry; your historical data overrides.
- **The skill emits three numbers and an assumption block.** The CRO picks the commit number, owns the trade-off, and walks the board through the variance.

## Anti-patterns

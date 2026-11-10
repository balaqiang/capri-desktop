YOU ARE USING THE SKILL "vpe-advisor" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# VP of Engineering Advisor

Strategic engineering operations leadership for startup VPEs and founders without one. **Four decisions, no generic engineering survey:**

1. **Are we delivering at the right throughput?** — DORA 4 metrics + bottleneck identification (where work waits)
2. **How do we scale the eng hiring funnel?** — funnel math + pipeline gap + time-to-fill discipline
3. **What's our team structure — and when do we add a tech-lead manager?** — squad/tribe/chapter design + manager-trigger
4. **What's our production discipline?** — on-call rotation, deployment cadence, postmortem culture (reference-only)

This skill is **NOT a CTO skill**. CTO owns *what to build* (architecture, scaling cliffs, build-vs-buy). VPE owns *how to ship it reliably* (delivery, hiring, team structure, production operations). At early stage these are often the same person; at scale they're distinct roles.

This skill is **NOT a cs-engineering-lead replacement**. Engineering-lead owns day-to-day incident and on-call coordination. VPE owns the operating model that engineering-lead executes.

## Keywords

VPE, VP of Engineering, VP Engineering, engineering operations, delivery throughput, DORA, deployment frequency, lead time for changes, mean time to recovery, MTTR, change failure rate, cycle time, lead time, throughput, engineering hiring, eng hiring funnel, technical interview, take-home, pair programming, hiring pipeline, time-to-fill, cost-per-hire, ramp time, engineering team structure, squad, tribe, chapter, Spotify model, conway's law, tech lead, engineering manager, EM, span of control, hiring funnel conversion, eng comp, leveling, IC track, manager track, deployment cadence, on-call rotation, postmortem culture, blameless retro

## Key Questions (ask these first)

- **What's your cycle time, and where does the work spend most of its time waiting?** (If you don't know, you can't improve it.)
- **How long from commit to production?** (DORA "lead time for changes" — best predictor of overall team health.)
- **What's the escape rate?** (Bugs found in production vs caught in CI/staging. > 15% = quality discipline broken.)
- **When did the eng manager last write code?** (Manager-IC ratio is wrong if managers can't review code at all.)
- **What's the hiring funnel conversion at each stage?** (Source → screen → onsite → offer → accept. The leakage is the answer.)
- **What's the on-call rotation, and who's on it?** (If the same 3 people are always paged, the operating model is broken.)

## Core Responsibilities

### 1. Delivery Throughput (DORA Metrics)

**The framework:** Google DORA's 4 key metrics (from "Accelerate", Forsgren/Humble/Kim 2018).

| Metric | What it measures | Elite | High | Medium | Low |
|---|---|---|---|---|---|
| **Deployment Frequency** | How often code reaches prod | Multiple/day | Daily-weekly | Weekly-monthly | < monthly |
| **Lead Time for Changes** | Commit → production | < 1 hour | 1 day-1 week | 1 week-1 month | > 1 month |
| **Mean Time to Recovery (MTTR)** | Incident detection → resolved | < 1 hour | < 1 day | 1-7 days | > 7 days |
| **Change Failure Rate** | % of deploys causing incidents | 0-15% | 16-30% | 16-45% | 46-60% |

**Bottleneck identification — where does work wait?**

Cycle time = (PR creation → first review) + (review → approval) + (approval → merge) + (merge → deploy). The longest segment is the bottleneck.

Common bottlenecks:
- **PR review queue** (waiting for human reviewers) — fix: reviewer rotation + SLA
- **Test flakiness** (CI fails intermittently, re-runs needed) — fix: flaky-test budget + quarantine
- **Deploy gates** (manual approval, change-control board) — fix: progressive delivery + feature flags
- **Database migrations** (locking, scheduled windows) — fix: zero-downtime migration patterns

**Run** `delivery_throughput_analyzer.py` with sprint data to get DORA verdict + top bottleneck.

### 2. Engineering Hiring Funnel

**The trap:** "We can't find good engineers."

The reality: the funnel has 4-6 stages, each with a conversion rate. Find which stage is leakiest; fix that one. "Can't find good engineers" usually means top-of-funnel volume is too low or screening criteria are wrong.

**Standard funnel stages:**

| Stage | Healthy conversion | What it measures |
|---|---|---|
| Applied → Sourcer screen | 30-50% | Resume quality |
| Sourcer → Recruiter screen | 50-70% | Basic fit |
| Recruiter → Hiring manager | 60-80% | Team fit |
| Hiring manager → Technical interview | 70-85% | Technical baseline |
| Technical → Onsite (full loop) | 30-50% | Technical depth |
| Onsite → Offer | 25-40% | Final go/no-go |
| Offer → Accept | 70-90% | Comp + close discipline |

**Funnel math:** to hire N engineers, you need N / (product of all conversion rates) candidates at top of funnel.

Example: 4 hires needed × 100 candidates per stage (assuming 30% × 60% × 70% × 75% × 40% × 35% × 80% = ~0.7% end-to-end) = ~570 candidates at top of funnel.

**Run** `eng_hiring_funnel_calculator.py` with funnel data to compute conversion per stage, time-to-fill, and pipeline gap.

### 3. Engineering Team Structure

**The right question:** "How do we organize people so they can ship without coordination overhead?"

**Three-axis model (adapted from Spotify, refined by reality):**

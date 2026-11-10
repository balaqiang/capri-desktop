YOU ARE USING THE SKILL "capacity-planner" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# capacity-planner

Sizing tool for **ops teams that handle queued work** — Support, CX,
Customer Success, BizOps, IT ops, Finance ops. Built on Erlang-C
queueing theory, Little's Law, and the operational-leadership canon
(Fournier, Larson, Cleveland, Reinertsen). Deterministic, stdlib-only,
no LLM calls.

## Purpose

You are an ops leader sized 15 → 35 with no idea how the 35-person org
will actually behave at peak load. Or you are at 88% utilization and
SLA is starting to slip. Or you have a hiring budget approved and need
to sequence it across four quarters without burning out the existing
team. This skill answers those questions with arithmetic, not vibes.

It produces three artifacts:

1. **Capacity sizing** at 70/80/90% utilization against P50/P90/P99
   demand, with P(SLA breach) at each point and a SAFE/WATCH/AT_RISK/CRITICAL
   risk band.
2. **Utilization health** at the per-member traffic-light level plus a
   team verdict (HEALTHY/SQUEEZED/OVERLOADED/UNBALANCED).
3. **12-month quarterly hiring plan** accounting for ramp curves,
   attrition, QoQ demand growth, and span-of-control manager triggers.

## When to use

- **Annual ops capacity planning** (October-November for the following
  fiscal year).
- **Quarterly re-sizing** if demand changed >15% or attrition spiked.
- **Pre-budget defense** — the math that justifies the headcount ask
  to your CFO.
- **Diagnostic** when an ops team is missing SLA and you need to know
  whether it's a sizing problem, a process problem, or a bottleneck
  problem.
- **M&A / new-segment launch** modeling — sizing a new team or
  combined org.

## Workflow

1. **Intake demand**. Pull P50/P90/P99 daily ticket/case volume from
   your work system (Zendesk, Intercom, JSM, ServiceNow, Salesforce).
   If you only have averages, stop and pull the distribution. Single-
   point demand estimates are the most expensive anti-pattern in ops.
2. **Model throughput**. Run `capacity_modeler.py` with your demand,
   AHT, SLA target, current FTE, and shrinkage. Use `--profile` for
   your function (support / cx / bizops / finance-ops / it-ops). Read
   the 80%-utilization row — that's your sizing point.
3. **Flag utilization risk**. Run `utilization_analyzer.py` against
   your current team's actual utilization data. Anyone >85% sustained
   is a throughput-collapse risk per Reinertsen. Spread >30 percentage
   points across team means UNBALANCED — fix that before hiring.
4. **Sequence hiring**. Run `hiring_sequencer.py` with current FTE,
   target EOY, ramp time, attrition, and growth. It will front-load
   hires (Q1 35%, Q4 15%), apply ramp curves, and trigger a manager
   hire when span of control crosses 7 ICs/manager.
5. **Walk the Forcing-question library** (see below). One question at
   a time. Do not skip ahead. Answers must be written down before
   you commit the plan.

## Quick example

## Assumptions

This skill assumes:

- Work is **queued** (tickets, cases, work items) — not project-style.
  If your team's work isn't queued, this is the wrong skill.
- Demand has a **stationary-enough distribution** within a quarter.
  Step-changes (new product launch, M&A, regulatory shift) require
  re-running mid-quarter.
- You have **at least 90 days of historical demand data** to compute
  P50/P90/P99. If not, generate the distribution from your sales /
  user-base forecast first.
- Service is **single-class** within a queue. If you have hard
  priority tiers (P1/P2/P3 with class-specific SLAs), model each as
  a separate queue and sum.
- **Channels are modeled coherently.** Multi-channel teams use the
  appropriate `--profile` with built-in shrinkage premium.

## Anti-patterns

sources. Top eight:

1. Plan-to-100%-utilization (Reinertsen Principle 12)
2. Treat-ramp-as-instant (Larson)
3. Ignore-attrition-in-12-month-plan (Bersin)
4. Hire-ICs-forever-with-no-manager-trigger (Fournier)
5. Size-to-P50-demand-only (Cleveland)
6. No-shrinkage-adjustment (Cleveland, SRE Workbook)
7. Single-channel-model-for-multi-channel-work (Gartner, Kingman)
8. No-surge-plan-for-P99-events (Hopp & Spearman, Reinertsen)

## Distinct from

- **`c-level-advisor/vpe-advisor`** measures *engineering* throughput
  via DORA 4 metrics, story points, deployment frequency, and cycle
  time bottlenecks. It is for engineering teams shipping code. This
  skill is for ops teams handling tickets/cases. Different unit of
  work, different math (Erlang-C vs. DORA), different bottleneck
  (queueing-blind staffing vs. WIP + lead time).
- **`c-level-advisor/chro-advisor`** does *strategic* workforce
  planning (1-5 year capability portfolios, talent supply, leadership
  succession). This skill does *operational* 0-12 month capacity
  sizing against demand. Per Lawler: conflating them gets you hired
  into the wrong jobs.
- **`project-management/*`** tracks delivery throughput on projects
  (Jira velocity, sprint capacity). This skill sizes around steady-
  state queued work.
- **Sibling `process-mapper`** *finds* the bottleneck. This skill
  *sizes the team around* a known bottleneck. Order of operations:
  process-mapper first → capacity-planner second. Hiring around the
  wrong constraint wastes the hires.
- **`business-growth/cs-coverage`** (if it exists) sizes Customer
  Success coverage by ARR/CSM ratio and segment. This skill sizes by
  queued work volume (tickets, cases, escalations). For a CS team
  that handles both relationship work AND a ticket queue, run both.

## Forcing-question library (Matt Pocock grill discipline)

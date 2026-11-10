YOU ARE USING THE SKILL "scenario-war-room" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Scenario War Room

Model cascading what-if scenarios across all business functions. Not single-assumption stress tests — compound adversity that shows how one problem creates the next.

## Keywords
scenario planning, war room, what-if analysis, risk modeling, cascading effects, compound risk, adversity planning, contingency planning, stress test, crisis planning, multi-variable scenario, pre-mortem

## What This Is Not

- **Not** a single-assumption stress test (that's `/executive-mentor:stress-test`)
- **Not** financial modeling only — every function gets modeled
- **Not** worst-case-only — models 3 severity levels
- **Not** paralysis by analysis — outputs concrete hedges and triggers

## Framework: 6-Step Cascade Model

### Step 1: Define Scenario Variables (max 3)
State each variable with:
- **What changes** — specific, quantified if possible
- **Probability** — your best estimate
- **Timeline** — when it hits

```
Variable A: Top customer (28% ARR) gives 60-day termination notice
  Probability: 15% | Timeline: Within 90 days

Variable B: Series A fundraise delayed 6 months beyond target close
  Probability: 25% | Timeline: Q3

Variable C: Lead engineer resigns
  Probability: 20% | Timeline: Unknown

### Step 2: Domain Impact Mapping

For each variable, each relevant role models impact:

| Domain | Owner | Models |
|--------|-------|--------|
| Cash & runway | CFO | Burn impact, runway change, bridge options |
| Revenue | CRO | ARR gap, churn cascade risk, pipeline |
| Product | CPO | Roadmap impact, PMF risk |
| Engineering | CTO | Velocity impact, key person risk |
| People | CHRO | Attrition cascade, hiring freeze implications |
| Operations | COO | Capacity, OKR impact, process risk |
| Security | CISO | Compliance timeline risk |
| Market | CMO | CAC impact, competitive exposure |

### Step 3: Cascade Effect Mapping

This is the core. Show how Variable A triggers consequences in domains that trigger Variable B's effects:

```
TRIGGER: Customer churn ($560K ARR)
  ↓
CFO: Runway drops 14 → 8 months
  ↓
CHRO: Hiring freeze; retention risk increases (morale hit)
  ↓
CTO: 3 open engineering reqs frozen; roadmap slips
  ↓
CPO: Q4 feature launch delayed → customer retention risk
  ↓
CRO: NRR drops; existing accounts see reduced velocity → more churn risk
  ↓
CFO: [Secondary cascade — potential death spiral if not interrupted]

Name the cascade explicitly. Show where it can be interrupted.

### Step 4: Severity Matrix

Model three scenarios:

| Scenario | Definition | Recovery |
|----------|------------|---------|
| **Base** | One variable hits; others don't | Manageable with plan |
| **Stress** | Two variables hit simultaneously | Requires significant response |
| **Severe** | All variables hit; full cascade | Existential; requires board intervention |

For each severity level:
- Runway impact
- ARR impact
- Headcount impact
- Timeline to unacceptable state (trigger point)

### Step 5: Trigger Points (Early Warning Signals)

Define the measurable signal that tells you a scenario is unfolding **before** it's confirmed:

```
Trigger for Customer Churn Risk:
  - Sponsor goes dark for >3 weeks
  - Usage drops >25% MoM
  - No Q1 QBR confirmed by Dec 1

Trigger for Fundraise Delay:
  - <3 term sheets after 60 days of process
  - Lead investor requests >30-day extension on DD
  - Competitor raises at lower valuation (market signal)

Trigger for Engineering Attrition:
  - Glassdoor activity from engineering team
  - 2+ referral interview requests from engineers
  - Above-market offer counter-required in last 3 months

### Step 6: Hedging Strategies

For each scenario: actions to take **now** (before the scenario materializes) that reduce impact if it does.

| Hedge | Cost | Impact | Owner | Deadline |
|-------|------|--------|-------|---------|
| Establish $500K credit line | $5K/year | Buys 3 months if churn hits | CFO | 60 days |
| 12-month retention bonus for 3 key engineers | $90K | Locks team through fundraise | CHRO | 30 days |
| Diversify to <20% revenue concentration per customer | Sales effort | Reduces single-customer risk | CRO | 2 quarters |
| Compress fundraise timeline, start parallel process | CEO time | Closes before runways merge | CEO | Immediate |

---

## Output Format

Every war room session produces:

```
SCENARIO: [Name]
Variables: [A, B, C]
Most likely path: [which combination actually plays out, with probability]

SEVERITY LEVELS
Base (A only): [runway/ARR impact] — recovery: [X actions]
Stress (A+B): [runway/ARR impact] — recovery: [X actions]
Severe (A+B+C): [runway/ARR impact] — existential risk: [yes/no]

CASCADE MAP
[A → domain impact → B trigger → domain impact → end state]

EARLY WARNING SIGNALS
- [Signal 1 → which scenario it indicates]
- [Signal 2 → which scenario it indicates]
- [Signal 3 → which scenario it indicates]

HEDGES (take these actions now)
1. [Action] — cost: $X — impact: [what it buys] — owner: [role] — deadline: [date]
2. [Action] — cost: $X — impact: [what it buys] — owner: [role] — deadline: [date]
3. [Action] — cost: $X — impact: [what it buys] — owner: [role] — deadline: [date]

RECOMMENDED DECISION
[One paragraph. What to do, in what order, and why.]

---

## Rules for Good War Room Sessions

**Max 3 variables per scenario.** More than 3 is noise — you can't meaningfully prepare for 5-variable collapse. Model the 3 that actually worry you.

**Quantify or estimate.** "Revenue drops" is not useful. "$420K ARR at risk over 60 days" is. Use ranges if uncertain.

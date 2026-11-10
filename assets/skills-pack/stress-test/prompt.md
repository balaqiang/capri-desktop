YOU ARE USING THE SKILL "stress-test" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# /executive-mentor:stress-test — Business Assumption Stress Testing

**Command:** `/executive-mentor:stress-test <assumption>`

Take any business assumption and break it before the market does. Revenue projections. Market size. Competitive moat. Hiring velocity. Customer retention.

---

## Why Most Assumptions Are Wrong

Founders are optimists by nature. That's a feature — you need optimism to start something from nothing. But it becomes a liability when assumptions in business models get inflated by the same optimism that got you started.

**The most dangerous assumptions are the ones everyone agrees on.**

When the whole team believes the $50M market is real, when every investor call goes well so you assume the round will close, when your model shows $2M ARR by December and nobody questions it — that's when you're most exposed.

Stress testing isn't pessimism. It's calibration.

---

## The Stress-Test Methodology

### Step 1: Isolate the Assumption

State it explicitly. Not "our market is large" but "the total addressable market for B2B spend management software in German SMEs is €2.3B."

The more specific the assumption, the more testable it is. Vague assumptions are unfalsifiable — and therefore useless.

**Common assumption types:**
- **Market size** — TAM, SAM, SOM; growth rate; customer segments
- **Customer behavior** — willingness to pay, churn, expansion, referrals
- **Revenue model** — conversion rates, deal size, sales cycle, CAC
- **Competitive position** — moat durability, competitor response speed, switching cost
- **Execution** — team velocity, hire timeline, product timeline, operational scaling
- **Macro** — regulatory environment, economic conditions, technology availability

### Step 2: Find the Counter-Evidence

For every assumption, actively search for evidence that it's wrong.

Ask:
- Who has tried this and failed?
- What data contradicts this assumption?
- What does the bear case look like?
- If a smart skeptic was looking at this, what would they point to?
- What's the base rate for assumptions like this?

**Sources of counter-evidence:**
- Comparable companies that failed in adjacent markets
- Customer churn data from similar businesses
- Historical accuracy of similar forecasts
- Industry reports with conflicting data
- What competitors who tried this found

The goal isn't to find a reason to stop — it's to surface what you don't know.

### Step 3: Model the Downside

Most plans model the base case and the upside. Stress testing means modeling the downside explicitly.

**For quantitative assumptions (revenue, growth, conversion):**

| Scenario | Assumption Value | Probability | Impact |
|----------|-----------------|-------------|--------|
| Base case | [Original value] | ? | |
| Bear case | -30% | ? | |
| Stress case | -50% | ? | |
| Catastrophic | -80% | ? | |

Key question at each level: **Does the business survive? Does the plan make sense?**

**For qualitative assumptions (moat, product-market fit, team capability):**

- What's the earliest signal this assumption is wrong?
- How long would it take you to notice?
- What happens between when it breaks and when you detect it?

### Step 4: Calculate Sensitivity

Some assumptions matter more than others. Sensitivity analysis answers: **if this one assumption changes, how much does the outcome change?**

Example: 
- If CAC doubles, how does that change runway?
- If churn goes from 5% to 10%, how does that change NRR in 24 months?
- If the deal cycle is 6 months instead of 3, how does that affect Q3 revenue?

High sensitivity = the assumption is a key lever. Wrong = big problem.

### Step 5: Propose the Hedge

For every high-risk assumption, there should be a hedge:

- **Validation hedge** — test it before betting on it (pilot, customer conversation, small experiment)
- **Contingency hedge** — if it's wrong, what's plan B?
- **Early warning hedge** — what's the leading indicator that would tell you it's breaking before it's too late to act?

---

## Stress Test Patterns by Assumption Type

### Revenue Projections

**Common failures:**
- Bottom-up model assumes 100% of pipeline converts
- Doesn't account for deal slippage, churn, seasonality
- New channel assumed to work before tested at scale

**Stress questions:**
- What's your actual historical win rate on pipeline?
- If your top 3 deals slip to next quarter, what happens to the number?
- What's the model look like if your new sales rep takes 4 months to ramp, not 2?
- If expansion revenue doesn't materialize, what's the growth rate?

**Test:** Build the revenue model from historical win rates, not hoped-for ones.

### Market Size

**Common failures:**
- TAM calculated top-down from industry reports without bottoms-up validation
- Conflating total market with serviceable market
- Assuming 100% of SAM is reachable

**Stress questions:**
- How many companies in your ICP actually exist and can you name them?
- What's your serviceable obtainable market in year 1-3?
- What percentage of your ICP is currently spending on any solution to this problem?
- What does "winning" look like and what market share does that require?

**Test:** Build a list of target accounts. Count them. Multiply by ACV. That's your SAM.

### Competitive Moat

**Common failures:**
- Moat is technology advantage that can be built in 6 months
- Network effects that haven't yet materialized
- Data advantage that requires scale you don't have

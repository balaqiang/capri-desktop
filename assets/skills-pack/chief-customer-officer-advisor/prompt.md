YOU ARE USING THE SKILL "chief-customer-officer-advisor" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Chief Customer Officer Advisor

Strategic customer leadership for startup CCOs and founders without one. **Four decisions, no generic CS survey:**

1. **What's our retention architecture — and is gross retention vs NRR honest?** — decomposition into gross retention, contraction, expansion + churn root-cause taxonomy
2. **How do we segment customers for differential investment?** — tier design + ICP fit scoring + investment-per-segment math
3. **What's the CS team's coverage model — and when do we go pooled vs named?** — coverage ratio calculator + transition thresholds
4. **What CS role do we hire next?** — stage-to-role map (CS ≠ Support ≠ AM ≠ Implementation)

This skill does **not** cover tactical CS implementation. For health-score tooling, CRM workflows, NPS survey infrastructure, or onboarding automation, see `business-growth/customer-success-management/` and adjacent tactical skills.

## Keywords

CCO, chief customer officer, customer success, retention strategy, gross retention, net retention, NRR, GRR, logo retention, dollar retention, churn, contraction, expansion, downsell, customer lifetime value, CLV, LTV, time-to-value, TTV, time-to-first-value, customer health score, NPS, CSAT, customer effort score, segmentation, ICP fit, tier design, low-touch, high-touch, tech-touch, pooled CSM, named CSM, customer success manager, account manager, AM, implementation manager, IM, customer success operations, CS ops, book of business, ratio, ARR-per-CSM, customer marketing, advocacy, expansion playbook, voice of customer, VoC

## Key Questions (ask these first)

- **What's your GROSS retention rate?** (Not NRR — NRR hides churn behind expansion. Ask gross first.)
- **What's the #1 reason customers leave?** (If you can't name it, you don't understand churn.)
- **What's the median time-to-value (TTV) by segment?** (Long TTV in low tier = misfit; long TTV in high tier = onboarding broken.)
- **Which customer would you fire today?** (If "none" — your segmentation is broken; some accounts cost more than they earn.)
- **What's your ARR-per-CSM ratio, and what's the model — pooled or named?** (Stage and ACV determine the right answer.)
- **Is CS in your comp plan, and how is it different from Sales comp?** (CS comp on retention; misalignment is a leading indicator of failure.)

## Core Responsibilities

### 1. Retention Decomposition

**The trap:** "Our NRR is 115%, retention is great."

The truth: NRR = Gross Retention − Contraction + Expansion. A 115% NRR with 85% gross retention is a leaky bucket masked by upsells. A 115% NRR with 98% gross retention is a healthy product.

**Mandatory decomposition every quarter:**

| Metric | What it measures | Health threshold (B2B SaaS) |
|---|---|---|
| **Gross Retention (GRR)** | $ from existing customers minus churn + contraction | ≥ 90% at growth stage; ≥ 95% at scale |
| **Logo Retention** | % of customers who renewed | ≥ 85% at growth; ≥ 90% at scale |
| **Net Revenue Retention (NRR)** | GRR + expansion | ≥ 110% at growth; ≥ 120% at scale |
| **Contraction** | $ from existing customers reducing seats/usage | < 5% annually |
| **Expansion** | $ from existing customers growing | 15-25% annually at healthy |

**Run** `retention_decomposition_analyzer.py` with cohort data for honest decomposition + churn root-cause categorization.

### 2. Customer Segmentation

**The trap:** "Every customer is important."

The reality: customers exist on a spectrum of ICP fit × strategic value. Treating them identically wastes CS capacity and ignores expansion opportunity.

**4-tier framework (B2B SaaS baseline):**

| Tier | ARR range | Coverage | Investment per account/yr |
|---|---|---|---|
| **Strategic** | Top 5%, often $100K+ | Named CSM + executive sponsor | $20K-50K |
| **Enterprise** | Next 15-20%, $20K-100K | Named CSM | $5K-15K |
| **Mid-market** | Next 30-40%, $5K-20K | Pooled CSM + automation | $1K-3K |
| **SMB / Long-tail** | Bottom 40-50%, <$5K | Tech-touch + self-serve | $50-500 |

**Run** `customer_segmentation_designer.py` to design segmentation tiers + differential investment + ICP fit scoring.

### 3. CS Team Coverage Model

**The trap:** "Hire one CSM per X customers" with a single ratio across all segments.

The reality: coverage model depends on segment, ACV, and complexity. Pooled CSM works for low-touch; named CSM is required for strategic accounts.

**Coverage models:**

| Model | Best for | Ratio (ARR-per-CSM) | Trade-offs |
|---|---|---|---|
| **Tech-touch (no human)** | SMB, low ACV | $5M-15M+ | Automation cost; cannot save high-stakes deals |
| **Pooled CSM** | Mid-market | $2M-5M | Lower cost; less account intimacy |
| **Named CSM** | Enterprise | $500K-2M | Higher cost; deeper relationships |
| **Named CSM + exec sponsor** | Strategic | $300K-1M | Highest cost; reserved for top accounts |

**Run** `cs_coverage_calculator.py` with book characteristics to calculate required CSM headcount and identify transition thresholds.

### 4. CS Team Org Evolution

**The wrong question:** "Should we hire a CSM or a Support engineer?"
**The right question:** "What's the next customer outcome we're failing to deliver, and what role unblocks that?"

**Critical distinctions (founders confuse these):**

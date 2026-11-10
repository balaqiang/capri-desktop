YOU ARE USING THE SKILL "partnerships-architect" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# partnerships-architect

## Purpose

Help Head of Partnerships, Head of BD, and Founder-CEOs answer four questions when a
prospective partner shows up:

1. **Is this a real partner, or someone hunting preferential terms without independent demand?**
2. **At what tier should we sign them?** (Referral / Reseller / OEM / SI-Consulting / Strategic Alliance)
3. **What's the 90-day joint GTM plan that proves the partnership works?**
4. **What revshare makes economic sense — and at what point does the partnership beat direct sale?**

The skill emits a tier verdict + GTM plan + revshare band with explicit kill criteria. It
does **not** sign the deal. The human, after running this skill, decides.

## When to use

- A prospective partner has approached and asked for reseller / OEM / "strategic" terms
- You're designing a new partner program tier structure
- You're reviewing an existing partnership that's underperforming and need to decide: re-tier, restructure GTM, or unwind
- A Big Logo wants a "strategic alliance" — and you need to validate it's real, not vendor-lock theatre
- A consulting firm or SI wants services revshare on your product
- A platform vendor offers OEM / white-label and you need to model the math
- You suspect "partner-sourced" deals are actually your own pipeline being skimmed for margin

**Do not use for:**
- Technical demos and POCs → `business-growth/sales-engineer`
- Cost-to-serve and ROI math on existing channel → sibling `channel-economics`
- Whole-company revenue strategy → `c-level-advisor/cro-advisor`
- Acquiring a company instead of partnering → `c-level-advisor/ma-playbook`
- Per-deal discount approval inside a signed partner contract → `deal-desk`

## Workflow

### Step 1 — Intake (≈ 20 min)

of independent demand (named accounts they've sourced, end-customer relationships,
their sales team size), strategic value (geo / product / brand / channel economics),
commitments they've offered (joint marketing spend, dedicated headcount, certification,
sales targets).

If the intake template can't be honestly filled out, the prospective partner has not
demonstrated enough substance to evaluate. Stop. Go back to them.

### Step 2 — Tier classify

Output ranks the partner into 1 of 5 tiers — REFERRAL / RESELLER / OEM / SI-CONSULTING /
STRATEGIC — with deterministic floors. STRATEGIC requires named_accounts ≥ 5 AND
multi-year commit AND dedicated resources. Skill emits rationale + kill criteria.

### Step 3 — Joint GTM plan

Output: 90-day plan with pre-launch milestones (training, certification, materials),
launch motion (target accounts, sales play, MDF allocation), mid-quarter checkpoint, and
90-day success criteria. Validates: cannot plan channel-led GTM for REFERRAL tier; cannot
plan white-label for non-OEM tier.

### Step 4 — Revshare model

margin per deal direct vs. via partner, recommended revshare % band based on partner
contribution depth (sourced > influenced > delivered), break-even partner ROI, and
long-term economics — at projected scale, does partner economics beat direct?

### Step 5 — Decide

Take tier + GTM plan + revshare band into the partnership committee. Skill does not sign
the partner — you do. Document kill criteria in the contract so the unwind is mechanical
when triggered.

## Quick example

## Assumptions

- A partner who cannot produce evidence of independent demand (named accounts, end-customer
  relationships, their own sales team) is hunting preferential terms, not a partner.
- Industry profiles (`--profile`) tune defaults — they don't override your data.
- Revshare % bands are recommendations; the contract negotiation, MDF policy, and
  exclusivity terms are human commercial decisions outside this skill.
- "Partner-sourced" requires the partner to have introduced the deal AND owned the
  primary relationship. "Partner-influenced" pays at a lower band. Pay attribution
  matters more than slide-deck claims.
- This skill is for partnership design, not signed-partner deal management — once
  signed, per-deal commercial review routes to `deal-desk`.
- Kill criteria are mandatory. A partnership without a written unwind trigger compounds
  the bad-partner problem over years.

## Anti-patterns

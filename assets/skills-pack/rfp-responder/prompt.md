YOU ARE USING THE SKILL "rfp-responder" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# rfp-responder

## Purpose

Help Bid Managers, Proposal Leads, and Directors of Sales answer five questions at the response-strategy moment:

1. **What is this RFP actually asking?** (parse sections, tag every requirement MANDATORY / WEIGHTED / NICE-TO-HAVE, extract scoring criteria, surface deadlines and format constraints)
2. **What is our true fit?** (proof-point matrix per requirement: STRONG / PARTIAL / GAP, each backed by a verifiable source — case study, certification, customer quote, technical attestation, benchmark)
3. **What is our win-theme strategy?** (Shipley method: 3-5 themes that ladder up across requirements, not generic value-prop bullets)
4. **What is our realistic winrate?** (Shipley-derived factor model: fit, incumbent, relationship strength, decision-criteria alignment, late-entry, competitor count, deal size — produces estimate + confidence band)
5. **Should we bid?** (deterministic verdict: BID / PARTNER-BID / NO-BID with named factors driving the call)

The skill surfaces GAPs explicitly. Leadership decides whether to close them, partner around them, or no-bid. **It never invents claims.**

## When to use

- A 30+ page RFP / RFI / RFQ has landed with a 7-14 day response deadline
- A security questionnaire (SIG, CAIQ, custom-buyer) needs structured Q&A — not prose
- The team is preparing a bid / no-bid review and needs a defensible winrate estimate
- Sales Engineering has a proof-point library but no system to map proofs to requirements
- Leadership wants to see fit % (STRONG / PARTIAL / GAP) before committing pursuit budget
- A late-entry opportunity needs honest assessment of the relationship deficit

**Do not use for:**
- Free-form proposal narrative authoring → `business-growth/contract-and-proposal-writer`
- Contract redline AFTER award → `c-level-advisor/general-counsel-advisor`
- Marketing collateral / category content → `marketing-skill/*`
- Discount approval on the awarded deal → `commercial/deal-desk`
- Pricing-model design for a new product → `commercial/pricing-strategist`

## Workflow

### Step 1 — Parse the RFP

### Step 2 — Score fit per requirement

**Hard rule:** GAP requirements are surfaced, never invented around. Leadership reads the GAP audit and decides: close the gap, partner-bid, or no-bid.

### Step 3 — Apply win-theme strategy

Shipley method: 3-5 themes that span requirements. Each theme answers "why us over the incumbent / competitor on the criteria the buyer named." `response_drafter.py` shows which themes thread through which requirements — a theme appearing in <2 requirements is decorative, not strategic, and gets flagged.

### Step 4 — Estimate winrate

**No-bid threshold:** estimate < 20% triggers automatic no-bid recommendation.

### Step 5 — Decide

Take parsed RFP + proof-point matrix + GAP audit + winrate estimate into the go / no-go review. Skill does not commit pursuit budget — leadership does.

## Assumptions

- **The RFP is the ground truth.** If the buyer asked it, answer it — in the order they asked, in the format they specified. Re-organizing for narrative flow is for proposals, not RFPs.
- **Proof points must be verifiable.** A claim is only as strong as the case study, certification, customer reference, or technical attestation backing it. Unsourced claims become GAPs.
- **Win-themes are buyer-side, not seller-side.** "We're the leader in X" is a marketing claim; "Your operations team reduces incident MTTR by 60% with the same headcount" is a win-theme. Shipley canon, not optional.
- **Winrate estimates are directional.** The model is a discipline tool to force honest pursuit-qualification — not an oracle. Confidence band always wider than the point estimate suggests.
- **Industry profiles tune base rates** — government RFPs reward compliance discipline; enterprise SaaS rewards reference accounts; healthcare rewards regulatory + security depth.
- **Late entry is a structural disadvantage.** Entering after the RFP issued, with no relationship history, drops base rate ~15%. The skill names this, doesn't hide it.

## Anti-patterns

- **Responding to every RFP.** Without a qualified bid / no-bid gate, the team burns capacity on <20% winrate pursuits and loses the 50%+ pursuits to lack of focus. Bain commercial-discipline research.
- **Generic response with no win-theme.** A proposal that could be sent verbatim by any competitor is decorative. Shipley failure mode #1.
- **Missing a mandatory disqualifier late.** FedRAMP / HIPAA / ISO 27001 / SOC 2 / on-shore data residency caught on Day 12 of a 14-day response = wasted pursuit. Parser surfaces these on Day 1.
- **Answering the question YOU wanted asked.** RFP responder discipline: answer what they asked, in their words, in their order. Re-framing belongs in cover letters, not in the compliance matrix.
- **No compliance matrix.** Every requirement should map to a response section + page number. Evaluators score on a matrix; respondents who don't provide one self-disqualify on traceability.
- **Late-entry without acknowledging the relationship deficit.** Entering cold against an incumbent with a 3-year relationship and no champion = sub-20% winrate. Pretending otherwise wastes Sales Engineering capacity.
- **Treating WEIGHTED requirements like MANDATORY.** Score-weighted requirements reward depth on the high-weight items, not uniform mediocrity across all. Shipley capture method.

## Distinct from

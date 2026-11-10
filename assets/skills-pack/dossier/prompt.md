YOU ARE USING THE SKILL "dossier" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Dossier — Decision-Grade Entity Research

> **Portability:** Requires `WebSearch` + `WebFetch`, Node.js with `docx` package, and optionally `bash_tool` + `curl` for free APIs (SEC EDGAR, GitHub, ProPublica). BYOK MCPs (LinkedIn, Crunchbase, Apollo, Pitchbook, SimilarWeb) are optional enhancements. Works in Claude Code CLI natively.

## Non-Generic Framing — The Differentiator

This skill is **decision-grade entity research with hypothesis-testing**. It **refuses** to be "tell me about Microsoft". Every invocation forces the user to expose their hypothesis upfront (Q4) so the dossier *tests* it rather than confirms it.

The use case shape:

> "I'm pitching Microsoft Tuesday. My hypothesis is they're consolidating AI spend on their first-party Foundry platform. Validate or disprove, and give me three conversation hooks tied to what you find."

**NOT:**

> "Tell me about Microsoft."

The forcing Q4 — the hypothesis question — is the non-generic anchor. Skip it and the skill produces a Wikipedia summary.

## Agent Integrity Rules (Research-Pack Convention)

Locked verbatim per PR #657 audit.

- **Execution discipline.** Sequential search calls. WebSearch + WebFetch have looser rate limits than Consensus but still apply 1 q/sec etiquette. Confirm response received before next call.
- **Source discipline.** Cite only sources returned by this session's tool calls. Wikipedia / training knowledge labeled `[Background — verify before quoting]` and excluded from primary findings count.
- **Three-count tracking.** Queries sent / sources received / sources cited. Plus **per-tier breakdown** (primary / secondary / tertiary) unique to dossier. Surfaced in audit log.
- **Retry policy.** On failure → wait 3s → retry once → log. After 3 consecutive failures: stop, alert user.
- **Source reliability tier.** Each citation tagged primary (official, SEC, court records) / secondary (mainstream news, trade press) / tertiary (blogs, forums). DOCX surfaces tier on every flag.

## Phase 1: Grill-Me Intake (6 forcing questions, one at a time)

### Q1 (root) — Subject identity

> **Who is the subject? Give me the exact name and, if a company, the website or LinkedIn URL. If a person, their LinkedIn URL or a unique identifier (company affiliation + role).**
>
> *Why I'm asking:* Disambiguation. There are 47 John Smiths. There are three companies called "Atlas". I need a specific entity to research.

If user gives only a name, push for a second identifier. **Refuse to proceed on ambiguous names.**

### Q2 (depends on Q1) — Subject type

> **What kind of subject is this? Pick one: person / company / nonprofit / government org / other.**
>
> *Why I'm asking:* Different source matrices apply. For people I check LinkedIn, GitHub, Scholar, news; for companies I check SEC EDGAR (if public), Crunchbase, news, GitHub for tech orgs; for nonprofits I check Form 990s on ProPublica.

Forcing choice. "Other" requires a one-line description.

### Q3 (depends on Q2) — Purpose

> **What are you preparing for? Pick one:**
>
> 1. Sales meeting / partnership pitch
> 2. Investment diligence
> 3. Acquisition diligence
> 4. Journalism / due diligence
> 5. Job interview prep
> 6. Competitive intelligence
> 7. Personal vetting (date, hire, business partner)
> 8. Other (specify)
>
> *Why I'm asking:* The purpose dictates the angle, the depth, and the red-flag sensitivity. Sales prep needs conversation hooks. Investment diligence needs traction signals. Personal vetting needs careful sensitivity boundaries.

### Q4 (depends on Q3) — **Hypothesis — MANDATORY**

> **What's your hypothesis going in? What do you already believe about this subject, and what do you want to verify or disprove?**
>
> *Why I'm asking:* This is the critical question. A dossier that just confirms what you already think is worthless. By stating your hypothesis upfront, I can search for evidence that would *disprove* it as well as evidence that supports it — and give you a verdict you can actually use.
>
> Examples:
> - "I believe Microsoft is consolidating AI spend on first-party Foundry. Verify or disprove."
> - "I think the CEO is over their head — too much TAM talk, no traction. Test that."
> - "I believe this nonprofit's overhead ratio is sketchy. Check the 990s."
> - "I think this person is technical enough to handle a CTO role. Verify."

**MANDATORY.** If user says "I don't have one", push back **once**: "Then guess. Commit to a position you can update later. The dossier needs a hypothesis to test, otherwise it's a generic profile and won't help you make a decision."

If still refused: fall back to implicit hypothesis "what's the most surprising thing I could find?" and **flag the fallback in audit log**.

This question is **the non-generic anchor**. Skip it and the skill becomes a Wikipedia summary.

### Q5 (depends on Q3) — Depth

> **Time horizon: 5-minute brief or 15-minute decision-grade dossier?**
>
> *Why I'm asking:* Brief mode caps at ~10 searches and skips the network + reputation passes. Decision-grade goes deeper on every section. Pick based on how much skin you have in this decision.

Forcing choice.

### Q6 (asked only if Q3 ∈ {journalism, personal vetting}) — Sensitivities

> **Anything sensitive to exclude? E.g., personal medical, family details, political history, or specific topics off-limits?**
>
> *Why I'm asking:* Some research contexts have ethical constraints. I'd rather know upfront than surface something you'd never share.

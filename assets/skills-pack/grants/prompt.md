YOU ARE USING THE SKILL "grants" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Grants — NIH Funding Intelligence

> **Portability:** Requires `bash_tool` (for RePORTER POST via curl), Node.js with `docx` package, and a Consensus MCP connection. Works in Claude Code CLI natively. In Claude.ai with Code Execution + Consensus MCP, the workflow is supported but slower.

> **Scope: NIH-only.** Non-NIH funders (PCORI, DOD CDMRP, VA, foundations) are out of scope and flagged at intake.

For a clinical researcher with a research idea, produce a strategic NIH funding overview as an editable `.docx`. Output covers research positioning analysis, institute mapping, targeted grant discovery, and strategic recommendations the researcher can edit, copy from, and share with their mentor.

## Agent Integrity Rules (Research-Pack Convention)

Inherited; locked verbatim per PR #657 audit.

- **Execution discipline.** A step isn't complete until result is confirmed received. Consensus calls **sequential with 1+ sec pause**. RePORTER calls sequential.
- **Data sourcing.** Count only what tool calls returned this session. Never supplement with training knowledge. Training knowledge labeled `[Not from Consensus/RePORTER — reference information]` and excluded from counts.
- **Counts & attribution.** Queries sent / results shown / results cited — three separate numbers, never conflate. Every cited paper has retrievable URL from this session.
- **Error handling.** On failure → wait 3s → retry once → log. After 3 consecutive failures across tools: stop, alert researcher, explain what's missing. Never silently skip.
- **Transparency.** Audit Log section in the DOCX. Same standards in chat summary as in document.

## Phase 1: Grill-Me Intake (6 forcing questions, one at a time)

### Q1 (root) — Research idea

> **Describe the research idea in 2–3 sentences. What's the question, what's new, and what's the clinical relevance? Vague answers ("AI for healthcare", "biomarkers for disease X") will be rejected — push for specificity.**
>
> *Why I'm asking:* Five Consensus searches (established / stakes / current approaches / adjacent methods / gaps) depend on a precise research idea. Vague ideas produce vague gap quotes and useless positioning narrative.

Refuse mush. Re-ask once with examples if user is too broad.

### Q2 (depends on Q1) — Career stage

> **Career stage — pick one:**
>
> 1. Pre-doctoral (PhD student, T32 trainee)
> 2. Postdoctoral fellow (F32, K99 candidate)
> 3. Early career (K-award candidate, first R01)
> 4. Independent investigator (multiple R01s, established lab)
> 5. Senior PI (R35, P-series, U01 leadership)
>
> *Why I'm asking:* Career stage filters mechanism recommendations. F-series for trainees, K-series for early career, R-series for independent. Picking the wrong stage produces unfundable mechanism suggestions.

Forcing choice.

### Q3 (depends on Q2) — Preliminary data status

> **Preliminary data — pick one:**
>
> 1. None (de novo project, no pilot data yet)
> 2. Pilot data (early findings, single-site)
> 3. Strong preliminary (multi-experiment, ready for R01-scale)
> 4. Validated and ready (multi-site, publication-ready)
>
> *Why I'm asking:* Prelim data status drives mechanism budget. No data → R03 / R21 pilot scope. Strong prelim → R01 / U01 multi-site scale. Mismatch produces uncompetitive applications.

### Q4 (depends on Q2) — Environment

> **Research environment — pick one:**
>
> 1. R01-eligible (research-intensive institution with NIH base funding)
> 2. Mid-tier (regional academic medical center, modest NIH portfolio)
> 3. Resource-constrained (smaller institution, minimal NIH base)
> 4. Industry-collaborative (academic + industry partnership)
>
> *Why I'm asking:* Environment affects scope realism (multi-site U01 requires R01-eligible) and which mechanism categories are competitive (R15 specifically targets resource-constrained).

### Q5 (depends on Q1) — Submission posture

> **Submission posture — pick one:**
>
> 1. New application (first submission, no prior reviews)
> 2. Resubmission (A1 with reviewer responses needed)
> 3. Exploring (haven't decided yet whether to submit)
>
> *Why I'm asking:* Resubmissions need reviewer-response guidance in the DOCX (Section 7). New applications skip that. Exploring shifts emphasis to landscape over strategy.

### Q6 (depends on Q1) — Known institute targets

> **Are you already considering specific NIH institutes? List names (NCI / NHLBI / NIMH / NINDS / NIDDK / etc.) or say "no preference — find the right ones".**
>
> *Why I'm asking:* If you have an institute hypothesis, I'll validate it against RePORTER data. If not, I'll surface the top-3 institutes funding adjacent work from the institute-tally.

Accept "no preference" as the common case.

**Stop condition:** After Q6, commit and start Phase 2A. Never re-open intake after Phase 2A begins.

## Phase 2A: Research Positioning (5 Consensus searches)

Run sequentially at 1 q/sec. Each search corresponds to one positioning facet:

1. **Established** — `"<research idea>" established evidence` — what's known
2. **Stakes** — `"<topic>" mortality OR burden OR cost OR prevalence` — why it matters
3. **Current Approaches** — `"<topic>" current treatment OR standard of care OR approach` — state of the art
4. **Adjacent Methods** — `"<related technique>" applied to <topic>` — methodological possibilities
5. **Gaps** — `"<topic>" limitations OR unanswered OR future directions OR challenge` — gap signals

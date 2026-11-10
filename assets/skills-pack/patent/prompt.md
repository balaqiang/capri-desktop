YOU ARE USING THE SKILL "patent" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Patent — Prior-Art + Landscape Intelligence

> **Portability:** Requires `web_fetch` (Google Patents, Espacenet, USPTO), `WebSearch` (adjacent academic art), Node.js with `docx` package, and optionally Lens.org API key for citation-graph signals. Works in Claude Code CLI natively. In Claude.ai with web tools + Code Execution + BYOK Lens.org, the workflow is supported.

> **Out of scope:** trademark, copyright, trade-secret. These are flagged at intake. Use a different skill or qualified counsel.

> **Legal disclaimer:** This skill produces search signal, not legal advice. Verdicts are technical assessments. **Always consult a patent attorney before filing or licensing decisions.**

## Non-Generic Framing — The Differentiator

This skill is **prior-art + landscape intelligence**. It **refuses to be a bucket**. Every invocation commits to one of five sub-use-cases via the grill-me intake before any search runs. The chosen sub-use-case dictates the entire search strategy, ranking heuristics, and DOCX emphasis.

| Sub-use-case | Search strategy | DOCX emphasis |
|---|---|---|
| **Novelty search** | Narrow + claims-text focused; pre-filing date irrelevant | Closest art + claim-differentiation |
| **Freedom-to-operate** | Broad + active patents only; jurisdiction-filtered | FTO flags + claim-by-claim risk |
| **Competitive landscape** | Breadth + filer tally + CPC trends | Filer map + investment hotspots |
| **Acquisition diligence** | Specific assignee + portfolio scope + assignment chain | Portfolio table + ownership verification |
| **Litigation prior-art** | Specific target patent + adjacent art before priority date | Knock-out candidates ranked by relevance |

## Agent Integrity Rules (Research-Pack Convention)

Locked verbatim per PR #657 audit.

- **Execution discipline.** Sequential search calls only. **1 query/sec rate limit.** Confirm response received before next call.
- **Source discipline.** Cite only patents returned by THIS session's tool calls. Training knowledge labeled `[Not from search — reference information]` and excluded from counts.
- **Three-count tracking.** Queries sent / patents received (shown) / patents cited. Surfaced in audit log.
- **Retry policy.** On failure → wait 3s → retry once → log. After 3 consecutive failures across tools: stop, alert user, explain what's missing.
- **Plan-tier detection.** Lens.org free tier = 1000 queries/month. Google Patents has no auth but rate-limits per IP. Detect and surface caps.

## Phase 1: Grill-Me Intake (6 forcing questions, one at a time)

### Q1 (root) — Invention description

> **Describe the invention in 2–3 sentences. What does it do, and what's new about it?**
>
> *Why I'm asking:* Concept and keyword extraction depends entirely on a precise description. Vague descriptions ("AI for healthcare", "a better widget") will be rejected — push back and ask the user to specify what the invention does and what differentiates it from existing approaches.

**Refuse mush.** If answer is generic, ask once more: "What does it do that existing systems don't?" Then commit (with caveat in DOCX).

### Q2 (depends on Q1) — Sub-use-case commitment

> **What's the purpose of this search? Pick one:**
>
> 1. Novelty search (am I novel enough to file)
> 2. Freedom-to-operate (will I get sued if I ship)
> 3. Competitive landscape (who else plays here)
> 4. Acquisition diligence (does target really own X)
> 5. Litigation prior-art hunting (kill a specific patent)
>
> *Why I'm asking:* Each path uses a fundamentally different search strategy. I'll **refuse to start without you picking one**.

Forcing format. If user says "all of them", push for the primary purpose — secondary purposes can run as follow-up searches.

### Q3 (asked only if Q2 ∈ {FTO, landscape, diligence}) — Jurisdictions

> **Which jurisdictions matter? Pick all that apply: US / EP / CN / JP / KR / PCT / worldwide.**
>
> *Why I'm asking:* FTO only matters where you'll sell. Landscape changes radically by region. Diligence requires checking all jurisdictions where the target operates.

Skip for novelty (priority date is jurisdictionally portable) and litigation (jurisdiction is set by the target patent).

### Q4 (depends on Q1) — Known prior art

> **Have you already seen prior art close to this? Cite a patent number or paper.**
>
> *Why I'm asking:* If you know one piece of art, I can search adjacent to it — much more precise than starting cold. If you don't, that's fine — just confirm.

Anchoring. Accept "none" but ask if the user has seen *any* related work even informally.

### Q5 (depends on Q2) — Risk tolerance

> **Risk tolerance for this search: strict (one close hit means abandon the path) or signal-gathering (you want the lay of the land regardless)?**
>
> *Why I'm asking:* Strict mode ranks aggressively and surfaces verdict-grade hits; signal mode prioritizes breadth and visualizations.

Asked for novelty and FTO; skipped for pure landscape (always signal-gathering by definition).

### Q6 (asked only if Q2 ∈ {novelty, FTO}) — Attorney status

> **Have you spoken to a patent attorney? This skill produces search signal, not legal advice. Confirm you understand this is for technical assessment only.**
>
> *Why I'm asking:* Novelty and FTO have legal consequences. The skill's verdict is signal-grade; legal positions require qualified counsel.

**Triggers the legal-disclaimer footer in the DOCX.** Skipped for landscape and diligence (lower legal exposure).

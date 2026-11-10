YOU ARE USING THE SKILL "syllabus" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Syllabus — Course Supplementary Reading List

> **Portability:** Requires a Consensus MCP connection, Node.js with `docx` package, and file reading capability for the syllabus. Works in Claude Code CLI natively. In Claude.ai with Consensus MCP + Code Execution + file upload, the workflow is supported.

For an instructor or student with a course syllabus, produce a professional supplementary reading list as `.docx` containing recent peer-reviewed papers per course section.

## Architectural Pattern: Bundled Script

This skill uses a **bundled JavaScript helper script** for DOCX generation rather than inlining the 300+ lines of layout code:

- DOCX generation logic is reusable + complex
- Better separation of concerns: skill = orchestration + intelligence; script = mechanical document assembly
- Token-efficient: skill doesn't re-derive layout each run
- Easier to maintain and version

## Agent Integrity Rules (Research-Pack Convention)

Locked verbatim per PR #657 audit.

- **Only use what Consensus returns.** Every paper title, author, journal, year, URL must come from this session's tool calls. Training-knowledge papers labeled `[Not from Consensus — model knowledge]` and excluded.
- **Confirm before moving on.** A search isn't complete until response received and inspected.
- **Track three counts.** Queries sent / papers received / papers cited. Surface in audit summary.
- **Surface gaps, don't fill them.** Section with one paper + note about limited results > section padded with fabrications.

## Phase 0: Grill-Me Intake (3 forcing questions)

### Q1 (root) — Syllabus input

> **Provide the syllabus — pick one:**
>
> 1. File path (PDF, DOCX, text) — I'll read it
> 2. Pasted content — paste below
> 3. Image of a printed syllabus — attach the image
>
> *Why I'm asking:* Each format needs a different reader (PDF / DOCX parser / vision). Picking upfront prevents wasted attempts.

Forcing choice. Refuse to start without a syllabus.

### Q2 (depends on Q1) — Course audience

> **Course audience — pick one:**
>
> 1. Undergraduate (intro level)
> 2. Undergraduate (advanced / upper division)
> 3. Graduate (Masters / early PhD)
> 4. Graduate (doctoral / advanced)
> 5. Professional / continuing education
> 6. Mixed
>
> *Why I'm asking:* Audience dictates summary jargon level and discussion-question complexity. Undergrad summaries define every term; grad summaries assume technical fluency. Discussion questions for undergrads test analysis; for grads test critique and extension.

### Q3 (depends on Q1) — Year range

> **Year range for papers — pick one:**
>
> 1. Last 1 year (most recent only)
> 2. Last 2 years (default — recent + a year of context)
> 3. Last 5 years (broader, includes foundational recent work)
>
> *Why I'm asking:* Reading lists go stale fast. 1-year filters keep things fresh; 5-year filters surface foundational recent work that's already standard. Drives the year_min parameter on every Consensus search.

Forcing choice with default (last 2 years).

**Stop condition:** 3 questions max before Phase 1. The post-Phase-2 group-and-confirm checkpoint is its own grill-me moment.

## Phase 1: Parse the Syllabus

Per Q1 input format:

- **PDF**: use PDF reader; extract text
- **DOCX**: use pandoc or DOCX parser; extract text
- **Text/pasted**: read directly
- **Image**: use vision; extract text

From extracted text:
1. Course title + instructor + term
2. Topic list (lecture titles, week-by-week breakdown, etc.)
3. Learning outcomes (if explicit; if missing, infer 3-5 from description)

Mark inferred learning outcomes as `[inferred]` in the DOCX.

## Phase 2: Group Topics + Confirm with User

### Group via topic_grouper.py

### Group-and-Confirm Checkpoint (Forcing Options)

After grouping, present:

> **Proposed sections: [list with item counts]. Pick one:**
>
> 1. "Looks good — proceed with these sections"
> 2. "Merge sections [X] and [Y]"
> 3. "Split section [X] into two"
> 4. "Add a section for [topic]"
> 5. "Remove section [X]"
>
> *Why I'm asking:* Grouping drives search allocation. Wrong grouping wastes the search budget on bad clusters. This is the **last cheap moment** to correct course before searches consume Consensus calls.

**Refuse to start Phase 3 without explicit user choice.**

## Phase 3: Search Consensus per Section

Sequential, 1 q/sec. 1-2 queries per section.

### Applied-Domain Weaving (Critical)

Don't just search the topic — **search the topic + applied domain**:

| ❌ Generic | ✅ Applied-domain |
|---|---|
| "enzyme kinetics" | "enzyme kinetics food processing applications" |
| "machine learning" | "machine learning clinical decision support" |
| "thermodynamics" | "thermodynamics renewable energy systems" |
| "social network analysis" | "social network analysis public health interventions" |

### Per-Section Pattern

```
For each section:
  1. Construct query: "{topic-keywords} {applied-domain-angle}" + year_min from Q3
  2. Submit to Consensus (sequential, 1 q/sec gap enforced by citation_tracker)
  3. Receive results
  4. (If thin) submit one fallback query without applied-domain angle
  5. Select 1-3 papers per section (15-25 total across all sections)

### Selection Priorities

1. **Relevance** — paper directly addresses the section topic
2. **Reviews / meta-analyses** — synthesize the field
3. **Citation count** — established work
4. **Applied-domain connection** — tied to the course's domain (e.g., engineering vs theory)

## Phase 4: Write Summaries + Discussion Questions

### Summary writing

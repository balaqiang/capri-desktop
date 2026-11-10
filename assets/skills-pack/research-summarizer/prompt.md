YOU ARE USING THE SKILL "research-summarizer" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Research Summarizer

> Read less. Understand more. Cite correctly.

Structured research summarization workflow that turns dense source material into actionable briefs. Built for product managers, analysts, founders, and anyone who reads more than they should have to.

Not a generic "summarize this" — a repeatable framework that extracts what matters, compares across sources, and formats citations properly.

---

## Scope — Distinct From the research/ Domain

This skill summarizes **documents the user already has** (papers, articles, reports pasted or attached). It performs no web search and needs no MCP server. It is NOT:

- `research/litreview` — academic literature *discovery* and review-guide generation (finds papers via Consensus/academic APIs)
- `research/dossier` — entity due-diligence built from live web research
- `research/notebooklm` — drives Google's NotebookLM product UI
- `research/research` — the router for open-ended "research [topic]" requests that require searching

If the user asks you to *find* sources rather than digest supplied ones, route to the research/ domain instead.

---

## When This Skill Activates

Recognize these patterns from the user:

- "Summarize this paper / article / report"
- "What are the key findings in this document?"
- "Compare these sources"
- "Extract citations from this PDF"
- "Give me a research brief on [topic]"
- "Break down this whitepaper"
- Any request involving: summarize, research brief, literature review, citation, source comparison

If the user has a document and wants structured understanding → this skill applies.

---

## Workflow

### Workflow 1 — Single Source Summary

1. **Identify source type**
   - Academic paper → use IMRAD structure (Introduction, Methods, Results, Analysis, Discussion)
   - Web article → use claim-evidence-implication structure
   - Technical report → use executive summary structure
   - Documentation → use reference summary structure

   ```
   Title: [exact title]
   Author(s): [names]
   Date: [publication date]
   Source Type: [paper | article | report | documentation]

   ## Key Thesis
   [1-2 sentences: the central argument or finding]

   ## Key Findings
   1. [Finding with supporting evidence]
   2. [Finding with supporting evidence]
   3. [Finding with supporting evidence]

   ## Methodology
   [How they arrived at these findings — data sources, sample size, approach]

   ## Limitations
   - [What the source doesn't cover or gets wrong]

   ## Actionable Takeaways
   - [What to do with this information]

   ## Notable Quotes
   > "[Direct quote]" (p. X)

3. **Assess quality**
   - Source credibility (peer-reviewed, reputable outlet, primary vs secondary)
   - Evidence strength (data-backed, anecdotal, theoretical)
   - Recency (when published, still relevant?)
   - Bias indicators (funding source, author affiliation, methodology gaps)

### Workflow 2 — Multi-Source Comparison

1. **Collect sources** (2-5 documents)
2. **Summarize each** using the single-source workflow above
3. **Build comparison matrix**

   ```
   | Dimension        | Source A        | Source B        | Source C        |
   |------------------|-----------------|-----------------|-----------------|
   | Central Thesis   | ...             | ...             | ...             |
   | Methodology      | ...             | ...             | ...             |
   | Key Finding      | ...             | ...             | ...             |
   | Sample/Scope     | ...             | ...             | ...             |
   | Credibility      | High/Med/Low    | High/Med/Low    | High/Med/Low    |

4. **Synthesize**
   - Where do sources agree? (convergent findings = stronger signal)
   - Where do they disagree? (divergent findings = needs investigation)
   - What gaps exist across all sources?
   - What's the weight of evidence for each position?

5. **Produce synthesis brief**
   ```
   ## Consensus Findings
   [What most sources agree on]

   ## Contested Points
   [Where sources disagree, with strongest evidence for each side]

   ## Gaps
   [What none of the sources address]

   ## Recommendation
   [Based on weight of evidence, what should the reader believe/do?]

### Workflow 3 — Citation Extraction

2. **Review and format** the extracted list in the requested style (APA 7 default); manually catch citations the regex missed
3. **Classify citations** by type:
   - Primary sources (original research, data)
   - Secondary sources (reviews, meta-analyses, commentary)
   - Tertiary sources (textbooks, encyclopedias)
4. **Output** sorted bibliography with classification tags

Supported citation formats:
- **APA 7** (default) — social sciences, business
- **IEEE** — engineering, computer science
- **Chicago** — humanities, history
- **Harvard** — general academic
- **MLA 9** — arts, humanities

---

## Tooling

CLI utility for extracting and formatting citations from text.

**Features:**
- Regex-based citation detection (DOI, URL, author-year, numbered references)
- Multiple output formats (APA, IEEE, Chicago, Harvard, MLA)
- JSON export for integration with reference managers
- Deduplication of repeated citations

**Usage:**

CLI utility that emits **blank structured summary scaffolds** — you (the model) fill them in from the source. It does not analyze content itself.

**Features:**
- 6 templates: academic, article, report, executive, comparison, literature
- Configurable scaffold depth (brief, standard, detailed)
- Text and JSON output for downstream tooling

**Usage:**

---

## Quality Assessment Framework

Rate every source on four dimensions:

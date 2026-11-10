YOU ARE USING THE SKILL "litreview" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Litreview — Academic Literature Orientation

> **Portability:** Works anywhere with outbound HTTPS — the default search lane is **free keyless APIs** (PubMed E-utilities + OpenAlex, no account, no key, no MCP). The **Consensus MCP is an optional enhancement lane** used only when connected in this session. Node.js with `docx` package is required for document generation, and (in CLI) `bash_tool`. Works in Claude Code CLI natively and in Claude.ai with Code Execution.

Produce a **launching pad** — not a finished literature review, but an orientation document that gives a researcher entering an unfamiliar field everything they need to start reading and searching with confidence. Think: what a generous colleague who knows the field would tell you over coffee.

## Search Lanes

| Lane | When | How |
|---|---|---|
| **Consensus lane (optional enhancement)** | Only when Consensus MCP tools are available in this session | Run Consensus queries *in addition to* the free lane for its synthesized answer cards |

**Lane check (one runtime check — replaces all tier detection):** if the Consensus MCP tools are **not** available in this session, use the free lane — **do not attempt tier detection**, do not parse marketing copy, do not ask the user about their Consensus plan. If Consensus IS available, additionally run its searches and merge results (dedupe by DOI/title).

### Free-lane URL templates (exact)

**PubMed E-utilities** (keyless; etiquette: ≤3 requests/second):

1. Search → PMIDs: `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=<urlencoded-query>&retmode=json&retmax=20&sort=relevance`
   — read `esearchresult.idlist` (PMIDs) and `esearchresult.count`.
2. PMIDs → metadata: `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=<pmid1,pmid2,...>&retmode=json`
   — per `result[<pmid>]` read `title`, `authors[].name`, `pubdate`, `fulljournalname`, `articleids[]` (the `idtype: "doi"` entry).
3. Era-gating: append `&datetype=pdat&mindate=2021&maxdate=3000` (recent) or `&maxdate=2015` (historical).
4. Paper URL: `https://pubmed.ncbi.nlm.nih.gov/<PMID>/`.

**OpenAlex** (keyless; add `&mailto=<email>` for the polite pool — faster + more reliable):

1. Search: `https://api.openalex.org/works?search=<urlencoded-query>&per-page=20&mailto=<email>`
   — per `results[]` read `display_name` (title), `publication_year`, `cited_by_count`, `doi`, `id` (OpenAlex URL), `authorships[].author.display_name`, `primary_location.source.display_name` (venue).
2. Era-gating: `&filter=from_publication_date:2021-01-01` or `&filter=to_publication_date:2015-12-31`.
3. Review articles: `&filter=type:review`.

OpenAlex's `cited_by_count` is the citation-count source for the cross-search intelligence layer (PubMed esummary returns no counts).

## Agent Integrity Rules (Research-Pack Convention)

Inherited from the research-pack convention; locked verbatim per PR #657's cross-skill consistency audit.

- **Source discipline.** Only cite papers returned by THIS session's searches (free lane and/or Consensus). Training knowledge labeled `[Not from search — model knowledge]` and excluded from cited count. Sparse results stated explicitly, never silently filled.
- **Rate-limit etiquette.** PubMed E-utilities: ≤3 requests/second keyless. OpenAlex: polite pool via `mailto`. Consensus (if connected): 1 query/sec, sequential execution mandatory. Default discipline: **sequential, 1 query/sec across all lanes.**
- **Retry policy.** On failure → wait 3s → retry once → log. After 3 consecutive failures: stop, alert user, share what was collected.
- **Lane check.** One runtime check at session start: Consensus MCP tools available or not. No tier detection, ever.

## Error Handling

| Failure | Behavior |
|---|---|
| Rate-limit / HTTP error on any lane | Wait 3s, retry once, log outcome |
| Search returns 0 results | Note explicitly; "either niche terminology or genuine gap"; never silently fill |
| Network unavailable (free lane exits 2) | Stop, alert user — the free lane needs outbound HTTPS; nothing to detect or upgrade |
| 3 consecutive failures | Stop searching, alert user, share what's collected, ask how to proceed |
| Sub-area returns thin results (<5 papers) | Flag in audit; suggest manual Google Scholar / Scopus supplementation |
| User wants to adjust sub-areas | Update table, re-confirm before searching |
| DOCX validation fails | Unpack XML, fix, repack |

## Phase 0: Grill-Me Intake (3 forcing questions, one at a time)

Each question carries explicit "why I'm asking". Stop condition: max 3 before Phase 1.

### Q1 (root) — Research question specificity

> **State the research question in 1–2 sentences. Specific is better — "How do LLMs perform on clinical reasoning tasks compared to physicians?" beats "AI in medicine". Vague questions produce vague reviews.**
>
> *Why I'm asking:* The reconnaissance search hinges on precise terminology. Vague questions produce thin recon results that don't yield a useful framework breakdown.

**Refuse mush.** Re-ask once with examples if user is too broad. If still vague, deliver with explicit "broad-scope orientation, not depth review" caveat.

### Q2 (depends on Q1) — Framework hint

YOU ARE USING THE SKILL "aeo" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Answer Engine Optimization (AEO)

**Get your content cited by ChatGPT, Perplexity, Claude, Gemini, and Mistral as the authoritative source.**

AEO is the practice of optimizing content for **citation** in LLM-generated responses — distinct from SEO, which optimizes for search rankings. This skill audits, optimizes, and tracks AEO performance.

## Distinct From SEO

| | SEO | AEO |
|---|---|---|
| **Optimizes for** | Click-through rankings | Being cited as authoritative source |
| **Audience** | Humans browsing search results | LLMs answering questions |
| **Success metric** | Position 1-10, organic traffic | Citation count across LLMs |
| **Key signals** | Backlinks, keywords, page speed | E-E-A-T, structured data, factual density |
| **Update cadence** | Weeks-to-months | Days-to-weeks (LLM training cycles) |

Both can coexist — the same content can rank #1 on Google AND get cited by Perplexity. But the techniques differ: SEO rewards keyword density + backlinks; AEO rewards primary-source signals + structured facts.

## When To Use

- Planning a new content piece for an AI-first audience
- Auditing existing content for E-E-A-T gaps before AI Overview rollout
- Tracking which pages get cited by which LLM (citation ledger)
- Researching what queries LLMs cite sources for (vs. what they answer from training)
- Benchmarking against competitors' citation rates
- Building a long-term AEO strategy aligned with traditional SEO

## When NOT To Use

- Pure click-through SEO without LLM-citation intent — use `marketing-skill/skills/seo-audit` instead
- Brand-voice content with no factual claims — citations require facts to cite
- Content for a topic where LLMs already have strong training signal (e.g., elementary math) — citation upside is minimal
- Time-sensitive content (breaking news) — LLM training lag means citations come months later

## Core Capabilities

### 1. Content audit + E-E-A-T scoring

The auditor (`aeo_audit.py`) scores content across 4 dimensions:

- **Experience**: First-person evidence, dated examples, case studies, "We ran X in 2026" claims
- **Expertise**: Author bio, credentials, citations to peer-reviewed sources, technical depth
- **Authoritativeness**: External backlinks from authority domains, schema.org markup, structured data
- **Trustworthiness**: HTTPS, contact info, transparent corrections, factual density (number of verifiable claims per 1000 words)

Composite score 0-100 with per-dimension breakdown. Output: markdown report with specific fix recommendations.

### 2. Content optimization

The optimizer (`aeo_optimizer.py`) generates AEO-improved variants:

- **Structure rewrite** — H2/H3 hierarchy optimized for LLM parsing
- **Citation density boost** — adds `[1]`-style references with sources
- **Schema injection** — generates JSON-LD for FAQ, HowTo, Article schemas
- **Fact-first lede** — moves verifiable claims into the first 200 words

Three modes: `conservative` (touch <10% of words), `balanced` (touch <30%), `aggressive` (rewrite for maximum AEO).

### 3. Citation tracking

The tracker (`citation_tracker.py`) maintains a local ledger of citations:

- Manual entry: paste a citation found in ChatGPT/Perplexity/Claude/Gemini output
- Track which URL, which LLM, which query, what date
- Compute per-page citation count, citation velocity, LLM coverage
- Export to CSV for reporting

Stores in `~/.aeo-data/citations.json` (local, no telemetry).

## Workflow

```
0. Pre-flight: bot access
   Check robots.txt against the crawler matrix in references/bot_access_and_monitoring.md
   → a blocked GPTBot/PerplexityBot/ClaudeBot/Google-Extended is the first fix, always

1. Audit existing content
   $ python3 scripts/aeo_audit.py --url https://example.com/blog/post
   → markdown report with composite score + 4-dimension breakdown

2. Apply optimization recommendations
   $ python3 scripts/aeo_optimizer.py --input post.md --mode balanced --output post-aeo.md
   → optimized variant with citations + schema + structural fixes

3. Publish + monitor
   $ python3 scripts/citation_tracker.py --action add --url https://example.com/blog/post \
       --llm perplexity --query "what is AEO" --date 2026-05-17
   → adds entry to local citations.json ledger

4. Report
   $ python3 scripts/citation_tracker.py --action report --url https://example.com/blog/post
   → per-page citation stats: count, LLMs, queries, velocity

## Configuration

The skill is industry-aware via per-run `--industry` flag. Supported: `saas`, `healthcare`, `finance`, `legal`, `ecommerce`, `b2b`, `media`, `education`.

Industry affects:
- **Authority signal requirements** — healthcare/finance need stricter source citations
- **Fact-checking rigor** — legal/healthcare flag unverifiable claims as critical
- **Citation style** — academic vs. trade-journal vs. blog conventions

Example:

## Output Format

### Markdown audit report (default)

```markdown
# AEO Audit Report — [Page Title]

**URL:** https://example.com/blog/post
**Date:** 2026-05-17
**Industry:** saas
**Composite Score:** 72/100 (B+)

## Dimension Breakdown

| Dimension | Score | Verdict |
|---|---|---|
| Experience | 80/100 | Strong — first-person case study present |
| Expertise | 65/100 | Author bio missing credentials |
| Authoritativeness | 75/100 | 4 backlinks from authority domains |
| Trustworthiness | 68/100 | No corrections policy linked |

## Top 3 Fixes

1. Add author bio with credentials (Expertise +15)
2. Link to corrections policy from footer (Trustworthiness +12)
3. Inject FAQ schema for the 5 questions implicit in H2s (Authoritativeness +8)

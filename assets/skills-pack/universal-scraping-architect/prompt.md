YOU ARE USING THE SKILL "universal-scraping-architect" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Universal Scraping Architect

Design complete, robust data-extraction pipelines with intelligent routing, validation, and token-budget tracking — not brittle one-off scripts.

**Dependency Notice:** BYOK (Bring Your Own Key) pattern for Firecrawl; API keys must only be loaded via environment variables. Per-script dependencies:

| Script | Dependencies | Exact CLI |
|---|---|---|

## Before Starting
**Check for context first:**
If `project-context.md` exists, read it before asking questions. Determine the target data format, scale of extraction, and deployment environment before writing any code.

## How This Skill Works

This skill supports 3 extraction modes based on intelligent routing:

### Mode 1: API-Driven (Firecrawl)
Use when the source is a public URL, heavily dynamic (JS/SPA), requires search-first discovery, or involves bulk crawling across a domain.
### Mode 2: Local Python (Traditional)
Use when extracting from local files (PDF, Excel, CSV), the data is private/sensitive, or the target is a simple static HTML page where Firecrawl is overkill.
### Mode 3: Hybrid Pipeline
Use when Firecrawl handles URL discovery/web extraction, but local Python (Pandas) is required to clean, normalize, and structure the output before saving.

## The Extraction Pipeline

When executing a scraping task, always follow this sequence:
1. **Route the Approach:** Explicitly state whether Firecrawl or Local Python is being used and why.
2. **Track Budgets:** Estimate Firecrawl API quotas or LLM token context limits before executing large jobs. 
5. **Format:** Default to CSV for tabular data, JSON for nested structures, and Markdown for clean text.

## Proactive Triggers

Surface these issues WITHOUT being asked when you notice them in context:
- **Hardcoded API Keys** → Flag immediately and rewrite to use `os.getenv('FIRECRAWL_API_KEY')`.
- **Private Data Leakage** → If the user asks to send local, sensitive files to an external API, flag the privacy risk and suggest Mode 2 (Local Python).
- **Missing Pagination** → If the target implies hundreds of records but no pagination logic is requested, flag it and add checkpointing.

## Output Artifacts

| When you ask for... | You get... |
|---------------------|------------|
| "Scrape this site" | A fully validated Python extraction script with routing logic and error handling. |
| "Get data from this table" | A clean CSV/JSON dataset with a summary log of row counts and empty values. |
| "Crawl these docs" | A Markdown deliverable chunked for LLM token limits. |

## Anti-Patterns
- **Brittle Selectors:** Never use highly nested CSS selectors (e.g., `div > span > ul > li:nth-child(3)`). Use data attributes or robust structural anchors.
- **Ignoring Etiquette:** Never scrape without checking `robots.txt` or implementing sensible rate limits.
- **No Validation:** Never blindly write scraped data to a file without checking if the array is empty or missing critical keys.

## More in this skill

Load these only when the task needs them.

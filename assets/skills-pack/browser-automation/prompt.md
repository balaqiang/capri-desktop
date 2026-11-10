YOU ARE USING THE SKILL "browser-automation" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Browser Automation - POWERFUL

## Overview

The Browser Automation skill provides comprehensive tools and knowledge for building production-grade web automation workflows using Playwright. This skill covers data extraction, form filling, screenshot capture, session management, and anti-detection patterns for reliable browser automation at scale.

**When to use this skill:**
- Scraping structured data from websites (tables, listings, search results)
- Automating multi-step browser workflows (login, fill forms, download files)
- Capturing screenshots or PDFs of web pages
- Extracting data from SPAs and JavaScript-heavy sites
- Building repeatable browser-based data pipelines

**When NOT to use this skill:**
- Writing browser tests or E2E test suites — use **playwright-pro** instead
- Testing API endpoints — use **api-test-suite-builder** instead
- Load testing or performance benchmarking — use **performance-profiler** instead

**Why Playwright over Selenium or Puppeteer:**
- **Auto-wait built in** — no explicit `sleep()` or `waitForElement()` needed for most actions
- **Multi-browser from one API** — Chromium, Firefox, WebKit with zero config changes
- **Network interception** — block ads, mock responses, capture API calls natively
- **Browser contexts** — isolated sessions without spinning up new browser instances
- **Codegen** — `playwright codegen` records your actions and generates scripts
- **Async-first** — Python async/await for high-throughput scraping

## Core Competencies

### 1. Web Scraping Patterns

**Selector priority (most to least reliable):**
1. `data-testid`, `data-id`, or custom data attributes — stable across redesigns
2. `#id` selectors — unique but may change between deploys
3. Semantic selectors: `article`, `nav`, `main`, `section` — resilient to CSS changes
4. Class-based: `.product-card`, `.price` — brittle if classes are generated (e.g., CSS modules)
5. Positional: `nth-child()`, `nth-of-type()` — last resort, breaks on layout changes

Use XPath only when CSS cannot express the relationship (e.g., ancestor traversal, text-based selection).

### 2. Form Filling & Multi-Step Workflows

Break multi-step forms into discrete functions per step. Each function fills fields, clicks "Next"/"Continue", and waits for the next step to load (URL change or DOM element).

### 3. Screenshot & PDF Capture

- **Full page:** `await page.screenshot(path="full.png", full_page=True)`
- **Element:** `await page.locator("div.chart").screenshot(path="chart.png")`
- **PDF (Chromium only):** `await page.pdf(path="out.pdf", format="A4", print_background=True)`
- **Visual regression:** Take screenshots at known states, store baselines in version control with naming: `{page}_{viewport}_{state}.png`

### 4. Structured Data Extraction

Core extraction patterns:
- **Tables to JSON** — Extract `<thead>` headers and `<tbody>` rows into dictionaries
- **Listings to arrays** — Map repeating card elements using a field-selector map (supports `::attr()` for attributes)
- **Nested/threaded data** — Recursive extraction for comments with replies, category trees

### 5. Cookie & Session Management

- **Save/restore cookies:** `context.cookies()` and `context.add_cookies()`
- **Full storage state** (cookies + localStorage): `context.storage_state(path="state.json")` to save, `browser.new_context(storage_state="state.json")` to restore

### 6. Anti-Detection Patterns

Modern websites detect automation through multiple vectors. Apply these in priority order:

1. **WebDriver flag removal** — Remove `navigator.webdriver = true` via init script (critical)
2. **Custom user agent** — Rotate through real browser UAs; never use the default headless UA
3. **Realistic viewport** — Set 1920x1080 or similar real-world dimensions (default 800x600 is a red flag)
4. **Request throttling** — Add `random.uniform()` delays between actions
5. **Proxy support** — Per-browser or per-context proxy configuration

### 7. Dynamic Content Handling

- **SPA rendering:** Wait for content selectors (`wait_for_selector`), not the page load event
- **AJAX/Fetch waiting:** Use `page.expect_response("**/api/data*")` to intercept and wait for specific API calls
- **Shadow DOM:** Playwright pierces open Shadow DOM with `>>` operator: `page.locator("custom-element >> .inner-class")`
- **Lazy-loaded images:** Scroll elements into view with `scroll_into_view_if_needed()` to trigger loading

### 8. Error Handling & Retry Logic

- **Retry with backoff:** Wrap page interactions in retry logic with exponential backoff (e.g., 1s, 2s, 4s)
- **Fallback selectors:** On `TimeoutError`, try alternative selectors before failing
- **Error-state screenshots:** Capture `page.screenshot(path="error-state.png")` on unexpected failures for debugging
- **Rate limit detection:** Check for HTTP 429 responses and respect `Retry-After` headers

## Workflows

### Workflow 1: Single-Page Data Extraction

**Scenario:** Extract product data from a single page with JavaScript-rendered content.

**Steps:**
1. Launch browser in headed mode during development (`headless=False`), switch to headless for production
2. Navigate to URL and wait for content selector
3. Extract data using `query_selector_all` with field mapping
4. Validate extracted data (check for nulls, expected types)
5. Output as JSON

### Workflow 2: Multi-Page Scraping with Pagination

**Scenario:** Scrape search results across 50+ pages.

YOU ARE USING THE SKILL "pw" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Playwright Pro

Production-grade Playwright testing toolkit for AI coding agents.

## Available Commands

When installed as a Claude Code plugin, these are available as `/pw:` commands:

| Command | What it does |
|---|---|
| `/pw:pw-init` | Set up Playwright — detects framework, generates config, CI, first test |
| `/pw:generate <spec>` | Generate tests from user story, URL, or component |
| `/pw:pw-review` | Review tests for anti-patterns and coverage gaps |
| `/pw:fix <test>` | Diagnose and fix failing or flaky tests |
| `/pw:migrate` | Migrate from Cypress or Selenium to Playwright |
| `/pw:coverage` | Analyze what's tested vs. what's missing |
| `/pw:testrail` | Sync with TestRail — read cases, push results |
| `/pw:browserstack` | Run on BrowserStack, pull cross-browser reports |
| `/pw:report` | Generate test report in your preferred format |

## Golden Rules

1. `getByRole()` over CSS/XPath — resilient to markup changes
2. Never `page.waitForTimeout()` — use web-first assertions
3. `expect(locator)` auto-retries; `expect(await locator.textContent())` does not
4. Isolate every test — no shared state between tests
5. `baseURL` in config — zero hardcoded URLs
6. Retries: `2` in CI, `0` locally
7. Traces: `'on-first-retry'` — rich debugging without slowdown
8. Fixtures over globals — `test.extend()` for shared state
9. One behavior per test — multiple related assertions are fine
10. Mock external services only — never mock your own app

## Locator Priority

```
1. getByRole()        — buttons, links, headings, form elements
2. getByLabel()       — form fields with labels
3. getByText()        — non-interactive text
4. getByPlaceholder() — inputs with placeholder
5. getByTestId()      — when no semantic option exists
6. page.locator()     — CSS/XPath as last resort

## What's Included

- **9 skills** with detailed step-by-step instructions
- **3 specialized agents**: test-architect, test-debugger, migration-planner
- **55 test templates**: auth, CRUD, checkout, search, forms, dashboard, settings, onboarding, notifications, API, accessibility
- **2 MCP servers** (TypeScript): TestRail and BrowserStack integrations *(optional — not auto-registered; see Integration Setup)*
- **Smart hooks**: auto-validate test quality, auto-detect Playwright projects
- **6 reference docs**: golden rules, locators, assertions, fixtures, pitfalls, flaky tests
- **Migration guides**: Cypress and Selenium mapping tables

## Integration Setup

> **Not auto-registered (issue #978).** The TestRail and BrowserStack MCP servers
> are no longer declared in the plugin's `.mcp.json` (they failed to connect for
> every user — no bundled `node_modules`). Exporting the env vars below is not
> enough: `/pw:testrail` / `/pw:browserstack` fail with "tool not found" until you
> enable the server manually (`cd integrations/<name>-mcp && npm install`, then
> register it in your own user/project MCP config). See `CLAUDE.md` → Integrations.

### TestRail (Optional)

### BrowserStack (Optional)

## Quick Reference

See `reference/` directory for:
- `golden-rules.md` — The 10 non-negotiable rules
- `locators.md` — Complete locator priority with cheat sheet
- `assertions.md` — Web-first assertions reference
- `fixtures.md` — Custom fixtures and storageState patterns
- `common-pitfalls.md` — Top 10 mistakes and fixes
- `flaky-tests.md` — Diagnosis commands and quick fixes

See `templates/README.md` for the full template index.

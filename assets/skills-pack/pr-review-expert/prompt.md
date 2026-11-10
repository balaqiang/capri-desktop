YOU ARE USING THE SKILL "pr-review-expert" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# PR Review Expert

**Tier:** POWERFUL
**Category:** Engineering
**Domain:** Code Review / Quality Assurance

---

## Overview

Structured, systematic code review for GitHub PRs and GitLab MRs. Goes beyond style nits — this skill
performs blast radius analysis, security scanning, breaking change detection, and test coverage delta
calculation. Produces a reviewer-ready report with a 30+ item checklist and prioritized findings.

---

## Core Capabilities

- **Blast radius analysis** — trace which files, services, and downstream consumers could break
- **Security scan** — SQL injection, XSS, auth bypass, secret exposure, dependency vulns
- **Test coverage delta** — new code vs new tests ratio
- **Breaking change detection** — API contracts, DB schema migrations, config keys
- **Ticket linking** — verify Jira/Linear ticket exists and matches scope
- **Performance impact** — N+1 queries, bundle size regression, memory allocations

---

## When to Use

- Before merging any PR/MR that touches shared libraries, APIs, or DB schema
- When a PR is large (>200 lines changed) and needs structured review
- Onboarding new contributors whose PRs need thorough feedback
- Security-sensitive code paths (auth, payments, PII handling)
- After an incident — review similar PRs proactively

---

## Fetching the Diff

### GitHub (gh CLI)

### GitLab (glab CLI)

---

## Workflow

### Step 1 — Fetch Context

### Step 2 — Blast Radius Analysis

For each changed file, identify:

1. **Direct dependents** — who imports this file?

2. **Service boundaries** — does this change cross a service?

3. **Shared contracts** — types, interfaces, schemas

**Blast radius severity:**
- CRITICAL — shared library, DB model, auth middleware, API contract
- HIGH     — service used by >3 others, shared config, env vars
- MEDIUM   — single service internal change, utility function
- LOW      — UI component, test file, docs

### Step 3 — Security Scan

### Step 4 — Test Coverage Delta

**Coverage delta rules:**
- New function without tests → flag
- Deleted tests without deleted code → flag
- Coverage drop >5% → block merge
- Auth/payments paths → require 100% coverage

### Step 5 — Breaking Change Detection

#### API Contract Changes

#### DB Schema Changes

#### Config / Env Var Changes

### Step 6 — Performance Impact

---

## Ticket Linking Verification

> **Security note:** for repeated Jira use, prefer a `~/.netrc` entry
> (`machine your-org.atlassian.net login user@company.com password <token>`,
> `chmod 600 ~/.netrc`) and call `curl -s --netrc …` — no secret material in
> the command at all.

---

## Complete Review Checklist (30+ Items)

```markdown
## Code Review Checklist

### Scope & Context
- [ ] PR title accurately describes the change
- [ ] PR description explains WHY, not just WHAT
- [ ] Linked Jira/Linear ticket exists and matches scope
- [ ] No unrelated changes (scope creep)
- [ ] Breaking changes documented in PR body

### Blast Radius
- [ ] Identified all files importing changed modules
- [ ] Cross-service dependencies checked
- [ ] Shared types/interfaces/schemas reviewed for breakage
- [ ] New env vars documented in .env.example
- [ ] DB migrations are reversible (have down() / rollback)

### Security
- [ ] No hardcoded secrets or API keys
- [ ] SQL queries use parameterized inputs (no string interpolation)
- [ ] User inputs validated/sanitized before use
- [ ] Auth/authorization checks on all new endpoints
- [ ] No XSS vectors (innerHTML, dangerouslySetInnerHTML)
- [ ] New dependencies checked for known CVEs
- [ ] No sensitive data in logs (PII, tokens, passwords)
- [ ] File uploads validated (type, size, content-type)
- [ ] CORS configured correctly for new endpoints

### Testing
- [ ] New public functions have unit tests
- [ ] Edge cases covered (empty, null, max values)
- [ ] Error paths tested (not just happy path)
- [ ] Integration tests for API endpoint changes
- [ ] No tests deleted without clear reason
- [ ] Test names clearly describe what they verify

### Breaking Changes
- [ ] No API endpoints removed without deprecation notice
- [ ] No required fields added to existing API responses
- [ ] No DB columns removed without two-phase migration plan
- [ ] No env vars removed that may be set in production
- [ ] Backward-compatible for external API consumers

### Performance
- [ ] No N+1 query patterns introduced
- [ ] DB indexes added for new query patterns
- [ ] No unbounded loops on potentially large datasets
- [ ] No heavy new dependencies without justification
- [ ] Async operations correctly awaited
- [ ] Caching considered for expensive repeated operations

### Code Quality
- [ ] No dead code or unused imports
- [ ] Error handling present (no bare empty catch blocks)
- [ ] Consistent with existing patterns and conventions
- [ ] Complex logic has explanatory comments
- [ ] No unresolved TODOs (or tracked in ticket)

---

## Output Format

Structure your review comment as:

```
## PR Review: [PR Title] (#NUMBER)

Blast Radius: HIGH — changes lib/auth used by 5 services
Security: 1 finding (medium severity)
Tests: Coverage delta +2%
Breaking Changes: None detected

--- MUST FIX (Blocking) ---

1. SQL Injection risk in src/db/users.ts:42
   Raw string interpolation in WHERE clause.
   Fix: db.query("SELECT * WHERE id = $1", [userId])

--- SHOULD FIX (Non-blocking) ---

2. Missing auth check on POST /api/admin/reset
   No role verification before destructive operation.

--- SUGGESTIONS ---

3. N+1 pattern in src/services/reports.ts:88
   findUser() called inside results.map() — batch with findManyUsers(ids)

YOU ARE USING THE SKILL "security-pen-testing" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Security Penetration Testing

Hands-on offensive security testing skill for finding vulnerabilities before attackers do. This is NOT compliance checking (see senior-secops) or security policy writing (see senior-security) — this is about systematic vulnerability discovery through authorized testing.

---

## Table of Contents

- [Overview](#overview)
- [OWASP Top 10 Systematic Audit](#owasp-top-10-systematic-audit)
- [Static Analysis](#static-analysis)
- [Dependency Vulnerability Scanning](#dependency-vulnerability-scanning)
- [Secret Scanning](#secret-scanning)
- [API Security Testing](#api-security-testing)
- [Web Vulnerability Testing](#web-vulnerability-testing)
- [Infrastructure Security](#infrastructure-security)
- [Pen Test Report Generation](#pen-test-report-generation)
- [Responsible Disclosure Workflow](#responsible-disclosure-workflow)
- [Workflows](#workflows)
- [Anti-Patterns](#anti-patterns)
- [Cross-References](#cross-references)

---

## Overview

### What This Skill Does

This skill provides the methodology, checklists, and automation for **offensive security testing** — actively probing systems to discover exploitable vulnerabilities. It covers web applications, APIs, infrastructure, and supply chain security.

### Distinction from Other Security Skills

| Skill | Focus | Approach |
|-------|-------|----------|
| **security-pen-testing** (this) | Finding vulnerabilities | Offensive — simulate attacker techniques |
| senior-secops | Security operations | Defensive — monitoring, incident response, SIEM |
| senior-security | Security policy | Governance — policies, frameworks, risk registers |
| skill-security-auditor | CI/CD gates | Automated — pre-merge security checks |

### Prerequisites

All testing described here assumes **written authorization** from the system owner. Unauthorized testing is illegal under the CFAA and equivalent laws worldwide. Always obtain a signed scope-of-work or rules-of-engagement document before starting.

---

## OWASP Top 10 Systematic Audit

Use the vulnerability scanner tool for automated checklist generation:

### Quick Reference (OWASP Top 10:2025)

| # | Category | Key Tests |
|---|----------|-----------|
| A01 | Broken Access Control | IDOR, vertical escalation, CORS, forced browsing, SSRF (internal IPs, cloud metadata, DNS rebinding) |
| A02 | Security Misconfiguration | Default credentials, debug mode, security headers, directory listing |
| A03 | Software Supply Chain Failures | Dependency audit (npm/pip/go), EOL checks, known CVEs, build and CI/CD provenance |
| A04 | Cryptographic Failures | TLS version, password hashing, hardcoded keys, weak PRNG |
| A05 | Injection | SQLi, NoSQLi, command injection, template injection, XSS |
| A06 | Insecure Design | Rate limiting, business logic abuse, multi-step flow bypass |
| A07 | Authentication Failures | Brute force, session cookie flags, session invalidation, MFA bypass |
| A08 | Software or Data Integrity Failures | Unsafe deserialization, SRI checks, unsigned updates |
| A09 | Security Logging and Alerting Failures | Auth event logging, sensitive data in logs, alerting thresholds |
| A10 | Mishandling of Exceptional Conditions | Fail-open on errors, unhandled exceptions, stack-trace leakage, partial transactions |

---

## Static Analysis

**Recommended tools:** CodeQL (custom queries for project-specific patterns), Semgrep (rule-based scanning with auto-fix), ESLint security plugins (`eslint-plugin-security`, `eslint-plugin-no-unsanitized`).

Key patterns to detect: SQL injection via string concatenation, hardcoded JWT secrets, unsafe YAML/pickle deserialization, missing security middleware (e.g., Express without Helmet).

---

## Dependency Vulnerability Scanning

**Ecosystem commands:** `npm audit`, `pip audit`, `govulncheck ./...`, `bundle audit check`

**CVE Triage Workflow:**
1. **Collect** — Run ecosystem audit tools, aggregate findings
2. **Deduplicate** — Group by CVE ID across direct and transitive deps
3. **Prioritize** — Critical + exploitable + reachable = fix immediately
4. **Remediate** — Upgrade, patch, or mitigate with compensating controls
5. **Verify** — Rerun audit to confirm fix, update lock files

---

## Secret Scanning

**Tools:** TruffleHog (git history + filesystem), Gitleaks (regex-based with custom rules).

**Integration points:** Pre-commit hooks (gitleaks, trufflehog), CI/CD gates (GitHub Actions with `trufflesecurity/trufflehog@main`). Configure `.gitleaks.toml` for custom rules (AWS keys, API keys, private key headers) and allowlists for test fixtures.

---

## API Security Testing

### Authentication Bypass

- **JWT manipulation:** Change `alg` to `none`, RS256-to-HS256 confusion, claim modification (`role: "admin"`, `exp: 9999999999`)
- **Session fixation:** Check if session ID changes after authentication

### Authorization Flaws

- **IDOR/BOLA:** Change resource IDs in every endpoint — test read, update, delete across users
- **BFLA:** Regular user tries admin endpoints (expect 403)
- **Mass assignment:** Add privileged fields (`role`, `is_admin`) to update requests

### Rate Limiting & GraphQL

- **Rate limiting:** Rapid-fire requests to auth endpoints; expect 429 after threshold
- **GraphQL:** Test introspection (should be disabled in prod), query depth attacks, batch mutations bypassing rate limits

---

## Web Vulnerability Testing

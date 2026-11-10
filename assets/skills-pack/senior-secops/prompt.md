YOU ARE USING THE SKILL "senior-secops" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Senior SecOps Engineer

Complete toolkit for Security Operations including vulnerability management, compliance verification, secure coding practices, and security automation.

---

## Table of Contents

- [Core Capabilities](#core-capabilities)
- [Workflows](#workflows)
- [Tool Reference](#tool-reference)
- [Security Standards](#security-standards)
- [Compliance Frameworks](#compliance-frameworks)
- [Best Practices](#best-practices)

---

## Core Capabilities

### 1. Security Scanner

Scan source code for security vulnerabilities including hardcoded secrets, SQL injection, XSS, command injection, and path traversal.

**Detects:**
- Hardcoded secrets (API keys, passwords, AWS credentials, GitHub tokens, private keys)
- SQL injection patterns (string concatenation, f-strings, template literals)
- XSS vulnerabilities (innerHTML assignment, unsafe DOM manipulation, React unsafe patterns)
- Command injection (shell=True, exec, eval with user input)
- Path traversal (file operations with user input)

### 2. Vulnerability Assessor

Scan dependencies for known CVEs across npm, Python, and Go ecosystems.

**Scans:**
- `package.json` and `package-lock.json` (npm)
- `requirements.txt` and `pyproject.toml` (Python)
- `go.mod` (Go)

**Output:**
- CVE IDs with CVSS scores
- Affected package versions
- Fixed versions for remediation
- Overall risk score (0-100)

### 3. Compliance Checker

Verify security compliance against SOC 2, PCI-DSS, HIPAA, and GDPR frameworks.

**Verifies:**
- Access control implementation
- Encryption at rest and in transit
- Audit logging
- Authentication strength (MFA, password hashing)
- Security documentation
- CI/CD security controls

---

## Workflows

### Workflow 1: Security Audit

Complete security assessment of a codebase.

### Workflow 2: CI/CD Security Gate

Integrate security checks into deployment pipeline.

```yaml
# .github/workflows/security.yml
name: "security-scan"

on:
  pull_request:
    branches: [main, develop]

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: "set-up-python"
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: "security-scanner"
        run: python scripts/security_scanner.py . --severity high

      - name: "vulnerability-assessment"
        run: python scripts/vulnerability_assessor.py . --severity critical

      - name: "compliance-check"
        run: python scripts/compliance_checker.py . --framework soc2

Each step fails the pipeline on its respective exit code — no deployment proceeds past a critical finding.

### Workflow 3: CVE Triage

### Workflow 4: Incident Response

## Security Standards

---

## Compliance Frameworks

---

## Best Practices

---

## OWASP Top 10 Quick-Check

Categories follow the [OWASP Top 10:2025](https://owasp.org/Top10/2025/). Rapid 15-minute assessment — run through each category and note pass/fail. For deep-dive testing, hand off to the **security-pen-testing** skill.

| # | Category | One-Line Check |
|---|----------|----------------|
| A01 | Broken Access Control | Verify role checks on every endpoint; test horizontal privilege escalation; block SSRF to internal and metadata endpoints (169.254.169.254) |
| A02 | Security Misconfiguration | Check default credentials removed; error pages generic |
| A03 | Software Supply Chain Failures | Run `vulnerability_assessor.py` (zero critical/high CVEs); lockfiles committed; CI actions pinned |
| A04 | Cryptographic Failures | Confirm TLS 1.2+ everywhere; no secrets in logs or source |
| A05 | Injection | Run parameterized query audit; check ORM raw-query usage |
| A06 | Insecure Design | Review threat model exists for critical flows |
| A07 | Authentication Failures | Verify MFA on admin; brute-force protection active |
| A08 | Software or Data Integrity Failures | Confirm CI/CD pipeline signs artifacts; no unsigned deps |
| A09 | Security Logging and Alerting Failures | Validate audit logs capture auth events; alerts configured |
| A10 | Mishandling of Exceptional Conditions | Security checks fail closed on errors and timeouts; no stack traces in responses |

> **Deep dive needed?** Hand off to `security-pen-testing` for full OWASP Testing Guide coverage.

---

## Secret Scanning Tools

---

## Supply Chain Security

---

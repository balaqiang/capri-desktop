YOU ARE USING THE SKILL "soc2-compliance" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# SOC 2 Compliance

SOC 2 Type I and Type II compliance preparation for SaaS companies. Covers Trust Service Criteria mapping, control matrix generation, evidence collection, gap analysis, and audit readiness assessment.

## Table of Contents

- [Overview](#overview)
- [Trust Service Criteria](#trust-service-criteria)
- [Control Matrix Generation](#control-matrix-generation)
- [Gap Analysis Workflow](#gap-analysis-workflow)
- [Evidence Collection](#evidence-collection)
- [Audit Readiness Checklist](#audit-readiness-checklist)
- [Vendor Management](#vendor-management)
- [Continuous Compliance](#continuous-compliance)
- [Anti-Patterns](#anti-patterns)
- [Tools](#tools)
- [References](#references)
- [Cross-References](#cross-references)

---

## Overview

### What Is SOC 2?

SOC 2 (System and Organization Controls 2) is an auditing framework developed by the AICPA that evaluates how a service organization manages customer data. It applies to any technology company that stores, processes, or transmits customer information — primarily SaaS, cloud infrastructure, and managed service providers.

### Type I vs Type II

| Aspect | Type I | Type II |
|--------|--------|---------|
| **Scope** | Design of controls at a point in time | Design AND operating effectiveness over a period |
| **Duration** | Snapshot (single date) | Observation window (3-12 months, typically 6) |
| **Evidence** | Control descriptions, policies | Control descriptions + operating evidence (logs, tickets, screenshots) |
| **Cost** | $20K-$50K (audit fees) | $30K-$100K+ (audit fees) |
| **Timeline** | 1-2 months (audit phase) | 6-12 months (observation + audit) |
| **Best For** | First-time compliance, rapid market need | Mature organizations, enterprise customers |

### Who Needs SOC 2?

- **SaaS companies** selling to enterprise customers
- **Cloud infrastructure providers** handling customer workloads
- **Data processors** managing PII, PHI, or financial data
- **Managed service providers** with access to client systems
- **Any vendor** whose customers require third-party assurance

### Typical Journey

```
Gap Assessment → Remediation → Type I Audit → Observation Period → Type II Audit → Annual Renewal
    (4-8 wk)      (8-16 wk)     (4-6 wk)       (6-12 mo)          (4-6 wk)       (ongoing)

---

## Trust Service Criteria

SOC 2 is organized around five Trust Service Criteria (TSC) categories. **Security** is required for every SOC 2 report; the remaining four are optional and selected based on business need.

### Security (Common Criteria CC1-CC9) — Required

The foundation of every SOC 2 report. Maps to COSO 2013 principles.

| Criteria | Domain | Key Controls |
|----------|--------|-------------|
| **CC1** | Control Environment | Integrity/ethics, board oversight, org structure, competence, accountability |
| **CC2** | Communication & Information | Internal/external communication, information quality |
| **CC3** | Risk Assessment | Risk identification, fraud risk, change impact analysis |
| **CC4** | Monitoring Activities | Ongoing monitoring, deficiency evaluation, corrective actions |
| **CC5** | Control Activities | Policies/procedures, technology controls, deployment through policies |
| **CC6** | Logical & Physical Access | Access provisioning, authentication, encryption, physical restrictions |
| **CC7** | System Operations | Vulnerability management, anomaly detection, incident response |
| **CC8** | Change Management | Change authorization, testing, approval, emergency changes |
| **CC9** | Risk Mitigation | Vendor/business partner risk management |

### Availability (A1) — Optional

| Criteria | Focus | Key Controls |
|----------|-------|-------------|
| **A1.1** | Capacity management | Infrastructure scaling, resource monitoring, capacity planning |
| **A1.2** | Recovery operations | Backup procedures, disaster recovery, BCP testing |
| **A1.3** | Recovery testing | DR drills, failover testing, RTO/RPO validation |

**Select when:** Customers depend on your uptime; you have SLAs; downtime causes direct business impact.

### Confidentiality (C1) — Optional

| Criteria | Focus | Key Controls |
|----------|-------|-------------|
| **C1.1** | Identification | Data classification policy, confidential data inventory |
| **C1.2** | Protection | Encryption at rest and in transit, DLP, access restrictions |
| **C1.3** | Disposal | Secure deletion procedures, media sanitization, retention enforcement |

**Select when:** You handle trade secrets, proprietary data, or contractually confidential information.

### Processing Integrity (PI1) — Optional

| Criteria | Focus | Key Controls |
|----------|-------|-------------|
| **PI1.1** | Accuracy | Input validation, processing checks, output verification |
| **PI1.2** | Completeness | Transaction monitoring, reconciliation, error handling |
| **PI1.3** | Timeliness | SLA monitoring, processing delay alerts, batch job monitoring |
| **PI1.4** | Authorization | Processing authorization controls, segregation of duties |

**Select when:** Data accuracy is critical (financial processing, healthcare records, analytics platforms).

### Privacy (P1-P8) — Optional

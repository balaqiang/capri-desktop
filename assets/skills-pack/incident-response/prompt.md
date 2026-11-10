YOU ARE USING THE SKILL "incident-response" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Incident Response

Incident response skill for the full lifecycle from initial triage through forensic collection, severity declaration, and escalation routing. This is NOT threat hunting (see threat-detection) or post-incident compliance mapping (see governance/compliance-mapping) — this is about classifying, triaging, and managing declared security incidents.

---

## Table of Contents

- [Overview](#overview)
- [Incident Triage Tool](#incident-triage-tool)
- [Incident Classification](#incident-classification)
- [Severity Framework](#severity-framework)
- [False Positive Filtering](#false-positive-filtering)
- [Forensic Evidence Collection](#forensic-evidence-collection)
- [Escalation Paths](#escalation-paths)
- [Regulatory Notification Obligations](#regulatory-notification-obligations)
- [Workflows](#workflows)
- [Anti-Patterns](#anti-patterns)
- [Cross-References](#cross-references)

---

## Overview

### What This Skill Does

This skill provides the methodology and tooling for **incident triage and response** — classifying security events into typed incidents, scoring severity, filtering false positives, determining escalation paths, and initiating forensic evidence collection under chain-of-custody controls.

### Distinction from Other Security Skills

| Skill | Focus | Approach |
|-------|-------|----------|
| **incident-response** (this) | Active incidents | Reactive — classify, escalate, collect evidence |
| threat-detection | Pre-incident hunting | Proactive — find threats before alerts fire |
| cloud-security | Cloud posture assessment | Preventive — IAM, S3, network misconfiguration |
| red-team | Offensive simulation | Offensive — test detection and response capability |

### Prerequisites

A security event must be ingested before triage. Events can come from SIEM alerts, EDR detections, threat intel feeds, or user reports. The triage tool accepts JSON event payloads; see the input schema below.

---

## Incident Triage Tool

The `incident_triage.py` tool classifies events, checks false positives, scores severity, determines escalation, and performs forensic pre-analysis.

### Input Event Schema

```json
{
  "event_type": "ransomware",
  "host": "prod-db-01",
  "user": "svc_backup",
  "source_ip": "10.1.2.3",
  "timestamp": "2024-01-15T14:32:00Z",
  "raw_payload": {}
}

### Exit Codes

| Code | Meaning | Required Response |
|------|---------|-------------------|
| 0 | SEV3/SEV4 or clean | Standard ticket-based handling |
| 1 | SEV2 — elevated | 1-hour bridge call, async coordination |
| 2 | SEV1 — critical | Immediate 15-minute war room, all-hands |

---

## Incident Classification

Security events are classified into 14 incident types. Classification drives default severity, MITRE technique mapping, and response SLA.

### Incident Taxonomy

| Incident Type | Default Severity | MITRE Technique | Response SLA |
|--------------|-----------------|-----------------|--------------|
| ransomware | SEV1 | T1486 | 15 minutes |
| data_exfiltration | SEV1 | T1048 | 15 minutes |
| apt_intrusion | SEV1 | T1566 | 15 minutes |
| supply_chain_compromise | SEV1 | T1195 | 15 minutes |
| domain_controller_breach | SEV1 | T1078.002 | 15 minutes |
| credential_compromise | SEV2 | T1110 | 1 hour |
| lateral_movement | SEV2 | T1021 | 1 hour |
| malware_infection | SEV2 | T1204 | 1 hour |
| insider_threat | SEV2 | T1078 | 1 hour |
| cloud_account_compromise | SEV2 | T1078.004 | 1 hour |
| unauthorized_access | SEV3 | T1190 | 4 hours |
| policy_violation | SEV3 | N/A | 4 hours |
| phishing_attempt | SEV4 | T1566.001 | 24 hours |
| security_alert | SEV4 | N/A | 24 hours |

### SEV Escalation Triggers

Any of the following automatically re-declare a higher severity:

| Trigger | New Severity |
|---------|-------------|
| Ransomware note found | SEV1 |
| Active exfiltration confirmed | SEV1 |
| CloudTrail or SIEM disabled | SEV1 |
| Domain controller access confirmed | SEV1 |
| Second system compromised | SEV1 |
| Exfiltration volume exceeds 1 GB | SEV2 minimum |
| C-suite account accessed | SEV2 minimum |

---

## Severity Framework

### SEV Level Matrix

| Level | Name | Criteria | Skills Invoked | Escalation Path |
|-------|------|----------|---------------|-----------------|
| SEV1 | Critical | Confirmed ransomware; active PII/PHI exfiltration (>10K records); domain controller breach; defense evasion (CloudTrail disabled); supply chain compromise | All skills (parallel) | SOC Lead → CISO → CEO → Board Chair |
| SEV2 | High | Confirmed unauthorized access to sensitive systems; credential compromise with elevated privileges; lateral movement confirmed; ransomware indicators without confirmed execution | triage + containment + forensics | SOC Lead → CISO |
| SEV3 | Medium | Suspected unauthorized access (unconfirmed); malware detected and contained; single account compromise (no priv escalation) | triage + containment | SOC Lead → Security Manager |
| SEV4 | Low | Security alert with no confirmed impact; informational indicator; policy violation with no data risk | triage only | L3 Analyst queue |

---

## False Positive Filtering

The triage tool applies five filters before escalating to prevent false positive inflation.

### False Positive Filter Types

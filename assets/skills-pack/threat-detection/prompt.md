YOU ARE USING THE SKILL "threat-detection" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Threat Detection

Threat detection skill for proactive discovery of attacker activity through hypothesis-driven hunting, IOC analysis, and behavioral anomaly detection. This is NOT incident response (see incident-response) or red team operations (see red-team) — this is about finding threats that have evaded automated controls.

---

## Table of Contents

- [Overview](#overview)
- [Threat Signal Analyzer](#threat-signal-analyzer)
- [Threat Hunting Methodology](#threat-hunting-methodology)
- [IOC Analysis](#ioc-analysis)
- [Anomaly Detection](#anomaly-detection)
- [MITRE ATT&CK Signal Prioritization](#mitre-attck-signal-prioritization)
- [Deception and Honeypot Integration](#deception-and-honeypot-integration)
- [Workflows](#workflows)
- [Anti-Patterns](#anti-patterns)
- [Cross-References](#cross-references)

---

## Overview

### What This Skill Does

This skill provides the methodology and tooling for **proactive threat detection** — finding attacker activity through structured hunting hypotheses, IOC analysis, and statistical anomaly detection before alerts fire.

### Distinction from Other Security Skills

| Skill | Focus | Approach |
|-------|-------|----------|
| **threat-detection** (this) | Finding hidden threats | Proactive — hunt before alerts |
| incident-response | Active incidents | Reactive — contain and investigate declared incidents |
| red-team | Offensive simulation | Offensive — test defenses from attacker perspective |
| cloud-security | Cloud misconfigurations | Posture — IAM, S3, network exposure |

### Prerequisites

Read access to SIEM/EDR telemetry, endpoint logs, and network flow data. IOC feeds require freshness within 30 days to avoid false positives. Hunting hypotheses must be scoped to the environment before execution.

---

## Threat Signal Analyzer

The `threat_signal_analyzer.py` tool supports three modes: `hunt` (hypothesis scoring), `ioc` (sweep generation), and `anomaly` (statistical detection).

### IOC file format

```json
{
  "ips": ["1.2.3.4", "5.6.7.8"],
  "domains": ["malicious.example.com"],
  "hashes": ["abc123def456..."]
}

### Telemetry events file format

```json
[
  {"timestamp": "2024-01-15T14:32:00Z", "entity": "host-01", "action": "dns_query", "volume": 450},
  {"timestamp": "2024-01-15T14:33:00Z", "entity": "host-02", "action": "dns_query", "volume": 95}
]

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | No high-priority findings |
| 1 | Medium-priority signals detected |
| 2 | High-priority confirmed findings |

---

## Threat Hunting Methodology

Structured threat hunting follows a five-step loop: hypothesis → data source identification → query execution → finding triage → feedback to detection engineering.

### Hypothesis Scoring

| Factor | Weight | Description |
|--------|--------|-------------|
| Actor relevance | ×3 | How closely does this TTP match known threat actors in your sector? |
| Control gap | ×2 | How many of your existing controls would miss this behavior? |
| Data availability | ×1 | Do you have the telemetry data needed to test this hypothesis? |

Priority score = (actor_relevance × 3) + (control_gap × 2) + (data_availability × 1)

### High-Value Hunt Hypotheses by Tactic

| Hypothesis | MITRE ID | Data Sources | Priority Signal |
|-----------|----------|--------------|-----------------|
| WMI lateral movement via remote execution | T1047 | WMI logs, EDR process telemetry | WMI process spawned from WINRM, unusual parent-child chain |
| LOLBin execution for defense evasion | T1218 | Process creation, command-line args | certutil.exe, regsvr32.exe, mshta.exe with network activity |
| Beaconing C2 via jitter-heavy intervals | T1071.001 | Proxy logs, DNS logs | Regular interval outbound connections ±10% jitter |
| Pass-the-Hash lateral movement | T1550.002 | Windows security event 4624 type 3 | NTLM auth from unexpected source host to admin share |
| LSASS memory access | T1003.001 | EDR memory access events | OpenProcess on lsass.exe from non-system process |
| Kerberoasting | T1558.003 | Windows event 4769 | High volume TGS requests for service accounts |
| Scheduled task persistence | T1053.005 | Sysmon Event 1/11, Windows 4698 | Scheduled task created in non-standard directory |

---

## IOC Analysis

IOC analysis determines whether indicators are fresh, maps them to required sweep targets, and filters stale data that generates false positives.

### IOC Types and Sweep Priority

| IOC Type | Staleness Threshold | Sweep Target | MITRE Coverage |
|---------|--------------------|--------------|----|
| IP addresses | 30 days | Firewall logs, NetFlow, proxy logs | T1071, T1105 |
| Domains | 30 days | DNS resolver logs, proxy logs | T1568, T1583 |
| File hashes | 90 days | EDR file creation, AV scan logs | T1105, T1027 |
| URLs | 14 days | Proxy access logs, browser history | T1566.002 |
| Mutex names | 180 days | EDR runtime artifacts | T1055 |

### IOC Staleness Handling

IOCs older than their threshold are flagged as `stale` and excluded from sweep target generation. Running sweeps against stale IOCs inflates false positive rates and reduces SOC credibility. Refresh IOC feeds from threat intelligence platforms (MISP, OpenCTI, commercial TI) before every hunt cycle.

---

## Anomaly Detection

Statistical anomaly detection identifies behavior that deviates from established baselines without relying on known-bad signatures.

### Z-Score Thresholds

YOU ARE USING THE SKILL "cloud-security" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Cloud Security

Cloud security posture assessment skill for detecting IAM privilege escalation, public storage exposure, network configuration risks, and infrastructure-as-code misconfigurations. This is NOT incident response for active cloud compromise (see incident-response) or application vulnerability scanning (see security-pen-testing) — this is about systematic cloud configuration analysis to prevent exploitation.

---

## Table of Contents

- [Overview](#overview)
- [Cloud Posture Check Tool](#cloud-posture-check-tool)
- [IAM Policy Analysis](#iam-policy-analysis)
- [S3 Exposure Assessment](#s3-exposure-assessment)
- [Security Group Analysis](#security-group-analysis)
- [IaC Security Review](#iac-security-review)
- [Cloud Provider Coverage Matrix](#cloud-provider-coverage-matrix)
- [Workflows](#workflows)
- [Anti-Patterns](#anti-patterns)
- [Cross-References](#cross-references)

---

## Overview

### What This Skill Does

This skill provides the methodology and tooling for **cloud security posture management (CSPM)** — systematically checking cloud configurations for misconfigurations that create exploitable attack surface. It covers IAM privilege escalation paths, storage public exposure, network over-permissioning, and infrastructure code security.

### Distinction from Other Security Skills

| Skill | Focus | Approach |
|-------|-------|----------|
| **cloud-security** (this) | Cloud configuration risk | Preventive — assess before exploitation |
| incident-response | Active cloud incidents | Reactive — triage confirmed cloud compromise |
| threat-detection | Behavioral anomalies | Proactive — hunt for attacker activity in cloud logs |
| security-pen-testing | Application vulnerabilities | Offensive — actively exploit found weaknesses |

### Prerequisites

Read access to IAM policy documents, S3 bucket configurations, and security group rules in JSON format. For continuous monitoring, integrate with cloud provider APIs (AWS Config, Azure Policy, GCP Security Command Center).

---

## Cloud Posture Check Tool

The `cloud_posture_check.py` tool runs three types of checks: `iam` (privilege escalation), `s3` (public access), and `sg` (network exposure). It auto-detects the check type from the config file structure or accepts explicit `--check` flags.

### Exit Codes

| Code | Meaning | Required Action |
|------|---------|-----------------|
| 0 | No high/critical findings | No action required |
| 1 | High-severity findings | Remediate within 24 hours |
| 2 | Critical findings | Remediate immediately — escalate to incident-response if active |

---

## IAM Policy Analysis

IAM analysis detects privilege escalation paths, overprivileged grants, public principal exposure, and data exfiltration risk.

### Privilege Escalation Patterns

| Pattern | Severity | Key Action Combination | MITRE |
|---------|----------|------------------------|-------|
| Lambda PassRole escalation | Critical | iam:PassRole + lambda:CreateFunction | T1078.004 |
| EC2 instance profile abuse | Critical | iam:PassRole + ec2:RunInstances | T1078.004 |
| CloudFormation PassRole | Critical | iam:PassRole + cloudformation:CreateStack | T1078.004 |
| Self-attach policy escalation | Critical | iam:AttachUserPolicy + sts:GetCallerIdentity | T1484.001 |
| Inline policy self-escalation | Critical | iam:PutUserPolicy + sts:GetCallerIdentity | T1484.001 |
| Policy version backdoor | Critical | iam:CreatePolicyVersion + iam:ListPolicies | T1484.001 |
| Credential harvesting | High | iam:CreateAccessKey + iam:ListUsers | T1098.001 |
| Group membership escalation | High | iam:AddUserToGroup + iam:ListGroups | T1098 |
| Password reset attack | High | iam:UpdateLoginProfile + iam:ListUsers | T1098 |
| Service-level wildcard | High | iam:* or s3:* or ec2:* | T1078.004 |

### IAM Finding Severity Guide

| Finding Type | Condition | Severity |
|-------------|-----------|----------|
| Full admin wildcard | Action=* Resource=* | Critical |
| Public principal | Principal: '*' | Critical |
| Dangerous action combo | Two-action escalation path | Critical |
| Individual priv-esc actions | On wildcard resource | High |
| Data exfiltration actions | s3:GetObject, secretsmanager:GetSecretValue on * | High |
| Service wildcard | service:* action | High |
| Data actions on named resource | Appropriate scope | Low/Clean |

### Least Privilege Recommendations

For every critical or high finding, the tool outputs a `least_privilege_suggestion` field with specific remediation guidance:
- Replace `Action: *` with a named list of required actions
- Replace `Resource: *` with specific ARN patterns
- Use AWS Access Analyzer to identify actually-used permissions
- Separate dangerous action combinations into different roles with distinct trust policies

---

## S3 Exposure Assessment

S3 assessment checks four dimensions: public access block configuration, bucket ACL, bucket policy principal exposure, and default encryption.

### S3 Configuration Check Matrix

| Check | Finding Condition | Severity |
|-------|------------------|----------|
| Public access block | Any of four flags missing/false | High |
| Bucket ACL | public-read-write | Critical |
| Bucket ACL | public-read or authenticated-read | High |
| Bucket policy Principal | "Principal": "*" with Allow | Critical |
| Default encryption | No ServerSideEncryptionConfiguration | High |
| Default encryption | Non-standard SSEAlgorithm | Medium |
| No PublicAccessBlockConfiguration | Status unknown | Medium |

### Recommended S3 Baseline Configuration

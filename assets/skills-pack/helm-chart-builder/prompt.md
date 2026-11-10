YOU ARE USING THE SKILL "helm-chart-builder" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Helm Chart Builder

> Production-grade Helm charts. Sensible defaults. Secure by design. No cargo-culting.

Opinionated Helm workflow that turns ad-hoc Kubernetes manifests into maintainable, testable, reusable charts. Covers chart structure, values design, template patterns, dependency management, and security hardening.

Not a Helm tutorial — a set of concrete decisions about how to build charts that operators trust and developers don't fight.

---

## Slash Commands

| Command | What it does |
|---------|-------------|
| `/helm-chart-builder create` | Scaffold a production-ready Helm chart with best-practice structure |
| `/helm-chart-builder review` | Analyze an existing chart for issues — missing labels, hardcoded values, template anti-patterns |
| `/helm-chart-builder security` | Audit chart for security issues — RBAC, network policies, pod security, secrets handling |

---

## When This Skill Activates

Recognize these patterns from the user:

- "Create a Helm chart for this service"
- "Review my Helm chart"
- "Is this chart secure?"
- "Design a values.yaml"
- "Add a subchart dependency"
- "Set up helm tests"
- "Helm best practices for [workload type]"
- Any request involving: Helm chart, values.yaml, Chart.yaml, templates, helpers, _helpers.tpl, subcharts, helm lint, helm test

If the user has a Helm chart or wants to package Kubernetes resources → this skill applies.

---

## Workflow

### `/helm-chart-builder create` — Chart Scaffolding

1. **Identify workload type**
   - Web service (Deployment + Service + Ingress)
   - Worker (Deployment, no Service)
   - CronJob (CronJob + ServiceAccount)
   - Stateful service (StatefulSet + PVC + Headless Service)
   - Library chart (no templates, only helpers)

2. **Scaffold chart structure**

   ```
   mychart/
   ├── Chart.yaml              # Chart metadata and dependencies
   ├── values.yaml             # Default configuration
   ├── values.schema.json      # Optional: JSON Schema for values validation
   ├── .helmignore             # Files to exclude from packaging
   ├── templates/
   │   ├── _helpers.tpl        # Named templates and helper functions
   │   ├── deployment.yaml     # Workload resource
   │   ├── service.yaml        # Service exposure
   │   ├── ingress.yaml        # Ingress (if applicable)
   │   ├── serviceaccount.yaml # ServiceAccount
   │   ├── hpa.yaml            # HorizontalPodAutoscaler
   │   ├── pdb.yaml            # PodDisruptionBudget
   │   ├── networkpolicy.yaml  # NetworkPolicy
   │   ├── configmap.yaml      # ConfigMap (if needed)
   │   ├── secret.yaml         # Secret (if needed)
   │   ├── NOTES.txt           # Post-install usage instructions
   │   └── tests/
   │       └── test-connection.yaml
   └── charts/                 # Subcharts (dependencies)

3. **Apply Chart.yaml best practices**

   ```
   METADATA
   ├── apiVersion: v2 (Helm 3 only — never v1)
   ├── name: matches directory name exactly
   ├── version: semver (chart version, not app version)
   ├── appVersion: application version string
   ├── description: one-line summary of what the chart deploys
   └── type: application (or library for shared helpers)

   DEPENDENCIES
   ├── Pin dependency versions with ~X.Y.Z (patch-level float)
   ├── Use condition field to make subcharts optional
   ├── Use alias for multiple instances of same subchart
   └── Run helm dependency update after changes

4. **Generate values.yaml with documentation**
   - Every value has an inline comment explaining purpose and type
   - Sensible defaults that work for development
   - Override-friendly structure (flat where possible, nested only when logical)
   - No hardcoded cluster-specific values (image registry, domain, storage class)

5. **Validate**

### `/helm-chart-builder review` — Chart Analysis

1. **Check chart structure**

   | Check | Severity | Fix |
   |-------|----------|-----|
   | Missing _helpers.tpl | High | Create helpers for common labels and selectors |
   | No NOTES.txt | Medium | Add post-install instructions |
   | No .helmignore | Low | Create one to exclude .git, CI files, tests |
   | Missing Chart.yaml fields | Medium | Add description, appVersion, maintainers |
   | Hardcoded values in templates | High | Extract to values.yaml with defaults |

2. **Check template quality**

   | Check | Severity | Fix |
   |-------|----------|-----|
   | Missing standard labels | High | Use `app.kubernetes.io/*` labels via _helpers.tpl |
   | No resource requests/limits | Critical | Add resources section with defaults in values.yaml |
   | Hardcoded image tag | High | Use `{{ .Values.image.repository }}:{{ .Values.image.tag }}` |
   | No imagePullPolicy | Medium | Default to `IfNotPresent`, overridable |
   | Missing liveness/readiness probes | High | Add probes with configurable paths and ports |
   | No pod anti-affinity | Medium | Add preferred anti-affinity for HA |
   | Duplicate template code | Medium | Extract into named templates in _helpers.tpl |

3. **Check values.yaml quality**

4. **Generate review report**
   ```
   HELM CHART REVIEW — [chart name]
   Date: [timestamp]

   CRITICAL: [count]
   HIGH:     [count]
   MEDIUM:   [count]
   LOW:      [count]

   [Detailed findings with fix recommendations]

### `/helm-chart-builder security` — Security Audit

1. **Pod security audit**

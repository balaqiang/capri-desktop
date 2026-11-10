YOU ARE USING THE SKILL "kubernetes-operator" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Kubernetes Operator

Build operators that reconcile correctly. Most operator bugs are not Kubernetes bugs — they are reconcile-loop bugs: missing finalizers, blocking calls, no requeue on transient errors, status drift, RBAC over-grants. This skill catches them deterministically before they reach a cluster.

## When to use

- Building a new Kubernetes Operator (controller for a CRD)
- Reviewing an existing operator for capability-level gaps
- Auditing a CRD spec for status/conditions/finalizer correctness
- Choosing a framework (controller-runtime / kubebuilder / operator-sdk / metacontroller / KOPF)
- Designing the API surface of a Custom Resource
- Hardening RBAC, leader election, or webhook validation

## When NOT to use

- Plain Helm chart packaging → use `helm-chart-builder`
- Standard kubectl operations / blue-green deploys → use `senior-devops`
- General k8s security posture → use `cloud-security`
- "I want to run a workload" — that's a Deployment / Job, not an operator

## Core principle: an operator is a reconcile loop, not a script

```
observe(actual) → desired = read(spec) → diff(actual, desired) → act → update(status)
                                                                          ↓
                                                                   requeue / done

Operators that fail are the ones that:
1. Treat reconcile as imperative (do this, then this, then this) instead of declarative (make actual=desired, idempotently)
2. Don't requeue transient failures
3. Don't use finalizers, leaving orphan resources
4. Mutate spec instead of status
5. Don't use the status subresource (status updates trigger spec reconciles → loop)
6. Block in reconcile (long HTTP calls, locks)
7. Forget leader election → split-brain on multi-replica deploys

The 3 tools below catch each of these.

## The 3 Python tools

All stdlib-only. Run with `--help`.

### `crd_validator.py`

Validates a CRD YAML against operator-pattern best practices.

**Checks:**
- `spec.versions[*].subresources.status` is set (status subresource)
- `spec.scope` is `Namespaced` (not `Cluster`) unless explicitly justified
- Singular and listKind defined
- `spec.versions[*].schema.openAPIV3Schema` has type definitions (no `x-kubernetes-preserve-unknown-fields: true` at top level)
- A version is marked `served: true` AND `storage: true`
- Conditions array is in the schema (allows `metav1.Conditions`)
- Printer columns include `Age` and `Status`/`Phase`

### `reconcile_lint.py`

Lints a Go controller reconcile function for anti-patterns.

**Checks (regex-based heuristics):**
- Returns are `(ctrl.Result, error)` shape
- Errors trigger a non-zero requeue (`return ctrl.Result{Requeue: true}, err`)
- `client.Update()` on the spec object is flagged (controllers should update only status)
- `time.Sleep` inside reconcile is flagged (use `RequeueAfter`)
- HTTP calls without context cancellation are flagged
- Missing `defer` after a finalizer add
- No `IsConditionTrue` / `SetCondition` calls when conditions present in CRD
- Reconcile function exceeds 80 lines (extract subroutines)

### `operator_capability_audit.py`

Scores an operator against OperatorHub's 5 Capability Levels.

**Levels:**
- **L1 — Basic Install:** CRD defined, controller deploys it
- **L2 — Seamless Upgrades:** PDBs, conversion webhooks, version skew strategy
- **L3 — Full Lifecycle:** backups, restores, failure recovery
- **L4 — Deep Insights:** metrics endpoint, Prometheus rules, alerts
- **L5 — Auto Pilot:** auto-scaling, auto-tuning, anomaly detection

Reports current level + concrete next steps to advance one level.

## Tooling landscape

| Framework | Language | Best for | Maintenance |
|---|---|---|---|
| **controller-runtime** | Go | Production-grade, low-level control | Active (sig-api-machinery) |
| **kubebuilder** | Go | Standard scaffolding, opinionated | Active (Kubernetes SIGs) |
| **operator-sdk** | Go / Helm / Ansible | OpenShift / mixed-paradigm teams | Active (Red Hat) |
| **metacontroller** | Any (webhook-based) | Polyglot teams, avoiding Go | Less active |
| **KOPF** | Python | Python shops, async-first | Active (community) |
| **java-operator-sdk** | Java | JVM shops | Active (Red Hat / Java SIG) |

Decision rules:
- New operator + Go shop → kubebuilder
- New operator + Python shop → KOPF
- New operator + can't pick a language → metacontroller
- OpenShift target → operator-sdk

## CRD design principles

1. **status is the source of truth for the controller's view of the world.** Spec is what the user wants; status is what the controller observed.
2. **Use the status subresource.** Without it, status updates re-trigger reconcile (loop).
3. **Use Conditions.** `Ready`, `Reconciling`, `Degraded`. Each carries a reason and message.
4. **Add finalizers.** Without finalizers, deletion races the controller and orphans external resources.
5. **Version your CRD from day 1.** `v1alpha1` → `v1beta1` → `v1`. Plan a conversion webhook.
6. **Validate via OpenAPI v3 schema.** Don't rely on the controller for validation that should fail at admission.
7. **Use `additionalPrinterColumns` for `kubectl get`.** Show `Age`, `Phase`, `Ready` at minimum.
8. **Namespace your CRDs unless they manage cluster-scoped resources.**

## Reconcile loop principles

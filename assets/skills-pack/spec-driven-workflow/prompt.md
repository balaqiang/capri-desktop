YOU ARE USING THE SKILL "spec-driven-workflow" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Spec-Driven Workflow — POWERFUL

## Overview

Spec-driven workflow enforces a single, non-negotiable rule: **write the specification BEFORE you write any code.** Not alongside. Not after. Before.

This is not documentation. This is a contract. A spec defines what the system MUST do, what it SHOULD do, and what it explicitly WILL NOT do. Every line of code you write traces back to a requirement in the spec. Every test traces back to an acceptance criterion. If it is not in the spec, it does not get built.

### Why Spec-First Matters

1. **Eliminates rework.** 60-80% of defects originate from requirements, not implementation. Catching ambiguity in a spec costs minutes; catching it in production costs days.
2. **Forces clarity.** If you cannot write what the system should do in plain language, you do not understand the problem well enough to write code.
3. **Enables parallelism.** Once a spec is approved, frontend, backend, QA, and documentation can all start simultaneously.
4. **Creates accountability.** The spec is the definition of done. No arguments about whether a feature is "complete" — either it satisfies the acceptance criteria or it does not.
5. **Feeds TDD directly.** Acceptance criteria in Given/When/Then format translate 1:1 into test cases. The spec IS the test plan.

### The Iron Law

```
NO CODE WITHOUT AN APPROVED SPEC.
NO EXCEPTIONS. NO "QUICK PROTOTYPES." NO "I'LL DOCUMENT IT LATER."

If the spec is not written, reviewed, and approved, implementation does not begin. Period.

---

## The Spec Format

Every spec follows this structure. No sections are optional — if a section does not apply, write "N/A — [reason]" so reviewers know it was considered, not forgotten.

### Mandatory Sections

| # | Section | Key Rules |
|---|---------|-----------|
| 1 | **Title and Metadata** | Author, date, status (Draft/In Review/Approved/Superseded), reviewers |
| 2 | **Context** | Why this feature exists. 2-4 paragraphs with evidence (metrics, tickets). |
| 3 | **Functional Requirements** | RFC 2119 keywords (MUST/SHOULD/MAY). Numbered FR-N. Each is atomic and testable. |
| 4 | **Non-Functional Requirements** | Performance, security, accessibility, scalability, reliability — all with measurable thresholds. |
| 5 | **Acceptance Criteria** | Given/When/Then format. Every AC references at least one FR-* or NFR-*. |
| 6 | **Edge Cases** | Numbered EC-N. Cover failure modes for every external dependency. |
| 7 | **API Contracts** | TypeScript-style interfaces. Cover success and error responses. |
| 8 | **Data Models** | Table format with field, type, constraints. Every entity from requirements must have a model. |
| 9 | **Out of Scope** | Explicit exclusions with reasons. Prevents scope creep during implementation. |

### RFC 2119 Keywords

| Keyword | Meaning |
|---------|---------|
| **MUST** | Absolute requirement. Non-conformant without it. |
| **MUST NOT** | Absolute prohibition. |
| **SHOULD** | Recommended. Omit only with documented justification. |
| **MAY** | Optional. Implementer's discretion. |

---

## Bounded Autonomy Rules

These rules define when an agent (human or AI) MUST stop and ask for guidance vs. when they can proceed independently.

### STOP and Ask When:

1. **Scope creep detected.** The implementation requires something not in the spec. Even if it seems obviously needed, STOP. The spec might have excluded it deliberately.

2. **Ambiguity exceeds 30%.** If you cannot determine the correct behavior from the spec for more than 30% of a given requirement, the spec is incomplete. Do not guess.

3. **Breaking changes required.** The implementation would change an existing API contract, database schema, or public interface. Always escalate.

4. **Security implications.** Any change that touches authentication, authorization, encryption, or PII handling requires explicit approval.

5. **Performance characteristics unknown.** If a requirement says "MUST complete in < 500ms" but you have no way to measure or guarantee that, escalate before implementing a guess.

6. **Cross-team dependencies.** If the spec requires coordination with another team or service, confirm the dependency before building against it.

### Continue Autonomously When:

1. **Spec is clear and unambiguous** for the current task.
2. **All acceptance criteria have passing tests** and you are refactoring internals.
3. **Changes are non-breaking** — no public API, schema, or behavior changes.
4. **Implementation is a direct translation** of a well-defined acceptance criterion.
5. **Error handling follows established patterns** already documented in the codebase.

### Escalation Protocol

When you must stop, provide:

```markdown
## Escalation: [Brief Title]

**Blocked on:** [requirement ID, e.g., FR-3]
**Question:** [Specific, answerable question — not "what should I do?"]
**Options considered:**
  A. [Option] — Pros: [...] Cons: [...]
  B. [Option] — Pros: [...] Cons: [...]
**My recommendation:** [A or B, with reasoning]
**Impact of waiting:** [What is blocked until this is resolved?]

Never escalate without a recommendation. Never present an open-ended question. Always give options.

---

## Workflow — 6 Phases

### Phase 1: Gather Requirements

**Goal:** Understand what needs to be built and why.

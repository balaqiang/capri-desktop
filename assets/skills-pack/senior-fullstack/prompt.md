YOU ARE USING THE SKILL "senior-fullstack" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Senior Fullstack

Fullstack development skill with project scaffolding and code quality analysis tools.

---

## Table of Contents

- [Trigger Phrases](#trigger-phrases)
- [Tools](#tools)
- [Workflows](#workflows)
- [Reference Guides](#reference-guides)

---

## Trigger Phrases

Use this skill when you hear:
- "scaffold a new project"
- "create a Next.js app"
- "set up FastAPI with React"
- "analyze code quality"
- "check for security issues in codebase"
- "what stack should I use"
- "set up a fullstack project"
- "generate project boilerplate"

---

## Workflows

### Workflow 1: Start New Project

1. Choose appropriate stack based on requirements (see Stack Decision Matrix)
2. Scaffold project structure
3. Verify scaffold: confirm `package.json` (or `requirements.txt`) exists
4. Run initial quality check — address any P0 issues before proceeding
5. Set up development environment

### Workflow 2: Audit Existing Codebase

1. Run code quality analysis
2. Review security findings — fix all P0 (critical) issues immediately
3. Re-run analyzer to confirm P0 issues are resolved
4. Create tickets for P1/P2 issues

### Workflow 3: Stack Selection

Use the tech stack guide to evaluate options:

1. **SEO Required?** → Next.js with SSR
2. **API-heavy backend?** → Separate FastAPI or NestJS
3. **Real-time features?** → Add WebSocket layer
4. **Team expertise** → Match stack to team skills

---

## Quick Reference

### Stack Decision Matrix

| Requirement | Recommendation |
|-------------|---------------|
| SEO-critical site | Next.js with SSR |
| Internal dashboard | React + Vite |
| API-first backend | FastAPI or Fastify |
| Enterprise scale | NestJS + PostgreSQL |
| Rapid prototype | Next.js API routes |
| Document-heavy data | MongoDB |
| Complex queries | PostgreSQL |

### Common Issues

| Issue | Solution |
|-------|----------|
| N+1 queries | Use DataLoader or eager loading |
| Slow builds | Check bundle size, lazy load |
| Auth complexity | Use Auth.js or Clerk |
| Type errors | Enable strict mode in tsconfig |
| CORS issues | Configure middleware properly |

---

## Assumptions and Verifiable Success Criteria (Karpathy discipline)

Before this skill scaffolds, recommends, or modifies any code, the following four assumptions MUST be surfaced. If any are unknown, the skill stops and walks the [Forcing-question library](#forcing-question-library-matt-pocock-grill) instead.

1. **Team size today + 12-month headcount** — drives architecture (monolith / modular / services). Sam Newman: "MonolithFirst."
2. **Deployment cadence target** — drives CI/CD spend and feature-flag investment. *Accelerate* (Forsgren et al. 2018).
3. **User-facing vs. internal vs. marketing-site** — drives stack pick and a11y/perf budget.
4. **Monthly cloud + SaaS budget ceiling** — drives the build-vs-managed-service split.

**Verifiable success criteria** (Karpathy #4) — every recommendation this skill emits must include three machine-checkable numbers:

- An API latency target (p50, p95, p99 in ms)
- A frontend perf target (LCP, INP, CLS on mobile-4G)
- An uptime / SLO target

If any of those three is not stated, the recommendation is incomplete — go back to Q7 of the forcing-question library.

---

## Customization profiles

Four built-in profiles in `profiles/` calibrate every recommendation:

| Profile | When to pick | Cloud ceiling | Pattern |
|---|---|---|---|
| `saas-startup` | < 10 eng, customer-facing, daily+ cadence | $8K/mo | Modular monolith on Next.js + Postgres |
| `enterprise-scale` | 50+ eng, regulated, per-PR with gates | $250K/mo | Domain-bounded services + platform team |
| `internal-tool` | ≤ 5 eng, auth-walled, < 100 DAU | $500/mo | Retool-first; thin custom stack if forced |
| `marketing-site` | SEO-dependent, near-zero write | $200/mo | Static-first (Astro / 11ty / Next-static) |

Pick a profile via:

The tool returns the best-fit profile, the tradeoff against the runner-up (if within 15%), the stack recommendation, the anti-patterns to avoid on that profile, and the named-approver chain. **This tool never auto-approves.**

To add a custom profile: copy `profiles/saas-startup.json` to `profiles/<your-org>.json`, adjust the `constraints` and `stack_recommendations` blocks, and rerun. The JSON is the customization surface — no code changes needed.

---

## Composition map

| Concern | Fork into |
|---|---|
| API contract review | `engineering/skills/api-design-reviewer/` |
| Database schema design | `engineering/skills/database-designer/` |
| Reliability / SLO design | `engineering/slo-architect/` |
| CI/CD pipeline | `engineering/skills/ci-cd-pipeline-builder/` |
| Performance profiling | `engineering/skills/performance-profiler/` |
| Pre-commit Karpathy review | `engineering/karpathy-coder/` |
| Pre-flight architecture grill | `engineering/grill-me/` |

The `cs-fullstack-engineer` agent (in `agents/engineering/cs-fullstack-engineer.md`) orchestrates these forks via `context: fork`. Invoke it from another agent with `Agent({subagent_type: "cs-fullstack-engineer", prompt: "..."})` or via the slash command `/cs-fullstack-review <your problem>`.

---

## Forcing-question library (Matt Pocock grill)

1. One question per turn. No bundling.
2. Always recommend the answer with cited canon.
3. Track answers in a working file (e.g., `/tmp/fullstack-grill-<date>.md`).
4. If a kill criterion trips, stop. Do not scaffold around an unresolved gap.
5. After Q7, run `fullstack_decision_engine.py` with the seven answers as inputs.

Summary of the seven questions (full content in the reference):

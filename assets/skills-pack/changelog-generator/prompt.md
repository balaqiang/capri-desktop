YOU ARE USING THE SKILL "changelog-generator" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Changelog Generator

**Tier:** POWERFUL  
**Category:** Engineering  
**Domain:** Release Management / Documentation

## Overview

Use this skill to produce consistent, auditable release notes from Conventional Commits. It separates commit parsing, semantic bump logic, and changelog rendering so teams can automate releases without losing editorial control.

## Core Capabilities

- Parse commit messages using Conventional Commit rules
- Detect semantic bump (`major`, `minor`, `patch`) from commit stream
- Render Keep a Changelog sections (`Added`, `Changed`, `Fixed`, etc.)
- Generate release entries from git ranges or provided commit input
- Enforce commit format with a dedicated linter script
- Support CI integration via machine-readable JSON output

## When to Use

- Before publishing a release tag
- During CI to generate release notes automatically
- During PR checks to block invalid commit message formats
- In monorepos where package changelogs require scoped filtering
- When converting raw git history into user-facing notes

## Key Workflows

### 1. Generate Changelog Entry From Git

### 2. Generate Entry From stdin/File Input

### 3. Update `CHANGELOG.md`

### 4. Compute the Next Version From Commits

When the user has not decided the next version, derive it instead of guessing:

### 5. Lint Commits Before Merge

Or file/stdin:

## Conventional Commit Rules

Supported types:

- `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`, `ci`, `chore`
- `security`, `deprecated`, `remove`

Breaking changes:

- `type(scope)!: summary`
- Footer/body includes `BREAKING CHANGE:`

SemVer mapping:

- breaking -> `major`
- non-breaking `feat` -> `minor`
- all others -> `patch`

## Common Pitfalls

1. Mixing merge commit messages with release commit parsing
2. Using vague commit summaries that cannot become release notes
3. Failing to include migration guidance for breaking changes
4. Treating docs/chore changes as user-facing features
5. Overwriting historical changelog sections instead of prepending

## Best Practices

1. Keep commits small and intent-driven.
2. Scope commit messages (`feat(api): ...`) in multi-package repos.
3. Enforce linter checks in PR pipelines.
4. Review generated markdown before publishing.
5. Tag releases only after changelog generation succeeds.
6. Keep an `[Unreleased]` section for manual curation when needed.

## Hotfix Severity & SLAs

| Severity | Definition | SLA | Approval |
|---|---|---|---|
| P0 — Critical | Outage, data loss, exploited vulnerability | Fix deployed ≤ 2h; emergency deploy bypasses normal gates | Engineering Lead + On-call Manager |
| P1 — High | Major feature broken, significant user impact | Fix deployed ≤ 24h; expedited review | Engineering Lead + Product Manager |
| P2 — Medium | Minor issues, limited impact | Next release cycle | Standard PR review |

Hotfix branch comes from the last stable tag, contains the minimal fix only, and gets its own patch-bump changelog entry via the workflow above.

## Rollback Triggers

Pre-commit to these thresholds before tagging; roll back when any fires:

| Trigger | Threshold |
|---|---|
| Error rate spike | > 2x baseline within 30 min |
| Performance degradation | > 50% latency increase |
| Feature failure | Core functionality broken |
| Security incident | Vulnerability being exploited |
| Data corruption | Database integrity compromised |

## Release Governance

Use this release flow for predictability:

1. Lint commit history for target release range.
2. Generate changelog draft from commits.
3. Manually adjust wording for customer clarity.
4. Validate semver bump recommendation.
5. Tag release only after changelog is approved.

## Output Quality Checks

- Each bullet is user-meaningful, not implementation noise.
- Breaking changes include migration action.
- Security fixes are isolated in `Security` section.
- Sections with no entries are omitted.
- Duplicate bullets across sections are removed.

## CI Policy

- Run `commit_linter.py --strict` on all PRs.
- Block merge on invalid conventional commits.
- Auto-generate draft release notes on tag push.
- Require human approval before writing into `CHANGELOG.md` on main branch.

## Monorepo Guidance

- Prefer commit scopes aligned to package names.
- Filter commit stream by scope for package-specific releases.
- Keep infra-wide changes in root changelog.
- Store package changelogs near package roots for ownership clarity.

## Failure Handling

- If no valid conventional commits found: fail early, do not generate misleading empty notes.
- If git range invalid: surface explicit range in error output.
- If write target missing: create safe changelog header scaffolding.

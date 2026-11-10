YOU ARE USING THE SKILL "prompt-engineer-toolkit" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Prompt Engineer Toolkit

## Overview

Use this skill to move prompts from ad-hoc drafts to production assets with repeatable testing, versioning, and regression safety. It emphasizes measurable quality over intuition. Apply it when launching a new LLM feature that needs reliable outputs, when prompt quality degrades after model or instruction changes, when multiple team members edit prompts and need history/diffs, when you need evidence-based prompt choice for production rollout, or when you want consistent prompt governance across environments.

## Core Capabilities

- A/B prompt evaluation against structured test cases
- Quantitative scoring for adherence, relevance, and safety checks
- Prompt version tracking with immutable history and changelog
- Prompt diffs to review behavior-impacting edits
- Reusable prompt templates and selection guidance
- Regression-friendly workflows for model/prompt updates

## Key Workflows

### 1. Run Prompt A/B Test

Prepare JSON test cases and run:

Input can also come from stdin/`--input` JSON payload.

### 2. Choose Winner With Evidence

The tester scores outputs per case and aggregates:

- expected content coverage
- forbidden content violations
- regex/format compliance
- output length sanity

Use the higher-scoring prompt as candidate baseline, then run regression suite.

### 3. Version Prompts

### 4. Regression Loop

1. Store baseline version.
2. Propose prompt edits.
3. Re-run A/B test.
4. Promote only if score and safety constraints improve.

## Pitfalls, Best Practices & Review Checklist

**Avoid these mistakes:**
1. Picking prompts from single-case outputs — use a realistic, edge-case-rich test suite.
2. Changing prompt and model simultaneously — always isolate variables.
3. Missing `must_not_contain` (forbidden-content) checks in evaluation criteria.
4. Editing prompts without version metadata, author, or change rationale.
5. Skipping semantic diffs before deploying a new prompt version.
6. Optimizing one benchmark while harming edge cases — track the full suite.
7. Model swap without rerunning the baseline A/B suite.

**Before promoting any prompt, confirm:**
- [ ] Task intent is explicit and unambiguous.
- [ ] Output schema/format is explicit.
- [ ] Safety and exclusion constraints are explicit.
- [ ] No contradictory instructions.
- [ ] No unnecessary verbosity tokens.
- [ ] A/B score improves and violation count stays at zero.

## Evaluation Design

Each test case should define:

- `input`: realistic production-like input
- `expected_contains`: required markers/content
- `forbidden_contains`: disallowed phrases or unsafe content
- `expected_regex`: required structural patterns

This enables deterministic grading across prompt variants.

## Versioning Policy

- Use semantic prompt identifiers per feature (`support_classifier`, `ad_copy_shortform`).
- Record author + change note for every revision.
- Never overwrite historical versions.
- Diff before promoting a new prompt to production.

## Rollout Strategy

1. Create baseline prompt version.
2. Propose candidate prompt.
3. Run A/B suite against same cases.
4. Promote only if winner improves average and keeps violation count at zero.
5. Track post-release feedback and feed new failure cases back into test suite.

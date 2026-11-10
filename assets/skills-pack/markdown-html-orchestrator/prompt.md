YOU ARE USING THE SKILL "markdown-html-orchestrator" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Markdown → HTML — Domain Orchestrator

Thariq Shihipar's argument (Claude Code HTML output essay, Medium 2026): **markdown collapses past 100 lines for agent-generated artifacts.** Long specs, code reviews, and architecture explainers lose density, hierarchy, and lightweight interaction the moment they exceed a screen of text. HTML restores all three — single-file, browser-native, shareable.

This orchestrator forks context, classifies the input markdown deterministically, routes to the right converter sub-skill, and returns a digest with the output path. Heavy intake (full markdown bodies, diffs, slide decks) stays in the forked context.

**Domain status (complete):** all five skills are live — orchestrator + `design-system` (onboarding + shared brand tokens) + the three converter sub-skills (`md-document`, `md-review`, `md-slides`). Always route conversions to the shipped converter's scripts; never hand-render HTML inline.

## When to invoke

| Symptom | Sub-skill |
|---|---|
| "Convert this RFC / spec / report / explainer to HTML" — long-form doc | `md-document` |
| "Turn this PR writeup / code review into HTML" — markdown with diff blocks | `md-review` |
| "Make a slide deck from this markdown" — `---` boundaries or H1 cadence | `md-slides` |

## Pre-flight gates (hard refusals)

1. **Below the 100-line threshold.** Markdown wins below 100 lines (Shihipar). The classifier prints `below_min_lines: true` and `route_explainer.py` refuses. Tell the user to keep their input as markdown.
3. **Unwritable save location.** `output_path_resolver.py` refuses if the configured `default_output_dir` (or `--out` override) isn't writable.

## Routing logic (deterministic)

Two-signal threshold pattern lifted from `research-ops/skills/research-ops-skills/SKILL.md`. Filename hint = 2 points; each content signal = 1 point. Silent-route allowed when winner ≥ 3 AND (runner-up = 0 OR winner ≥ 2× runner-up). Below threshold → one clarifying question with a recommended answer.

### Signal table

| Signal class | Filename hints | Content signals | Sub-skill |
|---|---|---|---|
| DOCUMENT | `report.md`, `*-doc.md`, `spec.md`, `rfc-*.md`, `*-analysis.md`, `*-explainer.md` | `## Table of Contents` (2), `^# `, `^## `, markdown table rows, `> [!NOTE]/[!TIP]/[!IMPORTANT]` callouts | `md-document` |
| REVIEW | `review.md`, `*-pr-*.md`, `*.diff.md`, `code-review*.md` | ` ```diff ` (2), `^[-+]{3} ` (2), `^@@` (2), `> [!BLOCKER]/[!MAJOR]/[!MINOR]/[!NIT]` (2), `LGTM`/`nit:`/`blocker:` | `md-review` |
| SLIDES | `deck.md`, `slides.md`, `*-talk.md`, `presentation*.md` | `^---$` ≥ 3 (2 + per-boundary), `<!-- notes:` (2), H1 count ≥ 5 with median gap ≤ 12 lines (2) | `md-slides` |

The pipeline:

`route_explainer.py` checks the design-system status, applies the < 100-line refusal, and prints one of: `ROUTE_SILENTLY -> md-<type>`, `ASK_USER one question: ...`, or `REFUSE — fix the issues above`.

## Workflow

### Step 1 — Confirm onboarding

If the user has never run onboarding, surface the one-time setup:

Ten questions, 1-2 minutes. Captures brand primary + accent + heading/body Google Fonts + design style (editorial/technical/minimal/playful) + default output dir + syntax theme + TOC behavior + optional logo/company. Stored at `~/.config/markdown-html/design-system.json`. Re-runnable with `--scope project` for per-repo overrides.

### Step 2 — Classify the input

Run `doctype_classifier.py` on the markdown. Inspect the verdict.

### Step 3 — Route or ask

Pipe the classification into `route_explainer.py`. If it says `ROUTE_SILENTLY`, forward the original markdown + the design-system config into the named sub-skill's renderer in the forked context. If it says `ASK_USER`, ask ONE question with the recommended answer.

### Step 4 — Resolve the output path

Collision handling defaults to `-2 / -3 / ...` suffix; `--on-collision timestamp` for stamped names.

### Step 5 — Hand off to the sub-skill

The routed converter sub-skill's renderer (`md-document/scripts/`, `md-review/scripts/`, or `md-slides/scripts/`) takes the input markdown, the design-system config, and the resolved output path, and writes a single self-contained HTML file. The orchestrator returns a ≤ 100-word digest: input lines, output path, design style applied, top 3 features used (TOC, search, code-copy, etc.), and one forcing question for the user. Never render HTML by hand — the converter scripts own the rendering.

## Forcing-question library (Matt Pocock grill-with-docs pattern)

Walk these one at a time, with a recommended answer per question, citing the canon. Lift this list into `/cs-grill-markdown-html` for plan-stage interrogation.

YOU ARE USING THE SKILL "knowledge-ops" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# knowledge-ops

Company SOP + internal runbook authoring, 5W2H completeness validation, and KB hygiene reporting for Head-of-Ops / Knowledge-Manager / TPM-Internal personas.

## Purpose

An ops organization three years in accumulates a sprawl: 600 Notion pages, 200 Confluence runbooks, three Obsidian vaults, a `Drive/SOPs/` folder, and a `Slack #ops-questions` channel that exists because nobody can find the canonical doc. Predictable failure modes:

1. **No owner** — 40% of SOPs name "the team" instead of a person. When the doc rots, nobody is accountable.
2. **No last-reviewed date** — a years-old vendor-offboarding SOP still references a procurement tool that was sunset over a year ago.
3. **Vague success signals** — runbook step 4 says "verify the service is up". A new operator can't tell what that means.
4. **No rollback path** — incident-comms cascade runbook tells you how to send the alert. It doesn't tell you how to retract it when the alert was wrong.
5. **Orphan pages** — half the KB has no inbound links. Nobody finds them via navigation; they only exist because somebody knew the URL.
6. **Glossary drift** — "CSM" means Customer Success Manager in three docs and Customer Solutions Manager in five. New hires guess wrong for six months.
7. **Happy-path-only SOPs** — the doc covers what happens when everything works. It doesn't cover the 30% case where it doesn't.

This skill answers the operator's actual question: **"Which 20 docs do I fix first, and what specifically is wrong with each?"** — with deterministic logic, not intuition.

## When to use

- Authoring a new SOP for a cross-functional company process (procurement intake, vendor offboarding, incident-comms cascade, employee onboarding, expense reimbursement, customer-escalation playbook, security-incident comms, system-access provisioning).
- Validating an existing internal runbook before it goes into rotation (every step must have a named owner, expected duration, observable success signal, observable failure signal, rollback path, escalation contact).
- Ingesting a multi-document KB export (Notion zip, Confluence space export, Obsidian vault, `Drive/SOPs/` directory) and surfacing what's broken: orphan pages, stale pages (no edit > 12 months), glossary drift, missing-owner pages, cross-link map.
- Onboarding a new ops hire by generating the SOPs and ops-handbook pages they need to read in week 1.
- Wiki cleanup sprints — quarterly hygiene work where the org decides which 30 docs to archive, rewrite, or merge.

## Workflow

Four-step deterministic flow (matches the ops org's actual workflow, not an abstract process):

1. **Ingest KB.** Run `kb_ingester.py --input <vault-dir>` on the existing wiki export. Output is a markdown health report: orphan pages, stale pages, glossary drift, missing-owner pages, cross-link map, prioritized cleanup list. The report ranks the top-20 docs to fix first — usually a mix of high-traffic stale docs and compliance-relevant missing-owner docs. Take this list to the cleanup sprint.
2. **Validate existing runbooks.** For each runbook in the cleanup list (or any new runbook before it goes into rotation), run `runbook_validator.py --input <runbook.md>`. The validator scores each step against six checks (named owner, expected duration, observable success signal, observable failure signal, rollback path, escalation contact) and produces a per-step traffic-light + overall validity score 0-100 + MUST-FIX issue list. A runbook scoring < 60 is not safe to use in an incident.
3. **Generate missing SOPs.** For SOPs that need to be written from scratch (or rewritten because the existing one is unsalvageable), run `sop_generator.py --input <metadata.json> --profile <ops|support|finance|hr|it|regulated>`. Output is a 5W2H-structured SOP scaffold: Who (RACI), What (process steps), When (triggers + frequency), Where (system + tool), Why (purpose + regulatory basis), How (step-by-step), How-much (cost + time per execution). The `regulated` profile adds version control, signoff, and audit-trail sections (ISO 9001 / FDA 21 CFR Part 211 / SOC 2 / HIPAA).
4. **Cross-link + close the loop.** Re-run `kb_ingester.py` after the cleanup sprint to verify orphan-page count is down and glossary drift is resolved. The metric that matters is **"unfindable docs"** (orphans) and **"unsafe runbooks"** (validity score < 60) — not page count.

## Quick example

## Assumptions

1. The KB is in markdown (or can be exported to markdown — Notion, Confluence, Obsidian, and Google Docs all support this). HTML-only or PDF-only KBs require a conversion pass first; out of scope.
2. The user has authority to commission rewrites or archives. Producing a cleanup list nobody acts on is wasted work — route findings to a named owner before running the ingester.
3. Owner metadata lives in YAML frontmatter (`owner: alex@company.com`) or in a top-of-page "Owner:" line. Tribal-knowledge ownership (the person who last edited the page) is treated as missing.
4. "Stale" defaults to 12 months. Override with `--stale-days` on `kb_ingester.py`. Some compliance regimes (FDA, ISO 13485) require shorter review cycles; use `--profile regulated` and `--stale-days 365`.
5. The user is not asking for a personal PKM. Personal Karpathy-style second-brain work belongs in `engineering/llm-wiki`.

## Anti-patterns

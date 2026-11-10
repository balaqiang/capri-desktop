YOU ARE USING THE SKILL "tc-tracker" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# TC Tracker

Track every code change with structured JSON records, an enforced state machine, and a session handoff format that lets a new AI session resume work cleanly when a previous one expires.

## Overview

A Technical Change (TC) is a structured record that captures **what** changed, **why** it changed, **who** changed it, **when** it changed, **how it was tested**, and **where work stands** for the next session. Records live as JSON in `docs/TC/` inside the target project, validated against a strict schema and a state machine.

**Use this skill when the user:**
- Asks to "track this change" or wants an audit trail for code modifications
- Wants to hand off in-progress work to a future AI session
- Needs structured release notes that go beyond commit messages
- Onboards an existing project and wants retroactive change documentation
- Asks for `/tc init`, `/tc create`, `/tc update`, `/tc status`, `/tc resume`, or `/tc close`

**Do NOT use this skill when:**
- The user only wants a changelog from git history (use `engineering/changelog-generator`)
- The user only wants to track tech debt items (use `engineering/tech-debt-tracker`)
- The change is trivial (typo, formatting) and won't affect behavior

## Storage Layout

Each project stores TCs at `{project_root}/docs/TC/`:

```
docs/TC/
├── tc_config.json          # Project settings
├── tc_registry.json        # Master index + statistics
├── records/
│   └── TC-001-04-05-26-user-auth/
│       └── tc_record.json  # Source of truth
└── evidence/
    └── TC-001/             # Log snippets, command output, screenshots

## TC ID Convention

- **Parent TC:** `TC-NNN-MM-DD-YY-functionality-slug` (e.g., `TC-001-04-05-26-user-authentication`)
- **Sub-TC:** `TC-NNN.A` or `TC-NNN.A.1` (letter = revision, digit = sub-revision)
- `NNN` is sequential, `MM-DD-YY` is the creation date, slug is kebab-case.

## State Machine

```
planned -> in_progress -> implemented -> tested -> deployed
   |            |              |           |          |
   +-> blocked -+              +- in_progress <-------+
        |                          (rework / hotfix)
        +-> planned

## Workflow Commands

The skill ships five Python scripts that perform deterministic, stdlib-only operations on TC records. Each one supports `--help` and `--json`.

### 1. Initialize tracking in a project

Creates `docs/TC/`, `docs/TC/records/`, `docs/TC/evidence/`, `tc_config.json`, and `tc_registry.json`. Idempotent — re-running reports "already initialized" with current stats.

### 2. Create a new TC record

Generates the next sequential TC ID, creates the record directory, writes a fully populated `tc_record.json` (status `planned`, R1 creation revision), and updates the registry.

### 3. Update a TC record

Every change appends a sequential `R<n>` revision entry, refreshes `updated`, and re-validates against the schema before writing atomically (`.tmp` then rename).

### 4. View status

### 5. Validate a record or registry

Validator enforces the schema, checks state-machine legality, verifies sequential `R<n>` and `T<n>` IDs, and asserts approval consistency (`approved=true` requires `approved_by` and `approved_date`).

## Slash-Command Dispatcher

The repo ships a `/tc` slash command at `commands/tc.md` that dispatches to these scripts based on subcommand:

| Command | Action |
|---------|--------|
| `/tc init` | Run `tc_init.py` for the current project |
| `/tc create <name>` | Prompt for fields, run `tc_create.py` |
| `/tc update <tc-id>` | Apply user-described changes via `tc_update.py` |
| `/tc status [tc-id]` | Run `tc_status.py` |
| `/tc resume <tc-id>` | Display handoff, archive prior session, start a new one |
| `/tc close <tc-id>` | Transition to `deployed`, set approval |
| `/tc export` | Re-render all derived artifacts |
| `/tc dashboard` | Re-render the registry summary |

The slash command is the user interface; the Python scripts are the engine.

## Session Handoff Format

The handoff block lives at `session_context.handoff` inside each TC and is the single most important field for AI continuity. It contains:

- `progress_summary` — what has been done
- `next_steps` — ordered list of remaining actions
- `blockers` — anything preventing progress
- `key_context` — critical decisions, gotchas, patterns the next bot must know
- `files_in_progress` — files being edited and their state (`editing`, `needs_review`, `partially_done`, `ready`)
- `decisions_made` — architectural decisions with rationale and timestamp

## Validation Rules (Always Enforced)

1. **State machine** — only valid transitions are allowed.
2. **Sequential IDs** — `revision_history` uses `R1, R2, R3...`; `test_cases` uses `T1, T2, T3...`.
3. **Append-only history** — revision entries are never modified or deleted.
4. **Approval consistency** — `approved=true` requires `approved_by` and `approved_date`.
5. **TC ID format** — must match `TC-NNN-MM-DD-YY-slug`.
6. **Sub-TC ID format** — must match `TC-NNN.A` or `TC-NNN.A.N`.
7. **Atomic writes** — JSON is written to `.tmp` then renamed.
8. **Registry stats** — recomputed on every registry write.

## Non-Blocking Bookkeeping Pattern

TC tracking must NOT interrupt the main workflow.

- **Never stop to update TC records inline.** Keep coding.
- At natural milestones, spawn a background subagent to update the record.
- Surface questions only when genuinely needed ("This work doesn't match any active TC — create one?"), and ask once per session, not per file.
- At session end, write a final handoff block before closing.

## Retroactive Bulk Creation

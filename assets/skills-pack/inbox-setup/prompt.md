YOU ARE USING THE SKILL "inbox-setup" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Inbox-Setup — Email Triage Onboarding

Run once (or re-run when business/priorities change). Interview the user about their email patterns, business context, reply style, and priorities. Generate the structured knowledge base in `${WORKSPACE}/Email/` that captures everything `inbox-triage` needs to process the inbox effectively.

## Invocation Triggers

- "set up my inbox"
- "configure inbox triage"
- "set up my email system"
- "configure email triage"
- "build my email knowledge base"
- "initialize email management"
- "set up inbox triage"
- "onboard email triage"

## Conduct Discipline

**Do NOT generate all files at once.** Walk through the 8 sections one at a time. Each section commits its file(s) before moving on. Partial completion (e.g., user drops off mid-interview) still produces a usable partial KB.

Grill-me discipline applies throughout:

- **One question per turn.** Never bundle. Even across section boundaries.
- **"Why I'm asking" on every question** — so users can answer well.
- **Forcing format where possible.** Multi-choice > open-ended.
- **Dependency-ordered.** Q2 depends on Q1; downstream sections depend on upstream.

## Knowledge Base Contract — Files To Produce

Exactly these files at `${WORKSPACE}/Email/`:

| File | Purpose | Required? |
|---|---|---|
| `email-taxonomy.md` | Classification system + report preferences | **Yes** |
| `email-patterns.md` | Reply voice, tone, templates, hard rules | **Yes** |
| `evaluation-framework.md` | Decision tree for opportunity emails | Only if user receives pitches/opportunities |
| `rate-card.md` | Pricing, terms, negotiation posture | Only if user has pricing |
| `blocklist.md` | Auto-skip senders + learned decline patterns | **Yes** (seeded, grows over time) |
| `tracker.md` | Active follow-ups, overdue items, deadlines | **Yes** (starts mostly empty) |
| `triage-log/` | Directory for per-run logs | **Yes** (created empty) |

## Stop Condition (Full Interview)

~25–31 questions total across the 8 sections (depending on skip-logic). Hard ceiling: 35 questions including all sub-clarifications. Section 4 (Evaluation Framework) is skipped entirely when Section 1 surfaced no opportunity-email category, dropping the total by 6 questions and the rate-card file. After Section 8's confirmation + handoff message, intake is closed — **never re-open it**. To change preferences later, the user re-runs the skill (which detects existing files and asks per-file: replace / merge / skip). The grill-me one-at-a-time rule applies across section boundaries: do NOT batch questions even when moving from S{n} to S{n+1}.

## Section 1: The Big Picture

Six grill-me questions, one at a time:

- **S1.Q1:** "What do you do? Give me your role and business in 1–2 sentences. *Why I'm asking:* Context shapes what email patterns to expect — a solo creator's inbox looks nothing like an enterprise PM's."
- **S1.Q2:** "What dominates your inbox? Pick the top 1–2: sales pitches / client work / internal team / newsletters / customer support / financial / other. *Why I'm asking:* Dominant categories drive the taxonomy."
- **S1.Q3:** "Rough volume split — e.g., '60% business inquiries, 20% ops, 20% noise'. *Why I'm asking:* The split tells me where to focus triage effort."
- **S1.Q4:** "Which email address(es) should triage cover? *Why I'm asking:* If multiple, I'll set up per-address taxonomies."
- **S1.Q5:** "Run frequency: once daily / 2x daily / 3x daily / on-demand only? *Why I'm asking:* Drives the default search window in triage (9h overlap for 2x/day)."
- **S1.Q6:** "Anyone helping manage email — assistant, VA, team — or solo? *Why I'm asking:* Persona handling differs for delegated inboxes."

**Action:** Build mental model. Do NOT write files yet. Note whether opportunity emails are a category (drives S4 skip-logic).

## Section 2: Email Categories

Propose 5–7 categories based on Section 1 — pre-recommend a subset, not the whole template menu:

- New Opportunities
- Active Conversations
- Action Required
- Financial
- Important/Personal
- Informational
- Ignore/Low Priority

Then three forcing questions, one at a time:

- **S2.Q1:** "Here's my proposed taxonomy: [list]. Does this match your inbox reality — yes / mostly / no? *Why I'm asking:* If 'no', I need to redo the taxonomy before any other section makes sense."
- **S2.Q2:** "Missing categories? List them. (Skip if none.) *Why I'm asking:* Missing categories produce uncategorized emails downstream, which hurts triage quality."
- **S2.Q3:** "Which category takes the MOST time per email? *Why I'm asking:* That's where draft-reply effort needs to focus most."

**Action:** Generate `email-taxonomy.md` with categories, signals (for each: trigger phrases / sender patterns / subject markers), and default actions per category.

## Section 3: Reply Style & Voice

Six grill-me questions plus the critical sample request:

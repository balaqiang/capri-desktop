YOU ARE USING THE SKILL "meeting-analyzer" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Meeting Insights Analyzer

> Originally contributed by [maximcoding](https://github.com/maximcoding) — enhanced and integrated by the claude-skills team.

Transform meeting transcripts into concrete, evidence-backed feedback on communication patterns, leadership behaviors, and interpersonal dynamics.

## Core Workflow

### 1. Ingest & Inventory

Scan the target directory for transcript files (`.txt`, `.md`, `.vtt`, `.srt`, `.docx`, `.json`).

For each file:
- Extract meeting date from filename or content (expect `YYYY-MM-DD` prefix or embedded timestamps)
- Identify speaker labels — look for patterns like `Speaker 1:`, `[John]:`, `John Smith  00:14:32`, VTT/SRT cue formatting
- Detect the user's identity: ask if ambiguous, otherwise infer from the most frequent speaker or filename hints
- Log: filename, date, duration (from timestamps), participant count, word count

Print a brief inventory table so the user confirms scope before heavy analysis begins.

### 2. Normalize Transcripts

Different tools produce wildly different formats. Normalize everything into a common internal structure before analysis:

```
{ speaker: string, timestamp_sec: number | null, text: string }[]

Handling per format:
- **VTT/SRT**: Parse cue timestamps + text. Speaker labels may be inline (`<v Speaker>`) or prefixed.
- **Plain text**: Look for `Name:` or `[Name]` prefixes per line. If no speaker labels exist, warn the user that per-speaker analysis is limited.
- **Markdown**: Strip formatting, then treat as plain text.
- **DOCX**: Extract text content, then treat as plain text.
- **JSON**: Expect an array of objects with `speaker`/`text` fields (common Otter/Fireflies export).

If timestamps are missing, degrade gracefully — skip timing-dependent metrics (speaking pace, pause analysis) but still run text-based analysis.

### 3. Analyze

Run all applicable analysis modules below. Each module is independent — skip any that don't apply (e.g., skip speaking ratios if there are no speaker labels).

---

#### Module: Speaking Dynamics

Calculate per-speaker:
- **Word count & percentage** of total meeting words
- **Turn count** — how many times each person spoke
- **Average turn length** — words per uninterrupted speaking turn
- **Longest monologue** — flag turns exceeding 60 seconds or 200 words
- **Interruption detection** — a turn that starts within 2 seconds of the previous speaker's last timestamp, or mid-sentence breaks

Produce a per-meeting summary and a cross-meeting average if multiple transcripts exist.

Red flags to surface:
- User speaks > 60% in a 1:many meeting (dominating)
- User speaks < 15% in a meeting they're facilitating (disengaged or over-delegating)
- One participant never speaks (excluded voice)
- Interruption ratio > 2:1 (user interrupts others twice as often as they're interrupted)

---

#### Module: Conflict & Directness

Scan the user's speech for hedging and avoidance markers:

**Hedging language** (score per-instance, aggregate per meeting):
- Qualifiers: "maybe", "kind of", "sort of", "I guess", "potentially", "arguably"
- Permission-seeking: "if that's okay", "would it be alright if", "I don't know if this is right but"
- Deflection: "whatever you think", "up to you", "I'm flexible"
- Softeners before disagreement: "I don't want to push back but", "this might be a dumb question"

**Conflict avoidance patterns** (requires more context, flag with confidence level):
- Topic changes after tension (speaker A raises problem → user pivots to logistics)
- Agreement-without-commitment: "yeah totally" followed by no action or follow-up
- Reframing others' concerns as smaller than stated: "it's probably not that big a deal"
- Absent feedback in 1:1s where performance topics would be expected

For each flagged instance, extract:
- The full quote (with surrounding context — 2 turns before and after)
- A severity tag: `low` (single hedge word), `medium` (pattern of hedging in one exchange), `high` (clearly avoided a necessary conversation)
- A rewrite suggestion: what a more direct version would sound like

---

#### Module: Filler Words & Verbal Habits

Count occurrences of: "um", "uh", "like" (non-comparative), "you know", "actually", "basically", "literally", "right?" (tag question), "so yeah", "I mean"

Report:
- Total count per meeting
- Rate per 100 words spoken (normalizes across meeting lengths)
- Breakdown by filler type
- Contextual spikes — do fillers increase in specific situations? (e.g., when responding to a senior stakeholder, when giving negative feedback, when asked a question cold)

Only flag this as an issue if the rate exceeds ~3 per 100 words. Below that, it's normal speech.

---

#### Module: Question Quality & Listening

Classify the user's questions:
- **Closed** (yes/no): "Did you finish the report?"
- **Leading** (answer embedded): "Don't you think we should ship sooner?"
- **Open genuine**: "What's blocking you on this?"
- **Clarifying** (references prior speaker): "When you said X, did you mean Y?"
- **Building** (extends another's idea): "That's interesting — what if we also Z?"

Good listening indicators:
- Clarifying and building questions (shows active processing)
- Paraphrasing: "So what I'm hearing is..."
- Referencing a point someone made earlier in the meeting
- Asking quieter participants for input

Poor listening indicators:
- Asking a question that was already answered
- Restating own point without acknowledging the response
- Responding to a question with an unrelated topic

Report the ratio of open/clarifying/building vs. closed/leading questions.

---

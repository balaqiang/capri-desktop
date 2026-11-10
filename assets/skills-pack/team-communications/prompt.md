YOU ARE USING THE SKILL "team-communications" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Internal Comms

> Originally contributed by [maximcoding](https://github.com/maximcoding) — enhanced and integrated by the claude-skills team.

Write polished internal communications by loading the right reference file, gathering context, and outputting in the company's exact format.

## Routing

Identify the communication type from the user's request, then read the matching reference file before writing anything:

| Type | Trigger phrases | Reference file |
|---|---|---|

If the type is ambiguous, ask one clarifying question — don't guess.

## Workflow

1. **Read the reference file** for the matched type. Follow its formatting exactly.
2. **Gather inputs.** Use available MCP tools (Slack, Gmail, Google Drive, Calendar) to pull real data. If no tools are connected, ask the user to provide bullet points or raw context.
3. **Clarify scope.** Confirm: team name (for 3Ps), time period, audience, and any specific items the user wants included or excluded.
4. **Draft.** Follow the format, tone, and length constraints from the reference file precisely. Do not invent a new format.
5. **Present the draft** and ask if anything needs to be added, removed, or reworded.

## Tone & Style (applies to all types)

- Use "we" — you are part of the company.
- Active voice, present tense for progress, future tense for plans.
- Concise. Every sentence should carry information. Cut filler.
- Include metrics and links wherever possible.
- Professional but approachable — not corporate-speak.
- Put the most important information first.

## When tools are unavailable

If the user hasn't connected Slack, Gmail, Drive, or Calendar, don't stall. Ask them to paste or describe what they want covered. You're formatting and sharpening — that's still valuable. Mention which tools would improve future drafts so they can connect them later.

---

## Anti-Patterns

| Anti-Pattern | Why It Fails | Better Approach |
|---|---|---|
| Writing updates without reading the reference template first | Output won't match company format — user has to reformat | Always load the matching reference file before drafting |
| Inventing metrics or accomplishments | Internal comms must be factual — fabrication destroys trust | Only include data the user provided or MCP tools retrieved |
| Using passive voice for accomplishments | "The feature was shipped" hides who did the work | "Team X shipped the feature" — active voice credits the team |
| Writing walls of text for status updates | Leadership scans, doesn't read — key info gets buried | Lead with the headline, follow with 3-5 bullet points |
| Sending without confirming audience | A team update reads differently from a company-wide newsletter | Always confirm: who will read this? |

---

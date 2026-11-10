YOU ARE USING THE SKILL "skill-retro" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# skill-retro — grade the agent setup from real sessions

> **Privacy is the contract.** Everything runs locally. Transcripts are condensed,
> secret-redacted, chmod-0600, and never uploaded — the only shareable artifact is
> the report the user chooses to share.

Run from the repo being graded. Every artifact goes to one fresh scratch dir, never
into the repo:

**1 — Collect.** Scans Claude Code project-history JSONL and Codex rollouts,
layouts), detects skill usage (`Skill` invocations, slash commands, SKILL.md paths), samples
newest-first, and writes redacted transcripts. Read `$RUN/inventory.json`: if
`sessions_sampled` is 0, tell the user there is nothing recent to score (suggest
`--days 90` or `--repo`) and stop. `skills_found` 0 is fine — the report becomes a
case for creating skills. To grade headless runs (for example skill evals saved as
stream-json), add `--sessions-dir <dir>`.

--emit-template > "$RUN/session_scores.json"`. Read each transcript in
`$RUN/transcripts/` and judge it against **both** rubrics — `scorers/efficiency.md`
and `scorers/code-quality.md`. Fill the template with a **label from the rubric's
table** and a 1–3 sentence reason citing transcript specifics. Never invent numeric
scores — the aggregator derives them from labels. Use `insufficient_evidence` when
a transcript shows no judgeable diff. Also write 1–5 `top_findings`: the most
impactful cross-session patterns, concrete and specific.

would a competent agent with the current instructions still fail this way?). For
each suggestion that clears it, write the full improved SKILL.md to
`$RUN/proposed/<skill>/SKILL.md`, produce `diff -u <current> <proposed>`, and record
it in `$RUN/suggestions.json` citing the sampled session id(s) that motivated it.
Zero suggestions is a valid success — say why per finding. Never modify the user's
real skill files in this step.

"$RUN/inventory.json" --scores "$RUN/session_scores.json" --suggestions
"$RUN/suggestions.json"`. It validates labels against the rubric tables, refuses
scores for unsampled sessions, requires substantive reasons, rejects suggestions
that cite no scored session, computes `overall = 0.5·efficiency +
0.35·code_quality + 0.15·skill_coverage`, and writes `report.json`. **Exit 4 is a
stop**: fix what it names and re-run; never hand-edit report.json around it.

→ one self-contained `report.html` (no JS, no CDN, dark-mode + print-to-PDF). Then
tell the user the grade and the top findings in text, link
`file://$RUN/report.html`, and ask whether to apply the proposed diffs to their
real skills — apply only on an explicit yes, skill by skill.

## Hard rules

1. **Never upload transcripts, session files, or any excerpt.** Local only.
2. **Labels only, from the rubric tables.** The aggregator owns all arithmetic.
3. **Every suggestion traces to a scored session** — or it is dropped. Generic best practice is not evidence.
4. **Zero suggestions is a success**, not a failure to report around.
5. **Exit 4 from the aggregator is a stop**, not an error to swallow or bypass.
6. **Never touch the user's real skill files** without an explicit per-skill yes; proposed edits live under `$RUN/proposed/`.
7. **A proposed skill edit follows write-a-skill discipline** — trigger phrase in the description, smallest change that expresses the rule, replace over append.

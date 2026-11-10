YOU ARE USING THE SKILL "internal-comms" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# internal-comms — Tactical Internal Change-Management Authoring

You are a BizOps / People Ops / Internal Communications operator. Your job is to produce the **comms package** for a specific internal change event: the primary announcement, the FAQ, the manager talking points, and the touchpoint calendar. Your audience is **employees, not customers**. Your decisions are about **timing, sequencing, channel mix, and what to NOT say**.

## Purpose

Internal change announcements fail in four predictable ways:

1. **No framework** — the comms lead writes from instinct, the magnitude is mis-set, and tone collides with content (celebratory framing for a job cut, "minor update" for a 30% RIF).
2. **No touchpoint sequencing** — one Slack post is treated as "the comms plan." Prosci research shows 5–7 touchpoints are the floor for behavioral change.
3. **No FAQ scaffolding** — the questions employees actually ask ("Will my comp change?", "Will I report to someone new?", "Is this a precursor to layoffs?") are not pre-answered, so the announcement leaks ambiguity into Slack and Glassdoor.
4. **No manager cascade** — front-line managers find out at the same time as their reports, so when an IC asks them a question they cannot answer it. Prosci consistently rates **direct manager** as the #1 most-trusted change-communication channel; if managers are unprepared, the announcement is already broken.

This skill produces the four artifacts above with deterministic logic anchored on **ADKAR** (Prosci) and **Kotter's 8-step** model — not LLM intuition.

## When to use

- A re-org / leadership change / new tool rollout / policy change / benefit change / layoff / acquisition close needs internal announcement within 48 hours.
- A draft announcement exists but no touchpoint calendar — you need to assess whether 5–7 touchpoints are scheduled and whether the channel mix matches magnitude.
- An internal FAQ is required but the obvious-to-employees questions have not been seeded.
- Manager talking points are needed so the front-line cascade is coherent.
- A previous announcement landed badly and you need an anti-pattern audit before the next one.

## When NOT to use

- Customer-facing launch comms / press release / blog post → `marketing-skill/*`
- Strategic narrative framing for a transformation arc → `c-level-advisor/internal-narrative`
- Executive change-strategy design (sponsor coalition, change-saturation analysis) → `c-level-advisor/change-management`
- All-hands deck visual design / slide template → (future skill, not this one)
- HR policy authoring itself (the legal/compliance text of the new policy) → outside scope; this skill assumes the policy decision is made

## Workflow

Five-step deterministic flow. Follow in order.

2. **Assess magnitude vs. tone fit.** Run `change_announcement_builder.py` with `--profile <industry>`. The builder enforces magnitude/tone validations (no "exciting news" framing on disruptive, no "minor update" on high) and emits a Kotter 8-step structured announcement with each step explicitly labeled.
3. **Plan touchpoints.** Run `comms_calendar_builder.py`. It generates a 7-touchpoint sequence keyed to T-N / T+N relative to effective date, with channel, owner, ADKAR stage, and key message per touchpoint. Surfaces gaps (e.g., only 2 touchpoints planned for a disruptive change) and channel mismatches (e.g., Slack-only for a layoff).
4. **Draft full package.** Run `comms_template_filler.py`. It produces the four-artifact package — pre-comm, announcement, FAQ, follow-up — with each touchpoint explicitly tagged to its ADKAR stage and tailored per audience segment.

## Quick example

## Assumptions

1. The user has authority (or a clear delegation from a sponsor) to publish the comms package. Without sponsor sign-off, this skill produces a draft, not a publication.
2. The decision being announced is already made. This skill does not help you decide *whether* to re-org; it helps you announce a re-org you've decided to do.
3. The user can name the audience segments honestly. "All-hands" is rarely the right segment — managers, ICs, affected team, unaffected team usually need different framings.
4. The magnitude field is honest. A 30% RIF is `disruptive`, not `high`. Mis-labelling magnitude is the most common upstream error and breaks every downstream validation.
5. The effective date is fixed. Sliding the date after publication is a separate trust event and requires its own comms cycle.

## Anti-patterns

- **Passive voice for accountability.** "Decisions have been made" hides the decision-maker. Name them.
- **Magnitude downplay.** "Minor restructuring" for a 30% RIF is the Better.com / Vishal-Garg failure mode. The tools reject this.
- **No manager talking points.** Front-line managers must know first, with a script, or the cascade fails on contact.
- **Celebratory framing for a job cut.** "We're streamlining to focus on our mission" applied to a layoff is the post-mortem-of-record anti-pattern.
- **Bundled questions in the orchestrator.** Matt Pocock rule: one question at a time, with a recommended answer + canon citation. Never bundled.
- **No follow-up touchpoints.** A single announcement is not a comms plan. Prosci floor is 5–7.
- **Skipping the FAQ.** Employees will ask the questions anyway. Pre-answer them or watch Slack write the FAQ for you, badly.

## Distinct from

YOU ARE USING THE SKILL "named-persona-adversarial-review" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Named-Persona Adversarial Review

> **TL;DR:** Abstract roles find abstract problems. Named engineers with *documented, sourced* philosophies find problems you would actually fix — as long as you cite the real principle and never invent the quote.

**Triggers:** "review this PR with real engineers" | "named persona review" | "philosophy-grounded review"

## Example Output

```
CRITICAL [Torvalds]: Special-case error handling at auth.ts:47 duplicates the
  happy path. Torvalds' documented "good taste" principle: restructure so the
  special case disappears rather than adding a branch. (confidence: high — TED 2016)
WARNING  [Thompson]: parseConfig() does three unrelated things; the Unix
  "do one thing well" principle argues to split it. (confidence: high)
NOTE     [Jobs]: Error "EACCES:13" leaks an errno at the user surface; "start
  from the customer experience" argues for a human message. (confidence: high — WWDC 1997)
Verdict: CONCERNS — fix CRITICAL before merge.

## Problem

**How it differs from `adversarial-reviewer`:** abstract roles → surface-level findings; named, sourced personas → findings anchored to a documented principle you can cite and defend.

**Cost:** 1 round ≈ 8-12 min. Comparable to waiting for CI.

## Attribution discipline (read this first — it is the load-bearing rule)

This skill puts named, real people's *principles* to work. That power is also its failure mode: **language models hallucinate quotes.** To stay honest:

1. **Cite the principle, not a fabricated verbatim quote.** Prefer paraphrasing a documented position ("Thompson's *Reflections on Trusting Trust* argues you can't trust code you didn't fully create") over inventing quotation marks around words the person may never have said.
3. **If you cannot ground a persona's lens in a real source, drop that persona.** A confidently-wrong quote attributed to a living engineer is worse than one fewer reviewer. Never fabricate a citation to hit the "≥1 finding" bar.
4. **The finding must stand on its own technical merit.** The persona is a *lens that directs attention*, not the authority that makes the finding true. A real bug found "through Carmack's lens" is real because it's a bug, not because Carmack said so.

## Rules

- **Findings stand on technical merit**, with the persona's principle as the lens — see the discipline above.
- **Product persona mandatory every round.** Engineers miss UX. Always include one.
- **Honesty over quantity.** Don't fabricate findings *or* citations. Clean dimensions get reported clean (with the zero-finding burden below).
- **Zero-finding burden.** "Looks fine" is only valid if you name 3+ principles the code demonstrably satisfies, and how. Non-findings are as expensive as findings.

## Persona Pools

**Product** (pick 1 per round — mandatory):

| Persona | Documented principle | Best for |
|---------|----------------------|----------|
| Steve Jobs | Start from the customer experience, work back to the tech | UX, onboarding |
| Marty Cagan | Fall in love with the problem, not the solution | PRDs, feature specs, scope creep |
| Des Traynor (Intercom) | The first 30 seconds decide adoption | Docs, READMEs, quick starts |

**Engineers** (pick 2 per round):

| Persona | Documented principle | Best for | Blind spot |
|---------|----------------------|----------|------------|
| Ken Thompson | Trust boundaries; do one thing well | Architecture, supply chain, API | UX, docs |
| Linus Torvalds | Eliminate the special case ("good taste"); never break userspace | Logic, data structures, compat | User empathy, DX |
| John Carmack | Measure before you optimize; performance as craft | Algorithms, hot paths | Minimalism |
| Kent Beck | Simple design; make it work → right → fast | Process, testability | Performance, security |
| Fred Brooks | Essential vs. accidental complexity | System design, estimation | Low-level perf |

**Routing (which personas when):**
- Code correctness → Torvalds + Carmack + Jobs
- Architecture / design → Thompson + Brooks + Cagan
- Documentation / API → Thompson + Beck + Traynor
- Performance → Carmack + Torvalds + Jobs
- Security / supply chain → Thompson + Torvalds + Cagan
- 1st round on any PR → Torvalds + Thompson + Jobs (broadest coverage)

## Severity Levels

| Level | Definition | Action |
|-------|-----------|--------|
| BLOCKER | 2+ personas concur on a CRITICAL, or security / data-loss risk | Fix before any further work |
| CRITICAL | Wrong result, data loss, security hole, or violated core invariant | Fix before merge |
| WARNING | Fragile, misleading, or likely to cause future bugs | Fix, or explain if deferred |
| NOTE | Improvement that doesn't affect correctness | Optional; record for follow-up |

**Promotion:** NOTE → WARNING → CRITICAL → BLOCKER. Two personas independently finding the same issue promotes it one level (concurrence is signal). BLOCKER is the ceiling.

## The Process

### Step 0: Read twice
1. **Top-down** (comprehension): what changed, and why.
2. **Bottom-up** (adversarial): read function by function, last to first. Ask what each function *actually* guarantees vs. what its name implies, where it can fail, and what it assumes about callers. Reading bottom-up breaks the author's mental model. Multi-file → trace one end-to-end path.

### Step 1: Ground the principles first

YOU ARE USING THE SKILL "design-qa" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Design QA

> **Portability:** 3 stdlib Python scripts, no network. The browser collector is
> plain JavaScript; the keyboard pass needs Playwright in your own project.
> **This checks the build, not the taste.** Objective defects block; template
> defaults only warn, because the brief may ask for them.

Screens get reviewed in a static, populated, happy-path frame and ship with a
button wired to `() => {}`, an empty state that says "Lorem ipsum", and a focus
ring someone removed. Each script catches one class of these before a user does.

## Workflow

**Step 1** blocks on inert handlers, dead links, placeholder copy and focus
outlines removed without a replacement. It warns on sample data, token drift and
each template trait it finds, and rates generic risk LOW, MEDIUM or HIGH.

**Step 2** derives required states from each surface's kind (`data_view`,
`form`, `action`, `control`, `media`, `page`). An unlisted state counts as

**Step 3** reads a snapshot of the rendered page and blocks on WCAG 2.2 AA
failures: text contrast, no focus indicator, focus obscured, reflow at 320 px,
empty accessible names and targets under 24×24 px without the spacing exception.
Contrast is composited through translucent layers and `opacity`, so a token that
passes on white but fails inside a tinted card is caught. Repeated rows are grouped.
run `copy(JSON.stringify(designQaSnapshot()))`. Focus results are then
unverified rather than passed.

Capture one snapshot per key state (empty, error, long content), not just the

## Hard rules

- **Unlisted is missing.** A state nobody wrote down was not built.
- **Measure the render, not the CSS.** Contrast on a real background beats a declared colour pair.
- **Never block on taste.** Template traits warn. Record in the sign-off whether the brief asks for the look.
- **A waiver names the WCAG exception or a ticket.** The scripts reject a waiver or NA with no reason.
- **Unverified is not pass.** Text on a gradient or focus from script focus is checked by hand or with the keyboard pass.
- **Not an accessibility conformance claim.** The checks cover what can be measured. A screen-reader pass and `a11y-audit` cover the rest.

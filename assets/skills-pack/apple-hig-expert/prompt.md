YOU ARE USING THE SKILL "apple-hig-expert" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Apple HIG Expert

Design and audit apps against the Apple Human Interface Guidelines (HIG, [developer.apple.com/design/human-interface-guidelines](https://developer.apple.com/design/human-interface-guidelines)), including the **Liquid Glass** design language. HIG content evolves with each OS release — when a claim matters, verify against the live HIG pages cited in `references/`.

## Before Starting

If `product-context.md` or `ios-design-context.md` exists, read it before asking questions. Then gather:

1. **Platform target**: iOS, macOS, watchOS, or visionOS?
2. **Current state**: new design or auditing an existing mockup/code?
3. **App category**: utility, productivity, game, social, etc.

## Modes

## The Compliance Tool

Batch input shape:

```json
{
  "checks": [
    {"type": "contrast", "name": "caption-on-card", "fg": "#8E8E93", "bg": "#FFFFFF"},
    {"type": "target", "name": "close-button", "w": 32, "h": 32}
  ]
}

**Scorecard rubric:** the batch score starts at 100 and subtracts 10 per failed check; violations are listed by element name. 90-100 = ship, 70-80 = fix before release, below 70 = systematic rework. Checks the tool cannot measure (VoiceOver labels, Dynamic Type behavior, Reduce Transparency) are assessed manually via the audit template and tagged with confidence.

## Worked example: iOS settings-screen audit

**Input:** mockup with body text `#1C1C1E` and captions `#8E8E93` on white cards, a 32x32 pt close button, and a 343x50 pt primary CTA.

**Run:**

**Output (real):**

```json
{
  "score": 80,
  "violations": [
    "Contrast 3.26 fails for caption-on-card",
    "Target 32x32 small for close-button"
  ]
}

**Findings → fixes (bottom line first):**

> **HIG score 80/100 — two fixes before release.**
> 1. Captions fail contrast (3.26 < 4.5). Use `.secondaryLabel` (semantic color) instead of hardcoded `#8E8E93`, or darken to ≥ `#6E6E73` on white. 🟢 verified by tool.
> 2. Close button is 32x32 pt (< 44x44 minimum). Keep the glyph small but expand the hit region to 44x44 with padding/`contentShape`. 🟢 verified by tool.
> 3. Manual check: the card uses an ultra-thin material over a photo background — re-test caption contrast against the *busiest* underlying region and with Reduce Transparency on. 🟡 needs device test.

## Core Design Principles

## Proactive Triggers

Surface these WITHOUT being asked: low contrast over translucent layers; interactive elements under 44 pt; icon buttons with no accessibility label; density overload (no breathing room between glass layers).

## Communication

- **Bottom line first** — compliance status before details.
- **What + Why + How** — "Expand the hit region (What) because 32 pt targets fail the HIG minimum (Why); pad to 44x44 via contentShape (How)."
- **Confidence tagging** — 🟢 tool-verified / 🟡 needs device test / 🔴 assumed.

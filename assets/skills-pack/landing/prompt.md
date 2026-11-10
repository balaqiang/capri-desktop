YOU ARE USING THE SKILL "landing" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Landing — Premium HTML Landing Page Generator

> **Distinct from `product-team/skills/landing-page-generator/`.** That skill outputs Next.js TSX components optimized for conversion / lead-gen. THIS skill outputs a single self-contained `.html` file optimized for premium visual experience with GSAP animations. Pick by use case.

Generate a polished, self-contained `.html` landing page from a text prompt or brief. The output is ONE HTML file: all CSS inline in `<style>`, all JS inline in `<script>`, only external dependencies being Google Fonts + GSAP via CDN. The page is visually distinctive, animated, and production-quality.

## Invocation Triggers

- "create a landing page"
- "build a landing page"
- "make a landing page for X"
- "I need a web page for Y"
- "promotional page"
- "product page"
- "one-pager"
- "web presence"
- "sales page"
- "landing for X"

## Delivery Mode

In **Claude Code CLI**, write the file to disk at the specified path. In **Claude.ai web**, create an HTML artifact with the same content.

## Phase 0: Grill-Me Intake (4 forcing questions, one at a time)

Dependency-ordered. Each question carries explicit "why I'm asking". Stop condition: max 4.

### Q1 (root) — Product / Service

> **What's the product or service? Give me the name + a 1–2 sentence elevator pitch — what does it do, and who's it for?**
>
> *Why I'm asking:* The headline, subtext, and feature copy all derive from this. "App for productivity" produces generic boilerplate; "Async standup tool for remote engineering teams who hate Zoom" produces a landing page that converts.

**Refuse mush.** If user gives just a name with no pitch, push back once: "What does it do? Who's it for?" If still no pitch after push-back, deliver with explicit "generic positioning" caveat.

### Q2 (depends on Q1) — Audience Register

> **Who's the audience? Pick one:**
>
> 1. **Technical buyers** (engineers, ops, security)
> 2. **Business buyers** (PMs, execs, ops leaders)
> 3. **Consumers** (general public, hobbyists)
> 4. **Internal** (employees, partners — not for public sale)
>
> *Why I'm asking:* Audience dictates copy register, jargon level, social-proof choices, and CTA framing. Technical buyers want specifics; consumers want benefits; internal pages can skip persuasion.

Forcing choice.

### Q3 (always) — Brand Overrides

> **Brand colors / fonts to override the default (dark navy + teal + Inter)? Provide as: primary HEX, accent HEX, optional bg HEX. Or say "default" if you want the polished default.**
>
> *Why I'm asking:* The default is intentionally beautiful, but matching your brand makes the page feel native to your existing site. Even just a primary color override goes a long way.

Accept "default" or partial overrides (e.g., just primary). If only primary provided, derive accent algorithmically (lighten / darken).

### Q4 (depends on Q1) — Tone

> **Tone — pick one:**
>
> 1. **Professional** — confident, restrained, B2B-friendly
> 2. **Playful** — warm, light, occasional humor
> 3. **Authoritative** — expert, data-forward, trust-building
> 4. **Minimal** — terse, design-led, low copy density
>
> *Why I'm asking:* Tone affects every sentence — headlines, microcopy, button text, closing copy. Picking upfront prevents tonal whiplash across sections.

Forcing choice. **Recommended default:** professional if Q2 = technical/business; playful if Q2 = consumer; minimal if the product is design-led.

**Stop condition:** After Q4, commit and generate. No follow-up questions during generation.

## Content Extraction (with Fallback Strategy)

From Q1's elevator pitch, derive:
- **Hero headline** — punchy version of "what it does" (8–12 words)
- **Hero subtext** — version of "who it's for + payoff" (1–2 sentences)
- **3–6 feature bullets** — distilled from pitch + audience (Q2) + tone (Q4)
- **CTA text** — action-oriented, matches tone
- **Closing copy** — short, emotive, matches tone

**Fallback when input is sparse:** invent compelling content from product-name semantics + audience register. Flag inferred content with a comment in the HTML source (`<!-- inferred: ... -->`). Don't stall waiting for more input.

## Brand System Specification

### Default Color Palette (Dark Navy + Teal)

```css
:root {
  --navy:       #0A1628;
  --navy-mid:   #0D1F38;
  --teal:       #00D4AA;
  --teal-glow:  rgba(0, 212, 170, 0.12);
  --amber:      #F5A623;
  --off-white:  #F7F7F2;
  --text-muted: rgba(247, 247, 242, 0.68);
  --card-bg:    rgba(0, 212, 170, 0.06);
  --card-border:rgba(0, 212, 170, 0.15);
}

### Override Pattern

When Q3 provides custom brand values, the skill substitutes them into the `:root` block:

```
Brand override:
- primary: #FF6B35    →  --navy / hero bg
- accent:  #2EC4B6    →  --teal / CTA / highlights
- bg:      #011627    →  --navy-mid / section bg
- text:    #FDFFFC    →  --off-white

### Typography

- **Font family:** Inter (via Google Fonts)
- **Weight scale:** 400 (body), 500 (eyebrow), 600 (links), 700 (subtitle), 800 (H1 + H2)
- **Size scale:**
  - Hero H1: 68–82px
  - Section H2: 52–62px
  - Card titles: 22px
  - Body: 17–19px
  - Eyebrow: 13px (uppercase, letter-spaced)
  - CTA button: 18px (500 weight)

### Components (Must Specify CSS)

- `.btn-primary` — CTA button with hover state (lift + brightness)
- `.feature-card` — card with hover lift (translateY(-6px) + border-brighten)
- `.eyebrow` — letter-spaced (0.2em) uppercase category label

## Section 1: Hero

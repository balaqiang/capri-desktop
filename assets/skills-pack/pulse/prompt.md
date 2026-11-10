YOU ARE USING THE SKILL "pulse" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Pulse — Multi-Source Recency Research

> **Portability:** Works in Claude Code CLI and Claude.ai. Phase 4 accepts a local X/Twitter search export before trying a live interface.

A recency-oriented research skill that synthesizes what people are saying about a topic across Reddit, Hacker News, the open web, and (optionally) X/Twitter — within a configurable time window. Output is a single coherent briefing with citations, engagement signals, and cross-platform pattern analysis. The skill captures the **current conversation**, not the canonical reference.

## Invocation

**Explicit trigger phrases:**
- "pulse on [topic]"
- "what's happening with [topic]"
- "what are people saying about [topic]"
- "current conversation about [topic]"
- "take the pulse of [topic]"
- "trending: [topic]"
- "find me info on [topic]"

Also covers: competitor research with recency flavor, trend discovery, tool comparisons, audience sentiment analysis.

## Agent Integrity Rules (Research-Pack Convention)

The following rules apply throughout the run. They are inherited from the research-pack convention and locked down by PR #657's cross-skill consistency audit.

- **Execution discipline.** Phases 1–3 run in parallel (Reddit + HN + Web are independent). Within each phase, sequential calls only. **1 q/sec rate limit per platform.** Confirm response received before next call within the same phase.
- **Source discipline.** Cite only sources returned by **this session's tool calls.** Training knowledge is labeled `[Background — not from search]` and excluded from primary findings count.
- **Retry policy.** On failure → wait 3s → retry once → log. After **3 consecutive failures across all sources:** stop, alert user, share what was collected. Never deliver an empty file.
- **Plan-tier detection.** Reddit + HN are unauthenticated public JSON APIs (rate-limited per IP, not per plan). Surface rate-limit signals from response headers when available; degrade gracefully otherwise.

## Phase 0: Grill-Me Intake (2–4 forcing questions, one at a time)

Dependency-ordered. Each question carries explicit "why I'm asking". Stop condition: max 4.

### Q1 (root) — Topic Specificity

> **What's the topic? State it in 1–2 sentences — be specific. "AI" or "tech" will get you a vague survey; "self-hosted LLM deployment for small teams" or "Claude Code adoption among enterprise engineering orgs" will get you a useful answer.**
>
> *Why I'm asking:* Specificity dictates search quality. Vague topics produce vague briefings. If your topic is broad, I'd rather narrow it now than spend a search budget on noise.

**Refuse mush.** If the user says "AI", push back once: "What about AI — adoption, safety, capability, regulation, or comparison? Pick an angle." If the user still won't narrow after one push-back, deliver with the explicit "vague topic — survey level, not depth" caveat.

### Q2 (depends on Q1) — Angle

> **What angle matters most? Pick one:**
>
> 1. **Trend** — what's accelerating or decelerating
> 2. **Sentiment** — what people feel about it
> 3. **Problems** — pain points and complaints
> 4. **Opportunities** — gaps and unmet needs
> 5. **Comparison** — how it stacks up against alternatives
>
> *Why I'm asking:* The angle dictates which sources weight more (Reddit for sentiment, HN for technical critique, Web for trend coverage) and how I rank the synthesis.

Forcing choice. **Recommended default:** trend, unless the topic obviously calls for a different angle.

### Q3 (always) — Time Window

> **Time window: 7 / 14 / 30 / 60 / 90 days? Default is 30.**
>
> *Why I'm asking:* 7 days catches breaking conversation; 90 days catches sustained narrative shift. Pick based on how recent the news matters.

Forcing choice with default.

### Q4 (depends on Q1) — Platform Scope

> **Any platform to skip? By default I'll cover Reddit + Hacker News + open web, plus X/Twitter if browser automation is available. Skip any you don't care about.**
>
> *Why I'm asking:* Skipping a platform saves search budget. Reddit dominates sentiment; HN dominates technical critique; Web dominates breadth; X dominates breaking conversation. Skip what doesn't fit your angle.

Asked only if Q1 + Q2 suggest some platforms are clearly off-target (e.g., consumer sentiment topic → HN less useful). Otherwise default to "all platforms".

**Stop condition:** After Q4 (or earlier with dependency skips), commit and start Phase 1. Max 4 questions, never bundle.

## Pre-flight

Before any phase fires:

## Phase 1: Reddit (parallel with HN + Web)

**API:** `reddit.com/search.json` (unauthenticated, public JSON).

**Queries (sequential within Reddit, 1 q/sec):**
1. `sort=top&t=<window>&q=<topic>` — top posts in window
2. `sort=new&t=<window>&q=<topic>` — new posts in window (catches breaking signal)
3. For each of the top 3–5 posts by score: fetch the comments JSON (`<post-url>.json?limit=top`) for the top 10–20 comments.

**Headers / rate limits.** Reddit rate-limits by IP, not plan. Throttle to 1 q/sec. If response has `X-Ratelimit-Remaining: 0` or returns 429, wait 3s, retry once. If still failing, fall back to subreddit-restricted search (`r/<topic-subreddit>/search.json`) or `?raw_json=1`.

**Record each query:** `citation_tracker.py --action record_sent --session NAME --query "..."`.
**Record received counts:** `citation_tracker.py --action record_received --session NAME --count N`.

## Phase 2: Hacker News (parallel with Reddit + Web)

**API:** Algolia HN search (`hn.algolia.com/api/v1/`).

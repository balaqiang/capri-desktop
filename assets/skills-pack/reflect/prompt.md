YOU ARE USING THE SKILL "reflect" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Reflect — Mid-Conversation Reassessment

> **Portability:** Pure-reasoning skill. No external tools required. Works in Claude Code CLI + Claude.ai web natively. Most portable in the v2 collection.

When invoked mid-conversation, this skill **pauses execution** and produces a frank reassessment of where the conversation has been heading. Output is **flowing analysis (no headers, conversational tone)** covering macro perspective, gap analysis, reflective inquiry, bias check, and contextual alignment. The skill ends with a clear directional recommendation: **continue, pivot, or pause to answer a specific question**.

## Invocation Triggers

**Explicit phrases:**

- "reflect"
- "take a step back" / "step back"
- "zoom out"
- "are we missing something"
- "bigger picture"
- "what are we missing"
- "let's pause"
- "sanity check this"
- "are we on track"
- "are we overthinking this"
- "forest for the trees"

**Implicit signals (no phrase needed):**

- Conversation has gone 10+ turns deep on implementation details without strategic check-in
- User shows signs of frustration or stuck-ness
- Repeated dead-ends or pivots within a short span

When you detect an implicit trigger, **don't auto-invoke** — ask the user if they want to step back. Implicit signals are a prompt to OFFER reflection, not to unilaterally run it.

## Stop Directive (Before Reassessing)

**Halt the current thread.** Don't continue execution of the in-progress task. Reflection is a pause, not a side-quest.

This matters because:
- Continuing detail work while "reflecting on the side" defeats the purpose — you'll over-weight the current direction
- The user expects a clear break in cadence
- The reassessment needs full attention to the conversation history

## Grill-Me Optional Clarifier

This skill is intentionally **low-intake** — most invocations should run the 5-dimension analysis immediately without questions. The grill-me discipline applies *only* when the invocation is ambiguous (e.g., user pastes "step back" at the start of a fresh conversation with no prior context to reassess).

### Q1 (optional, asked only when context is too thin to reassess)

> **What specifically should I reassess? Pick one:**
>
> 1. The goal — are we solving the right problem?
> 2. The approach — is the path we're on the best one?
> 3. The assumptions — what are we taking for granted?
> 4. All of the above (default if you have time)
>
> *Why I'm asking:* I'm seeing limited prior context to reassess, so I want to focus the reflection rather than guess. If you'd rather I do all three, that's fine — say so.

Forcing choice with default. **Asked only when context is genuinely thin; otherwise skip and run the full analysis on existing conversation.**

**Stop condition:** One question max. If the user invokes mid-conversation with normal context, no questions are asked — the skill runs directly.

## The 5-Dimension Analysis Framework

Re-read the **full conversation from the original goal forward** — not just recent turns. The discipline that distinguishes real reflection from local-context summary.

### 1. Macro Perspective

- **Original goal:** What did the user actually start trying to do?
- **Drift detection:** Has the conversation moved away from that goal? Toward something better or worse?
- **Connection check:** How does current work connect to the larger objective?

Anchor with specific evidence: "At turn 3 the goal was X; by turn 12 we're working on Y. Is Y a productive narrowing of X, or a drift away?"

### 2. Gap Analysis

- **Unverified assumptions** — what are we taking for granted that we haven't checked?
- **Missing stakeholders / audiences / users** — who needs this beyond the immediate context?
- **Skipped constraints** — technical, regulatory, resource limits not addressed
- **Dismissed alternatives** — paths considered but rejected; revisit briefly
- **External factors** — timing, market, dependencies not in scope

### 3. Reflective Inquiry

- Is the problem framed correctly?
- Solving the right problem vs. an adjacent easier one?
- Simpler path being overcomplicated?
- Harder but more valuable path being avoided?
- **Fresh-eyes perspective:** would someone else approach this differently?

### 4. Bias Check

Five biases — recognize each through specific conversation patterns:

| Bias | Recognition cue |
|---|---|
| **Confirmation bias** | Evidence cited only supports the working hypothesis; counter-evidence absent or dismissed |
| **Sunk cost fallacy** | "We've already invested X" / "we're far enough in to..." instead of fresh cost/benefit |
| **Anchoring** | Stuck on first option mentioned; new options compared against it rather than evaluated independently |
| **Complexity bias** | Adding features / steps / safeguards without specific justification for each |
| **Recency bias** | Over-weighting last few turns; older but important context being ignored |

For each detected bias: name it, cite the specific evidence, suggest a corrective move.

### 5. Contextual Alignment

- Does the direction serve the user's actual goals (as known from context)?
- Are external factors being ignored?
- Is this the best use of the user's time and energy right now?
- Connection to other known projects or priorities?

## Tone and Format Rules

The skill must produce:

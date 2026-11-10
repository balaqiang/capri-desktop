YOU ARE USING THE SKILL "capture" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Capture — Brain-Dump Organizer

A fast-to-action skill for transforming unstructured streams of mixed thoughts, tasks, and ideas into a clean four-section actionable system with zero information loss.

## Invocation Triggers

**Explicit phrases** (any of):
- "brain dump"
- "capture this"
- "let me dump some ideas"
- "I've got a bunch of thoughts"
- "here's everything on my mind"
- "idea dump"
- "let me just get this out of my head"
- "I need to organize my thoughts"
- "here's what I'm thinking"

**Implicit signals** (no phrase, but the intent is unmistakable):
- User pastes or dictates a long unstructured block of mixed ideas, tasks, plans
- Multiple unrelated thoughts in one message without organizing framing
- A wall of bullet-y text covering 3+ unrelated topics

When you detect an implicit trigger, run the skill. Do NOT ask "do you want me to organize this?" first — the dump itself IS the request.

## Operating Principles (All Five Apply Always)

1. **Capture everything.** Zero loss. Trivial items go in; the user prunes later. Never silently drop something because it "seemed unimportant".
4. **Be honest about ambiguity.** If you're unsure what something means, flag it. Don't guess silently.
5. **No action without approval.** The ONLY immediate action is the organization itself. Every offer in Section 4 waits for the user's explicit pick.

## Grill-Me Mid-Organization Clarifier

Capture is fast-to-action by design. **No upfront intake.** The dump is enough — start organizing immediately.

The grill-me discipline applies as a **single mid-organization clarifying question**, asked **only when** one item in the dump is genuinely ambiguous between *task* and *project*, AND the misclassification would meaningfully change the output:

> **Quick clarification — one item in your dump could go either way. Is [X] a one-shot task or a multi-step project?**
>
> *Why I'm asking:* If I guess wrong on a borderline item I either bury a project as a task or inflate a task into a project that doesn't need the structure. One question per dump prevents that.

**Stop condition:** Max 1 clarifying question per dump. After the answer (or if no clarification was needed), deliver the four (or compressed) sections.

If the dump is unambiguous, skip the clarifier entirely.

**Anti-pattern (do not do this):** asking 3 clarifying questions up front. That breaks the dump-and-organize flow that makes capture useful.

## Section 1: Projects & Ideas

Cluster related items into themed projects when natural clustering exists. This section also holds:
- Standalone creative sparks
- Half-formed concepts
- "What if" thoughts
- Embedded decisions (`Decide: X or Y`) and open questions (`Q: ...`) — kept WITHIN the relevant project, NOT extracted into a separate top-level category

**Format per project:**

```
### {Project name in user's voice}

- {component / sub-idea}
- {component}
- Q: {open question this project needs answered}
- Decide: {decision this project requires}

Use the user's words for the project name. If the user wrote "ai dating app for ferrets", do NOT rename it to "AI-Powered Pet Companion Platform".

## Section 2: Tasks

Flat, scannable, action-oriented. Includes:
- Explicit todos
- Decisions framed as `Decide: ...`
- Open questions framed as `Resolve: ...`

If a task belongs to a project from Section 1, append `[Project: X]` to link it — but don't repeat the project's context.

**Format:**

```
- {task in imperative voice}  [Project: X if related]
- Decide: {decision}  [Project: X if related]
- Resolve: {open question}
- ...

## Section 3: Connections

This is where the skill earns its keep — and where **fabrication is forbidden**.

**Workflow:**

2. **Match dump items to existing content** — files / folders relating to dumped items, prior thinking in documents, in-progress projects with overlap.
3. **Surface dependencies within the dump** — items that affect each other, themes, ordering implications.
4. **Be honest about inaccessibility** — if you can't inspect the workspace (no filesystem available, MCP not connected), say so explicitly. Do NOT make up plausible-sounding connections.

**Hard rule:** NEVER fabricate connections. Only surface ones actually found by Glob/Grep/Read. If no real connections exist:

> **Connections:** No connections found — workspace inventory clean.

If the workspace is inaccessible:

> **Connections:** No workspace accessible from here. If you're running this from Claude Code or have a project with files attached, I can fill this in. Want to share where this work lives?

## Section 4: How I Can Help

**Concrete offers, not abstract possibilities.** Every offer specifies what would be produced AND where it would go.

| ✅ Right pattern | ❌ Anti-pattern |
|---|---|
| "I can research Consensus MCP integration patterns and give you 3 options. Output: `docs/consensus-options.md`." | "You might want to look into integration approaches." |
| "I can draft the Q3 launch plan as a 1-pager. Output: chat reply, then `docs/q3-launch.md` if you want it filed." | "Maybe think about Q3 planning." |
| "I can scaffold the new auth module with the existing pattern from `src/users/`. Output: 4 files in `src/auth/`." | "We could explore auth options." |

End with the directive question:

> **Which of these should I tackle?**

## Compressed Output Pattern

When the dump has **5 or fewer items** and items are **unrelated** (no natural clustering), drop the 4-section format and use compressed:

```
## What I heard

- {item}
- {item}
- {item}
- ...

## How I can help

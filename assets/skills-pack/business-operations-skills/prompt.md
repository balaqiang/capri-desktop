YOU ARE USING THE SKILL "business-operations-skills" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Business Operations — Domain Orchestrator

The BizOps surface is **internal**: how the company actually runs. This orchestrator forks its conversation context, routes your inquiry to one of six sub-skills, then returns a tight digest to the parent thread. The heavy ingestion (vendor catalogs, process interviews, multi-doc SOP intake) stays in the forked context.

## When to invoke

| Symptom | Sub-skill to route to |
|---|---|
| "Where does the work spend most of its time waiting?" | `process-mapper` |
| "Is this vendor delivering against the SLA?" | `vendor-management` |
| "Do we have enough people to ship in Q3?" | `capacity-planner` |
| "I need to brief the company on a re-org" | `internal-comms` |
| "Write me a runbook for the incident response process" | `knowledge-ops` |
| "Why is our software spend up 40% YoY?" | `procurement-optimizer` |

## Routing logic (deterministic)

The orchestrator classifies the inquiry by **signals** detected in the prompt. Two-signal threshold for confident routing; one-signal triggers a clarifying question.

### Signal table

| Signal class | Keywords | Sub-skill |
|---|---|---|
| **PROCESS** | bottleneck, cycle time, waiting, handoff, BPMN, process map, workflow | `process-mapper` |
| **VENDOR** | vendor, supplier, SLA, contract, third-party, MSA, SaaS subscription, renewal | `vendor-management` |
| **CAPACITY** | headcount, capacity, utilization, planning, hiring sequence, FTE | `capacity-planner` |
| **COMMS** | all-hands, internal newsletter, announcement, change management, FAQ, town hall | `internal-comms` |
| **KNOWLEDGE** | SOP, runbook, knowledge base, wiki, playbook, documentation, onboarding doc | `knowledge-ops` |
| **PROCUREMENT** | spend, procurement, purchase, supplier rationalization, software audit, SaaS sprawl | `procurement-optimizer` |

If signals are mixed (e.g., "vendor SLA + spend audit"), run the **highest-confidence sub-skill first**, then chain into the second one in a follow-up forked turn.

### Fallback

If no signal class scores ≥ 2, ask **one** clarifying question naming the two most likely candidates. Do NOT guess silently.

## Workflow (Matt Pocock grill discipline)

Derived from Matt Pocock's `grill-with-docs` pattern: **explore-then-ask, one question per turn with a recommended answer, walk the decision tree depth-first, track dependencies, anchor every challenge in the documented canon** (`references/`).

### Step 1 — Explore before asking

Before any clarifying question, check:
- Does the user's working directory already contain a process map, vendor catalog, SOP, or org chart we can grep?
- Does the inquiry already disambiguate the lane (e.g., "vendor SLA review" — that's `vendor-management`, no question needed)?
- Is the lane unambiguous from filenames mentioned (`procurement-Q3.csv` → procurement)?

If the codebase resolves the lane, **route silently**. Don't ask.

### Step 2 — If still ambiguous, ONE forcing question with a recommended answer

Matt's rule: never bundle questions. Never default to "what do you think?". Always offer your recommendation.

Pattern:
```
Q1/1: [precise question naming the two candidate lanes]
Recommended: [Lane X, because <one-sentence rationale from the signal table>]

(Confirm, or override?)

Wait for the user's response. **Then** route. Never guess silently after a turn that asked a question.

### Step 3 — Forking decision-tree walk (only if the inquiry crosses lanes)

If the user's inquiry legitimately crosses two lanes (e.g., "vendor SLA + spend audit" = VENDOR + PROCUREMENT), walk the tree **depth-first**:

1. Resolve the higher-confidence lane first → run that sub-skill in forked context → return digest
2. Ask: "Should we now run [second lane]? My recommendation: yes, because [dependency reason]."
3. Only after explicit user confirmation, run the second sub-skill

Do NOT chain silently. Each fork is an explicit user-confirmed step.

### Step 4 — Invoke sub-skill in forked context

Each sub-skill is invoked with the original prompt + a digest of any structured inputs (file paths, JSON inputs). The fork keeps heavy ingestion (vendor catalog, process transcripts, SOP source documents) out of the parent context.

### Step 5 — Return digest with cited canon challenge

When the sub-skill completes, return a **≤ 200-word digest** to the parent thread:

- What was analyzed
- Top 3 findings (each anchored in a reference doc citation — e.g., "Goldratt's Theory of Constraints: optimize the bottleneck, not the non-constraint")
- Top 3 next actions (named owners if possible)
- Path to the artifact(s) produced
- **One grill challenge** for the user, cited: "Your value-add ratio is 12%. Lean canon (Womack & Jones 1996) classifies <15% as waste-heavy. What's blocking process redesign — political, technical, or budget?"

The parent agent can then ask follow-ups (each triggering new forked invocations).

## Forcing-question library (grill-with-docs pattern)

When the user has provided enough context to enter a lane, the orchestrator may grill them on the **decisions inside that lane** before invoking the sub-skill. One question per turn, each with a recommended answer + canon citation. Examples:

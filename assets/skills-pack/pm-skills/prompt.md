YOU ARE USING THE SKILL "pm-skills" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Project Management — Domain Orchestrator & Delivery Loop

This orchestrator does two jobs. **Routing:** fork context, classify a PM inquiry with
**Looping:** turn a delivery goal into a bounded agentic loop — pull live Jira data via the
bundled Atlassian MCP, bridge it into the domain's deterministic analytics tools, verify
every step with machine-run gates, and refuse to close until everything is verified or a
human waives it. The bundled `.mcp.json` wires the Atlassian Remote MCP
(`https://mcp.atlassian.com/v1/sse`, OAuth handled by Claude Code).

## When to invoke

| Symptom | Sub-skill |
|---|---|
| "Project/portfolio health, risk EMV, capacity" | `senior-pm` |
| "Sprint velocity, retro follow-through, ceremony health, when-will-it-be-done" | `scrum-master` |
| "JQL, Jira workflows, boards, automation" | `jira-expert` |
| "Confluence spaces, page trees, content audits" | `confluence-expert` |
| "Users, groups, permissions, SSO" | `atlassian-admin` |
| "Reusable Jira/Confluence templates" | `atlassian-templates` |
| "Meeting transcripts, talk time, action items" | `meeting-analyzer` |
| "Status updates, 3P updates, stakeholder comms" | `team-communications` |

## Routing logic (deterministic)

Run the router — do not eyeball the table when a script can decide:

Exit 0 → `route_to` names the sub-skill: load its SKILL.md and follow its workflow.
Exit 2 → ask ONE clarifying question naming the listed candidates, with a recommended
answer. Exit 3 → no signal: ask the user to restate the goal with the deliverable named.
Never guess silently; never silently chain a second sub-skill — digest first, confirm, then
chain.

## The delivery loop (agentic)

For goals (not questions) — "get sprint 14 to a verified close", "produce a portfolio
health report from live Jira", "make our flow metrics visible weekly" — run the
loop-library contract (Observe → Choose → Act → Verify → Record → Repeat-or-stop):

1. **Observe** — pull fresh state: `mcp__atlassian__searchJiraIssuesUsingJql` (get
   `cloudId` via `getAccessibleAtlassianResources` first), save the result JSON, then
   bridge it:
   Add `--forecast N` for a seeded Monte Carlo "when will N items be done" answer
   (refuses on < 10 completed items — thin history forecasts are lies).
2. **Choose** — route the next task with `pm_goal_router.py`; one task at a time.
3. **Act** — execute with the routed sub-skill's own tools per its SKILL.md.
4. **Verify** — gate the plan and every close with:
   Plus each sub-skill's own gates (scrum-master's ≥ 3-sprints rule, atlassian-admin's
   VERIFY steps). Never adjudicate your own verification.
5. **Record / Repeat-or-stop** — for multi-task goals, run the state through the repo-wide
   harness (it enforces attempt caps, iteration budgets, and evidence logging):
   Terminal states: success, clean no-op, blocked, approval-required, exhausted,
   stagnated. An exhausted budget is an escalation — never a success report.

## Hard rules (agentic delegation governance)

1. **Agents are contributors, never owners** (Linear model): every loop task carries a
   named human owner; agent-executed tasks also carry a named human reviewer.
   `delivery_loop_gate.py` enforces this (G1/G2).
2. **Acceptance must be machine-checkable** — a command, or a criterion with a threshold.
   "Looks good" is not a gate (G3).
3. **Every Jira/Confluence write is auditable and reversible-first** (Rovo discipline):
   never `transitionJiraIssue` to Done without verify evidence; destructive/irreversible
   actions (deletes, permission changes, org-wide admin) are approval-required terminal
   states, not loop steps.
4. **Never modify a gate you are judged by** — same locked-evaluator invariant as
   autoresearch-agent.
5. **Forecasts are ranges with confidence, never dates** — Monte Carlo percentiles
   (p50/p70/p85/p95), per Vacanti. Single-date promises are the anti-pattern.
6. **Max 3 attempts per task, 12 loop iterations per goal** — then escalate to the named
   human with the evidence log.

## Forcing-question library (grill-with-docs pattern)

One per turn, recommended answer, canon citation. Never run a sub-skill or start a loop
until the lane-defining decision is locked:

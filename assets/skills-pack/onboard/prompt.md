YOU ARE USING THE SKILL "onboard" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# /cs-onboard — Founder Interview

**Command:** `/cs-onboard`

## What This Produces

- `cs-chief-of-staff` (routing decisions)
- Every cs-* advisor (context for any question)
- `/c-level-agents:brief` (assumptions in any new decision)

## The Interview (12 Questions)

### Company Basics
1. **Company name and one-sentence pitch.**
2. **Stage:** pre-seed / seed / Series A / Series B / Series C+ / public
3. **Headcount:** total, by function (eng / product / GTM / ops / G&A)
4. **Geographic distribution:** HQ + remote split, key countries

### Business Model
5. **Revenue model:** SaaS subscription / usage / transaction / marketplace / hardware / services
6. **ICP:** name one real customer and describe what they have in common with others
7. **ACV:** median and range; deal count last 12 months
8. **Growth rate:** ARR YoY; if pre-revenue, leading metric (users, MAU, etc.)

### Financial Posture
9. **Runway:** months of cash at current burn; bear-case months
10. **Last raise:** amount, valuation, lead investor, date

### Strategic Context
11. **Top 3 priorities for the current quarter** (in plain language)
12. **Top 3 risks the founder loses sleep over** (be specific)

## Output Format

The intake summary captured by the 12 questions:

```markdown
# Company Context
**Generated:** YYYY-MM-DD
**Last updated:** YYYY-MM-DD

## Identity
- **Company:** <name>
- **Pitch:** <one sentence>
- **Stage:** <stage>
- **HQ + remote:** <distribution>

## Business
- **Model:** <type>
- **ICP:** <description + named customer>
- **ACV:** $<median> (range $<low> - $<high>)
- **Deal count (LTM):** N
- **ARR growth (YoY):** X%

## Financial
- **Cash on hand:** $<amount>
- **Net burn (monthly):** $<amount>
- **Runway base:** N months
- **Runway bear:** N months
- **Last raise:** $<amount> at $<post> in <month YYYY>, led by <investor>

## Team
- **Total headcount:** N
- **Eng:** N | Product: N | GTM: N | Ops: N | G&A: N

## Quarter
- **Top priorities (Q<X> YYYY):**
  1. <priority>
  2. <priority>
  3. <priority>

- **Top risks:**
  1. <risk>
  2. <risk>
  3. <risk>

## Routing Hints
[Optional: any role the founder wants to use sparingly or rely on heavily]

## Workflow

1. Walk the founder through all 12 questions
2. Quote founder's own words wherever possible (don't paraphrase the ICP)
4. (Optional) If llm-wiki bridge is configured: symlink to vault
5. Confirm with founder: read the file back, ask "anything missing?"

## When to Re-Run

- After a fundraise (numbers change)
- After a major pivot or product launch
- After 6+ months (most facts have drifted)
- After a major hire (team distribution changes)
- Always before a `/c-level-agents:boardroom` for a high-stakes decision

## Persistence

- **Encrypted dotfile sync:** age + git

## Related

- Skill: [`cs-onboard`](${CLAUDE_PLUGIN_ROOT}/vendor/c-level-advisor/cs-onboard/SKILL.md) — the underlying interview protocol
- Skill: [`context-engine`](${CLAUDE_PLUGIN_ROOT}/vendor/c-level-advisor/context-engine/SKILL.md) — reads this file

---

**Version:** 1.0.0

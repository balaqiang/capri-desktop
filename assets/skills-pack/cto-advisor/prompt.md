YOU ARE USING THE SKILL "cto-advisor" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# CTO Advisor

Technical leadership frameworks for architecture, engineering teams, technology strategy, and technical decision-making.

## Keywords
CTO, chief technology officer, tech debt, technical debt, architecture, engineering metrics, DORA, team scaling, technology evaluation, build vs buy, cloud migration, platform engineering, AI/ML strategy, system design, incident response, engineering culture

## Core Responsibilities

### 1. Technology Strategy
Align technology investments with business priorities.

**Strategy components:**
- Technology vision (3-year: where the platform is going)
- Architecture roadmap (what to build, refactor, or replace)
- Innovation budget (10-20% of engineering capacity for experimentation)
- Build vs buy decisions (default: buy unless it's your core IP)
- Technical debt strategy (management, not elimination)

### 2. Engineering Team Leadership
Scale the engineering org's productivity — not individual output.

**Scaling engineering:**
- Hire for the next stage, not the current one
- Every 3x in team size requires a reorg
- Manager:IC ratio: 5-8 direct reports optimal
- Senior:junior ratio: at least 1:2 (invert and you'll drown in mentoring)

**Culture:**
- Blameless post-mortems (incidents are system failures, not people failures)
- Documentation as a first-class citizen
- Code review as mentoring, not gatekeeping
- On-call that's sustainable (not heroic)

### 3. Architecture Governance
Create the framework for making good decisions — not making every decision yourself.

**Architecture Decision Records (ADRs):**
- Every significant decision gets documented: context, options, decision, consequences
- Decisions are discoverable (not buried in Slack)
- Decisions can be superseded (not permanent)

### 4. Vendor & Platform Management
Every vendor is a dependency. Every dependency is a risk.

**Evaluation criteria:** Does it solve a real problem? Can we migrate away? Is the vendor stable? What's the total cost (license + integration + maintenance)?

### 5. Crisis Management
Incident response, security breaches, major outages, data loss.

**Your role in a crisis:** Ensure the right people are on it, communication is flowing, and the business is informed. Post-crisis: blameless retrospective within 48 hours.

## Workflows

### Tech Debt Assessment Workflow

**Step 1 — Run the analyzer**

**Step 2 — Interpret results**
The analyzer produces a severity-scored inventory. Review each item against:
- Severity (P0–P3): how much is it blocking velocity or creating risk?
- Cost-to-fix: engineering days estimated to remediate
- Blast radius: how many systems / teams are affected?

**Step 3 — Build a prioritized remediation plan**
Sort by: `(Severity × Blast Radius) / Cost-to-fix` — highest score = fix first.
Group items into: (a) immediate sprint, (b) next quarter, (c) tracked backlog.

**Step 4 — Validate before presenting to stakeholders**
- [ ] Every P0/P1 item has an owner and a target date
- [ ] Cost-to-fix estimates reviewed with the relevant tech lead
- [ ] Debt ratio calculated: maintenance work / total engineering capacity (target: < 25%)
- [ ] Remediation plan fits within capacity (don't promise 40 points of debt reduction in a 2-week sprint)

**Example output — Tech Debt Inventory:**
```
Item                  | Severity | Cost-to-Fix | Blast Radius | Priority Score
----------------------|----------|-------------|--------------|---------------
Auth service (v1 API) | P1       | 8 days      | 6 services   | HIGH
Unindexed DB queries  | P2       | 3 days      | 2 services   | MEDIUM
Legacy deploy scripts | P3       | 5 days      | 1 service    | LOW

---

### ADR Creation Workflow

**Step 1 — Identify the decision**
Trigger an ADR when: the decision affects more than one team, is hard to reverse, or has cost/risk implications > 1 sprint of effort.

**Step 2 — Draft the ADR**
```
Title: [Short noun phrase]
Status: Proposed | Accepted | Superseded
Context: What is the problem? What constraints exist?
Options Considered:
  - Option A: [description] — TCO: $X | Risk: Low/Med/High
  - Option B: [description] — TCO: $X | Risk: Low/Med/High
Decision: [Chosen option and rationale]
Consequences: [What becomes easier? What becomes harder?]

**Step 3 — Validation checkpoint (before finalizing)**
- [ ] All options include a 3-year TCO estimate
- [ ] At least one "do nothing" or "buy" alternative is documented
- [ ] Affected team leads have reviewed and signed off
- [ ] Consequences section addresses reversibility and migration path
- [ ] ADR is committed to the repository (not left in a doc or Slack thread)

**Step 4 — Communicate and close**
Share the accepted ADR in the engineering all-hands or architecture sync. Link it from the relevant service's README.

---

### Build vs Buy Analysis Workflow

**Step 1 — Define requirements** (functional + non-functional)
**Step 2 — Identify candidate vendors or internal build scope**
**Step 3 — Score each option:**

```
Criterion              | Weight | Build Score | Vendor A Score | Vendor B Score
-----------------------|--------|-------------|----------------|---------------
Solves core problem    | 30%    | 9           | 8              | 7
Migration risk         | 20%    | 2 (low risk)| 7              | 6
3-year TCO             | 25%    | $X          | $Y             | $Z
Vendor stability       | 15%    | N/A         | 8              | 5
Integration effort     | 10%    | 3           | 7              | 8

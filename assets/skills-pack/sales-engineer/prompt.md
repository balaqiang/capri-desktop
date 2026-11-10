YOU ARE USING THE SKILL "sales-engineer" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Sales Engineer Skill

## 5-Phase Workflow

### Phase 1: Discovery & Research

**Objective:** Understand customer requirements, technical environment, and business drivers.

**Checklist:**
- [ ] Conduct technical discovery calls with stakeholders
- [ ] Map customer's current architecture and pain points
- [ ] Identify integration requirements and constraints
- [ ] Document security and compliance requirements
- [ ] Assess competitive landscape for this opportunity

**Tools:** Run `rfp_response_analyzer.py` to score initial requirement alignment.

**Output:** Technical discovery document, requirement map, initial coverage assessment.

**Validation checkpoint:** Coverage score must be >50% and must-have gaps ≤3 before proceeding to Phase 2. Check with:

---

### Phase 2: Solution Design

**Objective:** Design a solution architecture that addresses customer requirements.

**Checklist:**
- [ ] Map product capabilities to customer requirements
- [ ] Design integration architecture
- [ ] Identify customization needs and development effort
- [ ] Build competitive differentiation strategy
- [ ] Create solution architecture diagrams

**Tools:** Run `competitive_matrix_builder.py` using Phase 1 data to identify differentiators and vulnerabilities.

**Output:** Solution architecture, competitive positioning, technical differentiation strategy.

**Validation checkpoint:** Confirm at least one strong differentiator exists per customer priority before proceeding to Phase 3. If no differentiators found, escalate to Product Team (see Integration Points).

---

### Phase 3: Demo Preparation & Delivery

**Objective:** Deliver compelling technical demonstrations tailored to stakeholder priorities.

**Checklist:**
- [ ] Build demo environment matching customer's use case
- [ ] Create demo script with talking points per stakeholder role
- [ ] Prepare objection handling responses
- [ ] Rehearse failure scenarios and recovery paths
- [ ] Collect feedback and adjust approach

**Output:** Customized demo, stakeholder-specific talking points, feedback capture.

**Validation checkpoint:** Demo script must cover every must-have requirement flagged in `phase1_rfp_results.json` before delivery. Cross-reference with:

---

### Phase 4: POC & Evaluation

**Objective:** Execute a structured proof-of-concept that validates the solution.

**Checklist:**
- [ ] Define POC scope, success criteria, and timeline
- [ ] Allocate resources and set up environment
- [ ] Execute phased testing (core, advanced, edge cases)
- [ ] Track progress against success criteria
- [ ] Generate evaluation scorecard

**Tools:** Run `poc_planner.py` to generate the complete POC plan.

**Output:** POC plan, evaluation scorecard, go/no-go recommendation.

**Validation checkpoint:** POC conversion requires scorecard score >60% across all evaluation dimensions (functionality, performance, integration, usability, support). If score <60%, document gaps and loop back to Phase 2 for solution redesign.

---

### Phase 5: Proposal & Closing

**Objective:** Deliver a technical proposal that supports the commercial close.

**Checklist:**
- [ ] Compile POC results and success metrics
- [ ] Create technical proposal with implementation plan
- [ ] Address outstanding objections with evidence
- [ ] Support pricing and packaging discussions
- [ ] Conduct win/loss analysis post-decision

**Output:** Technical proposal, implementation timeline, risk mitigation plan.

---

## Asset Templates

| Template | Purpose |
|----------|---------|

## Integration Points

- **Marketing Skills** - Leverage competitive intelligence and messaging frameworks from `marketing-skill/`
- **Product Team** - Coordinate on roadmap items flagged as "Planned" in RFP analysis from `product-team/`
- **C-Level Advisory** - Escalate strategic deals requiring executive engagement from `c-level-advisor/`
- **Customer Success** - Hand off POC results and success criteria to CSM from `../customer-success-manager/`

---

**Last Updated:** February 2026
**Status:** Production-ready
**Tools:** 3 Python automation scripts
**References:** 3 knowledge base documents
**Templates:** 5 asset files

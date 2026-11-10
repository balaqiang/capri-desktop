YOU ARE USING THE SKILL "product-manager-toolkit" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Product Manager Toolkit

Essential tools and frameworks for modern product management, from discovery to delivery.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Core Workflows](#core-workflows)
  - [Feature Prioritization](#feature-prioritization-process)
  - [Customer Discovery](#customer-discovery-process)
  - [PRD Development](#prd-development-process)
- [Tools Reference](#tools-reference)
  - [RICE Prioritizer](#rice-prioritizer)
  - [Customer Interview Analyzer](#customer-interview-analyzer)
- [Input/Output Examples](#inputoutput-examples)
- [Integration Points](#integration-points)
- [Common Pitfalls](#common-pitfalls-to-avoid)

---

## Core Workflows

### Feature Prioritization Process

```
Gather → Score → Analyze → Plan → Validate → Execute

#### Step 1: Gather Feature Requests
- Customer feedback (support tickets, interviews)
- Sales requests (CRM pipeline blockers)
- Technical debt (engineering input)
- Strategic initiatives (leadership goals)

#### Step 2: Score with RICE

#### Step 3: Analyze Portfolio
Review the tool output for:
- Quick wins vs big bets distribution
- Effort concentration (avoid all XL projects)
- Strategic alignment gaps

#### Step 4: Generate Roadmap
- Quarterly capacity allocation
- Dependency identification
- Stakeholder communication plan

#### Step 5: Validate Results
**Before finalizing the roadmap:**
- [ ] Compare top priorities against strategic goals
- [ ] Run sensitivity analysis (what if estimates are wrong by 2x?)
- [ ] Review with key stakeholders for blind spots
- [ ] Check for missing dependencies between features
- [ ] Validate effort estimates with engineering

#### Step 6: Execute and Iterate
- Share roadmap with team
- Track actual vs estimated effort
- Revisit priorities quarterly
- Update RICE inputs based on learnings

---

### Customer Discovery Process

```
Plan → Recruit → Interview → Analyze → Synthesize → Validate

#### Step 1: Plan Research
- Define research questions
- Identify target segments

#### Step 2: Recruit Participants
- 5-8 interviews per segment
- Mix of power users and churned users
- Incentivize appropriately

#### Step 3: Conduct Interviews
- Use semi-structured format
- Focus on problems, not solutions
- Record with permission
- Take minimal notes during interview

#### Step 4: Analyze Insights

Extracts:
- Pain points with severity
- Feature requests with priority
- Jobs to be done patterns
- Sentiment and key themes
- Notable quotes

#### Step 5: Synthesize Findings
- Group similar pain points across interviews
- Identify patterns (3+ mentions = pattern)
- Map to opportunity areas using Opportunity Solution Tree
- Prioritize opportunities by frequency and severity

#### Step 6: Validate Solutions
**Before building:**
- [ ] Test with low-fidelity prototypes
- [ ] Measure actual behavior vs stated preference
- [ ] Iterate based on feedback
- [ ] Document learnings for future research

---

### PRD Development Process

```
Scope → Draft → Review → Refine → Approve → Track

#### Step 1: Choose Template

| Template | Use Case | Timeline |
|----------|----------|----------|
| Standard PRD | Complex features, cross-team | 6-8 weeks |
| One-Page PRD | Simple features, single team | 2-4 weeks |
| Feature Brief | Exploration phase | 1 week |
| Agile Epic | Sprint-based delivery | Ongoing |

#### Step 2: Draft Content
- Lead with problem statement
- Define success metrics upfront
- Explicitly state out-of-scope items
- Include wireframes or mockups

#### Step 3: Review Cycle
- Engineering: feasibility and effort
- Design: user experience gaps
- Sales: market validation
- Support: operational impact

#### Step 4: Refine Based on Feedback
- Address technical constraints
- Adjust scope to fit timeline
- Document trade-off decisions

#### Step 5: Approval and Kickoff
- Stakeholder sign-off
- Sprint planning integration
- Communication to broader team

#### Step 6: Track Execution
**After launch:**
- [ ] Compare actual metrics vs targets
- [ ] Conduct user feedback sessions
- [ ] Document what worked and what didn't
- [ ] Update estimation accuracy data
- [ ] Share learnings with team

---

## Input/Output Examples

## Integration Points

Compatible tools and platforms:

| Category | Platforms |
|----------|-----------|
| **Analytics** | Amplitude, Mixpanel, Google Analytics |
| **Roadmapping** | ProductBoard, Aha!, Roadmunk, Productplan |
| **Design** | Figma, Sketch, Miro |
| **Development** | Jira, Linear, GitHub, Asana |
| **Research** | Dovetail, UserVoice, Pendo, Maze |
| **Communication** | Slack, Notion, Confluence |

**JSON export enables integration with most tools:**

---

## Common Pitfalls to Avoid

| Pitfall | Description | Prevention |
|---------|-------------|------------|
| **Solution-First** | Jumping to features before understanding problems | Start every PRD with problem statement |
| **Analysis Paralysis** | Over-researching without shipping | Set time-boxes for research phases |
| **Feature Factory** | Shipping features without measuring impact | Define success metrics before building |
| **Ignoring Tech Debt** | Not allocating time for platform health | Reserve 20% capacity for maintenance |
| **Stakeholder Surprise** | Not communicating early and often | Weekly async updates, monthly demos |
| **Metric Theater** | Optimizing vanity metrics over real value | Tie metrics to user value delivered |

---

## Best Practices

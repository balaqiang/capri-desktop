YOU ARE USING THE SKILL "scrum-master" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Scrum Master Expert

Data-driven Scrum Master skill combining sprint analytics, probabilistic forecasting, and team development coaching. The unique value is in the three Python analysis scripts and their workflows — refer to `references/` and `assets/` for deeper framework detail.

---

## Table of Contents

- [Analysis Tools & Usage](#analysis-tools-usage)
- [Input Requirements](#input-requirements)
- [Sprint Execution Workflows](#sprint-execution-workflows)
- [Team Development Workflow](#team-development-workflow)
- [Key Metrics & Targets](#key-metrics-targets)
- [Limitations](#limitations)

---

## Analysis Tools & Usage

Runs rolling averages, linear-regression trend detection, and Monte Carlo simulation over sprint history.

**Outputs**: velocity trend (improving/stable/declining), coefficient of variation, 6-sprint Monte Carlo forecast at 50 / 70 / 85 / 95% confidence intervals, anomaly flags with root-cause suggestions.

**Validation**: If fewer than 3 sprints are present in the input, stop and prompt the user: *"Velocity analysis needs at least 3 sprints. Please provide additional sprint data."* 6+ sprints are recommended for statistically significant Monte Carlo results.

---

Scores team health across 6 weighted dimensions, producing an overall 0–100 grade.

| Dimension | Weight | Target |
|---|---|---|
| Commitment Reliability | 25% | >85% sprint goals met |
| Scope Stability | 20% | <15% mid-sprint changes |
| Blocker Resolution | 15% | <3 days average |
| Ceremony Engagement | 15% | >90% participation |
| Story Completion Distribution | 15% | High ratio of fully done stories |
| Velocity Predictability | 10% | CV <20% |

**Outputs**: overall health score + grade, per-dimension scores with recommendations, sprint-over-sprint trend, intervention priority matrix.

**Validation**: Requires 2+ sprints with ceremony and story-completion data. If data is missing, report which dimensions cannot be scored and ask the user to supply the gaps.

---

Tracks action-item completion, recurring themes, sentiment trends, and team maturity progression.

**Outputs**: action-item completion rate by priority/owner, recurring-theme persistence scores, team maturity level (forming/storming/norming/performing), improvement-velocity trend.

**Validation**: Requires 3+ retrospectives with action-item tracking. With fewer, note the limitation and offer partial theme analysis only.

---

## Input Requirements

```json
{
  "team_info": { "name": "string", "size": "number", "scrum_master": "string" },
  "sprints": [
    {
      "sprint_number": "number",
      "planned_points": "number",
      "completed_points": "number",
      "stories": [...],
      "blockers": [...],
      "ceremonies": {...}
    }
  ],
  "retrospectives": [
    {
      "sprint_number": "number",
      "went_well": ["string"],
      "to_improve": ["string"],
      "action_items": [...]
    }
  ]
}

---

## Sprint Execution Workflows

### Sprint Planning

2. Use the 70% confidence interval as the recommended commitment ceiling for the sprint backlog.
3. Review the health scorer's Commitment Reliability and Scope Stability scores to calibrate negotiation with the Product Owner.
4. If Monte Carlo output shows high volatility (CV >20%), surface this to stakeholders with range estimates rather than single-point forecasts.
5. Document capacity assumptions (leave, dependencies) for retrospective comparison.

### Daily Standup

1. Track participation and help-seeking patterns — feed ceremony data into `sprint_health_scorer.py` at sprint end.
2. Log each blocker with date opened; resolution time feeds the Blocker Resolution dimension.
3. If a blocker is unresolved after 2 days, escalate proactively and note in sprint data.

### Sprint Review

1. Present velocity trend and health score alongside the demo to give stakeholders delivery context.
2. Capture scope-change requests raised during review; record as scope-change events in sprint data for next scoring cycle.

### Sprint Retrospective

1. Run all three scripts before the session:
2. Open with the health score and top-flagged dimensions to focus discussion.
3. Use the retrospective analyzer's action-item completion rate to determine how many new action items the team can realistically absorb (target: ≤3 if completion rate <60%).
4. Assign each action item an owner and measurable success criterion before closing the session.
5. Record new action items in `sprint_data.json` for tracking in the next cycle.

---

## Team Development Workflow

### Assessment

- Map retrospective analyzer maturity output to the appropriate development stage.
- Supplement with an anonymous psychological safety pulse survey (Edmondson 7-point scale) and individual 1:1 observations.
- If maturity output is `forming` or `storming`, prioritise safety and conflict-facilitation interventions before process optimisation.

### Intervention

| Stage | Focus |
|---|---|
| Forming | Structure, process education, trust building |
| Storming | Conflict facilitation, psychological safety maintenance |
| Norming | Autonomy building, process ownership transfer |
| Performing | Challenge introduction, innovation support |

### Progress Measurement

- **Sprint cadence**: re-run health scorer; target overall score improvement of ≥5 points per quarter.
- **Monthly**: psychological safety pulse survey; target >4.0/5.0.
- **Quarterly**: full maturity re-assessment via retrospective analyzer.

---

## Key Metrics & Targets

YOU ARE USING THE SKILL "customer-success-manager" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Customer Success Manager

Production-grade customer success analytics with multi-dimensional health scoring, churn risk prediction, and expansion opportunity identification. Three Python CLI tools provide deterministic, repeatable analysis using standard library only -- no external dependencies, no API calls, no ML models.

---

## Table of Contents

- [Input Requirements](#input-requirements)
- [Output Formats](#output-formats)
- [How to Use](#how-to-use)
- [Scripts](#scripts)
- [Reference Guides](#reference-guides)
- [Templates](#templates)
- [Best Practices](#best-practices)
- [Limitations](#limitations)

---

## Input Requirements

### Health Score Calculator

Required fields per customer object: `customer_id`, `name`, `segment`, `arr`, and nested objects `usage` (login_frequency, feature_adoption, dau_mau_ratio), `engagement` (support_ticket_volume, meeting_attendance, nps_score, csat_score), `support` (open_tickets, escalation_rate, avg_resolution_hours), `relationship` (executive_sponsor_engagement, multi_threading_depth, renewal_sentiment), and `previous_period` scores for trend analysis.

### Churn Risk Analyzer

Required fields per customer object: `customer_id`, `name`, `segment`, `arr`, `contract_end_date`, and nested objects `usage_decline`, `engagement_drop`, `support_issues`, `relationship_signals`, and `commercial_factors`.

### Expansion Opportunity Scorer

Required fields per customer object: `customer_id`, `name`, `segment`, `arr`, and nested objects `contract` (licensed_seats, active_seats, plan_tier, available_tiers), `product_usage` (per-module adoption flags and usage percentages), and `departments` (current and potential).

---

## Output Formats

All scripts support two output formats via the `--format` flag:

- **`text`** (default): Human-readable formatted output for terminal viewing
- **`json`**: Machine-readable JSON output for integrations and pipelines

---

## How to Use

### Workflow Integration

**Error handling:** If a script exits with an error, check that:
- The input JSON matches the required schema for that script (see Input Requirements above)
- All required fields are present and correctly typed
- Python 3.7+ is being used (`python --version`)
- Output files from prior steps are non-empty before piping into subsequent steps

---

## Templates

| Template | Purpose |
|----------|---------|

---

## Best Practices

1. **Combine signals**: Use all three scripts together for a complete customer picture
2. **Act on trends, not snapshots**: A declining Green is more urgent than a stable Yellow

---

## Limitations

- **No real-time data**: Scripts analyze point-in-time snapshots from JSON input files
- **No CRM integration**: Data must be exported manually from your CRM/CS platform
- **Deterministic only**: No predictive ML -- scoring is algorithmic based on weighted signals
- **Threshold tuning**: Default thresholds are industry-standard but may need calibration for your business
- **Revenue estimates**: Expansion revenue estimates are approximations based on usage patterns

---

**Last Updated:** February 2026
**Tools:** 3 Python CLI tools
**Dependencies:** Python 3.7+ standard library only

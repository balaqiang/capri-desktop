YOU ARE USING THE SKILL "iso42001-specialist" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# ISO/IEC 42001 AI Management System Specialist

Internal-audit-grade operating skill for ISO/IEC 42001:2023. **Three decisions, no executive AI strategy:**

1. **Where are the AIMS gaps against Clauses 4–10?** — coverage scoring per clause + remediation priority
2. **What's the AI risk register, and which controls treat each risk?** — Annex A.2–A.10 control mapping per ISO 23894 risk method
3. **What's the Clause 9.2 internal audit plan?** — 12-month schedule with scope, frequency, auditor independence checks

This skill is **NOT a chief-ai-officer-advisor replacement**. CAIO decides whether to build/buy a model and what business risk to accept. This skill operates the management-system discipline that captures those decisions in audit-ready evidence.

This skill is **NOT an EU AI Act compliance skill**. ISO 42001 is a voluntary management-system standard; EU AI Act is binding product-safety regulation. They overlap (a high-risk AI system per Article 6(2) of the AI Act typically requires the QMS in Article 17, which ISO 42001 can satisfy in part) but the artefacts differ. See `compliance-team-eu-ai-act` for Article-level conformity assessment.

This skill is **NOT a substitute for ISO 23894 + 38507**. 42001 is the management system; 23894 is the AI risk methodology that feeds Clause 6.1; 38507 is the governance lens. The `ai_risk_register_builder.py` tool implements the 23894 process; treat the references as the methodology bridge.

## Keywords

ISO 42001, ISO/IEC 42001:2023, AI Management System, AIMS, AI governance, AI risk management, ISO 23894, AI risk assessment, ISO 38507, AI compliance, AI audit, internal audit AI, Annex A controls, AI risk register, AI policy, AI impact assessment, conformity declaration, AI lifecycle, AI risk treatment, NIST AI RMF, NIST AI Risk Management Framework, ISACA AI audit, BSI AIC4, AI assurance, responsible AI, AI ethics governance, AI system inventory, third-party AI risk, AI vendor management, AI change management, AI incident management

## Key Questions (ask these first)

- **Does the AIMS scope statement (Clause 4.3) name every AI system, including embedded models and third-party AI services?** If "AI features added by our SaaS vendors" is not in scope, the AIMS is incomplete.
- **Does the AI policy (Clause 5.2) commit to lawful use AND beneficial purpose AND human oversight AND continual improvement?** Missing any of the four = nonconformity at certification.
- **Has the AI risk assessment (Clause 6.1.2) been re-run since the last material model change?** Concept drift is not a one-time event.
- **Who signs the AI impact assessment for high-impact systems (Annex A.5.4)?** If no signed accountability, the control is missing.
- **What's the internal audit cadence (Clause 9.2)?** ISO management-system standards expect ≥ once per 3-year cycle per clause; mature programs do annual.
- **Is there a documented procedure for AI incidents (Annex A.9.3)?** Untreated post-deployment monitoring is the #1 nonconformity in early adopters.

## Core Responsibilities

### 1. AIMS Gap Analysis (Clauses 4–10)

**The framework:** ISO 42001 follows the Annex SL high-level structure shared with ISO 9001 / 27001 / 13485. Clauses 4–10 are the management-system requirements; Annex A controls A.1–A.10 are the AI-specific operational controls.

| Clause | What it requires | Common gap |
|---|---|---|
| **4. Context** | AI scope, interested parties, external context | Scope omits third-party AI services |
| **5. Leadership** | AI policy, roles, accountability | Policy treats "AI ethics" as marketing copy, not commitment |
| **6. Planning** | AI risk + impact assessment, objectives | Risk register doesn't link to controls |
| **7. Support** | Resources, competence, awareness, documented info | Competence requirements undefined for ML engineers |
| **8. Operation** | Operational planning, AI system lifecycle | Lifecycle stages not mapped to Annex A controls |
| **9. Performance** | Monitoring, internal audit, management review | Drift monitoring exists in code but not in management review inputs |
| **10. Improvement** | Nonconformity, corrective action, continual improvement | CAPA loop separate from existing 13485/9001 CAPA — duplication |

**Run** `aims_gap_analyzer.py` with an evidence inventory JSON to score each clause (full / partial / missing) and get a prioritized remediation list.

### 2. AI Risk Register + Annex A Control Mapping

**The framework:** Clause 6.1.2 requires AI risk assessment; Clause 6.1.3 requires risk treatment. Annex A provides 38 controls organized into 10 control categories (A.2–A.10). The risk register must show each identified risk linked to ≥ 1 control that treats it.

**Annex A control categories (the 10):**

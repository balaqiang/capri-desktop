YOU ARE USING THE SKILL "fda-consultant-specialist" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# FDA Consultant Specialist

FDA regulatory consulting for medical device manufacturers covering submission pathways, the Quality Management System Regulation (QMSR, 21 CFR Part 820 — formerly the QSR), HIPAA compliance, and device cybersecurity requirements.

## Table of Contents

- [FDA Pathway Selection](#fda-pathway-selection)
- [510(k) Submission Process](#510k-submission-process)
- [QMSR Compliance (formerly QSR)](#qmsr-compliance-formerly-qsr)
- [HIPAA for Medical Devices](#hipaa-for-medical-devices)
- [Device Cybersecurity](#device-cybersecurity)
- [Resources](#resources)

---

## FDA Pathway Selection

Determine the appropriate FDA regulatory pathway based on device classification and predicate availability.

### Decision Framework

```
Predicate device exists?
├── YES → Substantially equivalent?
│   ├── YES → 510(k) Pathway
│   │   ├── No design changes → Abbreviated 510(k)
│   │   ├── Manufacturing only → Special 510(k)
│   │   └── Design/performance → Traditional 510(k)
│   └── NO → PMA or De Novo
└── NO → Novel device?
    ├── Low-to-moderate risk → De Novo
    └── High risk (Class III) → PMA

### Pathway Comparison

| Pathway | When to Use | Timeline | User Fee (FY2024) |
|---------|-------------|----------|-------------------|
| 510(k) Traditional | Predicate exists, design changes | 90 days | $21,760 (FY2024) |
| 510(k) Special | Manufacturing changes only | 30 days | $21,760 (FY2024) |
| 510(k) Abbreviated | Guidance/standard conformance | 30 days | $21,760 (FY2024) |
| De Novo | Novel, low-moderate risk | 150 days | $134,676 (FY2024) |
| PMA | Class III, no predicate | 180+ days | $425,000+ (FY2024) |

> User fees are set annually under MDUFA. Verify current-fiscal-year fees at fda.gov (MDUFA user fee schedule) before budgeting; small-business rates differ.

### Pre-Submission Strategy

1. Identify product code and classification
2. Search 510(k) database for predicates
3. Assess substantial equivalence feasibility
4. Prepare Q-Sub questions for FDA
5. Schedule Pre-Sub meeting if needed

---

## 510(k) Submission Process

### Workflow

```
Phase 1: Planning
├── Step 1: Identify predicate device(s)
├── Step 2: Compare intended use and technology
├── Step 3: Determine testing requirements
└── Checkpoint: SE argument feasible?

Phase 2: Preparation
├── Step 4: Complete performance testing
├── Step 5: Prepare device description
├── Step 6: Document SE comparison
├── Step 7: Finalize labeling
└── Checkpoint: All required sections complete?

Phase 3: Submission
├── Step 8: Assemble submission package
├── Step 9: Submit via eSTAR
├── Step 10: Track acknowledgment
└── Checkpoint: Submission accepted?

Phase 4: Review
├── Step 11: Monitor review status
├── Step 12: Respond to AI requests
├── Step 13: Receive decision
└── Verification: SE letter received?

### Required Sections (21 CFR 807.87)

| Section | Content |
|---------|---------|
| Cover Letter | Submission type, device ID, contact info |
| Form 3514 | CDRH premarket review cover sheet |
| Device Description | Physical description, principles of operation |
| Indications for Use | Form 3881, patient population, use environment |
| SE Comparison | Side-by-side comparison with predicate |
| Performance Testing | Bench, biocompatibility, electrical safety |
| Software Documentation | Level of concern, hazard analysis (IEC 62304) |
| Labeling | IFU, package labels, warnings |
| 510(k) Summary | Public summary of submission |

### Common RTA Issues

| Issue | Prevention |
|-------|------------|
| Missing user fee | Verify payment before submission |
| Incomplete Form 3514 | Review all fields, ensure signature |
| No predicate identified | Confirm K-number in FDA database |
| Inadequate SE comparison | Address all technological characteristics |

---

## QMSR Compliance (formerly QSR)

Quality Management System Regulation (QMSR) requirements for medical device manufacturers under 21 CFR Part 820.

> **QMSR transition (effective 2026-02-02):** FDA's QMSR final rule (89 FR 7496) amended 21 CFR Part 820 to incorporate **ISO 13485:2016 by reference** and removed the legacy QSR subsection structure (820.20–820.198). Those subsection numbers are **historical** and no longer exist in the CFR; the corresponding requirements now flow from ISO 13485:2016 clauses plus the retained/renumbered sections 820.10 (requirements, incl. the ISO 13485 incorporation), 820.35 (records), and 820.45 (device labeling and packaging controls). 21 CFR Parts 801, 803, 806, and 830 are unchanged. Legacy QSR numbers below are kept only as a familiar index, each mapped to its current ISO 13485 clause.

### Key Quality Subsystems (legacy QSR index → current ISO 13485:2016 clause)

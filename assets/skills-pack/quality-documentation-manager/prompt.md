YOU ARE USING THE SKILL "quality-documentation-manager" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Quality Documentation Manager

Document control system design and management for ISO 13485-compliant quality management systems, including numbering conventions, approval workflows, change control, and electronic record compliance.

---

## Table of Contents

- [Document Control Workflow](#document-control-workflow)
- [Document Numbering System](#document-numbering-system)
- [Approval and Review Process](#approval-and-review-process)
- [Change Control Process](#change-control-process)
- [21 CFR Part 11 Compliance](#21-cfr-part-11-compliance)
- [Reference Documentation](#reference-documentation)
- [Tools](#tools)

---

## Document Control Workflow

Implement document control from creation through obsolescence:

1. Assign document number per numbering procedure
2. Create document using controlled template
3. Route for review to required reviewers
4. Address review comments and document responses
5. Obtain required approval signatures
6. Assign effective date and distribute
7. Update Document Master List
8. **Validation:** Document accessible at point of use; obsolete versions removed

### Document Lifecycle Stages

| Stage | Definition | Actions Required |
|-------|------------|------------------|
| Draft | Under creation or revision | Author editing, not for use |
| Review | Circulated for review | Reviewers provide feedback |
| Approved | All signatures obtained | Ready for training/distribution |
| Effective | Training complete, released | Available for use |
| Superseded | Replaced by newer revision | Remove from active use |
| Obsolete | No longer applicable | Archive per retention schedule |

### Document Types and Prefixes

| Prefix | Document Type | Typical Content |
|--------|---------------|-----------------|
| QM | Quality Manual | QMS overview, scope, policy |
| SOP | Standard Operating Procedure | Process-level procedures |
| WI | Work Instruction | Task-level step-by-step |
| TF | Template/Form | Controlled forms |
| SPEC | Specification | Product/process specs |
| PLN | Plan | Quality/project plans |

### Required Reviewers by Document Type

| Document Type | Required Reviewers | Required Approvers |
|---------------|-------------------|-------------------|
| SOP | Process Owner, QA | QA Manager, Process Owner |
| WI | Area Supervisor, QA | Area Manager |
| SPEC | Engineering, QA | Engineering Manager, QA |
| TF | Process Owner | QA |
| Design Documents | Design Team, QA | Design Control Authority |

---

## Document Numbering System

Assign consistent document numbers for identification and retrieval.

### Numbering Format

Standard format: `PREFIX-CATEGORY-SEQUENCE[-REVISION]`

```
Example: SOP-02-001-A

SOP = Document type (Standard Operating Procedure)
02  = Category code (Document Control)
001 = Sequential number
A   = Revision indicator

### Category Codes

| Code | Functional Area | Description |
|------|-----------------|-------------|
| 01 | Quality Management | QMS procedures, management review |
| 02 | Document Control | This area |
| 03 | Human Resources | Training, competency |
| 04 | Design & Development | Design control processes |
| 05 | Purchasing | Supplier management |
| 06 | Production | Manufacturing procedures |
| 07 | Quality Control | Inspection, testing |
| 08 | CAPA | Corrective/preventive actions |
| 09 | Risk Management | ISO 14971 processes |
| 10 | Regulatory Affairs | Submissions, compliance |

### Numbering Workflow

1. Author requests document number from Document Control
2. Document Control verifies category assignment
3. Document Control assigns next available sequence number
4. Number recorded in Document Master List
5. Author creates document using assigned number
6. **Validation:** Number format matches standard; no duplicates in Master List

### Revision Designation

| Change Type | Revision Increment | Example |
|-------------|-------------------|---------|
| Major revision | Increment number | Rev 01 → Rev 02 |
| Minor revision | Increment sub-revision | Rev 01 → Rev 01.1 |
| Administrative | No change or letter suffix | Rev 01 → Rev 01a |

---

## Approval and Review Process

Obtain required reviews and approvals before document release.

### Review Workflow

1. Author completes document draft
2. Author submits for review via routing form or DMS
3. Reviewers assigned based on document type
4. Reviewers provide comments within review period (5-10 business days)
5. Author addresses comments and documents responses
6. Author resubmits revised document
7. Approvers sign and date
8. **Validation:** All required reviewers completed; all comments addressed with documented disposition

### Comment Disposition

| Disposition | Action Required |
|-------------|-----------------|
| Accept | Incorporate comment as written |
| Accept with modification | Incorporate with changes, document rationale |
| Reject | Do not incorporate, document justification |
| Defer | Address in future revision, document reason |

### Approval Matrix

```
Document Level 1 (Policy/QM): CEO or delegate + QA Manager
Document Level 2 (SOP): Department Manager + QA Manager
Document Level 3 (WI/TF): Area Supervisor + QA Representative

### Signature Requirements

| Element | Requirement |
|---------|-------------|
| Name | Printed name of signer |
| Signature | Handwritten or electronic signature |
| Date | Date signature applied |
| Role | Function/role of signer |

---

## Change Control Process

Manage document changes systematically through review and approval.

### Change Control Workflow

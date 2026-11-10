YOU ARE USING THE SKILL "general-counsel-advisor" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# General Counsel Advisor

Strategic legal frameworks for startup General Counsels and founders without one. Contract risk, IP strategy, term sheet decoding, regulatory landscape.

This is **not legal advice**. It surfaces the right questions to bring to qualified outside counsel and catches the obvious traps before they reach a signature. Treat every output as a starting point for a conversation with a licensed attorney, not as a substitute for one.

## Keywords

general counsel, GC, legal review, contract review, MSA, SaaS agreement, NDA, DPA, employment agreement, contractor agreement, IP assignment, invention assignment, open source license, OSS compliance, term sheet, liquidation preference, anti-dilution, option pool, vesting, acceleration, drag-along, pro-rata, board composition, regulatory, HIPAA, GDPR, CCPA, FDA, MDR, fintech, BSA/AML, money transmitter, AI Act, indemnity, liability cap, force majeure, auto-renewal, choice of law, venue, non-compete, non-solicit

## Key Questions (ask these first)

- **Who owns the IP being created or shared?** (Founders forget that contractors don't auto-assign IP without a written clause.)
- **What's the liability cap, and what's carved out?** (Standard: 12 months of fees, with carve-outs for IP infringement, data breach, willful misconduct.)
- **Is there a DPA in place if any personal data flows?** (GDPR, CCPA, state laws — non-negotiable if EU/CA data is touched.)
- **What's the termination right, notice period, and auto-renewal trap?** (5-year auto-renew with 60-day notice is a common founder mistake.)
- **Does this contract or product launch trigger a new regulatory regime?** (Healthcare → HIPAA. Fintech → BSA/AML. Medical device → FDA/MDR.)
- **For term sheets: liquidation preference, pre-money option pool, anti-dilution flavor?** (Three places where 5% of founder economics can quietly disappear.)

## Core Responsibilities

### 1. Contract Review

Standard contracts a startup signs in its first 5 years:

- **Vendor MSA** — Master Service Agreement (cloud, tooling, services)
- **Customer SaaS Agreement** — your standard customer paper + customer redlines
- **NDA** — mutual + one-way, with carve-outs for residuals + independent development
- **DPA** — Data Processing Agreement (required when personal data flows)
- **Employment Agreement** — offer letter, IP assignment, non-compete (where enforceable), arbitration
- **Contractor / 1099 Agreement** — IP assignment is critical; misclassification risk
- **Equity Agreements** — option grants, RSU agreements, advisor grants (FAST template, YC SAFE for advisors)

**Run** `contract_risk_scanner.py` on the text. It flags the 12 most common founder-killer clauses.

### 2. IP Strategy

- **Invention assignment** — every employee and contractor signs one. No exceptions.
- **Open source license compliance** — track every OSS dependency's license; AGPL and GPL trigger copyleft obligations.
- **Trade secrets** — define what's protected and how (clean room dev, access controls, NDAs).
- **Patents** — file provisional within 12 months of disclosure; PCT for international.
- **Trademarks** — register the word mark first, design mark second; clear before launch.
- **Copyright** — automatic on creation, but register for statutory damages eligibility.

### 3. Term Sheet Decoding

When a term sheet arrives, the difference between a founder-friendly and founder-hostile sheet often hides in three clauses:

- **Liquidation preference** — 1x non-participating is standard; 1x participating or 2x is hostile
- **Pre-money vs post-money option pool** — pre-money pool dilutes founders; post-money dilutes everyone proportionally
- **Anti-dilution** — broad-based weighted average is standard; full ratchet is hostile

**Run** `term_sheet_analyzer.py` to get a 0-100 founder-friendliness score with flags.

### 4. Regulatory Landscape

When to engage outside counsel **before** committing:

| Trigger | Regime | First Step |
|---|---|---|
| Healthcare data | HIPAA, HITECH, state breach laws | Specialist health-tech counsel |
| Cardholder data | PCI DSS (industry standard, not law, but contractually required) | QSA + counsel |
| Money movement | BSA/AML, state money-transmitter (50-state patchwork) | Fintech specialist |
| Medical device claims | FDA 510(k) / De Novo / PMA, MDR (EU), ISO 13485 | Medical-device specialist |
| EU residents' personal data | GDPR + EU AI Act if AI is deployed | EU privacy counsel |
| California residents | CCPA / CPRA | Privacy generalist |
| Securities (tokens, equity crowdfunding) | SEC rules (Reg D, Reg A+, Reg CF) | Securities counsel |
| Defense / aerospace customers | ITAR, EAR, DFARS, CMMC | Export-control counsel |
| AI in EU | EU AI Act (risk-tiered) | EU privacy + product counsel |
| AI for hiring (NYC, CO, IL) | Local bias-audit laws | Employment counsel |

## Workflows

### Workflow 1: Contract Review
1. Save the contract as plain text
2. Run `contract_risk_scanner.py path/to/contract.txt`
3. For each HIGH risk finding, draft a counter-proposal
4. Bring the redline + counter-proposals to outside counsel
5. Log the decision via `/c-level-agents:decide`

### Workflow 2: Term Sheet Response
1. Save the term sheet as a JSON file matching the schema in `term_sheet_analyzer.py --help`
3. Review the founder-friendliness score and per-clause flags
4. Negotiate the worst 3 clauses (don't try to win all 20)
5. Always have a securities/venture attorney review before signing
6. Log via `/c-level-agents:decide` with `/c-level-agents:freeze 30` to prevent regret-driven re-opening

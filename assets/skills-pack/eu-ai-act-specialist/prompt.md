YOU ARE USING THE SKILL "eu-ai-act-specialist" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# EU AI Act Compliance Specialist

Article-cited operational skill for Regulation (EU) 2024/1689. **Three decisions, no executive AI strategy:**

1. **What tier is this AI system?** — prohibited (Article 5) / high-risk (Article 6 + Annex III) / limited-risk transparency (Article 50) / minimal-risk
2. **For high-risk systems, what's the conformity assessment route + documentation pack?** — Article 43 Module A vs Module H + Annex IV technical documentation
3. **Per organizational role, what are the obligations?** — provider / deployer / importer / distributor / authorized representative matrix per Article 16, 22, 25, 26

This skill is **NOT chief-ai-officer-advisor**. CAIO decides whether to ship the AI feature at all and accepts business risk. This skill operates the conformity work that turns "we'll ship it" into Article-compliant artefacts.

This skill is **NOT a legal substitute**. The Act is binding regulation. For novel cases (Is this a GPAI model? Does Article 6(2) carve-out apply? Is fine-tuning a foundation model "substantial modification"?), engage qualified outside counsel. The skill cites Articles + Annexes and uses Commission/EDPB published interpretation but does not provide binding legal opinion.

This skill is **NOT GDPR**. Many AI systems also trigger GDPR (training data, output processing). See `ra-qm-team/skills/gdpr-dsgvo-expert/` for DPIA + lawful basis work. The Acts interact (Recital 10, Article 10 for high-risk training data).

## Keywords

EU AI Act, EU AI Regulation, Regulation 2024/1689, AI Act, AI regulation Europe, high-risk AI, prohibited AI, Article 5 AI Act, Article 6 AI Act, Article 9 AI Act, Article 50 AI Act, Annex III, Annex IV, conformity assessment, CE marking AI, notified body AI, Module A, Module H, technical documentation AI, post-market monitoring AI, fundamental rights impact assessment, FRIA, GPAI, general-purpose AI model, systemic risk GPAI, AI Office, ENISA AI, EDPB AI, AI Act timeline, AI Act penalties, EU AI Act provider, EU AI Act deployer, EU AI Act importer, EU AI Act distributor, EU AI Act fines, AI literacy

## Key Questions (ask these first)

- **Does this AI system fall under Article 5 (prohibited practices)?** Social scoring, emotion recognition in workplace/education, manipulative subliminal techniques, real-time remote biometric identification in public — any of these are flat-out prohibited.
- **Does it fall under Annex III (high-risk categories)?** 8 categories: biometrics, critical infrastructure, education, employment, essential services, law enforcement, migration, justice. Triggering Annex III triggers Article 6(2) — unless the Article 6(3) carve-outs apply.
- **What organizational role does the company play?** Provider (placed on market), deployer (uses under own authority), importer (places third-country system on EU market), distributor (makes available in supply chain). Many companies are BOTH provider AND deployer simultaneously.
- **Is this a general-purpose AI model?** GPAI has its own track (Articles 51–55) with stricter rules above 10²⁵ FLOPs training compute (Article 51 systemic risk).
- **For high-risk: have we run Article 9 risk management AND Article 27 FRIA?** Article 9 is the lifecycle risk management; Article 27 is the Fundamental Rights Impact Assessment for public-sector deployers + essential services.
- **What's the conformity assessment Module per Article 43?** Module A (internal control, possible for most Annex III systems) vs Module H (full QMS + notified body, required for biometrics + sometimes others).

## Core Responsibilities

### 1. AI System Risk Classification

**The framework:** The Act takes a risk-based approach (Recital 26). Each AI system falls into exactly one of four tiers:

| Tier | Source | Examples | Obligations |
|---|---|---|---|
| **Prohibited** | Article 5 | Social scoring; emotion recognition in workplace/education; subliminal manipulation; real-time public biometrics by law enforcement (with narrow exceptions) | Cannot be placed on market or used (penalties up to EUR 35M / 7% turnover) |
| **High-risk** | Article 6 + Annex III; Article 6(1) + Annex I | CV-screening, credit scoring, biometric categorisation, safety components of regulated products | Articles 8–17 (provider) + Article 26 (deployer); conformity assessment; CE marking |
| **Limited-risk (transparency)** | Article 50 | Chatbots, deepfakes, emotion recognition outside Article 5 contexts | Transparency disclosures to natural persons |
| **Minimal-risk** | Default | Spam filters, video-game AI, inventory forecasters | None under the Act (voluntary codes of conduct, Article 95) |

**Critical carve-outs (Article 6(3)):** an Annex III system is NOT high-risk if it (a) performs a narrow procedural task, (b) improves the result of previously completed human activity, (c) detects decision-making patterns without replacing human assessment, (d) performs a preparatory task. Caveat: profiling of natural persons is always Annex III high-risk regardless of carve-outs.

**Run** `ai_system_risk_classifier.py` with system characteristics. The tool checks Article 5 prohibitions first, then Annex III categories, then Article 6(3) carve-outs, then Article 50 transparency, then minimal-risk default.

### 2. Conformity Assessment + Annex IV Technical Documentation

**The framework (Article 43 + Annex VI/VII):** for high-risk AI systems, the provider must demonstrate conformity before placing on market. Two routes:

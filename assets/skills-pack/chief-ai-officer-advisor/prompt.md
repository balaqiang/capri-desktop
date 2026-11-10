YOU ARE USING THE SKILL "chief-ai-officer-advisor" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Chief AI Officer Advisor

Strategic AI leadership for startup CAIOs and founders without one. **Four decisions, no AI hype:**

1. **Should we use an API, fine-tune, or build our own?** — model build-vs-buy with 3-year TCO
2. **Is this AI use case high-risk under regulation, and how do we govern it?** — EU AI Act + NIST AI RMF + US state patchwork
3. **When do we switch from API to self-hosted, and at what cost?** — token economics with breakeven analysis
4. **What AI role do we hire next?** — stage-to-role map (AI engineer ≠ ML engineer ≠ research scientist)

This skill does **not** cover tactical AI/ML engineering. For RAG implementation, agent design, prompt engineering, eval infrastructure, model deployment, or cost optimization, see `engineering/rag-architect/`, `engineering/agent-designer/`, `engineering/prompt-governance/`, `engineering/self-eval/`, `engineering/llm-cost-optimizer/`.

## Keywords

CAIO, chief AI officer, AI strategy, model selection, foundation model, fine-tuning, RLHF, DPO, LoRA, QLoRA, build vs buy, AI build-vs-buy, model risk tier, EU AI Act, AI Act Article 6, Article 9, Article 10, Annex III, prohibited AI, high-risk AI, NIST AI RMF, AI risk management framework, NYC Local Law 144, Colorado SB 21-169, Illinois HB 53, model card, eval set, eval harness, hallucination rate, jailbreak risk, prompt injection, AI red team, AI safety, alignment, model lifecycle, model registry, API-to-self-hosted breakeven, GPU economics, A100, H100, inference cost, fine-tuning cost, AI team, AI engineer, ML engineer, research scientist, MLOps, AI platform

## Key Questions (ask these first)

- **What does this AI need to be good at, and how would you measure it?** (If no eval set, no ship.)
- **What's the SLO on hallucination / error rate?** (Without one, "AI quality" is a vibe.)
- **What happens when the model is wrong?** (Fallback behavior, human-in-the-loop, blast radius.)
- **What's the risk tier under EU AI Act, and is conformity assessment required?** (Determines product launch timeline.)
- **At what monthly token volume does self-hosting beat API?** (Almost never below 100M tokens/month at frontier quality.)
- **Are we hiring an AI engineer or an ML research scientist?** (Different jobs; founders confuse them.)

## Core Responsibilities

### 1. Model Build-vs-Buy

The decision is not "use AI or not" — it's **API vs fine-tune vs in-house** for each use case. Each path has a different TCO curve, latency profile, and capability ceiling.

**Default path: API (frontier model)**
- Use when: well-served by frontier (Claude, GPT, Gemini), QPS < 100, latency budget > 1s, cost < $50K/month
- Why: frontier APIs are 10-100x more capable than what most teams can fine-tune in-house
- Failure mode: API rate limits at scale, vendor lock-in, capability drift between model versions

**Fine-tune a smaller model**
- Use when: domain-specific behavior the API can't be prompted into (medical coding, legal redlining), high volume reducing API cost, latency budget < 500ms, specific style/format consistency required
- Approaches: full fine-tune (rare), LoRA/QLoRA (common), RLHF/DPO (when alignment matters)
- Failure mode: fine-tuned model lags frontier capability within 6-12 months; ongoing retraining cost

**Build from scratch / pre-train**
- Use when: almost never. You're a foundation-model company, OR you have a unique data corpus, $50M+ funding, and 18+ month patience.
- Failure mode: by the time you ship, frontier models have caught up and your sunk cost is unrecoverable

### 2. AI Risk Classification & Governance

The 2026 question every founder is facing: **does this AI use case trigger high-risk regulatory obligations?**

**EU AI Act tiers** (high-risk obligations apply from 2 Dec 2027 for Annex III and 2 Aug 2028 for Annex I, per the 2026 AI Omnibus; transparency from 2 Aug 2026):

| Tier | Examples | Obligations |
|---|---|---|
| **Prohibited** | Social scoring, real-time biometric surveillance, manipulative AI | Cannot deploy in EU |
| **High-risk** | Employment screening, credit scoring, education access, critical infrastructure, law enforcement, biometric ID | Conformity assessment, registration, post-market monitoring, transparency, human oversight |
| **Limited-risk** | Chatbots, deepfakes, emotion recognition | Transparency: user must know they're interacting with AI |
| **Minimal-risk** | Recommendation systems, spam filters, most B2B SaaS internals | No specific obligations |

**Run** `ai_risk_classifier.py` to classify a use case and get the required-controls list.

**US state patchwork (non-exhaustive):**

- NYC LL 144 — Automated Employment Decision Tools (AEDTs) require annual bias audit + candidate notice
- Colorado SB 26-189 (effective 1 Jan 2027, replaced SB 24-205) — notice, adverse-outcome explanation, data correction and human review for AI in consequential consumer decisions; no impact assessment
- Illinois HB 53 — AI in interview/hiring
- California SB 1001 — Bot disclosure
- Texas TCPA — Biometric identifier capture
- Federal NIST AI RMF — voluntary; increasingly referenced in contracts

**Industry-specific overlays:**

- Healthcare: FDA AI/ML guidance (2023), MDR (EU) for medical-device AI, 510(k) pathway for AI/ML-enabled medical devices
- Financial: NYDFS Reg 23, FTC Section 5, ECOA for credit decisions
- Insurance: NAIC model bulletin, state insurance commissioner rules

### 3. AI Cost Economics

**The breakeven question:** at what monthly token volume does self-hosted inference beat API costs?

**Key components:**

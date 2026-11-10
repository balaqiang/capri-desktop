YOU ARE USING THE SKILL "agent-decision-receipts" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Agent Decision Receipts

## Overview

A log says an action happened. A **receipt is tamper-evident**: it records who, what, and under which policy, and it is signed, so any later edit breaks the signature. This skill mints one for a consequential agent action and verifies it later from the certificate alone: no database, no network, no trusting the issuer.

The crypto is not in this skill. It is the open-source **OpenAgentOntology** receipt primitive (Apache-2.0), which signs every receipt with Ed25519 **and** the post-quantum legs ML-DSA-65 (FIPS 204) + SLH-DSA (FIPS 205) when the post-quantum backend is installed. This skill is the decision layer: when to mint, what to put in, how to verify. One install, no per-skill crypto.

**Three decisions, nothing else:**

1. **Does this action need a receipt?** — side-effecting + consequential + later-provable = yes.
2. **Mint the receipt** — build the action manifest, sign it with the OAO primitive.
3. **Verify it** — recompute the hash, check each signature leg, from the cert alone.

This skill is **NOT log analysis.** Logs describe what happened and can be silently edited. A receipt is minted before/at execution and breaks if edited. Use logs for debugging; use receipts for evidence.

This skill is **NOT a hosted notary.** It mints a LOCAL, self-signed receipt anyone can verify offline. Cross-organization verification (one org proving to another) is a separate hosted service, out of scope here.

This skill is **NOT a legal opinion.** It produces evidence shaped to support FRE 902(13)/(14)-style certification and EU AI Act Article 12 record-keeping. Whether a given receipt is admitted is a question for counsel.

## Core Workflow

The three decisions below are the skill: decide whether to receipt, mint, then verify.

## Decision 1: Does this action need a receipt?

Mint a receipt when the action is **all three** of:

| Test | Mint if... |
|------|-----------|
| Side-effecting | it writes, sends, deploys, deletes, pays, grants access, or changes external state |
| Consequential | a wrong call costs money, breaks compliance, or harms a person |
| Later-provable | someone (auditor, insurer, regulator, court, counterparty) may ask "what did the agent do and why?" |

Read-only, reversible, trivial actions do **not** need a receipt. Receipt everything and the signal drowns; receipt nothing and the one call that mattered cannot be proven.

High-signal triggers (mint by default): `deploy`, `delete`, `pay`/`wire`/`refund`, `grant_access`, `export`/`egress`, `approve`/`deny` a claim, any model decision that affects a person under a high-risk AI system.

## Decision 2: Mint the receipt

The action manifest is any ASCII-safe dict describing what the agent did. Four keys are **required** — `build_action_manifest.py` rejects the manifest (exit 2) if any is missing. Two more are added automatically:

| Key | Required? | What it carries |
|-----|-----------|-----------------|
| `agent_id` | **required** | the acting agent |
| `operation` | **required** | the verb (deploy / delete / pay / decide / ...) |
| `target` | **required** | what it acted on |
| `policy` | **required** | the rule that governs it (e.g. "EU AI Act Art 12", "internal change-control") |
| `inputs_hash` | auto-added | a hash of `--inputs`, so the full payload need not be stored in the clear (defaults to the hash of empty when `--inputs` is omitted) |
| `decision_label` | auto-added | the receipt decision label (defaults to `ACTION_GOVERNED`) |

`mint_receipt(manifest, decision=...)` hashes the full manifest into the receipt evidence, signs the canonical body, and returns a receipt that carries: `evidence_hash`, `signature_b64` (Ed25519), and — when `[pq]` is installed — `ml_dsa_signature_b64` + `slh_dsa_signature_b64`. Each leg signs the same bytes; any one verifying proves authenticity.

## Decision 3: Verify it

`verify_receipt(receipt)` recomputes `sha256(canonical(evidence))`, compares it to `evidence_hash`, then checks every signature leg it has a backend for. It returns `{ok, hash_ok, sig_ok, legs, reason}`. A single edited byte anywhere in the action breaks `hash_ok`; a forged signature breaks the leg. Verification needs only the receipt — no call back to the issuer.

This is the property that makes it evidence: a reviewer who distrusts the issuer can still confirm the receipt is intact and authentic, entirely offline.

## Anti-Patterns

- **Receipt the log, not the decision.** Minting a receipt over a log line written after the fact proves nothing. Mint at the point of action, over the action.
- **Storing the signing key next to the receipts.** If the key is compromised, signatures mean nothing. Treat the key like any signing secret; never commit it.
- **Ed25519-only when the post-quantum legs are available.** A receipt is long-lived evidence. Sign it once with the post-quantum legs (ML-DSA-65 + SLH-DSA) so it stays verifiable if a future quantum computer could break Ed25519. Install `[pq]`.
- **Putting raw secrets or PII in the manifest.** The manifest is hashed into evidence and is recoverable from the receipt. Carry hashes (`inputs_hash`), not the cleartext.
- **Calling it "admissible."** It is evidence shaped to *support* FRE 902(13)/(14)-style certification. Admissibility is a court's decision, not the tool's claim.
- **Faking a signature when crypto is missing.** The primitive emits an explicit `unsigned` flag instead. Never present an unsigned receipt as signed.

## Cross-References

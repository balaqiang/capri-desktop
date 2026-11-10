YOU ARE USING THE SKILL "mcp-oauth-triage" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# MCP OAuth Triage

**Tier:** POWERFUL · **Category:** Engineering · **Domain:** AI / Auth / Connectors

## Overview

An OAuth-backed MCP connector rarely fails at the exchange. It fails somewhere between storing what the
exchange returned and reading it back on the next call, so the visible symptom is a wall of 401s while
every dashboard says the connection is healthy.

The cost of guessing is high because five common faults share one symptom and need opposite fixes.
Rotating a client secret does nothing when the real fault is a writer and a reader disagreeing about
which key holds the token. Re-authenticating cures a poisoned auth cache for a day and hides the actual
defect. This skill exists to stop that guessing: collect three artifacts, run one classifier, fix the
class you actually have.

Use it **before** touching code, and again **before** declaring the fix done.

## When to Use

- A connector that authenticated yesterday returns 401 or 403 today with no configuration change.
- The token endpoint returns 200, but the first tool call after a refresh fails.
- Re-authenticating fixes the symptom, and the failure returns within one token lifetime.
- A multi-account install returns data belonging to the wrong account.
- A "needs auth" state persists after a successful login.
- A refresh loop hammers the token endpoint (429s, rotation churn) while the connector stays down.

Do not use this skill for first-time setup that never worked. That is a scopes, redirect URI, or client
registration problem, and it belongs with `mcp-server-builder`. This skill assumes a working state
existed and was lost.

## Features

One classifier covers five fault classes. Each row names the discriminator that separates it from its
neighbours, because the fixes are destructive to each other.

| Detector | Fires on | Confirmed by |
|---|---|---|
| Envelope check | token stored one level below where the reader looks | reader key list vs record key list |
| Expiry check | fractional TTL, zero sentinel, seconds/milliseconds confusion | failure gap equals token lifetime |
| Rotation check | more than one exchange per credential per window | stored refresh token vs last exchange result |
| Binding check | audience, issuer, or account-key mismatch | claims vs the surface's protected-resource metadata |
| Cache check | auth marker that survives a successful login | clearing the marker alone restores service |

The classifier also reports what it could not check, so a clean exit is read as "not proven broken"
rather than "proven working".

## Workflow

### Step 1: Collect three artifacts

| Artifact | What it is | Why |
|---|---|---|
| Token record | the stored JSON the connector reads back, exactly as written | reveals envelope, field types, sentinels |
| Connector log | ordered events with timestamps: exchange, store, load, call, error | reveals order, races, which side failed |
| Timing | how long after a successful call the failure appears | separates expiry semantics from binding faults |

Redact secrets. The classifier needs key names, value types, and timestamps, never the token value.

### Step 2: Run the classifier

### Step 3: Match the class to its fix

Each class has one cheap confirmation and one fix. Apply the confirmation before the fix, because the
fixes are destructive to each other: rotating credentials while the real fault is a shape mismatch
produces a second, harder incident.

#### Class A: Envelope mismatch

The exchange returns a nested payload and the reader expects flat keys, or the reverse. The token
exists, the reader cannot see it, and every health check that reads the file directly reports success.

Fix: normalise on write and keep one reader. Do not add fallbacks that probe two shapes, because they
turn a loud failure into a silent one that survives the next refactor.

#### Class B: Expiry semantics

A TTL is stored in a form the reader misinterprets: fractional `expires_in`, an `expires_at` of `0`
read as "no expiry" when it means "expired at the epoch", or a relative duration read as an absolute
timestamp.

Fix: store one absolute expiry as an integer, compute it once from the provider response, and treat
zero and missing as expired. Never treat a falsy expiry as permanent.

#### Class C: Rotation clobber

Two refresh paths run concurrently. The provider rotates the refresh token and invalidates the old one.
The losing path writes its dead token over the winner's, and the next refresh fails permanently.

Fix: one refresher per credential, guarded by a lock, with the store write inside the same critical
section as the exchange. Every other caller waits on that result instead of exchanging again.

#### Class D: Binding fault

The token is valid, unexpired, correctly stored, and one surface still rejects it: audience or resource
mismatch, issuer mismatch between environments, wrong tenant, or a multi-account install keyed by a
human-readable identifier two accounts share.

Fix: request the audience the surface actually advertises, and key stored credentials on a stable
account identifier rather than an email address or display name.

#### Class E: Poisoned negative cache

A failed handshake writes a machine-wide or organization-wide "needs authentication" marker. The marker
outlives the failure, so a later successful login does not clear it and the connector stays disabled
while every credential is valid.

Fix: scope the marker to the credential it describes, and clear it on a successful exchange. A negative
cache must never outlive the condition that produced it.

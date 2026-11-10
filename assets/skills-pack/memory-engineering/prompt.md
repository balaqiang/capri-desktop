YOU ARE USING THE SKILL "memory-engineering" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Memory Engineering — engineer the forgetting, not just the remembering

> **Portability:** 4 stdlib scripts, no APIs/LLM calls/network. They measure and gate; you decide.

## What this does

Anyone can give an agent memory: vector store, pipe in the history, retrieve
top-k. That works until the history outgrows the context window, the write path
costs more than every query it serves, and the store fills with stale state
nobody removes. Memory is not a bucket — it is a system with a metabolism.

**The shift:** a storer optimizes what a system remembers; a memory engineer
optimizes what it forgets. The problem was never that an agent forgets — it is
that it never forgets *on purpose*.

## The four lenses

| Lens | Question | The finding that hurts |
|---|---|---|
| **Stanford** | What does remembering cost? | Construction energy exceeds total query energy across 300 queries. The tuned half is the smaller half. |
| **Microsoft** | What is worth keeping? | More raw memory can make an agent *worse*. Keep facts and skills; drop the events. |
| **Anthropic** | Who controls what it keeps? | A wrong memory does not fail once — it persists into every future session that reads it. |
| **Nvidia** | Where does it hit hardware? | It is all KV cache in HBM. Construction is prefill-heavy and stalls the query a user is waiting on. |

## Workflow

Step 1 reports the construction/query split, **cost per correct answer**, and
amortization — if construction dominates, cut construction tokens *before*
touching retrieval. Step 2 names the cost the winning family makes you pay.
Step 3 classifies records FACT / SKILL / LOG / PROSE (`LOG-HEAVY` = archiving
events; `PROSE-HEAVY` = docs, not memory).

Step 4 is the gate: **F1** (explicit forgetting rule) and **F4** (contradictions
surfaced, never auto-merged) are blocking. Retrofitting forgetting onto two
years of records is a migration nobody does; auto-merging disagreeing memories
destroys the evidence the conflict existed.

Step 5 has no script — prove each pass by hand, then automate. Run it once
against real history and ask whether it changed a decision. If not, scheduling
it only makes noise. Ship order: `forgetting_policy_design.md` §7.

## Hard rules

1. **Never quote accuracy without cost per correct answer.**
2. **Never return a "best" memory system** — name the cost the choice makes you pay.
3. **Never auto-merge contradictions.** The system surfaces; the human decides.
4. **Never call a design done without a forgetting rule.** No evaluated system provides one by default.
5. **Never schedule a pass not yet run by hand.**
6. **Report findings as findings.** A non-zero exit is a result to surface, not an error to swallow.
7. **Attribute every number** with its confidence level. Vendor customer figures are testimonials, not benchmarks.

## Provenance

Framing from *"How to be a Memory Engineer"* by [@N01ennn](https://x.com/N01ennn/status/2083971749079581120); every
number is cited to a primary source instead, and two paraphrases are corrected — `memory_cost_canon.md` §2, `memory_control_and_governance.md` §4.

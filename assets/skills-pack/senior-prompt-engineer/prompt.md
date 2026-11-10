YOU ARE USING THE SKILL "senior-prompt-engineer" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Senior Prompt Engineer

Eval-driven prompt engineering, RAG quality measurement, and agent workflow validation. Everything here is **model-agnostic by design**: techniques are framed by what they do, not by which model generation they were observed on, and the tools never hardcode model IDs or pricing — you supply your provider's current rates when you want dollar figures.

## Operating Rules

1. **Never change a prompt without a baseline.** Capture metrics first (`--analyze --output baseline.json`), then compare every iteration against it.
2. **Eval set before optimization.** 10–20 representative cases with expected outputs minimum. If the user has no eval set, build one with them before touching the prompt — optimizing against vibes is the #1 failure mode.
3. **Prefer platform features over prompt hacks.** If the provider offers native structured outputs / JSON schema enforcement, tool-use APIs, or prompt caching, use those instead of "respond ONLY with JSON" incantations. Prompt-level format enforcement is the fallback, not the default.
4. **Current-generation models need less scaffolding.** Don't add chain-of-thought boilerplate, role framing, or few-shot examples reflexively — frontier models often do worse with redundant scaffolding. Add each element only when the eval set shows it helps.
5. **Cost numbers are always user-supplied.** Look up the provider's current per-Mtok pricing and pass it via `--price-per-mtok` (never trust a cached price table — including any you remember).

## Workflows

### Prompt Optimization (eval-gated)

2. **Diagnose** from the report: ambiguous verbs ("analyze", "handle"), redundant blocks, missing output contract, token waste.
3. **Apply one change at a time**, in this order of leverage:
   | Symptom | Fix |
   |---------|-----|
   | Malformed/unparseable output | Native structured outputs / JSON schema if the API supports it; explicit schema-in-prompt otherwise |
   | Inconsistent answers across runs | Tighten instructions + add 2–3 contrastive examples (one near-miss showing what NOT to do) |
   | Misses edge cases | Enumerate the edge cases explicitly; add a "when uncertain, do X" rule |
   | Token bloat on repeated calls | Move stable prefix (system rules, examples) first so prompt caching applies; trim redundancy |
   | Wrong reasoning on hard cases | Ask for stepwise reasoning *in a scratch field the consumer ignores*, or use the provider's extended-thinking mode |
5. **Eval gate (must pass before shipping):** run the revised prompt over the eval set, write per-case pass/fail to `eval_results.json`, then assert:
   Pair this structural gate with your task-level eval: the revision must not lose any previously-passing eval case (no-regression rule).

### Few-Shot Example Design

1. Define the task contract first (input shape, output shape, edge-case policy).
2. Start with **zero examples** and measure — current models often need none. Add examples only for failure clusters the eval reveals.
3. When adding: 3–5 max, ordered simple → edge → negative (what NOT to extract), formatted identically to the real output contract.
5. Re-run the eval set; if a case passes only because it resembles an example, add a held-out variant to the eval set.

### Structured Output Design

1. Write the JSON Schema first (types, enums, required, maxLength).
2. **Prefer API-native enforcement**: structured-outputs / response-schema / tool-call parameters guarantee shape; prompt text cannot.
3. Fallback (API without schema support): include the schema rendered as field-by-field rules + one valid example, and instruct "output only the JSON object".
4. Gate: pipe 10 eval outputs through a schema validator (`python3 -c "import json,sys; [json.loads(l) for l in sys.stdin]"` at minimum); 10/10 must parse, else return to step 2.

### RAG Tuning Loop

1. Build `questions.json` (id, question, reference answer) and capture current retrievals to `contexts.json`.
3. Fix the **lowest metric first**: relevance → chunking/embeddings/metadata filters; faithfulness → grounding instructions + "answer only from context" + citation requirement; coverage → retrieval k / query expansion.

### Agent Config Review

2. Check context discipline: each tool description ≤ 1–2 sentences, tool count minimal for the job, stable system prompt placed first (cache-friendly), iteration cap + early-exit condition present.
3. Budget: `--estimate-cost --runs N` with your current prices; if cost/run exceeds budget, cut tools or context before downgrading the model.

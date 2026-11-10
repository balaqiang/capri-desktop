YOU ARE USING THE SKILL "book-to-skill" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Book-to-Skill Converter

Turn written knowledge into an agent skill by extracting **structure**, not summaries.

A book is crystallized expertise: frameworks, principles, techniques that took years to
develop. Read once, forgotten. The workarounds all fail — PDF search returns page numbers
instead of answers, an agent handed the raw file hallucinates or drowns, reading notes rot.
This skill compiles a source into a knowledge base the agent loads on demand: a small
resident core, one chapter file at a time, and never the whole book again.

**What it produces:**

| File | Contents | Budget |
|------|----------|--------|
| `SKILL.md` | Core frameworks + chapter index + topic index | < 4,000 tokens (resident) |
| `chapters/chNN-*.md` | One summary per chapter | 800–3,000 tokens, on demand |
| `glossary.md` | Every significant term, alphabetized, with chapter | < 1,500 tokens |
| `patterns.md` | Techniques and design patterns with trade-offs | < 2,000 tokens |
| `cheatsheet.md` | Decision rules, thresholds, trade-off matrices | < 1,200 tokens |

**Beyond books:** anything referenced often enough to be worth memorizing — internal
documentation, brand systems, standards, specs, research clusters, a folder of RFCs.

---

## Philosophy

**Extract structure, not summaries.** A skill is not a book report. It is a toolkit of
named frameworks, actionable principles, step-by-step techniques, anti-patterns, and the
author's voice.

**Preserve the author's precision.** Framework names are interfaces. "The 5 Whys" is not
interchangeable with "ask why a few times" — the exact formulation is what makes lookup work.

**Layer depth appropriately.** A thin book gets a thin skill. A book with fifteen frameworks
gets chapter files and a real topic index.

**Never reproduce the source at length.** These are structured notes. Synthesize, compress,

---

## Modes

| Mode | Trigger | Runs |
|------|---------|------|
| **1. Full conversion** (default) | One or more paths, no special instruction | Steps 0–10 |
| **2. Analyze only** | "analyze", "just extract", "let me review first" | Steps 0–3, then stop with an extraction report |
| **3. Generate from analysis** | User supplies prior analysis notes | Steps 4–10 |
| **4. Update / fold-in** | New sources + an existing compiled skill | Steps 0–2, then the Update Workflow |
| **5. Package as plugin** | "make it a plugin", "add it to the repo" | Step 11 |

Mode 5 is this repository's addition. Upstream stops at a bare folder in a personal skills
home; Step 11 wraps that folder in a plugin package other skills and agents can route to.

---

## Hard rules

1. **Never convert a source the user cannot show you.** No web-scraping a book, no
   reconstructing a title from memory. This tool converts files that are already on disk.
2. **Pre-flight the cost before generating** (Step 2.5). Generation is the expensive part;
   the user approves it with numbers in front of them.
3. **Never dump a large source into context.** Over ~50k tokens, probe with `grep`/`sed`
   and bounded reads (Step 2.6). Re-reading a 200-page book once per chapter costs more
   than everything else in this workflow combined.
4. **Validate before anyone loads it** (Step 9.5). A generated skill is untrusted text that
   an agent will later read as instructions.
5. **Never widen the generated skill's authority.** Generated frontmatter carries `name` and
   `description` only — no `allowed-tools`, no model-invocation flags.
6. **Rights before redistribution.** Compiled notes from a copyrighted work are personal
   study notes. Packaging one as a shareable plugin requires a stated basis (Step 11).
7. **State what the skill does not cover.** Every compiled skill's Scope section names its
   boundary, so the agent says "the source doesn't cover this" instead of improvising.

---

## Pipeline

```
extract_document.py  →  analyze  →  chapter files  →  supporting files  →  SKILL.md
      (Step 2)          (Step 3)      (Step 7)          (Step 8)          (Step 9)
                                                                              ↓
                                       skill_plugin_emitter.py  ←  book_skill_validator.py
                                              (Step 11)                  (Step 9.5)

All four tools live in `scripts/` and run on the standard library alone.

---

## Run it

Every path above is a real variable, not a placeholder: run the block as written (with
`<paths>` and `$SLUG` filled in) and it works end to end. Without `--workdir` the extractor
creates a private temp directory and prints it — capture that instead.

`extract_document.py --check` reports which extractors are installed and prints the install
command for what is missing. Every tool supports `--help`, `--sample` and `--output json`.

**The full step-by-step procedure — what to ask at each step, the file templates, the
per-chapter budget matrix, and the update/fold-in workflow — is in
running a conversion.** Summary of the eleven steps:

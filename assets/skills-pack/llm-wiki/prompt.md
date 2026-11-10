YOU ARE USING THE SKILL "llm-wiki" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# LLM Wiki — Second Brain for Claude Code + Obsidian

Inspired by Andrej Karpathy's LLM Wiki pattern ([gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)). This skill turns Claude Code (or any agent CLI) into a disciplined wiki maintainer that **incrementally builds and maintains** a persistent, interlinked Obsidian vault as you feed it sources. The knowledge compounds — cross-references, contradictions, and synthesis are already there when you query.

## Core principle

Most LLM+docs workflows are **RAG**: retrieve fragments at query time, synthesize from scratch, forget. The wiki is **compounding**: sources are read once, integrated into a persistent markdown knowledge base, and kept current. You curate and ask; the LLM reads, files, cross-references, and maintains.

> Obsidian is the IDE. The LLM is the programmer. The wiki is the codebase.

## When to use

- **Personal**: track goals, health, psychology, journaling, self-improvement
- **Research**: deep dives over weeks on a topic — papers, articles, reports, evolving thesis
- **Book companion**: file chapters as you read; build a fan-wiki-style companion for characters, themes, plot threads
- **Business/team**: internal wiki fed by Slack, meeting notes, calls — LLM does maintenance nobody else wants to do
- **Competitive analysis, due diligence, trip planning, course notes, hobby deep-dives**

**Do NOT use when:** you need one-shot Q&A over a fixed document (use RAG), you don't plan to add sources over time, or you don't want Obsidian in the loop.

## Architecture (three layers)

```
vault/
├── raw/                    # Layer 1 — IMMUTABLE source of truth
│   ├── <source files>      # Articles, papers, PDFs, images, data
│   └── assets/             # Downloaded images from clipped articles
├── wiki/                   # Layer 2 — LLM-owned knowledge base
│   ├── index.md            # Content catalog (LLM updates every ingest)
│   ├── log.md              # Append-only timeline (## [YYYY-MM-DD] <op> | <title>)
│   ├── entities/           # Person/Org/Place pages
│   ├── concepts/           # Ideas, theories, frameworks
│   ├── sources/            # One summary page per ingested source
│   ├── comparisons/        # Cross-source analysis pages
│   └── synthesis/          # High-level syntheses, theses, overviews
├── CLAUDE.md               # Schema + conventions (Claude Code)
└── AGENTS.md               # Same content, for Codex/Cursor/Antigravity

- **Layer 1 (raw/)** — you own. LLM only reads; never writes.
- **Layer 2 (wiki/)** — LLM owns. It creates, updates, and cross-references pages. You read it.
- **Layer 3 (CLAUDE.md / AGENTS.md)** — the *schema*. Conventions, workflows, frontmatter rules. Co-evolved by you and the LLM.

## Three core operations

## Slash commands (this plugin ships)

| Command | Purpose |
|---|---|
| `/wiki-init` | Bootstrap a fresh vault with schema files + starter structure |
| `/wiki-ingest <path>` | Read a source, discuss, update wiki, log it |
| `/wiki-query <question>` | Search wiki, synthesize answer, offer to file back |
| `/wiki-lint` | Run health check — contradictions, orphans, stale claims, gaps |
| `/wiki-log` | Show recent log entries (uses unix tools on `log.md`) |

## Sub-agents (this plugin ships)

| Agent | When dispatched |
|---|---|
| `wiki-ingestor` | Delegated ingest flow — reads source, proposes updates, applies after your approval |
| `wiki-linter` | Runs the health-check workflow independently, reports findings |
| `wiki-librarian` | Answers queries using index-first search, synthesizes with citations |

## Cross-tool compatibility

```
CLAUDE.md       → Claude Code
AGENTS.md       → Codex CLI, Cursor, Antigravity, OpenCode, Gemini CLI
.cursorrules    → legacy Cursor (pre-AGENTS.md)

The scripts are pure Python stdlib → run identically everywhere. Only the loader file changes per tool.

## Obsidian setup (recommended)

- **Obsidian Web Clipper** — browser extension; converts web articles to markdown and drops them in `raw/`
- **Download images locally** — Settings → Files and links → Attachment folder path = `raw/assets/`. Settings → Hotkeys → bind "Download attachments for current file" to `Ctrl+Shift+D`
- **Graph view** — see hubs/orphans; essential for spotting structural problems
- **Marp plugin** — Markdown-based slide decks directly from wiki pages
- **Dataview plugin** — dynamic tables/lists over page frontmatter (tags, dates, source counts)
- **Git** — the vault is a plain markdown repo; version it

## Why this works (vs plain RAG)

| Plain RAG | LLM Wiki |
|---|---|
| Rediscover knowledge each query | Knowledge accumulates |
| Cross-references re-computed every time | Cross-references pre-written and maintained |
| Contradictions surface only if you ask | Contradictions flagged during ingest |
| Exploration disappears into chat history | Good answers re-filed as new pages |
| Scales by embeddings infrastructure | Scales by markdown + `index.md` + optional local search |

## Templates (`assets/`)

- `CLAUDE.md.template`, `AGENTS.md.template`, `.cursorrules.template` — schema loaders per tool
- `index.md.template`, `log.md.template` — starter index and log
- `page-templates/` — entity, concept, source-summary, comparison, synthesis
- `example-vault/` — small worked example you can study or copy

## Iron rule

**The LLM never edits files in `raw/`.** Ever. Sources are immutable. All LLM writes go to `wiki/`. If you need to correct a source, do it in `raw/` yourself — then re-ingest.

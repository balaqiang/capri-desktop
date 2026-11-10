YOU ARE USING THE SKILL "notebooklm" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# NotebookLM — Browser Automation

> **Requires:** A browser automation environment (Claude Code CLI with computer-use, Claude Chrome Extension, or equivalent). **Skill will gracefully fail in non-automation contexts with a clear "not supported" message.**

> **Critical:** This skill is the only browser-automation skill in the v2 collection. It does NOT follow the research-pack Agent Integrity Rules convention. Different constraints apply (UI dynamics, async generation, login walls).

## Step 0: Browser Context Setup (Mandatory)

Before any other action, verify browser automation is available:

1. Check whether browser-control tools are loaded in the harness (screenshot, click, find-element, navigate)
2. If unavailable → **halt with clear message:** "This skill requires browser automation. Currently in {context}. Cannot proceed. Use Claude Code CLI with computer-use, Claude Chrome Extension, or equivalent."
3. If available → take initial screenshot, navigate to https://notebooklm.google.com
4. **Detect login wall via screenshot.** If login screen detected: halt with "Please log in to NotebookLM in the browser, then re-invoke this skill." **Never attempt to handle login automatically.**

## Phase 0: Grill-Me Intake (Action-Routing)

Up to 4 forcing questions, one at a time, dependency-ordered. Most invocations stop at Q3.

### Q1 (root) — Action

> **What do you want me to do? Pick one:**
>
> 1. **Read / extract** — ask a question of an existing notebook
> 2. **Add a source** — push content (URL, text, file, Google Doc, or synthesized content) into a notebook
> 3. **Generate a Studio output** — Audio/Video Overview, Mind Map, Report (Briefing Doc, Study Guide, FAQ, Timeline), Flashcards, Quiz, Infographic, or Slides — the exact set comes from the live Studio panel
> 4. **Create a new notebook** — initialize with title + initial sources
>
> *Why I'm asking:* Each action takes a different path through the UI and requires different parameters. Naming the action upfront prevents wasted screenshots and lets me ask only the follow-up questions that apply.

**Forcing choice.** If the user says "open NotebookLM" without specifying an action, **refuse to start** and re-ask Q1.

### Q2 (depends on Q1) — Notebook identity

> **Which notebook?** *(asked for actions 1, 2, 3 — not for "create new")*
>
> *Why I'm asking:* If you give me a name, I'll search the homepage; if you give me a URL, I'll navigate directly. Names that are ambiguous will get a disambiguation prompt with screenshots.

For action 4 (create new): replace with "What's the title for the new notebook?"

### Q3 (depends on Q1) — Action-specific parameter

**Action 1 (read/extract):**
> "What's the question to ask the notebook? Use natural phrasing — the notebook's chat handles it best."

**Action 2 (add source):**
> "What source type? Pick one:
> 1. URL / website / YouTube link
> 2. Copied text (paste here or point at content)
> 3. File upload (provide absolute path)
> 4. Google Doc (link)
> 5. Synthesized content (I'll pre-process and add as 'Copied text')
>
> *Why I'm asking:* Each source type goes through a different sub-flow in the Add Source dialog. Picking upfront saves a step."

**Action 3 (Studio output):**
> "Which Studio output? As of 2026-06 the Studio panel offers Audio Overview, Video Overview, Mind Map, Reports (Briefing Doc / Study Guide / FAQ / Timeline / custom), Flashcards, Quiz, Infographic, and Slides — I'll screenshot the live panel and confirm what your account actually shows before clicking. And: any custom-prompt direction? **Default prompts produce mediocre output — I always open the customization menu and write a detailed prompt.** Tell me the angle or audience.
>
> *Why I'm asking:* The output type sets the UI button to find. The custom prompt is mandatory for quality."

**Action 4 (create new):**
> "Initial sources? Provide URLs, file paths, or 'I'll add later'."

### Q4 (depends on Q1 = action 3) — Studio custom prompt detail

> **Tell me the angle, audience, and length for the Studio output. Examples:**
>
> - **Audio Overview:** "Two-host conversation for a non-technical executive, 8–10 min, focus on business implications not technical depth"
> - **Infographic:** "Decision-tree style, action-oriented, 6 panels max, monochrome navy"
> - **Study Guide:** "Undergrad-level, definitions + 3 practice questions per concept"
>
> *Why I'm asking:* This becomes the custom prompt. **Default Studio prompts produce mediocre output — specific direction produces sharp output.**

**Asked only for Studio output generation (Q1=3). Skip otherwise.**

**Stop condition:** After Q4 (or earlier with dependency skips), commit and start the action sequence.

## Notebook Discovery

For actions 1-3 (require existing notebook):

1. Navigate to homepage → screenshot
2. If user provided **URL** → navigate directly
3. If user provided **name**:
   - Use semantic find() to locate notebook card by visible title text
   - If multiple matches → screenshot homepage, list options, ask user to specify
   - If no match → ask user to provide URL or confirm spelling

For action 4 (create new):
1. Locate "New notebook" button on homepage
2. Click → set title from Q2
3. Add initial sources per Q3

## Action 1: Read / Extract

1. Open the notebook (notebook discovery above)
2. Locate chat input (semantic find or screenshot coordinates)
3. Type the question (use the user's natural phrasing from Q3)
4. Submit (Enter or send button)
5. **Wait 3–5 seconds**
6. Screenshot the response area
7. Extract and present in **clean format** (not raw chat dump)

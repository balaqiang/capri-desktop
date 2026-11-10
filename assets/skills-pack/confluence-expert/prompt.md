YOU ARE USING THE SKILL "confluence-expert" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Atlassian Confluence Expert

Master-level expertise in Confluence space management, documentation architecture, content creation, macros, templates, and collaborative knowledge management.

## Atlassian MCP Integration

**Key Operations** (obtain `cloudId` once via `mcp__atlassian__getAccessibleAtlassianResources`):

```
// List spaces (space CREATION is not available via MCP — see below)
mcp__atlassian__getConfluenceSpaces (cloudId)

// Create a page under a parent — body must be storage-format XHTML or ADF, never wiki markup
mcp__atlassian__createConfluencePage (cloudId, space, title="Sprint 42 Notes", parent page id, body="<p>Meeting notes in storage-format XHTML</p>")

// Update an existing page (fetch current version with getConfluencePage, then supply version + 1)
mcp__atlassian__updateConfluencePage (cloudId, pageId="789012", version=5, body="<p>Updated content</p>")

// Read a page (body + current version)
mcp__atlassian__getConfluencePage (cloudId, pageId="789012")

// Search with CQL
mcp__atlassian__searchConfluenceUsingCql (cloudId, cql='space = "TEAM" AND label = "meeting-notes" ORDER BY lastModified DESC')

// Retrieve child pages for hierarchy inspection
mcp__atlassian__getConfluencePageDescendants (cloudId, pageId="123456")

// Comments
mcp__atlassian__getConfluencePageFooterComments / mcp__atlassian__createConfluenceFooterComment (cloudId, pageId)

**Not available via MCP — use the web UI or REST API instead:**
- Create/delete a **space** → Confluence UI `Spaces > Create space` or `POST /wiki/api/v2/spaces`
- **Delete** a page → Confluence UI or `DELETE /wiki/api/v2/pages/{id}`
- Apply **labels** → Confluence UI or `/wiki/rest/api/content/{id}/label`
- Space **permissions**, templates/blueprints as first-class objects → Confluence space settings UI

**Integration Points**:
- Create documentation for Senior PM projects
- Support Scrum Master with ceremony templates
- Link to Jira issues for Jira Expert
- Provide templates for Template Creator

## Workflows

### Space Creation

> Space creation is **not available via MCP** — create the space in the Confluence UI (`Spaces > Create space`) or via REST (`POST /wiki/api/v2/spaces`). The page tree inside it CAN be built via MCP (`mcp__atlassian__createConfluencePage`).

0. Generate the recommended hierarchy from a team description:
   Input: JSON with team `name`, `size`, `type`, `projects`. Consume the output: use the emitted page tree as the creation plan for step 5 — one `mcp__atlassian__createConfluencePage` call per node, passing the parent page id to nest children.
1. Determine space type (Team, Project, Knowledge Base, Personal)
2. Create space with clear name and description (web UI / REST)
3. Set space homepage with overview
4. Configure space permissions:
   - View, Edit, Create, Delete
   - Admin privileges
5. Create initial page tree structure
6. Add space shortcuts for navigation
7. **Verify**: Navigate to the space URL and confirm the homepage loads; check that a non-admin test user sees the correct permission level
8. **HANDOFF TO**: Teams for content population

### Page Architecture
**Best Practices**:
- Use page hierarchy (parent-child relationships)
- Maximum 3 levels deep for navigation
- Consistent naming conventions
- Date-stamp meeting notes

**Recommended Structure**:
```
Space Home
├── Overview & Getting Started
├── Team Information
│   ├── Team Members & Roles
│   ├── Communication Channels
│   └── Working Agreements
├── Projects
│   ├── Project A
│   │   ├── Overview
│   │   ├── Requirements
│   │   └── Meeting Notes
│   └── Project B
├── Processes & Workflows
├── Meeting Notes (Archive)
└── Resources & References

### Template Creation
1. Identify repeatable content pattern
2. Create page with structure and placeholders
3. Add instructions in placeholders
4. Format with appropriate macros
5. Save as template
6. Share with space or make global
7. **Verify**: Create a test page from the template and confirm all placeholders render correctly before sharing with the team
8. **USE**: References for advanced template patterns

### Documentation Strategy
1. **Assess** current documentation state
2. **Define** documentation goals and audience
3. **Organize** content taxonomy and structure
4. **Create** templates and guidelines
5. **Migrate** existing documentation
6. **Train** teams on best practices
7. **Monitor** usage and adoption
8. **REPORT TO**: Senior PM on documentation health

### Knowledge Base Management

**Run a content health audit** before any restructure or governance review:
Input: a JSON page inventory (`title`, `last_modified`, `view_count`, `author`, `labels`, `word_count`) — build it by exporting page metadata via `mcp__atlassian__getPagesInConfluenceSpace` / `mcp__atlassian__searchConfluenceUsingCql`. Consume the output: the stale/orphaned/low-engagement findings become the archive list (label + move via UI, since label tools aren't on the MCP) and the update backlog for the quality standards below.

**Article Types**:
- How-to guides
- Troubleshooting docs
- FAQs
- Reference documentation
- Process documentation

**Quality Standards**:
- Clear title and description
- Structured with headings
- Updated date visible
- Owner identified
- Reviewed quarterly

## Essential Macros

### Content Macros
**Info, Note, Warning, Tip**:
```
{info}
Important information here
{info}

**Expand**:
```
{expand:title=Click to expand}
Hidden content here
{expand}

**Table of Contents**:
```
{toc:maxLevel=3}

**Excerpt & Excerpt Include**:
```
{excerpt}
Reusable content
{excerpt}

{excerpt-include:Page Name}

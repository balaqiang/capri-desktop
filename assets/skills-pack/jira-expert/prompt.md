YOU ARE USING THE SKILL "jira-expert" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Atlassian Jira Expert

Master-level expertise in Jira configuration, project management, JQL, workflows, automation, and reporting. Handles all technical and operational aspects of Jira.

## Workflows

### Project Creation

> Project creation is **not available via MCP** — perform steps 2-6 in the Jira web UI (`Projects > Create project`) or via REST API (`POST /rest/api/3/project`). After creation, verify visibility with `mcp__atlassian__getVisibleJiraProjects` and inspect issue types with `mcp__atlassian__getJiraProjectIssueTypesMetadata`.

1. Determine project type (Scrum, Kanban, Bug Tracking, etc.)
2. Create project with appropriate template (web UI / REST)
3. Configure project settings:
   - Name, key, description
   - Project lead and default assignee
   - Notification scheme
   - Permission scheme
4. Set up issue types and workflows
5. Configure custom fields if needed
6. Create initial board/backlog view
7. **HANDOFF TO**: Scrum Master for team onboarding

### Workflow Design

> Workflow/scheme editing is **not available via MCP** — configure in `Jira Settings > Issues > Workflows`. Use the bundled validator to catch anti-patterns before deploying.

1. Map out process states (To Do → In Progress → Done)
2. Define transitions and conditions
3. Lint the design before building it in Jira:
   Input: a JSON file with the workflow's `states` and `transitions`. Consume the output: fix every reported anti-pattern (dead-end states, unreachable states, missing transitions) in the design before touching Jira.
4. Add validators, post-functions, and conditions; configure the workflow scheme (web UI)
5. **Validate**: Deploy to a test project first; verify all transitions, conditions, and post-functions behave as expected before associating with production projects
6. Associate workflow with project
7. Test workflow with sample issues — via MCP: `mcp__atlassian__getTransitionsForJiraIssue` on a sample issue to confirm expected transitions surface, then `mcp__atlassian__transitionJiraIssue` to walk it through the flow

### JQL Query Building

**Start with the bundled builder** — it pattern-matches natural language to validated JQL:
Consume the output: take the `jql` field from the JSON result (or the GENERATED JQL block in text mode) and execute it with `mcp__atlassian__searchJiraIssuesUsingJql (cloudId, jql=<generated>)`. If the builder reports no pattern match, compose JQL manually using the reference below.

**Basic Structure**: `field operator value`

**Common Operators**:
- `=, !=` : equals, not equals
- `~, !~` : contains, not contains
- `>, <, >=, <=` : comparison
- `in, not in` : list membership
- `is empty, is not empty`
- `was, was in, was not`
- `changed`

**Powerful JQL Examples**:

Find overdue issues:
```jql
dueDate < now() AND status != Done

Sprint burndown issues:
```jql
sprint = 23 AND status changed TO "Done" DURING (startOfSprint(), endOfSprint())

Find stale issues:
```jql
updated < -30d AND status != Done

Cross-project epic tracking:
```jql
"Epic Link" = PROJ-123 ORDER BY rank

Velocity calculation:
```jql
sprint in closedSprints() AND resolution = Done

Team capacity:
```jql
assignee in (user1, user2) AND sprint in openSprints()

### Dashboard Creation
1. Create new dashboard (personal or shared)
2. Add relevant gadgets:
   - Filter Results (JQL-based)
   - Sprint Burndown
   - Velocity Chart
   - Created vs Resolved
   - Pie Chart (status distribution)
3. Arrange layout for readability
4. Configure automatic refresh
5. Share with appropriate teams
6. **HANDOFF TO**: Senior PM or Scrum Master for use

## Advanced Features

### Custom Fields
**When to Create**:
- Track data not in standard fields
- Capture process-specific information
- Enable advanced reporting

**Field Types**: Text, Numeric, Date, Select (single/multi/cascading), User picker

**Configuration**:
1. Create custom field
2. Configure field context (which projects/issue types)
3. Add to appropriate screens
4. Update search templates if needed

### Issue Linking
**Link Types**:
- Blocks / Is blocked by
- Relates to
- Duplicates / Is duplicated by
- Clones / Is cloned by
- Epic-Story relationship

**Best Practices**:
- Use Epic linking for feature grouping
- Use blocking links to show dependencies
- Document link reasons in comments

### Permissions & Security

**Permission Schemes**:
- Browse Projects
- Create/Edit/Delete Issues
- Administer Projects
- Manage Sprints

**Security Levels**:
- Define confidential issue visibility
- Control access to sensitive data
- Audit security changes

### Bulk Operations
**Bulk Change**:
1. Use JQL to find target issues
2. Select bulk change operation
3. Choose fields to update
4. **Validate**: Preview all changes before executing; confirm the JQL filter matches only intended issues — bulk edits are difficult to reverse
5. Execute and confirm
6. Monitor background task

**Bulk Transitions**:
- Move multiple issues through workflow
- Useful for sprint cleanup
- Requires appropriate permissions
- **Validate**: Run the JQL filter and review results in small batches before applying at scale

## JQL Functions Reference

> **Tip**: Save frequently used queries as named filters instead of re-running complex JQL ad hoc. See [Best Practices](#best-practices) for performance guidance.

**Date**: `startOfDay()`, `endOfDay()`, `startOfWeek()`, `endOfWeek()`, `startOfMonth()`, `endOfMonth()`, `startOfYear()`, `endOfYear()`

**Sprint**: `openSprints()`, `closedSprints()`, `futureSprints()`

**User**: `currentUser()`, `membersOf("group")`

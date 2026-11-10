YOU ARE USING THE SKILL "agile-product-owner" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Agile Product Owner

Backlog management and sprint execution toolkit for product owners, including user story generation, acceptance criteria patterns, sprint planning, and velocity tracking.

---

## Table of Contents

- [What Makes This Skill Different](#what-makes-this-skill-different)
- [User Story Generation Workflow](#user-story-generation-workflow)
- [Acceptance Criteria Patterns](#acceptance-criteria-patterns)
- [Epic Breakdown Workflow](#epic-breakdown-workflow)
- [Sprint Planning Workflow](#sprint-planning-workflow)
- [Backlog Prioritization](#backlog-prioritization)
- [Reference Documentation](#reference-documentation)
- [Tools](#tools)

---

## What Makes This Skill Different

- **Capacity math that aligns with reality:** sprint capacity is based on velocity × availability factor, not hope.
- **Acceptance criteria scaled by story size:** minimum AC counts map to story points to avoid under-spec'ing large items.
- **Weighted prioritization that stays consistent:** value 40%, impact 30%, risk 15%, effort 15% keeps tradeoffs explicit.
- **Systematic epic splitting techniques:** five concrete split patterns prevent oversized stories.
- **INVEST validation baked into workflows:** every story includes a validation step, not just guidance.

## User Story Generation Workflow

Create INVEST-compliant user stories from requirements:

1. Identify the persona (who benefits from this feature)
2. Define the action or capability needed
3. Articulate the benefit or value delivered
4. Write acceptance criteria using Given-When-Then
5. Estimate story points using Fibonacci scale
6. Validate against INVEST criteria
7. Add to backlog with priority
8. **Validation:** Story passes all INVEST criteria; acceptance criteria are testable

### User Story Template

```
As a [persona],
I want to [action/capability],
So that [benefit/value].

**Example:**
```
As a marketing manager,
I want to export campaign reports to PDF,
So that I can share results with stakeholders who don't have system access.

### Story Types

| Type | Template | Example |
|------|----------|---------|
| Feature | As a [persona], I want to [action] so that [benefit] | As a user, I want to filter search results so that I find items faster |
| Improvement | As a [persona], I need [capability] to [goal] | As a user, I need faster page loads to complete tasks without frustration |
| Bug Fix | As a [persona], I expect [behavior] when [condition] | As a user, I expect my cart to persist when I refresh the page |
| Enabler | As a developer, I need to [technical task] to enable [capability] | As a developer, I need to implement caching to enable instant search |

### Persona Reference

| Persona | Typical Needs | Context |
|---------|--------------|---------|
| End User | Efficiency, simplicity, reliability | Daily feature usage |
| Administrator | Control, visibility, security | System management |
| Power User | Automation, customization, shortcuts | Expert workflows |
| New User | Guidance, learning, safety | Onboarding |

---

## Acceptance Criteria Patterns

Write testable acceptance criteria using Given-When-Then format.

### Given-When-Then Template

```
Given [precondition/context],
When [action/trigger],
Then [expected outcome].

**Examples:**
```
Given the user is logged in with valid credentials,
When they click the "Export" button,
Then a PDF download starts within 2 seconds.

Given the user has entered an invalid email format,
When they submit the registration form,
Then an inline error message displays "Please enter a valid email address."

Given the shopping cart contains items,
When the user refreshes the browser,
Then the cart contents remain unchanged.

### Acceptance Criteria Checklist

Each story should include criteria for:

| Category | Example |
|----------|---------|
| Happy Path | Given valid input, When submitted, Then success message displayed |
| Validation | Should reject input when required field is empty |
| Error Handling | Must show user-friendly message when API fails |
| Performance | Should complete operation within 2 seconds |
| Accessibility | Must be navigable via keyboard only |

### Minimum Criteria by Story Size

| Story Points | Minimum AC Count |
|--------------|------------------|
| 1-2 | 3-4 criteria |
| 3-5 | 4-6 criteria |
| 8 | 5-8 criteria |
| 13+ | Split the story |

---

## Epic Breakdown Workflow

Break epics into deliverable sprint-sized stories:

1. Define epic scope and success criteria
2. Identify all personas affected by the epic
3. List all capabilities needed for each persona
4. Group capabilities into logical stories
5. Validate each story is ≤8 points
6. Identify dependencies between stories
7. Sequence stories for incremental delivery
8. **Validation:** Each story delivers standalone value; total stories cover epic scope

### Splitting Techniques

| Technique | When to Use | Example |
|-----------|-------------|---------|
| By workflow step | Linear process | "Checkout" → "Add to cart" + "Enter payment" + "Confirm order" |
| By persona | Multiple user types | "Dashboard" → "Admin dashboard" + "User dashboard" |
| By data type | Multiple inputs | "Import" → "Import CSV" + "Import Excel" |
| By operation | CRUD functionality | "Manage users" → "Create" + "Edit" + "Delete" |
| Happy path first | Risk reduction | "Feature" → "Basic flow" + "Error handling" + "Edge cases" |

### Epic Example

**Epic:** User Dashboard

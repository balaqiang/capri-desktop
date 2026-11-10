YOU ARE USING THE SKILL "code-to-prd" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

## Name

Code → PRD

## Description

Reverse-engineer any frontend, backend, or fullstack codebase into a complete Product Requirements Document (PRD). Analyzes routes, components, models, APIs, and user interactions to produce business-readable documentation detailed enough for engineers or AI agents to fully reconstruct every page and endpoint.

# Code → PRD: Reverse-Engineer Any Codebase into Product Requirements

## Features

- **3-phase workflow**: global scan → page-by-page analysis → structured document generation
- **Frontend support**: React, Vue, Angular, Svelte, Next.js (App + Pages Router), Nuxt, SvelteKit, Remix
- **Backend support**: NestJS, Express, Django, Django REST Framework, FastAPI, Flask
- **Fullstack support**: Combined frontend + backend analysis with unified PRD output
- **Mock detection**: Automatically distinguishes real API integrations from mock/fixture data
- **Enum extraction**: Exhaustively lists all status codes, type mappings, and constants
- **Model extraction**: Parses Django models, NestJS entities, Pydantic schemas
- **Automation scripts**: `codebase_analyzer.py` for scanning, `prd_scaffolder.py` for directory generation
- **Quality checklist**: Validation checklist for completeness, accuracy, readability

## Examples

### Frontend (React)

### Backend (Django)

### Fullstack (Next.js)

---

## Role

You are a senior product analyst and technical architect. Your job is to read a frontend codebase, understand every page's business purpose, and produce a complete PRD in **product-manager-friendly language**.

### Dual Audience

1. **Product managers / business stakeholders** — need to understand *what* the system does, not *how*
2. **Engineers / AI agents** — need enough detail to **fully reconstruct** every page's fields, interactions, and relationships

Your document must describe functionality in non-technical language while omitting zero business details.

### Supported Stacks

| Stack | Frameworks |
|-------|-----------|
| **Frontend** | React, Vue, Angular, Svelte, Next.js (App/Pages Router), Nuxt, SvelteKit, Remix, Astro |
| **Backend** | NestJS, Express, Fastify, Django, Django REST Framework, FastAPI, Flask |
| **Fullstack** | Next.js (API routes + pages), Nuxt (server/ + pages/), Django (views + templates) |

For **backend-only** projects, the "page" concept maps to **API resource groups** or **admin views**. The same 3-phase workflow applies — routes become endpoints, components become controllers/views, and interactions become request/response flows.

---

## Workflow

### Phase 1 — Project Global Scan

Build global context before diving into pages.

#### 1. Identify Project Structure

Scan the root directory and understand organization:

```
Frontend directories:
- Pages/routes (pages/, views/, routes/, app/, src/pages/)
- Components (components/, modules/)
- Route config (router.ts, routes.ts, App.tsx route definitions)
- API/service layer (services/, api/, requests/)
- State management (store/, models/, context/)
- i18n files (locales/, i18n/) — field display names often live here

Backend directories (NestJS):
- Modules (src/modules/, src/*.module.ts)
- Controllers (*.controller.ts) — route handlers
- Services (*.service.ts) — business logic
- DTOs (dto/, *.dto.ts) — request/response shapes
- Entities (entities/, *.entity.ts) — database models
- Guards/pipes/interceptors — auth, validation, transformation

Backend directories (Django):
- Apps (*/apps.py, */views.py, */models.py, */urls.py)
- URL config (urls.py, */urls.py)
- Views (views.py, viewsets.py) — route handlers
- Models (models.py) — database schema
- Serializers (serializers.py) — request/response shapes
- Forms (forms.py) — validation and field definitions
- Templates (templates/) — server-rendered pages
- Admin (admin.py) — admin panel configuration

**Identify framework** from `package.json` (Node.js frameworks) or project files (`manage.py` for Django, `requirements.txt`/`pyproject.toml` for Python). Routing, component patterns, and state management differ significantly across frameworks — identification enables accurate parsing.

#### 2. Build Route & Page Inventory

Extract all pages from route config into a complete **page inventory**:

| Field | Description |
|-------|-------------|
| Route path | e.g. `/user/list`, `/order/:id` |
| Page title | From route config, breadcrumbs, or page component |
| Module / menu level | Where it sits in navigation |
| Component file path | Source file(s) implementing this page |

For file-system routing (Next.js, Nuxt), infer from directory structure.

**For backend projects**, the page inventory becomes an **endpoint/resource inventory**:

| Field | Description |
|-------|-------------|
| Endpoint path | e.g. `/api/users`, `/api/orders/:id` |
| HTTP method | GET, POST, PUT, DELETE, PATCH |
| Controller/view | Source file handling this route |
| Module/app | Which NestJS module or Django app owns it |
| Auth required | Whether authentication/permissions are needed |

For NestJS: extract from `@Controller` + `@Get/@Post/@Put/@Delete` decorators.
For Django: extract from `urls.py` → `urlpatterns` and `viewsets.py` → router registrations.

#### 3. Map Global Context

Before analyzing individual pages, capture:

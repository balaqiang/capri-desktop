YOU ARE USING THE SKILL "senior-frontend" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Senior Frontend

Frontend development patterns, performance optimization, and automation tools for React/Next.js applications.

## Table of Contents

- [Project Scaffolding](#project-scaffolding)
- [Component Generation](#component-generation)
- [Bundle Analysis](#bundle-analysis)
- [React Patterns](#react-patterns)
- [Next.js Optimization](#nextjs-optimization)
- [Accessibility and Testing](#accessibility-and-testing)

---

## Project Scaffolding

Generate a new Next.js or React project with TypeScript, Tailwind CSS, and best practice configurations.

### Workflow: Create New Frontend Project

1. Run the scaffolder with your project name and template:

2. Add optional features (auth, api, forms, testing, storybook):

3. Navigate to the project and install dependencies:

4. Start the development server:

### Scaffolder Options

| Option | Description |
|--------|-------------|
| `--template nextjs` | Next.js 14+ with App Router and Server Components |
| `--template react` | React + Vite with TypeScript |
| `--features auth` | Add NextAuth.js authentication |
| `--features api` | Add React Query + API client |
| `--features forms` | Add React Hook Form + Zod validation |
| `--features testing` | Add Vitest + Testing Library |
| `--dry-run` | Preview files without creating them |

### Generated outputs

---

## Component Generation

Generate React components with TypeScript, tests, and Storybook stories.

### Workflow: Create a New Component

1. Generate a client component:

2. Generate a server component:

3. Generate with test and story files:

4. Generate a custom hook:

### Generator Options

| Option | Description |
|--------|-------------|
| `--type client` | Client component with 'use client' (default) |
| `--type server` | Async server component |
| `--type hook` | Custom React hook |
| `--with-test` | Include test file |
| `--with-story` | Include Storybook story |
| `--flat` | Create in output dir without subdirectory |
| `--dry-run` | Preview without creating files |

---

## Bundle Analysis

Analyze package.json and project structure for bundle optimization opportunities.

### Workflow: Optimize Bundle Size

1. Run the analyzer on your project:

2. Review the health score and issues:
   ```
   Bundle Health Score: 75/100 (C)

   HEAVY DEPENDENCIES:
     moment (290KB)
       Alternative: date-fns (12KB) or dayjs (2KB)

     lodash (71KB)
       Alternative: lodash-es with tree-shaking

3. Apply the recommended fixes by replacing heavy dependencies.

4. Re-run with verbose mode to check import patterns:

### Bundle Score Interpretation

| Score | Grade | Action |
|-------|-------|--------|
| 90-100 | A | Bundle is well-optimized |
| 80-89 | B | Minor optimizations available |
| 70-79 | C | Replace heavy dependencies |
| 60-69 | D | Multiple issues need attention |
| 0-59 | F | Critical bundle size problems |

### Heavy Dependencies Detected

The analyzer identifies these common heavy packages:

| Package | Size | Alternative |
|---------|------|-------------|
| moment | 290KB | date-fns (12KB) or dayjs (2KB) |
| lodash | 71KB | lodash-es with tree-shaking |
| axios | 14KB | Native fetch or ky (3KB) |
| jquery | 87KB | Native DOM APIs |
| @mui/material | Large | shadcn/ui or Radix UI |

---

---

## React Patterns

---

## Next.js Optimization

---

## Accessibility and Testing

### Accessibility Checklist

1. **Semantic HTML**: Use proper elements (`<button>`, `<nav>`, `<main>`)
2. **Keyboard Navigation**: All interactive elements focusable
3. **ARIA Labels**: Provide labels for icons and complex widgets
4. **Color Contrast**: Minimum 4.5:1 for normal text
5. **Focus Indicators**: Visible focus states

---

## Quick Reference

---

## Resources

---

## Assumptions and Verifiable Success Criteria (Karpathy discipline)

Before this skill scaffolds a component, recommends a framework, or audits a bundle, the following four assumptions MUST be surfaced.

1. **Primary user device + network** — mobile-4G, desktop-fiber, low-end-Android, or corporate-network. Drives every perf decision.
2. **LCP target in milliseconds** — a single number, not "fast." Drives bundle budget and rendering choice.
3. **SEO-dependent vs. auth-walled** — drives rendering (SSR/SSG/RSC vs. SPA).
4. **WCAG target + named a11y owner** — AA, AAA, or best-effort. Drives a11y investment and CI gates.

**Verifiable success criteria** (Karpathy #4) — every recommendation must include:

- Core Web Vitals targets (LCP, INP, CLS) at p75 on the primary device
- A per-route JS bundle budget in KB-gzip
- A Lighthouse a11y floor + perf floor

If any of those three is not stated, the recommendation is incomplete — return to Q2 of the forcing-question library.

---

## Customization profiles

Four built-in profiles in `profiles/` calibrate every recommendation:

| Profile | When to pick | LCP target (mobile-4G p75) | Bundle budget |
|---|---|---|---|
| `next-app-router` | SaaS customer-facing, SEO + dynamic, RSC-first | 2000ms | 150 KB-gzip / route |
| `remix-or-sveltekit` | Mobile-4G primary, low-JS-first, progressive enhancement | 1500ms | 80 KB-gzip / route |
| `vite-spa` | Auth-walled app, desktop/corporate primary | 2500ms | 200 KB init + 80 KB / route |
| `astro-or-static` | Marketing / docs / blog, near-zero write, SEO-critical | 1200ms | 30 KB JS / page |

Pick a profile via:

The tool returns the best-fit profile, the runner-up tradeoff (if within 15%), the stack picks, the anti-patterns to avoid on that profile, and the required CI gates.

YOU ARE USING THE SKILL "senior-qa" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Senior QA Engineer

Test automation, coverage analysis, and quality assurance patterns for React and Next.js applications.

---

## QA Workflows

### Unit Test Generation Workflow

Use when setting up tests for new or existing React components.

**Step 1: Scan project for untested components**

**Step 2: Generate test stubs**

**Step 3: Review and customize generated tests**
```typescript
// __tests__/Button.test.tsx (generated)
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../src/components/Button';

describe('Button', () => {
  it('renders with label', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  // TODO: Add your specific test cases
});

**Step 4: Run tests and check coverage**

---

### Coverage Analysis Workflow

Use when improving test coverage or preparing for release.

**Step 1: Generate coverage report**

**Step 2: Analyze coverage gaps**

**Step 3: Identify critical paths**

**Step 4: Generate missing test stubs**

**Step 5: Verify improvement**

---

### E2E Test Setup Workflow

Use when setting up Playwright for a Next.js project.

**Step 1: Initialize Playwright (if not installed)**

**Step 2: Scaffold E2E tests from routes**

**Step 3: Configure authentication fixtures**
```typescript
// e2e/fixtures/auth.ts (generated)
import { test as base } from '@playwright/test';

export const test = base.extend({
  authenticatedPage: async ({ page }, use) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    await use(page);
  },
});

**Step 4: Run E2E tests**

**Step 5: Add to CI pipeline**
```yaml
# .github/workflows/e2e.yml
- name: "run-e2e-tests"
  run: npx playwright test
- name: "upload-report"
  uses: actions/upload-artifact@v4
  with:
    name: "playwright-report"
    path: playwright-report/

---

## Common Patterns Quick Reference

### React Testing Library Queries

```typescript
// Preferred (accessible)
screen.getByRole('button', { name: /submit/i })
screen.getByLabelText(/email/i)
screen.getByPlaceholderText(/search/i)

// Fallback
screen.getByTestId('custom-element')

### Async Testing

```typescript
// Wait for element
await screen.findByText(/loaded/i);

// Wait for removal
await waitForElementToBeRemoved(() => screen.queryByText(/loading/i));

// Wait for condition
await waitFor(() => {
  expect(mockFn).toHaveBeenCalled();
});

### Mocking with MSW

```typescript
import { rest } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  rest.get('/api/users', (req, res, ctx) => {
    return res(ctx.json([{ id: 1, name: "john" }]));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

### Playwright Locators

```typescript
// Preferred
page.getByRole('button', { name: "submit" })
page.getByLabel('Email')
page.getByText('Welcome')

// Chaining
page.getByRole('listitem').filter({ hasText: 'Product' })

### Coverage Thresholds (jest.config.js)

```javascript
module.exports = {
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};

---

## Common Commands

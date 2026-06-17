# IRG Playwright Test Framework

## Overview

This directory contains the Playwright test suite for the IRG Electron application.

## Quick Start

### 1. Start the dev server
```bash
cd gui
npm run dev
```

### 2. Run tests (in another terminal)
```bash
cd gui
npm test
```

### 3. View report
```bash
npm run test:report
```

## Test Commands

| Command | Description |
|---------|-------------|
| `npm test` | Run all tests (headless) |
| `npm run test:ui` | Run with Playwright UI |
| `npm run test:headed` | Run with visible browser |
| `npm run test:debug` | Run in debug mode |
| `npm run test:report` | View test report |

## Test Structure

```
tests/
├── playwright.config.ts      # Configuration
├── helpers/
│   └── fixtures.ts           # Test helpers
├── specs/
│   ├── chat.spec.ts          # Chat view tests
│   ├── tasks.spec.ts         # Tasks/Kanban tests
│   ├── proposals.spec.ts     # Proposals tests
│   ├── sessions.spec.ts      # Sessions tests
│   ├── settings.spec.ts      # Settings tests
│   └── approval.spec.ts      # Approval modal tests
└── README.md
```

## Test Coverage

### Chat View
- Page loads correctly
- Empty state shows "Ready to assist"
- Send button disabled when empty
- Can type in chat input
- Send button enables when text entered

### Tasks View
- Page loads with 5 columns
- Can create a new task
- Can open task detail panel
- Task detail shows status and priority

### Proposals View
- Page loads with 4 columns
- New Proposal button exists
- Import YAML button exists
- Can open proposal editor
- Can create a proposal

### Sessions View
- Page loads correctly
- Can search sessions
- Clear all button exists when sessions present

### Settings View
- Page loads with tabs
- LLM Configuration tab is active
- Can see provider selector
- Can see API key input
- Can see model input
- Can see base URL input
- Save button exists
- Can switch to Agents tab
- Can type in model input

### Approval Modal
- Modal has correct structure
- Data-testid attributes exist

## Writing New Tests

1. Create a new file in `specs/` (e.g., `my-feature.spec.ts`)
2. Import fixtures:
   ```typescript
   import { test, expect, navigateToView } from '../helpers/fixtures';
   ```
3. Use the `appPage` fixture for the page
4. Use `navigateToView` helper to switch views
5. Use `data-testid` attributes for element selection

## Debugging

### Visual Debugging
```bash
npm run test:ui
```

### Headed Mode
```bash
npm run test:headed
```

### Debug Mode
```bash
npm run test:debug
```

## Prerequisites

1. Node.js >= 18
2. Playwright installed (`npm install -D @playwright/test`)
3. Dev server running (`npm run dev`)

## Notes

- Tests run against `http://localhost:3001` (Next.js dev server)
- Each test starts fresh by navigating to the app
- Tests use `data-testid` attributes for reliable element selection
- Screenshots are saved on failure
- Videos are saved on first retry

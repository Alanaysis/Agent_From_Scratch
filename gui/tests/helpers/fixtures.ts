import { test as base, type Page } from '@playwright/test';

// Custom test fixtures
export const test = base.extend<{
  appPage: Page;
}>({
  appPage: async ({ page }, use) => {
    // Navigate to the app using full URL
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');

    // Wait for the app to be ready
    await page.waitForSelector('[data-testid="app-layout"]', { timeout: 30000 });

    await use(page);
  },
});

export { expect } from '@playwright/test';

/**
 * Helper to navigate to a specific view
 */
export async function navigateToView(page: Page, view: string): Promise<void> {
  const viewMap: Record<string, string> = {
    chat: '[data-testid="nav-chat"]',
    tasks: '[data-testid="nav-kanban"]',  // Sidebar uses 'kanban' not 'tasks'
    proposals: '[data-testid="nav-proposals"]',
    documents: '[data-testid="nav-documents"]',
    sessions: '[data-testid="nav-sessions"]',
    settings: '[data-testid="nav-settings"]',
  };

  const selector = viewMap[view];
  if (!selector) {
    throw new Error(`Unknown view: ${view}`);
  }

  await page.click(selector);
  await page.waitForTimeout(500);
}

/**
 * Helper to wait for loading to finish
 */
export async function waitForLoading(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="loading"]', { state: 'hidden', timeout: 10000 }).catch(() => {});
}

/**
 * Helper to get store state
 */
export async function getStoreState(page: Page): Promise<any> {
  return page.evaluate(() => {
    const store = (window as any).__store;
    return store?.getState?.();
  });
}

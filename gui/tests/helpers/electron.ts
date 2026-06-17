import { chromium, type Browser, type Page } from '@playwright/test';

/**
 * Connect to Electron app via CDP (Chrome DevTools Protocol)
 * Requires Electron to be started with --remote-debugging-port=9222
 */
export async function connectToElectron(port: number = 9222): Promise<{ browser: Browser; page: Page }> {
  const browser = await chromium.connectOverCDP(`http://localhost:${port}`);
  const context = browser.contexts()[0];
  const page = context.pages()[0];

  if (!page) {
    throw new Error('No page found in Electron context');
  }

  return { browser, page };
}

/**
 * Connect to browser mode (HTTP server on port 3002)
 */
export async function connectToBrowser(baseUrl: string = 'http://localhost:3002'): Promise<{ browser: Browser; page: Page }> {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(baseUrl);
  await page.waitForLoadState('networkidle');

  return { browser, page };
}

/**
 * Get the appropriate connection based on environment
 */
export async function getConnection(): Promise<{ browser: Browser; page: Page }> {
  const mode = process.env.TEST_MODE || 'browser';

  if (mode === 'electron') {
    return connectToElectron();
  }

  return connectToBrowser();
}

/**
 * Wait for the app to be ready
 */
export async function waitForAppReady(page: Page): Promise<void> {
  // Wait for the main content to load
  await page.waitForSelector('[data-testid="app-layout"]', { timeout: 30000 });

  // Wait for backend connection
  await page.waitForFunction(() => {
    const store = (window as any).__store;
    return store?.getState?.()?.backendConnected;
  }, { timeout: 10000 });
}

/**
 * Navigate to a specific view
 */
export async function navigateToView(page: Page, view: string): Promise<void> {
  const viewMap: Record<string, string> = {
    chat: '[data-testid="nav-chat"]',
    tasks: '[data-testid="nav-tasks"]',
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
  await page.waitForLoadState('networkidle');
}

/**
 * Take a screenshot with timestamp
 */
export async function takeScreenshot(page: Page, name: string): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({
    path: `tests/screenshots/${name}-${timestamp}.png`,
    fullPage: true,
  });
}

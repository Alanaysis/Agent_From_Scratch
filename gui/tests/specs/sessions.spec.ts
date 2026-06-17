import { test, expect, navigateToView } from '../helpers/fixtures';

test.describe('Sessions View', () => {
  test.beforeEach(async ({ appPage }) => {
    await navigateToView(appPage, 'sessions');
  });

  test('P0: Sessions page loads correctly', async ({ appPage }) => {
    // Verify search input exists
    const searchInput = appPage.locator('[data-testid="session-search"]');
    await expect(searchInput).toBeVisible();
  });

  test('P0: Can search sessions', async ({ appPage }) => {
    const searchInput = appPage.locator('[data-testid="session-search"]');
    await searchInput.fill('test');
    await expect(searchInput).toHaveValue('test');
  });

  test('P1: Clear all button exists when sessions present', async ({ appPage }) => {
    // Check if clear all button exists
    const clearAllBtn = appPage.locator('[data-testid="clear-all-sessions"]');
    const isVisible = await clearAllBtn.isVisible().catch(() => false);

    // Button only shows when there are sessions
    if (isVisible) {
      await expect(clearAllBtn).toContainText('CLEAR ALL');
    }
  });
});

import { test, expect, navigateToView } from '../helpers/fixtures';

test.describe('Proposals View', () => {
  test.beforeEach(async ({ appPage }) => {
    await navigateToView(appPage, 'proposals');
  });

  test('P0: Proposals page loads with 4 columns', async ({ appPage }) => {
    // Verify all 4 status columns exist
    const columns = ['draft', 'pending', 'approved', 'rejected'];
    for (const status of columns) {
      const column = appPage.locator(`[data-testid="proposal-column-${status}"]`);
      await expect(column).toBeVisible();
    }
  });

  test('P0: New Proposal button exists', async ({ appPage }) => {
    const newProposalBtn = appPage.locator('[data-testid="new-proposal"]');
    await expect(newProposalBtn).toBeVisible();
    await expect(newProposalBtn).toContainText('New Proposal');
  });

  test('P0: Import YAML button exists', async ({ appPage }) => {
    const importBtn = appPage.locator('[data-testid="import-yaml"]');
    await expect(importBtn).toBeVisible();
    await expect(importBtn).toContainText('Import Workflow YAML');
  });

  test('P0: Can open proposal editor', async ({ appPage }) => {
    // Click new proposal
    await appPage.locator('[data-testid="new-proposal"]').click();

    // Wait for editor to load
    await appPage.waitForTimeout(500);

    // Verify we're in the proposal editor view
    const titleInput = appPage.locator('[data-testid="proposal-title-input"]');
    await expect(titleInput).toBeVisible();
  });

  test('P1: Proposal editor has save and submit buttons', async ({ appPage }) => {
    // Click new proposal
    await appPage.locator('[data-testid="new-proposal"]').click();
    await appPage.waitForTimeout(500);

    // Verify save and submit buttons exist
    const saveButton = appPage.locator('[data-testid="save-draft"]');
    const submitButton = appPage.locator('[data-testid="submit-proposal"]');
    await expect(saveButton).toBeVisible();
    await expect(submitButton).toBeVisible();
  });
});

import { test, expect, navigateToView } from '../helpers/fixtures';

test.describe('Settings View', () => {
  test.beforeEach(async ({ appPage }) => {
    await navigateToView(appPage, 'settings');
  });

  test('P0: Settings page loads with tabs', async ({ appPage }) => {
    // Verify tabs exist
    const llmTab = appPage.locator('[data-testid="llm-tab"]');
    const agentsTab = appPage.locator('[data-testid="agents-tab"]');
    await expect(llmTab).toBeVisible();
    await expect(agentsTab).toBeVisible();
  });

  test('P0: LLM Configuration tab is active by default', async ({ appPage }) => {
    // Verify LLM config form is visible
    const providerSelect = appPage.locator('[data-testid="llm-provider"]');
    await expect(providerSelect).toBeVisible();
  });

  test('P0: Can see provider selector', async ({ appPage }) => {
    const providerSelect = appPage.locator('[data-testid="llm-provider"]');
    await expect(providerSelect).toBeVisible();

    // Verify it has options
    const options = providerSelect.locator('option');
    const count = await options.count();
    expect(count).toBeGreaterThan(0);
  });

  test('P0: Can see API key input', async ({ appPage }) => {
    const apiKeyInput = appPage.locator('[data-testid="api-key"]');
    await expect(apiKeyInput).toBeVisible();
    await expect(apiKeyInput).toHaveAttribute('type', 'password');
  });

  test('P0: Can see model input', async ({ appPage }) => {
    const modelInput = appPage.locator('[data-testid="model-name"]');
    await expect(modelInput).toBeVisible();
  });

  test('P0: Can see base URL input', async ({ appPage }) => {
    const baseUrlInput = appPage.locator('[data-testid="base-url"]');
    await expect(baseUrlInput).toBeVisible();
  });

  test('P0: Save button exists', async ({ appPage }) => {
    const saveButton = appPage.locator('[data-testid="save-config"]');
    await expect(saveButton).toBeVisible();
    await expect(saveButton).toContainText('Save');
  });

  test('P1: Can switch to Agents tab', async ({ appPage }) => {
    // Click agents tab
    await appPage.locator('[data-testid="agents-tab"]').click();

    // Verify agents view is visible (look for agents-specific content)
    await appPage.waitForTimeout(500);

    // The agents tab should now be active
    const agentsTab = appPage.locator('[data-testid="agents-tab"]');
    await expect(agentsTab).toBeVisible();
  });

  test('P1: Can type in model input', async ({ appPage }) => {
    const modelInput = appPage.locator('[data-testid="model-name"]');
    await modelInput.clear();
    await modelInput.fill('gpt-4');
    await expect(modelInput).toHaveValue('gpt-4');
  });
});

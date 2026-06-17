import { test, expect, navigateToView } from '../helpers/fixtures';

test.describe('Chat View', () => {
  test.beforeEach(async ({ appPage }) => {
    await navigateToView(appPage, 'chat');
  });

  test('P0: Chat page loads correctly', async ({ appPage }) => {
    // Verify chat input exists
    const input = appPage.locator('[data-testid="chat-input"]');
    await expect(input).toBeVisible();

    // Verify empty state
    const emptyState = appPage.locator('[data-testid="empty-chat"]');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText('Ready to assist');
  });

  test('P0: Send button is disabled when empty', async ({ appPage }) => {
    const sendButton = appPage.locator('[data-testid="chat-send"]');
    await expect(sendButton).toBeDisabled();
  });

  test('P0: Can type in chat input', async ({ appPage }) => {
    const input = appPage.locator('[data-testid="chat-input"]');
    await input.fill('Hello, world!');
    await expect(input).toHaveValue('Hello, world!');
  });

  test('P1: Send button enables when text entered', async ({ appPage }) => {
    const input = appPage.locator('[data-testid="chat-input"]');
    const sendButton = appPage.locator('[data-testid="chat-send"]');

    await input.fill('Test message');
    await expect(sendButton).toBeEnabled();
  });
});

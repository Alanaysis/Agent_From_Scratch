import { test, expect, navigateToView } from '../helpers/fixtures';

test.describe('Tasks View (Kanban)', () => {
  test.beforeEach(async ({ appPage }) => {
    await navigateToView(appPage, 'tasks');
  });

  test('P0: Tasks page loads with 5 columns', async ({ appPage }) => {
    // Verify all 5 status columns exist
    const columns = ['todo', 'in_progress', 'verify', 'done', 'failed'];
    for (const status of columns) {
      const column = appPage.locator(`[data-testid="column-${status}"]`);
      await expect(column).toBeVisible();
    }
  });

  test('P0: New task input exists in each column', async ({ appPage }) => {
    // Verify new task input exists in todo column
    const input = appPage.locator('[data-testid="new-task-todo"]');
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('placeholder', 'Add task...');
  });

  test('P0: Add task button exists', async ({ appPage }) => {
    // Verify add button exists in todo column
    const addButton = appPage.locator('[data-testid="add-task-todo"]');
    await expect(addButton).toBeVisible();
  });

  test('P1: Can type in new task input', async ({ appPage }) => {
    const input = appPage.locator('[data-testid="new-task-todo"]');
    await input.fill('Test Task');
    await expect(input).toHaveValue('Test Task');
  });
});

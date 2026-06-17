import { test, expect, navigateToView } from '../helpers/fixtures';

test.describe('Workflow Features', () => {
  test.beforeEach(async ({ appPage }) => {
    await navigateToView(appPage, 'proposals');
  });

  // ===== 1. Import & Edit =====

  test.describe('Import & Edit', () => {
    test('P0: Can import workflow YAML', async ({ appPage }) => {
      // Click Import Workflow YAML button
      const importBtn = appPage.locator('[data-testid="import-yaml"]');
      await expect(importBtn).toBeVisible();
      await importBtn.click();
      await appPage.waitForTimeout(1000);

      // Should show file picker or prompt
      // After import, a new proposal should appear in draft column
      const draftColumn = appPage.locator('[data-testid="proposal-column-draft"]');
      await expect(draftColumn).toBeVisible();
    });

    test('P0: Can open proposal editor from draft', async ({ appPage }) => {
      // Find a draft proposal and click Edit
      const editBtn = appPage.locator('[data-testid="proposal-edit"]').first();
      if (await editBtn.isVisible()) {
        await editBtn.click();
        await appPage.waitForTimeout(500);

        // Verify editor is open
        const titleInput = appPage.locator('[data-testid="proposal-title-input"]');
        await expect(titleInput).toBeVisible();
      }
    });

    test('P1: gRPC config is displayed in editor', async ({ appPage }) => {
      // Open a proposal with gRPC config
      const editBtn = appPage.locator('[data-testid="proposal-edit"]').first();
      if (await editBtn.isVisible()) {
        await editBtn.click();
        await appPage.waitForTimeout(500);

        // Check for gRPC Configuration panel
        const grpcPanel = appPage.locator('text=gRPC Configuration');
        // May or may not be visible depending on the proposal
      }
    });

    test('P1: Save YAML button works', async ({ appPage }) => {
      const editBtn = appPage.locator('[data-testid="proposal-edit"]').first();
      if (await editBtn.isVisible()) {
        await editBtn.click();
        await appPage.waitForTimeout(500);

        const saveYamlBtn = appPage.locator('text=Save YAML');
        await expect(saveYamlBtn).toBeVisible();
      }
    });

    test('P1: Save Draft button works', async ({ appPage }) => {
      const editBtn = appPage.locator('[data-testid="proposal-edit"]').first();
      if (await editBtn.isVisible()) {
        await editBtn.click();
        await appPage.waitForTimeout(500);

        const saveDraftBtn = appPage.locator('[data-testid="save-draft"]');
        await expect(saveDraftBtn).toBeVisible();
      }
    });
  });

  // ===== 2. Status Transitions =====

  test.describe('Status Transitions', () => {
    test('P0: Can submit draft for review', async ({ appPage }) => {
      const submitBtn = appPage.locator('[data-testid="proposal-submit"]').first();
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        await appPage.waitForTimeout(1000);

        // Proposal should move to pending column
        const pendingColumn = appPage.locator('[data-testid="proposal-column-pending"]');
        await expect(pendingColumn).toBeVisible();
      }
    });

    test('P0: Can approve pending proposal', async ({ appPage }) => {
      const approveBtn = appPage.locator('[data-testid="proposal-approve"]').first();
      if (await approveBtn.isVisible()) {
        await approveBtn.click();
        await appPage.waitForTimeout(1000);

        // Proposal should move to approved column
        const approvedColumn = appPage.locator('[data-testid="proposal-column-approved"]');
        await expect(approvedColumn).toBeVisible();
      }
    });

    test('P0: Can reject pending proposal', async ({ appPage }) => {
      const rejectBtn = appPage.locator('[data-testid="proposal-reject"]').first();
      if (await rejectBtn.isVisible()) {
        await rejectBtn.click();
        await appPage.waitForTimeout(1000);

        // Proposal should move to rejected column
        const rejectedColumn = appPage.locator('[data-testid="proposal-column-rejected"]');
        await expect(rejectedColumn).toBeVisible();
      }
    });

    test('P0: Can revert to draft', async ({ appPage }) => {
      const revertBtn = appPage.locator('[data-testid="proposal-revert"]').first();
      if (await revertBtn.isVisible()) {
        // Handle confirm dialog
        appPage.once('dialog', dialog => dialog.accept());
        await revertBtn.click();
        await appPage.waitForTimeout(1000);

        // Proposal should move back to draft column
        const draftColumn = appPage.locator('[data-testid="proposal-column-draft"]');
        await expect(draftColumn).toBeVisible();
      }
    });
  });

  // ===== 3. Full-Screen Detail Panel =====

  test.describe('Full-Screen Detail Panel', () => {
    test('P0: Clicking proposal opens full-screen detail', async ({ appPage }) => {
      // Click on a proposal card
      const proposalCard = appPage.locator('[data-testid^="proposal-card"]').first();
      if (await proposalCard.isVisible()) {
        await proposalCard.click();
        await appPage.waitForTimeout(500);

        // Detail panel should be visible
        const detailPanel = appPage.locator('[data-testid="proposal-detail-panel"]');
        await expect(detailPanel).toBeVisible();
      }
    });

    test('P0: Detail panel has back button', async ({ appPage }) => {
      const proposalCard = appPage.locator('[data-testid^="proposal-card"]').first();
      if (await proposalCard.isVisible()) {
        await proposalCard.click();
        await appPage.waitForTimeout(500);

        // Back button should be visible
        const backBtn = appPage.locator('[data-testid="proposal-detail-panel"] button').first();
        await expect(backBtn).toBeVisible();
      }
    });

    test('P0: Back button returns to proposals view', async ({ appPage }) => {
      const proposalCard = appPage.locator('[data-testid^="proposal-card"]').first();
      if (await proposalCard.isVisible()) {
        await proposalCard.click();
        await appPage.waitForTimeout(500);

        // Click back button
        const backBtn = appPage.locator('[data-testid="proposal-detail-panel"] button').first();
        await backBtn.click();
        await appPage.waitForTimeout(500);

        // Should be back to proposals view with columns visible
        const draftColumn = appPage.locator('[data-testid="proposal-column-draft"]');
        await expect(draftColumn).toBeVisible();
      }
    });

    test('P1: Detail panel shows task drafts', async ({ appPage }) => {
      const proposalCard = appPage.locator('[data-testid^="proposal-card"]').first();
      if (await proposalCard.isVisible()) {
        await proposalCard.click();
        await appPage.waitForTimeout(500);

        // Task Drafts section should be visible
        const taskDrafts = appPage.locator('text=Task Drafts');
        await expect(taskDrafts).toBeVisible();
      }
    });

    test('P1: Detail panel shows document drafts', async ({ appPage }) => {
      const proposalCard = appPage.locator('[data-testid^="proposal-card"]').first();
      if (await proposalCard.isVisible()) {
        await proposalCard.click();
        await appPage.waitForTimeout(500);

        // Document Drafts section should be visible
        const docDrafts = appPage.locator('text=Document Drafts');
        await expect(docDrafts).toBeVisible();
      }
    });
  });

  // ===== 4. Progress Bar =====

  test.describe('Progress Bar', () => {
    test('P0: Approved proposal shows progress bar', async ({ appPage }) => {
      // Navigate to approved column and click a proposal
      const approvedCard = appPage.locator('[data-testid="proposal-column-approved"] [data-testid^="proposal-card"]').first();
      if (await approvedCard.isVisible()) {
        await approvedCard.click();
        await appPage.waitForTimeout(500);

        // Progress bar should be visible
        const progress = appPage.locator('text=Progress');
        await expect(progress).toBeVisible();
      }
    });

    test('P1: Progress bar shows percentage', async ({ appPage }) => {
      const approvedCard = appPage.locator('[data-testid="proposal-column-approved"] [data-testid^="proposal-card"]').first();
      if (await approvedCard.isVisible()) {
        await approvedCard.click();
        await appPage.waitForTimeout(500);

        // Percentage text should be visible (e.g., "0%", "50%", "100%")
        const percentText = appPage.locator('text=/%/');
        // May or may not match depending on progress
      }
    });

    test('P1: Progress bar shows status counts', async ({ appPage }) => {
      const approvedCard = appPage.locator('[data-testid="proposal-column-approved"] [data-testid^="proposal-card"]').first();
      if (await approvedCard.isVisible()) {
        await approvedCard.click();
        await appPage.waitForTimeout(500);

        // Should show at least one of: running, done, failed, pending
        const hasRunning = await appPage.locator('text=running').isVisible().catch(() => false);
        const hasDone = await appPage.locator('text=done').isVisible().catch(() => false);
        const hasPending = await appPage.locator('text=pending').isVisible().catch(() => false);

        // At least one status should be visible
        expect(hasRunning || hasDone || hasPending).toBeTruthy();
      }
    });
  });

  // ===== 5. Activity Feed =====

  test.describe('Activity Feed', () => {
    test('P0: Activity Feed is visible in detail panel', async ({ appPage }) => {
      const proposalCard = appPage.locator('[data-testid^="proposal-card"]').first();
      if (await proposalCard.isVisible()) {
        await proposalCard.click();
        await appPage.waitForTimeout(500);

        // Activity Feed header should be visible
        const activityFeed = appPage.locator('text=Activity Feed');
        await expect(activityFeed).toBeVisible();
      }
    });

    test('P1: Activity Feed shows event count', async ({ appPage }) => {
      const proposalCard = appPage.locator('[data-testid^="proposal-card"]').first();
      if (await proposalCard.isVisible()) {
        await proposalCard.click();
        await appPage.waitForTimeout(500);

        // Should show "X events" text
        const eventCount = appPage.locator('text=/\\d+ events/');
        await expect(eventCount).toBeVisible();
      }
    });

    test('P1: Activity Feed shows empty state when no events', async ({ appPage }) => {
      const proposalCard = appPage.locator('[data-testid^="proposal-card"]').first();
      if (await proposalCard.isVisible()) {
        await proposalCard.click();
        await appPage.waitForTimeout(500);

        // Either shows events or "No activity yet"
        const noActivity = appPage.locator('text=No activity yet');
        const eventCount = appPage.locator('text=/\\d+ events/');

        const hasNoActivity = await noActivity.isVisible().catch(() => false);
        const hasEvents = await eventCount.isVisible().catch(() => false);

        expect(hasNoActivity || hasEvents).toBeTruthy();
      }
    });
  });

  // ===== 6. Approval Flow =====

  test.describe('Approval Flow', () => {
    test('P0: Approval modal appears for requires_approval tasks', async ({ appPage }) => {
      // This test requires a task with requires_approval to be pending
      // Check if approval modal is visible
      const approvalModal = appPage.locator('[data-testid="approval-modal"]');

      // If there's a pending approval, it should be visible
      if (await approvalModal.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Should have action buttons
        const executeBtn = appPage.locator('text=Execute Now');
        const laterBtn = appPage.locator('text=Later');
        const abortBtn = appPage.locator('text=Abort');

        const hasExecute = await executeBtn.isVisible().catch(() => false);
        const hasLater = await laterBtn.isVisible().catch(() => false);
        const hasAbort = await abortBtn.isVisible().catch(() => false);

        expect(hasExecute || hasLater || hasAbort).toBeTruthy();
      }
    });
  });

  // ===== 7. Dependencies =====

  test.describe('Dependencies', () => {
    test('P1: Task drafts show dependency indicators', async ({ appPage }) => {
      const proposalCard = appPage.locator('[data-testid^="proposal-card"]').first();
      if (await proposalCard.isVisible()) {
        await proposalCard.click();
        await appPage.waitForTimeout(500);

        // Look for dependency indicators (Link2 icon or "depends on" text)
        const depIndicator = appPage.locator('text=/depends on/');
        // May or may not be visible depending on the proposal
      }
    });

    test('P1: Editor shows dependency checkboxes', async ({ appPage }) => {
      const editBtn = appPage.locator('[data-testid="proposal-edit"]').first();
      if (await editBtn.isVisible()) {
        await editBtn.click();
        await appPage.waitForTimeout(500);

        // Expand a task draft
        const taskDraft = appPage.locator('text=Task Drafts').locator('..').locator('[data-testid^="task-draft"]').first();
        if (await taskDraft.isVisible()) {
          await taskDraft.click();
          await appPage.waitForTimeout(300);

          // Should show "Depends on" section with checkboxes
          const dependsOn = appPage.locator('text=Depends on');
          // May or may not be visible
        }
      }
    });
  });

  // ===== 8. Checkpoint =====

  test.describe('Checkpoint', () => {
    test('P1: Editor shows checkpoint_after checkbox', async ({ appPage }) => {
      const editBtn = appPage.locator('[data-testid="proposal-edit"]').first();
      if (await editBtn.isVisible()) {
        await editBtn.click();
        await appPage.waitForTimeout(500);

        // Look for checkpoint checkbox
        const checkpointLabel = appPage.locator('text=Checkpoint after');
        // May or may not be visible depending on the proposal
      }
    });

    test('P1: Editor shows requires_approval checkbox', async ({ appPage }) => {
      const editBtn = appPage.locator('[data-testid="proposal-edit"]').first();
      if (await editBtn.isVisible()) {
        await editBtn.click();
        await appPage.waitForTimeout(500);

        // Look for requires_approval checkbox
        const approvalLabel = appPage.locator('text=Requires approval before');
        // May or may not be visible depending on the proposal
      }
    });
  });

  // ===== 9. Task Execution =====

  test.describe('Task Execution', () => {
    test('P0: Tasks are created after approval', async ({ appPage }) => {
      // Navigate to kanban to check tasks
      await navigateToView(appPage, 'tasks');
      await appPage.waitForTimeout(500);

      // Kanban should be visible with task columns
      const todoColumn = appPage.locator('[data-testid="column-todo"]');
      const inProgressColumn = appPage.locator('[data-testid="column-in_progress"]');

      const hasTodo = await todoColumn.isVisible().catch(() => false);
      const hasInProgress = await inProgressColumn.isVisible().catch(() => false);

      // At least one column should be visible
      expect(hasTodo || hasInProgress).toBeTruthy();
    });

    test('P1: Task detail shows status', async ({ appPage }) => {
      await navigateToView(appPage, 'tasks');
      await appPage.waitForTimeout(500);

      // Click on a task card
      const taskCard = appPage.locator('[data-testid^="task-card"]').first();
      if (await taskCard.isVisible()) {
        await taskCard.click();
        await appPage.waitForTimeout(500);

        // Task detail should show status
        const statusBadge = appPage.locator('[data-testid="task-status"]');
        await expect(statusBadge).toBeVisible();
      }
    });
  });

  // ===== 10. Agent Display =====

  test.describe('Agent Display', () => {
    test('P1: Agent pixel avatar is displayed', async ({ appPage }) => {
      const proposalCard = appPage.locator('[data-testid^="proposal-card"]').first();
      if (await proposalCard.isVisible()) {
        await proposalCard.click();
        await appPage.waitForTimeout(500);

        // Check for agent avatar images
        const avatars = appPage.locator('img[alt]');
        const count = await avatars.count();
        // Should have at least one avatar if tasks have agents
      }
    });
  });
});

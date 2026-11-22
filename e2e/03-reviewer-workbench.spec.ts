import { test, expect } from '@playwright/test';

test.describe('Specialist / Reviewer Workbench Journey', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'ananya.reviewer@littlesteps.in');
    await page.fill('input[type="password"]', 'LittleSteps123!');
    await page.click('button[type="submit"]');

    // Wait until Reviewer Workbench loads
    await expect(page.getByRole('heading', { name: 'Caregiver Activity Reviews' })).toBeVisible({ timeout: 10000 });
  });

  test('Reviewer workbench displays submission queue and stats', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Caregiver Activity Reviews' })).toBeVisible();

    // Check stats cards
    await expect(page.getByText('Pending Submissions')).toBeVisible();
    await expect(page.getByText('Completed Reviews')).toBeVisible();

    // Verify presence of table or queue item
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('Reviewer can open submission detail and interact with rubric', async ({ page }) => {
    // Click "Open Review" or "View / Edit"
    const reviewBtn = page.getByRole('button', { name: /Open Review|View \/ Edit/i }).first();
    if (await reviewBtn.isVisible()) {
      await reviewBtn.click();
      await page.waitForTimeout(500);

      // Verify rubric or feedback section loaded
      await expect(page.getByText(/Rubric|Criteria|Feedback|Instructions/i).first()).toBeVisible({ timeout: 8000 });

      // Check feedback text area if present
      const feedbackArea = page.locator('textarea').first();
      if (await feedbackArea.isVisible()) {
        await feedbackArea.fill('Great calm setup and wonderful responsive pacing observed.');
      }
    }
  });

  test('Reviewer can sign out cleanly', async ({ page }) => {
    const signOutBtn = page.getByRole('button', { name: /Sign Out/i }).first();
    await expect(signOutBtn).toBeVisible();
    await signOutBtn.click();

    await expect(page.getByRole('heading', { name: /Sign in to LittleSteps/i })).toBeVisible({ timeout: 8000 });
  });
});

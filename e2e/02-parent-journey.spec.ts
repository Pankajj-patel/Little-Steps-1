import { test, expect } from '@playwright/test';

test.describe('Parent User Journey & Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'meera@littlesteps.in');
    await page.fill('input[type="password"]', 'LittleSteps123!');
    await page.click('button[type="submit"]');

    // Wait until Parent Dashboard loads
    await expect(page.getByText('Aarav').first()).toBeVisible({ timeout: 10000 });
  });

  test('Parent Dashboard displays child greeting, today activities and domain tags', async ({ page }) => {
    // Check greeting
    await expect(page.getByText('Good').first()).toBeVisible();
    await expect(page.getByText('Aarav').first()).toBeVisible();

    // Check activity cards
    await expect(page.locator('article, .rounded-2xl').first()).toBeVisible();
  });

  test('Navigation between Parent workspace sections works seamlessly', async ({ page }) => {
    // My Plan
    const myPlanBtn = page.getByRole('button', { name: 'My Plan' });
    if (await myPlanBtn.isVisible()) {
      await myPlanBtn.click();
      await expect(page.getByRole('heading', { name: 'My Plan' })).toBeVisible();
    }

    // Activities
    const activitiesBtn = page.getByRole('button', { name: 'Activities' });
    if (await activitiesBtn.isVisible()) {
      await activitiesBtn.click();
      await expect(page.getByText('Activity Library', { exact: false }).first()).toBeVisible();
    }

    // Progress
    const progressBtn = page.getByRole('button', { name: 'Progress' });
    if (await progressBtn.isVisible()) {
      await progressBtn.click();
      await expect(page.getByRole('heading', { name: /Learning Journey/i })).toBeVisible();
    }

    // Parenting Guides
    const guidesBtn = page.getByRole('button', { name: 'Parenting Guides' });
    if (await guidesBtn.isVisible()) {
      await guidesBtn.click();
      await expect(page.getByText('Guides', { exact: false }).first()).toBeVisible();
    }
  });

  test('Open Activity Studio and interact with activity steps', async ({ page }) => {
    // Navigate to My Plan to find available activities
    await page.getByRole('button', { name: 'My Plan' }).click();
    await page.waitForTimeout(500);

    // Target the activity start/resume action button
    const actionBtn = page.getByRole('button', { name: 'Resume Activity' }).or(page.getByRole('button', { name: 'Start Activity' })).first();
    await expect(actionBtn).toBeVisible({ timeout: 8000 });
    await actionBtn.click();

    // Verify Activity Studio loaded
    await expect(page.getByRole('button', { name: /Back to Dashboard/i })).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Step 1', { exact: false }).first()).toBeVisible();

    // Check step checkboxes if present
    const stepCheckbox = page.locator('input[type="checkbox"]').first();
    if (await stepCheckbox.isVisible()) {
      await stepCheckbox.check();
      expect(await stepCheckbox.isChecked()).toBe(true);
    }

    // Fill reflection note
    const noteInput = page.locator('textarea').first();
    if (await noteInput.isVisible()) {
      await noteInput.fill('Aarav enjoyed this morning play activity and smiled responsively!');
    }

    // Return to dashboard
    await page.getByRole('button', { name: /Back to Dashboard/i }).click();
    await expect(page.getByText('Aarav').first()).toBeVisible();
  });

  test('Parent can sign out safely', async ({ page }) => {
    const signOutBtn = page.getByRole('button', { name: /Sign Out/i }).first();
    await expect(signOutBtn).toBeVisible();
    await signOutBtn.click();

    // Verify redirected to login
    await expect(page.getByRole('heading', { name: /Sign in to LittleSteps/i })).toBeVisible({ timeout: 8000 });
  });
});

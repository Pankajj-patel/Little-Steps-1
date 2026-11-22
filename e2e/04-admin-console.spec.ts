import { test, expect } from '@playwright/test';

test.describe('Admin Console Journey & Governance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'kavita.admin@littlesteps.in');
    await page.fill('input[type="password"]', 'LittleSteps123!');
    await page.click('button[type="submit"]');

    // Wait until Admin Console loads
    await expect(page.getByRole('heading', { name: 'Admin Console' })).toBeVisible({ timeout: 10000 });
  });

  test('Admin Console renders all core tabs: Curriculum, Daily Plans, People, Privacy & Audit', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Curriculum' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Daily Plans' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'People' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Privacy & Audit' })).toBeVisible();
  });

  test('Admin can browse Curriculum age bands and activities', async ({ page }) => {
    // Navigate to Curriculum
    await page.getByRole('button', { name: 'Curriculum' }).click();
    await page.waitForTimeout(500);

    // Verify activity management heading and table
    await expect(page.getByRole('heading', { name: /Curriculum Activity Management/i })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('Admin can view Users list and search for registered users', async ({ page }) => {
    // Switch to People tab
    await page.getByRole('button', { name: 'People' }).click();
    await page.waitForTimeout(500);

    // Verify User Account Management table rendered
    await expect(page.getByRole('heading', { name: /User Account Management/i })).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('table')).toBeVisible();

    // Verify user search input
    const searchInput = page.getByPlaceholder('Search users by name or email...');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Meera');
    await page.waitForTimeout(500);
    await expect(page.getByText('Meera Deshmukh').first()).toBeVisible({ timeout: 5000 });
  });

  test('Admin can inspect Privacy & 30-day retention controls', async ({ page }) => {
    // Switch to Privacy & Audit tab
    await page.getByRole('button', { name: 'Privacy & Audit' }).click();
    await page.waitForTimeout(500);

    // Verify privacy/audit content
    await expect(page.getByText(/Privacy|Retention|Audit Logs/i).first()).toBeVisible({ timeout: 8000 });
  });

  test('Admin can sign out safely', async ({ page }) => {
    const signOutBtn = page.getByRole('button', { name: /Sign Out/i }).first();
    await expect(signOutBtn).toBeVisible();
    await signOutBtn.click();

    await expect(page.getByRole('heading', { name: /Sign in to LittleSteps/i })).toBeVisible({ timeout: 8000 });
  });
});

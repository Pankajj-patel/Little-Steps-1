import { test, expect } from '@playwright/test';

test.describe('LittleSteps Public & Authentication Journeys', () => {
  test('Home page loads with brand, hero, and navigation links', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/LittleSteps/i);
    await expect(page.getByRole('banner').getByRole('link', { name: 'LittleSteps' })).toBeVisible();

    // Check key public navigation links scoped to Main navigation
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav.getByRole('link', { name: 'About' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'How It Works' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Login' })).toBeVisible();
  });

  test('Public marketing and legal pages are accessible', async ({ page }) => {
    // About page
    await page.goto('/about');
    await expect(page.getByRole('heading', { name: /Why we built LittleSteps/i })).toBeVisible();

    // How it works
    await page.goto('/how-it-works');
    await expect(page.getByRole('heading', { name: /A step-by-step daily journey/i })).toBeVisible();

    // Approach
    await page.goto('/our-approach');
    await expect(page.getByRole('heading', { name: /Everyday home moments/i })).toBeVisible();

    // Privacy & Terms
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: /Protecting your family/i })).toBeVisible();

    await page.goto('/terms');
    await expect(page.getByRole('heading', { name: /Clear, respectful terms/i })).toBeVisible();
  });

  test('Design system showcase page is accessible', async ({ page }) => {
    await page.goto('/design-system');
    await expect(page.getByText('Buttons', { exact: false }).first()).toBeVisible();
  });

  test('Login validation shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"]', 'nonexistent@user.com');
    await page.fill('input[type="password"]', 'WrongPassword123!');
    await page.click('button[type="submit"]');

    // Verify error alert
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('alert')).toContainText('Invalid email or password');
  });

  test('Forgot password view renders properly', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send Reset Link' })).toBeVisible();
  });
});

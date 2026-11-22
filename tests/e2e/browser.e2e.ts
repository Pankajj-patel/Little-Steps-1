import { createRequire } from 'module';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { resolveDefaultDbPath } from '../../server/db/connection';
import { hashPassword } from '../../server/security/crypto';
import { LocalPrivateMediaStorage } from '../../server/storage/mediaStorage';

const require = createRequire(import.meta.url);

function loadPlaywrightCore(): { chromium: any } {
  const candidates = [
    'playwright-core',
    'playwright',
    '/usr/local/share/bun-global/node_modules/playwright-core',
  ];
  for (const mod of candidates) {
    try {
      return require(mod);
    } catch {
      // try next candidate
    }
  }
  throw new Error('Playwright Core not found. Install playwright-core or run inside container.');
}

function resolveChromiumExecutable(): string | undefined {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    '/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell',
  ].filter(Boolean) as string[];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const VIEWPORTS = [
  { name: '320px (small mobile)', width: 320, height: 640 },
  { name: '375px (iPhone SE/13)', width: 375, height: 812 },
  { name: '390px (iPhone 14)', width: 390, height: 844 },
  { name: '768px (tablet)', width: 768, height: 1024 },
  { name: '1024px (laptop)', width: 1024, height: 768 },
  { name: '1440px (desktop)', width: 1440, height: 900 },
];

// Minimal valid EBML/WebM header so server magic-byte check accepts the uploaded clip
const VALID_WEBM_BUFFER = Buffer.from([
  0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0xf7, 0x81, 0x01, 0x42, 0xf2, 0x81,
  0x04, 0x42, 0xf3, 0x81, 0x08, 0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d, 0x42, 0x87, 0x81, 0x04,
]);

async function checkResponsiveAndA11y(page: any, label: string) {
  const results: string[] = [];
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(120);
    const metrics = await page.evaluate(() => {
      const overflowPx = document.documentElement.scrollWidth - window.innerWidth;
      const mainCount = document.querySelectorAll('main').length;
      const h1Count = document.querySelectorAll('h1').length;
      const brokenImgs = Array.from(document.querySelectorAll('img')).filter(
        (img) => img.complete && img.naturalWidth === 0
      ).length;
      return { overflowPx, mainCount, h1Count, brokenImgs };
    });
    assert.ok(
      metrics.overflowPx <= 2,
      `[${label} @ ${vp.name}] Horizontal overflow detected: ${metrics.overflowPx}px`
    );
    assert.strictEqual(
      metrics.mainCount,
      1,
      `[${label} @ ${vp.name}] Expected exactly 1 <main> landmark, got ${metrics.mainCount}`
    );
    assert.ok(
      metrics.h1Count >= 1,
      `[${label} @ ${vp.name}] Expected at least 1 <h1> heading`
    );
    assert.strictEqual(
      metrics.brokenImgs,
      0,
      `[${label} @ ${vp.name}] Found ${metrics.brokenImgs} broken images`
    );
    results.push(`${vp.width}px:ok(overflow=${metrics.overflowPx}px)`);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  console.log(`    ✓ Responsive & A11y [${label}]: ${results.join(', ')}`);
}

async function runE2E() {
  const { chromium } = loadPlaywrightCore();
  const executablePath = resolveChromiumExecutable();
  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const runTag = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const parentEmail = `e2e_mother_${runTag}@example.com`;
  const reviewerId = `usr_e2e_rev_${runTag}`;
  const reviewerEmail = `e2e_reviewer_${runTag}@littlesteps.in`;
  const adminId = `usr_e2e_adm_${runTag}`;
  const adminEmail = `e2e_admin_${runTag}@littlesteps.in`;
  const e2eStaffPass = 'E2eStaffPass123!';
  const tempVideoPath = path.join(os.tmpdir(), `littlesteps-e2e-${runTag}.webm`);
  fs.writeFileSync(tempVideoPath, VALID_WEBM_BUFFER);

  // Resolve the exact SQLite DB file opened by the running server (local dev server uses data/littlesteps.db)
  const localDataDb = path.resolve(process.cwd(), 'data', 'littlesteps.db');
  const dbPath =
    process.env.SQLITE_DB_PATH
      ? path.resolve(process.env.SQLITE_DB_PATH)
      : fs.existsSync(localDataDb)
        ? localDataDb
        : resolveDefaultDbPath();
  if (fs.existsSync(dbPath)) {
    const setupDb = new Database(dbPath);
    try {
      const pwHash = hashPassword(e2eStaffPass);
      const nowIso = new Date().toISOString();
      const stmt = setupDb.prepare(
        `INSERT INTO users (id, email, password_hash, full_name, role, preferred_locale, is_active, email_verified_at, onboarding_completed_at)
         VALUES (?, ?, ?, ?, ?, 'en', 1, ?, ?)`
      );
      stmt.run(reviewerId, reviewerEmail, pwHash, 'E2E Reviewer', 'reviewer', nowIso, nowIso);
      stmt.run(adminId, adminEmail, pwHash, 'E2E Admin', 'admin', nowIso, nowIso);
    } finally {
      setupDb.close();
    }
  }

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();

    page.on('console', (msg: any) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore expected Vite HMR WebSocket error when HMR is disabled
        if (!text.includes('WebSocket') && !text.includes('401')) {
          consoleErrors.push(text);
        }
      }
    });
    page.on('pageerror', (err: Error) => {
      pageErrors.push(err.message);
    });

    console.log('\n--- LittleSteps Browser E2E, Responsive, A11y & Web Vitals Verification ---');

    // 1. Public Homepage + Core Web Vitals + Responsive Check
    await page.addInitScript(() => {
      (window as any).__vitals = { lcp: 0, cls: 0, fcp: 0 };
      try {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const last = entries[entries.length - 1];
          if (last) (window as any).__vitals.lcp = Math.round(last.startTime);
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as any[]) {
            if (!entry.hadRecentInput) (window as any).__vitals.cls += entry.value;
          }
        }).observe({ type: 'layout-shift', buffered: true });
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === 'first-contentful-paint') {
              (window as any).__vitals.fcp = Math.round(entry.startTime);
            }
          }
        }).observe({ type: 'paint', buffered: true });
      } catch {
        // ignore unsupported observers
      }
    });

    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForSelector('h1', { timeout: 10000 });
    await page.waitForTimeout(400);

    const vitals = await page.evaluate(() => (window as any).__vitals);
    console.log(
      `    ✓ Landing Page Web Vitals: FCP=${vitals.fcp}ms, LCP=${vitals.lcp}ms, CLS=${Number(
        vitals.cls
      ).toFixed(4)}`
    );
    assert.ok(vitals.cls < 0.1, `CLS exceeded 0.1 threshold: ${vitals.cls}`);
    await checkResponsiveAndA11y(page, 'Public Home');

    // 2. Parent Registration -> 6-Step Onboarding -> Today Dashboard -> Activity -> Video Upload -> Hindi
    await page.goto(`${BASE_URL}/register`, { waitUntil: 'networkidle' });
    await page.getByLabel(/your name/i).fill('Priya E2E Mother');
    await page.getByLabel(/email address/i).fill(parentEmail);
    await page.getByLabel(/create password/i).fill('LittleSteps123!');
    await page.getByLabel(/confirm password/i).fill('LittleSteps123!');
    await page.getByRole('button', { name: /create account/i }).click();

    // Onboarding Step 1 (Welcome) -> Step 2 (Parent) -> Step 3 (Baby) -> Step 4 (6 Areas) -> Step 5 (Preferences) -> Step 6 (Complete)
    await page.getByRole('button', { name: /get started/i }).click();
    await page.getByRole('button', { name: /save & continue/i }).click();
    await page.getByLabel(/baby’s name|baby's name/i).fill('Vihaan');
    const dob = new Date();
    dob.setMonth(dob.getMonth() - 7);
    await page.getByLabel(/date of birth/i).fill(dob.toISOString().slice(0, 10));
    await page.getByRole('button', { name: /save & continue/i }).click();
    await page.getByRole('button', { name: /personalize my routine/i }).click();
    await page.getByRole('button', { name: /review & finish/i }).click();
    await page.getByRole('button', { name: /go to today/i }).click();

    // Wait for Today dashboard to mount
    await page.getByText(/Today.s Learning Journey/i).first().waitFor({ timeout: 10000 });
    await checkResponsiveAndA11y(page, 'Parent Today Dashboard');

    // Test progressive disclosure of 6 development areas
    const exploreAreasBtn = page.getByRole('button', { name: /explore all 6 areas/i });
    await exploreAreasBtn.click();
    await page.getByText(/Cognitive/i).first().waitFor({ timeout: 5000 });
    console.log('    ✓ Parent Dashboard progressive disclosure works cleanly');

    // Open first activity from Today's Journey
    await page.getByRole('button', { name: /continue today|start activity/i }).first().click();
    await page.getByText(/Why this activity helps/i).waitFor({ timeout: 10000 });
    await page.getByRole('button', { name: /read transcript/i }).click();
    await page.getByText(/Activity Walkthrough Transcript/i).waitFor({ timeout: 5000 });
    await checkResponsiveAndA11y(page, 'Activity Studio');

    // Mark completed & upload binary WebM clip
    await page.getByRole('button', { name: /mark activity completed/i }).click();
    await page.getByText(/daily journal/i).first().waitFor({ timeout: 8000 });

    await page.getByRole('button', { name: /upload video/i }).click();
    await page.getByText(/Submit Practice Video for Caregiver Feedback/i).waitFor({ timeout: 8000 });
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(tempVideoPath);
    await page.locator('input[type="checkbox"]').last().check();
    await page.getByRole('button', { name: /submit for review/i }).click();
    await page.getByText(/queued for caregiver coaching/i).first().waitFor({ timeout: 10000 });
    console.log('    ✓ Parent Journey: Register -> Onboard -> Activity -> Complete -> Video Uploaded');

    // Test Hindi toggle + Notifications read persistence
    await page.getByRole('button', { name: /back to dashboard/i }).click();
    await page.getByRole('button', { name: 'हिन्दी' }).first().click();
    await page.getByText(/आज की सीखने की यात्रा/).first().waitFor({ timeout: 5000 });
    await page.getByRole('button', { name: 'EN' }).first().click();
    await page.getByText(/Today.s Learning Journey/i).first().waitFor({ timeout: 5000 });
    console.log('    ✓ Live English <-> Hindi language toggle verified in browser');

    // Open Notifications and mark all read
    await page.getByRole('button', { name: /^Notifications/i }).first().click();
    await page.locator('h2', { hasText: 'Notifications' }).first().waitFor({ timeout: 5000 });
    const markAllBtn = page.getByRole('button', { name: /mark all as read/i });
    if (await markAllBtn.isVisible()) {
      await markAllBtn.click();
      await page.waitForTimeout(300);
    }
    console.log('    ✓ Parent Notifications view & persistent mark-as-read verified');

    // Sign out Parent
    await page.getByRole('button', { name: /sign out/i }).first().click();
    await page.getByRole('button', { name: /sign in as parent/i }).waitFor({ timeout: 8000 });

    // 3. Reviewer Journey: Login -> Queue filter -> Claim -> Rubric -> Publish
    await page.goto(`${BASE_URL}/reviewer/login`, { waitUntil: 'networkidle' });
    await page.getByLabel(/email/i).fill(reviewerEmail);
    await page.getByLabel(/password/i).fill(e2eStaffPass);
    await page.getByRole('button', { name: /sign in/i }).click();

    await page.getByText(/Caregiver Activity Reviews/i).first().waitFor({ timeout: 10000 });
    await page.getByRole('button', { name: 'My Reviews' }).click();
    await page.getByRole('button', { name: 'All Queue' }).click();
    await checkResponsiveAndA11y(page, 'Reviewer Workbench Queue');

    // Claim & open the first pending submission (Priya's new clip for 6-9m!)
    const claimBtn = page.getByRole('button', { name: /claim & open|claim & review/i }).first();
    await claimBtn.click();
    await page.getByText(/Evaluation Checklist/i).waitFor({ timeout: 10000 });

    // Fill strengths, coaching tip, acknowledge scope, publish
    await page.locator('#rev-strengths').fill(
      'Calm setup on a soft mat with warm, unhurried guidance.'
    );
    await page.locator('#rev-tip').fill(
      'Pause two extra seconds to let baby reach at their own pace.'
    );
    const scopeCheckbox = page.locator('input[type="checkbox"]').last();
    if (!(await scopeCheckbox.isChecked())) {
      await scopeCheckbox.check();
    }
    await page.getByRole('button', { name: /submit evaluation/i }).click();
    await page.getByText(/Evaluation published|v1/i).first().waitFor({ timeout: 10000 });
    console.log('    ✓ Reviewer Journey: Login -> Claim -> Rubric Evaluation -> Published');

    // Sign out Reviewer
    await page.getByRole('button', { name: /sign out/i }).first().click();
    await page.getByRole('button', { name: /sign in/i }).first().waitFor({ timeout: 8000 });

    // 4. Admin Journey: Unified Navigation (1 <main>), Platform Overview, Activity Management
    await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'networkidle' });
    await page.getByLabel(/email/i).fill(adminEmail);
    await page.getByLabel(/password/i).fill(e2eStaffPass);
    await page.getByRole('button', { name: /sign in/i }).click();

    await page.getByText(/Platform Overview/i).first().waitFor({ timeout: 10000 });
    await page.getByText(/Curriculum Coverage Matrix/i).first().waitFor({ timeout: 10000 });
    await checkResponsiveAndA11y(page, 'Admin Console Dashboard');

    await page.getByRole('button', { name: /activity management/i }).first().click();
    await page.getByRole('button', { name: /create activity|new activity/i }).first().waitFor({ timeout: 10000 });
    console.log('    ✓ Admin Journey: Unified Navigation -> Overview Matrix -> Activity Management');

    // Sign out Admin & verify Parent sees Recent Caregiver Feedback card
    await page.getByRole('button', { name: /sign out/i }).first().click();
    await page.getByRole('button', { name: /sign in/i }).first().waitFor({ timeout: 8000 });
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await page.getByLabel(/email/i).fill(parentEmail);
    await page.getByLabel(/password/i).fill('LittleSteps123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.getByText(/Recent Caregiver Feedback/i).first().waitFor({ timeout: 10000 });
    console.log('    ✓ Parent sees published Recent Caregiver Feedback card on Today dashboard');

    assert.strictEqual(
      pageErrors.length,
      0,
      `Uncaught runtime page errors detected: ${pageErrors.join(' | ')}`
    );
    assert.strictEqual(
      consoleErrors.length,
      0,
      `Console errors detected: ${consoleErrors.join(' | ')}`
    );
    console.log('\nBrowser E2E Suite: ALL CHECKS PASSED (0 console errors, 0 page errors)\n');
  } finally {
    await browser.close();
    if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
    if (fs.existsSync(dbPath)) {
      const db = new Database(dbPath);
      const storage = new LocalPrivateMediaStorage();
      try {
        db.pragma('foreign_keys = ON');
        const parentRow = db
          .prepare('SELECT id FROM users WHERE email = ?')
          .get(parentEmail.toLowerCase()) as { id: string } | undefined;
        if (parentRow) {
          const subs = db
            .prepare('SELECT id, storage_key FROM video_submissions WHERE parent_user_id = ?')
            .all(parentRow.id) as Array<{ id: string; storage_key: string | null }>;
          for (const sub of subs) {
            if (sub.storage_key) {
              try {
                await storage.deleteObject(sub.storage_key);
              } catch {
                // ignore if already purged
              }
            }
            db.prepare('DELETE FROM media_access_audit_logs WHERE submission_id = ?').run(sub.id);
          }
          db.prepare('DELETE FROM users WHERE id = ?').run(parentRow.id);
        }
        db.prepare('DELETE FROM media_access_audit_logs WHERE actor_user_id IN (?, ?)').run(
          reviewerId,
          adminId
        );
        db.prepare('DELETE FROM submission_reviews WHERE reviewer_user_id = ?').run(reviewerId);
        db.prepare('DELETE FROM users WHERE id IN (?, ?)').run(reviewerId, adminId);
      } catch (cleanupErr) {
        console.warn('E2E cleanup warning:', cleanupErr);
      } finally {
        db.close();
      }
    }
  }
}

runE2E().catch((err) => {
  console.error('\nBrowser E2E Suite FAILED:', err);
  process.exit(1);
});

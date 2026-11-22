import { afterAll, describe, expect, test } from '../bun-test-shim';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { resolveDefaultDbPath } from '../../server/db/connection';
import { mediaStorage } from '../../server/storage/mediaStorage';

const BASE = 'http://localhost:3000/api/v1';
const CSRF_HEADERS = { 'X-Requested-With': 'LittleSteps' };
const VALID_WEBM_BYTES = new Uint8Array([
  0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0xf7, 0x81, 0x01, 0x42, 0xf2, 0x81,
  0x04, 0x42, 0xf3, 0x81, 0x08, 0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d, 0x42, 0x87, 0x81, 0x04,
]);

function extractCookie(res: Response): string {
  const raw = res.headers.get('set-cookie') || '';
  const match = /ls_session=([^;]+)/.exec(raw);
  return match ? `ls_session=${match[1]}` : '';
}

async function apiJson<T = Record<string, unknown>>(
  endpoint: string,
  options: {
    method?: string;
    cookie?: string;
    body?: unknown;
    headers?: Record<string, string>;
    omitCsrf?: boolean;
  } = {}
): Promise<{ status: number; headers: Headers; data: T }> {
  const headers: Record<string, string> = {
    ...(options.omitCsrf ? {} : CSRF_HEADERS),
    ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(options.cookie ? { Cookie: options.cookie } : {}),
    ...(options.headers ?? {}),
  };
  const res = await fetch(`${BASE}${endpoint}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, headers: res.headers, data };
}

const runTag = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const createdEmails: string[] = [];
const createdActivityIds: string[] = [];

afterAll(() => {
  // Clean up any temporary test users & activities created in SQLite so the demo DB stays clean
  const dbPath = resolveDefaultDbPath();
  if (!fs.existsSync(dbPath)) return;
  const db = new Database(dbPath);
  try {
    db.pragma('foreign_keys = ON');
    for (const email of createdEmails) {
      db.prepare('DELETE FROM users WHERE email = ?').run(email.toLowerCase());
    }
    for (const actId of createdActivityIds) {
      db.prepare('DELETE FROM activities WHERE id = ?').run(actId);
    }
  } finally {
    db.close();
  }
});

describe('Security Headers, CSRF, SQLi & Authentication Flows', () => {
  test('GET /health returns 200 with hardened security, CSP, and no-store cache headers', async () => {
    const res = await apiJson<{ status: string }>('/health');
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('ok');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('permissions-policy')).toContain('geolocation=()');
    expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(res.headers.get('cache-control')).toContain('no-store');
    expect(res.headers.get('x-powered-by')).toBeNull();
  });

  test('CSRF middleware blocks mutations without header/origin and blocks cross-origin mutations', async () => {
    const noHeader = await apiJson('/auth/login', {
      method: 'POST',
      omitCsrf: true,
      body: { email: 'meera@littlesteps.in', password: 'LittleSteps123!' },
    });
    expect(noHeader.status).toBe(403);

    const evilOrigin = await apiJson('/auth/login', {
      method: 'POST',
      headers: { Origin: 'https://evil-attacker.example' },
      body: { email: 'meera@littlesteps.in', password: 'LittleSteps123!' },
    });
    expect(evilOrigin.status).toBe(403);
  });

  test('SQL injection login probes are safely rejected via parameterized queries', async () => {
    const sqli = await apiJson('/auth/login', {
      method: 'POST',
      body: { email: "' OR '1'='1", password: "' OR '1'='1" },
    });
    expect(sqli.status).toBe(400);

    const sqliEmail = await apiJson('/auth/login', {
      method: 'POST',
      body: { email: "admin' OR 1=1--@littlesteps.in", password: 'wrong' },
    });
    expect([400, 401]).toContain(sqliEmail.status);

    // Valid email with SQL injection payload in password reaches parameterized query safely -> 401
    const sqliValidEmail = await apiJson('/auth/login', {
      method: 'POST',
      body: { email: 'nobody+sqli@littlesteps.in', password: "' OR '1'='1" },
    });
    expect(sqliValidEmail.status).toBe(401);
  });

  test('Full Auth Lifecycle: Register -> Verify Email (single-use) -> Forgot/Reset Password -> Old Session Invalidated', async () => {
    const email = `qa_parent_${runTag}@example.com`;
    createdEmails.push(email);

    // Register
    const reg = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...CSRF_HEADERS },
      body: JSON.stringify({
        email,
        password: 'InitialPassword123!',
        fullName: 'QA Parent One',
        preferredLocale: 'en',
      }),
    });
    expect(reg.status).toBe(201);
    const oldCookie = extractCookie(reg);
    expect(oldCookie).toContain('ls_session=');
    const regBody = (await reg.json()) as {
      user: { id: string; role: string; emailVerifiedAt: string | null };
      verificationPreviewPath?: string;
    };
    expect(regBody.user.role).toBe('parent');
    expect(regBody.verificationPreviewPath).toBeDefined();

    // Verify email token succeeds once and fails replay
    const verifyToken = decodeURIComponent(
      (regBody.verificationPreviewPath || '').split('token=')[1] || ''
    );
    const ver1 = await apiJson<{ ok: boolean }>('/auth/verify-email', {
      method: 'POST',
      body: { token: verifyToken },
    });
    expect(ver1.status).toBe(200);
    expect(ver1.data.ok).toBe(true);

    const verReplay = await apiJson('/auth/verify-email', {
      method: 'POST',
      body: { token: verifyToken },
    });
    expect(verReplay.status).toBe(400);

    // Forgot password -> Reset password bumps sessionVersion and invalidates old cookie
    const forgot = await apiJson<{ resetPreviewPath?: string }>('/auth/forgot-password', {
      method: 'POST',
      body: { email },
    });
    expect(forgot.status).toBe(200);
    const resetToken = decodeURIComponent(
      (forgot.data.resetPreviewPath || '').split('token=')[1] || ''
    );
    const reset = await apiJson<{ ok: boolean }>('/auth/reset-password', {
      method: 'POST',
      body: { token: resetToken, newPassword: 'UpdatedPassword123!' },
    });
    expect(reset.status).toBe(200);

    // Old session cookie MUST now be rejected (401)
    const staleMe = await apiJson('/auth/me', { cookie: oldCookie });
    expect(staleMe.status).toBe(401);

    // New password logs in cleanly
    const loginRes = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...CSRF_HEADERS },
      body: JSON.stringify({ email, password: 'UpdatedPassword123!' }),
    });
    expect(loginRes.status).toBe(200);
    const freshCookie = extractCookie(loginRes);
    const freshMe = await apiJson<{ user: { email: string } }>('/auth/me', { cookie: freshCookie });
    expect(freshMe.status).toBe(200);
    expect(freshMe.data.user.email).toBe(email);

    // Logout clears cookie
    const logoutRes = await apiJson<{ ok: boolean }>('/auth/logout', {
      method: 'POST',
      cookie: freshCookie,
    });
    expect(logoutRes.status).toBe(200);
  });
});

describe('End-to-End Parent, Video Privacy, IDOR, Reviewer & Admin Journeys', () => {
  test('Complete Multi-Role Functional & Security Verification', async () => {
    // 1. Register Parent A & Parent B (for cross-account IDOR isolation checks)
    const emailA = `qa_mother_a_${runTag}@example.com`;
    const emailB = `qa_mother_b_${runTag}@example.com`;
    createdEmails.push(emailA, emailB);

    const regA = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...CSRF_HEADERS },
      body: JSON.stringify({
        email: emailA,
        password: 'Password123!',
        fullName: 'Asha Mother',
        preferredLocale: 'en',
      }),
    });
    const cookieA = extractCookie(regA);

    const regB = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...CSRF_HEADERS },
      body: JSON.stringify({
        email: emailB,
        password: 'Password123!',
        fullName: 'Neha Mother',
        preferredLocale: 'en',
      }),
    });
    const cookieB = extractCookie(regB);

    // 2. Onboarding business rule: cannot finish onboarding without adding a baby
    const blockedOnboard = await apiJson('/onboarding/complete', {
      method: 'POST',
      cookie: cookieA,
      body: {
        preferredActivityTime: 'morning',
        notificationPreference: 'daily_gentle',
        preferredLocale: 'en',
      },
    });
    expect(blockedOnboard.status).toBe(400);

    // Future DOB rejected
    const futureDob = new Date(Date.now() + 86_400_000 * 30).toISOString().slice(0, 10);
    const badBaby = await apiJson('/children', {
      method: 'POST',
      cookie: cookieA,
      body: { displayName: 'Future Baby', dateOfBirth: futureDob },
    });
    expect(badBaby.status).toBe(400);

    // Add 7-month-old baby for Parent A
    const sevenMonthsAgo = new Date();
    sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 7);
    const dob7m = sevenMonthsAgo.toISOString().slice(0, 10);
    const childRes = await apiJson<{ child: { id: string; ageGroupSlug: string } }>('/children', {
      method: 'POST',
      cookie: cookieA,
      body: { displayName: 'Kabir', dateOfBirth: dob7m },
    });
    expect(childRes.status).toBe(201);
    const childAId = childRes.data.child.id;
    expect(childRes.data.child.ageGroupSlug).toBe('6-9m');

    // Complete onboarding now succeeds
    const onboardOk = await apiJson<{ user: { onboardingCompletedAt: string | null } }>(
      '/onboarding/complete',
      {
        method: 'POST',
        cookie: cookieA,
        body: {
          preferredActivityTime: 'morning',
          notificationPreference: 'daily_gentle',
          preferredLocale: 'en',
        },
      }
    );
    expect(onboardOk.status).toBe(200);
    expect(onboardOk.data.user.onboardingCompletedAt).toBeTruthy();

    // 3. Daily learning journey & completion rules
    const journey = await apiJson<{
      items: Array<{ activity: { id: string; ageGroupSlug: string; rubricCriteria: Array<{ id: string }> } }>;
    }>(`/journey/${childAId}/today`, { cookie: cookieA });
    expect(journey.status).toBe(200);
    expect(journey.data.items.length).toBeGreaterThan(0);
    const firstAct = journey.data.items[0].activity;
    expect(firstAct.ageGroupSlug).toBe('6-9m');

    // Parent cannot self-mark 'reviewed'
    const cheatReview = await apiJson('/completions', {
      method: 'POST',
      cookie: cookieA,
      body: { childId: childAId, activityId: firstAct.id, status: 'reviewed' },
    });
    expect(cheatReview.status).toBe(400);

    // Mark completed validly
    const compOk = await apiJson('/completions', {
      method: 'POST',
      cookie: cookieA,
      body: { childId: childAId, activityId: firstAct.id, status: 'completed', caregiverNotes: 'Loved it' },
    });
    expect(compOk.status).toBe(201);

    // 4. Video upload validation: missing consent (400), spoofed binary (400), genuine WebM (201)
    const noConsentForm = new FormData();
    noConsentForm.append('video', new Blob([VALID_WEBM_BYTES], { type: 'video/webm' }), 'clip.webm');
    noConsentForm.append('childId', childAId);
    noConsentForm.append('activityId', firstAct.id);
    noConsentForm.append('consentConfirmed', 'false');
    const noConsentRes = await fetch(`${BASE}/submissions`, {
      method: 'POST',
      headers: { Cookie: cookieA, ...CSRF_HEADERS },
      body: noConsentForm,
    });
    expect(noConsentRes.status).toBe(400);

    const spoofForm = new FormData();
    spoofForm.append(
      'video',
      new Blob([new TextEncoder().encode('<script>alert(1)</script>')], { type: 'video/webm' }),
      'evil.webm'
    );
    spoofForm.append('childId', childAId);
    spoofForm.append('activityId', firstAct.id);
    spoofForm.append('consentConfirmed', 'true');
    const spoofRes = await fetch(`${BASE}/submissions`, {
      method: 'POST',
      headers: { Cookie: cookieA, ...CSRF_HEADERS },
      body: spoofForm,
    });
    expect(spoofRes.status).toBe(400);

    const validForm = new FormData();
    validForm.append('video', new Blob([VALID_WEBM_BYTES], { type: 'video/webm' }), 'practice.webm');
    validForm.append('childId', childAId);
    validForm.append('activityId', firstAct.id);
    validForm.append('durationSeconds', '5');
    validForm.append('caregiverNotes', 'Practiced slowly on cotton mat');
    validForm.append('consentConfirmed', 'true');
    const uploadRes = await fetch(`${BASE}/submissions`, {
      method: 'POST',
      headers: { Cookie: cookieA, ...CSRF_HEADERS },
      body: validForm,
    });
    expect(uploadRes.status).toBe(201);
    const uploadBody = (await uploadRes.json()) as { submission: { id: string } };
    const subId = uploadBody.submission.id;

    // Duplicate rapid submission guard -> 409 Conflict
    const dupForm = new FormData();
    dupForm.append('video', new Blob([VALID_WEBM_BYTES], { type: 'video/webm' }), 'practice-dup.webm');
    dupForm.append('childId', childAId);
    dupForm.append('activityId', firstAct.id);
    dupForm.append('durationSeconds', '5');
    dupForm.append('consentConfirmed', 'true');
    const dupRes = await fetch(`${BASE}/submissions`, {
      method: 'POST',
      headers: { Cookie: cookieA, ...CSRF_HEADERS },
      body: dupForm,
    });
    expect(dupRes.status).toBe(409);

    // 5. Private stream token, byte-range streaming & IDOR protection
    const tokenRes = await apiJson<{ streamUrl: string; expiresAt: string }>(
      `/submissions/${subId}/stream-token`,
      { cookie: cookieA }
    );
    expect(tokenRes.status).toBe(200);

    // Byte-range stream succeeds with no-store
    const streamRes = await fetch(`http://localhost:3000${tokenRes.data.streamUrl}`, {
      headers: { Range: 'bytes=0-15' },
    });
    expect(streamRes.status).toBe(206);
    expect(streamRes.headers.get('cache-control')).toContain('no-store');

    // Tampered token -> 401
    const tamperedStream = await fetch(`http://localhost:3000${tokenRes.data.streamUrl}x`);
    expect(tamperedStream.status).toBe(401);

    // Parent B IDOR attempts on Parent A's child, journey, progress, stream-token, delete -> all blocked!
    expect((await apiJson(`/journey/${childAId}/today`, { cookie: cookieB })).status).toBe(404);
    expect((await apiJson(`/progress/${childAId}`, { cookie: cookieB })).status).toBe(404);
    expect((await apiJson(`/submissions/${subId}/stream-token`, { cookie: cookieB })).status).toBe(403);
    expect((await apiJson(`/submissions/${subId}/video`, { method: 'DELETE', cookie: cookieB })).status).toBe(403);
    expect((await apiJson(`/children/${childAId}`, { method: 'DELETE', cookie: cookieB })).status).toBe(404);

    // Parent A blocked from reviewer & admin routes -> 403
    expect((await apiJson('/reviewer/queue', { cookie: cookieA })).status).toBe(403);
    expect((await apiJson('/admin/overview', { cookie: cookieA })).status).toBe(403);

    // 6. Reviewer workflow: PII minimization, claim, draft privacy, 4-level rubric calculation, publish
    const revLogin = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...CSRF_HEADERS },
      body: JSON.stringify({ email: 'ananya.reviewer@littlesteps.in', password: 'LittleSteps123!' }),
    });
    expect(revLogin.status).toBe(200);
    const revCookie = extractCookie(revLogin);

    const queueRes = await apiJson<{
      queue: Array<{ submissionId: string; parentReference: string; email?: string }>;
    }>('/reviewer/queue', { cookie: revCookie });
    expect(queueRes.status).toBe(200);
    const queuedItem = queueRes.data.queue.find((q) => q.submissionId === subId);
    expect(queuedItem).toBeDefined();
    expect(queuedItem?.parentReference).toMatch(/^PAR-[A-Z0-9]+$/);
    expect(queuedItem?.email).toBeUndefined();

    // Claim submission
    const claimRes = await apiJson<{
      activity: { rubricCriteria: Array<{ id: string; weightPoints: number }> };
    }>(`/reviewer/submissions/${subId}/claim`, { method: 'POST', cookie: revCookie });
    expect(claimRes.status).toBe(200);
    const criteria = claimRes.data.activity.rubricCriteria;
    expect(criteria.length).toBeGreaterThanOrEqual(2);

    // Save draft -> parent MUST NOT see unpublished draft
    const draftRes = await apiJson(`/reviewer/submissions/${subId}/review`, {
      method: 'POST',
      cookie: revCookie,
      body: {
        mode: 'draft',
        strengthsNote: 'Draft note',
        coachingTip: 'Draft tip',
        evaluationScopeAcknowledged: false,
        criterionRatings: criteria.map((c) => ({ criterionId: c.id, achievedLevel: 'met' })),
      },
    });
    expect(draftRes.status).toBe(201);

    const progWhileDraft = await apiJson<{
      summary: { reviewedActivitiesCount: number };
      reviewHistory: Array<{ id: string; review: unknown | null }>;
    }>(`/progress/${childAId}`, {
      cookie: cookieA,
    });
    expect(progWhileDraft.data.summary.reviewedActivitiesCount).toBe(0);
    expect(progWhileDraft.data.reviewHistory.length).toBe(1);
    expect(progWhileDraft.data.reviewHistory[0]?.review).toBeNull();

    // Publish evaluation: first criterion 'met', second 'partially_met', rest 'met'
    const ratings = criteria.map((c, idx) => ({
      criterionId: c.id,
      achievedLevel: idx === 1 ? 'partially_met' : 'met',
    }));
    const pubRes = await apiJson<{
      review: { isAssessable: boolean; instructionMatchScorePct: number; reviewStatus: string };
    }>(`/reviewer/submissions/${subId}/review`, {
      method: 'POST',
      cookie: revCookie,
      body: {
        mode: 'publish',
        strengthsNote: 'Calm floor setup and warm, unhurried voice throughout the clip.',
        coachingTip: 'Pause two extra seconds after naming each household item.',
        evaluationScopeAcknowledged: true,
        criterionRatings: ratings,
      },
    });
    expect(pubRes.status).toBe(201);
    expect(pubRes.data.review.reviewStatus).toBe('published');
    expect(pubRes.data.review.isAssessable).toBe(true);
    expect(pubRes.data.review.instructionMatchScorePct).toBeGreaterThan(50);

    // Parent progress dashboard reflects completed activity, review history, and filters
    const progAfter = await apiJson<{
      summary: {
        activitiesCompletedStage: number;
        submittedVideosCount: number;
        reviewedActivitiesCount: number;
      };
      reviewHistory: Array<{ id: string; review: { instructionMatchScorePct: number | null } | null }>;
      activityHistory: Array<{ displayStatus: string }>;
    }>(`/progress/${childAId}?completionStatus=reviewed&reviewStatus=reviewed`, {
      cookie: cookieA,
    });
    expect(progAfter.status).toBe(200);
    expect(progAfter.data.summary.submittedVideosCount).toBe(1);
    expect(progAfter.data.summary.reviewedActivitiesCount).toBe(1);
    expect(progAfter.data.reviewHistory[0]?.id).toBe(subId);
    expect(progAfter.data.reviewHistory[0]?.review?.instructionMatchScorePct).toBe(
      pubRes.data.review.instructionMatchScorePct
    );
    expect(progAfter.data.activityHistory.every((h) => h.displayStatus === 'reviewed')).toBe(true);

    // Persistent notifications: unread review notification -> mark read -> persists
    const notifList = await apiJson<{
      notifications: Array<{ id: string; isRead: boolean; kind: string }>;
      unreadCount: number;
    }>(`/notifications?childId=${childAId}`, { cookie: cookieA });
    expect(notifList.status).toBe(200);
    expect(notifList.data.unreadCount).toBeGreaterThanOrEqual(1);
    const firstNotifId = notifList.data.notifications[0]!.id;

    const markOne = await apiJson<{ ok: boolean }>(
      `/notifications/${encodeURIComponent(firstNotifId)}/read`,
      { method: 'POST', cookie: cookieA }
    );
    expect(markOne.status).toBe(200);

    const notifAfter = await apiJson<{
      notifications: Array<{ id: string; isRead: boolean }>;
    }>(`/notifications?childId=${childAId}`, { cookie: cookieA });
    expect(notifAfter.data.notifications.find((n) => n.id === firstNotifId)?.isRead).toBe(true);

    // Cross-parent notifications IDOR blocked -> 404
    expect((await apiJson(`/notifications?childId=${childAId}`, { cookie: cookieB })).status).toBe(
      404
    );

    // DOB update preserves historical ageGroupLabelSnapshot on past completions
    const tenMonthsAgo = new Date();
    tenMonthsAgo.setMonth(tenMonthsAgo.getMonth() - 10);
    const updDob = await apiJson<{ child: { ageGroupSlug: string } }>(`/children/${childAId}`, {
      method: 'PATCH',
      cookie: cookieA,
      body: { displayName: 'Kabir', dateOfBirth: tenMonthsAgo.toISOString().slice(0, 10) },
    });
    expect(updDob.status).toBe(200);
    expect(updDob.data.child.ageGroupSlug).toBe('9-12m');
    const histAfterDob = await apiJson<{
      activityHistory: Array<{ ageGroupLabelSnapshot: string }>;
    }>(`/progress/${childAId}`, { cookie: cookieA });
    expect(histAfterDob.data.activityHistory[0]?.ageGroupLabelSnapshot).toBe('6–9 months');

    // 7. Orphan-free child deletion purges stored video file from private_media!
    const db = new Database(resolveDefaultDbPath());
    const subRow = db
      .prepare('SELECT storage_key FROM video_submissions WHERE id = ?')
      .get(subId) as { storage_key: string } | undefined;
    db.close();
    expect(subRow?.storage_key).toBeTruthy();
    const vaultFilePath = path.resolve(mediaStorage.getRootDir(), subRow!.storage_key);
    expect(fs.existsSync(vaultFilePath)).toBe(true);

    const delChild = await apiJson<{ ok: boolean; purgedVideos: number }>(`/children/${childAId}`, {
      method: 'DELETE',
      cookie: cookieA,
    });
    expect(delChild.status).toBe(200);
    expect(delChild.data.purgedVideos).toBe(1);
    expect(fs.existsSync(vaultFilePath)).toBe(false);

    // 8. Admin content management & security validations
    const adminLogin = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...CSRF_HEADERS },
      body: JSON.stringify({ email: 'kavita.admin@littlesteps.in', password: 'LittleSteps123!' }),
    });
    expect(adminLogin.status).toBe(200);
    const adminCookie = extractCookie(adminLogin);

    const baseActivityPayload = {
      ageGroupId: 'ag_6-9m',
      domainId: 'dom_sensory',
      title: `QA Safe Activity ${runTag}`,
      summary: 'A calm everyday sensory activity created by automated QA verification.',
      durationMinutes: 5,
      materials: ['Cotton mat', 'Wooden spoon'],
      safetyNotes: 'Supervise closely on a firm floor mat away from hard edges.',
      instructionalPosterUrl: '/src/assets/images/activity_sensory_linen_1795191186954.jpg',
      status: 'draft',
      steps: [{ title: 'Set up mat', instructionText: 'Lay out two safe items calmly.' }],
      rubricCriteria: [
        { label: 'Calm setup', description: 'Safe uncluttered mat.', weightPoints: 50 },
        { label: 'Gentle pacing', description: 'Paused for baby cues.', weightPoints: 50 },
      ],
    };

    // Unsafe javascript: poster URL rejected (400)
    const xssPoster = await apiJson('/admin/activities', {
      method: 'POST',
      cookie: adminCookie,
      body: { ...baseActivityPayload, instructionalPosterUrl: 'javascript:alert(1)' },
    });
    expect(xssPoster.status).toBe(400);

    // Rubric weights not summing to 100 rejected (400)
    const badWeights = await apiJson('/admin/activities', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        ...baseActivityPayload,
        rubricCriteria: [{ label: 'Only one', description: 'Incomplete weight.', weightPoints: 60 }],
      },
    });
    expect(badWeights.status).toBe(400);

    // Valid activity creation + delete cleanup
    const createdAct = await apiJson<{ activity: { id: string } }>('/admin/activities', {
      method: 'POST',
      cookie: adminCookie,
      body: baseActivityPayload,
    });
    expect(createdAct.status).toBe(201);
    createdActivityIds.push(createdAct.data.activity.id);

    const delAct = await apiJson<{ ok: boolean }>(`/admin/activities/${createdAct.data.activity.id}`, {
      method: 'DELETE',
      cookie: adminCookie,
    });
    expect(delAct.status).toBe(200);

    // Reviewer age-group scope enforcement test (create scoped reviewer -> out-of-scope blocked)
    const scopedRevEmail = `qa_scoped_rev_${runTag}@example.com`;
    createdEmails.push(scopedRevEmail);
    const createScopedRev = await apiJson<{ reviewer: { id: string } }>('/admin/reviewers', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        email: scopedRevEmail,
        fullName: 'Scoped QA Reviewer',
        password: 'Password123!',
        allowedAgeGroupSlugs: ['0-3m'],
      },
    });
    expect(createScopedRev.status).toBe(201);
    const scopedLogin = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...CSRF_HEADERS },
      body: JSON.stringify({ email: scopedRevEmail, password: 'Password123!' }),
    });
    expect(scopedLogin.status).toBe(200);
    const scopedCookie = extractCookie(scopedLogin);
    const scopedQueue = await apiJson<{
      queue: Array<{ ageGroupSlug: string }>;
    }>('/reviewer/queue', { cookie: scopedCookie });
    expect(scopedQueue.status).toBe(200);
    expect(scopedQueue.data.queue.every((q) => q.ageGroupSlug === '0-3m')).toBe(true);
    // Attempting to fetch an out-of-scope 6-9m seeded submission directly returns 403
    const fullRevQueue = await apiJson<{
      queue: Array<{ submissionId: string; ageGroupSlug: string }>;
    }>('/reviewer/queue', { cookie: revCookie });
    const outOfScopeSub = fullRevQueue.data.queue.find((q) => q.ageGroupSlug !== '0-3m');
    if (outOfScopeSub) {
      const forbiddenDetail = await apiJson(`/reviewer/submissions/${outOfScopeSub.submissionId}`, {
        cookie: scopedCookie,
      });
      expect(forbiddenDetail.status).toBe(403);
    }

    // Audit logs & retention sweep
    const auditLogs = await apiJson<{ logs: unknown[] }>('/admin/audit-logs', { cookie: adminCookie });
    expect(auditLogs.status).toBe(200);
    expect(auditLogs.data.logs.length).toBeGreaterThan(0);

    const sweep = await apiJson<{ purgedCount: number; sweptAt: string }>('/admin/retention/run', {
      method: 'POST',
      cookie: adminCookie,
    });
    expect(sweep.status).toBe(200);
    expect(typeof sweep.data.purgedCount).toBe('number');
  });
});

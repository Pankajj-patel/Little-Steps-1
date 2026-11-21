# Security Summary

We performed a full security and privacy review of the LittleSteps platform with special focus on protecting children's personal information and private caregiver practice videos. All 6 actionable security issues found during the review were fixed and verified against the running server; **0 dependency vulnerabilities** were found across 271 installed packages.

## Issues Identified & Fixed

1. **Cross-Site Request Protection on State-Changing API Routes**
   - **Risk:** Cookie-authenticated `POST`, `PUT`, `PATCH`, and `DELETE` endpoints previously accepted requests without verifying same-origin headers, leaving signed-in parents, reviewers, and admins exposed to forged cross-site requests.
   - **Fix:** Added `requireCsrfProtection` middleware on `/api/v1` that unconditionally blocks cross-origin `Origin` headers (`403`) and requires either the application's custom `X-Requested-With: LittleSteps` header or verified same-origin `Origin`/`Referer` headers on all state-changing routes. Updated all client `fetch` and `XMLHttpRequest` calls to include the header.

2. **Proxy-Aware HTTPS Session Cookie Hardening**
   - **Risk:** Express did not trust reverse-proxy headers (`X-Forwarded-Proto`), causing `req.ip` rate-limiting to misidentify clients behind cloud proxies and preventing secure cross-context iframe cookies (`SameSite=None; Secure; Partitioned`) from being set properly over HTTPS.
   - **Fix:** Enabled `app.set('trust proxy', 1)` and introduced `buildSessionCookieOptions(req)` so HTTPS/production requests automatically set `HttpOnly; Secure; SameSite=None; Partitioned` cookies while local plain-HTTP development uses `HttpOnly; SameSite=Lax`.

3. **Orphan-Free Video Deletion When Removing a Baby Profile**
   - **Risk:** Deleting a baby profile (`DELETE /api/v1/children/:id`) removed database rows via foreign-key cascade without deleting the associated video files from the private media vault, leaving orphaned children's videos on disk.
   - **Fix:** Updated `DELETE /api/v1/children/:id` to locate all active submissions for that child, permanently delete every corresponding file from private storage, and append `parent_delete` entries to the immutable audit log before deleting the child profile row.

4. **Stream-Time Active Account & Reviewer Assignment Re-Verification**
   - **Risk:** The signed video streaming endpoint (`/api/v1/media/stream/:submissionId`) previously re-checked parent ownership at stream time, but did not re-verify whether the user account was still active or whether a reviewer had lost assignment access.
   - **Fix:** Added real-time database re-checks at stream time to reject deactivated accounts (`401`) and block reviewers from streaming submissions actively assigned (`in_review`) to another reviewer (`403`).

5. **Safe URL Validation for Admin Activity Media**
   - **Risk:** The admin activity editor accepted arbitrary strings for `instructionalPosterUrl`, which could allow unsafe schemes like `javascript:` or `data:`.
   - **Fix:** Restricted `instructionalPosterUrl` in Zod validation to safe local relative paths (`/...`, excluding protocol-relative `//...`) or `http(s)://` URLs.

6. **Private API Response Caching & Browser Permissions Headers**
   - **Risk:** Sensitive family, child, and review JSON responses lacked explicit `no-store` cache headers, and browser sensor permissions were not scoped.
   - **Fix:** Applied `Cache-Control: private, no-store, max-age=0` across all `/api/v1/*` responses and added `Permissions-Policy: camera=(self), microphone=(self), geolocation=()` alongside `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and disabled `X-Powered-By`.

## Core Safeguards Verified

| Security Domain | Verification Status |
| --- | --- |
| Password & Session Security | Per-user salted `scrypt` hashes, timing-safe verification, HMAC-SHA256 cookies, and `sessionVersion` invalidation on password reset (`401` verified for stale sessions). |
| Role-Based Access Control (RBAC) | Parent accounts receive `403` on all `/reviewer/*` and `/admin/*` endpoints; reviewers cannot access admin routes or submissions assigned to other reviewers. |
| Parent-Child Ownership Isolation | Cross-account access attempts on another parent's child, journey, progress, stream token, video delete, or child delete all return `403`/`404`. |
| Private Video Vault & Upload Checks | Files stored outside `public/` and `dist/` with UUID keys, strict path-traversal rejection, explicit consent enforcement, and binary magic-byte + MIME-container matching. |
| Reviewer Data Minimization & Audit Trail | Reviewers receive pseudonymized references (`PAR-XXXXXX`) with no parent email/phone; unpublished drafts remain hidden (`review: null`) from parents; uploads, streams, reviews, and deletions are logged. |
| Dependency Security | `bun audit` checked 271 packages with **0 known vulnerabilities**. |

## Pre-Launch Security & Privacy Blockers Still Required

Before handling real families or real children's videos in production:
1. Replace the local demo vault (`LocalPrivateMediaStorage`) with a private cloud object store (GCS `asia-south1` / AWS S3 `ap-south-1` with KMS encryption and 30-day bucket lifecycle deletion).
2. Migrate SQLite to Managed PostgreSQL with TLS and automated Point-in-Time Recovery, and remove seeded demo accounts from production.
3. Integrate real transactional SMTP/email delivery for verification and password resets (and set `NODE_ENV=production` so preview token paths are disabled).
4. Complete qualified Indian legal counsel sign-off for the **Digital Personal Data Protection (DPDP) Act, 2023** children's data and verifiable parental consent requirements.

---

## PoC Verification

All security fixes were verified end-to-end against the live Express server via `bun test --coverage` (**32 passed, 0 failed, 509 assertions**):

1. **CSRF Enforcement (`tests/integration/api.security-and-functional.test.ts`)**
   - `POST /api/v1/auth/login` with no `X-Requested-With` header and no `Origin` -> **`403 Forbidden`**
   - `POST /api/v1/auth/login` with `Origin: https://evil-attacker.example` (even with `X-Requested-With: LittleSteps`) -> **`403 Forbidden`**
   - `POST /api/v1/auth/login` with `X-Requested-With: LittleSteps` -> **`200 OK`**

2. **Session Invalidation & One-Time Token Replay (`tests/integration/api.security-and-functional.test.ts`)**
   - Registered fresh parent -> consumed email verification token (`200 OK`) -> replayed same token -> **`400 Bad Request`**
   - Completed password reset -> called `GET /api/v1/auth/me` with pre-reset session cookie -> **`401 Unauthorized`**

3. **Upload Validation, Signed Stream Tampering & Cross-Parent Isolation (`tests/integration/api.security-and-functional.test.ts`)**
   - Uploaded HTML `<script>` disguised as `video/webm` -> **`400 Bad Request`** (magic-byte check failed)
   - Uploaded valid WebM without consent (`consentConfirmed=false`) -> **`400 Bad Request`**
   - Streamed valid signed URL with `Range: bytes=0-15` -> **`206 Partial Content`** with `Cache-Control: private, no-store, max-age=0`
   - Tampered signed stream token -> **`401 Unauthorized`**
   - Second parent account attempting `GET /journey/:childId/today`, `GET /progress/:childId`, `GET /submissions/:id/stream-token`, `DELETE /submissions/:id/video`, and `DELETE /children/:id` -> all rejected with **`403`** or **`404`**

4. **Orphan-Free Child Video Deletion (`tests/integration/api.security-and-functional.test.ts`)**
   - Confirmed uploaded `.webm` file existed on disk in `private_media/`
   - Executed `DELETE /api/v1/children/:id` -> returned **`200 OK`** (`purgedVideos: 1`)
   - Confirmed physical `.webm` file was removed (`fs.existsSync(vaultFilePath) === false`)

5. **Admin Safe Poster URL & Rubric Weight Integrity (`tests/integration/api.security-and-functional.test.ts`)**
   - `POST /api/v1/admin/activities` with `instructionalPosterUrl: "javascript:alert(1)"` -> **`400 Bad Request`**
   - `POST /api/v1/admin/activities` with rubric weights summing to `60` -> **`400 Bad Request`**

6. **Path Traversal Resistance (`tests/unit/domain.test.ts`)**
   - `LocalPrivateMediaStorage` blocked `../../etc/passwd`, `../package.json`, null-byte keys, and empty keys across `exists`, `getSize`, `openReadStream`, and `deleteObject`.

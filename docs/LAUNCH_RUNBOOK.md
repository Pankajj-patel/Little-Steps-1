# LittleSteps Launch & Operations Runbook

> **Launch Readiness Status: NOT YET PRODUCTION-READY FOR REAL FAMILIES.**
> This prototype is verified for functional, security, and accessibility quality in demo mode, but **4 mandatory production blockers** must be resolved before onboarding real parents or accepting real children's videos:
> 1. Replace `LocalPrivateMediaStorage` demo disk vault with a production private Cloud Object Storage adapter (GCS `asia-south1` / AWS S3 `ap-south-1` with KMS encryption and 30-day bucket lifecycle rules).
> 2. Migrate SQLite (`better-sqlite3`) to Managed PostgreSQL (Cloud SQL / RDS with automated PITR & TLS) and disable in-process demo seed accounts in production.
> 3. Integrate transactional SMTP/email delivery for email verification and password reset (and disable `verificationPreviewPath` / `resetPreviewPath` via `NODE_ENV=production`).
> 4. Complete formal Indian legal & privacy review under the **Digital Personal Data Protection (DPDP) Act, 2023** and applicable Children's Data Rules (including verifiable parental consent, Data Fiduciary notices, and Grievance Officer appointment).

---

## 1. Environment Configuration

Use `.env.example` as the canonical template. Inject all secrets via a managed Secret Manager (never commit `.env` files or embed keys in client bundles).

| Variable | Required in Prod | Purpose |
| --- | --- | --- |
| `NODE_ENV` | Yes (`production`) | Disables Vite dev middleware, disables preview auth token links, enforces `Secure; SameSite=None; Partitioned` cookies |
| `PORT` | Yes (`3000` or platform port) | Express HTTP listen port |
| `APP_URL` | Yes (`https://...`) | Canonical origin for email verification / password reset links |
| `SESSION_SECRET` | Yes (64-hex min) | HMAC-SHA256 signing secret for `ls_session` cookies |
| `VIDEO_TOKEN_SECRET` | Yes (64-hex min) | Dedicated HMAC-SHA256 signing secret for 5-minute video stream tokens |
| `DATABASE_URL` | Yes (PostgreSQL) | Production relational database URI with `sslmode=verify-full` |
| `OBJECT_STORAGE_PROVIDER` | Yes (`gcs` or `s3`) | Private object store for caregiver practice videos & private profile photos |
| `OBJECT_STORAGE_BUCKET` | Yes | Private bucket name (public access prevention enforced) |
| `OBJECT_STORAGE_REGION` | Yes (`asia-south1` / `ap-south-1`) | Indian data residency region |
| `OBJECT_STORAGE_KMS_KEY_ID` | Yes | Customer-managed encryption key (CMEK/KMS) for at-rest video encryption |
| `RETENTION_DAYS` | Yes (`30`) | Mandatory video retention period before automatic permanent purge |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Yes | Outbound transactional email for account verification and password reset |

---

## 2. Database Migration Plan (SQLite Prototype -> Managed PostgreSQL)

### Current Prototype State
- Schema lives in `server/db/schema.ts` (17 normalized tables including `notification_reads`, foreign keys, CHECK constraints, and composite indexes for daily journeys, completions, submissions, and notifications).
- Safe idempotent column and index migrations run automatically at startup (`ensureColumn` and `CREATE INDEX IF NOT EXISTS`).

### Production Migration Sequence
1. **Provision Managed PostgreSQL 16** in an Indian region (`asia-south1` Mumbai or `ap-south-1` Mumbai) with Private VPC peering, TLS enforced (`sslmode=verify-full`), and automated backups.
2. **Adopt Versioned Migrations (Drizzle Kit or Prisma Migrate)**:
   - Port the 17 tables in `server/db/schema.ts` to numbered SQL migrations (`0001_initial_schema.sql`, etc.).
   - Convert SQLite `INTEGER` booleans (`is_active`, `is_assessable`) to PostgreSQL `BOOLEAN` and `TEXT` ISO timestamps to `TIMESTAMPTZ`.
   - Enforce `ON DELETE CASCADE` on `children -> activity_completions / video_submissions` and preserve `media_access_audit_logs` without cascade deletion so audit trails remain immutable.
3. **Seed Only Canonical Reference Data in Production**:
   - Seed the 8 canonical `age_groups` (`0-3m` through `21-24m`), 6 `learning_domains`, and expert-reviewed `activities` / `daily_plans`.
   - **Never seed demo user accounts (`meera@littlesteps.in`, etc.) in production.** Provision the first admin account via a one-time CLI bootstrap script with forced password rotation.
4. **Zero-Downtime Migration Discipline**:
   - Always apply expand-and-contract migrations (add nullable columns first -> deploy app code -> backfill -> enforce `NOT NULL`).
   - Run migrations as a pre-deploy job (`npm run db:migrate`) prior to shifting traffic to the new container revision.

---

## 3. Production Storage Configuration (Children's Videos & Profile Photos)

The prototype uses `LocalPrivateMediaStorage` (`./private_media`), which explicitly discloses **Demo Mode** in the UI. Before launch:

1. **Implement `CloudObjectMediaStorage` conforming to `MediaStorageAdapter`** (`server/storage/mediaStorage.ts`):
   - **Bucket settings**: Private bucket in `asia-south1` (GCS) or `ap-south-1` (S3) with Public Access Prevention enabled, Uniform Bucket-Level Access enabled, versioning disabled (so deletions are truly permanent!), and CMEK/KMS encryption at rest.
   - **Signed URLs**: Issue short-lived (`<= 5 minutes`) V4 signed GET URLs scoped to the exact object key and `Content-Disposition: inline`, ONLY after server-side RBAC + active-user + reviewer-assignment verification.
   - **Defense-in-Depth 30-Day Deletion**:
     - Layer 1: Application `RetentionWorker` runs hourly (or via Cloud Scheduler / cron) to delete expired objects and mark `deleted_at` + `deletion_reason = 'retention_30d'` + append `media_access_audit_logs`.
     - Layer 2: Cloud bucket **Object Lifecycle Rule** (`Age: 30 days -> Action: Delete`) guarantees hard erasure even if the application worker is down.
2. **Update `getStorageStatus()`** to report `mode: 'production_object_storage'` and `isProductionConfigured: true` ONLY when the real cloud adapter is active and verified at startup.

---

## 4. Backup & Recovery Strategy

| Data Store | Backup Frequency | Retention | Encryption | Target RPO / RTO |
| --- | --- | --- | --- | --- |
| Managed PostgreSQL | Automated daily full snapshot + continuous WAL Point-in-Time Recovery (PITR) | 30 days (aligned with privacy policy) | KMS-encrypted snapshots in regional vault | RPO <= 5 min, RTO <= 30 min |
| Private Video Bucket | **No long-term backup / versioning disabled** | Strictly <= 30 days max | KMS at rest + TLS 1.3 in transit | Intentionally excluded from archives to honor immediate parent deletion & 30-day DPDP erasure |
| Application Config & IaC | Git version control + Secret Manager versioned secrets | Indefinite (no PII) | KMS-encrypted secrets | RPO = 0, RTO <= 15 min |

- **Recovery Drill**: Execute a quarterly restore test into an isolated staging database verifying row counts, foreign key integrity, and zero restored expired videos.

---

## 5. Logging & Monitoring

### Structured Application Logging
- Emit structured JSON logs to stdout/stderr (ingested by Cloud Logging / Datadog / OpenTelemetry): `timestamp`, `level`, `requestId`, `method`, `path`, `statusCode`, `durationMs`, `actorRole`.
- **Strict PII Redaction**: Never log passwords, session cookies, signed stream tokens (`?token=...`), raw one-time auth tokens, child names, child DOBs, parent emails, or phone numbers. Strip query strings from `/api/v1/media/stream/*` access logs!

### Health, Metrics & Alerts
- **Liveness / Readiness Probe**: `GET /api/v1/health` -> `200 OK` (`{ status: 'ok', service: 'LittleSteps API v1' }`).
- **Key Alerts**:
  - `5xx` error rate > 1% over 5 minutes -> Page on-call engineer.
  - API p95 latency > 500ms over 10 minutes -> Warning alert.
  - `RetentionWorker` sweep missed for > 2 hours or failed -> High-priority privacy alert.
  - Spike in `401` / `403` / `429` responses on `/api/v1/auth/*` or `/api/v1/media/stream/*` -> Security alert.
  - Video upload failure rate > 5% -> Warning alert.

---

## 6. Data Retention, Deletion & Indian DPDP Act 2023 Compliance

- **Data Minimization**: Reviewers see only a pseudonymized parent reference (`PAR-XXXXXX`), child age group label, activity version/instructions, optional caregiver note, and private stream — never parent email, phone, or home address.
- **Retention & Immediate Erasure**:
  - Practice videos: Auto-deleted permanently at 30 days, immediately on parent "Delete Video Now", and immediately on child profile deletion (`DELETE /api/v1/children/:id` purges vault objects before cascading DB rows).
  - Audit logs: Record `upload`, `stream`, `review_open`, `parent_delete`, `admin_delete`, `auto_purge` with actor role and submission ID.
- **Mandatory Pre-Launch Legal Gate (India)**:
  - Engage qualified Indian privacy counsel to validate compliance with the **Digital Personal Data Protection (DPDP) Act, 2023** and notified Rules, specifically Section 9 (verifiable consent of parent/lawful guardian for children under 18, prohibition on tracking/behavioral monitoring/targeted advertising), Data Fiduciary notice wording (English + scheduled Indian languages), data breach notification SOP (CERT-In 6-hour & Data Protection Board timelines), and Grievance Officer contact details.

---

## 7. Deployment Instructions

### Prerequisites
- Node.js 22+ LTS, `npm` or `bun`, configured production `.env` secrets.

### Build & Start Commands
```bash
# 1. Install production and build dependencies
npm ci

# 2. Typecheck and run automated test suites
npm run lint
npm test

# 3. Build optimized Vite production bundle (code-split)
npm run build

# 4. Run database migrations (once PostgreSQL migration tooling is enabled)
# npm run db:migrate

# 5. Start production server (serves /api/v1 and static /dist on PORT=3000)
NODE_ENV=production PORT=3000 npm start

# 6. Run Playwright browser E2E, responsive, a11y, and Web Vitals check against running server
npm run test:e2e
```

### Post-Deploy Smoke Checks
1. `curl -fsS https://<domain>/api/v1/health` returns `200 OK` with `Cache-Control: private, no-store, max-age=0`, `Content-Security-Policy`, and `X-Content-Type-Options: nosniff`.
2. Verify `POST /api/v1/auth/login` without `X-Requested-With` and cross-origin `Origin` returns `403`.
3. Verify `GET /api/v1/submissions/storage-status` reports `mode: "production_object_storage"` (once cloud adapter is live).
4. Verify a test video upload streams via 5-minute signed URL (`206 Partial Content`), blocks out-of-scope reviewers (`403`), and is permanently deleted after clicking "Delete Video Now".

---

## 8. Rollback Plan

1. **Application Rollback (< 3 minutes)**:
   - Shift 100% traffic back to the previous immutable container revision (e.g., `gcloud run services update-traffic littlesteps --to-revisions=<PREVIOUS_REV>=100`).
   - Verify `GET /api/v1/health` and core parent/reviewer login flows recover immediately.
2. **Database Rollback**:
   - Because production schema changes follow expand-and-contract rules, rolling back the application container works safely without destructive down-migrations.
   - If a data corruption incident occurs, stop writes (maintenance mode), restore Managed PostgreSQL via PITR to the timestamp immediately preceding the deploy, verify integrity, and resume traffic.
3. **Post-Incident Review**:
   - Capture root cause, security/privacy impact check (confirming zero exposure of children's data), and add a regression test to `tests/` before re-deploying.

# LittleSteps — Step 0 Architecture & Implementation Plan

LittleSteps is a calm, guided early-childhood parenting platform helping mothers and caregivers support babies from 0 to 24 months through bite-sized daily activities across six developmental domains, with private video practice submissions and constructive, rubric-based caregiver feedback.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The four foundational architectural decisions below reflect your confirmed choices. One minor project configuration update is flagged for confirmation before Step 1 begins.

- **Confirmed — Database & Backend Architecture**: Local SQLite with Express for the early prototype, isolated behind a clean Repository Layer and versioned REST API (`/api/v1`) so migrating to PostgreSQL / Cloud SQL and supporting future Android & iOS apps requires zero rewrite of UI or business logic.
- **Confirmed — Children's Video Privacy & Retention**: Private, authenticated access via short-lived signed streaming tokens (never public URLs) with **30-day automatic deletion** plus immediate parent-initiated deletion at any time.
- **Confirmed — Localization Strategy**: English first with an **i18n-ready architecture** (centralized translation keys, locale-aware age/date formatters, and translation-ready curriculum fields) to support Hindi and regional Indian languages cleanly in future releases.
- **Confirmed — Visual Aesthetic Direction**: **Warm Calm Montessori Editorial** — serene, unhurried, high-legibility layout with generous whitespace and progressive disclosure so mothers are never overwhelmed.
- **Confirmation Before Step 1 — Project Config Updates**: To support full-stack Express + SQLite APIs alongside React on port 3000 while preserving your existing Vite setup and asset-copying plugin, Step 1 will:
  1. Keep all existing frontend tooling (React 19, Vite 8, Tailwind CSS v4, Motion, Lucide) untouched.
  2. Add an Express server entry serving `/api/v1/*` and mounting Vite middleware in development (and built static assets in production) on port 3000.
  3. Enable strict TypeScript type-checking (`strict: true`) and install only essential runtime dependencies (`better-sqlite3`, `multer`, `zod`, `cookie-parser`) when Step 1 is approved.

---

## 1. Overview, Core Concept & Workspace Inspection

### Existing Workspace Audit
- **Frontend Stack**: React 19.0.1, Vite 8.3.0, TypeScript 7.0.2, Tailwind CSS v4.3.3 (`@tailwindcss/vite`), `lucide-react` icons, and `motion` for gentle transitions.
- **Backend Readiness**: Express 4.21.2, `tsx` 4.21.0, and `dotenv` 17.2.3 are already installed; the current dev script serves Vite standalone without an API server or database yet.
- **Environment Constraints**: Port 3000 single-origin serving, HMR disabled cleanly via `DISABLE_HMR`, and existing asset-copy build hook preserved.

### Core Product Concept
- **Primary Audience**: Mothers and caregivers in India (responsive mobile-first web initially; API-ready for Android & iOS and global expansion).
- **8 Age Groups (0–24 Months)**:
  `0–3m` · `3–6m` · `6–9m` · `9–12m` · `12–15m` · `15–18m` · `18–21m` · `21–24m`
  Babies are automatically mapped to their exact 3-month band using their date of birth, smoothly unlocking the next stage as they grow.
- **6 Learning Domains**:
  1. Cognitive Development
  2. Language and Communication
  3. Physical Development
  4. Social and Emotional Development
  5. Sensory Development
  6. Early Independence and Everyday Skills
- **Non-Diagnostic Instruction-Match Principle**:
  Reviewers evaluate **only the caregiver's demonstrated execution of activity steps** using an objective, weighted rubric that produces a percentage-based **Instruction-Match Score**. LittleSteps explicitly never scores, diagnoses, or ranks a baby's intelligence, developmental level, or health.

---

## 2. User Experience, User Journeys & Visual Design

### Visual Identity & Theme — Warm Calm Montessori Editorial
Designed to feel like a serene, sunlit Montessori parenting journal rather than a noisy clinical dashboard or overstimulating toy store.

- **60-30-10 Color System**:
  - **60% Dominant Neutral Canvas**: Warm Chalk (`#FAF9F6`, `--background`) paired with pure Crisp Linen surfaces (`#FFFFFF`, `--surface`) and Deep Charcoal Forest Ink (`#1F2421`, `--foreground`).
  - **30% Structural Surfaces**: Soft Oat recessed panels (`#F3F1EC`, `--surface-muted`), Warm Stone 1px hairlines (`#E6E3DC`, `--border`), and Slate Olive secondary text (`#57605A`, `--muted-foreground`).
  - **10% Accent Budget**: Deep Botanical Eucalyptus (`#2F5D50`, `--primary`) for primary actions and active navigation states; Warm Honey Ochre (`#B87D2B`, `--accent`) strictly for gentle highlights and pending-review cues. All semantic states (Reviewed, Pending, Action Needed) pair color with explicit text labels and icons — never color alone.
- **Typography & Hierarchy (2+1 Font Discipline)**:
  - *Display & Editorial Headings*: `Fraunces` (warm, expressive literary serif with `text-wrap: balance` to eliminate orphan headline words).
  - *Body & Interface Controls*: `Plus Jakarta Sans` (clear, human sans-serif at 15–16px with 1.6 line-height for effortless one-handed mobile reading).
  - *Scores, Timestamps & Metrics*: `IBM Plex Mono` with `tabular-nums` strictly for percentage match scores, video durations, age-month indicators, and audit timestamps.
- **Layout & Restraint Rules**:
  - **Top Bar Contract**: Single-row, three-zone header (`LittleSteps` wordmark — 4 concise single-line links — 1 primary action). Mobile sticky chrome stays strictly under 15% of viewport height.
  - **Zero-Pill Metadata**: Domain names, age bands, durations, and statuses render as quiet unboxed typography separated by `·` (e.g., `Sensory · 6–9 months · 5 min`), reserving styled buttons strictly for interactive filters and CTAs.
  - **Single-Elevation & Calm Pacing**: Flat surfaces separated by generous whitespace and 1px hairline borders — no nested cards-within-cards, no thick left accent borders, no decorative pulsing dots, and no wall-of-text paragraphs.
  - **Motion Budget**: Subtle compositor-only transitions (`opacity`, `transform`) settling within 180ms (`prefers-reduced-motion` respected).

### Complete User Journeys

#### A. Parent / Caregiver Journey
1. **Gentle Onboarding**: Create account (email + password, optional mobile number & locale) → Add child profile (name + date of birth) → System computes age in months and places the family into the exact 3-month age band.
2. **Today's Calm Daily Journey**: Opens to a single focused focal anchor — *Today's 2–3 Recommended Activities* (progressive disclosure: one primary card in focus, remaining cards quiet below). Caregiver can switch between Today, Weekly Progress, and Feedback History.
3. **Guided Activity Session**: Opens an activity → Watches concise instructional video → Scans everyday India-friendly household items and safety reminders → Follows numbered step-by-step instructions one card/step at a time.
4. **Practice & Private Video Submission**: Marks activity complete OR chooses to record in-browser / upload a short video clip (max 2 min / 50 MB) with optional reflection note → Sees clear inline privacy notice (*Private to you and your reviewer · Auto-deletes in 30 days · Delete anytime*) and confirms consent before upload.
5. **Constructive Feedback Loop**: Views reviewer's **Caregiver Instruction-Match Score (%)**, step-by-step rubric breakdown (e.g., *Setup & Safety: Met*, *Calm Pacing: Met*, *Verbal Cueing: Partially Met*), warm strengths note, and one practical tip for next time → Can delete the uploaded video immediately while keeping the written coaching notes.

#### B. Reviewer Journey
1. **Structured Review Queue**: Signs into Reviewer Workbench → Sees prioritized queue filtered by status (`Queued`, `In Review`, `Completed`) and age band, ordered FIFO with clear wait-time timestamps.
2. **Split-Screen Evaluation Workbench**: Claims a submission → Left pane renders the private, stream-only video player alongside the exact Activity Steps reference (showing only child's age band — zero parent contact PII); Right pane renders the activity's weighted **Caregiver Execution Rubric**.
3. **Objective Scoring & Attestation**: Selects `Met`, `Partially Met`, or `Not Observed` per caregiver step → Percentage instruction-match score auto-calculates live with tabular numerals → Writes encouraging *What Went Well* + *Gentle Next-Time Tip* → Confirms mandatory non-diagnostic attestation (*"This feedback evaluates caregiver instruction execution only, not the child"*) → Submits review.

#### C. Admin Journey
1. **Curriculum Coverage Overview**: Views matrix of published activities across all **8 age groups × 6 learning domains** to identify content gaps.
2. **Curriculum & Rubric Authoring**: Creates/edits Activities (domain, age group, summary, household materials, safety notes, instructional media, ordered steps, and weighted rubric criteria summing to 100%) and assigns them into sequenced **Daily Plans**.
3. **Operations & Privacy Governance**: Manages user roles (promoting/deactivating reviewers), monitors video queue volume, inspects automated 30-day retention sweep status, and reviews immutable media access audit logs.

---

## 3. Key Product Decisions, Role Governance & Child Video Security

### Role-Based Access Control (RBAC) Matrix

| Capability / Resource | Parent / Caregiver | Reviewer | Admin |
| :--- | :--- | :--- | :--- |
| Manage own profile & children | Full (own family only) | None | Read (masked) |
| Browse age-matched daily activities | Read (published) | Read (reference) | Full CRUD |
| Log completions & upload videos | Full (own children) | None | None |
| Stream caregiver activity videos | Own videos only | Assigned/claimed queue only | Restricted (audit-logged) |
| Delete uploaded video immediately | Yes (own videos) | No | Moderation/retention purge |
| Score rubrics & write feedback | Read own feedback | Create/submit on assigned | Read aggregate metrics |
| Manage curriculum, plans & roles | No | No | Full CRUD |
| View media access audit logs | Own deletion history | None | Full read-only audit |

### Child Video Security & Privacy Architecture (DPDP Act 2023 & Global Readiness)

> [!WARNING]
> Children's videos are high-sensitivity personal data. Every video path must be private-by-default, non-enumerable, access-audited, and automatically expired.

1. **Zero Public Exposure**: Uploaded videos are stored in a private media vault **outside** the Vite public/static bundle using random opaque UUID keys (never original filenames or sequential IDs).
2. **Short-Lived Signed Streaming Tokens**: Playback requests require a valid authenticated session and an HMAC-SHA256 signed stream token (5-minute TTL) scoped to `actor_user_id + submission_id`. The Express streaming endpoint enforces RBAC, supports HTTP `Range` requests for smooth mobile seeking, and sends `Cache-Control: private, no-store`, `Content-Disposition: inline`, and `X-Content-Type-Options: nosniff`.
3. **Strict Upload Hardening**: Server enforces MIME allowlist (`video/mp4`, `video/webm`, `video/quicktime`), binary magic-byte header validation, 50 MB file cap, and 120-second duration limit (friendly for Indian mobile bandwidth and safe against storage exhaustion).
4. **30-Day Automatic Deletion + Instant Right-to-Delete**: Every submission sets `expires_at = created_at + 30 days`. A background retention worker periodically purges expired video files from disk and marks records `deleted` (`deletion_reason = 'retention_30d'`). Parents can also tap **Delete Video** at any time for immediate physical deletion while optionally retaining their written feedback summary.
5. **Reviewer Data Minimization**: Reviewers see only the child's age band (e.g., `6–9 months`), activity guidelines, and the video stream — never parent email, phone number, address, or full legal identifiers.
6. **Immutable Audit Trail & Auth Hardening**: Every upload, stream open, review submission, parent delete, and auto-purge writes an entry to `media_access_audit_logs`. Authentication uses Node native `crypto.scrypt` per-user salted password hashes, `HttpOnly` + `SameSite=Lax` signed session cookies, Zod input validation, parameterized SQL queries, and endpoint rate limiting.

### Key Architectural Trade-Offs
- **Local SQLite Behind a Repository Interface**:
  - *Chosen Approach*: `better-sqlite3` (WAL mode + strict foreign keys enabled) wrapped in domain repository modules.
  - *Why*: Zero external provisioning friction for rapid prototype validation, full relational integrity for rubrics and audit trails, and clean SQL portability to Cloud SQL PostgreSQL before public launch.
- **Storage Adapter Abstraction for Media**:
  - *Chosen Approach*: `MediaStorageAdapter` interface implemented with private local disk storage in the prototype.
  - *Why*: Lets us prove the full upload → signed stream → 30-day auto-purge lifecycle immediately while making production migration to GCS/S3 signed URLs a single adapter swap.
- **Versioned REST API (`/api/v1`) from Day One**:
  - *Chosen Approach*: Stateless JSON DTO contracts shared between React client and Express server.
  - *Why*: Directly prepares LittleSteps for future Android and iOS native/cross-platform clients without duplicating business logic or RBAC rules.

---

## 4. Technical Architecture, Data Model & Phased Milestones *(Technical Reference)*

### System & Modular Architecture Diagram

```text
┌────────────────────────────────────────────────────────────────────────────┐
│  CLIENT APPLICATION (React 19 · TypeScript · Tailwind v4 · i18n Catalog)   │
│                                                                            │
│  ┌──────────────────┐  ┌────────────────────┐  ┌────────────────────────┐  │
│  │  Parent Journey  │  │ Reviewer Workbench │  │   Admin Curriculum     │  │
│  │  · Onboarding    │  │ · Queue & Filters  │  │   · 8x6 Coverage Grid  │  │
│  │  · Today's Plan  │  │ · Split Video View │  │   · Activity & Rubric  │  │
│  │  · Activity Mode │  │ · Weighted Rubric  │  │   · Daily Plan Builder │  │
│  │  · Video Capture │  │ · Non-Diag Attest  │  │   · Roles & Audit Logs │  │
│  └────────┬─────────┘  └─────────┬──────────┘  └───────────┬────────────┘  │
│           └──────────────────────┼─────────────────────────┘               │
│                                  ▼                                         │
│                   Typed API Client & Auth Session Store                    │
└──────────────────────────────────┬─────────────────────────────────────────┘
                                   │ HTTPS / JSON + Range Video Stream
                                   ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  EXPRESS API SERVER (/api/v1 · Port 3000 · Single Origin with Vite SPA)    │
│                                                                            │
│  ┌────────────────────────────── Middleware ────────────────────────────┐  │
│  │ Auth Session Verification · RBAC Guards · Zod Validation · RateLimit │  │
│  └───────────────────────────────┬──────────────────────────────────────┘  │
│                                  ▼                                         │
│  ┌─────────────────────────── Domain Services ──────────────────────────┐  │
│  │ Identity │ Child & AgeBand │ Curriculum │ Submissions │ RubricEngine │  │
│  │ AuditLog │ RetentionWorker (30-day auto-purge scheduler)             │  │
│  └───────────────┬───────────────────────────────────┬──────────────────┘  │
│                  ▼                                   ▼                     │
│  ┌───────────────────────────┐       ┌──────────────────────────────────┐  │
│  │   Repository Layer (DAL)  │       │      MediaStorageAdapter         │  │
│  │   SQLite (WAL + FK ON)    │       │  Private Vault (outside public/) │  │
│  │   → Portable to Postgres  │       │  HMAC Short-Lived Stream Tokens  │  │
│  └───────────────────────────┘       └──────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

### Logical Workspace & Module Organization
To keep the codebase modular, strictly typed, and easy to extend toward mobile and multi-language support, code is separated into five clear boundaries:
1. **Shared Domain Contracts & i18n**: Shared TypeScript interfaces, Zod schemas, age-band/domain constants, rubric score calculator, and locale dictionaries (`en` baseline, ready for `hi` and additional languages).
2. **Design System Primitives**: Reusable Warm Montessori Editorial layout primitives (Top Bar, Section Header, Empty/Loading/Error states, Accessible Stepper, Secure Video Player, Rubric Checklist).
3. **Role-Isolated Frontend Feature Modules**: Independent feature domains for Authentication/Onboarding, Parent Daily Journey & Progress, Reviewer Evaluation Workbench, and Admin Curriculum & Audit Console.
4. **Express API & Domain Services**: Route controllers grouped by module (`/auth`, `/children`, `/curriculum`, `/journey`, `/submissions`, `/reviews`, `/admin`), RBAC middleware, pure business services, and the 30-day retention scheduler.
5. **Data Persistence & Private Media Vault**: SQLite schema migrations, deterministic curriculum seeders (all 8 age groups, 6 domains, sample daily plans, steps, and rubrics), Repository implementations, and an isolated private media storage directory excluded from version control and static hosting.

### Database Entities & Relational Model

```text
users (parent|reviewer|admin) ──1:N──► user_consents
  │
  ├──1:N──► children ──N:1──► age_groups (8 bands: 0–3m ... 21–24m)
  │            │                   │
  │            │                   ├──1:N──► daily_plans ──1:N──► daily_plan_items
  │            │                   │                                   │
  │            │                   └──1:N──► activities ◄──────────────┘
  │            │                                │  │  │
  │            │                                │  │  └──N:1──► learning_domains (6 domains)
  │            │                                │  └─────1:N──► activity_steps
  │            │                                └────────1:N──► activity_rubric_criteria
  │            │
  │            └──1:N──► activity_completions (child × activity × plan_date)
  │                             │
  │                             └──0:N──► video_submissions (storage_key, expires_at +30d, status)
  │                                          │       │
  │                                          │       └──1:N──► media_access_audit_logs
  │                                          │
  │                                          └──0:1──► submission_reviews (instruction_match_score_pct)
  │                                                        │
  │                                                        └──1:N──► review_rubric_scores
  └──1:N (as reviewer)─────────────────────────────────────┘
```

#### Core Entity Highlights
- **`users` & `user_consents`**: Role-typed accounts (`parent`, `reviewer`, `admin`), locale preference, and timestamped privacy/video consent records.
- **`age_groups` & `learning_domains`**: Seeded reference tables for all 8 age bands (`min_months`, `max_months`) and 6 developmental domains with translation-key hooks.
- **`children`**: Linked to `parent_user_id`, storing `display_name`, `date_of_birth`, and computed active age band.
- **`activities`, `activity_steps`, `activity_rubric_criteria`**: Structured activity definition including household materials, safety notes, instructional media, ordered caregiver steps, and weighted observable rubric items (strictly scoped to caregiver technique).
- **`daily_plans` & `daily_plan_items`**: Curated day-by-day sequences per age group (2–3 focused activities/day across rotating domains) preventing caregiver overwhelm.
- **`activity_completions` & `video_submissions`**: Tracks completion progress, optional caregiver reflections, opaque private media storage keys, review queue assignment, and automatic `expires_at` (30-day retention) + `deleted_at` / `deletion_reason`.
- **`submission_reviews` & `review_rubric_scores`**: Stores criterion-level ratings (`met` = 100%, `partially_met` = 50%, `not_observed` = 0%), weighted **Caregiver Instruction-Match Score (%)**, strengths note, next-time coaching tip, and reviewer non-diagnostic attestation timestamp.
- **`media_access_audit_logs`**: Immutable ledger of every video upload, playback stream, review access, parent deletion, and automated 30-day purge.

### Interactive Component & State Mapping
- **Auth & Role Routing**: Session hydration checks `/api/v1/auth/me` on boot and routes users strictly to their permitted workspace (Parent, Reviewer, or Admin) with graceful unauthorized fallback.
- **Child Age-Band Calculation**: Creating or editing a baby's DOB immediately recalculates age in months on both client preview and server validation, updating Today's Journey dynamically.
- **Activity Stepper & Submission Flow**: Interactive step completion toggles persist locally during practice; submitting a video validates MIME/size/duration client-side before multipart upload, shows real progress, enforces consent checkbox, and transitions card status cleanly to `Submitted for Review`.
- **Reviewer Rubric Engine**: Toggling any rubric criterion (`Met` / `Partially Met` / `Not Observed`) recalculates the weighted caregiver instruction-match percentage live; submission stays disabled until all criteria are rated, coaching notes are entered, and the non-diagnostic attestation checkbox is checked.
- **Retention & Instant Delete**: Clicking `Delete Video` opens an inline confirmation (never `window.confirm`), calls `DELETE /api/v1/submissions/:id/video`, immediately unlinks the file, refreshes the UI state to `Video Deleted (Feedback Preserved)`, and records the audit entry.

---

### Phased, Independently Testable Implementation Milestones

| Milestone | Scope & Deliverables | Independent Verification Criteria |
| :--- | :--- | :--- |
| **Milestone 1 (Step 1): Core Foundation, DB, Auth & Editorial Shell** | Express + Vite unified server on port 3000; strict TypeScript; SQLite schema, migrations, Repository layer & seed data (8 age groups, 6 domains, realistic starter curriculum + demo accounts for Parent, Reviewer, Admin); Auth + RBAC middleware; i18n dictionary setup; Warm Calm Montessori Editorial design tokens & shell. | Register/login works for all 3 roles; RBAC blocks cross-role API calls (`403`); seeded age groups and domains load from SQLite; responsive editorial layout passes type-check and build. |
| **Milestone 2 (Step 2): Parent Onboarding, Child Profiles & Today's Daily Journey** | Add/switch child profile with auto age-band calculation; Today's Journey calm daily view (2–3 focused activities); Activity Detail experience with instructional video player, materials, safety notes, step-by-step guide, and completion logging; gentle domain-balance progress summary. | Adding a baby with any DOB (0–24m) maps to the exact 3-month band; caregiver can complete daily activities, add notes, and see persisted progress across reloads. |
| **Milestone 3 (Step 3): Private Video Submission & 30-Day Media Vault** | In-browser camera recording (`MediaRecorder`) + file upload with consent capture; server-side MIME/magic-byte/size validation; private non-public storage vault; short-lived HMAC-signed `Range` video streaming; instant parent delete; scheduled 30-day auto-purge worker + audit logging. | Uploaded video streams only with valid signed token and authorized role; direct unauthenticated access returns `401/403`; parent delete physically removes file; retention sweep removes expired videos and logs audit rows. |
| **Milestone 4 (Step 4): Reviewer Workbench & Caregiver Rubric Scoring** | Reviewer Queue with age-band & status filters and claim workflow; split-screen secure video + activity reference + weighted rubric checklist; live caregiver instruction-match % calculator; non-diagnostic attestation; Parent Feedback Detail view. | Reviewer claims submission without seeing parent PII, scores rubric, verifies weighted % math, submits feedback; parent immediately views score, rubric breakdown, and coaching tip. |
| **Milestone 5 (Step 5): Admin Curriculum CMS, Audit Console & Hardening** | Admin 8×6 curriculum coverage matrix; full Activity, Step, Rubric, and Daily Plan editor; Reviewer account management; Media Access Audit Log & Retention monitor; accessibility, mobile touch-target, and end-to-end verification across all 3 roles. | Admin creates a new activity + weighted rubric + daily plan item and it immediately appears in matching parents' daily journey; audit log accurately tracks uploads, streams, and deletions; full lint & production build pass cleanly. |

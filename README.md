# LittleSteps — Early-Childhood Daily Activity Platform (0–24 Months)

LittleSteps is a calm, bilingual (**English & हिन्दी**) parenting and early-childhood development web application designed for mothers and caregivers with babies aged **0–24 months**.

Parents receive a structured daily learning journey tailored to their baby's exact 3-month age band, follow step-by-step home activities using everyday household items, optionally record or upload a private practice clip, and receive warm caregiver coaching from an authorized reviewer.

> **Caregiver Evaluation Principle:** An instruction-match percentage evaluates only how clearly the caregiver demonstrated the activity steps and safety guidance. LittleSteps never grades, scores, or diagnoses a baby's intelligence, health, or developmental status.

---

## Core Experience

- **8 Age Groups:** `0–3m`, `3–6m`, `6–9m`, `9–12m`, `12–15m`, `15–18m`, `18–21m`, `21–24m`
- **6 Development Domains:** Cognitive, Language & Communication, Physical, Social & Emotional, Sensory, and Early Independence
- **Parent Workspace:** Today's Learning Journey, Daily & Weekly Plan, Activity Studio (with learning objective, readable walkthrough transcript, safety notes, completion journal, and optional private video submission), Progress Overview, Parenting Guides, persistent Notifications, and live English ↔ Hindi switching
- **Reviewer Workbench:** Role-gated queue with `All Queue` / `My Reviews` filtering, age-group scope enforcement, pseudonymized parent view (`PAR-XXXXXX`), historical activity-version hydration, weighted caregiver rubric evaluation, and signed 5-minute video streaming
- **Admin Console:** Unified sidebar workspace with Platform Overview (`8 × 6` curriculum coverage matrix), Activity Management, Daily Plans, Reviewers, Users, and Media Safety & Audit Logs

---

## Architecture

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, custom LittleSteps calm design system (`sage`, `cream`, `offwhite`, `peach`, `lavender`, `charcoal`)
- **Backend:** Express (`server.ts`, `server/routes/api.ts`, `server/repositories/index.ts`, `server/services/evaluationService.ts`)
- **Database:** SQLite (`better-sqlite3`, WAL mode, foreign keys enforced) with 17 normalized tables and safe idempotent startup migrations (`server/db/schema.ts`)
- **Private Media Storage (Demo Phase):** `LocalPrivateMediaStorage` stores uploaded clips outside `public/` and `dist/` with binary magic-byte validation, short-lived HMAC-signed stream URLs (`5 min`), immediate parent deletion, and automatic 30-day retention purging

---

## Running Locally

**Prerequisites:** Node.js 20+ (22 LTS recommended)

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Configure environment variables** (copy `.env.example` to `.env` if customizing secrets or initial staff passwords):
   ```bash
   cp .env.example .env
   ```
3. **Start the full-stack server** (Express API + Vite frontend on port `3000`):
   ```bash
   npm run dev
   ```
4. **Open the application:**
   - Public site & Parent portal: `http://localhost:3000`
   - Parent Login: `http://localhost:3000/login`
   - Reviewer Portal: `http://localhost:3000/reviewer/login`
   - Admin Console: `http://localhost:3000/admin/login`

### Seeded Local Demo Accounts

| Role | Email | Default Local Password |
| --- | --- | --- |
| Parent | `meera@littlesteps.in` | `LittleSteps123!` |
| Reviewer | `ananya.reviewer@littlesteps.in` | `REVIEWER_INITIAL_PASSWORD` (defaults to `LittleSteps123!` locally) |
| Admin | `kavita.admin@littlesteps.in` | `ADMIN_INITIAL_PASSWORD` (defaults to `LittleSteps123!` locally) |

---

## Verification & Quality Scripts

| Command | Description |
| --- | --- |
| `npm run lint` | Strict TypeScript check (`tsc --noEmit`) |
| `npm run build` | Production Vite build with route-level code splitting |
| `npm test` | Unit, accessibility, performance/latency, security, and multi-role API integration tests |
| `npm run test:e2e` | Headless Chromium Playwright E2E, 6-viewport responsive check (`320px`–`1440px`), accessibility landmarks, and Core Web Vitals verification (requires server running on `http://localhost:3000`) |
| `npm start` | Start production Express server serving `/api/v1` and built `/dist` |

---

## Demo Storage vs. Production Readiness

Local disk storage (`./private_media`) and SQLite (`./data/littlesteps.db`) are intentional for Phase 2 development and demonstration. They are **not** intended for real family production traffic without completing the production checklist in [`docs/LAUNCH_RUNBOOK.md`](docs/LAUNCH_RUNBOOK.md):

1. Swap `LocalPrivateMediaStorage` for a private encrypted Cloud Object Storage adapter (e.g., GCS `asia-south1` / AWS S3 `ap-south-1` with KMS encryption and 30-day lifecycle deletion rules).
2. Migrate SQLite to Managed PostgreSQL with automated backups and disable demo account seeding in production.
3. Configure real transactional SMTP/email delivery for verification and password reset links.
4. Complete Indian **DPDP Act, 2023** legal & verifiable parental consent compliance review.
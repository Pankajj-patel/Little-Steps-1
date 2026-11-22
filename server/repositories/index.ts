import crypto from 'crypto';
import type Database from 'better-sqlite3';
import type {
  ActivityDetail,
  ActivityHistoryRecord,
  ActivityHistoryReviewFilter,
  ActivityPrepLevel,
  ActivityRubricCriterion,
  ActivityStatus,
  ActivityStep,
  ActivitySummary,
  ActivityVersionSnapshot,
  AdminAgeGroupItem,
  AdminDomainItem,
  AdminOverviewResponse,
  AdminReviewerItem,
  AdminSubmissionItem,
  AdminUserItem,
  AgeGroup,
  ChildProfile,
  CompletedHistoryItem,
  CompletionStatus,
  DomainProgressStat,
  JourneyActivityItem,
  JourneyDisplayStatus,
  LearningDomain,
  LocaleCode,
  MediaAuditAction,
  MediaAuditLogItem,
  ParentNotificationItem,
  ParentProgressOverviewResponse,
  QueuePriority,
  ReviewAuditAction,
  ReviewHistoryEntry,
  ReviewerDashboardSummary,
  ReviewerQueueItem,
  ReviewerSubmissionDetail,
  ReviewPublicationStatus,
  RubricAchievementLevel,
  SubmissionReviewDetail,
  SubmissionReviewStatus,
  UnifiedAuditCategory,
  UnifiedAuditLogItem,
  UpcomingPlanDay,
  UserProfile,
  UserRole,
  VideoStorageMode,
  VideoSubmissionSummary,
  WeeklyConsistencyBucket,
} from '../../src/shared/types.ts';
import {
  calculateAgeInMonths,
  getCalendarDateIso,
  resolveAgeGroupSlug,
} from '../../src/shared/domain.ts';
import { evaluateCaregiverRubric } from '../services/evaluationService.ts';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  phone_number: string | null;
  role: UserRole;
  preferred_locale: LocaleCode;
  profile_photo_url: string | null;
  preferred_activity_time: 'morning' | 'afternoon' | 'evening' | 'flexible';
  notification_preference: 'daily_gentle' | 'weekly_summary' | 'none';
  email_verified_at: string | null;
  onboarding_completed_at: string | null;
  session_version: number;
  reviewer_allowed_age_groups_json?: string | null;
  reviewer_specialty_note?: string | null;
  is_active: number;
  created_at: string;
}

function mapUser(row: UserRow): UserProfile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    phoneNumber: row.phone_number,
    role: row.role,
    preferredLocale: row.preferred_locale,
    profilePhotoUrl: row.profile_photo_url ?? null,
    preferredActivityTime: row.preferred_activity_time ?? 'morning',
    notificationPreference: row.notification_preference ?? 'daily_gentle',
    emailVerifiedAt: row.email_verified_at ?? null,
    onboardingCompletedAt: row.onboarding_completed_at ?? null,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
  };
}

export class LittleStepsRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  // ======================== USERS, AUTH TOKENS & ONBOARDING ========================

  findUserByEmail(
    email: string
  ): (UserProfile & { passwordHash: string; sessionVersion: number }) | null {
    const row = this.db
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(email.trim().toLowerCase()) as UserRow | undefined;
    if (!row) return null;
    return {
      ...mapUser(row),
      passwordHash: row.password_hash,
      sessionVersion: row.session_version ?? 1,
    };
  }

  findUserById(id: string): UserProfile | null {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
    return row ? mapUser(row) : null;
  }

  findUserAuthById(id: string): { user: UserProfile; sessionVersion: number } | null {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
    if (!row) return null;
    return { user: mapUser(row), sessionVersion: row.session_version ?? 1 };
  }

  createUser(params: {
    email: string;
    passwordHash: string;
    fullName: string;
    phoneNumber: string | null;
    role: UserRole;
    preferredLocale: LocaleCode;
    ipHash: string;
  }): { user: UserProfile; sessionVersion: number } {
    const id = `usr_${crypto.randomUUID().slice(0, 12)}`;
    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO users (id, email, password_hash, full_name, phone_number, role, preferred_locale, session_version)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
        )
        .run(
          id,
          params.email.trim().toLowerCase(),
          params.passwordHash,
          params.fullName.trim(),
          params.phoneNumber?.trim() || null,
          params.role,
          params.preferredLocale
        );
      this.db
        .prepare(
          `INSERT INTO user_consents (id, user_id, consent_type, policy_version, ip_hash)
           VALUES (?, ?, 'privacy_policy', 'v1.0', ?)`
        )
        .run(crypto.randomUUID(), id, params.ipHash);
    });
    tx();
    return this.findUserAuthById(id)!;
  }

  createAuthToken(params: {
    userId: string;
    tokenType: 'email_verification' | 'password_reset';
    tokenHash: string;
    expiresAt: string;
  }): void {
    const tx = this.db.transaction(() => {
      // Invalidate any previous unused tokens of the same type for this user
      this.db
        .prepare(
          `UPDATE auth_tokens
           SET used_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
           WHERE user_id = ? AND token_type = ? AND used_at IS NULL`
        )
        .run(params.userId, params.tokenType);

      this.db
        .prepare(
          `INSERT INTO auth_tokens (id, user_id, token_type, token_hash, expires_at)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(crypto.randomUUID(), params.userId, params.tokenType, params.tokenHash, params.expiresAt);
    });
    tx();
  }

  consumeAuthToken(
    tokenHash: string,
    tokenType: 'email_verification' | 'password_reset'
  ): { userId: string } | null {
    const row = this.db
      .prepare(
        `SELECT id, user_id, expires_at, used_at
         FROM auth_tokens
         WHERE token_hash = ? AND token_type = ?`
      )
      .get(tokenHash, tokenType) as
      | { id: string; user_id: string; expires_at: string; used_at: string | null }
      | undefined;

    if (!row || row.used_at !== null) return null;
    if (new Date(row.expires_at).getTime() <= Date.now()) return null;

    this.db
      .prepare("UPDATE auth_tokens SET used_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?")
      .run(row.id);

    return { userId: row.user_id };
  }

  markEmailVerified(userId: string): UserProfile | null {
    this.db
      .prepare(
        `UPDATE users
         SET email_verified_at = COALESCE(email_verified_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?`
      )
      .run(userId);
    return this.findUserById(userId);
  }

  updateUserPasswordAndBumpSession(userId: string, newPasswordHash: string): void {
    this.db
      .prepare(
        `UPDATE users
         SET password_hash = ?,
             session_version = session_version + 1,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?`
      )
      .run(newPasswordHash, userId);
  }

  updateParentProfileAndPreferences(
    userId: string,
    updates: {
      fullName?: string;
      email?: string;
      preferredLocale?: LocaleCode;
      profilePhotoUrl?: string | null;
      preferredActivityTime?: 'morning' | 'afternoon' | 'evening' | 'flexible';
      notificationPreference?: 'daily_gentle' | 'weekly_summary' | 'none';
      markOnboardingComplete?: boolean;
    }
  ): UserProfile | null {
    const existing = this.findUserById(userId);
    if (!existing) return null;

    const nextEmail = updates.email ? updates.email.trim().toLowerCase() : existing.email;
    const emailChanged = nextEmail !== existing.email;

    this.db
      .prepare(
        `UPDATE users
         SET full_name = ?,
             email = ?,
             preferred_locale = ?,
             profile_photo_url = ?,
             preferred_activity_time = ?,
             notification_preference = ?,
             email_verified_at = CASE WHEN ? = 1 THEN NULL ELSE email_verified_at END,
             onboarding_completed_at = CASE WHEN ? = 1
               THEN COALESCE(onboarding_completed_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
               ELSE onboarding_completed_at END,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?`
      )
      .run(
        updates.fullName !== undefined ? updates.fullName.trim() : existing.fullName,
        nextEmail,
        updates.preferredLocale ?? existing.preferredLocale,
        updates.profilePhotoUrl !== undefined ? updates.profilePhotoUrl : existing.profilePhotoUrl,
        updates.preferredActivityTime ?? existing.preferredActivityTime,
        updates.notificationPreference ?? existing.notificationPreference,
        emailChanged ? 1 : 0,
        updates.markOnboardingComplete ? 1 : 0,
        userId
      );

    return this.findUserById(userId);
  }

  registerProfilePhoto(storageKey: string, ownerUserId: string): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO profile_photos (storage_key, owner_user_id)
         VALUES (?, ?)`
      )
      .run(storageKey, ownerUserId);
  }

  userOwnsPhotoKey(userId: string, storageKey: string): boolean {
    const ownedUpload = this.db
      .prepare('SELECT 1 as ok FROM profile_photos WHERE storage_key = ? AND owner_user_id = ?')
      .get(storageKey, userId);
    if (ownedUpload) return true;
    const expectedUrl = `/api/v1/profile/photo/${storageKey}`;
    const userRow = this.db
      .prepare('SELECT 1 as ok FROM users WHERE id = ? AND profile_photo_url = ?')
      .get(userId, expectedUrl);
    if (userRow) return true;
    const childRow = this.db
      .prepare('SELECT 1 as ok FROM children WHERE parent_user_id = ? AND profile_photo_url = ?')
      .get(userId, expectedUrl);
    return Boolean(childRow);
  }

  recordUserConsent(
    userId: string,
    consentType: 'video_processing' | 'privacy_policy' | 'child_data',
    ipHash: string
  ): { id: string; grantedAt: string } {
    const id = `cns_${crypto.randomUUID().slice(0, 12)}`;
    const grantedAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO user_consents (id, user_id, consent_type, policy_version, granted_at, ip_hash)
         VALUES (?, ?, ?, 'v1.0', ?, ?)`
      )
      .run(id, userId, consentType, grantedAt, ipHash);
    return { id, grantedAt };
  }

  listAllUsers(): UserProfile[] {
    const rows = this.db
      .prepare('SELECT * FROM users ORDER BY created_at DESC')
      .all() as UserRow[];
    return rows.map(mapUser);
  }

  listAdminUsers(): AdminUserItem[] {
    const rows = this.db
      .prepare(
        `SELECT u.*,
                (SELECT COUNT(*) FROM children c WHERE c.parent_user_id = u.id) as children_count,
                (SELECT COUNT(*) FROM video_submissions vs WHERE vs.parent_user_id = u.id) as submissions_count,
                (SELECT COUNT(*) FROM submission_reviews sr WHERE sr.reviewer_user_id = u.id AND sr.review_status = 'published') as completed_reviews_count
         FROM users u
         ORDER BY u.created_at DESC`
      )
      .all() as Array<
      UserRow & {
        children_count: number;
        submissions_count: number;
        completed_reviews_count: number;
      }
    >;

    return rows.map((row) => ({
      ...mapUser(row),
      childrenCount: row.children_count ?? 0,
      submissionsCount: row.submissions_count ?? 0,
      completedReviewsCount: row.completed_reviews_count ?? 0,
      allowedAgeGroupSlugs: this.parseJsonStringArray(row.reviewer_allowed_age_groups_json),
      specialtyNote: row.reviewer_specialty_note ?? null,
    }));
  }

  listAdminReviewers(): AdminReviewerItem[] {
    const rows = this.db
      .prepare(
        `SELECT u.*,
                (SELECT COUNT(*) FROM submission_reviews sr
                 WHERE sr.reviewer_user_id = u.id AND sr.review_status = 'published') as completed_reviews_count,
                (SELECT COUNT(*) FROM video_submissions vs
                 WHERE vs.assigned_reviewer_id = u.id AND vs.review_status IN ('queued', 'in_review')) as active_assigned_count
         FROM users u
         WHERE u.role = 'reviewer'
         ORDER BY u.is_active DESC, u.created_at DESC`
      )
      .all() as Array<
      UserRow & {
        completed_reviews_count: number;
        active_assigned_count: number;
      }
    >;

    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      isActive: row.is_active === 1,
      allowedAgeGroupSlugs: this.parseJsonStringArray(row.reviewer_allowed_age_groups_json),
      specialtyNote: row.reviewer_specialty_note ?? null,
      completedReviewsCount: row.completed_reviews_count ?? 0,
      activeAssignedCount: row.active_assigned_count ?? 0,
      createdAt: row.created_at,
    }));
  }

  createReviewerAccount(
    actorUserId: string,
    payload: {
      email: string;
      fullName: string;
      passwordHash: string;
      allowedAgeGroupSlugs: string[];
      specialtyNote?: string | null;
    }
  ): AdminReviewerItem {
    const id = `usr_rev_${crypto.randomUUID().slice(0, 10)}`;
    const normalizedEmail = payload.email.trim().toLowerCase();
    const nowIso = new Date().toISOString();
    const cleanSlugs = Array.from(new Set(payload.allowedAgeGroupSlugs.map((s) => s.trim()).filter(Boolean)));
    const cleanSpecialty = payload.specialtyNote?.trim() || null;

    this.db
      .prepare(
        `INSERT INTO users (
           id, email, password_hash, full_name, role, preferred_locale,
           email_verified_at, onboarding_completed_at,
           reviewer_allowed_age_groups_json, reviewer_specialty_note, is_active
         ) VALUES (?, ?, ?, ?, 'reviewer', 'en', ?, ?, ?, ?, 1)`
      )
      .run(
        id,
        normalizedEmail,
        payload.passwordHash,
        payload.fullName.trim(),
        nowIso,
        nowIso,
        JSON.stringify(cleanSlugs),
        cleanSpecialty
      );

    this.logAdminAudit({
      actorUserId,
      actorRole: 'admin',
      action: 'reviewer_created',
      entityType: 'user',
      entityId: id,
      summary: `Created reviewer account for ${payload.fullName.trim()} (${normalizedEmail})`,
      metadata: { allowedAgeGroupSlugs: cleanSlugs },
    });

    return this.listAdminReviewers().find((r) => r.id === id)!;
  }

  updateReviewerPermissions(
    actorUserId: string,
    reviewerId: string,
    payload: {
      isActive?: boolean;
      allowedAgeGroupSlugs?: string[];
      specialtyNote?: string | null;
    }
  ): AdminReviewerItem | null {
    const existing = this.db
      .prepare("SELECT * FROM users WHERE id = ? AND role = 'reviewer'")
      .get(reviewerId) as UserRow | undefined;
    if (!existing) return null;

    const nextActive =
      payload.isActive !== undefined ? (payload.isActive ? 1 : 0) : existing.is_active;
    const nextSlugs =
      payload.allowedAgeGroupSlugs !== undefined
        ? Array.from(new Set(payload.allowedAgeGroupSlugs.map((s) => s.trim()).filter(Boolean)))
        : this.parseJsonStringArray(existing.reviewer_allowed_age_groups_json);
    const nextSpecialty =
      payload.specialtyNote !== undefined
        ? payload.specialtyNote?.trim() || null
        : existing.reviewer_specialty_note ?? null;

    this.db
      .prepare(
        `UPDATE users
         SET is_active = ?,
             reviewer_allowed_age_groups_json = ?,
             reviewer_specialty_note = ?,
             session_version = CASE WHEN ? = 0 THEN COALESCE(session_version, 1) + 1 ELSE session_version END,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?`
      )
      .run(nextActive, JSON.stringify(nextSlugs), nextSpecialty, nextActive, reviewerId);

    this.logAdminAudit({
      actorUserId,
      actorRole: 'admin',
      action: 'reviewer_updated',
      entityType: 'user',
      entityId: reviewerId,
      summary: `Updated reviewer permissions for ${existing.full_name} (${nextActive === 1 ? 'active' : 'suspended'})`,
      metadata: { isActive: nextActive === 1, allowedAgeGroupSlugs: nextSlugs },
    });

    return this.listAdminReviewers().find((r) => r.id === reviewerId) ?? null;
  }

  updateUserRoleAndStatus(
    userId: string,
    updates: { role?: UserRole; isActive?: boolean },
    actorUserId?: string
  ): UserProfile | null {
    const existing = this.findUserById(userId);
    if (!existing) return null;
    const nextRole = updates.role ?? existing.role;
    const nextActive =
      updates.isActive !== undefined ? (updates.isActive ? 1 : 0) : existing.isActive ? 1 : 0;

    // Safeguard: never leave the platform with zero active admins
    if (existing.role === 'admin' && (nextRole !== 'admin' || nextActive === 0)) {
      const otherAdmins = this.db
        .prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'admin' AND is_active = 1 AND id != ?")
        .get(userId) as { cnt: number };
      if (otherAdmins.cnt === 0) {
        throw new Error('At least one active admin account must remain on the platform.');
      }
    }

    const shouldInvalidateSessions = nextRole !== existing.role || nextActive === 0;
    this.db
      .prepare(
        `UPDATE users
         SET role = ?,
             is_active = ?,
             session_version = CASE WHEN ? = 1 THEN COALESCE(session_version, 1) + 1 ELSE session_version END,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?`
      )
      .run(nextRole, nextActive, shouldInvalidateSessions ? 1 : 0, userId);

    if (actorUserId) {
      this.logAdminAudit({
        actorUserId,
        actorRole: 'admin',
        action: 'user_updated',
        entityType: 'user',
        entityId: userId,
        summary: `Updated account ${existing.fullName}: role ${existing.role} -> ${nextRole}, status ${nextActive === 1 ? 'active' : 'disabled'}`,
        metadata: { previousRole: existing.role, nextRole, isActive: nextActive === 1 },
      });
    }

    return this.findUserById(userId);
  }

  private parseJsonStringArray(raw: string | null | undefined): string[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }

  // ======================== META: AGE GROUPS & DOMAINS ========================

  listAgeGroups(): AgeGroup[] {
    const rows = this.db
      .prepare('SELECT * FROM age_groups ORDER BY sort_order ASC')
      .all() as Array<{
      id: string;
      slug: string;
      label: string;
      min_months: number;
      max_months: number;
      sort_order: number;
    }>;
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      label: r.label,
      minMonths: r.min_months,
      maxMonths: r.max_months,
      sortOrder: r.sort_order,
    }));
  }

  listAdminAgeGroups(): AdminAgeGroupItem[] {
    const rows = this.db
      .prepare(
        `SELECT ag.*,
                (SELECT COUNT(*) FROM activities a WHERE a.age_group_id = ag.id) as activity_count,
                (SELECT COUNT(*) FROM activities a WHERE a.age_group_id = ag.id AND a.status = 'published') as published_activity_count,
                (SELECT COUNT(*) FROM children c WHERE c.active_age_group_id = ag.id) as children_count
         FROM age_groups ag
         ORDER BY ag.sort_order ASC`
      )
      .all() as Array<{
      id: string;
      slug: string;
      label: string;
      min_months: number;
      max_months: number;
      sort_order: number;
      activity_count: number;
      published_activity_count: number;
      children_count: number;
    }>;

    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      label: r.label,
      minMonths: r.min_months,
      maxMonths: r.max_months,
      sortOrder: r.sort_order,
      activityCount: r.activity_count ?? 0,
      publishedActivityCount: r.published_activity_count ?? 0,
      childrenCount: r.children_count ?? 0,
    }));
  }

  saveAgeGroup(
    actorUserId: string,
    payload: {
      id?: string;
      slug: string;
      label: string;
      minMonths: number;
      maxMonths: number;
      sortOrder: number;
    }
  ): AdminAgeGroupItem {
    const cleanSlug = payload.slug.trim().toLowerCase();
    const cleanLabel = payload.label.trim();
    if (payload.maxMonths <= payload.minMonths) {
      throw new Error('Maximum months must be greater than minimum months.');
    }

    if (payload.id) {
      const existing = this.db
        .prepare('SELECT id FROM age_groups WHERE id = ?')
        .get(payload.id) as { id: string } | undefined;
      if (!existing) {
        throw new Error('Age group not found.');
      }
      this.db
        .prepare(
          `UPDATE age_groups
           SET slug = ?, label = ?, min_months = ?, max_months = ?, sort_order = ?
           WHERE id = ?`
        )
        .run(cleanSlug, cleanLabel, payload.minMonths, payload.maxMonths, payload.sortOrder, payload.id);

      this.logAdminAudit({
        actorUserId,
        actorRole: 'admin',
        action: 'age_group_updated',
        entityType: 'age_group',
        entityId: payload.id,
        summary: `Updated age group "${cleanLabel}" (${payload.minMonths}–${payload.maxMonths} months)`,
      });

      return this.listAdminAgeGroups().find((g) => g.id === payload.id)!;
    }

    const id = `ag_${cleanSlug.replace(/[^a-z0-9_-]/g, '') || crypto.randomUUID().slice(0, 6)}`;
    this.db
      .prepare(
        `INSERT INTO age_groups (id, slug, label, min_months, max_months, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, cleanSlug, cleanLabel, payload.minMonths, payload.maxMonths, payload.sortOrder);

    this.logAdminAudit({
      actorUserId,
      actorRole: 'admin',
      action: 'age_group_created',
      entityType: 'age_group',
      entityId: id,
      summary: `Created age group "${cleanLabel}" (${payload.minMonths}–${payload.maxMonths} months)`,
    });

    return this.listAdminAgeGroups().find((g) => g.id === id)!;
  }

  findAgeGroupBySlug(slug: string): AgeGroup | null {
    const r = this.db.prepare('SELECT * FROM age_groups WHERE slug = ?').get(slug) as
      | {
          id: string;
          slug: string;
          label: string;
          min_months: number;
          max_months: number;
          sort_order: number;
        }
      | undefined;
    if (!r) return null;
    return {
      id: r.id,
      slug: r.slug,
      label: r.label,
      minMonths: r.min_months,
      maxMonths: r.max_months,
      sortOrder: r.sort_order,
    };
  }

  listLearningDomains(): LearningDomain[] {
    const rows = this.db
      .prepare('SELECT * FROM learning_domains ORDER BY sort_order ASC')
      .all() as Array<{
      id: string;
      slug: string;
      name: string;
      description: string;
      sort_order: number;
    }>;
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      description: r.description,
      sortOrder: r.sort_order,
    }));
  }

  listAdminDomains(): AdminDomainItem[] {
    const rows = this.db
      .prepare(
        `SELECT ld.*,
                (SELECT COUNT(*) FROM activities a WHERE a.domain_id = ld.id) as activity_count,
                (SELECT COUNT(*) FROM activities a WHERE a.domain_id = ld.id AND a.status = 'published') as published_activity_count
         FROM learning_domains ld
         ORDER BY ld.sort_order ASC`
      )
      .all() as Array<{
      id: string;
      slug: string;
      name: string;
      description: string;
      sort_order: number;
      activity_count: number;
      published_activity_count: number;
    }>;

    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      description: r.description,
      sortOrder: r.sort_order,
      activityCount: r.activity_count ?? 0,
      publishedActivityCount: r.published_activity_count ?? 0,
    }));
  }

  saveDomain(
    actorUserId: string,
    payload: {
      id?: string;
      slug: string;
      name: string;
      description: string;
      sortOrder: number;
    }
  ): AdminDomainItem {
    const cleanSlug = payload.slug.trim().toLowerCase();
    const cleanName = payload.name.trim();
    const cleanDesc = payload.description.trim();

    if (payload.id) {
      const existing = this.db
        .prepare('SELECT id FROM learning_domains WHERE id = ?')
        .get(payload.id) as { id: string } | undefined;
      if (!existing) {
        throw new Error('Development domain not found.');
      }
      this.db
        .prepare(
          `UPDATE learning_domains
           SET slug = ?, name = ?, description = ?, sort_order = ?
           WHERE id = ?`
        )
        .run(cleanSlug, cleanName, cleanDesc, payload.sortOrder, payload.id);

      this.logAdminAudit({
        actorUserId,
        actorRole: 'admin',
        action: 'domain_updated',
        entityType: 'learning_domain',
        entityId: payload.id,
        summary: `Updated development domain "${cleanName}"`,
      });

      return this.listAdminDomains().find((d) => d.id === payload.id)!;
    }

    const id = `dom_${cleanSlug.replace(/[^a-z0-9_-]/g, '') || crypto.randomUUID().slice(0, 6)}`;
    this.db
      .prepare(
        `INSERT INTO learning_domains (id, slug, name, description, sort_order)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(id, cleanSlug, cleanName, cleanDesc, payload.sortOrder);

    this.logAdminAudit({
      actorUserId,
      actorRole: 'admin',
      action: 'domain_created',
      entityType: 'learning_domain',
      entityId: id,
      summary: `Created development domain "${cleanName}"`,
    });

    return this.listAdminDomains().find((d) => d.id === id)!;
  }

  // ======================== CHILDREN ========================

  listChildrenByParent(parentUserId: string): ChildProfile[] {
    const rows = this.db
      .prepare(
        `SELECT c.*, ag.label as age_group_label, ag.slug as age_group_slug
         FROM children c
         JOIN age_groups ag ON ag.id = c.active_age_group_id
         WHERE c.parent_user_id = ?
         ORDER BY c.created_at ASC`
      )
      .all(parentUserId) as Array<{
      id: string;
      parent_user_id: string;
      display_name: string;
      date_of_birth: string;
      profile_photo_url: string | null;
      activity_preferences: string | null;
      active_age_group_id: string;
      age_group_label: string;
      age_group_slug: string;
      created_at: string;
    }>;

    return rows.map((r) => {
      const ageMonths = calculateAgeInMonths(r.date_of_birth);
      const currentSlug = resolveAgeGroupSlug(ageMonths);
      let activeAgeGroupId = r.active_age_group_id;
      let ageGroupLabel = r.age_group_label;
      let ageGroupSlug = r.age_group_slug;
      if (currentSlug !== r.age_group_slug) {
        const freshGroup = this.findAgeGroupBySlug(currentSlug);
        if (freshGroup) {
          this.db
            .prepare('UPDATE children SET active_age_group_id = ? WHERE id = ?')
            .run(freshGroup.id, r.id);
          activeAgeGroupId = freshGroup.id;
          ageGroupLabel = freshGroup.label;
          ageGroupSlug = freshGroup.slug;
        }
      }
      return {
        id: r.id,
        parentUserId: r.parent_user_id,
        displayName: r.display_name,
        dateOfBirth: r.date_of_birth,
        profilePhotoUrl: r.profile_photo_url ?? null,
        activityPreferences: r.activity_preferences ?? null,
        activeAgeGroupId,
        ageGroupLabel,
        ageGroupSlug,
        ageInMonths: ageMonths,
        createdAt: r.created_at,
      };
    });
  }

  findChildByIdForParent(childId: string, parentUserId: string): ChildProfile | null {
    const children = this.listChildrenByParent(parentUserId);
    return children.find((c) => c.id === childId) ?? null;
  }

  createChild(
    parentUserId: string,
    displayName: string,
    dateOfBirth: string,
    options?: { profilePhotoUrl?: string | null; activityPreferences?: string | null }
  ): ChildProfile {
    const ageMonths = calculateAgeInMonths(dateOfBirth);
    const slug = resolveAgeGroupSlug(ageMonths);
    const ageGroup = this.findAgeGroupBySlug(slug);
    if (!ageGroup) {
      throw new Error('Could not resolve age group');
    }
    const id = `ch_${crypto.randomUUID().slice(0, 10)}`;
    this.db
      .prepare(
        `INSERT INTO children (
           id, parent_user_id, display_name, date_of_birth,
           profile_photo_url, activity_preferences, active_age_group_id
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        parentUserId,
        displayName.trim(),
        dateOfBirth,
        options?.profilePhotoUrl ?? null,
        options?.activityPreferences?.trim() || null,
        ageGroup.id
      );
    return this.findChildByIdForParent(id, parentUserId)!;
  }

  updateChild(
    childId: string,
    parentUserId: string,
    displayName: string,
    dateOfBirth: string,
    options?: { profilePhotoUrl?: string | null; activityPreferences?: string | null }
  ): ChildProfile | null {
    const existing = this.findChildByIdForParent(childId, parentUserId);
    if (!existing) return null;
    const ageMonths = calculateAgeInMonths(dateOfBirth);
    const ageGroup = this.findAgeGroupBySlug(resolveAgeGroupSlug(ageMonths))!;
    this.db
      .prepare(
        `UPDATE children
         SET display_name = ?, date_of_birth = ?,
             profile_photo_url = ?, activity_preferences = ?,
             active_age_group_id = ?,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ? AND parent_user_id = ?`
      )
      .run(
        displayName.trim(),
        dateOfBirth,
        options?.profilePhotoUrl !== undefined ? options.profilePhotoUrl : existing.profilePhotoUrl,
        options?.activityPreferences !== undefined
          ? options.activityPreferences?.trim() || null
          : existing.activityPreferences,
        ageGroup.id,
        childId,
        parentUserId
      );
    return this.findChildByIdForParent(childId, parentUserId);
  }

  listActiveSubmissionsForChild(
    childId: string,
    parentUserId: string
  ): Array<{ id: string; storage_key: string }> {
    return this.db
      .prepare(
        `SELECT id, storage_key
         FROM video_submissions
         WHERE child_id = ?
           AND parent_user_id = ?
           AND storage_key IS NOT NULL
           AND deleted_at IS NULL`
      )
      .all(childId, parentUserId) as Array<{ id: string; storage_key: string }>;
  }

  deleteChild(childId: string, parentUserId: string): boolean {
    const res = this.db
      .prepare('DELETE FROM children WHERE id = ? AND parent_user_id = ?')
      .run(childId, parentUserId);
    return res.changes > 0;
  }

  // ======================== CURRICULUM & ACTIVITIES ========================

  listActivities(filters?: {
    ageGroupId?: string;
    domainId?: string;
    status?: ActivityStatus;
  }): ActivitySummary[] {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (filters?.ageGroupId) {
      conditions.push('a.age_group_id = ?');
      params.push(filters.ageGroupId);
    }
    if (filters?.domainId) {
      conditions.push('a.domain_id = ?');
      params.push(filters.domainId);
    }
    if (filters?.status) {
      conditions.push('a.status = ?');
      params.push(filters.status);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = this.db
      .prepare(
        `SELECT a.*, ag.slug as age_group_slug, ag.label as age_group_label,
                ld.slug as domain_slug, ld.name as domain_name
         FROM activities a
         JOIN age_groups ag ON ag.id = a.age_group_id
         JOIN learning_domains ld ON ld.id = a.domain_id
         ${whereClause}
         ORDER BY ag.sort_order ASC, ld.sort_order ASC, a.created_at DESC`
      )
      .all(...params) as Array<{
      id: string;
      age_group_id: string;
      age_group_slug: string;
      age_group_label: string;
      domain_id: string;
      domain_slug: string;
      domain_name: string;
      title: string;
      summary: string;
      objectives_json?: string | null;
      duration_minutes: number;
      prep_level?: ActivityPrepLevel | null;
      materials_json: string;
      safety_notes: string;
      instructional_poster_url: string;
      instructional_video_url?: string | null;
      status: ActivityStatus;
      version?: number | null;
      created_at: string;
    }>;

    return rows.map((r) => ({
      id: r.id,
      ageGroupId: r.age_group_id,
      ageGroupSlug: r.age_group_slug,
      ageGroupLabel: r.age_group_label,
      domainId: r.domain_id,
      domainSlug: r.domain_slug,
      domainName: r.domain_name,
      title: r.title,
      summary: r.summary,
      objectives: r.objectives_json ? (JSON.parse(r.objectives_json) as string[]) : [],
      durationMinutes: r.duration_minutes,
      prepLevel: (r.prep_level as ActivityPrepLevel) || 'quick_setup',
      version: r.version ?? 1,
      materials: JSON.parse(r.materials_json) as string[],
      safetyNotes: r.safety_notes,
      instructionalPosterUrl: r.instructional_poster_url,
      instructionalVideoUrl: r.instructional_video_url ?? null,
      status: r.status,
      createdAt: r.created_at,
    }));
  }

  getActivityDetail(activityId: string): ActivityDetail | null {
    const row = this.db
      .prepare(
        `SELECT a.*, ag.slug as age_group_slug, ag.label as age_group_label,
                ld.slug as domain_slug, ld.name as domain_name
         FROM activities a
         JOIN age_groups ag ON ag.id = a.age_group_id
         JOIN learning_domains ld ON ld.id = a.domain_id
         WHERE a.id = ?`
      )
      .get(activityId) as
      | {
          id: string;
          age_group_id: string;
          age_group_slug: string;
          age_group_label: string;
          domain_id: string;
          domain_slug: string;
          domain_name: string;
          title: string;
          summary: string;
          objectives_json?: string | null;
          duration_minutes: number;
          prep_level?: ActivityPrepLevel | null;
          materials_json: string;
          safety_notes: string;
          instructional_poster_url: string;
          instructional_video_url?: string | null;
          status: ActivityStatus;
          version?: number | null;
          created_at: string;
        }
      | undefined;
    if (!row) return null;

    const steps = (
      this.db
        .prepare('SELECT * FROM activity_steps WHERE activity_id = ? ORDER BY step_number ASC')
        .all(activityId) as Array<{
        id: string;
        activity_id: string;
        step_number: number;
        title: string;
        instruction_text: string;
        caregiver_tip: string | null;
      }>
    ).map<ActivityStep>((s) => ({
      id: s.id,
      activityId: s.activity_id,
      stepNumber: s.step_number,
      title: s.title,
      instructionText: s.instruction_text,
      caregiverTip: s.caregiver_tip,
    }));

    const rubricCriteria = (
      this.db
        .prepare(
          'SELECT * FROM activity_rubric_criteria WHERE activity_id = ? ORDER BY criterion_order ASC'
        )
        .all(activityId) as Array<{
        id: string;
        activity_id: string;
        criterion_order: number;
        label: string;
        description: string;
        weight_points: number;
      }>
    ).map<ActivityRubricCriterion>((c) => ({
      id: c.id,
      activityId: c.activity_id,
      criterionOrder: c.criterion_order,
      label: c.label,
      description: c.description,
      weightPoints: c.weight_points,
    }));

    return {
      id: row.id,
      ageGroupId: row.age_group_id,
      ageGroupSlug: row.age_group_slug,
      ageGroupLabel: row.age_group_label,
      domainId: row.domain_id,
      domainSlug: row.domain_slug,
      domainName: row.domain_name,
      title: row.title,
      summary: row.summary,
      objectives: row.objectives_json ? (JSON.parse(row.objectives_json) as string[]) : [],
      durationMinutes: row.duration_minutes,
      prepLevel: (row.prep_level as ActivityPrepLevel) || 'quick_setup',
      version: row.version ?? 1,
      materials: JSON.parse(row.materials_json) as string[],
      safetyNotes: row.safety_notes,
      instructionalPosterUrl: row.instructional_poster_url,
      instructionalVideoUrl: row.instructional_video_url ?? null,
      status: row.status,
      createdAt: row.created_at,
      steps,
      rubricCriteria,
    };
  }

  private writeActivityVersionSnapshot(params: {
    activityId: string;
    versionNumber: number;
    changeNote: string | null;
    createdBy: string;
    detail: ActivityDetail;
  }): void {
    const snapshot = {
      title: params.detail.title,
      summary: params.detail.summary,
      ageGroupId: params.detail.ageGroupId,
      domainId: params.detail.domainId,
      objectives: params.detail.objectives,
      durationMinutes: params.detail.durationMinutes,
      prepLevel: params.detail.prepLevel,
      materials: params.detail.materials,
      safetyNotes: params.detail.safetyNotes,
      instructionalPosterUrl: params.detail.instructionalPosterUrl,
      instructionalVideoUrl: params.detail.instructionalVideoUrl,
      status: params.detail.status,
      steps: params.detail.steps.map((s) => ({
        stepNumber: s.stepNumber,
        title: s.title,
        instructionText: s.instructionText,
        caregiverTip: s.caregiverTip,
      })),
      rubricCriteria: params.detail.rubricCriteria.map((c) => ({
        criterionOrder: c.criterionOrder,
        label: c.label,
        description: c.description,
        weightPoints: c.weightPoints,
      })),
    };

    this.db
      .prepare(
        `INSERT OR REPLACE INTO activity_versions (
           id, activity_id, version_number, snapshot_json, change_note, created_by
         ) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        `av_${params.activityId}_v${params.versionNumber}`,
        params.activityId,
        params.versionNumber,
        JSON.stringify(snapshot),
        params.changeNote,
        params.createdBy
      );
  }

  listActivityVersions(activityId: string): ActivityVersionSnapshot[] {
    const rows = this.db
      .prepare(
        `SELECT av.*,
                COALESCE(u.full_name, 'Curriculum Admin') as created_by_name,
                (SELECT COUNT(*) FROM video_submissions vs
                 WHERE vs.activity_id = av.activity_id
                   AND vs.activity_version = av.version_number) as linked_submissions_count
         FROM activity_versions av
         LEFT JOIN users u ON u.id = av.created_by
         WHERE av.activity_id = ?
         ORDER BY av.version_number DESC`
      )
      .all(activityId) as Array<{
      id: string;
      activity_id: string;
      version_number: number;
      snapshot_json: string;
      change_note: string | null;
      created_by: string | null;
      created_by_name: string;
      created_at: string;
      linked_submissions_count: number;
    }>;

    return rows.map((r) => {
      const parsed = JSON.parse(r.snapshot_json) as Record<string, unknown>;
      const rawSteps = Array.isArray(parsed.steps)
        ? (parsed.steps as Array<Record<string, unknown>>)
        : [];
      const rawRubric = Array.isArray(parsed.rubricCriteria)
        ? (parsed.rubricCriteria as Array<Record<string, unknown>>)
        : [];

      return {
        id: r.id,
        activityId: r.activity_id,
        versionNumber: r.version_number,
        changeNote: r.change_note,
        createdBy: r.created_by,
        createdByName: r.created_by_name,
        createdAt: r.created_at,
        linkedSubmissionsCount: r.linked_submissions_count ?? 0,
        snapshot: {
          title: String(parsed.title ?? ''),
          summary: String(parsed.summary ?? ''),
          ageGroupId: String(parsed.ageGroupId ?? ''),
          domainId: String(parsed.domainId ?? ''),
          objectives: Array.isArray(parsed.objectives)
            ? parsed.objectives.filter((o): o is string => typeof o === 'string')
            : [],
          durationMinutes: Number(parsed.durationMinutes ?? 5),
          prepLevel: (parsed.prepLevel as ActivityPrepLevel) || 'quick_setup',
          materials: Array.isArray(parsed.materials)
            ? parsed.materials.filter((m): m is string => typeof m === 'string')
            : [],
          safetyNotes: String(parsed.safetyNotes ?? ''),
          instructionalPosterUrl: String(parsed.instructionalPosterUrl ?? ''),
          instructionalVideoUrl:
            typeof parsed.instructionalVideoUrl === 'string' && parsed.instructionalVideoUrl
              ? parsed.instructionalVideoUrl
              : null,
          status: (parsed.status as ActivityStatus) || 'draft',
          steps: rawSteps.map((s, idx) => ({
            stepNumber: Number(s.stepNumber ?? s.step_number ?? idx + 1),
            title: String(s.title ?? ''),
            instructionText: String(s.instructionText ?? s.instruction_text ?? ''),
            caregiverTip:
              typeof (s.caregiverTip ?? s.caregiver_tip) === 'string'
                ? String(s.caregiverTip ?? s.caregiver_tip)
                : null,
          })),
          rubricCriteria: rawRubric.map((c, idx) => ({
            criterionOrder: Number(c.criterionOrder ?? c.criterion_order ?? idx + 1),
            label: String(c.label ?? ''),
            description: String(c.description ?? ''),
            weightPoints: Number(c.weightPoints ?? c.weight_points ?? 0),
          })),
        },
      };
    });
  }

  saveActivity(
    createdBy: string,
    payload: {
      id?: string;
      ageGroupId: string;
      domainId: string;
      title: string;
      summary: string;
      objectives?: string[];
      durationMinutes: number;
      prepLevel?: ActivityPrepLevel;
      materials: string[];
      safetyNotes: string;
      instructionalPosterUrl: string;
      instructionalVideoUrl?: string | null;
      status: ActivityStatus;
      changeNote?: string | null;
      steps: Array<{ title: string; instructionText: string; caregiverTip?: string | null }>;
      rubricCriteria: Array<{ label: string; description: string; weightPoints: number }>;
    }
  ): ActivityDetail {
    const isUpdate = Boolean(payload.id);
    const activityId = payload.id || `act_${crypto.randomUUID().slice(0, 10)}`;
    const cleanObjectives = (payload.objectives ?? []).map((o) => o.trim()).filter(Boolean);
    const cleanVideoUrl = payload.instructionalVideoUrl?.trim() || null;
    const cleanPrepLevel: ActivityPrepLevel = payload.prepLevel || 'quick_setup';

    const tx = this.db.transaction(() => {
      if (isUpdate) {
        const existing = this.getActivityDetail(activityId);
        if (!existing) {
          throw new Error('Activity not found.');
        }
        // Ensure prior version is preserved in activity_versions before advancing to the new version
        const hasPriorSnapshot = this.db
          .prepare('SELECT 1 as ok FROM activity_versions WHERE activity_id = ? AND version_number = ?')
          .get(activityId, existing.version);
        if (!hasPriorSnapshot) {
          this.writeActivityVersionSnapshot({
            activityId,
            versionNumber: existing.version,
            changeNote: 'Preserved snapshot prior to update',
            createdBy,
            detail: existing,
          });
        }

        this.db
          .prepare(
            `UPDATE activities
             SET age_group_id = ?, domain_id = ?, title = ?, summary = ?, objectives_json = ?,
                 duration_minutes = ?, prep_level = ?, materials_json = ?, safety_notes = ?,
                 instructional_poster_url = ?, instructional_video_url = ?, status = ?,
                 version = COALESCE(version, 1) + 1,
                 updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE id = ?`
          )
          .run(
            payload.ageGroupId,
            payload.domainId,
            payload.title.trim(),
            payload.summary.trim(),
            JSON.stringify(cleanObjectives),
            payload.durationMinutes,
            cleanPrepLevel,
            JSON.stringify(payload.materials),
            payload.safetyNotes.trim(),
            payload.instructionalPosterUrl,
            cleanVideoUrl,
            payload.status,
            activityId
          );
        this.db.prepare('DELETE FROM activity_steps WHERE activity_id = ?').run(activityId);
        // Only recreate rubric criteria if no reviews reference them; otherwise update in place to protect historical scores
        const reviewRefCount = this.db
          .prepare(
            `SELECT COUNT(*) as cnt FROM review_rubric_scores rrs
             JOIN activity_rubric_criteria arc ON arc.id = rrs.rubric_criterion_id
             WHERE arc.activity_id = ?`
          )
          .get(activityId) as { cnt: number };
        if (reviewRefCount.cnt === 0) {
          this.db
            .prepare('DELETE FROM activity_rubric_criteria WHERE activity_id = ?')
            .run(activityId);
        } else {
          const existingCriteria = this.db
            .prepare(
              'SELECT id FROM activity_rubric_criteria WHERE activity_id = ? ORDER BY criterion_order ASC'
            )
            .all(activityId) as Array<{ id: string }>;
          payload.rubricCriteria.forEach((c, idx) => {
            if (existingCriteria[idx]) {
              this.db
                .prepare(
                  `UPDATE activity_rubric_criteria
                   SET label = ?, description = ?, weight_points = ?
                   WHERE id = ?`
                )
                .run(c.label.trim(), c.description.trim(), c.weightPoints, existingCriteria[idx].id);
            } else {
              this.db
                .prepare(
                  `INSERT INTO activity_rubric_criteria (id, activity_id, criterion_order, label, description, weight_points)
                   VALUES (?, ?, ?, ?, ?, ?)`
                )
                .run(
                  crypto.randomUUID(),
                  activityId,
                  idx + 1,
                  c.label.trim(),
                  c.description.trim(),
                  c.weightPoints
                );
            }
          });
        }
      } else {
        this.db
          .prepare(
            `INSERT INTO activities (
               id, age_group_id, domain_id, title, summary, objectives_json,
               duration_minutes, prep_level, materials_json, safety_notes,
               instructional_poster_url, instructional_video_url, status, version, created_by
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
          )
          .run(
            activityId,
            payload.ageGroupId,
            payload.domainId,
            payload.title.trim(),
            payload.summary.trim(),
            JSON.stringify(cleanObjectives),
            payload.durationMinutes,
            cleanPrepLevel,
            JSON.stringify(payload.materials),
            payload.safetyNotes.trim(),
            payload.instructionalPosterUrl,
            cleanVideoUrl,
            payload.status,
            createdBy
          );
      }

      const insertStep = this.db.prepare(
        `INSERT INTO activity_steps (id, activity_id, step_number, title, instruction_text, caregiver_tip)
         VALUES (?, ?, ?, ?, ?, ?)`
      );
      payload.steps.forEach((s, idx) => {
        insertStep.run(
          crypto.randomUUID(),
          activityId,
          idx + 1,
          s.title.trim(),
          s.instructionText.trim(),
          s.caregiverTip?.trim() || null
        );
      });

      const currentRubricCount = this.db
        .prepare('SELECT COUNT(*) as cnt FROM activity_rubric_criteria WHERE activity_id = ?')
        .get(activityId) as { cnt: number };
      if (currentRubricCount.cnt === 0) {
        const insertRubric = this.db.prepare(
          `INSERT INTO activity_rubric_criteria (id, activity_id, criterion_order, label, description, weight_points)
           VALUES (?, ?, ?, ?, ?, ?)`
        );
        payload.rubricCriteria.forEach((c, idx) => {
          insertRubric.run(
            crypto.randomUUID(),
            activityId,
            idx + 1,
            c.label.trim(),
            c.description.trim(),
            c.weightPoints
          );
        });
      }

      const savedDetail = this.getActivityDetail(activityId)!;
      this.writeActivityVersionSnapshot({
        activityId,
        versionNumber: savedDetail.version,
        changeNote:
          payload.changeNote?.trim() ||
          (isUpdate ? `Updated content & rubric (v${savedDetail.version})` : 'Initial version created'),
        createdBy,
        detail: savedDetail,
      });

      this.logAdminAudit({
        actorUserId: createdBy,
        actorRole: 'admin',
        action: isUpdate ? 'activity_updated' : 'activity_created',
        entityType: 'activity',
        entityId: activityId,
        summary: `${isUpdate ? 'Updated' : 'Created'} activity "${savedDetail.title}" (v${savedDetail.version}, ${savedDetail.status})`,
        metadata: { version: savedDetail.version, status: savedDetail.status },
      });
    });
    tx();
    return this.getActivityDetail(activityId)!;
  }

  updateActivityStatus(
    actorUserId: string,
    activityId: string,
    status: ActivityStatus
  ): ActivityDetail | null {
    const existing = this.getActivityDetail(activityId);
    if (!existing) return null;
    if (existing.status === status) return existing;

    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE activities
           SET status = ?,
               version = COALESCE(version, 1) + 1,
               updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
           WHERE id = ?`
        )
        .run(status, activityId);

      const updated = this.getActivityDetail(activityId)!;
      this.writeActivityVersionSnapshot({
        activityId,
        versionNumber: updated.version,
        changeNote: `Status changed from ${existing.status} to ${status}`,
        createdBy: actorUserId,
        detail: updated,
      });

      this.logAdminAudit({
        actorUserId,
        actorRole: 'admin',
        action:
          status === 'archived'
            ? 'activity_archived'
            : status === 'published'
              ? 'activity_published'
              : 'activity_status_changed',
        entityType: 'activity',
        entityId: activityId,
        summary: `Changed activity "${updated.title}" status: ${existing.status} -> ${status} (v${updated.version})`,
        metadata: { previousStatus: existing.status, nextStatus: status, version: updated.version },
      });
    });
    tx();
    return this.getActivityDetail(activityId);
  }

  deleteActivity(activityId: string, actorUserId?: string): boolean {
    const existing = this.getActivityDetail(activityId);
    if (!existing) return false;

    const linkedSubCount = (
      this.db
        .prepare('SELECT COUNT(*) as cnt FROM video_submissions WHERE activity_id = ?')
        .get(activityId) as { cnt: number }
    ).cnt;
    if (linkedSubCount > 0) {
      throw new Error(
        `This activity has ${linkedSubCount} linked video submission(s). Archive it instead to preserve review history.`
      );
    }

    const res = this.db.prepare('DELETE FROM activities WHERE id = ?').run(activityId);
    if (res.changes > 0 && actorUserId) {
      this.logAdminAudit({
        actorUserId,
        actorRole: 'admin',
        action: 'activity_deleted',
        entityType: 'activity',
        entityId: activityId,
        summary: `Deleted activity "${existing.title}"`,
      });
    }
    return res.changes > 0;
  }

  // ======================== DAILY PLANS & JOURNEY ========================

  listDailyPlansForAgeGroup(ageGroupId: string): Array<{
    id: string;
    ageGroupId: string;
    dayNumber: number;
    title: string;
    focusNote: string;
    activityIds: string[];
  }> {
    const plans = this.db
      .prepare('SELECT * FROM daily_plans WHERE age_group_id = ? ORDER BY day_number ASC')
      .all(ageGroupId) as Array<{
      id: string;
      age_group_id: string;
      day_number: number;
      title: string;
      focus_note: string;
    }>;

    return plans.map((p) => {
      const items = this.db
        .prepare('SELECT activity_id FROM daily_plan_items WHERE daily_plan_id = ? ORDER BY sort_order ASC')
        .all(p.id) as Array<{ activity_id: string }>;
      return {
        id: p.id,
        ageGroupId: p.age_group_id,
        dayNumber: p.day_number,
        title: p.title,
        focusNote: p.focus_note,
        activityIds: items.map((i) => i.activity_id),
      };
    });
  }

  upsertDailyPlan(
    params: {
      ageGroupId: string;
      dayNumber: number;
      title: string;
      focusNote: string;
      activityIds: string[];
    },
    actorUserId?: string
  ): void {
    let savedPlanId = '';
    const tx = this.db.transaction(() => {
      const existing = this.db
        .prepare('SELECT id FROM daily_plans WHERE age_group_id = ? AND day_number = ?')
        .get(params.ageGroupId, params.dayNumber) as { id: string } | undefined;

      const planId = existing ? existing.id : `plan_${crypto.randomUUID().slice(0, 10)}`;
      savedPlanId = planId;
      if (existing) {
        this.db
          .prepare('UPDATE daily_plans SET title = ?, focus_note = ? WHERE id = ?')
          .run(params.title.trim(), params.focusNote.trim(), planId);
        this.db.prepare('DELETE FROM daily_plan_items WHERE daily_plan_id = ?').run(planId);
      } else {
        this.db
          .prepare(
            'INSERT INTO daily_plans (id, age_group_id, day_number, title, focus_note) VALUES (?, ?, ?, ?, ?)'
          )
          .run(planId, params.ageGroupId, params.dayNumber, params.title.trim(), params.focusNote.trim());
      }

      const insertItem = this.db.prepare(
        'INSERT INTO daily_plan_items (id, daily_plan_id, activity_id, sort_order) VALUES (?, ?, ?, ?)'
      );
      // Business rule: prevent duplicate activities within a daily plan and verify matching age group
      const uniqueActivityIds = Array.from(new Set(params.activityIds));
      uniqueActivityIds.forEach((actId, idx) => {
        const act = this.getActivityDetail(actId);
        if (act && act.ageGroupId === params.ageGroupId) {
          insertItem.run(crypto.randomUUID(), planId, actId, idx + 1);
        }
      });

      if (actorUserId) {
        this.logAdminAudit({
          actorUserId,
          actorRole: 'admin',
          action: existing ? 'daily_plan_updated' : 'daily_plan_created',
          entityType: 'daily_plan',
          entityId: savedPlanId,
          summary: `${existing ? 'Updated' : 'Created'} Day ${params.dayNumber} plan "${params.title.trim()}" (${uniqueActivityIds.length} activities)`,
          metadata: { ageGroupId: params.ageGroupId, dayNumber: params.dayNumber },
        });
      }
    });
    tx();
  }

  deleteDailyPlan(planId: string, actorUserId: string): boolean {
    const existing = this.db
      .prepare('SELECT id, age_group_id, day_number, title FROM daily_plans WHERE id = ?')
      .get(planId) as { id: string; age_group_id: string; day_number: number; title: string } | undefined;
    if (!existing) return false;

    const res = this.db.prepare('DELETE FROM daily_plans WHERE id = ?').run(planId);
    if (res.changes > 0) {
      this.logAdminAudit({
        actorUserId,
        actorRole: 'admin',
        action: 'daily_plan_deleted',
        entityType: 'daily_plan',
        entityId: planId,
        summary: `Deleted Day ${existing.day_number} plan "${existing.title}"`,
        metadata: { ageGroupId: existing.age_group_id, dayNumber: existing.day_number },
      });
    }
    return res.changes > 0;
  }

  /**
   * Business rule: An activity is ONLY marked 'reviewed' when a real submission_reviews record exists,
   * and only 'submitted_for_review' when an active queued/in_review submission exists.
   */
  private resolveEffectiveDisplayStatus(
    completionStatus: CompletionStatus | null,
    latestSubmission: VideoSubmissionSummary | null
  ): JourneyDisplayStatus {
    if (latestSubmission?.review) {
      return 'reviewed';
    }
    if (
      latestSubmission &&
      (latestSubmission.reviewStatus === 'queued' || latestSubmission.reviewStatus === 'in_review')
    ) {
      return 'submitted_for_review';
    }
    if (
      completionStatus === 'completed' ||
      completionStatus === 'submitted_for_review' ||
      completionStatus === 'reviewed'
    ) {
      return 'completed';
    }
    if (completionStatus === 'started') {
      return 'in_progress';
    }
    return 'not_started';
  }

  private computeLearningWeek(child: ChildProfile) {
    const ageGroup = this.findAgeGroupBySlug(child.ageGroupSlug);
    const minMonths = ageGroup?.minMonths ?? 0;
    const maxMonths = ageGroup?.maxMonths ?? 3;
    const totalStageWeeks = Math.max(1, (maxMonths - minMonths) * 4);
    const monthsIntoStage = Math.max(0, child.ageInMonths - minMonths);
    const weekNumber = Math.min(totalStageWeeks, Math.max(1, monthsIntoStage * 4 + 1));
    return {
      weekNumber,
      totalStageWeeks,
      stageLabel: child.ageGroupLabel,
      todayDateIso: getCalendarDateIso(),
    };
  }

  getJourneyForChild(child: ChildProfile, requestedDayNumber?: number) {
    const plans = this.listDailyPlansForAgeGroup(child.activeAgeGroupId);
    const availableDays = plans.map((p) => ({
      dayNumber: p.dayNumber,
      title: p.title,
      focusNote: p.focusNote,
    }));

    const selectedPlan =
      plans.find((p) => p.dayNumber === requestedDayNumber) ??
      plans[0] ?? {
        id: 'fallback',
        ageGroupId: child.activeAgeGroupId,
        dayNumber: 1,
        title: 'Day 1 · Calm Discovery',
        focusNote: 'Gentle, age-appropriate activities for today.',
        activityIds: this.listActivities({
          ageGroupId: child.activeAgeGroupId,
          status: 'published',
        })
          .slice(0, 3)
          .map((a) => a.id),
      };

    const items: JourneyActivityItem[] = [];
    const seenActivityIds = new Set<string>();
    selectedPlan.activityIds.forEach((actId, idx) => {
      // Business rule: never duplicate activities within the same daily plan
      if (seenActivityIds.has(actId)) return;
      const activity = this.getActivityDetail(actId);
      // Business rule: strictly filter activities by the baby's active age group & published status
      if (!activity || activity.status !== 'published' || activity.ageGroupId !== child.activeAgeGroupId) {
        return;
      }
      seenActivityIds.add(actId);

      const comp = this.db
        .prepare(
          `SELECT id, status, caregiver_notes, completed_at
           FROM activity_completions
           WHERE child_id = ? AND activity_id = ?
           ORDER BY COALESCE(last_opened_at, completed_at, created_at) DESC LIMIT 1`
        )
        .get(child.id, actId) as
        | {
            id: string;
            status: CompletionStatus;
            caregiver_notes: string | null;
            completed_at: string | null;
          }
        | undefined;

      const latestSubmission = this.findLatestSubmissionForChildActivity(child.id, actId);
      const displayStatus = this.resolveEffectiveDisplayStatus(
        comp?.status ?? null,
        latestSubmission
      );

      items.push({
        planItemId: `${selectedPlan.id}_${actId}`,
        sortOrder: idx + 1,
        activity,
        displayStatus,
        completion: comp
          ? {
              id: comp.id,
              status: comp.status,
              caregiverNotes: comp.caregiver_notes,
              completedAt: comp.completed_at,
            }
          : null,
        latestSubmission,
      });
    });

    const completedTodayCount = items.filter(
      (i) =>
        i.displayStatus === 'completed' ||
        i.displayStatus === 'submitted_for_review' ||
        i.displayStatus === 'reviewed'
    ).length;
    const totalTodayCount = items.length;
    const completionPct =
      totalTodayCount > 0 ? Math.round((completedTodayCount / totalTodayCount) * 100) : 0;

    // Build upcoming days strictly from child's active age group, without duplicate activities per day
    const upcomingDays: UpcomingPlanDay[] = [];
    const todayDate = new Date();
    plans
      .filter((p) => p.dayNumber > selectedPlan.dayNumber)
      .forEach((plan, idx) => {
        const scheduled = new Date(todayDate);
        scheduled.setDate(todayDate.getDate() + idx + 1);
        const daySeen = new Set<string>();
        const acts: ActivitySummary[] = [];
        for (const aid of plan.activityIds) {
          if (daySeen.has(aid)) continue;
          const detail = this.getActivityDetail(aid);
          if (!detail || detail.status !== 'published' || detail.ageGroupId !== child.activeAgeGroupId) {
            continue;
          }
          daySeen.add(aid);
          acts.push(detail);
        }
        if (acts.length > 0) {
          upcomingDays.push({
            dayNumber: plan.dayNumber,
            title: plan.title,
            focusNote: plan.focusNote,
            scheduledDate: scheduled.toISOString().slice(0, 10),
            activities: acts,
          });
        }
      });

    const inProgressItems = this.listInProgressItemsForChild(child);
    const completedHistory = this.listCompletedHistoryForChild(child.id);
    const domainProgress = this.getDomainProgressForChild(child.id, child.activeAgeGroupId);
    const weeklyProgress = this.getWeeklyProgressForChild(child.id);
    const lastActivity = this.getLastOpenedActivityForChild(child.id);
    const recentSubmissions = this.listSubmissionsForChild(child.id);
    const parentingTip = this.getParentingTipForAgeGroup(child.ageGroupSlug);
    const parent = this.findUserById(child.parentUserId);
    const notifications = this.buildParentNotifications(parent, child, recentSubmissions, items);
    const learningWeek = this.computeLearningWeek(child);

    return {
      child,
      learningWeek,
      availableDays,
      selectedDay: {
        id: selectedPlan.id,
        dayNumber: selectedPlan.dayNumber,
        title: selectedPlan.title,
        focusNote: selectedPlan.focusNote,
      },
      todaySummary: {
        completedTodayCount,
        totalTodayCount,
        completionPct,
      },
      items,
      upcomingDays,
      inProgressItems,
      completedHistory,
      weeklyProgress,
      domainProgress,
      lastActivity,
      parentingTip,
      notifications,
      recentSubmissions,
    };
  }

  private listInProgressItemsForChild(child: ChildProfile): JourneyActivityItem[] {
    const rows = this.db
      .prepare(
        `SELECT id, activity_id, status, caregiver_notes, completed_at
         FROM activity_completions
         WHERE child_id = ? AND status = 'started'
         ORDER BY COALESCE(last_opened_at, created_at) DESC
         LIMIT 5`
      )
      .all(child.id) as Array<{
      id: string;
      activity_id: string;
      status: CompletionStatus;
      caregiver_notes: string | null;
      completed_at: string | null;
    }>;

    const results: JourneyActivityItem[] = [];
    const seen = new Set<string>();
    rows.forEach((row, idx) => {
      if (seen.has(row.activity_id)) return;
      const activity = this.getActivityDetail(row.activity_id);
      if (!activity || activity.status !== 'published' || activity.ageGroupId !== child.activeAgeGroupId) {
        return;
      }
      const latestSubmission = this.findLatestSubmissionForChildActivity(child.id, row.activity_id);
      const displayStatus = this.resolveEffectiveDisplayStatus(row.status, latestSubmission);
      if (displayStatus !== 'in_progress') return;
      seen.add(row.activity_id);
      results.push({
        planItemId: `inprog_${row.id}`,
        sortOrder: idx + 1,
        activity,
        displayStatus,
        completion: {
          id: row.id,
          status: row.status,
          caregiverNotes: row.caregiver_notes,
          completedAt: row.completed_at,
        },
        latestSubmission,
      });
    });
    return results;
  }

  /**
   * Returns immutable historical completion records across all age stages.
   * Changing the baby's age later never rewrites age_group_id_snapshot / age_group_label_snapshot.
   */
  listCompletedHistoryForChild(childId: string): CompletedHistoryItem[] {
    const rows = this.db
      .prepare(
        `SELECT ac.id, ac.activity_id, ac.plan_date, ac.status, ac.caregiver_notes,
                COALESCE(ac.completed_at, ac.created_at) as completed_at,
                COALESCE(ac.age_group_id_snapshot, a.age_group_id) as age_group_id_snapshot,
                COALESCE(ac.age_group_label_snapshot, ag.label) as age_group_label_snapshot,
                a.title as activity_title, a.duration_minutes, a.prep_level,
                ld.name as domain_name, ld.slug as domain_slug
         FROM activity_completions ac
         JOIN activities a ON a.id = ac.activity_id
         JOIN age_groups ag ON ag.id = a.age_group_id
         JOIN learning_domains ld ON ld.id = a.domain_id
         WHERE ac.child_id = ?
           AND ac.status IN ('completed', 'submitted_for_review', 'reviewed')
         ORDER BY COALESCE(ac.completed_at, ac.created_at) DESC
         LIMIT 50`
      )
      .all(childId) as Array<{
      id: string;
      activity_id: string;
      plan_date: string;
      status: CompletionStatus;
      caregiver_notes: string | null;
      completed_at: string;
      age_group_id_snapshot: string;
      age_group_label_snapshot: string;
      activity_title: string;
      duration_minutes: number;
      prep_level: ActivityPrepLevel | null;
      domain_name: string;
      domain_slug: string;
    }>;

    return rows.map((r) => {
      const latestSubmission = this.findLatestSubmissionForChildActivity(childId, r.activity_id);
      const displayStatus = this.resolveEffectiveDisplayStatus(r.status, latestSubmission);
      return {
        completionId: r.id,
        activityId: r.activity_id,
        activityTitle: r.activity_title,
        domainName: r.domain_name,
        domainSlug: r.domain_slug,
        durationMinutes: r.duration_minutes,
        prepLevel: r.prep_level || 'quick_setup',
        planDate: r.plan_date,
        completedAt: r.completed_at,
        caregiverNotes: r.caregiver_notes,
        ageGroupIdSnapshot: r.age_group_id_snapshot,
        ageGroupLabelSnapshot: r.age_group_label_snapshot,
        displayStatus,
        reviewScorePct: latestSubmission?.review?.instructionMatchScorePct ?? null,
      };
    });
  }

  getWeeklyProgressForChild(childId: string) {
    const today = new Date();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const days: Array<{ date: string; dayLabel: string; completedCount: number; isToday: boolean }> = [];

    for (let offset = 6; offset >= 0; offset -= 1) {
      const d = new Date(today);
      d.setDate(today.getDate() - offset);
      const iso = d.toISOString().slice(0, 10);
      const row = this.db
        .prepare(
          `SELECT COUNT(*) as cnt
           FROM activity_completions
           WHERE child_id = ?
             AND plan_date = ?
             AND status IN ('completed', 'submitted_for_review', 'reviewed')`
        )
        .get(childId, iso) as { cnt: number };

      days.push({
        date: iso,
        dayLabel: dayNames[d.getDay()],
        completedCount: row.cnt,
        isToday: offset === 0,
      });
    }
    return days;
  }

  getParentProgressOverview(
    childId: string,
    filters?: {
      dateFrom?: string;
      dateTo?: string;
      domainId?: string;
      completionStatus?: JourneyDisplayStatus | 'all';
      reviewStatus?: ActivityHistoryReviewFilter;
    }
  ): ParentProgressOverviewResponse | null {
    const childRow = this.db
      .prepare(
        `SELECT c.*, ag.slug as age_group_slug, ag.label as age_group_label
         FROM children c
         JOIN age_groups ag ON ag.id = c.active_age_group_id
         WHERE c.id = ?`
      )
      .get(childId) as
      | {
          id: string;
          parent_user_id: string;
          display_name: string;
          date_of_birth: string;
          profile_photo_url: string | null;
          activity_preferences: string | null;
          active_age_group_id: string;
          age_group_slug: string;
          age_group_label: string;
          created_at: string;
        }
      | undefined;

    if (!childRow) return null;

    const child: ChildProfile = {
      id: childRow.id,
      parentUserId: childRow.parent_user_id,
      displayName: childRow.display_name,
      dateOfBirth: childRow.date_of_birth,
      profilePhotoUrl: childRow.profile_photo_url ?? null,
      activityPreferences: childRow.activity_preferences ?? null,
      activeAgeGroupId: childRow.active_age_group_id,
      ageGroupSlug: childRow.age_group_slug,
      ageGroupLabel: childRow.age_group_label,
      ageInMonths: calculateAgeInMonths(childRow.date_of_birth),
      createdAt: childRow.created_at,
    };

    const stageStats = this.db
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM activities WHERE age_group_id = ? AND status = 'published') as total_stage,
           (SELECT COUNT(DISTINCT ac.activity_id)
            FROM activity_completions ac
            JOIN activities a ON a.id = ac.activity_id
            WHERE ac.child_id = ?
              AND a.age_group_id = ?
              AND a.status = 'published'
              AND ac.status IN ('completed', 'submitted_for_review', 'reviewed')) as completed_stage,
           (SELECT COUNT(*)
            FROM activity_completions
            WHERE child_id = ?
              AND status IN ('completed', 'submitted_for_review', 'reviewed')) as total_completions`
      )
      .get(child.activeAgeGroupId, child.id, child.activeAgeGroupId, child.id) as {
      total_stage: number;
      completed_stage: number;
      total_completions: number;
    };

    const weeklyDailyBars = this.getWeeklyProgressForChild(child.id);
    const activeDaysThisWeek = weeklyDailyBars.filter((d) => d.completedCount > 0).length;
    const weeklyConsistencyPct = Math.round((activeDaysThisWeek / 7) * 100);

    // Build 4-week calm rhythm buckets (ending today)
    const today = new Date();
    const weekLabels = ['3 weeks ago', '2 weeks ago', 'Last week', 'This week'];
    const weeklyConsistencyTrend: WeeklyConsistencyBucket[] = [];
    for (let w = 3; w >= 0; w -= 1) {
      const end = new Date(today);
      end.setDate(today.getDate() - w * 7);
      const start = new Date(end);
      start.setDate(end.getDate() - 6);
      const startIso = start.toISOString().slice(0, 10);
      const endIso = end.toISOString().slice(0, 10);

      const bucket = this.db
        .prepare(
          `SELECT COUNT(DISTINCT plan_date) as active_days, COUNT(*) as completed_count
           FROM activity_completions
           WHERE child_id = ?
             AND plan_date >= ?
             AND plan_date <= ?
             AND status IN ('completed', 'submitted_for_review', 'reviewed')`
        )
        .get(child.id, startIso, endIso) as { active_days: number; completed_count: number };

      weeklyConsistencyTrend.push({
        weekLabel: weekLabels[3 - w],
        startDate: startIso,
        endDate: endIso,
        activeDays: bucket.active_days ?? 0,
        completedCount: bucket.completed_count ?? 0,
      });
    }

    const domainProgress = this.getDomainProgressForChild(child.id, child.activeAgeGroupId);
    const reviewHistory = this.listSubmissionsForChild(child.id);

    const submittedVideosCount = reviewHistory.filter((s) => s.reviewStatus !== 'deleted').length;
    const reviewedActivitiesCount = reviewHistory.filter((s) => Boolean(s.review)).length;
    const pendingReviewsCount = reviewHistory.filter(
      (s) =>
        !s.review &&
        (s.reviewStatus === 'queued' ||
          s.reviewStatus === 'in_review' ||
          s.reviewStatus === 'resubmit_requested')
    ).length;

    // Fetch activity history (all statuses including started / in_progress, with SQL filtering where possible)
    const conditions: string[] = ['ac.child_id = ?'];
    const params: unknown[] = [child.id];

    if (filters?.dateFrom) {
      conditions.push('ac.plan_date >= ?');
      params.push(filters.dateFrom);
    }
    if (filters?.dateTo) {
      conditions.push('ac.plan_date <= ?');
      params.push(filters.dateTo);
    }
    if (filters?.domainId && filters.domainId !== 'all') {
      conditions.push('a.domain_id = ?');
      params.push(filters.domainId);
    }

    const completionRows = this.db
      .prepare(
        `SELECT ac.id, ac.activity_id, ac.plan_date, ac.status, ac.caregiver_notes,
                COALESCE(ac.completed_at, ac.last_opened_at, ac.created_at) as activity_date,
                COALESCE(ac.age_group_id_snapshot, a.age_group_id) as age_group_id_snapshot,
                COALESCE(ac.age_group_label_snapshot, ag.label) as age_group_label_snapshot,
                a.title as activity_title, a.summary as activity_summary,
                a.duration_minutes, a.prep_level,
                ld.id as domain_id, ld.slug as domain_slug, ld.name as domain_name
         FROM activity_completions ac
         JOIN activities a ON a.id = ac.activity_id
         JOIN age_groups ag ON ag.id = a.age_group_id
         JOIN learning_domains ld ON ld.id = a.domain_id
         WHERE ${conditions.join(' AND ')}
         ORDER BY COALESCE(ac.completed_at, ac.last_opened_at, ac.created_at) DESC
         LIMIT 150`
      )
      .all(...params) as Array<{
      id: string;
      activity_id: string;
      plan_date: string;
      status: CompletionStatus;
      caregiver_notes: string | null;
      activity_date: string;
      age_group_id_snapshot: string;
      age_group_label_snapshot: string;
      activity_title: string;
      activity_summary: string;
      duration_minutes: number;
      prep_level: ActivityPrepLevel | null;
      domain_id: string;
      domain_slug: string;
      domain_name: string;
    }>;

    // Index latest submission per activity for O(1) join
    const latestSubByActivity = new Map<string, VideoSubmissionSummary>();
    for (const sub of reviewHistory) {
      if (!latestSubByActivity.has(sub.activityId)) {
        latestSubByActivity.set(sub.activityId, sub);
      }
    }

    let activityHistory: ActivityHistoryRecord[] = completionRows.map((r) => {
      const submission = latestSubByActivity.get(r.activity_id) ?? null;
      const displayStatus = this.resolveEffectiveDisplayStatus(r.status, submission);
      return {
        completionId: r.id,
        activityId: r.activity_id,
        activityTitle: r.activity_title,
        activitySummary: r.activity_summary,
        domainId: r.domain_id,
        domainSlug: r.domain_slug,
        domainName: r.domain_name,
        ageGroupIdSnapshot: r.age_group_id_snapshot,
        ageGroupLabelSnapshot: r.age_group_label_snapshot,
        durationMinutes: r.duration_minutes,
        prepLevel: r.prep_level || 'quick_setup',
        planDate: r.plan_date,
        activityDate: r.activity_date,
        completionStatus: r.status,
        displayStatus,
        caregiverNotes: r.caregiver_notes,
        submission,
      };
    });

    if (filters?.completionStatus && filters.completionStatus !== 'all') {
      activityHistory = activityHistory.filter(
        (item) => item.displayStatus === filters.completionStatus
      );
    }

    if (filters?.reviewStatus && filters.reviewStatus !== 'all') {
      activityHistory = activityHistory.filter((item) => {
        if (filters.reviewStatus === 'none') {
          return !item.submission || item.submission.reviewStatus === 'deleted';
        }
        if (filters.reviewStatus === 'reviewed') {
          return Boolean(item.submission?.review);
        }
        return item.submission?.reviewStatus === filters.reviewStatus && !item.submission?.review;
      });
    }

    const totalStageActivities = stageStats.total_stage ?? 0;
    const activitiesCompletedStage = stageStats.completed_stage ?? 0;

    return {
      child,
      summary: {
        activitiesCompletedStage,
        activitiesRemainingStage: Math.max(0, totalStageActivities - activitiesCompletedStage),
        totalStageActivities,
        totalCompletionsAllTime: stageStats.total_completions ?? 0,
        activeDaysThisWeek,
        weeklyConsistencyPct,
        submittedVideosCount,
        reviewedActivitiesCount,
        pendingReviewsCount,
      },
      weeklyDailyBars,
      weeklyConsistencyTrend,
      domainProgress,
      activityHistory,
      reviewHistory,
    };
  }

  getLastOpenedActivityForChild(childId: string) {
    const row = this.db
      .prepare(
        `SELECT activity_id, status, COALESCE(last_opened_at, completed_at, created_at) as touched_at
         FROM activity_completions
         WHERE child_id = ?
         ORDER BY COALESCE(last_opened_at, completed_at, created_at) DESC
         LIMIT 1`
      )
      .get(childId) as
      | { activity_id: string; status: CompletionStatus; touched_at: string }
      | undefined;

    if (!row) return null;
    const activity = this.getActivityDetail(row.activity_id);
    if (!activity || activity.status !== 'published') return null;
    const latestSubmission = this.findLatestSubmissionForChildActivity(childId, row.activity_id);
    return {
      activity,
      status: row.status,
      displayStatus: this.resolveEffectiveDisplayStatus(row.status, latestSubmission),
      updatedAt: row.touched_at,
    };
  }

  private getParentingTipForAgeGroup(ageGroupSlug: string) {
    const tips: Record<string, { title: string; body: string; focusArea: string }> = {
      '0-3m': {
        title: 'Slow down and pause for five quiet seconds',
        body: 'Newborns take a few extra moments to process faces and voices. After smiling or speaking softly, wait calmly so your baby has space to respond in their own rhythm.',
        focusArea: 'Social & emotional bonding',
      },
      '3-6m': {
        title: 'Get down to your baby’s eye level on the mat',
        body: 'Resting on the floor beside your baby during tummy time makes exploration feel safe and reassuring—two calm minutes is worth more than a rushed long session.',
        focusArea: 'Physical comfort',
      },
      '6-9m': {
        title: 'Offer fewer objects for deeper calm focus',
        body: 'Placing just two or three safe household textures on a clean mat invites unhurried curiosity. When your hands stay quiet in your lap, your baby practices choosing freely.',
        focusArea: 'Sensory & focus',
      },
      '9-12m': {
        title: 'Narrate transitions before they happen',
        body: 'Before picking your baby up or stepping across the room, say softly what happens next. Predictable everyday language builds deep trust and early vocabulary together.',
        focusArea: 'Language & trust',
      },
      '12-15m': {
        title: 'Let small attempts finish without stepping in',
        body: 'When your toddler tries stacking a ring or holding an open cup, pausing before helping lets them experience the quiet satisfaction of adjusting and trying again.',
        focusArea: 'Early independence',
      },
      '15-18m': {
        title: 'Turn everyday moments into shared participation',
        body: 'Handing your child a small folded cotton cloth to wipe a few water drops turns ordinary home routines into joyful, purposeful practice.',
        focusArea: 'Everyday skills',
      },
      '18-21m': {
        title: 'Describe what you notice instead of quizzing',
        body: 'Saying “You put the smooth wooden spoons in the bowl” encourages concentration far more calmly than asking repeated test questions.',
        focusArea: 'Cognitive curiosity',
      },
      '21-24m': {
        title: 'Name everyday feelings with a calm voice',
        body: 'Putting simple words to happy, sleepy, or frustrated moments helps toddlers gradually recognize what they feel while knowing you are steady beside them.',
        focusArea: 'Emotional awareness',
      },
    };
    const chosen = tips[ageGroupSlug] ?? tips['6-9m'];
    return {
      id: `tip_${ageGroupSlug}`,
      ageGroupSlug,
      ...chosen,
    };
  }

  private getReadNotificationIds(userId: string): Set<string> {
    const rows = this.db
      .prepare('SELECT notification_id FROM notification_reads WHERE user_id = ?')
      .all(userId) as Array<{ notification_id: string }>;
    return new Set(rows.map((r) => r.notification_id));
  }

  private buildParentNotifications(
    parent: UserProfile | null,
    child: ChildProfile,
    submissions: VideoSubmissionSummary[],
    todayItems: JourneyActivityItem[]
  ): ParentNotificationItem[] {
    const readIds = parent ? this.getReadNotificationIds(parent.id) : new Set<string>();
    const notifications: ParentNotificationItem[] = [];

    if (parent && !parent.emailVerifiedAt) {
      const id = 'notif_verify_email';
      notifications.push({
        id,
        kind: 'email_verify',
        title: 'Confirm your email address',
        description: `Verify ${parent.email} so you can recover your account safely anytime.`,
        createdAt: parent.createdAt,
        isRead: readIds.has(id),
        actionLabel: 'Verify Email',
        targetSection: 'verify-email',
      });
    }

    submissions.slice(0, 6).forEach((sub) => {
      if (sub.review) {
        const id = `notif_rev_${sub.id}_v${sub.review.version}`;
        const scoreSummary =
          sub.review.isAssessable && sub.review.instructionMatchScorePct !== null
            ? `Instruction-match ${sub.review.instructionMatchScorePct}% · Includes positive observations and gentle tips from ${sub.review.reviewerName}.`
            : `Marked Not Assessable · ${sub.review.reviewerName} left a clear explanation and gentle guidance.`;
        notifications.push({
          id,
          kind: 'review_ready',
          title: `Caregiver feedback ready for ${sub.activityTitle}`,
          description: scoreSummary,
          createdAt: sub.review.submittedAt,
          isRead: readIds.has(id),
          actionLabel: 'View Feedback',
          targetSection: 'progress',
          activityId: sub.activityId,
        });
      } else if (sub.reviewStatus === 'resubmit_requested') {
        const id = `notif_resub_${sub.id}`;
        notifications.push({
          id,
          kind: 'changes_requested',
          title: `Updated clip requested for ${sub.activityTitle}`,
          description:
            sub.changeRequestNote ||
            'Your reviewer shared gentle recording guidance so they can give clearer feedback.',
          createdAt: sub.createdAt,
          isRead: readIds.has(id),
          actionLabel: 'Open Activity',
          targetSection: 'today',
          activityId: sub.activityId,
        });
      } else if (sub.reviewStatus === 'queued' || sub.reviewStatus === 'in_review') {
        const id = `notif_q_${sub.id}`;
        notifications.push({
          id,
          kind: 'submission_queued',
          title: `Practice clip received for ${sub.activityTitle}`,
          description:
            sub.reviewStatus === 'in_review'
              ? 'A caregiver coach is reviewing your clip privately.'
              : 'Stored privately in your vault and queued for coaching feedback.',
          createdAt: sub.createdAt,
          isRead: readIds.has(id),
          actionLabel: 'Check Status',
          targetSection: 'progress',
          activityId: sub.activityId,
        });
      }
    });

    const remaining = todayItems.filter(
      (i) => i.displayStatus === 'not_started' || i.displayStatus === 'in_progress'
    ).length;

    if (remaining > 0) {
      const todayKey = getCalendarDateIso();
      const id = `notif_today_${child.id}_${todayKey}`;
      notifications.push({
        id,
        kind: 'daily_rhythm',
        title: `${remaining} gentle ${remaining === 1 ? 'activity' : 'activities'} ready for ${child.displayName}`,
        description: `Matched to the ${child.ageGroupLabel} stage whenever your little one is rested and alert.`,
        createdAt: new Date().toISOString(),
        isRead: readIds.has(id),
        actionLabel: 'View Today',
        targetSection: 'today',
      });
    }

    return notifications;
  }

  listParentNotifications(parentUserId: string, childId?: string): ParentNotificationItem[] {
    const children = this.listChildrenByParent(parentUserId);
    const targetChild = childId ? children.find((c) => c.id === childId) : children[0];
    if (!targetChild) {
      const parent = this.findUserById(parentUserId);
      const readIds = this.getReadNotificationIds(parentUserId);
      if (parent && !parent.emailVerifiedAt) {
        const id = 'notif_verify_email';
        return [
          {
            id,
            kind: 'email_verify',
            title: 'Confirm your email address',
            description: `Verify ${parent.email} so you can recover your account safely anytime.`,
            createdAt: parent.createdAt,
            isRead: readIds.has(id),
            actionLabel: 'Verify Email',
            targetSection: 'verify-email',
          },
        ];
      }
      return [];
    }
    const journey = this.getJourneyForChild(targetChild);
    return journey?.notifications ?? [];
  }

  markParentNotificationRead(parentUserId: string, notificationId: string): boolean {
    const ownedNotifications = this.listParentNotifications(parentUserId);
    const existsForParent = ownedNotifications.some((n) => n.id === notificationId);
    if (!existsForParent) {
      // Also check across all children of this parent
      const children = this.listChildrenByParent(parentUserId);
      const foundInAnyChild = children.some((c) =>
        this.listParentNotifications(parentUserId, c.id).some((n) => n.id === notificationId)
      );
      if (!foundInAnyChild) {
        return false;
      }
    }
    this.db
      .prepare(
        `INSERT OR IGNORE INTO notification_reads (user_id, notification_id, read_at)
         VALUES (?, ?, ?)`
      )
      .run(parentUserId, notificationId, new Date().toISOString());
    return true;
  }

  markAllParentNotificationsRead(parentUserId: string, childId?: string): number {
    const notifications = this.listParentNotifications(parentUserId, childId);
    const nowIso = new Date().toISOString();
    const stmt = this.db.prepare(
      `INSERT OR IGNORE INTO notification_reads (user_id, notification_id, read_at)
       VALUES (?, ?, ?)`
    );
    const tx = this.db.transaction(() => {
      let count = 0;
      for (const item of notifications) {
        const res = stmt.run(parentUserId, item.id, nowIso);
        count += res.changes;
      }
      return count;
    });
    return tx();
  }

  hasRecentPendingSubmission(
    childId: string,
    activityId: string,
    windowSeconds = 45
  ): boolean {
    const cutoffIso = new Date(Date.now() - windowSeconds * 1000).toISOString();
    const row = this.db
      .prepare(
        `SELECT id FROM video_submissions
         WHERE child_id = ? AND activity_id = ?
           AND review_status IN ('queued', 'in_review')
           AND deleted_at IS NULL
           AND created_at >= ?
         LIMIT 1`
      )
      .get(childId, activityId, cutoffIso);
    return Boolean(row);
  }

  getDomainProgressForChild(childId: string, ageGroupId?: string): DomainProgressStat[] {
    const rows = this.db
      .prepare(
        `SELECT ld.id, ld.slug, ld.name,
                COUNT(DISTINCT ac.id) as completed_count,
                (
                  SELECT COUNT(*)
                  FROM activities a2
                  WHERE a2.domain_id = ld.id
                    AND a2.status = 'published'
                    AND (? IS NULL OR a2.age_group_id = ?)
                ) as stage_available_count,
                (
                  SELECT COUNT(*)
                  FROM activities a3
                  WHERE a3.domain_id = ld.id
                    AND a3.status = 'published'
                ) as total_available_count
         FROM learning_domains ld
         LEFT JOIN activities a ON a.domain_id = ld.id
         LEFT JOIN activity_completions ac
           ON ac.activity_id = a.id
           AND ac.child_id = ?
           AND ac.status IN ('completed', 'submitted_for_review', 'reviewed')
         GROUP BY ld.id
         ORDER BY ld.sort_order ASC`
      )
      .all(ageGroupId ?? null, ageGroupId ?? null, childId) as Array<{
      id: string;
      slug: string;
      name: string;
      completed_count: number;
      stage_available_count: number;
      total_available_count: number;
    }>;

    return rows.map((r) => ({
      domainId: r.id,
      domainSlug: r.slug,
      domainName: r.name,
      completedCount: r.completed_count,
      availableCount: Math.max(1, r.stage_available_count || r.total_available_count || 1),
    }));
  }

  upsertActivityCompletion(params: {
    childId: string;
    activityId: string;
    status: CompletionStatus;
    caregiverNotes?: string | null;
  }): { id: string; status: CompletionStatus } {
    // Business rule: a completion must NEVER be marked 'reviewed' unless a real submission review exists
    let safeRequestedStatus: CompletionStatus = params.status;
    if (safeRequestedStatus === 'reviewed') {
      const latestSub = this.findLatestSubmissionForChildActivity(params.childId, params.activityId);
      if (!latestSub?.review) {
        safeRequestedStatus = 'completed';
      }
    }

    const planDate = getCalendarDateIso();
    const existing = this.db
      .prepare(
        'SELECT id, status FROM activity_completions WHERE child_id = ? AND activity_id = ? AND plan_date = ?'
      )
      .get(params.childId, params.activityId, planDate) as
      | { id: string; status: CompletionStatus }
      | undefined;

    if (existing) {
      // Never downgrade an already completed/submitted/reviewed activity back to 'started'
      const nextStatus: CompletionStatus =
        safeRequestedStatus === 'started' && existing.status !== 'started'
          ? existing.status
          : safeRequestedStatus;

      this.db
        .prepare(
          `UPDATE activity_completions
           SET status = ?,
               caregiver_notes = COALESCE(?, caregiver_notes),
               last_opened_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
               completed_at = CASE WHEN ? IN ('completed', 'submitted_for_review', 'reviewed')
                                   THEN COALESCE(completed_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
                                   ELSE completed_at END
           WHERE id = ?`
        )
        .run(nextStatus, params.caregiverNotes ?? null, nextStatus, existing.id);
      return { id: existing.id, status: nextStatus };
    }

    // Snapshot the activity's age group so later baby DOB changes never silently rewrite historical records
    const activity = this.getActivityDetail(params.activityId);
    const id = `comp_${crypto.randomUUID().slice(0, 10)}`;
    this.db
      .prepare(
        `INSERT INTO activity_completions (
           id, child_id, activity_id, plan_date, status, caregiver_notes,
           age_group_id_snapshot, age_group_label_snapshot,
           last_opened_at, completed_at
         )
         VALUES (
           ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
           CASE WHEN ? IN ('completed', 'submitted_for_review', 'reviewed')
                THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now') ELSE NULL END
         )`
      )
      .run(
        id,
        params.childId,
        params.activityId,
        planDate,
        safeRequestedStatus,
        params.caregiverNotes?.trim() || null,
        activity?.ageGroupId ?? null,
        activity?.ageGroupLabel ?? null,
        safeRequestedStatus
      );
    return { id, status: safeRequestedStatus };
  }

  // ======================== VIDEO SUBMISSIONS & REVIEWS ========================

  private formatParentReference(parentUserId: string): string {
    const cleaned = parentUserId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return `PAR-${cleaned.slice(-6).padStart(6, '0')}`;
  }

  private computeQueuePriority(
    status: SubmissionReviewStatus,
    createdAt: string,
    expiresAt: string
  ): QueuePriority {
    if (status === 'reviewed' || status === 'deleted' || status === 'resubmit_requested') {
      return 'low';
    }
    const nowMs = Date.now();
    const ageHours = (nowMs - new Date(createdAt).getTime()) / (1000 * 60 * 60);
    const daysToExpiry = (new Date(expiresAt).getTime() - nowMs) / (1000 * 60 * 60 * 24);
    if (ageHours >= 24 || daysToExpiry <= 5) {
      return 'high';
    }
    return 'normal';
  }

  private appendReviewAuditHistory(params: {
    submissionId: string;
    reviewId: string | null;
    actorUserId: string;
    actorRole?: string;
    action: ReviewAuditAction;
    version: number;
    isAssessable: boolean;
    scorePct: number | null;
    summaryNote: string | null;
    snapshot: Record<string, unknown>;
  }): void {
    this.db
      .prepare(
        `INSERT INTO review_audit_history (
           id, submission_id, review_id, actor_user_id, actor_role, action, version,
           score_pct, is_assessable, summary_note, snapshot_json
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        `rh_${crypto.randomUUID().slice(0, 12)}`,
        params.submissionId,
        params.reviewId,
        params.actorUserId,
        params.actorRole ?? 'reviewer',
        params.action,
        params.version,
        params.scorePct,
        params.isAssessable ? 1 : 0,
        params.summaryNote ?? '',
        JSON.stringify(params.snapshot)
      );
  }

  listReviewHistory(submissionId: string): ReviewHistoryEntry[] {
    const rows = this.db
      .prepare(
        `SELECT rah.*, u.full_name as actor_name
         FROM review_audit_history rah
         JOIN users u ON u.id = rah.actor_user_id
         WHERE rah.submission_id = ?
         ORDER BY rah.created_at DESC`
      )
      .all(submissionId) as Array<{
      id: string;
      submission_id: string;
      review_id: string | null;
      actor_user_id: string;
      actor_name: string;
      actor_role: string;
      action: ReviewAuditAction;
      version: number;
      score_pct: number | null;
      is_assessable: number;
      summary_note: string;
      created_at: string;
    }>;

    return rows.map((r) => ({
      id: r.id,
      submissionId: r.submission_id,
      reviewId: r.review_id,
      actorUserId: r.actor_user_id,
      actorName: r.actor_name,
      actorRole: r.actor_role,
      action: r.action,
      version: r.version,
      scorePct: r.score_pct,
      isAssessable: r.is_assessable === 1,
      summaryNote: r.summary_note ?? '',
      createdAt: r.created_at,
    }));
  }

  getReviewDetailForSubmission(
    submissionId: string,
    includeDraft = false
  ): SubmissionReviewDetail | null {
    const statusClause = includeDraft ? '' : "AND sr.review_status = 'published'";
    const rev = this.db
      .prepare(
        `SELECT sr.*, u.full_name as reviewer_name
         FROM submission_reviews sr
         JOIN users u ON u.id = sr.reviewer_user_id
         WHERE sr.submission_id = ? ${statusClause}`
      )
      .get(submissionId) as
      | {
          id: string;
          submission_id: string;
          reviewer_user_id: string;
          reviewer_name: string;
          review_status: ReviewPublicationStatus;
          version: number;
          is_assessable: number;
          not_assessable_reason: string | null;
          instruction_match_score_pct: number | null;
          strengths_note: string;
          coaching_tip: string;
          reviewer_comments: string | null;
          evaluation_scope_acknowledged_at: string;
          submitted_at: string;
        }
      | undefined;

    if (!rev) return null;

    const scoreRows = this.db
      .prepare(
        `SELECT rrs.*, arc.label as criterion_label, arc.description as criterion_description
         FROM review_rubric_scores rrs
         JOIN activity_rubric_criteria arc ON arc.id = rrs.rubric_criterion_id
         WHERE rrs.review_id = ?
         ORDER BY arc.criterion_order ASC`
      )
      .all(rev.id) as Array<{
      id: string;
      rubric_criterion_id: string;
      criterion_label: string;
      criterion_description: string;
      achieved_level: RubricAchievementLevel;
      earned_points: number;
      max_points: number;
      explanation: string | null;
    }>;

    let applicableWeightPoints = 0;
    let earnedWeightPoints = 0;
    for (const row of scoreRows) {
      if (row.achieved_level !== 'not_assessable') {
        applicableWeightPoints += row.max_points;
        earnedWeightPoints += row.earned_points;
      }
    }

    return {
      id: rev.id,
      submissionId: rev.submission_id,
      reviewerUserId: rev.reviewer_user_id,
      reviewerName: rev.reviewer_name,
      reviewStatus: rev.review_status ?? 'published',
      version: rev.version ?? 1,
      isAssessable: (rev.is_assessable ?? 1) === 1,
      notAssessableReason: rev.not_assessable_reason ?? null,
      instructionMatchScorePct: rev.instruction_match_score_pct ?? null,
      applicableWeightPoints,
      earnedWeightPoints,
      strengthsNote: rev.strengths_note,
      coachingTip: rev.coaching_tip,
      reviewerComments: rev.reviewer_comments ?? null,
      evaluationScopeAcknowledgedAt: rev.evaluation_scope_acknowledged_at,
      submittedAt: rev.submitted_at,
      rubricScores: scoreRows.map((s) => ({
        id: s.id,
        criterionId: s.rubric_criterion_id,
        criterionLabel: s.criterion_label,
        criterionDescription: s.criterion_description,
        achievedLevel: s.achieved_level,
        earnedPoints: s.earned_points,
        maxPoints: s.max_points,
        explanation: s.explanation ?? null,
      })),
    };
  }

  private mapSubmissionRow(row: {
    id: string;
    completion_id: string;
    parent_user_id: string;
    child_id: string;
    activity_id: string;
    activity_version?: number | null;
    activity_title: string;
    domain_name: string;
    age_group_label: string;
    storage_key: string | null;
    storage_provider?: string | null;
    consent_record_id?: string | null;
    consent_granted_at?: string | null;
    change_request_note?: string | null;
    mime_type: string;
    file_size_bytes: number;
    duration_seconds: number;
    review_status: SubmissionReviewStatus;
    expires_at: string;
    deleted_at: string | null;
    deletion_reason: string | null;
    caregiver_notes: string | null;
    created_at: string;
  }): VideoSubmissionSummary {
    const storageMode: VideoStorageMode =
      row.storage_provider === 'production_object_storage'
        ? 'production_object_storage'
        : 'demo_local_vault';
    const hasActiveVideo = Boolean(row.storage_key && !row.deleted_at);
    return {
      id: row.id,
      completionId: row.completion_id,
      parentUserId: row.parent_user_id,
      childId: row.child_id,
      activityId: row.activity_id,
      activityVersion: row.activity_version ?? 1,
      activityTitle: row.activity_title,
      domainName: row.domain_name,
      ageGroupLabel: row.age_group_label,
      mimeType: row.mime_type,
      fileSizeBytes: row.file_size_bytes,
      durationSeconds: row.duration_seconds,
      reviewStatus: row.review_status,
      hasActiveVideo,
      storageReference: hasActiveVideo
        ? `${storageMode === 'production_object_storage' ? 'cloud-vault' : 'demo-vault'}://${row.id}`
        : null,
      storageMode,
      consentRecordId: row.consent_record_id ?? null,
      consentGrantedAt: row.consent_granted_at ?? null,
      changeRequestNote: row.change_request_note ?? null,
      expiresAt: row.expires_at,
      deletedAt: row.deleted_at,
      deletionReason: row.deletion_reason,
      caregiverNotes: row.caregiver_notes,
      createdAt: row.created_at,
      review: this.getReviewDetailForSubmission(row.id),
    };
  }

  findLatestSubmissionForChildActivity(
    childId: string,
    activityId: string
  ): VideoSubmissionSummary | null {
    const row = this.db
      .prepare(
        `SELECT vs.*, a.title as activity_title, ld.name as domain_name, ag.label as age_group_label,
                uc.granted_at as consent_granted_at
         FROM video_submissions vs
         JOIN activities a ON a.id = vs.activity_id
         JOIN learning_domains ld ON ld.id = a.domain_id
         JOIN age_groups ag ON ag.id = a.age_group_id
         LEFT JOIN user_consents uc ON uc.id = vs.consent_record_id
         WHERE vs.child_id = ? AND vs.activity_id = ?
         ORDER BY vs.created_at DESC LIMIT 1`
      )
      .get(childId, activityId) as Parameters<LittleStepsRepository['mapSubmissionRow']>[0] | undefined;
    return row ? this.mapSubmissionRow(row) : null;
  }

  listSubmissionsForChild(childId: string): VideoSubmissionSummary[] {
    const rows = this.db
      .prepare(
        `SELECT vs.*, a.title as activity_title, ld.name as domain_name, ag.label as age_group_label,
                uc.granted_at as consent_granted_at
         FROM video_submissions vs
         JOIN activities a ON a.id = vs.activity_id
         JOIN learning_domains ld ON ld.id = a.domain_id
         JOIN age_groups ag ON ag.id = a.age_group_id
         LEFT JOIN user_consents uc ON uc.id = vs.consent_record_id
         WHERE vs.child_id = ?
         ORDER BY vs.created_at DESC`
      )
      .all(childId) as Array<Parameters<LittleStepsRepository['mapSubmissionRow']>[0]>;
    return rows.map((r) => this.mapSubmissionRow(r));
  }

  findSubmissionRawById(submissionId: string): {
    id: string;
    completion_id: string;
    parent_user_id: string;
    child_id: string;
    activity_id: string;
    activity_version: number;
    storage_key: string | null;
    storage_provider: string;
    consent_record_id: string | null;
    change_request_note: string | null;
    mime_type: string;
    file_size_bytes: number;
    duration_seconds: number;
    review_status: SubmissionReviewStatus;
    assigned_reviewer_id: string | null;
    caregiver_notes: string | null;
    expires_at: string;
    deleted_at: string | null;
    deletion_reason: string | null;
    created_at: string;
  } | null {
    const row = this.db
      .prepare('SELECT * FROM video_submissions WHERE id = ?')
      .get(submissionId) as ReturnType<LittleStepsRepository['findSubmissionRawById']>;
    return row ?? null;
  }

  createVideoSubmission(params: {
    completionId: string;
    parentUserId: string;
    childId: string;
    activityId: string;
    activityVersion: number;
    storageKey: string;
    storageProvider: VideoStorageMode;
    consentRecordId: string;
    mimeType: string;
    fileSizeBytes: number;
    durationSeconds: number;
    caregiverNotes: string | null;
    expiresAt: string;
  }): VideoSubmissionSummary {
    const id = `sub_${crypto.randomUUID().slice(0, 12)}`;
    this.db
      .prepare(
        `INSERT INTO video_submissions (
           id, completion_id, parent_user_id, child_id, activity_id, activity_version,
           storage_key, storage_provider, consent_record_id,
           mime_type, file_size_bytes, duration_seconds,
           review_status, caregiver_notes, expires_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?)`
      )
      .run(
        id,
        params.completionId,
        params.parentUserId,
        params.childId,
        params.activityId,
        params.activityVersion,
        params.storageKey,
        params.storageProvider,
        params.consentRecordId,
        params.mimeType,
        params.fileSizeBytes,
        params.durationSeconds,
        params.caregiverNotes?.trim() || null,
        params.expiresAt
      );
    this.logMediaAudit(params.parentUserId, 'parent', id, 'upload');
    return this.findLatestSubmissionForChildActivity(params.childId, params.activityId)!;
  }

  requestSubmissionChanges(
    submissionId: string,
    reviewerUserId: string,
    note: string
  ): boolean {
    const raw = this.findSubmissionRawById(submissionId);
    if (!raw || raw.deleted_at || raw.review_status === 'reviewed') {
      return false;
    }
    if (raw.assigned_reviewer_id && raw.assigned_reviewer_id !== reviewerUserId) {
      return false;
    }
    const trimmedNote = note.trim();
    const res = this.db
      .prepare(
        `UPDATE video_submissions
         SET review_status = 'resubmit_requested',
             assigned_reviewer_id = ?,
             change_request_note = ?
         WHERE id = ?`
      )
      .run(reviewerUserId, trimmedNote, submissionId);
    if (res.changes > 0) {
      this.appendReviewAuditHistory({
        submissionId,
        reviewId: null,
        actorUserId: reviewerUserId,
        actorRole: 'reviewer',
        action: 'changes_requested',
        version: 1,
        isAssessable: false,
        scorePct: null,
        summaryNote: trimmedNote,
        snapshot: { changeRequestNote: trimmedNote },
      });
    }
    return res.changes > 0;
  }

  markSubmissionVideoDeleted(
    submissionId: string,
    deletionReason: 'parent_deleted' | 'admin_deleted' | 'retention_30d'
  ): void {
    this.db
      .prepare(
        `UPDATE video_submissions
         SET storage_key = NULL,
             deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
             deletion_reason = ?,
             review_status = CASE WHEN review_status = 'reviewed' THEN 'reviewed' ELSE 'deleted' END
         WHERE id = ?`
      )
      .run(deletionReason, submissionId);
  }

  listExpiredActiveSubmissions(): Array<{ id: string; storage_key: string }> {
    return this.db
      .prepare(
        `SELECT id, storage_key
         FROM video_submissions
         WHERE storage_key IS NOT NULL
           AND deleted_at IS NULL
           AND expires_at <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`
      )
      .all() as Array<{ id: string; storage_key: string }>;
  }

  // ======================== REVIEWER QUEUE & EVALUATION ========================

  private mapReviewerQueueRow(r: {
    submission_id: string;
    parent_user_id: string;
    activity_id: string;
    activity_version: number | null;
    activity_title: string;
    domain_name: string;
    age_group_slug: string;
    age_group_label: string;
    review_status: SubmissionReviewStatus;
    assigned_reviewer_id: string | null;
    assigned_reviewer_name: string | null;
    storage_key: string | null;
    deleted_at: string | null;
    duration_seconds: number;
    expires_at: string;
    created_at: string;
    sr_review_status: ReviewPublicationStatus | null;
    is_assessable: number | null;
    instruction_match_score_pct: number | null;
  }): ReviewerQueueItem {
    const isPublished = r.sr_review_status === 'published';
    return {
      submissionId: r.submission_id,
      parentReference: this.formatParentReference(r.parent_user_id),
      activityId: r.activity_id,
      activityVersion: r.activity_version ?? 1,
      activityTitle: r.activity_title,
      domainName: r.domain_name,
      ageGroupSlug: r.age_group_slug,
      ageGroupLabel: r.age_group_label,
      reviewStatus: r.review_status,
      priority: this.computeQueuePriority(r.review_status, r.created_at, r.expires_at),
      assignedReviewerId: r.assigned_reviewer_id,
      assignedReviewerName: r.assigned_reviewer_name,
      hasActiveVideo: Boolean(r.storage_key && !r.deleted_at),
      hasDraftReview: r.sr_review_status === 'draft',
      isAssessable: isPublished ? (r.is_assessable ?? 1) === 1 : null,
      durationSeconds: r.duration_seconds,
      expiresAt: r.expires_at,
      createdAt: r.created_at,
      instructionMatchScorePct: isPublished ? r.instruction_match_score_pct : null,
    };
  }

  getReviewerAllowedAgeGroupSlugs(reviewerUserId: string): string[] {
    const row = this.db
      .prepare('SELECT reviewer_allowed_age_groups_json FROM users WHERE id = ?')
      .get(reviewerUserId) as { reviewer_allowed_age_groups_json?: string | null } | undefined;
    return this.parseJsonStringArray(row?.reviewer_allowed_age_groups_json);
  }

  isSubmissionWithinReviewerScope(reviewerUserId: string, submissionId: string): boolean {
    const allowedSlugs = this.getReviewerAllowedAgeGroupSlugs(reviewerUserId);
    if (allowedSlugs.length === 0) return true;
    const row = this.db
      .prepare(
        `SELECT ag.slug as age_group_slug
         FROM video_submissions vs
         JOIN activities a ON a.id = vs.activity_id
         JOIN age_groups ag ON ag.id = a.age_group_id
         WHERE vs.id = ?`
      )
      .get(submissionId) as { age_group_slug: string } | undefined;
    if (!row) return false;
    return allowedSlugs.includes(row.age_group_slug);
  }

  getReviewerDashboardSummary(allowedAgeGroupSlugs?: string[]): ReviewerDashboardSummary {
    const scopedSlugs =
      allowedAgeGroupSlugs && allowedAgeGroupSlugs.length > 0 ? allowedAgeGroupSlugs : null;
    const scopeJoin = scopedSlugs
      ? 'JOIN activities a ON a.id = vs.activity_id JOIN age_groups ag ON ag.id = a.age_group_id'
      : '';
    const scopeWhere = scopedSlugs
      ? `AND ag.slug IN (${scopedSlugs.map(() => '?').join(', ')})`
      : '';
    const scopeParams = scopedSlugs ? [...scopedSlugs] : [];

    const counts = this.db
      .prepare(
        `SELECT
           SUM(CASE WHEN vs.review_status = 'queued' THEN 1 ELSE 0 END) as pending_count,
           SUM(CASE WHEN vs.review_status = 'in_review' THEN 1 ELSE 0 END) as in_review_count,
           SUM(CASE WHEN vs.review_status = 'reviewed' THEN 1 ELSE 0 END) as reviewed_count,
           SUM(CASE WHEN vs.review_status = 'resubmit_requested' THEN 1 ELSE 0 END) as changes_count
         FROM video_submissions vs
         ${scopeJoin}
         WHERE vs.review_status != 'deleted' ${scopeWhere}`
      )
      .get(...scopeParams) as {
      pending_count: number | null;
      in_review_count: number | null;
      reviewed_count: number | null;
      changes_count: number | null;
    };

    const recentRows = this.db
      .prepare(
        `SELECT vs.id as submission_id, vs.parent_user_id, vs.activity_id, vs.activity_version,
                a.title as activity_title, ld.name as domain_name,
                ag.slug as age_group_slug, ag.label as age_group_label,
                vs.review_status, vs.assigned_reviewer_id, u.full_name as assigned_reviewer_name,
                vs.storage_key, vs.deleted_at, vs.duration_seconds, vs.expires_at, vs.created_at,
                sr.review_status as sr_review_status, sr.is_assessable, sr.instruction_match_score_pct
         FROM video_submissions vs
         JOIN activities a ON a.id = vs.activity_id
         JOIN learning_domains ld ON ld.id = a.domain_id
         JOIN age_groups ag ON ag.id = a.age_group_id
         LEFT JOIN users u ON u.id = vs.assigned_reviewer_id
         LEFT JOIN submission_reviews sr ON sr.submission_id = vs.id
         WHERE vs.review_status != 'deleted' ${scopeWhere}
         ORDER BY vs.created_at DESC
         LIMIT 5`
      )
      .all(...scopeParams) as Array<Parameters<LittleStepsRepository['mapReviewerQueueRow']>[0]>;

    return {
      totalPending: counts.pending_count ?? 0,
      underReview: counts.in_review_count ?? 0,
      completedReviews: counts.reviewed_count ?? 0,
      changesRequested: counts.changes_count ?? 0,
      recentSubmissions: recentRows.map((r) => this.mapReviewerQueueRow(r)),
    };
  }

  listReviewerQueue(filters?: {
    status?: SubmissionReviewStatus | 'all';
    ageGroupSlug?: string;
    allowedAgeGroupSlugs?: string[];
    assignedReviewerId?: string;
  }): ReviewerQueueItem[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters?.status && filters.status !== 'all') {
      conditions.push('vs.review_status = ?');
      params.push(filters.status);
    } else {
      conditions.push("vs.review_status != 'deleted'");
    }

    if (filters?.ageGroupSlug && filters.ageGroupSlug !== 'all') {
      conditions.push('ag.slug = ?');
      params.push(filters.ageGroupSlug);
    }

    if (filters?.allowedAgeGroupSlugs && filters.allowedAgeGroupSlugs.length > 0) {
      conditions.push(
        `ag.slug IN (${filters.allowedAgeGroupSlugs.map(() => '?').join(', ')})`
      );
      params.push(...filters.allowedAgeGroupSlugs);
    }

    if (filters?.assignedReviewerId) {
      conditions.push('(vs.assigned_reviewer_id = ? OR sr.reviewer_user_id = ?)');
      params.push(filters.assignedReviewerId, filters.assignedReviewerId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = this.db
      .prepare(
        `SELECT vs.id as submission_id, vs.parent_user_id, vs.activity_id, vs.activity_version,
                a.title as activity_title, ld.name as domain_name,
                ag.slug as age_group_slug, ag.label as age_group_label,
                vs.review_status, vs.assigned_reviewer_id, u.full_name as assigned_reviewer_name,
                vs.storage_key, vs.deleted_at, vs.duration_seconds, vs.expires_at, vs.created_at,
                sr.review_status as sr_review_status, sr.is_assessable, sr.instruction_match_score_pct
         FROM video_submissions vs
         JOIN activities a ON a.id = vs.activity_id
         JOIN learning_domains ld ON ld.id = a.domain_id
         JOIN age_groups ag ON ag.id = a.age_group_id
         LEFT JOIN users u ON u.id = vs.assigned_reviewer_id
         LEFT JOIN submission_reviews sr ON sr.submission_id = vs.id
         ${whereClause}
         ORDER BY
           CASE vs.review_status
             WHEN 'queued' THEN 1
             WHEN 'in_review' THEN 2
             WHEN 'resubmit_requested' THEN 3
             ELSE 4
           END ASC,
           vs.created_at DESC`
      )
      .all(...params) as Array<Parameters<LittleStepsRepository['mapReviewerQueueRow']>[0]>;

    // Note: Intentionally omits parent email, phone, and legal names (Reviewer Data Minimization)
    return rows.map((r) => this.mapReviewerQueueRow(r));
  }

  claimSubmissionForReviewer(submissionId: string, reviewerId: string): boolean {
    if (!this.isSubmissionWithinReviewerScope(reviewerId, submissionId)) {
      return false;
    }
    const res = this.db
      .prepare(
        `UPDATE video_submissions
         SET assigned_reviewer_id = ?,
             review_status = CASE WHEN review_status = 'queued' THEN 'in_review' ELSE review_status END
         WHERE id = ?
           AND (assigned_reviewer_id IS NULL OR assigned_reviewer_id = ?)
           AND review_status IN ('queued', 'in_review')`
      )
      .run(reviewerId, submissionId, reviewerId);
    if (res.changes > 0) {
      this.logMediaAudit(reviewerId, 'reviewer', submissionId, 'review_open');
    }
    return res.changes > 0;
  }

  private hydrateActivityAtVersion(
    activity: ActivityDetail,
    requestedVersion: number | null
  ): ActivityDetail {
    if (!requestedVersion || requestedVersion === activity.version) {
      return activity;
    }
    const versionRow = this.db
      .prepare(
        'SELECT snapshot_json FROM activity_versions WHERE activity_id = ? AND version_number = ?'
      )
      .get(activity.id, requestedVersion) as { snapshot_json: string } | undefined;
    if (!versionRow) {
      return activity;
    }
    try {
      const snap = JSON.parse(versionRow.snapshot_json) as {
        title?: string;
        summary?: string;
        objectives?: string[];
        durationMinutes?: number;
        prepLevel?: ActivityPrepLevel;
        materials?: string[];
        safetyNotes?: string;
        instructionalPosterUrl?: string;
        instructionalVideoUrl?: string | null;
        steps?: Array<{
          step_number?: number;
          stepNumber?: number;
          title: string;
          instruction_text?: string;
          instructionText?: string;
          caregiver_tip?: string | null;
          caregiverTip?: string | null;
        }>;
      };
      const hydratedSteps: ActivityStep[] =
        Array.isArray(snap.steps) && snap.steps.length > 0
          ? snap.steps.map((s, idx) => ({
              id: `snap_${activity.id}_v${requestedVersion}_s${idx + 1}`,
              activityId: activity.id,
              stepNumber: s.stepNumber ?? s.step_number ?? idx + 1,
              title: s.title,
              instructionText: s.instructionText ?? s.instruction_text ?? '',
              caregiverTip: s.caregiverTip ?? s.caregiver_tip ?? null,
            }))
          : activity.steps;
      return {
        ...activity,
        version: requestedVersion,
        title: snap.title || activity.title,
        summary: snap.summary || activity.summary,
        objectives: Array.isArray(snap.objectives) ? snap.objectives : activity.objectives,
        durationMinutes:
          typeof snap.durationMinutes === 'number'
            ? snap.durationMinutes
            : activity.durationMinutes,
        prepLevel: snap.prepLevel || activity.prepLevel,
        materials: Array.isArray(snap.materials) ? snap.materials : activity.materials,
        safetyNotes: snap.safetyNotes || activity.safetyNotes,
        instructionalPosterUrl: snap.instructionalPosterUrl || activity.instructionalPosterUrl,
        instructionalVideoUrl:
          snap.instructionalVideoUrl !== undefined
            ? snap.instructionalVideoUrl
            : activity.instructionalVideoUrl,
        steps: hydratedSteps,
      };
    } catch {
      return activity;
    }
  }

  getReviewerSubmissionDetail(submissionId: string): ReviewerSubmissionDetail | null {
    const row = this.db
      .prepare(
        `SELECT vs.id as submission_id, vs.parent_user_id, vs.activity_id, vs.activity_version,
                a.title as activity_title, ld.name as domain_name,
                ag.slug as age_group_slug, ag.label as age_group_label,
                vs.review_status, vs.assigned_reviewer_id, u.full_name as assigned_reviewer_name,
                vs.storage_key, vs.storage_provider, vs.deleted_at, vs.deletion_reason,
                vs.duration_seconds, vs.caregiver_notes, vs.change_request_note,
                vs.expires_at, vs.created_at,
                sr.review_status as sr_review_status, sr.is_assessable, sr.instruction_match_score_pct
         FROM video_submissions vs
         JOIN activities a ON a.id = vs.activity_id
         JOIN learning_domains ld ON ld.id = a.domain_id
         JOIN age_groups ag ON ag.id = a.age_group_id
         LEFT JOIN users u ON u.id = vs.assigned_reviewer_id
         LEFT JOIN submission_reviews sr ON sr.submission_id = vs.id
         WHERE vs.id = ?`
      )
      .get(submissionId) as
      | {
          submission_id: string;
          parent_user_id: string;
          activity_id: string;
          activity_version: number | null;
          activity_title: string;
          domain_name: string;
          age_group_slug: string;
          age_group_label: string;
          review_status: SubmissionReviewStatus;
          assigned_reviewer_id: string | null;
          assigned_reviewer_name: string | null;
          storage_key: string | null;
          storage_provider: string | null;
          deleted_at: string | null;
          deletion_reason: string | null;
          duration_seconds: number;
          caregiver_notes: string | null;
          change_request_note: string | null;
          expires_at: string;
          created_at: string;
          sr_review_status: ReviewPublicationStatus | null;
          is_assessable: number | null;
          instruction_match_score_pct: number | null;
        }
      | undefined;

    if (!row) return null;
    const liveActivity = this.getActivityDetail(row.activity_id);
    if (!liveActivity) return null;
    const activity = this.hydrateActivityAtVersion(liveActivity, row.activity_version);

    const baseQueue = this.mapReviewerQueueRow(row);
    const storageMode: VideoStorageMode =
      row.storage_provider === 'production_object_storage'
        ? 'production_object_storage'
        : 'demo_local_vault';

    return {
      submission: {
        ...baseQueue,
        activityTitle: activity.title,
        caregiverNotes: row.caregiver_notes,
        changeRequestNote: row.change_request_note,
        deletedAt: row.deleted_at,
        deletionReason: row.deletion_reason,
        storageMode,
        storageReference: row.storage_key ? row.storage_key.split('/').pop() ?? null : null,
      },
      activity,
      review: this.getReviewDetailForSubmission(submissionId, true),
      history: this.listReviewHistory(submissionId),
    };
  }

  submitRubricReview(params: {
    submissionId: string;
    reviewerUserId: string;
    mode: 'draft' | 'publish' | 'not_assessable';
    strengthsNote?: string;
    coachingTip?: string;
    reviewerComments?: string | null;
    notAssessableReason?: string | null;
    criterionRatings: Array<{
      criterionId: string;
      achievedLevel: RubricAchievementLevel;
      explanation?: string | null;
    }>;
  }): SubmissionReviewDetail {
    const rawSub = this.findSubmissionRawById(params.submissionId);
    if (!rawSub) {
      throw new Error('Submission not found');
    }
    if (!this.isSubmissionWithinReviewerScope(params.reviewerUserId, params.submissionId)) {
      throw new Error('You are not assigned to review submissions for this age group.');
    }
    if (
      rawSub.assigned_reviewer_id &&
      rawSub.assigned_reviewer_id !== params.reviewerUserId &&
      rawSub.review_status === 'in_review'
    ) {
      throw new Error('This submission is actively assigned to another reviewer.');
    }
    const activity = this.getActivityDetail(rawSub.activity_id);
    if (!activity) {
      throw new Error('Activity not found');
    }

    const evaluation = evaluateCaregiverRubric({
      reviewerUserId: params.reviewerUserId,
      mode: params.mode,
      criteria: activity.rubricCriteria,
      criterionRatings: params.criterionRatings,
      strengthsNote: params.strengthsNote,
      coachingTip: params.coachingTip,
      reviewerComments: params.reviewerComments,
      notAssessableReason: params.notAssessableReason,
    });

    const computedScores = evaluation.computedScores;
    const isAssessable = evaluation.isAssessable;
    const scorePct = evaluation.scorePct;
    const finalNotAssessableReason = evaluation.notAssessableReason;
    const strengths = evaluation.strengthsNote;
    const coaching = evaluation.coachingTip;
    const comments = evaluation.reviewerComments;

    const nowIso = new Date().toISOString();
    const isDraft = params.mode === 'draft';

    const tx = this.db.transaction(() => {
      const existingRev = this.db
        .prepare('SELECT id, review_status, version FROM submission_reviews WHERE submission_id = ?')
        .get(params.submissionId) as
        | { id: string; review_status: ReviewPublicationStatus; version: number }
        | undefined;

      if (isDraft && existingRev?.review_status === 'published') {
        throw new Error(
          'This review is already published. Save your changes using Update Evaluation so revision history is preserved.'
        );
      }

      const wasAlreadyPublished = existingRev?.review_status === 'published';
      const nextVersion = existingRev
        ? wasAlreadyPublished
          ? (existingRev.version ?? 1) + 1
          : existingRev.version ?? 1
        : 1;
      const reviewId = existingRev ? existingRev.id : `rev_${crypto.randomUUID().slice(0, 10)}`;
      const reviewStatus: ReviewPublicationStatus = isDraft ? 'draft' : 'published';

      if (existingRev) {
        this.db
          .prepare(
            `UPDATE submission_reviews
             SET reviewer_user_id = ?,
                 review_status = ?,
                 version = ?,
                 is_assessable = ?,
                 not_assessable_reason = ?,
                 instruction_match_score_pct = ?,
                 strengths_note = ?,
                 coaching_tip = ?,
                 reviewer_comments = ?,
                 evaluation_scope_acknowledged_at = ?,
                 submitted_at = ?
             WHERE id = ?`
          )
          .run(
            params.reviewerUserId,
            reviewStatus,
            nextVersion,
            isAssessable ? 1 : 0,
            finalNotAssessableReason,
            scorePct,
            strengths,
            coaching,
            comments,
            nowIso,
            nowIso,
            reviewId
          );
        this.db.prepare('DELETE FROM review_rubric_scores WHERE review_id = ?').run(reviewId);
      } else {
        this.db
          .prepare(
            `INSERT INTO submission_reviews (
               id, submission_id, reviewer_user_id, review_status, version,
               is_assessable, not_assessable_reason, instruction_match_score_pct,
               strengths_note, coaching_tip, reviewer_comments,
               evaluation_scope_acknowledged_at, submitted_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            reviewId,
            params.submissionId,
            params.reviewerUserId,
            reviewStatus,
            nextVersion,
            isAssessable ? 1 : 0,
            finalNotAssessableReason,
            scorePct,
            strengths,
            coaching,
            comments,
            nowIso,
            nowIso
          );
      }

      const insertScore = this.db.prepare(
        `INSERT INTO review_rubric_scores (
           id, review_id, rubric_criterion_id, achieved_level, earned_points, max_points, explanation
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      );
      for (const s of computedScores) {
        insertScore.run(
          crypto.randomUUID(),
          reviewId,
          s.criterionId,
          s.achievedLevel,
          s.earnedPoints,
          s.maxPoints,
          s.explanation
        );
      }

      if (isDraft) {
        this.db
          .prepare(
            `UPDATE video_submissions
             SET review_status = CASE WHEN review_status = 'queued' THEN 'in_review' ELSE review_status END,
                 assigned_reviewer_id = ?
             WHERE id = ?`
          )
          .run(params.reviewerUserId, params.submissionId);
      } else {
        this.db
          .prepare(
            `UPDATE video_submissions
             SET review_status = 'reviewed',
                 assigned_reviewer_id = ?,
                 change_request_note = NULL
             WHERE id = ?`
          )
          .run(params.reviewerUserId, params.submissionId);

        this.db
          .prepare("UPDATE activity_completions SET status = 'reviewed' WHERE id = ?")
          .run(rawSub.completion_id);
      }

      const auditAction: ReviewAuditAction = isDraft
        ? 'draft_saved'
        : !isAssessable
          ? 'marked_not_assessable'
          : wasAlreadyPublished
            ? 'updated'
            : 'published';

      this.appendReviewAuditHistory({
        submissionId: params.submissionId,
        reviewId,
        actorUserId: params.reviewerUserId,
        actorRole: 'reviewer',
        action: auditAction,
        version: nextVersion,
        isAssessable,
        scorePct,
        summaryNote: !isAssessable
          ? finalNotAssessableReason
          : comments || strengths || 'Draft saved',
        snapshot: {
          mode: params.mode,
          reviewStatus,
          version: nextVersion,
          isAssessable,
          instructionMatchScorePct: scorePct,
          notAssessableReason: finalNotAssessableReason,
          strengthsNote: strengths,
          coachingTip: coaching,
          reviewerComments: comments,
          criterionRatings: computedScores,
        },
      });
    });
    tx();

    return this.getReviewDetailForSubmission(params.submissionId, true)!;
  }

  // ======================== AUDIT & ADMIN OVERVIEW ========================

  logAdminAudit(params: {
    actorUserId: string | null;
    actorRole: string;
    action: string;
    entityType: string;
    entityId: string;
    summary: string;
    metadata?: Record<string, unknown>;
  }): void {
    this.db
      .prepare(
        `INSERT INTO admin_audit_logs (
           id, actor_user_id, actor_role, action, entity_type, entity_id, summary, metadata_json
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        `adm_${crypto.randomUUID().slice(0, 12)}`,
        params.actorUserId,
        params.actorRole,
        params.action,
        params.entityType,
        params.entityId,
        params.summary,
        JSON.stringify(params.metadata ?? {})
      );
  }

  logMediaAudit(
    actorUserId: string | null,
    actorRole: string,
    submissionId: string,
    action: MediaAuditAction
  ): void {
    this.db
      .prepare(
        `INSERT INTO media_access_audit_logs (id, actor_user_id, actor_role, submission_id, action)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(crypto.randomUUID(), actorUserId, actorRole, submissionId, action);
  }

  listMediaAuditLogs(limit = 100): MediaAuditLogItem[] {
    const rows = this.db
      .prepare(
        `SELECT l.id, l.actor_user_id, COALESCE(u.full_name, 'Retention System') as actor_name,
                l.actor_role, l.submission_id, l.action, l.created_at
         FROM media_access_audit_logs l
         LEFT JOIN users u ON u.id = l.actor_user_id
         ORDER BY l.created_at DESC
         LIMIT ?`
      )
      .all(limit) as Array<{
      id: string;
      actor_user_id: string | null;
      actor_name: string;
      actor_role: string;
      submission_id: string;
      action: MediaAuditAction;
      created_at: string;
    }>;

    return rows.map((r) => ({
      id: r.id,
      actorUserId: r.actor_user_id,
      actorName: r.actor_name,
      actorRole: r.actor_role,
      submissionId: r.submission_id,
      action: r.action,
      createdAt: r.created_at,
    }));
  }

  listUnifiedAuditLogs(filters?: {
    category?: UnifiedAuditCategory | 'all';
    limit?: number;
  }): UnifiedAuditLogItem[] {
    const category = filters?.category ?? 'all';
    const limit = Math.max(1, Math.min(250, filters?.limit ?? 120));
    const entries: UnifiedAuditLogItem[] = [];

    if (category === 'all' || category === 'admin') {
      const adminRows = this.db
        .prepare(
          `SELECT l.id, l.actor_user_id, COALESCE(u.full_name, 'System Admin') as actor_name,
                  l.actor_role, l.action, l.entity_type, l.entity_id, l.summary, l.created_at
           FROM admin_audit_logs l
           LEFT JOIN users u ON u.id = l.actor_user_id
           ORDER BY l.created_at DESC
           LIMIT ?`
        )
        .all(limit) as Array<{
        id: string;
        actor_user_id: string | null;
        actor_name: string;
        actor_role: string;
        action: string;
        entity_type: string;
        entity_id: string;
        summary: string;
        created_at: string;
      }>;
      for (const r of adminRows) {
        entries.push({
          id: r.id,
          category: 'admin',
          actorUserId: r.actor_user_id,
          actorName: r.actor_name,
          actorRole: r.actor_role,
          action: r.action,
          entityType: r.entity_type,
          entityId: r.entity_id,
          summary: r.summary,
          createdAt: r.created_at,
        });
      }
    }

    if (category === 'all' || category === 'review') {
      const revRows = this.db
        .prepare(
          `SELECT h.id, h.actor_user_id, COALESCE(u.full_name, 'Reviewer') as actor_name,
                  h.actor_role, h.action, h.submission_id, h.version, h.score_pct, h.is_assessable,
                  h.summary_note, h.created_at
           FROM review_audit_history h
           LEFT JOIN users u ON u.id = h.actor_user_id
           ORDER BY h.created_at DESC
           LIMIT ?`
        )
        .all(limit) as Array<{
        id: string;
        actor_user_id: string;
        actor_name: string;
        actor_role: string;
        action: string;
        submission_id: string;
        version: number;
        score_pct: number | null;
        is_assessable: number;
        summary_note: string | null;
        created_at: string;
      }>;
      for (const r of revRows) {
        const scoreSnippet =
          r.is_assessable === 1 && r.score_pct !== null
            ? ` (${r.score_pct}% instruction match)`
            : r.is_assessable === 0
              ? ' (Not assessable)'
              : '';
        entries.push({
          id: r.id,
          category: 'review',
          actorUserId: r.actor_user_id,
          actorName: r.actor_name,
          actorRole: r.actor_role,
          action: `review_${r.action}`,
          entityType: 'video_submission',
          entityId: r.submission_id,
          summary: `Review v${r.version} ${r.action.replace(/_/g, ' ')}${scoreSnippet}${r.summary_note ? ` — ${r.summary_note.slice(0, 90)}` : ''}`,
          createdAt: r.created_at,
        });
      }
    }

    if (category === 'all' || category === 'media') {
      const mediaRows = this.listMediaAuditLogs(limit);
      for (const m of mediaRows) {
        entries.push({
          id: m.id,
          category: 'media',
          actorUserId: m.actorUserId,
          actorName: m.actorName,
          actorRole: m.actorRole,
          action: `media_${m.action}`,
          entityType: 'video_submission',
          entityId: m.submissionId,
          summary: `Private media action: ${m.action.replace(/_/g, ' ')} on submission ${m.submissionId}`,
          createdAt: m.createdAt,
        });
      }
    }

    return entries
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
      .slice(0, limit);
  }

  listAdminSubmissions(filters?: {
    status?: SubmissionReviewStatus | 'all';
    ageGroupSlug?: string;
    reviewerId?: string;
    search?: string;
  }): AdminSubmissionItem[] {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (filters?.status && filters.status !== 'all') {
      conditions.push('vs.review_status = ?');
      params.push(filters.status);
    }
    if (filters?.ageGroupSlug && filters.ageGroupSlug !== 'all') {
      conditions.push('ag.slug = ?');
      params.push(filters.ageGroupSlug);
    }
    if (filters?.reviewerId && filters.reviewerId !== 'all') {
      if (filters.reviewerId === 'unassigned') {
        conditions.push('vs.assigned_reviewer_id IS NULL');
      } else {
        conditions.push('vs.assigned_reviewer_id = ?');
        params.push(filters.reviewerId);
      }
    }
    if (filters?.search && filters.search.trim().length > 0) {
      const q = `%${filters.search.trim()}%`;
      conditions.push('(a.title LIKE ? OR ag.label LIKE ? OR ld.name LIKE ? OR vs.id LIKE ?)');
      params.push(q, q, q, q);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = this.db
      .prepare(
        `SELECT vs.id as submission_id, vs.parent_user_id, vs.activity_id, vs.activity_version,
                a.title as activity_title, ld.name as domain_name,
                ag.slug as age_group_slug, ag.label as age_group_label,
                vs.review_status, vs.assigned_reviewer_id, u.full_name as assigned_reviewer_name,
                vs.storage_key, vs.storage_provider, vs.deleted_at, vs.deletion_reason,
                vs.duration_seconds, vs.expires_at, vs.created_at,
                sr.is_assessable, sr.instruction_match_score_pct
         FROM video_submissions vs
         JOIN activities a ON a.id = vs.activity_id
         JOIN learning_domains ld ON ld.id = a.domain_id
         JOIN age_groups ag ON ag.id = a.age_group_id
         LEFT JOIN users u ON u.id = vs.assigned_reviewer_id
         LEFT JOIN submission_reviews sr ON sr.submission_id = vs.id AND sr.review_status = 'published'
         ${whereClause}
         ORDER BY vs.created_at DESC
         LIMIT 250`
      )
      .all(...params) as Array<{
      submission_id: string;
      parent_user_id: string;
      activity_id: string;
      activity_version: number | null;
      activity_title: string;
      domain_name: string;
      age_group_slug: string;
      age_group_label: string;
      review_status: SubmissionReviewStatus;
      assigned_reviewer_id: string | null;
      assigned_reviewer_name: string | null;
      storage_key: string | null;
      storage_provider: string | null;
      deleted_at: string | null;
      deletion_reason: string | null;
      duration_seconds: number;
      expires_at: string;
      created_at: string;
      is_assessable: number | null;
      instruction_match_score_pct: number | null;
    }>;

    return rows.map((r) => ({
      submissionId: r.submission_id,
      parentReference: `PAR-${r.parent_user_id.slice(-6).toUpperCase()}`,
      activityId: r.activity_id,
      activityTitle: r.activity_title,
      activityVersion: r.activity_version ?? 1,
      domainName: r.domain_name,
      ageGroupSlug: r.age_group_slug,
      ageGroupLabel: r.age_group_label,
      reviewStatus: r.review_status,
      assignedReviewerId: r.assigned_reviewer_id,
      assignedReviewerName: r.assigned_reviewer_name,
      hasActiveVideo: Boolean(r.storage_key && !r.deleted_at),
      storageMode:
        r.storage_provider && r.storage_provider !== 'local' && r.storage_provider !== 'demo_local_vault'
          ? 'production_object_storage'
          : 'demo_local_vault',
      isAssessable: r.is_assessable === null ? null : r.is_assessable === 1,
      instructionMatchScorePct: r.instruction_match_score_pct,
      durationSeconds: r.duration_seconds,
      expiresAt: r.expires_at,
      deletedAt: r.deleted_at,
      deletionReason: r.deletion_reason,
      createdAt: r.created_at,
    }));
  }

  assignSubmissionReviewer(
    actorUserId: string,
    submissionId: string,
    reviewerUserId: string | null
  ): AdminSubmissionItem | null {
    const existing = this.findSubmissionRawById(submissionId);
    if (!existing) return null;

    let reviewerName = 'Unassigned';
    if (reviewerUserId) {
      const reviewer = this.findUserById(reviewerUserId);
      if (!reviewer || reviewer.role !== 'reviewer' || !reviewer.isActive) {
        throw new Error('Selected account must be an active reviewer.');
      }
      reviewerName = reviewer.fullName;
    }

    this.db
      .prepare(
        `UPDATE video_submissions
         SET assigned_reviewer_id = ?,
             review_status = CASE
               WHEN ? IS NOT NULL AND review_status = 'queued' THEN 'in_review'
               WHEN ? IS NULL AND review_status = 'in_review' THEN 'queued'
               ELSE review_status
             END
         WHERE id = ?`
      )
      .run(reviewerUserId, reviewerUserId, reviewerUserId, submissionId);

    this.logAdminAudit({
      actorUserId,
      actorRole: 'admin',
      action: reviewerUserId ? 'submission_assigned' : 'submission_unassigned',
      entityType: 'video_submission',
      entityId: submissionId,
      summary: reviewerUserId
        ? `Assigned submission ${submissionId} to reviewer ${reviewerName}`
        : `Unassigned submission ${submissionId} back to open review queue`,
      metadata: { reviewerUserId },
    });

    return this.listAdminSubmissions().find((s) => s.submissionId === submissionId) ?? null;
  }

  getAdminOverview(lastRetentionSweepAt: string | null): AdminOverviewResponse {
    const ageGroups = this.listAgeGroups();
    const domains = this.listLearningDomains();

    const totalActivities = (
      this.db.prepare('SELECT COUNT(*) as c FROM activities').get() as { c: number }
    ).c;
    const publishedActivities = (
      this.db.prepare("SELECT COUNT(*) as c FROM activities WHERE status = 'published'").get() as {
        c: number;
      }
    ).c;
    const draftActivities = (
      this.db.prepare("SELECT COUNT(*) as c FROM activities WHERE status = 'draft'").get() as {
        c: number;
      }
    ).c;
    const archivedActivities = (
      this.db.prepare("SELECT COUNT(*) as c FROM activities WHERE status = 'archived'").get() as {
        c: number;
      }
    ).c;
    const totalParents = (
      this.db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'parent'").get() as { c: number }
    ).c;
    const totalChildren = (
      this.db.prepare('SELECT COUNT(*) as c FROM children').get() as { c: number }
    ).c;
    const totalReviewers = (
      this.db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'reviewer'").get() as {
        c: number;
      }
    ).c;
    const queuedSubmissions = (
      this.db
        .prepare("SELECT COUNT(*) as c FROM video_submissions WHERE review_status IN ('queued', 'in_review')")
        .get() as { c: number }
    ).c;
    const completedReviews = (
      this.db
        .prepare("SELECT COUNT(*) as c FROM submission_reviews WHERE review_status = 'published'")
        .get() as { c: number }
    ).c;
    const activeVideosCount = (
      this.db
        .prepare('SELECT COUNT(*) as c FROM video_submissions WHERE storage_key IS NOT NULL AND deleted_at IS NULL')
        .get() as { c: number }
    ).c;
    const expiredPurgedCount = (
      this.db
        .prepare("SELECT COUNT(*) as c FROM video_submissions WHERE deletion_reason = 'retention_30d'")
        .get() as { c: number }
    ).c;

    const matrixRows = this.db
      .prepare(
        `SELECT age_group_id, domain_id, COUNT(*) as cnt
         FROM activities
         WHERE status = 'published'
         GROUP BY age_group_id, domain_id`
      )
      .all() as Array<{ age_group_id: string; domain_id: string; cnt: number }>;

    const countLookup = new Map<string, number>();
    for (const row of matrixRows) {
      countLookup.set(`${row.age_group_id}::${row.domain_id}`, row.cnt);
    }

    const coverageMatrix = ageGroups.map((ag) => {
      const domainCounts: Record<string, number> = {};
      for (const dom of domains) {
        domainCounts[dom.slug] = countLookup.get(`${ag.id}::${dom.id}`) ?? 0;
      }
      return {
        ageGroupId: ag.id,
        ageGroupSlug: ag.slug,
        ageGroupLabel: ag.label,
        domainCounts,
      };
    });

    return {
      counts: {
        totalActivities,
        publishedActivities,
        draftActivities,
        archivedActivities,
        totalParents,
        totalChildren,
        totalReviewers,
        pendingReviews: queuedSubmissions,
        completedReviews,
        queuedSubmissions,
        activeVideosCount,
        expiredPurgedCount,
      },
      coverageMatrix,
      recentActivity: this.listUnifiedAuditLogs({ category: 'all', limit: 12 }),
      lastRetentionSweepAt,
    };
  }

  createContactInquiry(params: {
    fullName: string;
    email: string;
    topic: string;
    message: string;
  }): { id: string; createdAt: string } {
    const id = `inq_${crypto.randomUUID().slice(0, 10)}`;
    const createdAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO contact_inquiries (id, full_name, email, topic, message, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        params.fullName.trim(),
        params.email.trim().toLowerCase(),
        params.topic.trim(),
        params.message.trim(),
        createdAt
      );
    return { id, createdAt };
  }
}

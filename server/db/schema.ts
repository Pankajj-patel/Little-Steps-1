import type Database from 'better-sqlite3';

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      phone_number TEXT,
      role TEXT NOT NULL CHECK (role IN ('parent', 'reviewer', 'admin')),
      preferred_locale TEXT NOT NULL DEFAULT 'en' CHECK (preferred_locale IN ('en', 'hi')),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS user_consents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      consent_type TEXT NOT NULL CHECK (consent_type IN ('video_processing', 'privacy_policy', 'child_data')),
      policy_version TEXT NOT NULL,
      granted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      revoked_at TEXT,
      ip_hash TEXT
    );

    CREATE TABLE IF NOT EXISTS age_groups (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      min_months INTEGER NOT NULL,
      max_months INTEGER NOT NULL,
      sort_order INTEGER NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS learning_domains (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      sort_order INTEGER NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS children (
      id TEXT PRIMARY KEY,
      parent_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      display_name TEXT NOT NULL,
      date_of_birth TEXT NOT NULL,
      active_age_group_id TEXT NOT NULL REFERENCES age_groups(id),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      age_group_id TEXT NOT NULL REFERENCES age_groups(id),
      domain_id TEXT NOT NULL REFERENCES learning_domains(id),
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 5,
      materials_json TEXT NOT NULL DEFAULT '[]',
      safety_notes TEXT NOT NULL,
      instructional_poster_url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS activity_steps (
      id TEXT PRIMARY KEY,
      activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
      step_number INTEGER NOT NULL,
      title TEXT NOT NULL,
      instruction_text TEXT NOT NULL,
      caregiver_tip TEXT,
      UNIQUE (activity_id, step_number)
    );

    CREATE TABLE IF NOT EXISTS activity_rubric_criteria (
      id TEXT PRIMARY KEY,
      activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
      criterion_order INTEGER NOT NULL,
      label TEXT NOT NULL,
      description TEXT NOT NULL,
      weight_points INTEGER NOT NULL CHECK (weight_points > 0 AND weight_points <= 100),
      UNIQUE (activity_id, criterion_order)
    );

    CREATE TABLE IF NOT EXISTS daily_plans (
      id TEXT PRIMARY KEY,
      age_group_id TEXT NOT NULL REFERENCES age_groups(id) ON DELETE CASCADE,
      day_number INTEGER NOT NULL,
      title TEXT NOT NULL,
      focus_note TEXT NOT NULL,
      UNIQUE (age_group_id, day_number)
    );

    CREATE TABLE IF NOT EXISTS daily_plan_items (
      id TEXT PRIMARY KEY,
      daily_plan_id TEXT NOT NULL REFERENCES daily_plans(id) ON DELETE CASCADE,
      activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL,
      UNIQUE (daily_plan_id, activity_id)
    );

    CREATE TABLE IF NOT EXISTS activity_completions (
      id TEXT PRIMARY KEY,
      child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
      activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
      plan_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'submitted_for_review', 'reviewed')),
      caregiver_notes TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      UNIQUE (child_id, activity_id, plan_date)
    );

    CREATE TABLE IF NOT EXISTS video_submissions (
      id TEXT PRIMARY KEY,
      completion_id TEXT NOT NULL REFERENCES activity_completions(id) ON DELETE CASCADE,
      parent_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
      activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
      storage_key TEXT,
      mime_type TEXT NOT NULL,
      file_size_bytes INTEGER NOT NULL DEFAULT 0,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      review_status TEXT NOT NULL DEFAULT 'queued'
        CHECK (review_status IN ('queued', 'in_review', 'reviewed', 'resubmit_requested', 'deleted')),
      assigned_reviewer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      caregiver_notes TEXT,
      expires_at TEXT NOT NULL,
      deleted_at TEXT,
      deletion_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS submission_reviews (
      id TEXT PRIMARY KEY,
      submission_id TEXT NOT NULL UNIQUE REFERENCES video_submissions(id) ON DELETE CASCADE,
      reviewer_user_id TEXT NOT NULL REFERENCES users(id),
      instruction_match_score_pct INTEGER CHECK (instruction_match_score_pct IS NULL OR (instruction_match_score_pct >= 0 AND instruction_match_score_pct <= 100)),
      is_assessable INTEGER NOT NULL DEFAULT 1,
      not_assessable_reason TEXT,
      strengths_note TEXT NOT NULL DEFAULT '',
      coaching_tip TEXT NOT NULL DEFAULT '',
      reviewer_comments TEXT,
      review_status TEXT NOT NULL DEFAULT 'published' CHECK (review_status IN ('draft', 'published')),
      version INTEGER NOT NULL DEFAULT 1,
      evaluation_scope_acknowledged_at TEXT NOT NULL,
      submitted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS review_rubric_scores (
      id TEXT PRIMARY KEY,
      review_id TEXT NOT NULL REFERENCES submission_reviews(id) ON DELETE CASCADE,
      rubric_criterion_id TEXT NOT NULL REFERENCES activity_rubric_criteria(id) ON DELETE CASCADE,
      achieved_level TEXT NOT NULL CHECK (achieved_level IN ('met', 'partially_met', 'not_met', 'not_observed', 'not_assessable')),
      earned_points REAL NOT NULL,
      max_points REAL NOT NULL,
      explanation TEXT
    );

    CREATE TABLE IF NOT EXISTS review_audit_history (
      id TEXT PRIMARY KEY,
      submission_id TEXT NOT NULL REFERENCES video_submissions(id) ON DELETE CASCADE,
      review_id TEXT,
      actor_user_id TEXT NOT NULL REFERENCES users(id),
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL CHECK (action IN ('draft_saved', 'published', 'updated', 'marked_not_assessable', 'changes_requested')),
      version INTEGER NOT NULL DEFAULT 1,
      score_pct INTEGER,
      is_assessable INTEGER NOT NULL DEFAULT 1,
      summary_note TEXT NOT NULL DEFAULT '',
      snapshot_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS media_access_audit_logs (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      actor_role TEXT NOT NULL,
      submission_id TEXT NOT NULL,
      action TEXT NOT NULL CHECK (action IN ('upload', 'stream', 'review_open', 'parent_delete', 'admin_delete', 'auto_purge')),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS contact_inquiries (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      topic TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS auth_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_type TEXT NOT NULL CHECK (token_type IN ('email_verification', 'password_reset')),
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS profile_photos (
      storage_key TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS activity_versions (
      id TEXT PRIMARY KEY,
      activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
      version_number INTEGER NOT NULL,
      snapshot_json TEXT NOT NULL,
      change_note TEXT,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      UNIQUE (activity_id, version_number)
    );

    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      summary TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_children_parent ON children(parent_user_id);
    CREATE INDEX IF NOT EXISTS idx_activities_age_domain ON activities(age_group_id, domain_id, status);
    CREATE INDEX IF NOT EXISTS idx_activity_versions_act ON activity_versions(activity_id, version_number DESC);
    CREATE INDEX IF NOT EXISTS idx_submissions_queue ON video_submissions(review_status, created_at);
    CREATE INDEX IF NOT EXISTS idx_submissions_expiry ON video_submissions(expires_at, deleted_at);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON media_access_audit_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_review_history_sub ON review_audit_history(submission_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_auth_tokens_hash ON auth_tokens(token_hash, token_type);
    CREATE INDEX IF NOT EXISTS idx_profile_photos_owner ON profile_photos(owner_user_id);
  `);

  // Safe idempotent column migrations for existing databases
  const ensureColumn = (table: string, column: string, definition: string) => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  };

  ensureColumn('users', 'email_verified_at', 'TEXT');
  ensureColumn('users', 'profile_photo_url', 'TEXT');
  ensureColumn('users', 'preferred_activity_time', "TEXT NOT NULL DEFAULT 'morning'");
  ensureColumn('users', 'notification_preference', "TEXT NOT NULL DEFAULT 'daily_gentle'");
  ensureColumn('users', 'onboarding_completed_at', 'TEXT');
  ensureColumn('users', 'session_version', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn('users', 'reviewer_allowed_age_groups_json', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn('users', 'reviewer_specialty_note', 'TEXT');

  ensureColumn('children', 'profile_photo_url', 'TEXT');
  ensureColumn('children', 'activity_preferences', 'TEXT');
  ensureColumn('activities', 'prep_level', "TEXT NOT NULL DEFAULT 'quick_setup'");
  ensureColumn('activities', 'version', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn('activities', 'objectives_json', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn('activities', 'instructional_video_url', 'TEXT');
  ensureColumn('activity_completions', 'last_opened_at', 'TEXT');
  ensureColumn('activity_completions', 'age_group_id_snapshot', 'TEXT');
  ensureColumn('activity_completions', 'age_group_label_snapshot', 'TEXT');
  ensureColumn('video_submissions', 'activity_version', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn('video_submissions', 'storage_provider', "TEXT NOT NULL DEFAULT 'demo_local_vault'");
  ensureColumn('video_submissions', 'consent_record_id', 'TEXT REFERENCES user_consents(id)');
  ensureColumn('video_submissions', 'change_request_note', 'TEXT');

  // Upgrade existing submission_reviews and review_rubric_scores tables in place if older CHECK constraints exist
  const revTableDef = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'submission_reviews'")
    .get() as { sql: string } | undefined;
  const rubricTableDef = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'review_rubric_scores'")
    .get() as { sql: string } | undefined;

  if (
    (revTableDef && !revTableDef.sql.includes('is_assessable')) ||
    (rubricTableDef && !rubricTableDef.sql.includes('not_assessable'))
  ) {
    db.pragma('foreign_keys = OFF');
    const migrateTx = db.transaction(() => {
      if (revTableDef && !revTableDef.sql.includes('is_assessable')) {
        db.exec(`
          CREATE TABLE submission_reviews_v2 (
            id TEXT PRIMARY KEY,
            submission_id TEXT NOT NULL UNIQUE REFERENCES video_submissions(id) ON DELETE CASCADE,
            reviewer_user_id TEXT NOT NULL REFERENCES users(id),
            instruction_match_score_pct INTEGER CHECK (instruction_match_score_pct IS NULL OR (instruction_match_score_pct >= 0 AND instruction_match_score_pct <= 100)),
            is_assessable INTEGER NOT NULL DEFAULT 1,
            not_assessable_reason TEXT,
            strengths_note TEXT NOT NULL DEFAULT '',
            coaching_tip TEXT NOT NULL DEFAULT '',
            reviewer_comments TEXT,
            review_status TEXT NOT NULL DEFAULT 'published' CHECK (review_status IN ('draft', 'published')),
            version INTEGER NOT NULL DEFAULT 1,
            evaluation_scope_acknowledged_at TEXT NOT NULL,
            submitted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
          );
          INSERT INTO submission_reviews_v2 (
            id, submission_id, reviewer_user_id, instruction_match_score_pct,
            is_assessable, strengths_note, coaching_tip, review_status, version,
            evaluation_scope_acknowledged_at, submitted_at
          )
          SELECT id, submission_id, reviewer_user_id, instruction_match_score_pct,
                 1, strengths_note, coaching_tip, 'published', 1,
                 evaluation_scope_acknowledged_at, submitted_at
          FROM submission_reviews;
          DROP TABLE submission_reviews;
          ALTER TABLE submission_reviews_v2 RENAME TO submission_reviews;
        `);
      }

      if (rubricTableDef && !rubricTableDef.sql.includes('not_assessable')) {
        db.exec(`
          CREATE TABLE review_rubric_scores_v2 (
            id TEXT PRIMARY KEY,
            review_id TEXT NOT NULL REFERENCES submission_reviews(id) ON DELETE CASCADE,
            rubric_criterion_id TEXT NOT NULL REFERENCES activity_rubric_criteria(id) ON DELETE CASCADE,
            achieved_level TEXT NOT NULL CHECK (achieved_level IN ('met', 'partially_met', 'not_met', 'not_observed', 'not_assessable')),
            earned_points REAL NOT NULL,
            max_points REAL NOT NULL,
            explanation TEXT
          );
          INSERT INTO review_rubric_scores_v2 (
            id, review_id, rubric_criterion_id, achieved_level, earned_points, max_points
          )
          SELECT id, review_id, rubric_criterion_id, achieved_level, earned_points, max_points
          FROM review_rubric_scores;
          DROP TABLE review_rubric_scores;
          ALTER TABLE review_rubric_scores_v2 RENAME TO review_rubric_scores;
        `);
      }
    });
    migrateTx();
    db.pragma('foreign_keys = ON');
  }

  // Backfill immutable historical stage snapshots for any pre-existing completion records
  db.exec(`
    UPDATE activity_completions
    SET age_group_id_snapshot = COALESCE(
          age_group_id_snapshot,
          (SELECT a.age_group_id FROM activities a WHERE a.id = activity_completions.activity_id)
        ),
        age_group_label_snapshot = COALESCE(
          age_group_label_snapshot,
          (SELECT ag.label FROM activities a JOIN age_groups ag ON ag.id = a.age_group_id WHERE a.id = activity_completions.activity_id)
        )
    WHERE age_group_id_snapshot IS NULL OR age_group_label_snapshot IS NULL;
  `);

  // Ensure seeded demo accounts are marked verified & onboarded
  db.exec(`
    UPDATE users
    SET email_verified_at = COALESCE(email_verified_at, created_at),
        onboarding_completed_at = COALESCE(onboarding_completed_at, created_at)
    WHERE id IN ('usr_parent_meera', 'usr_reviewer_ananya', 'usr_admin_kavita');
  `);

  // Backfill initial immutable version snapshots for existing activities that do not yet have one
  const unversionedActivities = db
    .prepare(
      `SELECT a.*
       FROM activities a
       WHERE NOT EXISTS (
         SELECT 1 FROM activity_versions av WHERE av.activity_id = a.id
       )`
    )
    .all() as Array<{
    id: string;
    age_group_id: string;
    domain_id: string;
    title: string;
    summary: string;
    objectives_json: string | null;
    duration_minutes: number;
    prep_level: string | null;
    materials_json: string;
    safety_notes: string;
    instructional_poster_url: string;
    instructional_video_url: string | null;
    status: string;
    version: number | null;
    created_by: string | null;
    created_at: string;
  }>;

  if (unversionedActivities.length > 0) {
    const insertVersion = db.prepare(
      `INSERT OR IGNORE INTO activity_versions (
         id, activity_id, version_number, snapshot_json, change_note, created_by, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const backfillTx = db.transaction(() => {
      for (const act of unversionedActivities) {
        const steps = db
          .prepare(
            'SELECT step_number, title, instruction_text, caregiver_tip FROM activity_steps WHERE activity_id = ? ORDER BY step_number ASC'
          )
          .all(act.id);
        const rubric = db
          .prepare(
            'SELECT criterion_order, label, description, weight_points FROM activity_rubric_criteria WHERE activity_id = ? ORDER BY criterion_order ASC'
          )
          .all(act.id);
        const snapshot = {
          title: act.title,
          summary: act.summary,
          ageGroupId: act.age_group_id,
          domainId: act.domain_id,
          objectives: JSON.parse(act.objectives_json || '[]'),
          durationMinutes: act.duration_minutes,
          prepLevel: act.prep_level || 'quick_setup',
          materials: JSON.parse(act.materials_json || '[]'),
          safetyNotes: act.safety_notes,
          instructionalPosterUrl: act.instructional_poster_url,
          instructionalVideoUrl: act.instructional_video_url ?? null,
          status: act.status,
          steps,
          rubricCriteria: rubric,
        };
        insertVersion.run(
          `av_${act.id}_v${act.version ?? 1}`,
          act.id,
          act.version ?? 1,
          JSON.stringify(snapshot),
          'Initial curriculum version',
          act.created_by,
          act.created_at
        );
      }
    });
    backfillTx();
  }
}

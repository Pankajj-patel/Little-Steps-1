export type UserRole = 'parent' | 'reviewer' | 'admin';

export type LocaleCode = 'en' | 'hi';

export type ActivityStatus = 'draft' | 'published' | 'archived';

export type CompletionStatus =
  | 'started'
  | 'completed'
  | 'submitted_for_review'
  | 'reviewed';

export type SubmissionReviewStatus =
  | 'queued'
  | 'in_review'
  | 'reviewed'
  | 'resubmit_requested'
  | 'deleted';

export type RubricAchievementLevel =
  | 'met'
  | 'partially_met'
  | 'not_met'
  | 'not_observed'
  | 'not_assessable';

export type ReviewPublicationStatus = 'draft' | 'published';

export type QueuePriority = 'high' | 'normal' | 'low';

export type MediaAuditAction =
  | 'upload'
  | 'stream'
  | 'review_open'
  | 'parent_delete'
  | 'admin_delete'
  | 'auto_purge';

export type PreferredActivityTime = 'morning' | 'afternoon' | 'evening' | 'flexible';

export type NotificationPreference = 'daily_gentle' | 'weekly_summary' | 'none';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string | null;
  role: UserRole;
  preferredLocale: LocaleCode;
  profilePhotoUrl: string | null;
  preferredActivityTime: PreferredActivityTime;
  notificationPreference: NotificationPreference;
  emailVerifiedAt: string | null;
  onboardingCompletedAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface AgeGroup {
  id: string;
  slug: string;
  label: string;
  minMonths: number;
  maxMonths: number;
  sortOrder: number;
}

export interface LearningDomain {
  id: string;
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
}

export interface ChildProfile {
  id: string;
  parentUserId: string;
  displayName: string;
  dateOfBirth: string;
  profilePhotoUrl: string | null;
  activityPreferences: string | null;
  activeAgeGroupId: string;
  ageGroupLabel: string;
  ageGroupSlug: string;
  ageInMonths: number;
  createdAt: string;
}

export interface ActivityStep {
  id: string;
  activityId: string;
  stepNumber: number;
  title: string;
  instructionText: string;
  caregiverTip: string | null;
}

export interface ActivityRubricCriterion {
  id: string;
  activityId: string;
  criterionOrder: number;
  label: string;
  description: string;
  weightPoints: number;
}

export type ActivityPrepLevel = 'no_prep' | 'quick_setup' | 'guided_prep';

export type JourneyDisplayStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'submitted_for_review'
  | 'reviewed';

export interface ActivitySummary {
  id: string;
  ageGroupId: string;
  ageGroupSlug: string;
  ageGroupLabel: string;
  domainId: string;
  domainSlug: string;
  domainName: string;
  title: string;
  summary: string;
  objectives: string[];
  durationMinutes: number;
  prepLevel: ActivityPrepLevel;
  version: number;
  materials: string[];
  safetyNotes: string;
  instructionalPosterUrl: string;
  instructionalVideoUrl: string | null;
  status: ActivityStatus;
  createdAt: string;
}

export interface ActivityDetail extends ActivitySummary {
  steps: ActivityStep[];
  rubricCriteria: ActivityRubricCriterion[];
}

export interface ActivityVersionSnapshot {
  id: string;
  activityId: string;
  versionNumber: number;
  changeNote: string | null;
  createdBy: string | null;
  createdByName: string;
  createdAt: string;
  linkedSubmissionsCount: number;
  snapshot: {
    title: string;
    summary: string;
    ageGroupId: string;
    domainId: string;
    objectives: string[];
    durationMinutes: number;
    prepLevel: ActivityPrepLevel;
    materials: string[];
    safetyNotes: string;
    instructionalPosterUrl: string;
    instructionalVideoUrl: string | null;
    status: ActivityStatus;
    steps: Array<{
      stepNumber: number;
      title: string;
      instructionText: string;
      caregiverTip: string | null;
    }>;
    rubricCriteria: Array<{
      criterionOrder: number;
      label: string;
      description: string;
      weightPoints: number;
    }>;
  };
}

export interface ReviewRubricScoreDetail {
  id: string;
  criterionId: string;
  criterionLabel: string;
  criterionDescription: string;
  achievedLevel: RubricAchievementLevel;
  earnedPoints: number;
  maxPoints: number;
  explanation: string | null;
}

export type ReviewAuditAction =
  | 'draft_saved'
  | 'published'
  | 'updated'
  | 'marked_not_assessable'
  | 'changes_requested';

export interface ReviewHistoryEntry {
  id: string;
  submissionId: string;
  reviewId: string | null;
  actorUserId: string;
  actorName: string;
  actorRole: string;
  action: ReviewAuditAction;
  version: number;
  scorePct: number | null;
  isAssessable: boolean;
  summaryNote: string;
  createdAt: string;
}

export interface SubmissionReviewDetail {
  id: string;
  submissionId: string;
  reviewerUserId: string;
  reviewerName: string;
  reviewStatus: ReviewPublicationStatus;
  version: number;
  isAssessable: boolean;
  notAssessableReason: string | null;
  instructionMatchScorePct: number | null;
  applicableWeightPoints: number;
  earnedWeightPoints: number;
  strengthsNote: string;
  coachingTip: string;
  reviewerComments: string | null;
  evaluationScopeAcknowledgedAt: string;
  submittedAt: string;
  rubricScores: ReviewRubricScoreDetail[];
}

export type VideoStorageMode = 'demo_local_vault' | 'production_object_storage';

export interface VideoStorageStatusResponse {
  mode: VideoStorageMode;
  providerLabel: string;
  isProductionConfigured: boolean;
  maxSizeBytes: number;
  maxDurationSeconds: number;
  allowedMimeTypes: string[];
  retentionDays: number;
  warningNotice: string | null;
}

export interface VideoSubmissionSummary {
  id: string;
  completionId: string;
  parentUserId: string;
  childId: string;
  activityId: string;
  activityVersion: number;
  activityTitle: string;
  domainName: string;
  ageGroupLabel: string;
  mimeType: string;
  fileSizeBytes: number;
  durationSeconds: number;
  reviewStatus: SubmissionReviewStatus;
  hasActiveVideo: boolean;
  storageReference: string | null;
  storageMode: VideoStorageMode;
  consentRecordId: string | null;
  consentGrantedAt: string | null;
  changeRequestNote: string | null;
  expiresAt: string;
  deletedAt: string | null;
  deletionReason: string | null;
  caregiverNotes: string | null;
  createdAt: string;
  review: SubmissionReviewDetail | null;
}

export interface JourneyActivityItem {
  planItemId: string;
  sortOrder: number;
  activity: ActivityDetail;
  displayStatus: JourneyDisplayStatus;
  completion: {
    id: string;
    status: CompletionStatus;
    caregiverNotes: string | null;
    completedAt: string | null;
  } | null;
  latestSubmission: VideoSubmissionSummary | null;
}

export interface UpcomingPlanDay {
  dayNumber: number;
  title: string;
  focusNote: string;
  scheduledDate: string;
  activities: ActivitySummary[];
}

export interface CompletedHistoryItem {
  completionId: string;
  activityId: string;
  activityTitle: string;
  domainName: string;
  domainSlug: string;
  durationMinutes: number;
  prepLevel: ActivityPrepLevel;
  planDate: string;
  completedAt: string;
  caregiverNotes: string | null;
  ageGroupIdSnapshot: string;
  ageGroupLabelSnapshot: string;
  displayStatus: JourneyDisplayStatus;
  reviewScorePct: number | null;
}

export interface DomainProgressStat {
  domainId: string;
  domainSlug: string;
  domainName: string;
  completedCount: number;
  availableCount: number;
}

export interface WeeklyProgressDay {
  date: string;
  dayLabel: string;
  completedCount: number;
  isToday: boolean;
}

export interface LastActivityResume {
  activity: ActivityDetail;
  status: CompletionStatus;
  displayStatus: JourneyDisplayStatus;
  updatedAt: string;
}

export interface ParentingTip {
  id: string;
  ageGroupSlug: string;
  title: string;
  body: string;
  focusArea: string;
}

export interface ParentNotificationItem {
  id: string;
  kind: 'review_ready' | 'submission_queued' | 'email_verify' | 'daily_rhythm';
  title: string;
  description: string;
  createdAt: string;
  actionLabel?: string;
  targetSection?: 'today' | 'my-plan' | 'activities' | 'progress' | 'verify-email';
}

export interface TodayJourneyResponse {
  child: ChildProfile;
  learningWeek: {
    weekNumber: number;
    totalStageWeeks: number;
    stageLabel: string;
    todayDateIso: string;
  };
  availableDays: Array<{ dayNumber: number; title: string; focusNote: string }>;
  selectedDay: {
    id: string;
    dayNumber: number;
    title: string;
    focusNote: string;
  };
  todaySummary: {
    completedTodayCount: number;
    totalTodayCount: number;
    completionPct: number;
  };
  items: JourneyActivityItem[];
  upcomingDays: UpcomingPlanDay[];
  inProgressItems: JourneyActivityItem[];
  completedHistory: CompletedHistoryItem[];
  weeklyProgress: WeeklyProgressDay[];
  domainProgress: DomainProgressStat[];
  lastActivity: LastActivityResume | null;
  parentingTip: ParentingTip;
  notifications: ParentNotificationItem[];
  recentSubmissions: VideoSubmissionSummary[];
}

export type ActivityHistoryReviewFilter =
  | 'all'
  | 'none'
  | 'queued'
  | 'in_review'
  | 'resubmit_requested'
  | 'reviewed';

export interface ActivityHistoryRecord {
  completionId: string;
  activityId: string;
  activityTitle: string;
  activitySummary: string;
  domainId: string;
  domainSlug: string;
  domainName: string;
  ageGroupIdSnapshot: string;
  ageGroupLabelSnapshot: string;
  durationMinutes: number;
  prepLevel: ActivityPrepLevel;
  planDate: string;
  activityDate: string;
  completionStatus: CompletionStatus;
  displayStatus: JourneyDisplayStatus;
  caregiverNotes: string | null;
  submission: VideoSubmissionSummary | null;
}

export interface WeeklyConsistencyBucket {
  weekLabel: string;
  startDate: string;
  endDate: string;
  activeDays: number;
  completedCount: number;
}

export interface ParentProgressOverviewResponse {
  child: ChildProfile;
  summary: {
    activitiesCompletedStage: number;
    activitiesRemainingStage: number;
    totalStageActivities: number;
    totalCompletionsAllTime: number;
    activeDaysThisWeek: number;
    weeklyConsistencyPct: number;
    submittedVideosCount: number;
    reviewedActivitiesCount: number;
    pendingReviewsCount: number;
  };
  weeklyDailyBars: WeeklyProgressDay[];
  weeklyConsistencyTrend: WeeklyConsistencyBucket[];
  domainProgress: DomainProgressStat[];
  activityHistory: ActivityHistoryRecord[];
  reviewHistory: VideoSubmissionSummary[];
}

export interface ReviewerQueueItem {
  submissionId: string;
  parentReference: string;
  activityId: string;
  activityVersion: number;
  activityTitle: string;
  domainName: string;
  ageGroupSlug: string;
  ageGroupLabel: string;
  reviewStatus: SubmissionReviewStatus;
  priority: QueuePriority;
  assignedReviewerId: string | null;
  assignedReviewerName: string | null;
  hasActiveVideo: boolean;
  hasDraftReview: boolean;
  isAssessable: boolean | null;
  durationSeconds: number;
  expiresAt: string;
  createdAt: string;
  instructionMatchScorePct: number | null;
}

export interface ReviewerDashboardSummary {
  totalPending: number;
  underReview: number;
  completedReviews: number;
  changesRequested: number;
  recentSubmissions: ReviewerQueueItem[];
}

export interface ReviewerSubmissionDetail {
  submission: ReviewerQueueItem & {
    caregiverNotes: string | null;
    changeRequestNote: string | null;
    storageMode: VideoStorageMode;
    storageReference: string | null;
    deletedAt: string | null;
    deletionReason: string | null;
  };
  activity: ActivityDetail;
  review: SubmissionReviewDetail | null;
  history: ReviewHistoryEntry[];
}

export interface MediaAuditLogItem {
  id: string;
  actorUserId: string | null;
  actorName: string;
  actorRole: string;
  submissionId: string;
  action: MediaAuditAction;
  createdAt: string;
}

export type UnifiedAuditCategory = 'admin' | 'review' | 'media';

export interface UnifiedAuditLogItem {
  id: string;
  category: UnifiedAuditCategory;
  actorUserId: string | null;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  createdAt: string;
}

export interface AdminAgeGroupItem extends AgeGroup {
  activityCount: number;
  publishedActivityCount: number;
  childrenCount: number;
}

export interface AdminDomainItem extends LearningDomain {
  activityCount: number;
  publishedActivityCount: number;
}

export interface AdminReviewerItem {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  allowedAgeGroupSlugs: string[];
  specialtyNote: string | null;
  completedReviewsCount: number;
  activeAssignedCount: number;
  createdAt: string;
}

export interface AdminSubmissionItem {
  submissionId: string;
  parentReference: string;
  activityId: string;
  activityTitle: string;
  activityVersion: number;
  domainName: string;
  ageGroupSlug: string;
  ageGroupLabel: string;
  reviewStatus: SubmissionReviewStatus;
  assignedReviewerId: string | null;
  assignedReviewerName: string | null;
  hasActiveVideo: boolean;
  storageMode: VideoStorageMode;
  isAssessable: boolean | null;
  instructionMatchScorePct: number | null;
  durationSeconds: number;
  expiresAt: string;
  deletedAt: string | null;
  deletionReason: string | null;
  createdAt: string;
}

export interface AdminUserItem extends UserProfile {
  childrenCount: number;
  submissionsCount: number;
  completedReviewsCount: number;
  allowedAgeGroupSlugs: string[];
  specialtyNote: string | null;
}

export interface AdminOverviewResponse {
  counts: {
    totalActivities: number;
    publishedActivities: number;
    draftActivities: number;
    archivedActivities: number;
    totalParents: number;
    totalChildren: number;
    totalReviewers: number;
    pendingReviews: number;
    completedReviews: number;
    queuedSubmissions: number;
    activeVideosCount: number;
    expiredPurgedCount: number;
  };
  coverageMatrix: Array<{
    ageGroupId: string;
    ageGroupSlug: string;
    ageGroupLabel: string;
    domainCounts: Record<string, number>;
  }>;
  recentActivity: UnifiedAuditLogItem[];
  lastRetentionSweepAt: string | null;
}

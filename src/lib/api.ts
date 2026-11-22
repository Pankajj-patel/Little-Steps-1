import type {
  ActivityDetail,
  ActivityHistoryReviewFilter,
  ActivityPrepLevel,
  ActivityStatus,
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
  JourneyDisplayStatus,
  LearningDomain,
  LocaleCode,
  MediaAuditLogItem,
  NotificationPreference,
  ParentNotificationItem,
  ParentProgressOverviewResponse,
  PreferredActivityTime,
  ReviewerDashboardSummary,
  ReviewerQueueItem,
  ReviewerSubmissionDetail,
  RubricAchievementLevel,
  SubmissionReviewDetail,
  SubmissionReviewStatus,
  TodayJourneyResponse,
  UnifiedAuditCategory,
  UnifiedAuditLogItem,
  UserProfile,
  UserRole,
  VideoStorageStatusResponse,
  VideoSubmissionSummary,
} from '../shared/types';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Kept strictly in JS memory (never localStorage/sessionStorage) so auth works reliably
// inside cross-site preview iframes even when third-party cookies are blocked by the browser.
let inMemorySessionToken: string | null = null;

export function setInMemorySessionToken(token: string | null): void {
  inMemorySessionToken = token;
}

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'LittleSteps',
      ...(inMemorySessionToken ? { Authorization: `Bearer ${inMemorySessionToken}` } : {}),
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) {
    throw new ApiError(data.error || `Request failed (${res.status})`, res.status);
  }
  return data;
}

export const api = {
  // Meta & Public Contact
  getCurriculumMeta: () =>
    requestJson<{ ageGroups: AgeGroup[]; learningDomains: LearningDomain[] }>(
      '/api/v1/curriculum/meta'
    ),
  submitContactInquiry: (payload: {
    fullName: string;
    email: string;
    topic: string;
    message: string;
  }) =>
    requestJson<{ inquiry: { id: string; createdAt: string } }>('/api/v1/contact', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Auth
  me: () => requestJson<{ user: UserProfile }>('/api/v1/auth/me'),
  login: async (email: string, password: string, portalRole?: UserRole) => {
    const res = await requestJson<{ user: UserProfile; sessionToken?: string }>(
      '/api/v1/auth/login',
      {
        method: 'POST',
        body: JSON.stringify(portalRole ? { email, password, portalRole } : { email, password }),
      }
    );
    if (res.sessionToken) {
      inMemorySessionToken = res.sessionToken;
    }
    return { user: res.user };
  },
  register: async (payload: {
    email: string;
    password: string;
    fullName: string;
    phoneNumber?: string;
    preferredLocale?: LocaleCode;
  }) => {
    const res = await requestJson<{
      user: UserProfile;
      sessionToken?: string;
      verificationPreviewPath?: string;
    }>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.sessionToken) {
      inMemorySessionToken = res.sessionToken;
    }
    return { user: res.user, verificationPreviewPath: res.verificationPreviewPath };
  },
  logout: async () => {
    try {
      return await requestJson<{ ok: boolean }>('/api/v1/auth/logout', { method: 'POST' });
    } finally {
      inMemorySessionToken = null;
    }
  },
  forgotPassword: (email: string) =>
    requestJson<{ message: string; resetPreviewPath?: string }>('/api/v1/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, newPassword: string) =>
    requestJson<{ ok: boolean; message: string }>('/api/v1/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    }),
  verifyEmail: (token: string) =>
    requestJson<{ ok: boolean; user: UserProfile | null }>('/api/v1/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
  resendVerification: () =>
    requestJson<{
      alreadyVerified?: boolean;
      message: string;
      verificationPreviewPath?: string;
    }>('/api/v1/auth/resend-verification', {
      method: 'POST',
    }),

  // Profile Photos & Parent Onboarding
  uploadProfilePhoto: async (file: File): Promise<{ photoUrl: string }> => {
    const formData = new FormData();
    formData.append('photo', file);
    const res = await fetch('/api/v1/profile/photo', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'X-Requested-With': 'LittleSteps',
        ...(inMemorySessionToken ? { Authorization: `Bearer ${inMemorySessionToken}` } : {}),
      },
      body: formData,
    });
    const data = (await res.json().catch(() => ({}))) as { photoUrl?: string; error?: string };
    if (!res.ok || !data.photoUrl) {
      throw new ApiError(data.error || 'Unable to upload photo.', res.status);
    }
    return { photoUrl: data.photoUrl };
  },
  saveOnboardingParent: (payload: {
    fullName: string;
    email: string;
    preferredLocale: LocaleCode;
    profilePhotoUrl?: string | null;
  }) =>
    requestJson<{ user: UserProfile; verificationPreviewPath?: string }>(
      '/api/v1/onboarding/parent',
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    ),
  completeOnboarding: (payload: {
    preferredActivityTime: PreferredActivityTime;
    notificationPreference: NotificationPreference;
    preferredLocale: LocaleCode;
    markComplete?: boolean;
  }) =>
    requestJson<{ user: UserProfile }>('/api/v1/onboarding/complete', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Children
  listChildren: () => requestJson<{ children: ChildProfile[] }>('/api/v1/children'),
  createChild: (
    displayName: string,
    dateOfBirth: string,
    options?: { profilePhotoUrl?: string | null; activityPreferences?: string | null }
  ) =>
    requestJson<{ child: ChildProfile }>('/api/v1/children', {
      method: 'POST',
      body: JSON.stringify({
        displayName,
        dateOfBirth,
        profilePhotoUrl: options?.profilePhotoUrl ?? null,
        activityPreferences: options?.activityPreferences ?? null,
      }),
    }),
  updateChild: (
    id: string,
    displayName: string,
    dateOfBirth: string,
    options?: { profilePhotoUrl?: string | null; activityPreferences?: string | null }
  ) =>
    requestJson<{ child: ChildProfile }>(`/api/v1/children/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        displayName,
        dateOfBirth,
        profilePhotoUrl: options?.profilePhotoUrl,
        activityPreferences: options?.activityPreferences,
      }),
    }),
  deleteChild: (id: string) =>
    requestJson<{ ok: boolean }>(`/api/v1/children/${id}`, { method: 'DELETE' }),

  // Parent Journey & Published Activities Library
  listPublishedActivities: (ageGroupId?: string, domainId?: string) => {
    const qs = new URLSearchParams();
    if (ageGroupId && ageGroupId !== 'all') qs.set('ageGroupId', ageGroupId);
    if (domainId && domainId !== 'all') qs.set('domainId', domainId);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return requestJson<{ activities: ActivitySummary[] }>(`/api/v1/activities${suffix}`);
  },
  getPublishedActivityDetail: (id: string) =>
    requestJson<{ activity: ActivityDetail }>(`/api/v1/activities/${id}`),
  getTodayJourney: (childId: string, dayNumber?: number) => {
    const query = dayNumber ? `?day=${dayNumber}` : '';
    return requestJson<TodayJourneyResponse>(`/api/v1/journey/${childId}/today${query}`);
  },
  getParentProgress: (
    childId: string,
    filters?: {
      dateFrom?: string;
      dateTo?: string;
      domainId?: string;
      completionStatus?: JourneyDisplayStatus | 'all';
      reviewStatus?: ActivityHistoryReviewFilter;
    }
  ) => {
    const qs = new URLSearchParams();
    if (filters?.dateFrom) qs.set('dateFrom', filters.dateFrom);
    if (filters?.dateTo) qs.set('dateTo', filters.dateTo);
    if (filters?.domainId && filters.domainId !== 'all') qs.set('domainId', filters.domainId);
    if (filters?.completionStatus && filters.completionStatus !== 'all') {
      qs.set('completionStatus', filters.completionStatus);
    }
    if (filters?.reviewStatus && filters.reviewStatus !== 'all') {
      qs.set('reviewStatus', filters.reviewStatus);
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return requestJson<ParentProgressOverviewResponse>(
      `/api/v1/progress/${encodeURIComponent(childId)}${suffix}`
    );
  },
  saveCompletion: (payload: {
    childId: string;
    activityId: string;
    status: 'started' | 'completed';
    caregiverNotes?: string;
  }) =>
    requestJson<{ completion: { id: string; status: string } }>('/api/v1/completions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Parent Notifications (Persisted Read State)
  listNotifications: (childId?: string) => {
    const query = childId ? `?childId=${encodeURIComponent(childId)}` : '';
    return requestJson<{ notifications: ParentNotificationItem[]; unreadCount: number }>(
      `/api/v1/notifications${query}`
    );
  },
  markNotificationRead: (notificationId: string) =>
    requestJson<{ ok: boolean }>(
      `/api/v1/notifications/${encodeURIComponent(notificationId)}/read`,
      { method: 'POST' }
    ),
  markAllNotificationsRead: (childId?: string) =>
    requestJson<{ ok: boolean; markedCount: number }>('/api/v1/notifications/read-all', {
      method: 'POST',
      body: JSON.stringify(childId ? { childId } : {}),
    }),

  // Submissions & Private Video Streaming
  getVideoStorageStatus: () =>
    requestJson<VideoStorageStatusResponse>('/api/v1/submissions/storage-status'),

  uploadSubmissionVideo: (
    params: {
      childId: string;
      activityId: string;
      file: Blob;
      filename: string;
      durationSeconds: number;
      caregiverNotes: string;
      consentConfirmed: boolean;
    },
    onProgress?: (percent: number) => void,
    signal?: AbortSignal
  ): Promise<{ submission: VideoSubmissionSummary; storageStatus?: VideoStorageStatusResponse }> =>
    new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new ApiError('Upload cancelled.', 499));
        return;
      }

      const formData = new FormData();
      formData.append('video', params.file, params.filename);
      formData.append('childId', params.childId);
      formData.append('activityId', params.activityId);
      formData.append('durationSeconds', String(params.durationSeconds));
      formData.append('caregiverNotes', params.caregiverNotes);
      formData.append('consentConfirmed', params.consentConfirmed ? 'true' : 'false');

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/v1/submissions', true);
      xhr.withCredentials = true;
      xhr.setRequestHeader('X-Requested-With', 'LittleSteps');
      if (inMemorySessionToken) {
        xhr.setRequestHeader('Authorization', `Bearer ${inMemorySessionToken}`);
      }

      const handleAbort = () => {
        xhr.abort();
      };
      signal?.addEventListener('abort', handleAbort, { once: true });

      const cleanup = () => {
        signal?.removeEventListener('abort', handleAbort);
      };

      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable && onProgress) {
          onProgress(Math.min(99, Math.round((ev.loaded / ev.total) * 100)));
        }
      };

      xhr.onload = () => {
        cleanup();
        try {
          const parsed = JSON.parse(xhr.responseText || '{}') as {
            submission?: VideoSubmissionSummary;
            storageStatus?: VideoStorageStatusResponse;
            error?: string;
          };
          if (xhr.status >= 200 && xhr.status < 300 && parsed.submission) {
            onProgress?.(100);
            resolve({ submission: parsed.submission, storageStatus: parsed.storageStatus });
          } else {
            reject(new ApiError(parsed.error || 'Upload failed. Please try again.', xhr.status));
          }
        } catch {
          reject(new ApiError('Unexpected server response during upload.', xhr.status));
        }
      };
      xhr.onabort = () => {
        cleanup();
        reject(new ApiError('Upload cancelled. Your clip is still ready if you want to retry.', 499));
      };
      xhr.onerror = () => {
        cleanup();
        reject(new ApiError('Network error while uploading video. Please check your connection and retry.', 0));
      };
      xhr.send(formData);
    }),

  getVideoStreamToken: (submissionId: string) =>
    requestJson<{ streamUrl: string; expiresAt: string }>(
      `/api/v1/submissions/${submissionId}/stream-token`
    ),

  deleteSubmissionVideo: (submissionId: string) =>
    requestJson<{ ok: boolean; deletedAt: string }>(`/api/v1/submissions/${submissionId}/video`, {
      method: 'DELETE',
    }),

  // Reviewer
  getReviewerQueue: (
    status: SubmissionReviewStatus | 'all',
    ageGroupSlug: string,
    mineOnly = false
  ) =>
    requestJson<{
      summary: ReviewerDashboardSummary;
      queue: ReviewerQueueItem[];
      allowedAgeGroupSlugs?: string[];
    }>(
      `/api/v1/reviewer/queue?status=${encodeURIComponent(status)}&ageGroupSlug=${encodeURIComponent(ageGroupSlug)}${mineOnly ? '&mine=true' : ''}`
    ),
  claimSubmission: (submissionId: string) =>
    requestJson<ReviewerSubmissionDetail>(`/api/v1/reviewer/submissions/${submissionId}/claim`, {
      method: 'POST',
    }),
  getReviewerSubmissionDetail: (submissionId: string) =>
    requestJson<ReviewerSubmissionDetail>(`/api/v1/reviewer/submissions/${submissionId}`),
  submitReview: (
    submissionId: string,
    payload: {
      mode?: 'draft' | 'publish' | 'not_assessable';
      strengthsNote?: string;
      coachingTip?: string;
      reviewerComments?: string | null;
      notAssessableReason?: string | null;
      evaluationScopeAcknowledged: boolean;
      criterionRatings: Array<{
        criterionId: string;
        achievedLevel: RubricAchievementLevel;
        explanation?: string | null;
      }>;
    }
  ) =>
    requestJson<{ review: SubmissionReviewDetail; detail?: ReviewerSubmissionDetail | null }>(
      `/api/v1/reviewer/submissions/${submissionId}/review`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),
  requestSubmissionChanges: (submissionId: string, note: string) =>
    requestJson<{ ok: boolean; detail: ReviewerSubmissionDetail | null }>(
      `/api/v1/reviewer/submissions/${submissionId}/request-changes`,
      {
        method: 'POST',
        body: JSON.stringify({ note }),
      }
    ),

  // Admin
  getAdminOverview: () => requestJson<AdminOverviewResponse>('/api/v1/admin/overview'),

  // Age Groups
  getAdminAgeGroups: () => requestJson<{ ageGroups: AdminAgeGroupItem[] }>('/api/v1/admin/age-groups'),
  saveAdminAgeGroup: (
    id: string | null,
    payload: { slug: string; label: string; minMonths: number; maxMonths: number; sortOrder: number }
  ) =>
    requestJson<{ ageGroup: AdminAgeGroupItem }>(
      id ? `/api/v1/admin/age-groups/${id}` : '/api/v1/admin/age-groups',
      {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      }
    ),

  // Domains
  getAdminDomains: () => requestJson<{ domains: AdminDomainItem[] }>('/api/v1/admin/domains'),
  saveAdminDomain: (
    id: string | null,
    payload: { slug: string; name: string; description: string; sortOrder: number }
  ) =>
    requestJson<{ domain: AdminDomainItem }>(
      id ? `/api/v1/admin/domains/${id}` : '/api/v1/admin/domains',
      {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      }
    ),

  // Activities
  getAdminActivities: (ageGroupId?: string, domainId?: string, status?: ActivityStatus) => {
    const qs = new URLSearchParams();
    if (ageGroupId) qs.set('ageGroupId', ageGroupId);
    if (domainId) qs.set('domainId', domainId);
    if (status) qs.set('status', status);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return requestJson<{ activities: ActivitySummary[] }>(`/api/v1/admin/activities${suffix}`);
  },
  getAdminActivityDetail: (id: string) =>
    requestJson<{ activity: ActivityDetail }>(`/api/v1/admin/activities/${id}`),
  getAdminActivityVersions: (id: string) =>
    requestJson<{ versions: ActivityVersionSnapshot[] }>(`/api/v1/admin/activities/${id}/versions`),
  saveAdminActivity: (
    id: string | null,
    payload: {
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
  ) =>
    requestJson<{ activity: ActivityDetail }>(
      id ? `/api/v1/admin/activities/${id}` : '/api/v1/admin/activities',
      {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      }
    ),
  updateAdminActivityStatus: (id: string, status: ActivityStatus) =>
    requestJson<{ activity: ActivityDetail }>(`/api/v1/admin/activities/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  deleteAdminActivity: (id: string) =>
    requestJson<{ ok: boolean }>(`/api/v1/admin/activities/${id}`, { method: 'DELETE' }),

  // Daily Plans
  getAdminDailyPlans: (ageGroupId: string) =>
    requestJson<{
      plans: Array<{
        id: string;
        ageGroupId: string;
        dayNumber: number;
        title: string;
        focusNote: string;
        activityIds: string[];
      }>;
      activities: ActivitySummary[];
    }>(`/api/v1/admin/daily-plans?ageGroupId=${encodeURIComponent(ageGroupId)}`),
  saveAdminDailyPlan: (payload: {
    ageGroupId: string;
    dayNumber: number;
    title: string;
    focusNote: string;
    activityIds: string[];
  }) =>
    requestJson<{
      plans: Array<{
        id: string;
        ageGroupId: string;
        dayNumber: number;
        title: string;
        focusNote: string;
        activityIds: string[];
      }>;
    }>('/api/v1/admin/daily-plans', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteAdminDailyPlan: (id: string) =>
    requestJson<{ ok: boolean }>(`/api/v1/admin/daily-plans/${id}`, { method: 'DELETE' }),

  // Reviewers
  getAdminReviewers: () => requestJson<{ reviewers: AdminReviewerItem[] }>('/api/v1/admin/reviewers'),
  createAdminReviewer: (payload: {
    email: string;
    fullName: string;
    password: string;
    allowedAgeGroupSlugs?: string[];
    specialtyNote?: string | null;
  }) =>
    requestJson<{ reviewer: AdminReviewerItem }>('/api/v1/admin/reviewers', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateAdminReviewer: (
    id: string,
    updates: {
      isActive?: boolean;
      allowedAgeGroupSlugs?: string[];
      specialtyNote?: string | null;
    }
  ) =>
    requestJson<{ reviewer: AdminReviewerItem }>(`/api/v1/admin/reviewers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  // Submissions
  getAdminSubmissions: (filters?: {
    status?: SubmissionReviewStatus | 'all';
    reviewerId?: string;
    search?: string;
  }) => {
    const qs = new URLSearchParams();
    if (filters?.status && filters.status !== 'all') qs.set('status', filters.status);
    if (filters?.reviewerId && filters.reviewerId !== 'all') qs.set('reviewerId', filters.reviewerId);
    if (filters?.search) qs.set('search', filters.search);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return requestJson<{ submissions: AdminSubmissionItem[] }>(`/api/v1/admin/submissions${suffix}`);
  },
  assignAdminSubmissionReviewer: (submissionId: string, reviewerUserId: string | null) =>
    requestJson<{ submission: AdminSubmissionItem }>(`/api/v1/admin/submissions/${submissionId}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ reviewerUserId }),
    }),

  // Users
  getAdminUsers: () => requestJson<{ users: AdminUserItem[] }>('/api/v1/admin/users'),
  updateAdminUser: (id: string, updates: { role?: UserRole; isActive?: boolean }) =>
    requestJson<{ user: AdminUserItem }>(`/api/v1/admin/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  // Audit Logs & Retention
  getAdminAuditLogs: (filters?: { category?: UnifiedAuditCategory | 'all'; limit?: number }) => {
    const qs = new URLSearchParams();
    if (filters?.category && filters.category !== 'all') qs.set('category', filters.category);
    if (filters?.limit) qs.set('limit', String(filters.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return requestJson<{ logs: UnifiedAuditLogItem[]; lastRetentionSweepAt: string | null }>(
      `/api/v1/admin/audit-logs${suffix}`
    );
  },
  runAdminRetentionSweep: () =>
    requestJson<{ purgedCount: number; sweptAt: string }>('/api/v1/admin/retention/run', {
      method: 'POST',
    }),
};

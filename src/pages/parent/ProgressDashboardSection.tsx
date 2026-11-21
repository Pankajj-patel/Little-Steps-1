import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Filter,
  History,
  Info,
  RotateCcw,
  Sparkles,
  Trash2,
  Video,
} from 'lucide-react';
import progressJourneyIllustration from '../../assets/images/progress_journey_illustration_1795236568060.jpg';
import { SecureVideoPlayer } from '../../components/SecureVideoPlayer';
import {
  Button,
  Card,
  ConfirmDialog,
  DatePicker,
  EmptyState,
  Modal,
  ProgressIndicator,
  Select,
  SkeletonCard,
  useToast,
} from '../../design-system';
import { api } from '../../lib/api';
import { formatDaysUntilExpiry } from '../../shared/domain';
import { formatDateReadable } from '../../shared/i18n';
import type {
  ActivityHistoryRecord,
  ActivityHistoryReviewFilter,
  JourneyDisplayStatus,
  LearningDomain,
  LocaleCode,
  ParentProgressOverviewResponse,
  SubmissionReviewDetail,
  TodayJourneyResponse,
  VideoSubmissionSummary,
} from '../../shared/types';
import { formatPrepLevel } from './MyPlanSection';

interface ProgressDashboardSectionProps {
  journey: TodayJourneyResponse;
  learningDomains: LearningDomain[];
  locale: LocaleCode;
  nonDiagnosticTitle: string;
  nonDiagnosticBody: string;
  onRefreshJourney: () => Promise<void>;
  onExploreDomain: (domainId: string) => void;
  onOpenActivity: (activityId: string) => void;
  onGoToday: () => void;
}

type ProgressTab = 'overview' | 'activity-history' | 'review-history';
type DateRangePreset = 'all' | '7d' | '30d' | 'custom';

function getIsoDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function getCompletionLabel(status: JourneyDisplayStatus): { text: string; toneClass: string } {
  switch (status) {
    case 'reviewed':
      return { text: 'Reviewed', toneClass: 'text-sage font-medium' };
    case 'submitted_for_review':
      return { text: 'Submitted for review', toneClass: 'text-lavender-ink font-medium' };
    case 'completed':
      return { text: 'Completed', toneClass: 'text-sage font-medium' };
    case 'in_progress':
      return { text: 'In progress', toneClass: 'text-peach-ink font-medium' };
    case 'not_started':
    default:
      return { text: 'Not started', toneClass: 'text-muted font-medium' };
  }
}

function getReviewStatusSummary(sub: VideoSubmissionSummary | null): {
  text: string;
  toneClass: string;
} {
  if (!sub || sub.reviewStatus === 'deleted') {
    return { text: 'No video submitted', toneClass: 'text-muted' };
  }
  if (sub.review) {
    if (sub.review.isAssessable && sub.review.instructionMatchScorePct !== null) {
      return {
        text: `Reviewed · ${sub.review.instructionMatchScorePct}% match`,
        toneClass: 'text-sage font-medium',
      };
    }
    return { text: 'Reviewed · Not Assessable', toneClass: 'text-peach-ink font-medium' };
  }
  if (sub.reviewStatus === 'in_review') {
    return { text: 'Under review', toneClass: 'text-peach-ink font-medium' };
  }
  if (sub.reviewStatus === 'resubmit_requested') {
    return { text: 'Changes requested', toneClass: 'text-peach-ink font-medium' };
  }
  return { text: 'Pending review', toneClass: 'text-lavender-ink font-medium' };
}

function ReviewFeedbackBreakdown({
  review,
  locale,
}: {
  review: SubmissionReviewDetail;
  locale: LocaleCode;
}) {
  return (
    <div className="space-y-4">
      {!review.isAssessable && review.notAssessableReason && (
        <div className="rounded-xl border border-peach bg-peach-soft/60 p-4 space-y-1">
          <p className="text-xs font-semibold text-peach-ink">
            Why This Clip Was Marked Not Assessable
          </p>
          <p className="text-sm text-charcoal leading-relaxed">{review.notAssessableReason}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-sage-border bg-sage-soft/45 p-4 space-y-1">
          <p className="text-xs font-semibold text-sage">Positive Observations</p>
          <p className="text-sm text-charcoal leading-relaxed">{review.strengthsNote}</p>
        </div>
        <div className="rounded-xl border border-peach bg-peach-soft/50 p-4 space-y-1">
          <p className="text-xs font-semibold text-peach-ink">Areas to Improve</p>
          <p className="text-sm text-charcoal leading-relaxed">{review.coachingTip}</p>
        </div>
      </div>

      {review.reviewerComments && (
        <div className="rounded-xl border border-border bg-cream/70 p-4 space-y-1">
          <p className="text-xs font-semibold text-charcoal">Reviewer Comments</p>
          <p className="text-sm text-charcoal leading-relaxed">{review.reviewerComments}</p>
        </div>
      )}

      <div className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted pb-1">
          <span className="font-semibold text-charcoal">Criteria-Wise Feedback</span>
          <span className="font-mono tabular-nums">
            Reviewed {formatDateReadable(review.submittedAt, locale)} · {review.reviewerName}
            {review.version > 1 ? ` · v${review.version}` : ''}
          </span>
        </div>

        <div className="divide-y divide-border border-t border-b border-border">
          {review.rubricScores.map((score) => {
            const isExcluded = score.achievedLevel === 'not_assessable';
            const levelLabel =
              score.achievedLevel === 'met'
                ? 'Met'
                : score.achievedLevel === 'partially_met'
                  ? 'Partially Met'
                  : score.achievedLevel === 'not_assessable'
                    ? 'Not Assessable'
                    : 'Not Met';
            const levelColor =
              score.achievedLevel === 'met'
                ? 'text-sage font-medium'
                : score.achievedLevel === 'partially_met'
                  ? 'text-peach-ink font-medium'
                  : score.achievedLevel === 'not_assessable'
                    ? 'text-lavender-ink font-medium'
                    : 'text-muted font-medium';
            return (
              <div
                key={score.id}
                className="py-3 flex flex-wrap items-start justify-between gap-3 text-sm"
              >
                <div className="space-y-0.5 max-w-xl">
                  <p className="font-medium text-charcoal">{score.criterionLabel}</p>
                  <p className="text-xs text-muted">{score.criterionDescription}</p>
                  {score.explanation && (
                    <p className="text-xs text-charcoal/85 pt-1">Note: {score.explanation}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs font-mono tabular-nums shrink-0">
                  <span className={levelColor}>{levelLabel}</span>
                  <span className="text-muted">
                    {isExcluded ? 'Excluded' : `${score.earnedPoints}/${score.maxPoints} pts`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ProgressDashboardSection({
  journey,
  learningDomains,
  locale,
  nonDiagnosticTitle,
  nonDiagnosticBody,
  onRefreshJourney,
  onExploreDomain,
  onOpenActivity,
  onGoToday,
}: ProgressDashboardSectionProps) {
  const { notify } = useToast();
  const [activeTab, setActiveTab] = useState<ProgressTab>('overview');
  const [progress, setProgress] = useState<ParentProgressOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [illustrationFailed, setIllustrationFailed] = useState(false);

  // Activity History 4 required filters
  const [datePreset, setDatePreset] = useState<DateRangePreset>('all');
  const [customFrom, setCustomFrom] = useState(() => getIsoDaysAgo(30));
  const [customTo, setCustomTo] = useState(() => getIsoDaysAgo(0));
  const [domainFilter, setDomainFilter] = useState<string>('all');
  const [completionFilter, setCompletionFilter] = useState<JourneyDisplayStatus | 'all'>('all');
  const [reviewFilter, setReviewFilter] = useState<ActivityHistoryReviewFilter>('all');

  // Detail modal for any clicked Activity History item
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<ActivityHistoryRecord | null>(null);

  // Delete video confirmation state
  const [confirmDeleteSubId, setConfirmDeleteSubId] = useState<string | null>(null);
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);

  const effectiveDates = useMemo(() => {
    if (datePreset === '7d') {
      return { dateFrom: getIsoDaysAgo(6), dateTo: getIsoDaysAgo(0) };
    }
    if (datePreset === '30d') {
      return { dateFrom: getIsoDaysAgo(29), dateTo: getIsoDaysAgo(0) };
    }
    if (datePreset === 'custom') {
      return { dateFrom: customFrom || undefined, dateTo: customTo || undefined };
    }
    return { dateFrom: undefined, dateTo: undefined };
  }, [datePreset, customFrom, customTo]);

  const loadProgress = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getParentProgress(journey.child.id, {
        dateFrom: effectiveDates.dateFrom,
        dateTo: effectiveDates.dateTo,
        domainId: domainFilter,
        completionStatus: completionFilter,
        reviewStatus: reviewFilter,
      });
      setProgress(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load progress right now.');
    } finally {
      setLoading(false);
    }
  }, [
    journey.child.id,
    effectiveDates.dateFrom,
    effectiveDates.dateTo,
    domainFilter,
    completionFilter,
    reviewFilter,
  ]);

  useEffect(() => {
    void loadProgress();
  }, [loadProgress]);

  const hasActiveFilters =
    datePreset !== 'all' ||
    domainFilter !== 'all' ||
    completionFilter !== 'all' ||
    reviewFilter !== 'all';

  const resetHistoryFilters = () => {
    setDatePreset('all');
    setDomainFilter('all');
    setCompletionFilter('all');
    setReviewFilter('all');
  };

  const handleConfirmDeleteVideo = async () => {
    if (!confirmDeleteSubId) return;
    setDeletingVideoId(confirmDeleteSubId);
    try {
      await api.deleteSubmissionVideo(confirmDeleteSubId);
      setConfirmDeleteSubId(null);
      setSelectedHistoryItem(null);
      notify({
        tone: 'success',
        title: 'Video deleted permanently',
        description: 'Your written caregiver coaching feedback remains safely preserved.',
      });
      await Promise.all([onRefreshJourney(), loadProgress()]);
    } catch (err) {
      notify({
        tone: 'error',
        title: 'Could not delete video',
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setDeletingVideoId(null);
    }
  };

  const summary = progress?.summary;
  const weeklyBars = progress?.weeklyDailyBars ?? journey.weeklyProgress;
  const weeklyTotal = weeklyBars.reduce((sum, d) => sum + d.completedCount, 0);
  const maxDaily = Math.max(3, ...weeklyBars.map((d) => d.completedCount));
  const domainStats = progress?.domainProgress ?? journey.domainProgress;
  const domainsParticipated = domainStats.filter((d) => d.completedCount > 0).length;
  const reviewHistory = progress?.reviewHistory ?? journey.recentSubmissions;
  const activityHistory = progress?.activityHistory ?? [];

  const stageCompletionPct =
    summary && summary.totalStageActivities > 0
      ? Math.min(
          100,
          Math.round((summary.activitiesCompletedStage / summary.totalStageActivities) * 100)
        )
      : 0;

  return (
    <div className="space-y-8">
      {/* Warm Montessori Editorial Header Card with Friendly Illustration */}
      <Card padding="none" className="overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between gap-6">
            <div className="space-y-2.5">
              <p className="text-xs text-muted">
                {journey.child.ageGroupLabel} <span aria-hidden="true">·</span> Learning Participation
                Journal
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-semibold text-charcoal text-balance">
                {journey.child.displayName}’s Learning Journey
              </h2>
              <p className="text-sm text-muted leading-relaxed max-w-xl">
                See the everyday moments you have explored together, revisit past activities, and
                read warm caregiver feedback—always at your own calm pace.
              </p>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-border">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="font-medium text-charcoal">
                  Stage participation ({journey.child.ageGroupLabel})
                </span>
                <span className="font-mono text-xs text-sage tabular-nums">
                  {summary?.activitiesCompletedStage ?? 0} of {summary?.totalStageActivities ?? 0}{' '}
                  activities completed · {stageCompletionPct}%
                </span>
              </div>
              <ProgressIndicator
                value={summary?.activitiesCompletedStage ?? 0}
                max={Math.max(1, summary?.totalStageActivities ?? 1)}
                tone="sage"
                size="md"
              />
              <p className="text-xs text-muted leading-relaxed">
                <strong className="text-charcoal font-medium">{nonDiagnosticTitle}:</strong>{' '}
                {nonDiagnosticBody}
              </p>
            </div>
          </div>

          <div className="lg:col-span-5 bg-cream/60 border-t lg:border-t-0 lg:border-l border-border min-h-[220px] relative">
            {!illustrationFailed ? (
              <img
                src={progressJourneyIllustration}
                alt="Warm watercolor illustration of a mother and baby exploring wooden toys together on a cotton play mat"
                referrerPolicy="no-referrer"
                onError={() => setIllustrationFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center gap-2 bg-cream">
                <Sparkles className="w-8 h-8 text-sage" aria-hidden="true" />
                <p className="font-display text-base font-semibold text-charcoal">
                  Little moments, steady rhythm
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* 6 Required Progress Dashboard Metrics (Clean Hairline Cards, Zero Leaderboards) */}
      <section aria-label="Progress summary metrics" className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="space-y-1.5">
          <p className="text-xs text-muted">Activities Completed</p>
          <p className="font-mono text-3xl font-semibold text-charcoal tabular-nums">
            {summary?.activitiesCompletedStage ?? 0}
          </p>
          <p className="text-xs text-muted">
            In {journey.child.ageGroupLabel} ·{' '}
            <span className="font-mono tabular-nums">{summary?.totalCompletionsAllTime ?? 0}</span>{' '}
            sessions total
          </p>
        </Card>

        <Card className="space-y-1.5">
          <p className="text-xs text-muted">Activities Remaining</p>
          <p className="font-mono text-3xl font-semibold text-charcoal tabular-nums">
            {summary?.activitiesRemainingStage ?? 0}
          </p>
          <p className="text-xs text-muted">
            Ready whenever you want something new in this stage
          </p>
        </Card>

        <Card className="space-y-1.5">
          <p className="text-xs text-muted">Weekly Consistency</p>
          <p className="font-mono text-3xl font-semibold text-sage tabular-nums">
            {summary?.activeDaysThisWeek ?? 0}
            <span className="text-base font-normal text-muted"> / 7 days</span>
          </p>
          <p className="text-xs text-muted">
            <span className="font-mono tabular-nums">{weeklyTotal}</span>{' '}
            {weeklyTotal === 1 ? 'activity' : 'activities'} practiced this week
          </p>
        </Card>

        <Card className="space-y-1.5">
          <p className="text-xs text-muted">Domain Participation</p>
          <p className="font-mono text-3xl font-semibold text-charcoal tabular-nums">
            {domainsParticipated}
            <span className="text-base font-normal text-muted"> / 6 areas</span>
          </p>
          <p className="text-xs text-muted">Development areas practiced so far</p>
        </Card>

        <Card className="space-y-1.5">
          <p className="text-xs text-muted">Submitted Videos</p>
          <p className="font-mono text-3xl font-semibold text-charcoal tabular-nums">
            {summary?.submittedVideosCount ?? 0}
          </p>
          <p className="text-xs text-muted">
            {summary && summary.pendingReviewsCount > 0
              ? `${summary.pendingReviewsCount} currently with reviewers`
              : 'Private practice clips shared'}
          </p>
        </Card>

        <Card className="space-y-1.5">
          <p className="text-xs text-muted">Reviewed Activities</p>
          <p className="font-mono text-3xl font-semibold text-sage tabular-nums">
            {summary?.reviewedActivitiesCount ?? 0}
          </p>
          <p className="text-xs text-muted">Caregiver coaching reviews received</p>
        </Card>
      </section>

      {/* Segmented Navigation Between Overview, Activity History, and Review History */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div
          className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-cream border border-border"
          role="tablist"
          aria-label="Progress sections"
        >
          {(
            [
              { id: 'overview', label: 'Progress Overview' },
              {
                id: 'activity-history',
                label: `Activity History (${activityHistory.length})`,
              },
              {
                id: 'review-history',
                label: `Review History (${reviewHistory.length})`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[40px] px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-surface text-charcoal border border-border'
                  : 'text-muted hover:text-charcoal'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <Button variant="subtle" size="sm" onClick={onGoToday}>
          Back to Today’s Plan
        </Button>
      </div>

      {error && (
        <Card className="border-danger/35 bg-danger-soft/50 flex flex-wrap items-center justify-between gap-3">
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
          <Button variant="secondary" size="sm" onClick={() => void loadProgress()}>
            Try Again
          </Button>
        </Card>
      )}

      {/* =================================================================== */}
      {/* TAB 1: PROGRESS OVERVIEW (WEEKLY CONSISTENCY + DOMAIN PARTICIPATION)*/}
      {/* =================================================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Simple 7-Day Activity Bar Chart */}
            <Card padding="lg" className="lg:col-span-7 flex flex-col justify-between space-y-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h3 className="font-display text-lg font-semibold text-charcoal">
                    Weekly Activity Consistency
                  </h3>
                  <p className="text-xs text-muted">
                    Activities completed each day over the past 7 days.
                  </p>
                </div>
                <span className="font-mono text-xs text-sage tabular-nums">
                  {weeklyTotal} {weeklyTotal === 1 ? 'activity' : 'activities'} ·{' '}
                  {summary?.activeDaysThisWeek ?? 0}/7 days
                </span>
              </div>

              <div
                className="grid grid-cols-7 gap-2 sm:gap-3 items-end h-44 pt-4 border-t border-border"
                role="img"
                aria-label={`Weekly activity chart showing ${weeklyTotal} completed activities across ${summary?.activeDaysThisWeek ?? 0} active days`}
              >
                {weeklyBars.map((day) => {
                  const pct =
                    day.completedCount > 0
                      ? Math.max(18, Math.round((day.completedCount / maxDaily) * 100))
                      : 6;
                  return (
                    <div
                      key={day.date}
                      className="flex flex-col items-center gap-2 h-full justify-end"
                    >
                      <span className="font-mono text-xs tabular-nums text-muted">
                        {day.completedCount}
                      </span>
                      <div className="w-full max-w-[42px] h-28 rounded-lg bg-cream flex items-end overflow-hidden p-1">
                        <div
                          className={`w-full rounded-md transition-all duration-300 ${
                            day.completedCount > 0
                              ? day.isToday
                                ? 'bg-sage'
                                : 'bg-sage/75'
                              : 'bg-border-strong/45'
                          }`}
                          style={{ height: `${pct}%` }}
                        />
                      </div>
                      <span
                        className={`text-xs ${
                          day.isToday ? 'font-semibold text-sage' : 'text-muted'
                        }`}
                      >
                        {day.dayLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* 4-Week Calm Participation Rhythm */}
            <Card padding="lg" className="lg:col-span-5 flex flex-col justify-between space-y-5">
              <div>
                <h3 className="font-display text-lg font-semibold text-charcoal">
                  Four-Week Gentle Rhythm
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Even two or three relaxed play sessions a week builds a steady routine.
                </p>
              </div>

              <div className="space-y-4">
                {(progress?.weeklyConsistencyTrend ?? []).map((week) => (
                  <div key={week.startDate} className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="font-medium text-charcoal">{week.weekLabel}</span>
                      <span className="font-mono text-muted tabular-nums">
                        {week.activeDays}/7 days · {week.completedCount}{' '}
                        {week.completedCount === 1 ? 'activity' : 'activities'}
                      </span>
                    </div>
                    <ProgressIndicator
                      value={week.activeDays}
                      max={7}
                      tone={week.activeDays > 0 ? 'sage' : 'peach'}
                      size="sm"
                    />
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted pt-3 border-t border-border">
                Missed a few days? That is completely normal—pick up gently whenever your baby is
                rested.
              </p>
            </Card>
          </div>

          {/* Domain-Wise Activity Participation */}
          <section className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 className="font-display text-xl font-semibold text-charcoal">
                  Domain-Wise Activity Participation
                </h3>
                <p className="text-sm text-muted">
                  How your completed activities are spread across the six early-childhood areas.
                </p>
              </div>
              <span className="font-mono text-xs text-muted tabular-nums">
                {domainsParticipated} of 6 areas explored
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {domainStats.map((stat) => {
                const pct = Math.min(
                  100,
                  Math.round((stat.completedCount / Math.max(1, stat.availableCount)) * 100)
                );
                return (
                  <Card key={stat.domainId} className="flex flex-col justify-between gap-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-display text-base font-semibold text-charcoal">
                          {stat.domainName}
                        </p>
                        <span className="font-mono text-xs tabular-nums text-sage shrink-0">
                          {stat.completedCount}/{stat.availableCount}
                        </span>
                      </div>
                      <ProgressIndicator
                        value={Math.min(stat.completedCount, stat.availableCount)}
                        max={stat.availableCount}
                        tone="sage"
                        size="sm"
                      />
                      <p className="text-xs text-muted">
                        {stat.completedCount === 0
                          ? 'Not explored yet in this stage'
                          : `${pct}% of stage activities tried`}
                      </p>
                    </div>
                    <Button
                      variant="subtle"
                      size="sm"
                      rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                      onClick={() => onExploreDomain(stat.domainId)}
                    >
                      Explore Area
                    </Button>
                  </Card>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: ACTIVITY HISTORY WITH ALL 4 REQUIRED FILTERS                 */}
      {/* =================================================================== */}
      {activeTab === 'activity-history' && (
        <div className="space-y-6">
          {/* 4-Filter Control Bar */}
          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-charcoal">
                <Filter className="w-4 h-4 text-sage" aria-hidden="true" />
                <span>Filter Activity History</span>
              </div>
              {hasActiveFilters && (
                <Button
                  variant="subtle"
                  size="sm"
                  leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                  onClick={resetHistoryFilters}
                >
                  Reset Filters
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Select
                label="Date range"
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value as DateRangePreset)}
                options={[
                  { value: 'all', label: 'All time' },
                  { value: '7d', label: 'Last 7 days' },
                  { value: '30d', label: 'Last 30 days' },
                  { value: 'custom', label: 'Custom date range' },
                ]}
              />

              <Select
                label="Development domain"
                value={domainFilter}
                onChange={(e) => setDomainFilter(e.target.value)}
                options={[
                  { value: 'all', label: 'All six domains' },
                  ...learningDomains.map((d) => ({ value: d.id, label: d.name })),
                ]}
              />

              <Select
                label="Completion status"
                value={completionFilter}
                onChange={(e) =>
                  setCompletionFilter(e.target.value as JourneyDisplayStatus | 'all')
                }
                options={[
                  { value: 'all', label: 'All statuses' },
                  { value: 'in_progress', label: 'In progress' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'submitted_for_review', label: 'Submitted for review' },
                  { value: 'reviewed', label: 'Reviewed' },
                ]}
              />

              <Select
                label="Review status"
                value={reviewFilter}
                onChange={(e) => setReviewFilter(e.target.value as ActivityHistoryReviewFilter)}
                options={[
                  { value: 'all', label: 'All review states' },
                  { value: 'reviewed', label: 'Reviewed' },
                  { value: 'queued', label: 'Pending review' },
                  { value: 'in_review', label: 'Under review' },
                  { value: 'resubmit_requested', label: 'Changes requested' },
                  { value: 'none', label: 'No video submitted' },
                ]}
              />
            </div>

            {datePreset === 'custom' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
                <DatePicker
                  label="From date"
                  value={customFrom}
                  max={customTo || getIsoDaysAgo(0)}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
                <DatePicker
                  label="To date"
                  value={customTo}
                  min={customFrom}
                  max={getIsoDaysAgo(0)}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </div>
            )}
          </Card>

          {loading ? (
            <div className="space-y-3">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : activityHistory.length === 0 ? (
            <EmptyState
              title={
                hasActiveFilters
                  ? 'No activities match these filters'
                  : 'Your activity journal is ready for its first moment'
              }
              description={
                hasActiveFilters
                  ? 'Try widening your date range or clearing one of the filters above.'
                  : 'As soon as you start or complete an activity with your baby, it will appear here with its notes and any caregiver review.'
              }
              actionLabel={hasActiveFilters ? 'Reset Filters' : 'Explore Today’s Activities'}
              onAction={hasActiveFilters ? resetHistoryFilters : onGoToday}
            />
          ) : (
            <Card padding="none" className="divide-y divide-border">
              {activityHistory.map((item) => {
                const compMeta = getCompletionLabel(item.displayStatus);
                const revMeta = getReviewStatusSummary(item.submission);
                return (
                  <button
                    key={item.completionId}
                    type="button"
                    onClick={() => setSelectedHistoryItem(item)}
                    className="w-full text-left px-5 py-4 hover:bg-offwhite transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="space-y-1 min-w-0">
                      <p className="text-xs text-muted">
                        {item.domainName} <span aria-hidden="true">·</span>{' '}
                        {item.ageGroupLabelSnapshot} <span aria-hidden="true">·</span>{' '}
                        <span className="font-mono tabular-nums">{item.durationMinutes} min</span>{' '}
                        <span aria-hidden="true">·</span>{' '}
                        <span className="font-mono tabular-nums">
                          {formatDateReadable(item.activityDate, locale)}
                        </span>
                      </p>
                      <p className="font-display text-base font-semibold text-charcoal truncate">
                        {item.activityTitle}
                      </p>
                      {item.caregiverNotes && (
                        <p className="text-xs text-muted line-clamp-1">
                          Note: {item.caregiverNotes}
                        </p>
                      )}
                    </div>

                    <div className="flex sm:flex-col items-start sm:items-end justify-between gap-1 shrink-0 text-xs">
                      <span className={compMeta.toneClass}>{compMeta.text}</span>
                      <span className={`${revMeta.toneClass} font-mono tabular-nums`}>
                        {revMeta.text}
                      </span>
                      <span className="text-sage font-medium inline-flex items-center gap-1 pt-0.5">
                        View details & review
                        <ArrowRight className="w-3 h-3" aria-hidden="true" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </Card>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: REVIEW HISTORY (ALL 5 REQUIRED REVIEW FIELDS)                */}
      {/* =================================================================== */}
      {activeTab === 'review-history' && (
        <div className="space-y-5">
          <Card tone="cream" padding="sm" className="flex items-start gap-3">
            <Info className="w-4 h-4 text-sage shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-xs text-muted leading-relaxed">
              <strong className="text-charcoal font-medium">{nonDiagnosticTitle}:</strong> Reviews
              focus only on how clearly the caregiver demonstrated each step and safety setup—never
              on evaluating your baby.
            </p>
          </Card>

          {reviewHistory.length === 0 ? (
            <EmptyState
              title="No video reviews yet"
              description="Whenever you would like warm coaching on an activity’s steps, open any activity and share a short private clip. Your submission and review history will live here."
              actionLabel="Go to Today’s Activities"
              onAction={onGoToday}
            />
          ) : (
            <div className="space-y-5">
              {reviewHistory.map((sub) => (
                <Card key={sub.id} padding="lg" className="space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
                    <div className="space-y-1">
                      <p className="text-xs text-muted">
                        {sub.domainName} <span aria-hidden="true">·</span> {sub.ageGroupLabel}{' '}
                        <span aria-hidden="true">·</span> v{sub.activityVersion}
                      </p>
                      <h4 className="font-display text-xl font-semibold text-charcoal">
                        {sub.activityTitle}
                      </h4>
                      <p className="text-xs text-muted font-mono tabular-nums">
                        Submitted {formatDateReadable(sub.createdAt, locale)}
                        {sub.review
                          ? ` · Reviewed ${formatDateReadable(sub.review.submittedAt, locale)}`
                          : ''}
                      </p>
                    </div>

                    <div className="text-left sm:text-right space-y-1">
                      {sub.review ? (
                        sub.review.isAssessable && sub.review.instructionMatchScorePct !== null ? (
                          <>
                            <p className="font-mono text-2xl font-semibold text-sage tabular-nums">
                              {sub.review.instructionMatchScorePct}%
                            </p>
                            <p className="text-xs text-muted">
                              Instruction-match ({sub.review.earnedWeightPoints}/
                              {sub.review.applicableWeightPoints} pts)
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-semibold text-peach-ink">Not Assessable</p>
                            <p className="text-xs text-muted">
                              Insufficient evidence for a percentage
                            </p>
                          </>
                        )
                      ) : (
                        <p className="text-xs font-medium text-lavender-ink">
                          {sub.reviewStatus === 'in_review'
                            ? 'Under review by coach'
                            : sub.reviewStatus === 'resubmit_requested'
                              ? 'Changes requested'
                              : sub.reviewStatus === 'deleted'
                                ? 'Video deleted'
                                : 'Submitted · Waiting for review'}
                        </p>
                      )}
                    </div>
                  </div>

                  {sub.reviewStatus === 'resubmit_requested' && sub.changeRequestNote && (
                    <div className="rounded-xl border border-peach bg-peach-soft/55 p-4 space-y-1">
                      <p className="text-xs font-semibold text-peach-ink">
                        Reviewer Requested an Updated Clip
                      </p>
                      <p className="text-sm text-charcoal leading-relaxed">
                        {sub.changeRequestNote}
                      </p>
                    </div>
                  )}

                  <SecureVideoPlayer
                    submissionId={sub.id}
                    hasActiveVideo={sub.hasActiveVideo}
                    expiresAt={sub.expiresAt}
                    deletionReason={sub.deletionReason}
                    storageMode={sub.storageMode}
                  />

                  {sub.review && <ReviewFeedbackBreakdown review={sub.review} locale={locale} />}

                  <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        variant="secondary"
                        size="sm"
                        leftIcon={<BookOpen className="w-3.5 h-3.5" />}
                        onClick={() => onOpenActivity(sub.activityId)}
                      >
                        Open Activity Guide
                      </Button>
                      {sub.hasActiveVideo && (
                        <span className="text-xs text-muted font-mono tabular-nums">
                          Auto-deletes in {formatDaysUntilExpiry(sub.expiresAt)} days
                        </span>
                      )}
                    </div>

                    {sub.hasActiveVideo && (
                      <Button
                        variant="danger"
                        size="sm"
                        leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                        onClick={() => setConfirmDeleteSubId(sub.id)}
                      >
                        Delete Video Now
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: ACTIVITY HISTORY ITEM DETAILS & RELATED REVIEW               */}
      {/* =================================================================== */}
      <Modal
        open={Boolean(selectedHistoryItem)}
        onClose={() => setSelectedHistoryItem(null)}
        title={selectedHistoryItem?.activityTitle ?? 'Activity Details'}
        description={
          selectedHistoryItem
            ? `${selectedHistoryItem.domainName} · ${selectedHistoryItem.ageGroupLabelSnapshot} · ${selectedHistoryItem.durationMinutes} min · ${formatPrepLevel(selectedHistoryItem.prepLevel)}`
            : undefined
        }
        size="lg"
        footer={
          selectedHistoryItem ? (
            <>
              <Button variant="secondary" size="sm" onClick={() => setSelectedHistoryItem(null)}>
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<BookOpen className="w-4 h-4" />}
                onClick={() => {
                  const id = selectedHistoryItem.activityId;
                  setSelectedHistoryItem(null);
                  onOpenActivity(id);
                }}
              >
                Open Full Activity Guide
              </Button>
            </>
          ) : undefined
        }
      >
        {selectedHistoryItem && (
          <div className="space-y-5">
            <p className="text-sm text-muted leading-relaxed">
              {selectedHistoryItem.activitySummary}
            </p>

            {/* Activity Record Metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border border-border bg-offwhite p-4 text-xs">
              <div className="space-y-0.5">
                <span className="text-muted flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                  Recorded Date
                </span>
                <p className="font-mono text-charcoal font-medium tabular-nums">
                  {formatDateReadable(selectedHistoryItem.activityDate, locale)}
                </p>
              </div>
              <div className="space-y-0.5">
                <span className="text-muted flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                  Activity Status
                </span>
                <p className={getCompletionLabel(selectedHistoryItem.displayStatus).toneClass}>
                  {getCompletionLabel(selectedHistoryItem.displayStatus).text}
                </p>
              </div>
              <div className="space-y-0.5">
                <span className="text-muted flex items-center gap-1">
                  <ClipboardCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  Review Status
                </span>
                <p className={getReviewStatusSummary(selectedHistoryItem.submission).toneClass}>
                  {getReviewStatusSummary(selectedHistoryItem.submission).text}
                </p>
              </div>
            </div>

            {selectedHistoryItem.caregiverNotes && (
              <div className="rounded-xl border border-border bg-cream/60 p-4 space-y-1">
                <p className="text-xs font-semibold text-charcoal">Your Reflection Note</p>
                <p className="text-sm text-charcoal leading-relaxed">
                  {selectedHistoryItem.caregiverNotes}
                </p>
              </div>
            )}

            {/* Related Submission & Review */}
            {selectedHistoryItem.submission ? (
              <div className="space-y-4 pt-2 border-t border-border">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-charcoal">
                    <Video className="w-4 h-4 text-sage" aria-hidden="true" />
                    <span>Related Video Submission & Review</span>
                  </div>
                  <span className="font-mono text-xs text-muted tabular-nums">
                    Submitted {formatDateReadable(selectedHistoryItem.submission.createdAt, locale)}
                  </span>
                </div>

                <SecureVideoPlayer
                  submissionId={selectedHistoryItem.submission.id}
                  hasActiveVideo={selectedHistoryItem.submission.hasActiveVideo}
                  expiresAt={selectedHistoryItem.submission.expiresAt}
                  deletionReason={selectedHistoryItem.submission.deletionReason}
                  storageMode={selectedHistoryItem.submission.storageMode}
                />

                {selectedHistoryItem.submission.review ? (
                  <ReviewFeedbackBreakdown
                    review={selectedHistoryItem.submission.review}
                    locale={locale}
                  />
                ) : selectedHistoryItem.submission.reviewStatus === 'resubmit_requested' &&
                  selectedHistoryItem.submission.changeRequestNote ? (
                  <div className="rounded-xl border border-peach bg-peach-soft/55 p-4 space-y-1">
                    <p className="text-xs font-semibold text-peach-ink">
                      Reviewer Requested an Updated Clip
                    </p>
                    <p className="text-sm text-charcoal leading-relaxed">
                      {selectedHistoryItem.submission.changeRequestNote}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border bg-offwhite p-4 text-xs text-muted flex items-center gap-2">
                    <Clock className="w-4 h-4 text-sage shrink-0" aria-hidden="true" />
                    <span>
                      Your clip is stored privately and awaiting caregiver coaching feedback.
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-offwhite p-4 text-xs text-muted flex items-center gap-2">
                <History className="w-4 h-4 text-sage shrink-0" aria-hidden="true" />
                <span>
                  No video was submitted for this activity. Open the full activity guide anytime if
                  you would like to record or upload a clip for caregiver coaching.
                </span>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDeleteSubId)}
        onClose={() => setConfirmDeleteSubId(null)}
        onConfirm={() => void handleConfirmDeleteVideo()}
        title="Delete practice video permanently?"
        message="This removes the video file immediately from private storage. Your written caregiver coaching feedback remains preserved."
        confirmLabel="Delete Video"
        destructive
        loading={Boolean(deletingVideoId)}
      />
    </div>
  );
}

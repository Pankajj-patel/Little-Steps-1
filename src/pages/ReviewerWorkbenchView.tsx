import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileEdit,
  History,
  Info,
  MessageSquare,
  RotateCcw,
  Save,
  ShieldAlert,
  ShieldCheck,
  Video,
} from 'lucide-react';
import { SecureVideoPlayer } from '../components/SecureVideoPlayer';
import { useAuth } from '../context/AuthContext';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Modal,
  Select,
  SkeletonCard,
  useToast,
  type BadgeTone,
} from '../design-system';
import { api } from '../lib/api';
import { calculateInstructionMatchScore } from '../shared/domain';
import { formatDateTimeReadable } from '../shared/i18n';
import type {
  QueuePriority,
  ReviewAuditAction,
  ReviewerDashboardSummary,
  ReviewerQueueItem,
  ReviewerSubmissionDetail,
  RubricAchievementLevel,
  SubmissionReviewStatus,
} from '../shared/types';

function getStatusBadgeMeta(
  status: SubmissionReviewStatus,
  hasDraft?: boolean
): { label: string; tone: BadgeTone } {
  switch (status) {
    case 'queued':
      return { label: 'Pending', tone: 'lavender' };
    case 'in_review':
      return { label: hasDraft ? 'Under Review · Draft' : 'Under Review', tone: 'peach' };
    case 'resubmit_requested':
      return { label: 'Changes Requested', tone: 'peach' };
    case 'reviewed':
      return { label: 'Reviewed', tone: 'sage' };
    case 'deleted':
    default:
      return { label: 'Deleted', tone: 'neutral' };
  }
}

function getPriorityBadgeMeta(priority: QueuePriority): { label: string; tone: BadgeTone } {
  switch (priority) {
    case 'high':
      return { label: 'High', tone: 'danger' };
    case 'normal':
      return { label: 'Normal', tone: 'sage' };
    case 'low':
    default:
      return { label: 'Low', tone: 'neutral' };
  }
}

function formatAuditActionLabel(action: ReviewAuditAction): { label: string; tone: BadgeTone } {
  switch (action) {
    case 'draft_saved':
      return { label: 'Draft saved', tone: 'neutral' };
    case 'published':
      return { label: 'Evaluation published', tone: 'sage' };
    case 'updated':
      return { label: 'Evaluation updated', tone: 'lavender' };
    case 'marked_not_assessable':
      return { label: 'Marked Not Assessable', tone: 'peach' };
    case 'changes_requested':
    default:
      return { label: 'Resubmission requested', tone: 'peach' };
  }
}

function normalizeEditableLevel(level: RubricAchievementLevel): RubricAchievementLevel {
  return level === 'not_observed' ? 'not_met' : level;
}

const RATING_OPTIONS: ReadonlyArray<{
  id: RubricAchievementLevel;
  label: string;
  weightHint: string;
}> = [
  { id: 'met', label: 'Met', weightHint: '1.0' },
  { id: 'partially_met', label: 'Partial', weightHint: '0.5' },
  { id: 'not_met', label: 'Not met', weightHint: '0' },
  { id: 'not_assessable', label: 'Not assessable', weightHint: 'Excl.' },
];

export function ReviewerWorkbenchView() {
  const { user, ageGroups, locale } = useAuth();
  const { notify } = useToast();
  const isReadOnlyAdmin = user?.role === 'admin';

  const [statusFilter, setStatusFilter] = useState<SubmissionReviewStatus | 'all'>('all');
  const [ageFilter, setAgeFilter] = useState<string>('all');
  const [summary, setSummary] = useState<ReviewerDashboardSummary | null>(null);
  const [queue, setQueue] = useState<ReviewerQueueItem[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active review details workbench
  const [selectedDetail, setSelectedDetail] = useState<ReviewerSubmissionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Evaluation form state
  const [ratings, setRatings] = useState<Record<string, RubricAchievementLevel>>({});
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [strengthsNote, setStrengthsNote] = useState('');
  const [coachingTip, setCoachingTip] = useState('');
  const [reviewerComments, setReviewerComments] = useState('');
  const [scopeAcknowledged, setScopeAcknowledged] = useState(false);
  const [savingAction, setSavingAction] = useState<
    'draft' | 'publish' | 'not_assessable' | 'request_changes' | null
  >(null);
  const [actionBanner, setActionBanner] = useState<string | null>(null);

  // Secondary action modals (Request Another Submission / Mark Evidence Insufficient)
  const [resubmitModalOpen, setResubmitModalOpen] = useState(false);
  const [resubmitNote, setResubmitNote] = useState('');
  const [insufficientModalOpen, setInsufficientModalOpen] = useState(false);
  const [insufficientReason, setInsufficientReason] = useState('');

  const loadQueue = useCallback(async () => {
    setLoadingQueue(true);
    setError(null);
    try {
      const data = await api.getReviewerQueue(statusFilter, ageFilter);
      setSummary(data.summary);
      setQueue(data.queue);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load review queue.');
    } finally {
      setLoadingQueue(false);
    }
  }, [statusFilter, ageFilter]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const hydrateDetailForm = (detail: ReviewerSubmissionDetail) => {
    setSelectedDetail(detail);
    setActionBanner(null);
    setError(null);

    const nextRatings: Record<string, RubricAchievementLevel> = {};
    const nextExplanations: Record<string, string> = {};

    if (detail.review) {
      for (const s of detail.review.rubricScores) {
        nextRatings[s.criterionId] = normalizeEditableLevel(s.achievedLevel);
        nextExplanations[s.criterionId] = s.explanation ?? '';
      }
      for (const c of detail.activity.rubricCriteria) {
        if (!nextRatings[c.id]) {
          nextRatings[c.id] = 'met';
        }
      }
      setStrengthsNote(detail.review.strengthsNote);
      setCoachingTip(detail.review.coachingTip);
      setReviewerComments(detail.review.reviewerComments ?? '');
      setScopeAcknowledged(detail.review.reviewStatus === 'published');
      setInsufficientReason(detail.review.notAssessableReason ?? '');
    } else {
      for (const c of detail.activity.rubricCriteria) {
        nextRatings[c.id] = 'met';
        nextExplanations[c.id] = '';
      }
      setStrengthsNote('');
      setCoachingTip('');
      setReviewerComments('');
      setScopeAcknowledged(false);
      setInsufficientReason('');
    }
    setResubmitNote(detail.submission.changeRequestNote ?? '');
    setRatings(nextRatings);
    setExplanations(nextExplanations);
  };

  const openSubmission = async (item: ReviewerQueueItem) => {
    setLoadingDetail(true);
    setError(null);
    try {
      const detail =
        item.reviewStatus === 'queued' && !isReadOnlyAdmin
          ? await api.claimSubmission(item.submissionId)
          : await api.getReviewerSubmissionDetail(item.submissionId);
      hydrateDetailForm(detail);
    } catch (err) {
      try {
        const detail = await api.getReviewerSubmissionDetail(item.submissionId);
        hydrateDetailForm(detail);
      } catch (fallbackErr) {
        setError(
          fallbackErr instanceof Error
            ? fallbackErr.message
            : err instanceof Error
              ? err.message
              : 'Unable to open submission.'
        );
      }
    } finally {
      setLoadingDetail(false);
    }
  };

  const buildCriterionPayload = (detail: ReviewerSubmissionDetail) =>
    detail.activity.rubricCriteria.map((c) => ({
      criterionId: c.id,
      achievedLevel: ratings[c.id] ?? 'not_met',
      explanation: explanations[c.id]?.trim() || null,
    }));

  const handleSaveDraft = async () => {
    if (!selectedDetail || isReadOnlyAdmin) return;
    setError(null);
    setActionBanner(null);
    setSavingAction('draft');
    try {
      const res = await api.submitReview(selectedDetail.submission.submissionId, {
        mode: 'draft',
        strengthsNote,
        coachingTip,
        reviewerComments: reviewerComments.trim() || null,
        evaluationScopeAcknowledged: scopeAcknowledged,
        criterionRatings: buildCriterionPayload(selectedDetail),
      });
      const refreshed =
        res.detail ?? (await api.getReviewerSubmissionDetail(selectedDetail.submission.submissionId));
      hydrateDetailForm(refreshed);
      setActionBanner('Draft saved privately. Parents cannot see drafts until you publish.');
      notify({
        tone: 'success',
        title: 'Evaluation draft saved',
        description: 'You can return anytime to finish and publish.',
      });
      await loadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save draft.');
    } finally {
      setSavingAction(null);
    }
  };

  const handlePublishEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDetail || isReadOnlyAdmin) return;
    setError(null);
    setActionBanner(null);

    const missingExplanation = selectedDetail.activity.rubricCriteria.find(
      (c) => (ratings[c.id] ?? 'not_met') === 'not_assessable' && !(explanations[c.id]?.trim())
    );
    if (missingExplanation) {
      setError(
        `Please add a brief explanation for why "${missingExplanation.label}" is marked Not assessable.`
      );
      return;
    }

    setSavingAction('publish');
    try {
      const res = await api.submitReview(selectedDetail.submission.submissionId, {
        mode: 'publish',
        strengthsNote,
        coachingTip,
        reviewerComments: reviewerComments.trim() || null,
        evaluationScopeAcknowledged: true,
        criterionRatings: buildCriterionPayload(selectedDetail),
      });
      const refreshed =
        res.detail ?? (await api.getReviewerSubmissionDetail(selectedDetail.submission.submissionId));
      hydrateDetailForm(refreshed);
      const publishedMsg = res.review.isAssessable
        ? `Evaluation v${res.review.version} published (${res.review.instructionMatchScorePct}% instruction match).`
        : `Evaluation v${res.review.version} published as Not Assessable (insufficient assessable rubric weight).`;
      setActionBanner(publishedMsg);
      notify({
        tone: 'success',
        title: 'Caregiver evaluation published',
        description: publishedMsg,
      });
      await loadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to publish evaluation.');
    } finally {
      setSavingAction(null);
    }
  };

  const handleMarkEvidenceInsufficient = async () => {
    if (!selectedDetail || isReadOnlyAdmin) return;
    if (insufficientReason.trim().length < 10) {
      setError('Please provide a clear explanation (at least 10 characters) of why evidence is insufficient.');
      return;
    }
    setError(null);
    setActionBanner(null);
    setSavingAction('not_assessable');
    try {
      const res = await api.submitReview(selectedDetail.submission.submissionId, {
        mode: 'not_assessable',
        strengthsNote: strengthsNote.trim() || undefined,
        coachingTip: coachingTip.trim() || undefined,
        reviewerComments: reviewerComments.trim() || null,
        notAssessableReason: insufficientReason.trim(),
        evaluationScopeAcknowledged: true,
        criterionRatings: buildCriterionPayload(selectedDetail),
      });
      setInsufficientModalOpen(false);
      const refreshed =
        res.detail ?? (await api.getReviewerSubmissionDetail(selectedDetail.submission.submissionId));
      hydrateDetailForm(refreshed);
      setActionBanner(
        'Submission marked as Not Assessable without a misleading percentage score.'
      );
      notify({
        tone: 'info',
        title: 'Marked Not Assessable',
        description: 'Parent has been shown the clear explanation instead of a percentage.',
      });
      await loadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to mark submission not assessable.');
    } finally {
      setSavingAction(null);
    }
  };

  const handleRequestAnotherSubmission = async () => {
    if (!selectedDetail || isReadOnlyAdmin) return;
    if (resubmitNote.trim().length < 10) {
      setError('Please share a gentle explanation (at least 10 characters) of what to re-record.');
      return;
    }
    setError(null);
    setActionBanner(null);
    setSavingAction('request_changes');
    try {
      const res = await api.requestSubmissionChanges(
        selectedDetail.submission.submissionId,
        resubmitNote.trim()
      );
      setResubmitModalOpen(false);
      const refreshed =
        res.detail ?? (await api.getReviewerSubmissionDetail(selectedDetail.submission.submissionId));
      hydrateDetailForm(refreshed);
      setActionBanner('Requested an updated clip from the caregiver with your note.');
      notify({
        tone: 'info',
        title: 'Resubmission requested',
        description: 'The caregiver will see your gentle recording guidance.',
      });
      await loadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to request another submission.');
    } finally {
      setSavingAction(null);
    }
  };

  /* ========================================================================= */
  /* REVIEW DETAILS SPLIT-SCREEN VIEW                                          */
  /* ========================================================================= */
  if (selectedDetail) {
    const { submission, activity, review, history } = selectedDetail;
    const liveScore = calculateInstructionMatchScore(
      activity.rubricCriteria.map((c) => ({
        weightPoints: c.weightPoints,
        achievedLevel: ratings[c.id] ?? 'not_met',
      }))
    );

    const statusMeta = getStatusBadgeMeta(submission.reviewStatus, submission.hasDraftReview);
    const priorityMeta = getPriorityBadgeMeta(submission.priority);
    const isAlreadyPublished = review?.reviewStatus === 'published';

    const missingNotAssessableExplanation = activity.rubricCriteria.some(
      (c) => (ratings[c.id] ?? 'not_met') === 'not_assessable' && !(explanations[c.id]?.trim())
    );

    const canPublish =
      !isReadOnlyAdmin &&
      scopeAcknowledged &&
      strengthsNote.trim().length >= 10 &&
      coachingTip.trim().length >= 10 &&
      !missingNotAssessableExplanation &&
      savingAction === null;

    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-24 space-y-6">
        {/* Top Navigation & Privacy Metadata */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Button
            variant="subtle"
            size="sm"
            leftIcon={<ArrowLeft className="w-4 h-4" />}
            onClick={() => {
              setSelectedDetail(null);
              void loadQueue();
            }}
          >
            Back to Review Queue
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">
              <span className="font-mono tabular-nums">{submission.parentReference}</span>
            </Badge>
            <Badge tone="neutral">
              <span className="font-mono tabular-nums">Activity v{submission.activityVersion}</span>
            </Badge>
            <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
            <Badge tone={priorityMeta.tone}>Priority: {priorityMeta.label}</Badge>
          </div>
        </div>

        {/* Non-Diagnostic Reviewer Mandate */}
        <Card tone="cream" padding="sm" className="flex items-start gap-3">
          <ShieldCheck className="w-4 h-4 text-sage shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs text-muted leading-relaxed">
            <strong className="text-charcoal font-semibold">Caregiver Execution Scope Only:</strong>{' '}
            Assess whether the caregiver followed the activity instructions, setup, and safety
            guidance. Never assess or comment on the baby’s intelligence, health, or developmental
            level. Parent personal identifiers remain hidden.
          </p>
        </Card>

        {isReadOnlyAdmin && (
          <Card tone="peach" padding="sm" className="flex items-center gap-2.5 text-xs text-charcoal">
            <Info className="w-4 h-4 text-peach-ink shrink-0" aria-hidden="true" />
            <span>
              Viewing in Admin read-only oversight mode. Sign in as an authorized reviewer to
              submit or update evaluations.
            </span>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN (7/12): 1. Activity Title & Version, 2. Video, 3. Parent Note, 4. Instructions, 5. Safety */}
          <div className="lg:col-span-7 space-y-5">
            {/* 1. Activity Title & Version */}
            <div className="space-y-1.5">
              <p className="text-xs text-muted">
                {submission.domainName} <span aria-hidden="true">·</span>{' '}
                {submission.ageGroupLabel} <span aria-hidden="true">·</span> Submitted{' '}
                <span className="font-mono tabular-nums">
                  {formatDateTimeReadable(submission.createdAt, locale)}
                </span>
              </p>
              <div className="flex flex-wrap items-baseline gap-2.5">
                <h1 className="font-display text-2xl sm:text-3xl font-semibold text-charcoal">
                  {activity.title}
                </h1>
                <span className="font-mono text-xs text-muted tabular-nums">
                  v{submission.activityVersion}
                </span>
              </div>
              <p className="text-sm text-muted leading-relaxed">{activity.summary}</p>
            </div>

            {/* 4. Submitted Video */}
            <SecureVideoPlayer
              submissionId={submission.submissionId}
              hasActiveVideo={submission.hasActiveVideo}
              expiresAt={submission.expiresAt}
              deletionReason={submission.deletionReason}
              storageMode={submission.storageMode}
            />

            {/* 5. Optional Parent Note */}
            <Card className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted uppercase tracking-wide">
                <MessageSquare className="w-3.5 h-3.5 text-sage" aria-hidden="true" />
                <span>Parent Note</span>
              </div>
              {submission.caregiverNotes ? (
                <p className="text-sm text-charcoal leading-relaxed">
                  {submission.caregiverNotes}
                </p>
              ) : (
                <p className="text-xs text-muted italic">
                  No optional note was added by the caregiver for this clip.
                </p>
              )}
            </Card>

            {submission.reviewStatus === 'resubmit_requested' && submission.changeRequestNote && (
              <Card tone="peach" className="space-y-1">
                <p className="text-xs font-semibold text-peach-ink uppercase tracking-wide">
                  Active Resubmission Request Sent to Caregiver
                </p>
                <p className="text-sm text-charcoal leading-relaxed">
                  {submission.changeRequestNote}
                </p>
              </Card>
            )}

            {/* 2. Original Activity Instructions & Materials */}
            <Card padding="lg" className="space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-3">
                <h2 className="font-display text-lg font-semibold text-charcoal">
                  Original Activity Instructions
                </h2>
                <span className="text-xs font-mono text-muted tabular-nums">
                  {activity.durationMinutes} min · {activity.steps.length} steps
                </span>
              </div>

              <div className="rounded-lg bg-cream/70 border border-border px-3.5 py-2.5 space-y-1">
                <p className="text-xs font-semibold text-charcoal">Required Materials</p>
                <p className="text-xs text-muted">{activity.materials.join(' · ')}</p>
              </div>

              <ol className="divide-y divide-border">
                {activity.steps.map((s) => (
                  <li key={s.id} className="py-3 first:pt-0 last:pb-0 text-sm">
                    <p className="font-semibold text-charcoal">
                      {String(s.stepNumber).padStart(2, '0')}. {s.title}
                    </p>
                    <p className="text-muted text-xs mt-0.5 leading-relaxed">
                      {s.instructionText}
                    </p>
                    {s.caregiverTip && (
                      <p className="text-xs text-sage mt-1">Cue: {s.caregiverTip}</p>
                    )}
                  </li>
                ))}
              </ol>
            </Card>

            {/* 3. Safety Guidelines */}
            <Card tone="peach" className="space-y-2">
              <div className="flex items-center gap-2 text-peach-ink">
                <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
                <h2 className="font-display text-base font-semibold text-charcoal">
                  Safety Guidelines
                </h2>
              </div>
              <p className="text-sm text-charcoal/90 leading-relaxed">{activity.safetyNotes}</p>
            </Card>
          </div>

          {/* RIGHT COLUMN (5/12): 6. Evaluation Checklist & 7. Reviewer Comments + 5 Actions */}
          <form
            onSubmit={handlePublishEvaluation}
            className="lg:col-span-5 lg:sticky lg:top-6 space-y-5"
          >
            <Card padding="lg" className="space-y-5">
              {/* Live Weighted Score Readout */}
              <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-xl font-semibold text-charcoal">
                      Evaluation Checklist
                    </h2>
                    {review && (
                      <Badge tone={review.reviewStatus === 'draft' ? 'peach' : 'sage'}>
                        {review.reviewStatus === 'draft' ? 'Draft' : `v${review.version}`}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    (Earned ÷ Applicable weighted points) × 100
                  </p>
                </div>

                <div className="text-right shrink-0">
                  {liveScore.isAssessable && liveScore.scorePct !== null ? (
                    <>
                      <p className="font-mono text-3xl font-semibold text-sage tabular-nums">
                        {liveScore.scorePct}%
                      </p>
                      <p className="font-mono text-[11px] text-muted tabular-nums">
                        {liveScore.earnedTotal}/{liveScore.applicableTotal} applicable pts
                      </p>
                    </>
                  ) : (
                    <>
                      <Badge tone="peach">Not Assessable</Badge>
                      <p className="font-mono text-[11px] text-muted tabular-nums mt-1">
                        {liveScore.applicableTotal}/{liveScore.maxTotal} pts assessable
                      </p>
                    </>
                  )}
                </div>
              </div>

              {!liveScore.isAssessable && (
                <div className="rounded-lg border border-peach bg-peach-soft/60 px-3.5 py-2.5 text-xs text-charcoal leading-relaxed">
                  Less than 50% of this activity’s weighted rubric is assessable. Publishing will
                  record this clip as <strong>Not Assessable</strong> with your explanation rather
                  than a misleading percentage.
                </div>
              )}

              {/* Per-Activity Weighted Criteria */}
              <div className="space-y-3.5">
                {activity.rubricCriteria.map((criterion) => {
                  const current = ratings[criterion.id] ?? 'not_met';
                  const needsExplanation = current === 'not_assessable';
                  const showNoteField =
                    current === 'not_assessable' ||
                    current === 'not_met' ||
                    current === 'partially_met';

                  return (
                    <div
                      key={criterion.id}
                      className="rounded-xl border border-border bg-offwhite p-3.5 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-charcoal">{criterion.label}</p>
                          <p className="text-xs text-muted mt-0.5 leading-relaxed">
                            {criterion.description}
                          </p>
                        </div>
                        <span className="font-mono text-xs text-muted tabular-nums shrink-0">
                          {criterion.weightPoints} pts
                        </span>
                      </div>

                      <div
                        className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 rounded-lg bg-cream border border-border"
                        role="radiogroup"
                        aria-label={`Rating for ${criterion.label}`}
                      >
                        {RATING_OPTIONS.map((opt) => {
                          const active = current === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              role="radio"
                              aria-checked={active}
                              disabled={isReadOnlyAdmin}
                              onClick={() =>
                                setRatings((prev) => ({ ...prev, [criterion.id]: opt.id }))
                              }
                              className={`min-h-[38px] px-1.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer disabled:cursor-not-allowed ${
                                active
                                  ? opt.id === 'met'
                                    ? 'bg-sage text-white'
                                    : opt.id === 'partially_met'
                                      ? 'bg-peach text-charcoal'
                                      : opt.id === 'not_assessable'
                                        ? 'bg-lavender text-lavender-ink'
                                        : 'bg-charcoal text-white'
                                  : 'text-muted hover:text-charcoal'
                              }`}
                            >
                              <span className="block leading-tight">{opt.label}</span>
                              <span className="block text-[10px] opacity-80 font-mono tabular-nums">
                                {opt.weightHint}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {showNoteField && (
                        <div>
                          <label
                            htmlFor={`crit-exp-${criterion.id}`}
                            className="block text-[11px] font-medium text-charcoal mb-1"
                          >
                            {needsExplanation
                              ? 'Explanation required (excluded from score)'
                              : 'Brief observation for this criterion (optional)'}
                          </label>
                          <input
                            id={`crit-exp-${criterion.id}`}
                            type="text"
                            disabled={isReadOnlyAdmin}
                            value={explanations[criterion.id] ?? ''}
                            onChange={(e) =>
                              setExplanations((prev) => ({
                                ...prev,
                                [criterion.id]: e.target.value,
                              }))
                            }
                            placeholder={
                              needsExplanation
                                ? 'e.g., Camera angle did not show the mat setup clearly.'
                                : 'e.g., Gentle tone used; try slowing down step 2 slightly.'
                            }
                            className={`w-full rounded-lg border bg-surface px-3 py-2 text-xs text-charcoal focus:border-sage ${
                              needsExplanation && !(explanations[criterion.id]?.trim())
                                ? 'border-peach-ink'
                                : 'border-border-strong'
                            }`}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 7. Written Feedback & Reviewer Comments */}
              <div className="space-y-3.5 pt-3 border-t border-border">
                <div>
                  <label
                    htmlFor="rev-strengths"
                    className="block text-xs font-semibold text-charcoal mb-1"
                  >
                    Positive observations (visible to parent)
                  </label>
                  <textarea
                    id="rev-strengths"
                    rows={3}
                    disabled={isReadOnlyAdmin}
                    value={strengthsNote}
                    onChange={(e) => setStrengthsNote(e.target.value)}
                    placeholder="Highlight specific steps, setup choices, or calm pacing demonstrated well..."
                    className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-charcoal focus:border-sage"
                  />
                </div>

                <div>
                  <label
                    htmlFor="rev-tip"
                    className="block text-xs font-semibold text-charcoal mb-1"
                  >
                    Areas to improve next time (visible to parent)
                  </label>
                  <textarea
                    id="rev-tip"
                    rows={3}
                    disabled={isReadOnlyAdmin}
                    value={coachingTip}
                    onChange={(e) => setCoachingTip(e.target.value)}
                    placeholder="Share one clear, supportive adjustment for the next practice..."
                    className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-charcoal focus:border-sage"
                  />
                </div>

                <div>
                  <label
                    htmlFor="rev-comments"
                    className="block text-xs font-semibold text-charcoal mb-1"
                  >
                    Reviewer comments (optional summary note)
                  </label>
                  <textarea
                    id="rev-comments"
                    rows={2}
                    disabled={isReadOnlyAdmin}
                    value={reviewerComments}
                    onChange={(e) => setReviewerComments(e.target.value)}
                    placeholder="Any additional encouragement or clarification about the instructions..."
                    className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-charcoal focus:border-sage"
                  />
                </div>

                <label className="flex items-start gap-2.5 text-xs text-charcoal pt-1 cursor-pointer min-h-[44px]">
                  <input
                    type="checkbox"
                    disabled={isReadOnlyAdmin}
                    checked={scopeAcknowledged}
                    onChange={(e) => setScopeAcknowledged(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border-strong accent-sage shrink-0"
                  />
                  <span className="leading-relaxed">
                    I confirm this evaluation assesses only whether the caregiver followed the
                    activity instructions and safety guidelines—never the baby’s intelligence,
                    health, or developmental level.
                  </span>
                </label>
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-xs text-danger flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              {actionBanner && (
                <div
                  role="status"
                  className="rounded-lg border border-sage-border bg-sage-soft px-3.5 py-2.5 text-xs text-sage flex items-start gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{actionBanner}</span>
                </div>
              )}

              {/* Primary & Secondary Review Actions */}
              {!isReadOnlyAdmin && (
                <div className="space-y-2.5 pt-1">
                  <Button
                    type="submit"
                    variant="primary"
                    fullWidth
                    disabled={!canPublish}
                    loading={savingAction === 'publish'}
                    leftIcon={<ClipboardCheck className="w-4 h-4" />}
                  >
                    {isAlreadyPublished ? 'Update Evaluation (New Version)' : 'Submit Evaluation'}
                  </Button>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {!isAlreadyPublished && (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={savingAction !== null}
                        loading={savingAction === 'draft'}
                        leftIcon={<Save className="w-4 h-4" />}
                        onClick={() => void handleSaveDraft()}
                      >
                        Save Draft
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="secondary"
                      disabled={savingAction !== null}
                      leftIcon={<AlertCircle className="w-4 h-4 text-peach-ink" />}
                      onClick={() => {
                        setError(null);
                        setInsufficientModalOpen(true);
                      }}
                      className={isAlreadyPublished ? 'sm:col-span-2' : ''}
                    >
                      Mark Insufficient Evidence
                    </Button>
                  </div>

                  {!isAlreadyPublished && submission.hasActiveVideo && (
                    <Button
                      type="button"
                      variant="subtle"
                      fullWidth
                      disabled={savingAction !== null}
                      leftIcon={<RotateCcw className="w-4 h-4" />}
                      onClick={() => {
                        setError(null);
                        setResubmitModalOpen(true);
                      }}
                    >
                      Request Another Submission
                    </Button>
                  )}
                </div>
              )}
            </Card>
          </form>
        </div>

        {/* Review Audit History (Preserves Every Action & Prior Version) */}
        <Card padding="lg" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-sage" aria-hidden="true" />
              <h2 className="font-display text-lg font-semibold text-charcoal">
                Review Audit History
              </h2>
            </div>
            <span className="text-xs text-muted font-mono tabular-nums">
              {history.length} {history.length === 1 ? 'record' : 'records'}
            </span>
          </div>

          {history.length === 0 ? (
            <p className="text-sm text-muted">
              No review actions recorded yet. Saving a draft, requesting changes, or publishing an
              evaluation will log an immutable audit entry here.
            </p>
          ) : (
            <ol className="divide-y divide-border">
              {history.map((entry) => {
                const meta = formatAuditActionLabel(entry.action);
                return (
                  <li
                    key={entry.id}
                    className="py-3 first:pt-0 last:pb-0 flex flex-wrap items-start justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                        <span className="font-mono text-xs text-muted tabular-nums">
                          v{entry.version}
                        </span>
                        <span className="text-xs font-medium text-charcoal">
                          by {entry.actorName}
                        </span>
                      </div>
                      {entry.summaryNote && (
                        <p className="text-xs text-muted leading-relaxed">{entry.summaryNote}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0 space-y-0.5">
                      <p className="font-mono text-xs font-medium text-charcoal tabular-nums">
                        {entry.scorePct !== null
                          ? `${entry.scorePct}%`
                          : entry.action === 'marked_not_assessable'
                            ? 'Not Assessable'
                            : '—'}
                      </p>
                      <p className="font-mono text-[11px] text-muted tabular-nums">
                        {formatDateTimeReadable(entry.createdAt, locale)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>

        {/* Modal: Mark Evidence Insufficient (Not Assessable) */}
        <Modal
          open={insufficientModalOpen}
          onClose={() => setInsufficientModalOpen(false)}
          title="Mark Evidence Insufficient (Not Assessable)"
          description="Use this when lighting, camera framing, or clip length prevents a fair evaluation of caregiver instruction steps. No misleading percentage will be shown."
          footer={
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setInsufficientModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={savingAction === 'not_assessable'}
                onClick={() => void handleMarkEvidenceInsufficient()}
              >
                Confirm Not Assessable
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <label
              htmlFor="not-assessable-reason"
              className="block text-xs font-semibold text-charcoal"
            >
              Clear explanation for parent & audit log
            </label>
            <textarea
              id="not-assessable-reason"
              rows={4}
              value={insufficientReason}
              onChange={(e) => setInsufficientReason(e.target.value)}
              placeholder="e.g., The video stopped after 4 seconds before the main steps began, so we could not fairly assess the activity sequence."
              className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-charcoal focus:border-sage"
            />
          </div>
        </Modal>

        {/* Modal: Request Another Submission */}
        <Modal
          open={resubmitModalOpen}
          onClose={() => setResubmitModalOpen(false)}
          title="Request Another Submission"
          description="Send a warm, specific note explaining what would help make the next clip easier to coach."
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setResubmitModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={savingAction === 'request_changes'}
                onClick={() => void handleRequestAnotherSubmission()}
              >
                Send Request to Parent
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <label htmlFor="resubmit-note" className="block text-xs font-semibold text-charcoal">
              Gentle recording guidance
            </label>
            <textarea
              id="resubmit-note"
              rows={4}
              value={resubmitNote}
              onChange={(e) => setResubmitNote(e.target.value)}
              placeholder="e.g., Could you place your phone slightly further back in natural daylight so we can see both the mat setup and how you guide the toy?"
              className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-charcoal focus:border-sage"
            />
          </div>
        </Modal>
      </div>
    );
  }

  /* ========================================================================= */
  /* REVIEWER DASHBOARD & QUEUE OVERVIEW                                       */
  /* ========================================================================= */
  const ageOptions = [
    { value: 'all', label: 'All age groups' },
    ...ageGroups.map((ag) => ({ value: ag.slug, label: ag.label })),
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-24 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-1">
          <p className="text-xs font-medium text-sage">
            Authorized Reviewer Dashboard · Privacy-Minimized Queue
          </p>
          <h1 className="font-display text-3xl font-semibold text-charcoal">
            Caregiver Activity Reviews
          </h1>
          <p className="text-sm text-muted max-w-2xl">
            Evaluate how clearly the caregiver followed each activity’s instructions and safety
            guidance—never the baby’s intelligence, health, or developmental level.
          </p>
        </div>

        <Button variant="secondary" size="sm" onClick={() => void loadQueue()}>
          Refresh Queue
        </Button>
      </div>

      {/* 4 Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Pending Submissions</span>
            <Clock className="w-4 h-4 text-lavender-ink" aria-hidden="true" />
          </div>
          <p className="font-mono text-3xl font-semibold text-charcoal tabular-nums">
            {summary?.totalPending ?? 0}
          </p>
          <p className="text-xs text-muted">Waiting to be claimed</p>
        </Card>

        <Card className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Under Review</span>
            <FileEdit className="w-4 h-4 text-peach-ink" aria-hidden="true" />
          </div>
          <p className="font-mono text-3xl font-semibold text-charcoal tabular-nums">
            {summary?.underReview ?? 0}
          </p>
          <p className="text-xs text-muted">Active evaluations & drafts</p>
        </Card>

        <Card className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Completed Reviews</span>
            <CheckCircle2 className="w-4 h-4 text-sage" aria-hidden="true" />
          </div>
          <p className="font-mono text-3xl font-semibold text-charcoal tabular-nums">
            {summary?.completedReviews ?? 0}
          </p>
          <p className="text-xs text-muted">Published feedback</p>
        </Card>

        <Card className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Changes Requested</span>
            <RotateCcw className="w-4 h-4 text-peach-ink" aria-hidden="true" />
          </div>
          <p className="font-mono text-3xl font-semibold text-charcoal tabular-nums">
            {summary?.changesRequested ?? 0}
          </p>
          <p className="text-xs text-muted">Awaiting updated clip</p>
        </Card>
      </div>

      {/* Recently Submitted Videos */}
      {summary && summary.recentSubmissions.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold text-charcoal">
              Recently Submitted Videos
            </h2>
            <span className="text-xs text-muted">Most recent clips across all stages</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {summary.recentSubmissions.slice(0, 3).map((item) => {
              const sMeta = getStatusBadgeMeta(item.reviewStatus, item.hasDraftReview);
              const pMeta = getPriorityBadgeMeta(item.priority);
              return (
                <Card key={item.submissionId} className="flex flex-col justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-medium text-charcoal tabular-nums">
                        {item.parentReference}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Badge tone={pMeta.tone}>{pMeta.label}</Badge>
                        <Badge tone={sMeta.tone}>{sMeta.label}</Badge>
                      </div>
                    </div>
                    <div>
                      <p className="font-display text-base font-semibold text-charcoal leading-snug">
                        {item.activityTitle}
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        {item.ageGroupLabel} · v{item.activityVersion} ·{' '}
                        <span className="font-mono tabular-nums">
                          {formatDateTimeReadable(item.createdAt, locale)}
                        </span>
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    fullWidth
                    leftIcon={<Video className="w-3.5 h-3.5 text-sage" />}
                    onClick={() => void openSubmission(item)}
                  >
                    {item.reviewStatus === 'queued' && !isReadOnlyAdmin
                      ? 'Claim & Open'
                      : 'Open Review'}
                  </Button>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Non-Diagnostic & Privacy Policy Strip */}
      <Card tone="cream" padding="sm" className="flex items-start gap-2.5 text-xs text-muted">
        <ShieldCheck className="w-4 h-4 text-sage shrink-0 mt-0.5" aria-hidden="true" />
        <span>
          Parent contact information (name, email, phone) is hidden by design—only an opaque parent
          reference (<span className="font-mono">PAR-XXXXXX</span>) is displayed. Every video stream
          and review edit is logged for security auditing.
        </span>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div
          className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-cream border border-border"
          role="tablist"
          aria-label="Filter queue by review status"
        >
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'queued', label: 'Pending' },
              { id: 'in_review', label: 'Under Review' },
              { id: 'resubmit_requested', label: 'Changes Requested' },
              { id: 'reviewed', label: 'Reviewed' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={statusFilter === tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-surface text-charcoal border border-border'
                  : 'text-muted hover:text-charcoal'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-56">
          <Select
            label="Age group"
            options={ageOptions}
            value={ageFilter}
            onChange={(e) => setAgeFilter(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Review Queue Table */}
      {loadingQueue || loadingDetail ? (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : queue.length === 0 ? (
        <EmptyState
          title="No submissions matching this filter"
          description="When a caregiver uploads or records an activity video, it will appear here ready for rubric evaluation."
          actionLabel={statusFilter !== 'all' || ageFilter !== 'all' ? 'Reset Filters' : undefined}
          onAction={
            statusFilter !== 'all' || ageFilter !== 'all'
              ? () => {
                  setStatusFilter('all');
                  setAgeFilter('all');
                }
              : undefined
          }
        />
      ) : (
        <Card padding="none" className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-cream/60 text-xs font-semibold text-muted">
                <th className="py-3 px-4">Parent Ref</th>
                <th className="py-3 px-4">Activity & Version</th>
                <th className="py-3 px-4">Age Group</th>
                <th className="py-3 px-4">Submitted</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4 text-right">Result</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {queue.map((item) => {
                const sMeta = getStatusBadgeMeta(item.reviewStatus, item.hasDraftReview);
                const pMeta = getPriorityBadgeMeta(item.priority);
                return (
                  <tr key={item.submissionId} className="hover:bg-offwhite transition-colors">
                    <td className="py-3.5 px-4 font-mono text-xs font-medium text-charcoal tabular-nums whitespace-nowrap">
                      {item.parentReference}
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-medium text-charcoal">
                        {item.activityTitle}{' '}
                        <span className="font-mono text-xs text-muted">v{item.activityVersion}</span>
                      </p>
                      <p className="text-xs text-muted">{item.domainName}</p>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-charcoal tabular-nums whitespace-nowrap">
                      {item.ageGroupLabel}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-muted tabular-nums whitespace-nowrap">
                      {formatDateTimeReadable(item.createdAt, locale)}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex flex-col items-start gap-1">
                        <Badge tone={sMeta.tone}>{sMeta.label}</Badge>
                        {!item.hasActiveVideo && (
                          <span className="text-[11px] text-muted">Video removed</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <Badge tone={pMeta.tone}>{pMeta.label}</Badge>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                      {item.reviewStatus === 'reviewed' ? (
                        item.isAssessable === false || item.instructionMatchScorePct === null ? (
                          <span className="text-peach-ink font-medium">Not Assessable</span>
                        ) : (
                          <span className="text-sage font-semibold">
                            {item.instructionMatchScorePct}%
                          </span>
                        )
                      ) : item.hasDraftReview ? (
                        <span className="text-muted">Draft saved</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void openSubmission(item)}
                      >
                        {item.reviewStatus === 'queued' && !isReadOnlyAdmin
                          ? 'Claim & Review'
                          : item.reviewStatus === 'in_review'
                            ? 'Continue Review'
                            : item.reviewStatus === 'reviewed'
                              ? 'View / Edit'
                              : 'Inspect'}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

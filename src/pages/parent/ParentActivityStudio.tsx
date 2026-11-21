import React, { useState } from 'react';
import {
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  ShieldAlert,
  Trash2,
  Upload,
} from 'lucide-react';
import { InstructionalGuidePlayer } from '../../components/InstructionalGuidePlayer';
import { SecureVideoPlayer } from '../../components/SecureVideoPlayer';
import {
  getSubmissionStateBadge,
  mapServerSubmissionToUiState,
  VideoCaptureUploader,
} from '../../components/VideoCaptureUploader';
import { Badge, Button, Card, ConfirmDialog } from '../../design-system';
import { api } from '../../lib/api';
import { localizeActivityDetail } from '../../shared/hindiContent';
import { formatDateReadable, localizePrepLevel, translate } from '../../shared/i18n';
import type {
  ActivityDetail,
  CompletionStatus,
  LocaleCode,
  VideoSubmissionSummary,
} from '../../shared/types';

interface ParentActivityStudioProps {
  childId: string;
  childName: string;
  activity: ActivityDetail;
  completionStatus: CompletionStatus | null;
  initialNotes: string;
  latestSubmission: VideoSubmissionSummary | null;
  locale: LocaleCode;
  onBack: () => void;
  onProgressUpdated: () => Promise<void>;
  onOpenFeedback: () => void;
}

export function ParentActivityStudio({
  childId,
  childName,
  activity,
  completionStatus,
  initialNotes,
  latestSubmission,
  locale,
  onBack,
  onProgressUpdated,
  onOpenFeedback,
}: ParentActivityStudioProps) {
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({});
  const [reflectionNote, setReflectionNote] = useState(initialNotes);
  const [savingCompletion, setSavingCompletion] = useState(false);
  const [uploaderMode, setUploaderMode] = useState<'record' | 'upload' | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deletingVideo, setDeletingVideo] = useState(false);

  const isHi = locale === 'hi';
  const displayActivity = localizeActivityDetail(activity, locale);

  const isCompleted =
    completionStatus === 'completed' ||
    completionStatus === 'submitted_for_review' ||
    completionStatus === 'reviewed';

  const latestUiState = mapServerSubmissionToUiState(latestSubmission);
  const latestStateMeta = latestUiState ? getSubmissionStateBadge(latestUiState) : null;

  const handleMarkCompleted = async () => {
    setSavingCompletion(true);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      await api.saveCompletion({
        childId,
        activityId: activity.id,
        status: 'completed',
        caregiverNotes: reflectionNote,
      });
      setStatusMessage(
        isHi
          ? `${childName} की दैनिक डायरी में सहेजा गया।`
          : `Saved to ${childName}’s daily journal.`
      );
      await onProgressUpdated();
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : isHi
            ? 'अभी प्रगति सहेजी नहीं जा सकी। कृपया पुनः प्रयास करें।'
            : 'Unable to save activity progress right now.'
      );
    } finally {
      setSavingCompletion(false);
    }
  };

  const handleVideoSubmitted = async (submission: VideoSubmissionSummary) => {
    setUploaderMode(null);
    setStatusMessage(
      isHi
        ? 'अभ्यास वीडियो निजी स्टोरेज में भेज दिया गया है और देखभालकर्ता मार्गदर्शन के लिए कतार में है।'
        : submission.storageMode === 'production_object_storage'
          ? 'Practice clip submitted to private storage and queued for caregiver coaching.'
          : 'Practice clip submitted in Demo Storage Mode and queued for caregiver coaching.'
    );
    await onProgressUpdated();
  };

  const handleDeleteLatestVideo = async () => {
    if (!latestSubmission) return;
    setDeletingVideo(true);
    setErrorMessage(null);
    try {
      await api.deleteSubmissionVideo(latestSubmission.id);
      setConfirmDeleteOpen(false);
      setStatusMessage(
        isHi
          ? 'वीडियो स्टोरेज से स्थायी रूप से हटा दिया गया है। आपके लिखित सुझाव सुरक्षित रहेंगे।'
          : 'Video permanently removed from storage. Written coaching notes remain preserved.'
      );
      await onProgressUpdated();
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : isHi
            ? 'वीडियो हटाया नहीं जा सका।'
            : 'Could not delete video.'
      );
    } finally {
      setDeletingVideo(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="subtle"
          size="sm"
          leftIcon={<ArrowLeft className="w-4 h-4" />}
          onClick={onBack}
        >
          {translate(locale, 'studio.backToDashboard')}
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          {latestStateMeta && (
            <Badge tone={latestStateMeta.tone} icon={latestStateMeta.icon}>
              {latestStateMeta.label}
            </Badge>
          )}
          {isCompleted && !latestStateMeta && (
            <Badge tone="sage" icon={<CheckCircle2 className="w-3.5 h-3.5" />}>
              {translate(locale, 'status.completed')}
            </Badge>
          )}
        </div>
      </div>

      {/* Activity Title & Calm Metadata */}
      <div className="space-y-2">
        <p className="text-xs text-muted">
          {displayActivity.domainName} <span aria-hidden="true">·</span>{' '}
          {displayActivity.ageGroupLabel} <span aria-hidden="true">·</span>{' '}
          <span className="font-mono tabular-nums">
            {displayActivity.durationMinutes} {translate(locale, 'common.min')}
          </span>{' '}
          <span aria-hidden="true">·</span> {localizePrepLevel(displayActivity.prepLevel, locale)}{' '}
          <span aria-hidden="true">·</span>{' '}
          <span className="font-mono tabular-nums">v{displayActivity.version}</span>
        </p>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold text-charcoal">
          {displayActivity.title}
        </h1>
        <p className="text-sm sm:text-base text-muted leading-relaxed max-w-2xl">
          {displayActivity.summary}
        </p>
      </div>

      {/* Interactive Step-Paced Instructional Guide */}
      <InstructionalGuidePlayer
        posterUrl={displayActivity.instructionalPosterUrl}
        activityTitle={displayActivity.title}
        steps={displayActivity.steps}
        locale={locale}
      />

      {/* Everyday Items & Calm Safety Reminder */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-charcoal">
            {translate(locale, 'studio.everydayItems')}
          </h2>
          <ul className="space-y-2 text-sm text-muted">
            {displayActivity.materials.map((mat, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="font-mono text-xs text-sage mt-0.5 tabular-nums">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-charcoal">{mat}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card tone="peach" className="space-y-2.5">
          <div className="flex items-center gap-2 text-peach-ink">
            <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
            <h2 className="font-display text-lg font-semibold text-charcoal">
              {translate(locale, 'studio.safetyReminder')}
            </h2>
          </div>
          <p className="text-sm text-charcoal/90 leading-relaxed">{displayActivity.safetyNotes}</p>
        </Card>
      </div>

      {/* Step-by-Step Caregiver Instructions */}
      <Card padding="lg" className="space-y-5">
        <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
          <h2 className="font-display text-xl font-semibold text-charcoal">
            {translate(locale, 'studio.stepByStep')}
          </h2>
          <span className="text-xs text-muted font-mono tabular-nums">
            {Object.values(checkedSteps).filter(Boolean).length} / {displayActivity.steps.length}{' '}
            {isHi ? 'चरण पूरे हुए' : 'steps tried'}
          </span>
        </div>

        <ol className="divide-y divide-border">
          {displayActivity.steps.map((step) => {
            const checked = Boolean(checkedSteps[step.id]);
            return (
              <li key={step.id} className="py-4 first:pt-1 last:pb-1">
                <label className="flex items-start gap-3.5 cursor-pointer min-h-[44px]">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setCheckedSteps((prev) => ({ ...prev, [step.id]: !prev[step.id] }))
                    }
                    className="mt-1 h-4 w-4 rounded border-border-strong accent-sage shrink-0"
                  />
                  <div className="space-y-1 flex-1">
                    <p
                      className={`text-sm font-semibold ${
                        checked ? 'text-muted line-through' : 'text-charcoal'
                      }`}
                    >
                      {String(step.stepNumber).padStart(2, '0')}. {step.title}
                    </p>
                    <p className="text-sm text-muted leading-relaxed">{step.instructionText}</p>
                    {step.caregiverTip && (
                      <p className="text-xs text-sage pt-0.5">
                        {translate(locale, 'studio.gentleCue')}: {step.caregiverTip}
                      </p>
                    )}
                  </div>
                </label>
              </li>
            );
          })}
        </ol>
      </Card>

      {/* Completion & Caregiver Video Submission */}
      <section className="space-y-4">
        {statusMessage && (
          <div
            role="status"
            className="rounded-xl border border-sage-border bg-sage-soft px-4 py-3 text-sm text-sage flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{statusMessage}</span>
          </div>
        )}

        {errorMessage && (
          <p role="alert" className="text-sm text-danger bg-danger-soft px-4 py-3 rounded-xl">
            {errorMessage}
          </p>
        )}

        {!uploaderMode ? (
          <Card padding="lg" className="space-y-5">
            <div className="space-y-1">
              <h2 className="font-display text-xl font-semibold text-charcoal">
                {translate(locale, 'studio.finishTitle')}
              </h2>
              <p className="text-sm text-muted leading-relaxed">
                {isHi
                  ? `अपना अभ्यास ${childName} की दैनिक डायरी में सहेजें, या एक छोटा निजी वीडियो रिकॉर्ड/अपलोड करें ताकि समीक्षक गतिविधि के चरणों पर प्यार भरा मार्गदर्शन दे सकें।`
                  : `Save your practice to ${childName}’s daily journal, or record/upload a short clip so a reviewer can share warm feedback on how clearly the activity steps were demonstrated.`}
              </p>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="studio-reflection-note"
                className="block text-xs font-medium text-charcoal"
              >
                {translate(locale, 'studio.reflectionLabel')}
              </label>
              <textarea
                id="studio-reflection-note"
                rows={2}
                value={reflectionNote}
                onChange={(e) => setReflectionNote(e.target.value)}
                placeholder={translate(locale, 'studio.reflectionPlaceholder')}
                className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-sm text-charcoal focus:border-sage"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button
                variant="primary"
                loading={savingCompletion}
                leftIcon={<Check className="w-4 h-4" />}
                onClick={() => void handleMarkCompleted()}
              >
                {isCompleted
                  ? translate(locale, 'studio.updateNote')
                  : translate(locale, 'studio.markCompleted')}
              </Button>

              <Button
                variant="secondary"
                leftIcon={<Camera className="w-4 h-4 text-sage" />}
                onClick={() => setUploaderMode('record')}
              >
                {translate(locale, 'studio.recordActivity')}
              </Button>

              <Button
                variant="secondary"
                leftIcon={<Upload className="w-4 h-4 text-sage" />}
                onClick={() => setUploaderMode('upload')}
              >
                {translate(locale, 'studio.uploadVideo')}
              </Button>
            </div>
          </Card>
        ) : (
          <VideoCaptureUploader
            childId={childId}
            childName={childName}
            activityId={activity.id}
            activityTitle={displayActivity.title}
            activityVersion={activity.version}
            initialMode={uploaderMode}
            existingSubmission={latestSubmission}
            onSubmitted={handleVideoSubmitted}
            onCancel={() => setUploaderMode(null)}
          />
        )}

        {/* Existing Submission Status Card with Linked Metadata, Preview & Secure Deletion */}
        {latestSubmission && !uploaderMode && (
          <Card tone="cream" padding="lg" className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-3.5">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  {latestStateMeta ? (
                    <Badge tone={latestStateMeta.tone} icon={latestStateMeta.icon}>
                      {latestStateMeta.label}
                    </Badge>
                  ) : (
                    <Badge tone="neutral">Video deleted</Badge>
                  )}
                  <Badge tone="neutral">
                    Activity v{latestSubmission.activityVersion}
                  </Badge>
                  {latestSubmission.consentRecordId && (
                    <Badge tone="sage">Consent recorded</Badge>
                  )}
                </div>
                <p className="text-xs text-muted">
                  Submitted {formatDateReadable(latestSubmission.createdAt, locale)}
                  {latestSubmission.storageMode === 'demo_local_vault'
                    ? ' · Demo Storage Mode'
                    : ' · Private Cloud Storage'}
                </p>
                <p className="text-sm font-medium text-charcoal">
                  {latestSubmission.review
                    ? latestSubmission.review.isAssessable &&
                      latestSubmission.review.instructionMatchScorePct !== null
                      ? `Reviewed · Caregiver Instruction-Match: ${latestSubmission.review.instructionMatchScorePct}%`
                      : `Reviewed · Not Assessable${
                          latestSubmission.review.notAssessableReason
                            ? ` — ${latestSubmission.review.notAssessableReason}`
                            : ''
                        }`
                    : latestSubmission.reviewStatus === 'resubmit_requested'
                      ? latestSubmission.changeRequestNote ||
                        'Your reviewer requested an updated clip for clearer coaching feedback.'
                      : latestSubmission.reviewStatus === 'in_review'
                        ? 'Currently under review by your caregiver coach.'
                        : latestSubmission.reviewStatus === 'deleted'
                          ? 'Practice clip was removed from storage.'
                          : 'Submitted and queued for caregiver coaching review.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {latestSubmission.reviewStatus === 'resubmit_requested' && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setUploaderMode('record')}
                  >
                    Submit Updated Clip
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={onOpenFeedback}>
                  View in Progress & Feedback
                </Button>
              </div>
            </div>

            <SecureVideoPlayer
              submissionId={latestSubmission.id}
              hasActiveVideo={latestSubmission.hasActiveVideo}
              expiresAt={latestSubmission.expiresAt}
              deletionReason={latestSubmission.deletionReason}
              storageMode={latestSubmission.storageMode}
            />

            {latestSubmission.hasActiveVideo && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <p className="text-xs text-muted font-mono tabular-nums">
                  Ref: {latestSubmission.storageReference || latestSubmission.id}
                </p>
                <Button
                  variant="danger"
                  size="sm"
                  leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                  onClick={() => setConfirmDeleteOpen(true)}
                >
                  Delete Video Now
                </Button>
              </div>
            )}
          </Card>
        )}
      </section>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={() => void handleDeleteLatestVideo()}
        title="Delete practice video permanently?"
        message="This removes the uploaded video immediately from storage. Your written caregiver coaching feedback remains preserved."
        confirmLabel="Delete Video"
        destructive
        loading={deletingVideo}
      />
    </div>
  );
}

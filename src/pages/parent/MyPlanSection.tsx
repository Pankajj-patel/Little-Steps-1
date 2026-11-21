import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  Calendar,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  Clock,
  History,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import { EditorialImage } from '../../components/EditorialImage';
import {
  ActivityCard,
  Badge,
  Button,
  Card,
  EmptyState,
  ProgressIndicator,
  Tabs,
  type BadgeTone,
} from '../../design-system';
import {
  localizeActivitySummary,
  localizeActivityTitleById,
  localizePlanTitleAndFocus,
} from '../../shared/hindiContent';
import {
  formatDateReadable,
  localizeAgeGroupLabel,
  localizeDomainName,
  localizePrepLevel,
  translate,
} from '../../shared/i18n';
import type {
  ActivityDetail,
  ActivityPrepLevel,
  JourneyActivityItem,
  JourneyDisplayStatus,
  LocaleCode,
  TodayJourneyResponse,
} from '../../shared/types';

export function formatPrepLevel(
  prepLevel?: ActivityPrepLevel,
  locale: LocaleCode = 'en'
): string {
  return localizePrepLevel(prepLevel, locale);
}

export function getJourneyStatusMeta(
  item: JourneyActivityItem,
  locale: LocaleCode = 'en'
): {
  statusState: JourneyDisplayStatus;
  statusText: string;
  statusTone: BadgeTone;
  actionLabel: string;
} {
  const statusState = item.displayStatus;
  const isHi = locale === 'hi';
  switch (statusState) {
    case 'reviewed': {
      const review = item.latestSubmission?.review;
      const score = review?.instructionMatchScorePct;
      const statusText =
        review && !review.isAssessable
          ? isHi
            ? 'समीक्षित · मूल्यांकन संभव नहीं'
            : 'Reviewed · Not Assessable'
          : score !== undefined && score !== null
            ? `${translate(locale, 'status.reviewed')} · ${score}%`
            : translate(locale, 'status.reviewed');
      return {
        statusState,
        statusText,
        statusTone: review && !review.isAssessable ? 'peach' : 'sage',
        actionLabel: translate(locale, 'action.readFeedback'),
      };
    }
    case 'submitted_for_review':
      return {
        statusState,
        statusText: translate(locale, 'status.submittedForReview'),
        statusTone: 'lavender',
        actionLabel: translate(locale, 'action.viewSubmission'),
      };
    case 'completed':
      return {
        statusState,
        statusText: translate(locale, 'status.completed'),
        statusTone: 'sage',
        actionLabel: translate(locale, 'action.viewActivity'),
      };
    case 'in_progress':
      return {
        statusState,
        statusText: translate(locale, 'status.inProgress'),
        statusTone: 'peach',
        actionLabel: translate(locale, 'action.resumeActivity'),
      };
    case 'not_started':
    default:
      return {
        statusState: 'not_started',
        statusText: translate(locale, 'status.notStarted'),
        statusTone: 'neutral',
        actionLabel: translate(locale, 'action.startActivity'),
      };
  }
}

interface MyPlanSectionProps {
  journey: TodayJourneyResponse;
  selectedDay: number;
  locale: LocaleCode;
  onSelectDay: (dayNumber: number) => void;
  onOpenActivity: (activityOrId: ActivityDetail | string) => void;
  onOpenLibrary: () => void;
}

type PlanTab = 'today' | 'upcoming' | 'completed';

export function MyPlanSection({
  journey,
  selectedDay,
  locale,
  onSelectDay,
  onOpenActivity,
  onOpenLibrary,
}: MyPlanSectionProps) {
  const [activeTab, setActiveTab] = useState<PlanTab>('today');

  const todayFormatted = useMemo(() => {
    const dt = new Date(`${journey.learningWeek.todayDateIso}T12:00:00`);
    return new Intl.DateTimeFormat(locale === 'hi' ? 'hi-IN' : 'en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(dt);
  }, [journey.learningWeek.todayDateIso, locale]);

  const isHi = locale === 'hi';
  const localizedChildAge = localizeAgeGroupLabel(
    journey.child.ageGroupSlug,
    journey.child.ageGroupLabel,
    locale
  );
  const localizedSelectedDay = localizePlanTitleAndFocus(
    journey.selectedDay.title,
    journey.selectedDay.focusNote,
    journey.selectedDay.dayNumber,
    locale
  );

  // Unique domains covered across today's selected plan + upcoming days
  const stageDomainsCovered = useMemo(() => {
    const names = new Set<string>();
    journey.items.forEach((i) =>
      names.add(localizeDomainName(i.activity.domainSlug, i.activity.domainName, locale))
    );
    journey.upcomingDays.forEach((d) =>
      d.activities.forEach((a) => names.add(localizeDomainName(a.domainSlug, a.domainName, locale)))
    );
    return Array.from(names);
  }, [journey.items, journey.upcomingDays, locale]);

  const todaysDomains = useMemo(
    () =>
      Array.from(
        new Set(
          journey.items.map((i) =>
            localizeDomainName(i.activity.domainSlug, i.activity.domainName, locale)
          )
        )
      ),
    [journey.items, locale]
  );

  const tabs = [
    {
      id: 'today',
      label: isHi ? 'आज की गतिविधियाँ' : "Today's Activities",
      count: journey.items.length,
    },
    {
      id: 'upcoming',
      label: isHi ? 'आने वाले दिन' : 'Upcoming Days',
      count: journey.upcomingDays.length,
    },
    {
      id: 'completed',
      label: isHi ? 'पूर्ण इतिहास' : 'Completed History',
      count: journey.completedHistory.length,
    },
  ];

  return (
    <div className="space-y-6">
      {/* ================================================================= */}
      {/* PLAN HEADER SUMMARY: BABY AGE, LEARNING WEEK, DATE & PROGRESS     */}
      {/* ================================================================= */}
      <Card tone="sage" padding="lg" className="space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="sage">
                {journey.child.displayName} · {journey.child.ageInMonths}{' '}
                {journey.child.ageInMonths === 1
                  ? translate(locale, 'common.month')
                  : translate(locale, 'common.months')}{' '}
                ({localizedChildAge})
              </Badge>
              <Badge tone="neutral">
                {isHi
                  ? `सप्ताह ${journey.learningWeek.weekNumber} / ${journey.learningWeek.totalStageWeeks}`
                  : `Week ${journey.learningWeek.weekNumber} of ${journey.learningWeek.totalStageWeeks}`}
              </Badge>
            </div>

            <div className="space-y-1">
              <h1 className="font-display text-2xl sm:text-3xl font-semibold text-charcoal tracking-tight">
                {translate(locale, 'nav.myPlan')}
              </h1>
              <p className="text-sm text-muted flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="inline-flex items-center gap-1.5 text-charcoal font-medium">
                  <Calendar className="w-4 h-4 text-sage" aria-hidden="true" />
                  {todayFormatted}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {isHi ? `चरण: ${localizedChildAge}` : `Stage: ${journey.learningWeek.stageLabel}`}
                </span>
              </p>
            </div>
          </div>

          {/* Daily Completion Progress Ring + Readout */}
          <div className="flex items-center gap-4 bg-surface/80 border border-sage-border rounded-xl px-4 py-3 self-start lg:self-auto shrink-0">
            <ProgressIndicator
              variant="ring"
              value={journey.todaySummary.completionPct}
              max={100}
              label={isHi ? 'आज की प्रगति' : "Today's progress"}
              sublabel={
                isHi
                  ? `${journey.todaySummary.totalTodayCount} में से ${journey.todaySummary.completedTodayCount} पूर्ण`
                  : `${journey.todaySummary.completedTodayCount} of ${journey.todaySummary.totalTodayCount} done`
              }
              tone="sage"
            />
          </div>
        </div>

        {/* Linear daily progress bar */}
        <div className="pt-1">
          <ProgressIndicator
            value={journey.todaySummary.completedTodayCount}
            max={Math.max(1, journey.todaySummary.totalTodayCount)}
            label={`${translate(locale, 'dashboard.dailyCompletion')} · ${localizedSelectedDay.title}`}
            sublabel={`${journey.todaySummary.completedTodayCount}/${journey.todaySummary.totalTodayCount} (${journey.todaySummary.completionPct}%)`}
            tone="sage"
          />
        </div>
      </Card>

      {/* ================================================================= */}
      {/* RESUME UNFINISHED ACTIVITY CALLOUT (WHEN IN-PROGRESS EXISTS)      */}
      {/* ================================================================= */}
      {journey.inProgressItems.length > 0 && (
        <section aria-label="Resume unfinished activity">
          <Card
            tone="peach"
            padding="md"
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-3.5 min-w-0">
              <span className="w-10 h-10 rounded-xl bg-surface border border-peach text-peach-ink inline-flex items-center justify-center shrink-0">
                <PlayCircle className="w-5 h-5" aria-hidden="true" />
              </span>
              <div className="space-y-0.5 min-w-0">
                <p className="text-xs font-semibold text-peach-ink uppercase tracking-wide">
                  Resume unfinished activity
                </p>
                <p className="font-display text-lg font-semibold text-charcoal truncate">
                  {journey.inProgressItems[0].activity.title}
                </p>
                <p className="text-xs text-muted">
                  {journey.inProgressItems[0].activity.domainName} ·{' '}
                  <span className="font-mono tabular-nums">
                    {journey.inProgressItems[0].activity.durationMinutes} min
                  </span>{' '}
                  · {formatPrepLevel(journey.inProgressItems[0].activity.prepLevel)}
                </p>
              </div>
            </div>

            <Button
              variant="primary"
              size="md"
              className="shrink-0"
              rightIcon={<ArrowRight className="w-4 h-4" />}
              onClick={() => onOpenActivity(journey.inProgressItems[0].activity)}
            >
              Resume Activity
            </Button>
          </Card>
        </section>
      )}

      {/* ================================================================= */}
      {/* PLAN NAVIGATION TABS: TODAY / UPCOMING / COMPLETED HISTORY        */}
      {/* ================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          tabs={tabs}
          activeTabId={activeTab}
          onChange={(id) => setActiveTab(id as PlanTab)}
          ariaLabel="Learning journey views"
        />

        {activeTab === 'today' && journey.availableDays.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5" aria-label="Choose plan day">
            {journey.availableDays.map((day) => {
              const active = day.dayNumber === selectedDay;
              return (
                <button
                  key={day.dayNumber}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSelectDay(day.dayNumber)}
                  className={`min-h-[40px] px-3.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-sage text-white border-sage'
                      : 'bg-surface border-border text-charcoal hover:bg-cream'
                  }`}
                >
                  Day {day.dayNumber}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* TAB 1: TODAY'S ACTIVITIES                                         */}
      {/* ================================================================= */}
      {activeTab === 'today' && (
        <div className="space-y-6">
          {/* Calm Day Focus Banner */}
          <Card tone="cream" className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-semibold text-charcoal">
                {localizedSelectedDay.title}
              </h2>
              <span className="text-xs text-muted">
                {isHi ? 'आज के मुख्य क्षेत्र: ' : 'Focus areas today: '}
                <strong className="font-medium text-charcoal">
                  {todaysDomains.length > 0
                    ? todaysDomains.join(' · ')
                    : isHi
                      ? 'उम्र के अनुसार खेल'
                      : 'Age-matched play'}
                </strong>
              </span>
            </div>
            <p className="text-sm text-muted leading-relaxed">
              {localizedSelectedDay.focusNote}
            </p>
          </Card>

          {journey.items.length === 0 ? (
            <EmptyState
              title={
                isHi
                  ? `दिन ${selectedDay} के लिए अभी कोई गतिविधि नहीं है`
                  : `No activities scheduled for Day ${selectedDay} yet`
              }
              description={
                isHi
                  ? `${localizedChildAge} की गतिविधि लाइब्रेरी से आज के लिए कोई शांत गतिविधि चुनें।`
                  : `Browse the full ${localizedChildAge} activity library to pick a calm activity for today.`
              }
              actionLabel={isHi ? 'गतिविधि लाइब्रेरी देखें' : 'Browse Activity Library'}
              onAction={onOpenLibrary}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {journey.items.map((item) => {
                const meta = getJourneyStatusMeta(item, locale);
                const localized = localizeActivitySummary(item.activity, locale);
                return (
                  <ActivityCard
                    key={item.planItemId}
                    title={localized.title}
                    summary={localized.summary}
                    domainName={localized.domainName}
                    ageGroupLabel={localized.ageGroupLabel}
                    durationMinutes={localized.durationMinutes}
                    prepLevelLabel={formatPrepLevel(localized.prepLevel, locale)}
                    materials={localized.materials}
                    posterUrl={localized.instructionalPosterUrl}
                    statusText={meta.statusText}
                    statusTone={meta.statusTone}
                    statusState={meta.statusState}
                    completed={
                      meta.statusState === 'completed' ||
                      meta.statusState === 'submitted_for_review' ||
                      meta.statusState === 'reviewed'
                    }
                    actionLabel={meta.actionLabel}
                    onAction={() => onOpenActivity(item.activity)}
                  />
                );
              })}
            </div>
          )}

          {/* Quiet 5-State Visual Legend */}
          <Card className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-charcoal uppercase tracking-wide">
                Activity Status Guide
              </p>
              <p className="text-xs text-muted">
                An activity becomes Reviewed only after a reviewer shares written coaching feedback.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge tone="neutral" icon={<CircleDashed className="w-3.5 h-3.5" />}>
                Not started
              </Badge>
              <Badge tone="peach" icon={<PlayCircle className="w-3.5 h-3.5" />}>
                In progress
              </Badge>
              <Badge tone="sage" icon={<CheckCircle2 className="w-3.5 h-3.5" />}>
                Completed
              </Badge>
              <Badge tone="lavender" icon={<UploadCloud className="w-3.5 h-3.5" />}>
                Submitted for review
              </Badge>
              <Badge tone="sage" icon={<Award className="w-3.5 h-3.5" />}>
                Reviewed
              </Badge>
            </div>
          </Card>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 2: UPCOMING ACTIVITIES                                        */}
      {/* ================================================================= */}
      {activeTab === 'upcoming' && (
        <div className="space-y-5">
          {journey.upcomingDays.length === 0 ? (
            <EmptyState
              icon={<CalendarClock className="w-6 h-6" />}
              title="You are viewing the latest day in this stage"
              description="You can revisit earlier days in Today's Activities or explore extra ideas in the Activity Library."
              actionLabel="Browse Activity Library"
              onAction={onOpenLibrary}
            />
          ) : (
            journey.upcomingDays.map((upDay) => {
              const dateLabel = formatDateReadable(`${upDay.scheduledDate}T12:00:00`, locale);
              const localizedUpDay = localizePlanTitleAndFocus(
                upDay.title,
                upDay.focusNote,
                upDay.dayNumber,
                locale
              );
              return (
                <Card key={upDay.dayNumber} padding="lg" className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3.5">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="neutral">
                          {translate(locale, 'common.day')} {upDay.dayNumber}
                        </Badge>
                        <span className="font-mono text-xs text-muted tabular-nums">
                          {isHi ? `${dateLabel} के लिए नियोजित` : `Planned for ${dateLabel}`}
                        </span>
                      </div>
                      <h2 className="font-display text-xl font-semibold text-charcoal">
                        {localizedUpDay.title}
                      </h2>
                      <p className="text-sm text-muted">{localizedUpDay.focusNote}</p>
                    </div>

                    <Button
                      variant="subtle"
                      size="sm"
                      onClick={() => {
                        onSelectDay(upDay.dayNumber);
                        setActiveTab('today');
                      }}
                    >
                      {isHi ? `दिन ${upDay.dayNumber} पर जाएँ` : `Switch to Day ${upDay.dayNumber}`}
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {upDay.activities.map((rawAct) => {
                      const act = localizeActivitySummary(rawAct, locale);
                      return (
                        <div
                          key={`${upDay.dayNumber}-${act.id}`}
                          className="rounded-xl border border-border bg-offwhite p-4 flex flex-col sm:flex-row gap-4 justify-between"
                        >
                          <div className="flex items-start gap-3.5 min-w-0">
                            <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0">
                              <EditorialImage
                                src={act.instructionalPosterUrl}
                                alt={act.title}
                                aspectClassName="w-full h-full"
                              />
                            </div>
                            <div className="space-y-1 min-w-0">
                              <p className="text-xs text-muted">
                                {act.domainName} ·{' '}
                                <span className="font-mono tabular-nums">
                                  {act.durationMinutes} {translate(locale, 'common.min')}
                                </span>{' '}
                                · {formatPrepLevel(act.prepLevel, locale)}
                              </p>
                              <h3 className="font-display text-base font-semibold text-charcoal leading-snug">
                                {act.title}
                              </h3>
                              {act.materials.length > 0 && (
                                <p className="text-xs text-muted line-clamp-1">
                                  {isHi ? 'सामग्री: ' : 'Materials: '}
                                  <span className="text-charcoal">
                                    {act.materials.slice(0, 3).join(', ')}
                                  </span>
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex sm:flex-col items-center sm:items-end justify-end shrink-0">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => onOpenActivity(act.id)}
                            >
                              {isHi ? 'गतिविधि देखें' : 'Preview Activity'}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 3: PREVIOUSLY COMPLETED ACTIVITIES (IMMUTABLE HISTORY)        */}
      {/* ================================================================= */}
      {activeTab === 'completed' && (
        <div className="space-y-5">
          {journey.completedHistory.length === 0 ? (
            <EmptyState
              icon={<History className="w-6 h-6" />}
              title="No completed activities yet"
              description="Once you finish an activity with your baby, it will stay safely saved right here—even as your baby grows into new age stages."
              actionLabel="View Today's Activities"
              onAction={() => setActiveTab('today')}
            />
          ) : (
            <div className="space-y-3">
              {journey.completedHistory.map((record) => {
                const isReviewed = record.displayStatus === 'reviewed';
                const isSubmitted = record.displayStatus === 'submitted_for_review';
                const badgeTone: BadgeTone = isSubmitted ? 'lavender' : 'sage';
                const badgeIcon = isReviewed ? (
                  <Award className="w-3.5 h-3.5" />
                ) : isSubmitted ? (
                  <UploadCloud className="w-3.5 h-3.5" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                );
                const badgeLabel = isReviewed
                  ? record.reviewScorePct !== null
                    ? `Reviewed · ${record.reviewScorePct}%`
                    : 'Reviewed'
                  : isSubmitted
                    ? 'Submitted for review'
                    : 'Completed';

                return (
                  <Card
                    key={record.completionId}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={badgeTone} icon={badgeIcon}>
                          {badgeLabel}
                        </Badge>
                        <Badge tone="neutral">
                          Completed in {record.ageGroupLabelSnapshot}
                        </Badge>
                      </div>

                      <h3 className="font-display text-lg font-semibold text-charcoal leading-snug">
                        {localizeActivityTitleById(record.activityId, record.activityTitle, locale)}
                      </h3>

                      <p className="text-xs text-muted flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span>{localizeDomainName(record.domainName, record.domainName, locale)}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {record.durationMinutes} {translate(locale, 'common.min')}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{formatPrepLevel(record.prepLevel, locale)}</span>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" aria-hidden="true" />
                          {formatDateReadable(record.completedAt, locale)}
                        </span>
                      </p>

                      {record.caregiverNotes && (
                        <p className="text-xs text-charcoal bg-cream/70 border border-border rounded-lg px-3 py-2 max-w-2xl">
                          “{record.caregiverNotes}”
                        </p>
                      )}
                    </div>

                    <div className="shrink-0">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onOpenActivity(record.activityId)}
                      >
                        Revisit Activity
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          <Card tone="cream" className="flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-sage shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-xs text-muted leading-relaxed">
              Your baby’s past completions always keep the age stage they were completed in. When
              your baby moves into a new age group, today’s and upcoming plans automatically update
              without altering your earlier history.
            </p>
          </Card>
        </div>
      )}

      {/* ================================================================= */}
      {/* CALM WEEKLY DOMAIN BALANCE FOOTNOTE                               */}
      {/* ================================================================= */}
      <Card className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="w-9 h-9 rounded-lg bg-sage-soft text-sage inline-flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" aria-hidden="true" />
          </span>
          <div className="space-y-1">
            <h3 className="font-display text-base font-semibold text-charcoal">
              Balanced across six development areas, paced gently
            </h3>
            <p className="text-xs sm:text-sm text-muted leading-relaxed max-w-2xl">
              Rather than crowding all six areas into a single day, {journey.child.displayName}’s{' '}
              {journey.child.ageGroupLabel} plan spaces 2–3 short activities per day so every week
              nurtures{' '}
              <span className="text-charcoal">
                {stageDomainsCovered.length > 0
                  ? stageDomainsCovered.join(', ')
                  : 'cognitive, language, physical, social-emotional, sensory, and early independence skills'}
              </span>{' '}
              at a calm home pace.
            </p>
          </div>
        </div>

        <Button
          variant="subtle"
          size="sm"
          className="shrink-0 self-start"
          rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
          onClick={onOpenLibrary}
        >
          Explore Library
        </Button>
      </Card>
    </div>
  );
}

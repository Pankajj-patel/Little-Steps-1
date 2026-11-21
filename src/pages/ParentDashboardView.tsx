import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Baby,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Compass,
  Hand,
  Heart,
  Home,
  LayoutGrid,
  Lightbulb,
  LogOut,
  MailCheck,
  Menu,
  MessageCircle,
  PlayCircle,
  Settings,
  Sparkles,
  Sprout,
  Sun,
  User,
  X,
} from 'lucide-react';
import { EditorialImage } from '../components/EditorialImage';
import { useAuth } from '../context/AuthContext';
import {
  ActivityCard,
  Badge,
  Button,
  Card,
  EmptyState,
  MobileBottomNav,
  ProgressIndicator,
  Skeleton,
  SkeletonCard,
  useToast,
} from '../design-system';
import { api } from '../lib/api';
import type { NavigateTarget } from '../lib/router';
import { formatDateReadable } from '../shared/i18n';
import type {
  ActivityDetail,
  ChildProfile,
  CompletionStatus,
  JourneyActivityItem,
  ParentNotificationItem,
  TodayJourneyResponse,
} from '../shared/types';
import {
  formatPrepLevel,
  getJourneyStatusMeta,
  MyPlanSection,
} from './parent/MyPlanSection';
import { ParentActivityStudio } from './parent/ParentActivityStudio';
import {
  ActivitiesLibrarySection,
  NotificationsSection,
  ParentingGuidesSection,
  ProfileSection,
  SettingsSection,
} from './parent/ParentSecondaryViews';
import { ProgressDashboardSection } from './parent/ProgressDashboardSection';

export type ParentSection =
  | 'today'
  | 'my-plan'
  | 'activities'
  | 'progress'
  | 'guides'
  | 'notifications'
  | 'profile'
  | 'settings';

interface ParentDashboardViewProps {
  onNavigate: (target: NavigateTarget) => void;
  onOpenDesignSystem: () => void;
  onLogout: () => Promise<void>;
}

function getTimeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const DOMAIN_ICONS: Record<string, React.ReactNode> = {
  cognitive: <Sparkles className="w-4 h-4" aria-hidden="true" />,
  language: <MessageCircle className="w-4 h-4" aria-hidden="true" />,
  physical: <Compass className="w-4 h-4" aria-hidden="true" />,
  'social-emotional': <Heart className="w-4 h-4" aria-hidden="true" />,
  sensory: <Sun className="w-4 h-4" aria-hidden="true" />,
  'early-independence': <Hand className="w-4 h-4" aria-hidden="true" />,
};

export function ParentDashboardView({
  onNavigate,
  onOpenDesignSystem,
  onLogout,
}: ParentDashboardViewProps) {
  const {
    user,
    locale,
    ageGroups,
    learningDomains,
    verificationPreviewPath,
    t,
  } = useAuth();
  const { notify } = useToast();

  const [section, setSection] = useState<ParentSection>('today');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Core data state
  const [childrenList, setChildrenList] = useState<ChildProfile[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [journey, setJourney] = useState<TodayJourneyResponse | null>(null);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [loadingJourney, setLoadingJourney] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Activities library pre-filter when clicking one of the 6 Development Area cards
  const [activitiesDomainFilter, setActivitiesDomainFilter] = useState<string>('all');

  // Active Activity Studio (works for both Today's plan items & any activity from the library)
  const [studioActivity, setStudioActivity] = useState<ActivityDetail | null>(null);
  const [loadingStudioActivity, setLoadingStudioActivity] = useState(false);

  const isDemoAccount = user?.email.toLowerCase() === 'meera@littlesteps.in';
  const greeting = getTimeOfDayGreeting();
  const firstName = user?.fullName.split(' ')[0] || 'Mama';

  const loadChildren = useCallback(async () => {
    setLoadingChildren(true);
    setError(null);
    try {
      const { children } = await api.listChildren();
      setChildrenList(children);
      if (children.length > 0) {
        setSelectedChildId((prev) =>
          prev && children.some((c) => c.id === prev) ? prev : children[0].id
        );
      } else {
        setSelectedChildId(null);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'We couldn’t load your family profile right now. Please try again.'
      );
    } finally {
      setLoadingChildren(false);
    }
  }, []);

  const loadJourney = useCallback(async (childId: string, day?: number) => {
    setLoadingJourney(true);
    setError(null);
    try {
      const data = await api.getTodayJourney(childId, day);
      setJourney(data);
      setSelectedDay(data.selectedDay.dayNumber);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'We couldn’t load today’s learning journey right now. Please try again.'
      );
    } finally {
      setLoadingJourney(false);
    }
  }, []);

  useEffect(() => {
    void loadChildren();
  }, [loadChildren]);

  useEffect(() => {
    if (selectedChildId) {
      void loadJourney(selectedChildId, selectedDay);
    }
  }, [selectedChildId, selectedDay, loadJourney]);

  // Set of completed activity IDs from today's items, completed history, and submissions
  const completedActivityIds = useMemo(() => {
    const set = new Set<string>();
    journey?.items.forEach((item) => {
      if (
        item.displayStatus === 'completed' ||
        item.displayStatus === 'submitted_for_review' ||
        item.displayStatus === 'reviewed'
      ) {
        set.add(item.activity.id);
      }
    });
    journey?.completedHistory.forEach((h) => set.add(h.activityId));
    journey?.recentSubmissions.forEach((sub) => set.add(sub.activityId));
    return set;
  }, [journey]);

  // Open an activity in Studio and record 'started' (server preserves higher statuses) so Continue Learning always works!
  const openActivityInStudio = useCallback(
    async (activityOrId: ActivityDetail | string) => {
      if (!selectedChildId) return;
      setLoadingStudioActivity(true);
      try {
        const detail =
          typeof activityOrId === 'string'
            ? (await api.getPublishedActivityDetail(activityOrId)).activity
            : activityOrId;
        setStudioActivity(detail);
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Quietly mark as viewed/started so "Continue learning" reflects real parent activity
        await api
          .saveCompletion({
            childId: selectedChildId,
            activityId: detail.id,
            status: 'started',
          })
          .then(() => loadJourney(selectedChildId, selectedDay))
          .catch(() => {});
      } catch (err) {
        notify({
          tone: 'error',
          title: 'Could not open activity',
          description: err instanceof Error ? err.message : 'Please try again.',
        });
      } finally {
        setLoadingStudioActivity(false);
      }
    },
    [selectedChildId, selectedDay, loadJourney, notify]
  );

  const handleContinueTodaysJourney = () => {
    if (!journey || journey.items.length === 0) {
      setSection('activities');
      return;
    }
    const nextPending =
      journey.items.find(
        (i) =>
          !i.completion ||
          i.completion.status === 'started'
      ) ?? journey.items[0];
    void openActivityInStudio(nextPending.activity);
  };

  const handleSelectSection = (next: ParentSection) => {
    setStudioActivity(null);
    setSection(next);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNotificationAction = (item: ParentNotificationItem) => {
    if (item.targetSection === 'verify-email') {
      onNavigate((verificationPreviewPath || '/verify-email') as NavigateTarget);
      return;
    }
    if (item.targetSection) {
      handleSelectSection(item.targetSection);
    }
  };

  const activeChild = childrenList.find((c) => c.id === selectedChildId) ?? childrenList[0] ?? null;
  const notificationCount = journey?.notifications.length ?? 0;

  // Primary & Secondary Navigation Definitions
  const primaryNavItems: Array<{ id: ParentSection; label: string; icon: React.ReactNode }> = [
    { id: 'today', label: 'Today', icon: <Home className="w-4 h-4" /> },
    { id: 'my-plan', label: 'My Plan', icon: <CalendarDays className="w-4 h-4" /> },
    { id: 'activities', label: 'Activities', icon: <LayoutGrid className="w-4 h-4" /> },
    { id: 'progress', label: 'Progress', icon: <BarChart3 className="w-4 h-4" /> },
  ];

  const secondaryNavItems: Array<{
    id: ParentSection;
    label: string;
    icon: React.ReactNode;
    meta?: string;
  }> = [
    { id: 'guides', label: 'Parenting Guides', icon: <BookOpen className="w-4 h-4" /> },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: <Bell className="w-4 h-4" />,
      meta: notificationCount > 0 ? String(notificationCount) : undefined,
    },
    { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  const renderActivityCardForJourneyItem = (item: JourneyActivityItem) => {
    const meta = getJourneyStatusMeta(item);

    return (
      <ActivityCard
        key={item.planItemId}
        title={item.activity.title}
        summary={item.activity.summary}
        domainName={item.activity.domainName}
        ageGroupLabel={item.activity.ageGroupLabel}
        durationMinutes={item.activity.durationMinutes}
        prepLevelLabel={formatPrepLevel(item.activity.prepLevel)}
        materials={item.activity.materials}
        posterUrl={item.activity.instructionalPosterUrl}
        statusText={meta.statusText}
        statusTone={meta.statusTone}
        statusState={meta.statusState}
        completed={
          meta.statusState === 'completed' ||
          meta.statusState === 'submitted_for_review' ||
          meta.statusState === 'reviewed'
        }
        actionLabel={meta.actionLabel}
        onAction={() => void openActivityInStudio(item.activity)}
      />
    );
  };

  // Resolve studio activity completion & latest submission when open
  const studioJourneyMatch = studioActivity
    ? journey?.items.find((i) => i.activity.id === studioActivity.id) ?? null
    : null;
  const studioSubmissionMatch = studioActivity
    ? journey?.recentSubmissions.find((s) => s.activityId === studioActivity.id) ?? null
    : null;
  const studioStatus: CompletionStatus | null =
    studioJourneyMatch?.completion?.status ??
    (journey?.lastActivity && studioActivity && journey.lastActivity.activity.id === studioActivity.id
      ? journey.lastActivity.status
      : null);

  return (
    <div className="min-h-screen bg-offwhite text-charcoal flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2.5 focus:rounded-lg focus:bg-sage focus:text-white focus:text-sm focus:font-semibold"
      >
        Skip to main content
      </a>
      {/* ================================================================= */}
      {/* DESKTOP LEFT SIDEBAR (hidden on mobile/tablet below lg)           */}
      {/* ================================================================= */}
      <aside
        aria-label="Parent dashboard navigation"
        className="hidden lg:flex lg:flex-col w-64 shrink-0 bg-surface border-r border-border sticky top-0 h-screen"
      >
        {/* Brand */}
        <div className="px-5 h-16 border-b border-border flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handleSelectSection('today')}
            className="inline-flex items-center gap-2.5 text-left cursor-pointer"
          >
            <span className="w-8 h-8 rounded-lg bg-sage-soft border border-sage-border text-sage inline-flex items-center justify-center">
              <Sprout className="w-4 h-4" aria-hidden="true" />
            </span>
            <span className="font-display text-lg font-semibold text-charcoal tracking-tight">
              LittleSteps
            </span>
          </button>
        </div>

        {/* Baby Switcher Summary */}
        <div className="p-4 border-b border-border shrink-0">
          {activeChild ? (
            <div className="rounded-xl bg-cream/80 border border-border p-3 space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-surface border border-border overflow-hidden flex items-center justify-center shrink-0">
                  {activeChild.profilePhotoUrl ? (
                    <img
                      src={activeChild.profilePhotoUrl}
                      alt={activeChild.displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Baby className="w-4 h-4 text-sage" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-charcoal truncate">
                    {activeChild.displayName}
                  </p>
                  <p className="text-[11px] text-muted font-mono tabular-nums truncate">
                    {activeChild.ageInMonths}m · {activeChild.ageGroupLabel}
                  </p>
                </div>
              </div>

              {childrenList.length > 1 && (
                <select
                  aria-label="Switch baby profile"
                  value={selectedChildId ?? ''}
                  onChange={(e) => {
                    setSelectedChildId(e.target.value);
                    setSelectedDay(1);
                    setStudioActivity(null);
                  }}
                  className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-charcoal"
                >
                  {childrenList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.displayName} ({c.ageGroupLabel})
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <Skeleton className="h-14 w-full rounded-xl" />
          )}
        </div>

        {/* Primary & Secondary Navigation */}
        <div className="flex-1 overflow-y-auto p-3 space-y-5">
          <div className="space-y-1">
            <p className="px-3 text-[11px] font-medium uppercase tracking-wider text-muted">
              Daily Journey
            </p>
            <nav aria-label="Primary navigation" className="space-y-1">
              {primaryNavItems.map((item) => {
                const active = section === item.id && !studioActivity;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-current={active ? 'page' : undefined}
                    onClick={() => handleSelectSection(item.id)}
                    className={`w-full min-h-[44px] px-3 py-2 rounded-lg flex items-center gap-2.5 text-sm transition-colors cursor-pointer ${
                      active
                        ? 'bg-sage-soft text-sage font-semibold'
                        : 'text-muted hover:bg-cream hover:text-charcoal font-medium'
                    }`}
                  >
                    <span aria-hidden="true">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="space-y-1 pt-3 border-t border-border">
            <p className="px-3 text-[11px] font-medium uppercase tracking-wider text-muted">
              More
            </p>
            <nav aria-label="Secondary navigation" className="space-y-1">
              {secondaryNavItems.map((item) => {
                const active = section === item.id && !studioActivity;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-current={active ? 'page' : undefined}
                    onClick={() => handleSelectSection(item.id)}
                    className={`w-full min-h-[44px] px-3 py-2 rounded-lg flex items-center justify-between gap-2 text-sm transition-colors cursor-pointer ${
                      active
                        ? 'bg-sage-soft text-sage font-semibold'
                        : 'text-muted hover:bg-cream hover:text-charcoal font-medium'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span aria-hidden="true">{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.meta && (
                      <span className="font-mono text-xs tabular-nums px-1.5 py-0.5 rounded-md bg-peach-soft text-peach-ink">
                        {item.meta}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-border shrink-0">
          <button
            type="button"
            onClick={() => void onLogout()}
            className="w-full min-h-[44px] px-3 py-2 rounded-lg flex items-center gap-2.5 text-sm font-medium text-muted hover:bg-cream hover:text-charcoal transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span>{t('auth.signOut')}</span>
          </button>
        </div>
      </aside>

      {/* ================================================================= */}
      {/* MAIN COLUMN: TOP HEADER + CONTENT + MOBILE BOTTOM NAV             */}
      {/* ================================================================= */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Header (Desktop greeting/notifications/profile + Compact Mobile header) */}
        <header className="sticky top-0 z-30 h-16 bg-surface/95 backdrop-blur-md border-b border-border px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
          {/* Left: Mobile Brand OR Desktop Greeting */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => handleSelectSection('today')}
              className="lg:hidden inline-flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <span className="w-8 h-8 rounded-lg bg-sage-soft border border-sage-border text-sage inline-flex items-center justify-center">
                <Sprout className="w-4 h-4" aria-hidden="true" />
              </span>
              <span className="font-display text-base font-semibold text-charcoal">
                LittleSteps
              </span>
            </button>

            <div className="hidden lg:block min-w-0">
              <p className="text-sm font-semibold text-charcoal truncate">
                {greeting}, {firstName}
                {activeChild && (
                  <span className="font-normal text-muted">
                    {' '}
                    · {activeChild.displayName} ({activeChild.ageInMonths}m)
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Right: Demo Indicator + Notifications + Profile + Mobile Menu */}
          <div className="flex items-center gap-2 shrink-0">
            {isDemoAccount && (
              <Badge tone="lavender" className="hidden sm:inline-flex">
                Demo account
              </Badge>
            )}

            <button
              type="button"
              aria-label={`Notifications${notificationCount > 0 ? ` (${notificationCount})` : ''}`}
              onClick={() => handleSelectSection('notifications')}
              className={`relative min-h-[44px] min-w-[44px] rounded-lg inline-flex items-center justify-center transition-colors cursor-pointer ${
                section === 'notifications'
                  ? 'bg-sage-soft text-sage'
                  : 'text-muted hover:bg-cream hover:text-charcoal'
              }`}
            >
              <Bell className="w-5 h-5" aria-hidden="true" />
              {notificationCount > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-peach-ink"
                />
              )}
            </button>

            <button
              type="button"
              onClick={() => handleSelectSection('profile')}
              className={`min-h-[44px] pl-1.5 pr-2.5 rounded-lg inline-flex items-center gap-2 border transition-colors cursor-pointer ${
                section === 'profile'
                  ? 'border-sage bg-sage-soft/50 text-sage'
                  : 'border-border bg-offwhite hover:bg-cream text-charcoal'
              }`}
            >
              <span className="w-7 h-7 rounded-full bg-sage-soft text-sage overflow-hidden inline-flex items-center justify-center text-xs font-semibold shrink-0">
                {user?.profilePhotoUrl ? (
                  <img
                    src={user.profilePhotoUrl}
                    alt={user.fullName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  firstName.slice(0, 1).toUpperCase()
                )}
              </span>
              <span className="hidden sm:inline text-xs font-medium max-w-[110px] truncate">
                {firstName}
              </span>
            </button>

            {/* Mobile Secondary Navigation Drawer Trigger */}
            <button
              type="button"
              aria-label="Open menu for guides, profile, and settings"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="lg:hidden min-h-[44px] min-w-[44px] rounded-lg inline-flex items-center justify-center text-charcoal hover:bg-cream transition-colors cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {/* Mobile Secondary Menu Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-surface border-b border-border px-4 py-4 space-y-3 shadow-sm">
            {activeChild && (
              <div className="rounded-xl bg-cream/80 border border-border p-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-charcoal">{activeChild.displayName}</p>
                  <p className="text-xs text-muted font-mono tabular-nums">
                    {activeChild.ageInMonths} months · {activeChild.ageGroupLabel}
                  </p>
                </div>
                {childrenList.length > 1 && (
                  <select
                    aria-label="Switch baby profile"
                    value={selectedChildId ?? ''}
                    onChange={(e) => {
                      setSelectedChildId(e.target.value);
                      setSelectedDay(1);
                      setStudioActivity(null);
                      setMobileMenuOpen(false);
                    }}
                    className="rounded-lg border border-border bg-surface px-2.5 py-2 text-xs text-charcoal"
                  >
                    {childrenList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.displayName}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {secondaryNavItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectSection(item.id)}
                  className={`min-h-[44px] px-3 py-2 rounded-lg border text-left flex items-center gap-2 text-xs font-medium cursor-pointer ${
                    section === item.id
                      ? 'bg-sage-soft border-sage text-sage'
                      : 'bg-offwhite border-border text-charcoal'
                  }`}
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </div>

            <Button
              variant="secondary"
              size="sm"
              fullWidth
              leftIcon={<LogOut className="w-4 h-4" />}
              onClick={() => void onLogout()}
            >
              {t('auth.signOut')}
            </Button>
          </div>
        )}

        {/* Calm non-blocking email verification bar if unverified */}
        {user && !user.emailVerifiedAt && (
          <div className="bg-peach-soft/80 border-b border-peach">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-2 text-charcoal">
                <MailCheck className="w-4 h-4 text-peach-ink shrink-0" aria-hidden="true" />
                Please verify your email ({user.email}) so you can recover your account safely.
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  onNavigate((verificationPreviewPath || '/verify-email') as NavigateTarget)
                }
              >
                Verify Email
              </Button>
            </div>
          </div>
        )}

        {/* Main Content Container */}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-28 lg:pb-12 space-y-6 focus:outline-none"
        >
          {/* Friendly Retryable Error Message */}
          {error && (
            <Card className="border-danger/40 bg-danger-soft/50 flex flex-wrap items-center justify-between gap-3">
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (selectedChildId) void loadJourney(selectedChildId, selectedDay);
                  else void loadChildren();
                }}
              >
                Try Again
              </Button>
            </Card>
          )}

          {/* Loading Skeletons */}
          {(loadingChildren || loadingStudioActivity || (loadingJourney && !journey)) && (
            <div className="space-y-6" aria-busy="true">
              <div className="space-y-2">
                <Skeleton className="h-7 w-64" />
                <Skeleton className="h-4 w-48" />
              </div>
              <Skeleton className="h-40 w-full rounded-xl" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <SkeletonCard />
                <SkeletonCard />
              </div>
            </div>
          )}

          {/* Empty State if somehow parent has no baby profile */}
          {!loadingChildren && childrenList.length === 0 && !error && (
            <EmptyState
              icon={<Baby className="w-6 h-6" />}
              title="Add your baby’s profile to start today’s journey"
              description="Sharing your baby’s name and date of birth lets LittleSteps match gentle daily activities automatically."
              actionLabel="Add Baby Profile"
              onAction={() => handleSelectSection('profile')}
            />
          )}

          {/* Interactive Activity Detail Studio (when mother starts/resumes any activity) */}
          {!loadingStudioActivity && studioActivity && activeChild && (
            <ParentActivityStudio
              childId={activeChild.id}
              childName={activeChild.displayName}
              activity={studioActivity}
              completionStatus={studioStatus}
              initialNotes={studioJourneyMatch?.completion?.caregiverNotes ?? ''}
              latestSubmission={studioSubmissionMatch}
              locale={locale}
              onBack={() => setStudioActivity(null)}
              onProgressUpdated={async () => {
                if (selectedChildId) {
                  await loadJourney(selectedChildId, selectedDay);
                }
              }}
              onOpenFeedback={() => {
                setStudioActivity(null);
                setSection('progress');
              }}
            />
          )}

          {/* =============================================================== */}
          {/* PRIMARY TAB 1: TODAY (MAIN PARENT DASHBOARD — 7 SECTIONS)       */}
          {/* =============================================================== */}
          {!studioActivity && !loadingStudioActivity && journey && section === 'today' && (
            <div className="space-y-8">
              {/* SECTION 1: WELCOME AREA */}
              <section className="flex flex-wrap items-end justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="sage">
                      {journey.child.displayName} · {journey.child.ageInMonths}{' '}
                      {journey.child.ageInMonths === 1 ? 'month' : 'months'} ({journey.child.ageGroupLabel})
                    </Badge>
                    {isDemoAccount && (
                      <Badge tone="lavender">Sample demo data</Badge>
                    )}
                  </div>
                  <h1 className="font-display text-3xl sm:text-4xl font-semibold text-charcoal tracking-tight">
                    {greeting}, {firstName}!
                  </h1>
                  <p className="text-sm sm:text-base text-muted">
                    Ready for today’s little moments?
                  </p>
                </div>

                {childrenList.length > 1 && (
                  <select
                    aria-label="Switch active child"
                    value={selectedChildId ?? ''}
                    onChange={(e) => {
                      setSelectedChildId(e.target.value);
                      setSelectedDay(1);
                    }}
                    className="min-h-[44px] rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-charcoal"
                  >
                    {childrenList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.displayName} ({c.ageGroupLabel})
                      </option>
                    ))}
                  </select>
                )}
              </section>

              {/* SECTION 2: TODAY'S LEARNING JOURNEY (PROMINENT HERO CARD) */}
              <section aria-label="Today's learning journey">
                <Card
                  tone="sage"
                  padding="lg"
                  className="flex flex-col md:flex-row md:items-center justify-between gap-6"
                >
                  <div className="space-y-3 flex-1">
                    <div className="space-y-1">
                      <p className="font-mono text-xs text-sage tabular-nums">
                        {journey.selectedDay.title}
                      </p>
                      <h2 className="font-display text-2xl font-semibold text-charcoal">
                        Today’s Learning Journey
                      </h2>
                      <p className="text-sm text-muted leading-relaxed max-w-xl">
                        {journey.selectedDay.focusNote}
                      </p>
                    </div>

                    <div className="max-w-md pt-1">
                      <ProgressIndicator
                        value={journey.todaySummary.completedTodayCount}
                        max={Math.max(1, journey.todaySummary.totalTodayCount)}
                        label={`${journey.todaySummary.completedTodayCount} of ${journey.todaySummary.totalTodayCount} activities completed`}
                        sublabel={`${journey.todaySummary.completionPct}%`}
                        tone="sage"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row md:flex-col items-stretch sm:items-center md:items-end gap-4 shrink-0">
                    <ProgressIndicator
                      variant="ring"
                      value={journey.todaySummary.completionPct}
                      max={100}
                      label="Daily completion"
                      sublabel={`${journey.todaySummary.completedTodayCount}/${journey.todaySummary.totalTodayCount} done`}
                      tone="sage"
                    />
                    <Button
                      variant="primary"
                      size="lg"
                      rightIcon={<ArrowRight className="w-4 h-4" />}
                      onClick={handleContinueTodaysJourney}
                    >
                      Continue Today’s Journey
                    </Button>
                  </div>
                </Card>
              </section>

              {/* SECTION 3: TODAY'S ACTIVITIES */}
              <section className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="space-y-0.5">
                    <h2 className="font-display text-2xl font-semibold text-charcoal">
                      Today’s Activities
                    </h2>
                    <p className="text-sm text-muted">
                      Short, calm play moments matched to {journey.child.displayName}’s{' '}
                      {journey.child.ageGroupLabel} stage.
                    </p>
                  </div>
                  <Button
                    variant="subtle"
                    size="sm"
                    rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                    onClick={() => handleSelectSection('my-plan')}
                  >
                    View Full Plan
                  </Button>
                </div>

                {journey.items.length === 0 ? (
                  <EmptyState
                    title={`No activities scheduled yet for ${journey.child.ageGroupLabel}`}
                    description="Browse our full activity library to pick a gentle activity for today."
                    actionLabel="Browse Activities"
                    onAction={() => handleSelectSection('activities')}
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {journey.items.map(renderActivityCardForJourneyItem)}
                  </div>
                )}
              </section>

              {/* SECTIONS 4 & 6 SIDE-BY-SIDE ON DESKTOP: WEEKLY PROGRESS + CONTINUE LEARNING */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* SECTION 4: WEEKLY PROGRESS */}
                <section className="lg:col-span-7">
                  <Card padding="lg" className="h-full flex flex-col justify-between space-y-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div>
                        <h2 className="font-display text-xl font-semibold text-charcoal">
                          Weekly Progress
                        </h2>
                        <p className="text-xs text-muted">
                          Completed activities across the last 7 days
                        </p>
                      </div>
                      <span className="font-mono text-xs tabular-nums text-sage font-medium">
                        {journey.weeklyProgress.reduce((s, d) => s + d.completedCount, 0)} completed
                      </span>
                    </div>

                    {(() => {
                      const maxVal = Math.max(
                        3,
                        ...journey.weeklyProgress.map((d) => d.completedCount)
                      );
                      const weeklyTotal = journey.weeklyProgress.reduce(
                        (s, d) => s + d.completedCount,
                        0
                      );
                      return (
                        <div className="space-y-3">
                          <div
                            className="grid grid-cols-7 gap-2 items-end h-36 pt-2"
                            role="img"
                            aria-label={`Weekly progress chart: ${weeklyTotal} completed activities in the last 7 days`}
                          >
                            {journey.weeklyProgress.map((day) => {
                              const heightPct =
                                day.completedCount > 0
                                  ? Math.max(20, Math.round((day.completedCount / maxVal) * 100))
                                  : 8;
                              return (
                                <div
                                  key={day.date}
                                  className="flex flex-col items-center justify-end gap-1.5 h-full"
                                >
                                  <span className="font-mono text-[11px] tabular-nums text-muted">
                                    {day.completedCount}
                                  </span>
                                  <div className="w-full max-w-[34px] h-20 rounded-lg bg-cream p-1 flex items-end">
                                    <div
                                      className={`w-full rounded-md transition-all duration-300 ${
                                        day.completedCount > 0
                                          ? day.isToday
                                            ? 'bg-sage'
                                            : 'bg-sage/75'
                                          : 'bg-border-strong/50'
                                      }`}
                                      style={{ height: `${heightPct}%` }}
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

                          {weeklyTotal === 0 && (
                            <p className="text-xs text-muted bg-cream/70 rounded-lg px-3 py-2">
                              Complete your first activity today to start seeing your calm weekly
                              rhythm take shape.
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </Card>
                </section>

                {/* SECTION 6: CONTINUE LEARNING */}
                <section className="lg:col-span-5">
                  <Card padding="lg" className="h-full flex flex-col justify-between space-y-4">
                    <div className="space-y-1">
                      <p className="font-mono text-xs text-sage">Continue Learning</p>
                      <h2 className="font-display text-xl font-semibold text-charcoal">
                        Pick up where you left off
                      </h2>
                    </div>

                    {journey.lastActivity ? (
                      <div className="space-y-4 flex-1 flex flex-col justify-between">
                        <div className="rounded-xl border border-border bg-offwhite overflow-hidden flex items-center gap-3.5 p-3">
                          <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0">
                            <EditorialImage
                              src={journey.lastActivity.activity.instructionalPosterUrl}
                              alt={journey.lastActivity.activity.title}
                              aspectClassName="w-full h-full"
                            />
                          </div>
                          <div className="min-w-0 space-y-1">
                            <p className="text-[11px] text-muted truncate">
                              {journey.lastActivity.activity.domainName} ·{' '}
                              <span className="font-mono tabular-nums">
                                {journey.lastActivity.activity.durationMinutes} min
                              </span>
                            </p>
                            <p className="font-display text-base font-semibold text-charcoal leading-snug line-clamp-2">
                              {journey.lastActivity.activity.title}
                            </p>
                            <p className="text-[11px] text-sage font-medium">
                              {journey.lastActivity.status === 'started'
                                ? 'In progress'
                                : journey.lastActivity.status === 'reviewed'
                                  ? 'Reviewed'
                                  : 'Recently completed'}{' '}
                              · {formatDateReadable(journey.lastActivity.updatedAt, locale)}
                            </p>
                          </div>
                        </div>

                        <Button
                          variant="primary"
                          fullWidth
                          leftIcon={<PlayCircle className="w-4 h-4" />}
                          onClick={() => void openActivityInStudio(journey.lastActivity!.activity)}
                        >
                          {journey.lastActivity.status === 'started'
                            ? 'Resume Activity'
                            : 'Revisit Activity'}
                        </Button>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-border bg-offwhite p-4 space-y-3 flex-1 flex flex-col justify-between">
                        <p className="text-sm text-muted leading-relaxed">
                          Once you open or start an activity, it will appear right here so you can
                          jump back in effortlessly—even with one hand free.
                        </p>
                        <Button
                          variant="secondary"
                          fullWidth
                          rightIcon={<ArrowRight className="w-4 h-4" />}
                          onClick={handleContinueTodaysJourney}
                        >
                          Start First Activity
                        </Button>
                      </div>
                    )}
                  </Card>
                </section>
              </div>

              {/* SECTION 5: DEVELOPMENT AREAS (SIX CARDS WITH INDIVIDUAL PROGRESS) */}
              <section className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="space-y-0.5">
                    <h2 className="font-display text-2xl font-semibold text-charcoal">
                      Development Areas
                    </h2>
                    <p className="text-sm text-muted">
                      Balanced growth across all six early-childhood areas.
                    </p>
                  </div>
                  <Button
                    variant="subtle"
                    size="sm"
                    rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                    onClick={() => handleSelectSection('progress')}
                  >
                    Detailed Progress
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {journey.domainProgress.map((stat) => {
                    const pct = Math.min(
                      100,
                      Math.round((stat.completedCount / Math.max(1, stat.availableCount)) * 100)
                    );
                    return (
                      <button
                        key={stat.domainId}
                        type="button"
                        onClick={() => {
                          setActivitiesDomainFilter(stat.domainId);
                          handleSelectSection('activities');
                        }}
                        className="text-left rounded-xl border border-border bg-surface p-5 space-y-3 hover:border-sage/70 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="w-9 h-9 rounded-lg bg-sage-soft text-sage inline-flex items-center justify-center shrink-0">
                            {DOMAIN_ICONS[stat.domainSlug] ?? <Sparkles className="w-4 h-4" />}
                          </span>
                          <span className="font-mono text-xs tabular-nums text-muted">
                            {stat.completedCount}/{stat.availableCount} · {pct}%
                          </span>
                        </div>
                        <div className="space-y-2">
                          <p className="font-display text-base font-semibold text-charcoal">
                            {stat.domainName}
                          </p>
                          <ProgressIndicator
                            value={Math.min(stat.completedCount, stat.availableCount)}
                            max={stat.availableCount}
                            tone="sage"
                            size="sm"
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* SECTION 7: PARENTING TIP */}
              <section aria-label="Today's parenting tip">
                <Card
                  tone="cream"
                  padding="lg"
                  className="flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5">
                    <span className="w-10 h-10 rounded-xl bg-surface border border-border text-sage inline-flex items-center justify-center shrink-0">
                      <Lightbulb className="w-5 h-5" aria-hidden="true" />
                    </span>
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-mono text-xs text-sage">Today’s Parenting Tip</p>
                        <Badge tone="neutral">{journey.parentingTip.focusArea}</Badge>
                      </div>
                      <h2 className="font-display text-lg font-semibold text-charcoal">
                        {journey.parentingTip.title}
                      </h2>
                      <p className="text-sm text-muted leading-relaxed max-w-2xl">
                        {journey.parentingTip.body}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="shrink-0 self-start"
                    onClick={() => handleSelectSection('guides')}
                  >
                    More Guides
                  </Button>
                </Card>
              </section>
            </div>
          )}

          {/* =============================================================== */}
          {/* PRIMARY TAB 2: MY PLAN (STRUCTURED DAILY LEARNING JOURNEY)      */}
          {/* =============================================================== */}
          {!studioActivity && !loadingStudioActivity && journey && section === 'my-plan' && (
            <MyPlanSection
              journey={journey}
              selectedDay={selectedDay}
              locale={locale}
              onSelectDay={(dayNumber) => setSelectedDay(dayNumber)}
              onOpenActivity={(activityOrId) => void openActivityInStudio(activityOrId)}
              onOpenLibrary={() => handleSelectSection('activities')}
            />
          )}

          {/* =============================================================== */}
          {/* PRIMARY TAB 3: ACTIVITIES LIBRARY                               */}
          {/* =============================================================== */}
          {!studioActivity && !loadingStudioActivity && activeChild && section === 'activities' && (
            <ActivitiesLibrarySection
              ageGroups={ageGroups}
              learningDomains={learningDomains}
              initialAgeGroupSlug={activeChild.ageGroupSlug}
              initialDomainId={activitiesDomainFilter}
              completedActivityIds={completedActivityIds}
              onOpenActivity={(id) => void openActivityInStudio(id)}
            />
          )}

          {/* =============================================================== */}
          {/* PRIMARY TAB 4: PROGRESS TRACKING, ACTIVITY & REVIEW HISTORY     */}
          {/* =============================================================== */}
          {!studioActivity && !loadingStudioActivity && journey && section === 'progress' && (
            <ProgressDashboardSection
              journey={journey}
              learningDomains={learningDomains}
              locale={locale}
              nonDiagnosticTitle={t('policy.nonDiagnosticTitle')}
              nonDiagnosticBody={t('policy.nonDiagnosticBody')}
              onRefreshJourney={async () => {
                if (selectedChildId) await loadJourney(selectedChildId, selectedDay);
              }}
              onExploreDomain={(domainId) => {
                setActivitiesDomainFilter(domainId);
                handleSelectSection('activities');
              }}
              onOpenActivity={(id) => void openActivityInStudio(id)}
              onGoToday={() => handleSelectSection('today')}
            />
          )}

          {/* =============================================================== */}
          {/* SECONDARY NAVIGATION VIEWS                                      */}
          {/* =============================================================== */}
          {!studioActivity && !loadingStudioActivity && section === 'guides' && (
            <ParentingGuidesSection childAgeLabel={activeChild?.ageGroupLabel ?? '0–24 months'} />
          )}

          {!studioActivity && !loadingStudioActivity && journey && section === 'notifications' && (
            <NotificationsSection
              notifications={journey.notifications}
              locale={locale}
              onNotificationAction={handleNotificationAction}
            />
          )}

          {!studioActivity && !loadingStudioActivity && section === 'profile' && (
            <ProfileSection
              childrenList={childrenList}
              selectedChildId={selectedChildId}
              onSelectChild={(id) => {
                setSelectedChildId(id);
                setSelectedDay(1);
              }}
              onChildrenUpdated={loadChildren}
            />
          )}

          {!studioActivity && !loadingStudioActivity && section === 'settings' && (
            <SettingsSection
              onNavigate={onNavigate}
              onOpenDesignSystem={onOpenDesignSystem}
              onLogout={onLogout}
            />
          )}
        </main>

        {/* =============================================================== */}
        {/* MOBILE FIXED BOTTOM NAVIGATION (hidden on lg+ desktop)          */}
        {/* =============================================================== */}
        <MobileBottomNav
          items={primaryNavItems}
          activeId={
            primaryNavItems.some((p) => p.id === section) ? section : 'today'
          }
          onSelect={(id) => handleSelectSection(id as ParentSection)}
          className="lg:hidden"
        />
      </div>
    </div>
  );
}

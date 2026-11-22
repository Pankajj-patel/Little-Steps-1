import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Baby,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
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
  Sun,
  User,
  X,
} from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
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
import {
  localizeActivitySummary,
  localizeActivityTitleById,
  localizeParentingTip,
  localizePlanTitleAndFocus,
} from '../shared/hindiContent';
import {
  formatDateReadable,
  getTimeOfDayGreeting,
  localizeAgeGroupLabel,
  localizeDomainName,
  localizePrepLevel,
} from '../shared/i18n';
import type {
  ActivityDetail,
  ChildProfile,
  CompletionStatus,
  JourneyActivityItem,
  LocaleCode,
  ParentNotificationItem,
  TodayJourneyResponse,
} from '../shared/types';
import {
  getJourneyStatusMeta,
  MyPlanSection,
} from './parent/MyPlanSection';

const ParentActivityStudio = lazy(() =>
  import('./parent/ParentActivityStudio').then((m) => ({ default: m.ParentActivityStudio }))
);
const ActivitiesLibrarySection = lazy(() =>
  import('./parent/ParentSecondaryViews').then((m) => ({ default: m.ActivitiesLibrarySection }))
);
const NotificationsSection = lazy(() =>
  import('./parent/ParentSecondaryViews').then((m) => ({ default: m.NotificationsSection }))
);
const ParentingGuidesSection = lazy(() =>
  import('./parent/ParentSecondaryViews').then((m) => ({ default: m.ParentingGuidesSection }))
);
const ProfileSection = lazy(() =>
  import('./parent/ParentSecondaryViews').then((m) => ({ default: m.ProfileSection }))
);
const SettingsSection = lazy(() =>
  import('./parent/ParentSecondaryViews').then((m) => ({ default: m.SettingsSection }))
);
const ProgressDashboardSection = lazy(() =>
  import('./parent/ProgressDashboardSection').then((m) => ({
    default: m.ProgressDashboardSection,
  }))
);

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
    setUser,
    locale,
    ageGroups,
    learningDomains,
    verificationPreviewPath,
    t,
  } = useAuth();
  const { notify } = useToast();

  const [section, setSection] = useState<ParentSection>('today');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [switchingLocale, setSwitchingLocale] = useState(false);

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
  // Progressive disclosure for the 6 Development Areas grid on Today dashboard
  const [showAllDomains, setShowAllDomains] = useState(false);

  const isHi = locale === 'hi';
  const isDemoAccount = user?.email.toLowerCase() === 'meera@littlesteps.in';
  const greeting = getTimeOfDayGreeting(locale);
  const firstName = user?.fullName.split(' ')[0] || (isHi ? 'मम्मा' : 'Mama');

  const handleQuickLocaleToggle = async (nextLocale: LocaleCode) => {
    if (!user || nextLocale === locale || switchingLocale) return;
    setSwitchingLocale(true);
    setUser((prev) => (prev ? { ...prev, preferredLocale: nextLocale } : prev));
    try {
      const res = await api.saveOnboardingParent({
        fullName: user.fullName,
        email: user.email,
        preferredLocale: nextLocale,
        profilePhotoUrl: user.profilePhotoUrl,
      });
      setUser(res.user);
    } catch {
      // Keep local choice if transient error occurs
    } finally {
      setSwitchingLocale(false);
    }
  };

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

  const handleMarkNotificationRead = useCallback(
    async (notificationId: string) => {
      setJourney((prev) =>
        prev
          ? {
              ...prev,
              notifications: prev.notifications.map((n) =>
                n.id === notificationId ? { ...n, isRead: true } : n
              ),
            }
          : prev
      );
      try {
        await api.markNotificationRead(notificationId);
      } catch {
        // Optimistic update stays gentle; next journey refresh reconciles
      }
    },
    []
  );

  const handleMarkAllNotificationsRead = useCallback(async () => {
    const unreadIds = (journey?.notifications ?? [])
      .filter((n) => !n.isRead)
      .map((n) => n.id);
    if (unreadIds.length === 0) return;
    setJourney((prev) =>
      prev
        ? {
            ...prev,
            notifications: prev.notifications.map((n) => ({ ...n, isRead: true })),
          }
        : prev
    );
    try {
      await api.markAllNotificationsRead(selectedChildId ?? undefined);
      notify({
        tone: 'success',
        title: isHi ? 'सभी सूचनाएँ पढ़ी गईं' : 'All notifications marked as read',
      });
    } catch {
      // ignore transient error
    }
  }, [journey?.notifications, selectedChildId, isHi, notify]);

  const handleNotificationAction = (item: ParentNotificationItem) => {
    if (!item.isRead) {
      void handleMarkNotificationRead(item.id);
    }
    if (item.targetSection === 'verify-email') {
      onNavigate((verificationPreviewPath || '/verify-email') as NavigateTarget);
      return;
    }
    if (item.activityId && item.kind === 'changes_requested') {
      void openActivityInStudio(item.activityId);
      return;
    }
    if (item.targetSection) {
      handleSelectSection(item.targetSection);
    }
  };

  const activeChild = childrenList.find((c) => c.id === selectedChildId) ?? childrenList[0] ?? null;
  const unreadNotificationCount = (journey?.notifications ?? []).filter((n) => !n.isRead).length;
  const notificationCount = unreadNotificationCount;

  // Primary & Secondary Navigation Definitions
  const primaryNavItems: Array<{ id: ParentSection; label: string; icon: React.ReactNode }> = [
    { id: 'today', label: t('nav.today'), icon: <Home className="w-4 h-4" /> },
    { id: 'my-plan', label: t('nav.myPlan'), icon: <CalendarDays className="w-4 h-4" /> },
    { id: 'activities', label: t('nav.activities'), icon: <LayoutGrid className="w-4 h-4" /> },
    { id: 'progress', label: t('nav.progress'), icon: <BarChart3 className="w-4 h-4" /> },
  ];

  const secondaryNavItems: Array<{
    id: ParentSection;
    label: string;
    icon: React.ReactNode;
    meta?: string;
  }> = [
    { id: 'guides', label: t('nav.guides'), icon: <BookOpen className="w-4 h-4" /> },
    {
      id: 'notifications',
      label: t('nav.notifications'),
      icon: <Bell className="w-4 h-4" />,
      meta: notificationCount > 0 ? String(notificationCount) : undefined,
    },
    { id: 'profile', label: t('nav.profile'), icon: <User className="w-4 h-4" /> },
    { id: 'settings', label: t('nav.settings'), icon: <Settings className="w-4 h-4" /> },
  ];

  const renderActivityCardForJourneyItem = (item: JourneyActivityItem) => {
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
        prepLevelLabel={localizePrepLevel(localized.prepLevel, locale)}
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
        className="hidden lg:flex lg:flex-col w-64 shrink-0 bg-surface border-r border-border sticky top-0 h-[100dvh]"
      >
        {/* Brand */}
        <div className="px-5 h-16 border-b border-border flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handleSelectSection('today')}
            className="inline-flex items-center gap-2.5 text-left cursor-pointer"
          >
            <BrandLogo size="md" />
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
              {t('nav.dailyJourney')}
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
              {t('nav.more')}
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
              <BrandLogo size="sm" />
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

          {/* Right: Language Toggle + Demo Indicator + Notifications + Profile + Mobile Menu */}
          <div className="flex items-center gap-2 shrink-0">
            <div
              role="group"
              aria-label="Language switch"
              className="inline-flex rounded-lg border border-border bg-offwhite p-0.5 text-xs"
            >
              <button
                type="button"
                disabled={switchingLocale}
                onClick={() => void handleQuickLocaleToggle('en')}
                className={`px-2 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  locale === 'en' ? 'bg-sage text-white' : 'text-muted hover:text-charcoal'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                disabled={switchingLocale}
                onClick={() => void handleQuickLocaleToggle('hi')}
                className={`px-2 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  locale === 'hi' ? 'bg-sage text-white' : 'text-muted hover:text-charcoal'
                }`}
              >
                हिन्दी
              </button>
            </div>

            {isDemoAccount && (
              <Badge tone="lavender" className="hidden sm:inline-flex">
                {isHi ? 'डेमो खाता' : 'Demo account'}
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
          className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-36 lg:pb-24 space-y-6 focus:outline-none"
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
            <Suspense fallback={<SkeletonCard />}>
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
            </Suspense>
          )}

          {/* =============================================================== */}
          {/* PRIMARY TAB 1: TODAY (MAIN PARENT DASHBOARD — 7 SECTIONS)       */}
          {/* =============================================================== */}
          {!studioActivity && !loadingStudioActivity && journey && section === 'today' && (() => {
            const localizedChildAge = localizeAgeGroupLabel(
              journey.child.ageGroupSlug,
              journey.child.ageGroupLabel,
              locale
            );
            const localizedDay = localizePlanTitleAndFocus(
              journey.selectedDay.title,
              journey.selectedDay.focusNote,
              journey.selectedDay.dayNumber,
              locale
            );
            const localizedLastActivity = journey.lastActivity
              ? localizeActivitySummary(journey.lastActivity.activity, locale)
              : null;
            const localizedTip = localizeParentingTip(journey.parentingTip, locale);

            return (
              <div className="space-y-8">
                {/* SECTION 1: WELCOME AREA */}
                <section className="flex flex-wrap items-end justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="sage">
                        {journey.child.displayName} · {journey.child.ageInMonths}{' '}
                        {journey.child.ageInMonths === 1
                          ? t('common.month')
                          : t('common.months')}{' '}
                        ({localizedChildAge})
                      </Badge>
                      {isDemoAccount && (
                        <Badge tone="lavender">
                          {isHi ? 'उदाहरण डेमो डेटा' : 'Sample demo data'}
                        </Badge>
                      )}
                    </div>
                    <h1 className="font-display text-3xl sm:text-4xl font-semibold text-charcoal tracking-tight">
                      {greeting}, {firstName}!
                    </h1>
                    <p className="text-sm sm:text-base text-muted">
                      {t('dashboard.readySubtitle')}
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
                          {c.displayName} ({localizeAgeGroupLabel(c.ageGroupSlug, c.ageGroupLabel, locale)})
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
                          {localizedDay.title}
                        </p>
                        <h2 className="font-display text-2xl font-semibold text-charcoal">
                          {t('dashboard.todaysJourney')}
                        </h2>
                        <p className="text-sm text-muted leading-relaxed max-w-xl">
                          {localizedDay.focusNote}
                        </p>
                      </div>

                      <div className="max-w-md pt-1">
                        <ProgressIndicator
                          value={journey.todaySummary.completedTodayCount}
                          max={Math.max(1, journey.todaySummary.totalTodayCount)}
                          label={
                            isHi
                              ? `${journey.todaySummary.totalTodayCount} में से ${journey.todaySummary.completedTodayCount} गतिविधियाँ पूर्ण`
                              : `${journey.todaySummary.completedTodayCount} of ${journey.todaySummary.totalTodayCount} activities completed`
                          }
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
                        label={t('dashboard.dailyCompletion')}
                        sublabel={
                          isHi
                            ? `${journey.todaySummary.completedTodayCount}/${journey.todaySummary.totalTodayCount} पूर्ण`
                            : `${journey.todaySummary.completedTodayCount}/${journey.todaySummary.totalTodayCount} done`
                        }
                        tone="sage"
                      />
                      <Button
                        variant="primary"
                        size="lg"
                        rightIcon={<ArrowRight className="w-4 h-4" />}
                        onClick={handleContinueTodaysJourney}
                      >
                        {t('dashboard.continueJourney')}
                      </Button>
                    </div>
                  </Card>
                </section>

                {/* SECTION 3: TODAY'S ACTIVITIES */}
                <section className="space-y-4">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div className="space-y-0.5">
                      <h2 className="font-display text-2xl font-semibold text-charcoal">
                        {t('dashboard.todaysActivities')}
                      </h2>
                      <p className="text-sm text-muted">
                        {isHi
                          ? `${journey.child.displayName} के ${localizedChildAge} चरण के लिए चुने गए शांत और सरल खेल।`
                          : `Short, calm play moments matched to ${journey.child.displayName}’s ${localizedChildAge} stage.`}
                      </p>
                    </div>
                    <Button
                      variant="subtle"
                      size="sm"
                      rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                      onClick={() => handleSelectSection('my-plan')}
                    >
                      {t('dashboard.viewFullPlan')}
                    </Button>
                  </div>

                  {journey.items.length === 0 ? (
                    <EmptyState
                      title={
                        isHi
                          ? `${localizedChildAge} के लिए अभी कोई गतिविधि निर्धारित नहीं है`
                          : `No activities scheduled yet for ${localizedChildAge}`
                      }
                      description={
                        isHi
                          ? 'आज के लिए कोई शांत गतिविधि चुनने के लिए हमारी पूरी लाइब्रेरी देखें।'
                          : 'Browse our full activity library to pick a gentle activity for today.'
                      }
                      actionLabel={isHi ? 'गतिविधियाँ देखें' : 'Browse Activities'}
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
                            {t('dashboard.weeklyProgress')}
                          </h2>
                          <p className="text-xs text-muted">
                            {t('dashboard.weeklyProgressDesc')}
                          </p>
                        </div>
                        <span className="font-mono text-xs tabular-nums text-sage font-medium">
                          {journey.weeklyProgress.reduce((s, d) => s + d.completedCount, 0)}{' '}
                          {isHi ? 'पूर्ण' : 'completed'}
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
                                {isHi
                                  ? 'अपनी शांत साप्ताहिक लय देखने के लिए आज पहली गतिविधि पूरी करें।'
                                  : 'Complete your first activity today to start seeing your calm weekly rhythm take shape.'}
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
                        <p className="font-mono text-xs text-sage">
                          {t('dashboard.continueLearning')}
                        </p>
                        <h2 className="font-display text-xl font-semibold text-charcoal">
                          {t('dashboard.pickUpWhereLeft')}
                        </h2>
                      </div>

                      {journey.lastActivity && localizedLastActivity ? (
                        <div className="space-y-4 flex-1 flex flex-col justify-between">
                          <div className="rounded-xl border border-border bg-offwhite overflow-hidden flex items-center gap-3.5 p-3">
                            <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0">
                              <EditorialImage
                                src={localizedLastActivity.instructionalPosterUrl}
                                alt={localizedLastActivity.title}
                                aspectClassName="w-full h-full"
                              />
                            </div>
                            <div className="min-w-0 space-y-1">
                              <p className="text-[11px] text-muted truncate">
                                {localizedLastActivity.domainName} ·{' '}
                                <span className="font-mono tabular-nums">
                                  {localizedLastActivity.durationMinutes} {t('common.min')}
                                </span>
                              </p>
                              <p className="font-display text-base font-semibold text-charcoal leading-snug line-clamp-2">
                                {localizedLastActivity.title}
                              </p>
                              <p className="text-[11px] text-sage font-medium">
                                {journey.lastActivity.status === 'started'
                                  ? t('status.inProgress')
                                  : journey.lastActivity.status === 'reviewed'
                                    ? t('status.reviewed')
                                    : isHi
                                      ? 'हाल ही में पूर्ण'
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
                              ? t('dashboard.resumeActivity')
                              : t('dashboard.revisitActivity')}
                          </Button>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-border bg-offwhite p-4 space-y-3 flex-1 flex flex-col justify-between">
                          <p className="text-sm text-muted leading-relaxed">
                            {isHi
                              ? 'जैसे ही आप कोई गतिविधि खोलती या शुरू करती हैं, वह यहाँ दिखाई देगी ताकि आप आसानी से वहीं से आगे बढ़ सकें।'
                              : 'Once you open or start an activity, it will appear right here so you can jump back in effortlessly—even with one hand free.'}
                          </p>
                          <Button
                            variant="secondary"
                            fullWidth
                            rightIcon={<ArrowRight className="w-4 h-4" />}
                            onClick={handleContinueTodaysJourney}
                          >
                            {t('dashboard.startFirstActivity')}
                          </Button>
                        </div>
                      )}
                    </Card>
                  </section>
                </div>

                {/* RECENT CAREGIVER FEEDBACK HIGHLIGHT (WHEN AVAILABLE) */}
                {(() => {
                  const recentFeedback = journey.recentSubmissions.find(
                    (s) => s.review || s.reviewStatus === 'resubmit_requested'
                  );
                  if (!recentFeedback) return null;
                  const localizedTitle = localizeActivityTitleById(
                    recentFeedback.activityId,
                    recentFeedback.activityTitle,
                    locale
                  );
                  return (
                    <section aria-label="Recent caregiver coaching feedback">
                      <Card
                        tone={recentFeedback.review ? 'sage' : 'peach'}
                        padding="lg"
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={recentFeedback.review ? 'sage' : 'peach'}>
                              {recentFeedback.review
                                ? isHi
                                  ? 'हाल की समीक्षा प्रतिक्रिया'
                                  : 'Recent Caregiver Feedback'
                                : isHi
                                  ? 'अपडेटेड क्लिप का अनुरोध'
                                  : 'Updated Clip Requested'}
                            </Badge>
                            {recentFeedback.review?.isAssessable &&
                              recentFeedback.review.instructionMatchScorePct !== null && (
                                <span className="font-mono text-xs font-semibold text-sage tabular-nums">
                                  {recentFeedback.review.instructionMatchScorePct}%{' '}
                                  {isHi ? 'निर्देश-मिलान' : 'instruction-match'}
                                </span>
                              )}
                          </div>
                          <h2 className="font-display text-lg font-semibold text-charcoal">
                            {localizedTitle}
                          </h2>
                          <p className="text-sm text-charcoal/90 leading-relaxed max-w-2xl">
                            {recentFeedback.review
                              ? recentFeedback.review.strengthsNote
                              : recentFeedback.changeRequestNote ||
                                (isHi
                                  ? 'समीक्षक ने बेहतर मार्गदर्शन के लिए एक स्पष्ट वीडियो क्लिप साझा करने का अनुरोध किया है।'
                                  : 'Your reviewer asked for an updated clip so they can share clearer coaching feedback.')}
                          </p>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="shrink-0 self-start sm:self-center"
                          rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                          onClick={() =>
                            recentFeedback.reviewStatus === 'resubmit_requested'
                              ? void openActivityInStudio(recentFeedback.activityId)
                              : handleSelectSection('progress')
                          }
                        >
                          {recentFeedback.reviewStatus === 'resubmit_requested'
                            ? isHi
                              ? 'गतिविधि खोलें'
                              : 'Open Activity'
                            : isHi
                              ? 'पूरी प्रतिक्रिया पढ़ें'
                              : 'Read Full Feedback'}
                        </Button>
                      </Card>
                    </section>
                  );
                })()}

                {/* SECTION 5: DEVELOPMENT AREAS (PROGRESSIVE DISCLOSURE FOR CALM FOCUS) */}
                <section className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <h2 className="font-display text-xl sm:text-2xl font-semibold text-charcoal">
                        {t('dashboard.developmentAreas')}
                      </h2>
                      <p className="text-sm text-muted">
                        {t('dashboard.developmentAreasDesc')}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        aria-expanded={showAllDomains}
                        rightIcon={
                          showAllDomains ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )
                        }
                        onClick={() => setShowAllDomains((v) => !v)}
                      >
                        {showAllDomains
                          ? isHi
                            ? 'विकास क्षेत्र समेटें'
                            : 'Hide 6 areas'
                          : isHi
                            ? 'सभी 6 विकास क्षेत्र देखें'
                            : 'Explore all 6 areas'}
                      </Button>
                      <Button
                        variant="subtle"
                        size="sm"
                        rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                        onClick={() => handleSelectSection('progress')}
                      >
                        {t('dashboard.detailedProgress')}
                      </Button>
                    </div>
                  </div>

                  {showAllDomains ? (
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
                                {localizeDomainName(stat.domainSlug, stat.domainName, locale)}
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
                  ) : (
                    <Card padding="sm" className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-muted">
                        {isHi
                          ? `आपने इस चरण में 6 में से ${
                              journey.domainProgress.filter((d) => d.completedCount > 0).length
                            } विकास क्षेत्रों का अभ्यास किया है।`
                          : `Explored ${
                              journey.domainProgress.filter((d) => d.completedCount > 0).length
                            } of 6 development areas in this stage so far.`}
                      </p>
                      <span className="font-mono text-xs text-sage tabular-nums">
                        {journey.domainProgress.reduce((s, d) => s + d.completedCount, 0)}{' '}
                        {isHi ? 'कुल पूर्ण' : 'completed'}
                      </span>
                    </Card>
                  )}
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
                          <p className="font-mono text-xs text-sage">{t('dashboard.todaysTip')}</p>
                          <Badge tone="neutral">{localizedTip.focusArea}</Badge>
                        </div>
                        <h2 className="font-display text-lg font-semibold text-charcoal">
                          {localizedTip.title}
                        </h2>
                        <p className="text-sm text-muted leading-relaxed max-w-2xl">
                          {localizedTip.body}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="shrink-0 self-start"
                      onClick={() => handleSelectSection('guides')}
                    >
                      {t('dashboard.moreGuides')}
                    </Button>
                  </Card>
                </section>
              </div>
            );
          })()}

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
            <Suspense fallback={<SkeletonCard />}>
              <ActivitiesLibrarySection
                ageGroups={ageGroups}
                learningDomains={learningDomains}
                initialAgeGroupSlug={activeChild.ageGroupSlug}
                initialDomainId={activitiesDomainFilter}
                completedActivityIds={completedActivityIds}
                onOpenActivity={(id) => void openActivityInStudio(id)}
              />
            </Suspense>
          )}

          {/* =============================================================== */}
          {/* PRIMARY TAB 4: PROGRESS TRACKING, ACTIVITY & REVIEW HISTORY     */}
          {/* =============================================================== */}
          {!studioActivity && !loadingStudioActivity && journey && section === 'progress' && (
            <Suspense fallback={<SkeletonCard />}>
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
            </Suspense>
          )}

          {/* =============================================================== */}
          {/* SECONDARY NAVIGATION VIEWS                                      */}
          {/* =============================================================== */}
          {!studioActivity && !loadingStudioActivity && section === 'guides' && (
            <Suspense fallback={<SkeletonCard />}>
              <ParentingGuidesSection childAgeLabel={activeChild?.ageGroupLabel ?? '0–24 months'} />
            </Suspense>
          )}

          {!studioActivity && !loadingStudioActivity && journey && section === 'notifications' && (
            <Suspense fallback={<SkeletonCard />}>
              <NotificationsSection
                notifications={journey.notifications}
                locale={locale}
                onNotificationAction={handleNotificationAction}
                onMarkRead={handleMarkNotificationRead}
                onMarkAllRead={handleMarkAllNotificationsRead}
              />
            </Suspense>
          )}

          {!studioActivity && !loadingStudioActivity && section === 'profile' && (
            <Suspense fallback={<SkeletonCard />}>
              <ProfileSection
                childrenList={childrenList}
                selectedChildId={selectedChildId}
                onSelectChild={(id) => {
                  setSelectedChildId(id);
                  setSelectedDay(1);
                }}
                onChildrenUpdated={loadChildren}
              />
            </Suspense>
          )}

          {!studioActivity && !loadingStudioActivity && section === 'settings' && (
            <Suspense fallback={<SkeletonCard />}>
              <SettingsSection
                onNavigate={onNavigate}
                onOpenDesignSystem={onOpenDesignSystem}
                onLogout={onLogout}
              />
            </Suspense>
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

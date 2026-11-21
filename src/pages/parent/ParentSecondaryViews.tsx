import React, { useEffect, useRef, useState } from 'react';
import {
  Baby,
  Bell,
  BookOpen,
  Camera,
  CheckCircle2,
  Clock,
  KeyRound,
  LogOut,
  MailCheck,
  Palette,
  Plus,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  ActivityCard,
  AgeGroupSelector,
  Badge,
  Button,
  Card,
  DatePicker,
  EmptyState,
  Input,
  Modal,
  Select,
  SkeletonCard,
  useToast,
} from '../../design-system';
import { api } from '../../lib/api';
import type { NavigateTarget } from '../../lib/router';
import { formatDateReadable } from '../../shared/i18n';
import type {
  ActivitySummary,
  AgeGroup,
  ChildProfile,
  LearningDomain,
  LocaleCode,
  NotificationPreference,
  ParentNotificationItem,
  PreferredActivityTime,
} from '../../shared/types';
import { formatPrepLevel } from './MyPlanSection';

/* ========================================================================= */
/* 1. ACTIVITIES LIBRARY SECTION                                             */
/* ========================================================================= */
interface ActivitiesLibrarySectionProps {
  ageGroups: AgeGroup[];
  learningDomains: LearningDomain[];
  initialAgeGroupSlug: string;
  initialDomainId?: string;
  completedActivityIds: Set<string>;
  onOpenActivity: (activityId: string) => void;
}

export function ActivitiesLibrarySection({
  ageGroups,
  learningDomains,
  initialAgeGroupSlug,
  initialDomainId = 'all',
  completedActivityIds,
  onOpenActivity,
}: ActivitiesLibrarySectionProps) {
  const [selectedAgeSlug, setSelectedAgeSlug] = useState(initialAgeGroupSlug);
  const [selectedDomainId, setSelectedDomainId] = useState(initialDomainId);
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedAgeSlug(initialAgeGroupSlug);
  }, [initialAgeGroupSlug]);

  useEffect(() => {
    setSelectedDomainId(initialDomainId);
  }, [initialDomainId]);

  const loadActivities = async (ageSlug: string, domainId: string) => {
    setLoading(true);
    setError(null);
    try {
      const matchedAge = ageGroups.find((g) => g.slug === ageSlug);
      const { activities: list } = await api.listPublishedActivities(
        matchedAge?.id,
        domainId === 'all' ? undefined : domainId
      );
      setActivities(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load activities right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ageGroups.length > 0) {
      void loadActivities(selectedAgeSlug, selectedDomainId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAgeSlug, selectedDomainId, ageGroups.length]);

  const domainOptions = [
    { value: 'all', label: 'All six development areas' },
    ...learningDomains.map((d) => ({ value: d.id, label: d.name })),
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="font-display text-2xl sm:text-3xl font-semibold text-charcoal">
          Activity Library
        </h2>
        <p className="text-sm text-muted">
          Explore calm, everyday activities by age stage and development area.
        </p>
      </div>

      <Card className="space-y-4">
        <AgeGroupSelector
          label="Choose age stage (0–24 months)"
          selectedSlug={selectedAgeSlug}
          onSelect={(slug) => setSelectedAgeSlug(slug)}
          allowAll
        />

        <div className="max-w-sm">
          <Select
            label="Filter by development area"
            options={domainOptions}
            value={selectedDomainId}
            onChange={(e) => setSelectedDomainId(e.target.value)}
          />
        </div>
      </Card>

      {error && (
        <Card className="border-danger/40 bg-danger-soft/50 flex flex-wrap items-center justify-between gap-3">
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void loadActivities(selectedAgeSlug, selectedDomainId)}
          >
            Try Again
          </Button>
        </Card>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : activities.length === 0 ? (
        <EmptyState
          title="No activities in this filter yet"
          description="Try switching to another development area or viewing all six areas for this age stage."
          actionLabel="Show All Six Areas"
          onAction={() => setSelectedDomainId('all')}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {activities.map((act) => {
            const done = completedActivityIds.has(act.id);
            return (
              <ActivityCard
                key={act.id}
                title={act.title}
                summary={act.summary}
                domainName={act.domainName}
                ageGroupLabel={act.ageGroupLabel}
                durationMinutes={act.durationMinutes}
                prepLevelLabel={formatPrepLevel(act.prepLevel)}
                materials={act.materials}
                posterUrl={act.instructionalPosterUrl}
                statusText={done ? 'Completed' : 'Not started'}
                statusTone={done ? 'sage' : 'neutral'}
                statusState={done ? 'completed' : 'not_started'}
                completed={done}
                actionLabel={done ? 'View Activity' : 'Start Activity'}
                onAction={() => onOpenActivity(act.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ========================================================================= */
/* 2. PARENTING GUIDES SECTION                                               */
/* ========================================================================= */
const PARENTING_GUIDES = [
  {
    id: 'guide_floor_space',
    tag: 'Home Setup',
    readTime: '3 min read',
    title: 'Setting up a calm, clutter-free floor mat at home',
    summary:
      'A folded cotton dhurrie in natural morning light with two or three safe household items is all a baby needs for deep focus.',
    points: [
      'Choose a firm, flat mat away from bright overhead bulbs and background television noise.',
      'Offer just 2–3 objects at a time so your baby can choose without visual overwhelm.',
      'Sit comfortably beside your baby with relaxed shoulders—calm energy invites curiosity.',
    ],
  },
  {
    id: 'guide_follow_cues',
    tag: 'Gentle Pacing',
    readTime: '2 min read',
    title: 'Recognizing alert windows and early tired cues',
    summary:
      'Short, joyful 4-minute sessions during a rested window support learning far better than pushing through fussiness.',
    points: [
      'Best times are usually 20–30 minutes after a feed and nap when eyes are bright and relaxed.',
      'Looking away, arching back, or rubbing eyes are gentle signs your baby is ready to rest.',
      'Stopping early while everyone is smiling makes tomorrow’s play even smoother.',
    ],
  },
  {
    id: 'guide_household_items',
    tag: 'Everyday Materials',
    readTime: '3 min read',
    title: 'Safe everyday Indian home items for sensory play',
    summary:
      'You never need expensive plastic toys—smooth neem spoons, rounded steel katoris, and breathable muslin cloths offer rich natural textures.',
    points: [
      'Always check that items have smooth edges and are larger than 4.5 cm in diameter.',
      'Wash household items with mild soap and warm water before floor exploration.',
      'Stay within arm’s reach throughout mouthing, tapping, and reaching play.',
    ],
  },
  {
    id: 'guide_coaching_promise',
    tag: 'Privacy & Trust',
    readTime: '2 min read',
    title: 'How optional caregiver coaching works (and stays private)',
    summary:
      'Video coaching evaluates how clearly an activity’s instructions were set up and paced—never your baby’s intelligence or health.',
    points: [
      'Clips are stored privately outside public folders and auto-delete after 30 days.',
      'You can permanently delete any uploaded clip at any time while keeping your written tips.',
      'Coaching focuses on warm encouragement and one simple adjustment for next time.',
    ],
  },
];

export function ParentingGuidesSection({ childAgeLabel }: { childAgeLabel: string }) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Badge tone="sage">Practical Caregiver Library</Badge>
        <h2 className="font-display text-2xl sm:text-3xl font-semibold text-charcoal">
          Parenting Guides
        </h2>
        <p className="text-sm text-muted">
          Short, reassuring home guides to accompany your {childAgeLabel} daily journey.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {PARENTING_GUIDES.map((guide) => (
          <Card key={guide.id} padding="lg" className="space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Badge tone="neutral">{guide.tag}</Badge>
                <span className="font-mono text-xs text-muted tabular-nums">{guide.readTime}</span>
              </div>
              <h3 className="font-display text-xl font-semibold text-charcoal leading-snug">
                {guide.title}
              </h3>
              <p className="text-sm text-muted leading-relaxed">{guide.summary}</p>
              <ul className="space-y-2 pt-1 text-sm text-charcoal">
                {guide.points.map((pt, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <BookOpen className="w-4 h-4 text-sage shrink-0 mt-0.5" aria-hidden="true" />
                    <span className="text-xs sm:text-sm leading-relaxed">{pt}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ========================================================================= */
/* 4. NOTIFICATIONS SECTION                                                  */
/* ========================================================================= */
interface NotificationsSectionProps {
  notifications: ParentNotificationItem[];
  locale: LocaleCode;
  onNotificationAction: (item: ParentNotificationItem) => void;
}

export function NotificationsSection({
  notifications,
  locale,
  onNotificationAction,
}: NotificationsSectionProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="font-display text-2xl sm:text-3xl font-semibold text-charcoal">
          Notifications
        </h2>
        <p className="text-sm text-muted">
          Calm updates on caregiver coaching feedback, account security, and today’s plan.
        </p>
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          icon={<Bell className="w-6 h-6" />}
          title="You’re all caught up"
          description="There are no new alerts right now. Take a calm breath and enjoy today’s moments."
        />
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <Card key={n.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <span
                  className={`w-9 h-9 rounded-lg inline-flex items-center justify-center shrink-0 ${
                    n.kind === 'review_ready'
                      ? 'bg-sage-soft text-sage'
                      : n.kind === 'email_verify'
                        ? 'bg-peach-soft text-peach-ink'
                        : 'bg-cream text-sage'
                  }`}
                >
                  {n.kind === 'review_ready' ? (
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  ) : n.kind === 'email_verify' ? (
                    <MailCheck className="w-4 h-4" aria-hidden="true" />
                  ) : n.kind === 'submission_queued' ? (
                    <Clock className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Sparkles className="w-4 h-4" aria-hidden="true" />
                  )}
                </span>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-charcoal">{n.title}</p>
                  <p className="text-xs text-muted leading-relaxed">{n.description}</p>
                  <p className="font-mono text-[11px] text-muted tabular-nums">
                    {formatDateReadable(n.createdAt, locale)}
                  </p>
                </div>
              </div>
              {n.actionLabel && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onNotificationAction(n)}
                >
                  {n.actionLabel}
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ========================================================================= */
/* 5. PROFILE SECTION (PARENT + BABY PROFILES)                               */
/* ========================================================================= */
interface ProfileSectionProps {
  childrenList: ChildProfile[];
  selectedChildId: string | null;
  onSelectChild: (childId: string) => void;
  onChildrenUpdated: () => Promise<void>;
}

export function ProfileSection({
  childrenList,
  selectedChildId,
  onSelectChild,
  onChildrenUpdated,
}: ProfileSectionProps) {
  const { user, setUser, setVerificationPreviewPath } = useAuth();
  const { notify } = useToast();

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [photoUrl, setPhotoUrl] = useState<string | null>(user?.profilePhotoUrl ?? null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [savingParent, setSavingParent] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  // Add / Edit Child Modal
  const [childModalOpen, setChildModalOpen] = useState(false);
  const [editingChild, setEditingChild] = useState<ChildProfile | null>(null);
  const [childName, setChildName] = useState('');
  const [childDob, setChildDob] = useState('');
  const [childPrefs, setChildPrefs] = useState('');
  const [savingChild, setSavingChild] = useState(false);
  const [childError, setChildError] = useState<string | null>(null);

  const openAddChild = () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 4);
    setEditingChild(null);
    setChildName('');
    setChildDob(d.toISOString().slice(0, 10));
    setChildPrefs('');
    setChildError(null);
    setChildModalOpen(true);
  };

  const openEditChild = (child: ChildProfile) => {
    setEditingChild(child);
    setChildName(child.displayName);
    setChildDob(child.dateOfBirth);
    setChildPrefs(child.activityPreferences ?? '');
    setChildError(null);
    setChildModalOpen(true);
  };

  const handleUploadPhoto = async (file: File | undefined) => {
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const { photoUrl: nextUrl } = await api.uploadProfilePhoto(file);
      setPhotoUrl(nextUrl);
      notify({ tone: 'success', title: 'Profile photo uploaded privately' });
    } catch (err) {
      notify({
        tone: 'error',
        title: 'Photo upload failed',
        description: err instanceof Error ? err.message : 'Please try a JPG, PNG, or WebP photo.',
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveParent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingParent(true);
    try {
      const res = await api.saveOnboardingParent({
        fullName: fullName.trim(),
        email: email.trim(),
        preferredLocale: user.preferredLocale,
        profilePhotoUrl: photoUrl,
      });
      setUser(res.user);
      if (res.verificationPreviewPath) {
        setVerificationPreviewPath(res.verificationPreviewPath);
      }
      notify({ tone: 'success', title: 'Parent profile updated' });
    } catch (err) {
      notify({
        tone: 'error',
        title: 'Could not update profile',
        description: err instanceof Error ? err.message : 'Please check your details.',
      });
    } finally {
      setSavingParent(false);
    }
  };

  const handleSaveChild = async (e: React.FormEvent) => {
    e.preventDefault();
    setChildError(null);
    if (!childName.trim()) {
      setChildError('Please enter your baby’s name or nickname.');
      return;
    }
    setSavingChild(true);
    try {
      const { child } = editingChild
        ? await api.updateChild(editingChild.id, childName.trim(), childDob, {
            activityPreferences: childPrefs.trim() || null,
          })
        : await api.createChild(childName.trim(), childDob, {
            activityPreferences: childPrefs.trim() || null,
          });
      await onChildrenUpdated();
      onSelectChild(child.id);
      setChildModalOpen(false);
      notify({
        tone: 'success',
        title: editingChild ? 'Baby profile updated' : `${child.displayName} added`,
      });
    } catch (err) {
      setChildError(err instanceof Error ? err.message : 'Unable to save baby profile.');
    } finally {
      setSavingChild(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="font-display text-2xl sm:text-3xl font-semibold text-charcoal">
          Family Profile
        </h2>
        <p className="text-sm text-muted">
          Manage your caregiver profile and your baby’s stage details.
        </p>
      </div>

      {/* Parent Profile Card */}
      <Card padding="lg" className="space-y-5">
        <h3 className="font-display text-lg font-semibold text-charcoal">Parent Details</h3>
        <form onSubmit={handleSaveParent} className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-cream border border-border-strong overflow-hidden flex items-center justify-center shrink-0">
              {photoUrl ? (
                <img src={photoUrl} alt="Parent avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-7 h-7 text-muted" aria-hidden="true" />
              )}
            </div>
            <div className="space-y-1.5">
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  void handleUploadPhoto(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={uploadingPhoto}
                  leftIcon={<Camera className="w-4 h-4" />}
                  onClick={() => photoInputRef.current?.click()}
                >
                  {photoUrl ? 'Change Photo' : 'Add Photo (Optional)'}
                </Button>
                {photoUrl && (
                  <Button
                    type="button"
                    variant="subtle"
                    size="sm"
                    onClick={() => setPhotoUrl(null)}
                  >
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted">Private to your account only.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Parent’s name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <Input
              label="Email address"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit" variant="primary" loading={savingParent}>
              Save Profile Changes
            </Button>
          </div>
        </form>
      </Card>

      {/* Baby Profiles */}
      <Card padding="lg" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold text-charcoal">Your Little Ones</h3>
            <p className="text-xs text-muted">
              Activities automatically match each child’s 3-month developmental stage.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={openAddChild}
          >
            Add Child
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {childrenList.map((child) => {
            const isActive = child.id === selectedChildId;
            return (
              <div
                key={child.id}
                className={`rounded-xl border p-4 space-y-3 ${
                  isActive ? 'border-sage bg-sage-soft/40' : 'border-border bg-offwhite'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-surface border border-border overflow-hidden flex items-center justify-center shrink-0">
                      {child.profilePhotoUrl ? (
                        <img
                          src={child.profilePhotoUrl}
                          alt={child.displayName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Baby className="w-5 h-5 text-sage" aria-hidden="true" />
                      )}
                    </div>
                    <div>
                      <p className="font-display text-base font-semibold text-charcoal">
                        {child.displayName}
                      </p>
                      <p className="text-xs text-muted font-mono tabular-nums">
                        {child.ageInMonths} months · {child.ageGroupLabel}
                      </p>
                    </div>
                  </div>
                  {isActive && <Badge tone="sage">Active</Badge>}
                </div>

                {child.activityPreferences && (
                  <p className="text-xs text-muted bg-surface/80 rounded-lg px-3 py-2 border border-border">
                    Notes: {child.activityPreferences}
                  </p>
                )}

                <div className="flex items-center gap-2 pt-1">
                  {!isActive && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onSelectChild(child.id)}
                    >
                      Switch to {child.displayName}
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openEditChild(child)}
                  >
                    Edit Details
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Modal
        open={childModalOpen}
        onClose={() => setChildModalOpen(false)}
        title={editingChild ? `Edit ${editingChild.displayName}` : 'Add a Child Profile'}
        description="Your baby’s date of birth matches them to the right 0–24 month stage."
      >
        <form onSubmit={handleSaveChild} className="space-y-4">
          <Input
            label="Baby’s name or nickname"
            required
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            placeholder="e.g., Aarav or Diya"
          />
          <DatePicker
            label="Date of birth"
            required
            max={new Date().toISOString().slice(0, 10)}
            value={childDob}
            onChange={(e) => setChildDob(e.target.value)}
            showBabyAgePreview
          />
          <div className="space-y-1.5">
            <label htmlFor="edit-child-prefs" className="block text-sm font-medium text-charcoal">
              Accessibility or activity preferences (Optional)
            </label>
            <textarea
              id="edit-child-prefs"
              rows={2}
              value={childPrefs}
              onChange={(e) => setChildPrefs(e.target.value)}
              placeholder="Any quiet play or comfort preferences"
              className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-sm text-charcoal focus:border-sage"
            />
          </div>
          {childError && (
            <p role="alert" className="text-xs text-danger bg-danger-soft px-3 py-2 rounded-lg">
              {childError}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setChildModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={savingChild}>
              {editingChild ? 'Save Changes' : 'Add Child'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/* ========================================================================= */
/* 6. SETTINGS SECTION                                                       */
/* ========================================================================= */
interface SettingsSectionProps {
  onNavigate: (target: NavigateTarget) => void;
  onOpenDesignSystem: () => void;
  onLogout: () => Promise<void>;
}

export function SettingsSection({
  onNavigate,
  onOpenDesignSystem,
  onLogout,
}: SettingsSectionProps) {
  const { user, setUser, verificationPreviewPath } = useAuth();
  const { notify } = useToast();

  const [activityTime, setActivityTime] = useState<PreferredActivityTime>(
    user?.preferredActivityTime ?? 'morning'
  );
  const [notifPref, setNotifPref] = useState<NotificationPreference>(
    user?.notificationPreference ?? 'daily_gentle'
  );
  const [locale, setLocale] = useState<LocaleCode>(user?.preferredLocale ?? 'en');
  const [saving, setSaving] = useState(false);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { user: updated } = await api.completeOnboarding({
        preferredActivityTime: activityTime,
        notificationPreference: notifPref,
        preferredLocale: locale,
        markComplete: true,
      });
      setUser(updated);
      notify({ tone: 'success', title: 'Preferences saved' });
    } catch (err) {
      notify({
        tone: 'error',
        title: 'Unable to save settings',
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="font-display text-2xl sm:text-3xl font-semibold text-charcoal">
          Settings
        </h2>
        <p className="text-sm text-muted">
          Personalize your daily rhythm, notifications, language, and account security.
        </p>
      </div>

      <Card padding="lg" className="space-y-5">
        <h3 className="font-display text-lg font-semibold text-charcoal">
          Daily Rhythm & Language
        </h3>
        <form onSubmit={handleSaveSettings} className="space-y-4">
          <Select
            label="Preferred daily activity time"
            value={activityTime}
            onChange={(e) => setActivityTime(e.target.value as PreferredActivityTime)}
            options={[
              { value: 'morning', label: 'Morning (8:00 AM – 11:30 AM)' },
              { value: 'afternoon', label: 'Afternoon (1:00 PM – 4:30 PM)' },
              { value: 'evening', label: 'Evening (5:00 PM – 7:30 PM)' },
              { value: 'flexible', label: 'Flexible · Whenever baby is rested' },
            ]}
          />
          <Select
            label="Notification preference"
            value={notifPref}
            onChange={(e) => setNotifPref(e.target.value as NotificationPreference)}
            options={[
              { value: 'daily_gentle', label: 'Gentle daily reminder' },
              { value: 'weekly_summary', label: 'Weekly summary only' },
              { value: 'none', label: 'No reminders' },
            ]}
          />
          <Select
            label="Preferred language"
            value={locale}
            onChange={(e) => setLocale(e.target.value as LocaleCode)}
            options={[
              { value: 'en', label: 'English' },
              { value: 'hi', label: 'हिन्दी (Hindi · beta)' },
            ]}
          />
          <div className="flex justify-end">
            <Button type="submit" variant="primary" loading={saving}>
              Save Preferences
            </Button>
          </div>
        </form>
      </Card>

      <Card padding="lg" className="space-y-4">
        <h3 className="font-display text-lg font-semibold text-charcoal">
          Account & Security
        </h3>
        <div className="divide-y divide-border">
          <div className="py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-sage" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-charcoal">Email Verification</p>
                <p className="text-xs text-muted">
                  {user?.emailVerifiedAt
                    ? `Verified (${user.email})`
                    : `Not yet verified (${user?.email})`}
                </p>
              </div>
            </div>
            {user?.emailVerifiedAt ? (
              <Badge tone="sage">Verified</Badge>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  onNavigate((verificationPreviewPath || '/verify-email') as NavigateTarget)
                }
              >
                Verify Email
              </Button>
            )}
          </div>

          <div className="py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <KeyRound className="w-4 h-4 text-sage" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-charcoal">Password Reset</p>
                <p className="text-xs text-muted">
                  Request a one-time reset link to update your password.
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onNavigate('/forgot-password')}
            >
              Reset Password
            </Button>
          </div>

          <div className="py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Palette className="w-4 h-4 text-sage" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-charcoal">LittleSteps Design System</p>
                <p className="text-xs text-muted">View the UI component foundation.</p>
              </div>
            </div>
            <Button variant="subtle" size="sm" onClick={onOpenDesignSystem}>
              Open Reference
            </Button>
          </div>
        </div>

        <div className="pt-2 border-t border-border flex justify-end">
          <Button
            variant="secondary"
            leftIcon={<LogOut className="w-4 h-4" />}
            onClick={() => void onLogout()}
          >
            Sign Out
          </Button>
        </div>
      </Card>
    </div>
  );
}

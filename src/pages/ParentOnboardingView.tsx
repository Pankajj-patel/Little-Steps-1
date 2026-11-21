import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Baby,
  Bell,
  BookOpen,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  Hand,
  Heart,
  MailCheck,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  Badge,
  Button,
  Card,
  DatePicker,
  Input,
  ProgressIndicator,
  Select,
  useToast,
} from '../design-system';
import { api } from '../lib/api';
import type { NavigateTarget } from '../lib/router';
import {
  calculateAgeInMonths,
  CANONICAL_AGE_GROUPS,
  CANONICAL_LEARNING_DOMAINS,
  resolveAgeGroupSlug,
} from '../shared/domain';
import type {
  ChildProfile,
  LocaleCode,
  NotificationPreference,
  PreferredActivityTime,
} from '../shared/types';

interface ParentOnboardingViewProps {
  onNavigate: (target: NavigateTarget) => void;
}

const STEPS = [
  { id: 1, shortLabel: 'Welcome', title: 'Welcome' },
  { id: 2, shortLabel: 'Parent', title: 'Parent info' },
  { id: 3, shortLabel: 'Baby', title: 'Baby info' },
  { id: 4, shortLabel: 'Journey', title: '6 areas' },
  { id: 5, shortLabel: 'Rhythm', title: 'Preferences' },
  { id: 6, shortLabel: 'Ready', title: 'Complete' },
] as const;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिन्दी (Hindi · beta)' },
];

const ACTIVITY_TIME_OPTIONS: Array<{
  value: PreferredActivityTime;
  title: string;
  description: string;
}> = [
  {
    value: 'morning',
    title: 'Morning',
    description: 'Calm sunlit play after morning feeds (8:00 AM – 11:30 AM).',
  },
  {
    value: 'afternoon',
    title: 'Afternoon',
    description: 'Quiet floor time after midday nap (1:00 PM – 4:30 PM).',
  },
  {
    value: 'evening',
    title: 'Evening',
    description: 'Unhurried bonding before dinner or bedtime (5:00 PM – 7:30 PM).',
  },
  {
    value: 'flexible',
    title: 'Flexible',
    description: 'Whenever my baby is rested, fed, and comfortably alert.',
  },
];

const NOTIFICATION_OPTIONS: Array<{
  value: NotificationPreference;
  title: string;
  description: string;
}> = [
  {
    value: 'daily_gentle',
    title: 'Gentle daily reminder',
    description: 'One calm nudge at your preferred activity time.',
  },
  {
    value: 'weekly_summary',
    title: 'Weekly summary only',
    description: 'A single calm weekend reflection on completed moments.',
  },
  {
    value: 'none',
    title: 'No reminders',
    description: 'I’ll open LittleSteps at my own pace without alerts.',
  },
];

const DOMAIN_ICONS: Record<string, React.ReactNode> = {
  cognitive: <Sparkles className="w-5 h-5" aria-hidden="true" />,
  language: <MessageCircle className="w-5 h-5" aria-hidden="true" />,
  physical: <Compass className="w-5 h-5" aria-hidden="true" />,
  'social-emotional': <Heart className="w-5 h-5" aria-hidden="true" />,
  sensory: <Sun className="w-5 h-5" aria-hidden="true" />,
  'early-independence': <Hand className="w-5 h-5" aria-hidden="true" />,
};

const DOMAIN_PLAIN_GUIDE: Record<string, string> = {
  cognitive: 'Curious cause-and-effect play like peek-a-boo, grasping, and gentle sorting.',
  language: 'Face-to-face cooing, naming everyday household objects, and warm songs.',
  physical: 'Safe floor exploration, tummy time, reaching, rolling, and steady balance.',
  'social-emotional': 'Responsive eye contact, soothing routines, trust, and joyful connection.',
  sensory: 'Exploring safe home textures—cotton muslin, smooth wood, and gentle sounds.',
  'early-independence': 'Tiny everyday skills like two-handed open cup sips and tidying together.',
};

export function ParentOnboardingView({ onNavigate }: ParentOnboardingViewProps) {
  const { user, setUser, verificationPreviewPath, setVerificationPreviewPath } = useAuth();
  const { notify } = useToast();

  const [step, setStep] = useState<number>(1);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Screen 2: Parent info
  const [parentName, setParentName] = useState(user?.fullName ?? '');
  const [parentEmail, setParentEmail] = useState(user?.email ?? '');
  const [preferredLocale, setPreferredLocale] = useState<LocaleCode>(
    user?.preferredLocale ?? 'en'
  );
  const [parentPhotoUrl, setParentPhotoUrl] = useState<string | null>(
    user?.profilePhotoUrl ?? null
  );
  const [uploadingParentPhoto, setUploadingParentPhoto] = useState(false);
  const [parentErrors, setParentErrors] = useState<{
    fullName?: string;
    email?: string;
    photo?: string;
  }>({});
  const parentPhotoInputRef = useRef<HTMLInputElement | null>(null);

  // Screen 3: Baby info
  const [existingChild, setExistingChild] = useState<ChildProfile | null>(null);
  const [babyName, setBabyName] = useState('');
  const [babyDob, setBabyDob] = useState('');
  const [babyPhotoUrl, setBabyPhotoUrl] = useState<string | null>(null);
  const [activityPreferences, setActivityPreferences] = useState('');
  const [uploadingBabyPhoto, setUploadingBabyPhoto] = useState(false);
  const [babyErrors, setBabyErrors] = useState<{
    babyName?: string;
    babyDob?: string;
    photo?: string;
  }>({});
  const babyPhotoInputRef = useRef<HTMLInputElement | null>(null);

  // Screen 5: Personalization
  const [preferredActivityTime, setPreferredActivityTime] = useState<PreferredActivityTime>(
    user?.preferredActivityTime ?? 'morning'
  );
  const [notificationPreference, setNotificationPreference] = useState<NotificationPreference>(
    user?.notificationPreference ?? 'daily_gentle'
  );

  // Hydrate existing child if parent returns mid-onboarding or refreshes page
  useEffect(() => {
    let active = true;
    async function loadExistingChild() {
      try {
        const { children } = await api.listChildren();
        if (!active || children.length === 0) return;
        const first = children[0];
        setExistingChild(first);
        setBabyName(first.displayName);
        setBabyDob(first.dateOfBirth);
        setBabyPhotoUrl(first.profilePhotoUrl ?? null);
        setActivityPreferences(first.activityPreferences ?? '');
      } catch {
        // Silent; parent has not added a child yet
      }
    }
    void loadExistingChild();
    return () => {
      active = false;
    };
  }, []);

  const todayIso = new Date().toISOString().slice(0, 10);

  const handlePhotoSelect = async (
    file: File | undefined,
    target: 'parent' | 'baby'
  ) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      const msg = 'Please choose a photo smaller than 5 MB.';
      if (target === 'parent') setParentErrors((p) => ({ ...p, photo: msg }));
      else setBabyErrors((p) => ({ ...p, photo: msg }));
      return;
    }

    if (target === 'parent') {
      setUploadingParentPhoto(true);
      setParentErrors((p) => ({ ...p, photo: undefined }));
    } else {
      setUploadingBabyPhoto(true);
      setBabyErrors((p) => ({ ...p, photo: undefined }));
    }

    try {
      const { photoUrl } = await api.uploadProfilePhoto(file);
      if (target === 'parent') {
        setParentPhotoUrl(photoUrl);
      } else {
        setBabyPhotoUrl(photoUrl);
      }
      notify({
        tone: 'success',
        title: 'Photo added',
        description: 'Stored privately and visible only to your account.',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to upload photo.';
      if (target === 'parent') setParentErrors((p) => ({ ...p, photo: msg }));
      else setBabyErrors((p) => ({ ...p, photo: msg }));
    } finally {
      if (target === 'parent') setUploadingParentPhoto(false);
      else setUploadingBabyPhoto(false);
    }
  };

  const handleSaveParentStep = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    const nextErrors: { fullName?: string; email?: string } = {};
    if (parentName.trim().length < 2) {
      nextErrors.fullName = 'Please enter your name (at least 2 characters).';
    }
    if (!parentEmail.trim() || !EMAIL_REGEX.test(parentEmail.trim())) {
      nextErrors.email = 'Please enter a valid email address.';
    }
    setParentErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      const res = await api.saveOnboardingParent({
        fullName: parentName.trim(),
        email: parentEmail.trim(),
        preferredLocale,
        profilePhotoUrl: parentPhotoUrl,
      });
      setUser(res.user);
      if (res.verificationPreviewPath) {
        setVerificationPreviewPath(res.verificationPreviewPath);
      }
      setStep(3);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Unable to save your details.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBabyStep = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    const nextErrors: { babyName?: string; babyDob?: string } = {};
    if (babyName.trim().length < 1) {
      nextErrors.babyName = 'Please enter your baby’s name or preferred nickname.';
    }
    if (!babyDob || !/^\d{4}-\d{2}-\d{2}$/.test(babyDob)) {
      nextErrors.babyDob = 'Please select your baby’s date of birth.';
    } else if (new Date(babyDob).getTime() > Date.now()) {
      nextErrors.babyDob = 'Date of birth cannot be in the future.';
    }
    setBabyErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      const options = {
        profilePhotoUrl: babyPhotoUrl,
        activityPreferences: activityPreferences.trim() || null,
      };
      const { child } = existingChild
        ? await api.updateChild(existingChild.id, babyName.trim(), babyDob, options)
        : await api.createChild(babyName.trim(), babyDob, options);
      setExistingChild(child);
      setStep(4);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Unable to save baby details.');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePreferencesStep = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setSaving(true);
    try {
      const { user: updated } = await api.completeOnboarding({
        preferredActivityTime,
        notificationPreference,
        preferredLocale,
        markComplete: false,
      });
      setUser(updated);
      setStep(6);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Unable to save preferences.');
    } finally {
      setSaving(false);
    }
  };

  const handleFinishOnboarding = async () => {
    setServerError(null);
    setSaving(true);
    try {
      const { user: completedUser } = await api.completeOnboarding({
        preferredActivityTime,
        notificationPreference,
        preferredLocale,
        markComplete: true,
      });
      setUser(completedUser);
      notify({
        tone: 'success',
        title: `Welcome, ${completedUser.fullName.split(' ')[0]}!`,
        description: `${existingChild?.displayName || 'Your baby'}’s daily activities are ready.`,
      });
      onNavigate('/');
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Unable to complete onboarding.');
    } finally {
      setSaving(false);
    }
  };

  const matchedMonths =
    babyDob && /^\d{4}-\d{2}-\d{2}$/.test(babyDob) ? calculateAgeInMonths(babyDob) : null;
  const matchedBandLabel =
    matchedMonths !== null
      ? CANONICAL_AGE_GROUPS.find((g) => g.slug === resolveAgeGroupSlug(matchedMonths))?.label ??
        '0–3 months'
      : existingChild?.ageGroupLabel ?? '0–3 months';

  const canJumpToStep = (targetStep: number) => {
    if (targetStep < step) return true;
    return false;
  };

  const goBack = () => {
    setServerError(null);
    setStep((prev) => Math.max(1, prev - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
      {/* Stepper Header */}
      <nav aria-label="Onboarding progress" className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-xs text-sage tabular-nums">
            Step {step} of {STEPS.length}
          </span>
          <span className="text-xs text-muted">
            {STEPS[step - 1]?.title}
          </span>
        </div>

        {/* Mobile compact bar */}
        <div className="sm:hidden">
          <ProgressIndicator
            value={step}
            max={STEPS.length}
            tone="sage"
            size="sm"
          />
        </div>

        {/* Desktop 6-step horizontal stepper */}
        <ol className="hidden sm:grid grid-cols-6 gap-2">
          {STEPS.map((s) => {
            const isDone = s.id < step;
            const isCurrent = s.id === step;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  disabled={!canJumpToStep(s.id)}
                  onClick={() => {
                    if (canJumpToStep(s.id)) {
                      setServerError(null);
                      setStep(s.id);
                    }
                  }}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`w-full text-left rounded-xl border px-2.5 py-2 transition-colors ${
                    isCurrent
                      ? 'bg-sage-soft border-sage text-sage font-medium'
                      : isDone
                        ? 'bg-surface border-sage-border text-charcoal hover:bg-cream cursor-pointer'
                        : 'bg-surface/60 border-border text-muted cursor-default'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-5 h-5 rounded-full text-[11px] font-mono tabular-nums inline-flex items-center justify-center shrink-0 ${
                        isDone
                          ? 'bg-sage text-white'
                          : isCurrent
                            ? 'bg-sage text-white'
                            : 'bg-cream text-muted'
                      }`}
                    >
                      {isDone ? <Check className="w-3 h-3" aria-hidden="true" /> : s.id}
                    </span>
                    <span className="text-xs truncate">{s.shortLabel}</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* ================================================================= */}
      {/* SCREEN 1: WELCOME                                                 */}
      {/* ================================================================= */}
      {step === 1 && (
        <Card padding="lg" className="space-y-6">
          <div className="space-y-3">
            <Badge tone="sage">Guided Setup · 2 minutes</Badge>
            <h1 className="font-display text-3xl sm:text-4xl font-semibold text-charcoal leading-tight">
              Let's get to know your little one.
            </h1>
            <p className="text-sm sm:text-base text-muted leading-relaxed">
              Sharing a few simple details helps LittleSteps match gentle, age-appropriate daily
              activities to your baby’s exact stage — without overwhelming you with information you
              don’t need yet.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-cream/70 border border-border p-4 space-y-1.5">
              <Baby className="w-5 h-5 text-sage" aria-hidden="true" />
              <p className="text-sm font-medium text-charcoal">Matched to age</p>
              <p className="text-xs text-muted leading-relaxed">
                Automatically selects the right 3-month developmental window (0–24 months).
              </p>
            </div>
            <div className="rounded-xl bg-cream/70 border border-border p-4 space-y-1.5">
              <Clock className="w-5 h-5 text-sage" aria-hidden="true" />
              <p className="text-sm font-medium text-charcoal">Fits your rhythm</p>
              <p className="text-xs text-muted leading-relaxed">
                Choose your preferred daily window and gentle reminder pace.
              </p>
            </div>
            <div className="rounded-xl bg-cream/70 border border-border p-4 space-y-1.5">
              <ShieldCheck className="w-5 h-5 text-sage" aria-hidden="true" />
              <p className="text-sm font-medium text-charcoal">Private by design</p>
              <p className="text-xs text-muted leading-relaxed">
                Only you can access your family profile, photos, and baby’s details.
              </p>
            </div>
          </div>

          {user && !user.emailVerifiedAt && (
            <div className="rounded-xl bg-peach-soft/70 border border-peach p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <MailCheck className="w-5 h-5 text-peach-ink shrink-0 mt-0.5" aria-hidden="true" />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-charcoal">Verify your email anytime</p>
                  <p className="text-xs text-muted">
                    We prepared a verification link for <span className="font-medium">{user.email}</span>.
                    You can confirm now or after setup.
                  </p>
                </div>
              </div>
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
          )}

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-muted">
              You can go back and edit any answer before finishing.
            </p>
            <Button
              variant="primary"
              size="lg"
              rightIcon={<ArrowRight className="w-4 h-4" />}
              onClick={() => setStep(2)}
            >
              Get Started
            </Button>
          </div>
        </Card>
      )}

      {/* ================================================================= */}
      {/* SCREEN 2: PARENT INFORMATION                                      */}
      {/* ================================================================= */}
      {step === 2 && (
        <Card padding="lg" className="space-y-6">
          <div className="space-y-2">
            <Badge tone="neutral">Step 2 · Parent Details</Badge>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-charcoal">
              Tell us a little about you
            </h2>
            <p className="text-sm text-muted leading-relaxed">
              We use your name, email, and language choice to personalize daily guidance and keep
              your family account secure.
            </p>
          </div>

          <form onSubmit={handleSaveParentStep} noValidate className="space-y-5">
            {/* Optional profile photo */}
            <div className="rounded-xl bg-cream/60 border border-border p-4 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-surface border border-border-strong overflow-hidden flex items-center justify-center shrink-0">
                {parentPhotoUrl ? (
                  <img
                    src={parentPhotoUrl}
                    alt="Parent profile preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-7 h-7 text-muted" aria-hidden="true" />
                )}
              </div>
              <div className="flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-charcoal">Profile photo</p>
                  <Badge tone="neutral">Optional</Badge>
                </div>
                <p className="text-xs text-muted">
                  Only visible to you inside your private workspace (JPG, PNG, or WebP up to 5 MB).
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <input
                    ref={parentPhotoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      void handlePhotoSelect(e.target.files?.[0], 'parent');
                      e.target.value = '';
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    loading={uploadingParentPhoto}
                    leftIcon={<Camera className="w-4 h-4" />}
                    onClick={() => parentPhotoInputRef.current?.click()}
                  >
                    {parentPhotoUrl ? 'Change Photo' : 'Add Photo'}
                  </Button>
                  {parentPhotoUrl && (
                    <Button
                      type="button"
                      variant="subtle"
                      size="sm"
                      leftIcon={<Trash2 className="w-4 h-4" />}
                      onClick={() => setParentPhotoUrl(null)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                {parentErrors.photo && (
                  <p role="alert" className="text-xs text-danger">
                    {parentErrors.photo}
                  </p>
                )}
              </div>
            </div>

            <Input
              label="Parent’s name"
              required
              autoComplete="name"
              value={parentName}
              onChange={(e) => {
                setParentName(e.target.value);
                if (parentErrors.fullName) setParentErrors((p) => ({ ...p, fullName: undefined }));
              }}
              error={parentErrors.fullName}
              placeholder="e.g., Meera Deshmukh"
              helperText="How we greet you on your daily dashboard."
            />

            <Input
              label="Email address"
              type="email"
              required
              autoComplete="email"
              value={parentEmail}
              onChange={(e) => {
                setParentEmail(e.target.value);
                if (parentErrors.email) setParentErrors((p) => ({ ...p, email: undefined }));
              }}
              error={parentErrors.email}
              placeholder="you@example.com"
              helperText="Used for sign-in, password recovery, and account security notices."
            />

            <Select
              label="Preferred language"
              required
              options={LANGUAGE_OPTIONS}
              value={preferredLocale}
              onChange={(e) => setPreferredLocale(e.target.value as LocaleCode)}
              helperText="English is full-featured today, with Hindi localization built into the platform."
            />

            {serverError && (
              <p role="alert" className="text-xs text-danger bg-danger-soft px-3.5 py-2.5 rounded-lg">
                {serverError}
              </p>
            )}

            <div className="pt-2 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3">
              <Button
                type="button"
                variant="secondary"
                leftIcon={<ArrowLeft className="w-4 h-4" />}
                onClick={goBack}
              >
                Back
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={saving}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Save & Continue
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* ================================================================= */}
      {/* SCREEN 3: BABY INFORMATION                                        */}
      {/* ================================================================= */}
      {step === 3 && (
        <Card padding="lg" className="space-y-6">
          <div className="space-y-2">
            <Badge tone="neutral">Step 3 · Baby Details</Badge>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-charcoal">
              About your baby
            </h2>
            <p className="text-sm text-muted leading-relaxed">
              Your baby’s date of birth lets LittleSteps match the right 3-month age stage
              automatically. Your baby’s profile stays completely private to your account.
            </p>
          </div>

          <form onSubmit={handleSaveBabyStep} noValidate className="space-y-5">
            {/* Optional baby photo */}
            <div className="rounded-xl bg-cream/60 border border-border p-4 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-surface border border-border-strong overflow-hidden flex items-center justify-center shrink-0">
                {babyPhotoUrl ? (
                  <img
                    src={babyPhotoUrl}
                    alt="Baby profile preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Baby className="w-7 h-7 text-sage" aria-hidden="true" />
                )}
              </div>
              <div className="flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-charcoal">Baby’s photo</p>
                  <Badge tone="neutral">Optional</Badge>
                </div>
                <p className="text-xs text-muted">
                  Stored privately in your encrypted session vault — never shared publicly.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <input
                    ref={babyPhotoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      void handlePhotoSelect(e.target.files?.[0], 'baby');
                      e.target.value = '';
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    loading={uploadingBabyPhoto}
                    leftIcon={<Camera className="w-4 h-4" />}
                    onClick={() => babyPhotoInputRef.current?.click()}
                  >
                    {babyPhotoUrl ? 'Change Photo' : 'Add Photo'}
                  </Button>
                  {babyPhotoUrl && (
                    <Button
                      type="button"
                      variant="subtle"
                      size="sm"
                      leftIcon={<Trash2 className="w-4 h-4" />}
                      onClick={() => setBabyPhotoUrl(null)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                {babyErrors.photo && (
                  <p role="alert" className="text-xs text-danger">
                    {babyErrors.photo}
                  </p>
                )}
              </div>
            </div>

            <Input
              label="Baby’s name or preferred nickname"
              required
              value={babyName}
              onChange={(e) => {
                setBabyName(e.target.value);
                if (babyErrors.babyName) setBabyErrors((p) => ({ ...p, babyName: undefined }));
              }}
              error={babyErrors.babyName}
              placeholder="e.g., Aarav or Guddu"
              helperText="A nickname works wonderfully if you prefer not to use a full name."
            />

            <DatePicker
              label="Baby’s date of birth"
              required
              max={todayIso}
              value={babyDob}
              onChange={(e) => {
                setBabyDob(e.target.value);
                if (babyErrors.babyDob) setBabyErrors((p) => ({ ...p, babyDob: undefined }));
              }}
              showBabyAgePreview
              error={babyErrors.babyDob}
              helperText="Used strictly to match activities across our 8 age bands (0–24 months)."
            />

            {matchedMonths !== null && matchedMonths > 24 && (
              <p className="text-xs text-peach-ink bg-peach-soft/80 border border-peach px-3.5 py-2.5 rounded-lg">
                LittleSteps is designed for babies aged 0–24 months. We’ve matched your child to
                our 21–24 months stage so you can still explore everyday toddler activities.
              </p>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="onboarding-activity-prefs"
                  className="block text-sm font-medium text-charcoal"
                >
                  Accessibility or activity preferences
                </label>
                <Badge tone="neutral">Optional</Badge>
              </div>
              <textarea
                id="onboarding-activity-prefs"
                rows={3}
                maxLength={500}
                value={activityPreferences}
                onChange={(e) => setActivityPreferences(e.target.value)}
                placeholder="e.g., Prefers quiet floor play, sensitive to loud sounds, or any comfort notes you’d like to keep handy."
                className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-sm text-charcoal placeholder:text-muted/70 hover:border-sage/70 focus:border-sage transition-colors"
              />
              <p className="text-xs text-muted">
                Optional notes to help you remember gentle adaptations during daily play.
              </p>
            </div>

            {serverError && (
              <p role="alert" className="text-xs text-danger bg-danger-soft px-3.5 py-2.5 rounded-lg">
                {serverError}
              </p>
            )}

            <div className="pt-2 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3">
              <Button
                type="button"
                variant="secondary"
                leftIcon={<ArrowLeft className="w-4 h-4" />}
                onClick={goBack}
              >
                Back
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={saving}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Save & Continue
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* ================================================================= */}
      {/* SCREEN 4: DEVELOPMENT JOURNEY (SIX AREAS)                         */}
      {/* ================================================================= */}
      {step === 4 && (
        <Card padding="lg" className="space-y-6">
          <div className="space-y-2">
            <Badge tone="lavender">Step 4 · Development Journey</Badge>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-charcoal">
              Six gentle areas of early growth
            </h2>
            <p className="text-sm text-muted leading-relaxed">
              Each day, {existingChild?.displayName || 'your baby'} receives 2–3 calm, practical
              activities balanced across these six everyday areas — never too much at once.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {CANONICAL_LEARNING_DOMAINS.map((domain) => (
              <div
                key={domain.slug}
                className="rounded-xl border border-border bg-offwhite p-4 space-y-2"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-9 h-9 rounded-lg bg-sage-soft text-sage inline-flex items-center justify-center shrink-0">
                    {DOMAIN_ICONS[domain.slug] ?? <BookOpen className="w-5 h-5" />}
                  </span>
                  <h3 className="font-display text-base font-semibold text-charcoal">
                    {domain.name}
                  </h3>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  {DOMAIN_PLAIN_GUIDE[domain.slug] ?? domain.description}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-cream border border-border p-4 flex items-start gap-3 text-xs text-muted leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-sage shrink-0 mt-0.5" aria-hidden="true" />
            <p>
              <strong className="text-charcoal font-medium">A reassuring promise:</strong>{' '}
              LittleSteps never scores or grades your baby. Optional reviewer feedback only checks
              how clearly an activity’s instructions were demonstrated so you feel supported.
            </p>
          </div>

          <div className="pt-2 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3">
            <Button
              type="button"
              variant="secondary"
              leftIcon={<ArrowLeft className="w-4 h-4" />}
              onClick={goBack}
            >
              Back
            </Button>
            <Button
              type="button"
              variant="primary"
              rightIcon={<ArrowRight className="w-4 h-4" />}
              onClick={() => {
                setStep(5);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              Personalize My Routine
            </Button>
          </div>
        </Card>
      )}

      {/* ================================================================= */}
      {/* SCREEN 5: PERSONALIZATION                                         */}
      {/* ================================================================= */}
      {step === 5 && (
        <Card padding="lg" className="space-y-6">
          <div className="space-y-2">
            <Badge tone="neutral">Step 5 · Personalization</Badge>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-charcoal">
              Shape a calm daily rhythm
            </h2>
            <p className="text-sm text-muted leading-relaxed">
              Tell us when play feels easiest in your day so reminders stay helpful and never
              intrusive.
            </p>
          </div>

          <form onSubmit={handleSavePreferencesStep} className="space-y-6">
            {/* Preferred daily activity time */}
            <fieldset className="space-y-2.5">
              <legend className="text-sm font-medium text-charcoal flex items-center gap-2">
                <Clock className="w-4 h-4 text-sage" aria-hidden="true" />
                Preferred daily activity time
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ACTIVITY_TIME_OPTIONS.map((opt) => {
                  const selected = preferredActivityTime === opt.value;
                  return (
                    <label
                      key={opt.value}
                      className={`rounded-xl border p-3.5 min-h-[44px] flex items-start gap-3 cursor-pointer transition-colors ${
                        selected
                          ? 'bg-sage-soft border-sage'
                          : 'bg-surface border-border hover:border-sage/60'
                      }`}
                    >
                      <input
                        type="radio"
                        name="preferredActivityTime"
                        value={opt.value}
                        checked={selected}
                        onChange={() => setPreferredActivityTime(opt.value)}
                        className="mt-1 accent-sage"
                      />
                      <span className="space-y-0.5">
                        <span className="block text-sm font-medium text-charcoal">{opt.title}</span>
                        <span className="block text-xs text-muted leading-relaxed">
                          {opt.description}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {/* Notification preference */}
            <fieldset className="space-y-2.5">
              <legend className="text-sm font-medium text-charcoal flex items-center gap-2">
                <Bell className="w-4 h-4 text-sage" aria-hidden="true" />
                Notification preference
              </legend>
              <div className="space-y-2.5">
                {NOTIFICATION_OPTIONS.map((opt) => {
                  const selected = notificationPreference === opt.value;
                  return (
                    <label
                      key={opt.value}
                      className={`rounded-xl border p-3.5 min-h-[44px] flex items-start gap-3 cursor-pointer transition-colors ${
                        selected
                          ? 'bg-sage-soft border-sage'
                          : 'bg-surface border-border hover:border-sage/60'
                      }`}
                    >
                      <input
                        type="radio"
                        name="notificationPreference"
                        value={opt.value}
                        checked={selected}
                        onChange={() => setNotificationPreference(opt.value)}
                        className="mt-1 accent-sage"
                      />
                      <span className="space-y-0.5">
                        <span className="block text-sm font-medium text-charcoal">{opt.title}</span>
                        <span className="block text-xs text-muted leading-relaxed">
                          {opt.description}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {/* Preferred language */}
            <Select
              label="Preferred language"
              options={LANGUAGE_OPTIONS}
              value={preferredLocale}
              onChange={(e) => setPreferredLocale(e.target.value as LocaleCode)}
              helperText="You can switch language preferences anytime."
            />

            {serverError && (
              <p role="alert" className="text-xs text-danger bg-danger-soft px-3.5 py-2.5 rounded-lg">
                {serverError}
              </p>
            )}

            <div className="pt-2 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3">
              <Button
                type="button"
                variant="secondary"
                leftIcon={<ArrowLeft className="w-4 h-4" />}
                onClick={goBack}
              >
                Back
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={saving}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Review & Finish
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* ================================================================= */}
      {/* SCREEN 6: COMPLETION                                              */}
      {/* ================================================================= */}
      {step === 6 && (
        <Card padding="lg" className="space-y-6 text-center">
          <div className="w-14 h-14 rounded-full bg-sage-soft text-sage mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7" aria-hidden="true" />
          </div>

          <div className="space-y-2 max-w-md mx-auto">
            <Badge tone="sage">All Set</Badge>
            <h2 className="font-display text-3xl font-semibold text-charcoal">
              You’re ready, {parentName.split(' ')[0] || 'Mama'}!
            </h2>
            <p className="text-sm text-muted leading-relaxed">
              We’ve prepared a calm daily plan for{' '}
              <span className="font-medium text-charcoal">
                {existingChild?.displayName || babyName}
              </span>{' '}
              in the <span className="font-medium text-sage">{matchedBandLabel}</span> stage.
            </p>
          </div>

          <div className="rounded-xl bg-cream/70 border border-border p-4 text-left grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted">Little one</p>
              <p className="text-sm font-medium text-charcoal">
                {existingChild?.displayName || babyName} · {matchedBandLabel}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted">Daily activity window</p>
              <p className="text-sm font-medium text-charcoal">
                {ACTIVITY_TIME_OPTIONS.find((o) => o.value === preferredActivityTime)?.title}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted">Reminders</p>
              <p className="text-sm font-medium text-charcoal">
                {NOTIFICATION_OPTIONS.find((o) => o.value === notificationPreference)?.title}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted">Language</p>
              <p className="text-sm font-medium text-charcoal">
                {LANGUAGE_OPTIONS.find((o) => o.value === preferredLocale)?.label}
              </p>
            </div>
          </div>

          {serverError && (
            <p role="alert" className="text-xs text-danger bg-danger-soft px-3.5 py-2.5 rounded-lg text-left">
              {serverError}
            </p>
          )}

          <div className="pt-2 flex flex-col-reverse sm:flex-row sm:items-center justify-center gap-3">
            <Button
              type="button"
              variant="secondary"
              leftIcon={<ArrowLeft className="w-4 h-4" />}
              onClick={goBack}
            >
              Edit Preferences
            </Button>
            <Button
              type="button"
              variant="primary"
              size="lg"
              loading={saving}
              rightIcon={<ArrowRight className="w-4 h-4" />}
              onClick={() => void handleFinishOnboarding()}
            >
              Go to Today’s Dashboard
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import {
  Baby,
  Bell,
  BookOpen,
  CalendarHeart,
  CheckCircle2,
  Compass,
  HeartHandshake,
  Home,
  LayoutGrid,
  MessageSquareHeart,
  Palette,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Trash2,
  Type,
  User,
} from 'lucide-react';
import {
  ActivityCard,
  AgeGroupSelector,
  Badge,
  Button,
  Card,
  COLOR_TOKENS,
  ConfirmDialog,
  DatePicker,
  EmptyState,
  Input,
  LAYOUT_TOKENS,
  MobileBottomNav,
  Modal,
  Navbar,
  PageHeader,
  ProgressIndicator,
  Select,
  Sidebar,
  SkeletonCard,
  SkeletonText,
  Tabs,
  TYPOGRAPHY_SCALE,
  useToast,
  VideoPlayer,
} from '../design-system';
import { EDITORIAL_IMAGES } from '../shared/domain';

interface DesignSystemShowcasePageProps {
  onOpenPrototype?: () => void;
}

type ShowcaseSection = 'foundations' | 'forms' | 'navigation' | 'feedback' | 'domain';

const SHOWCASE_SIDEBAR_ITEMS = [
  { id: 'foundations', label: 'Colors & Type', icon: <Palette className="w-4 h-4" />, meta: '01' },
  { id: 'forms', label: 'Buttons & Forms', icon: <Type className="w-4 h-4" />, meta: '02' },
  { id: 'navigation', label: 'Navigation & Layout', icon: <LayoutGrid className="w-4 h-4" />, meta: '03' },
  { id: 'feedback', label: 'Overlays & States', icon: <Bell className="w-4 h-4" />, meta: '04' },
  { id: 'domain', label: 'Parenting Modules', icon: <Baby className="w-4 h-4" />, meta: '05' },
];

const MOBILE_PARENT_NAV = [
  { id: 'today', label: 'Today', icon: <Home className="w-5 h-5" /> },
  { id: 'activities', label: 'Explore', icon: <Compass className="w-5 h-5" /> },
  { id: 'feedback', label: 'Coaching', icon: <MessageSquareHeart className="w-5 h-5" /> },
  { id: 'profile', label: 'Family', icon: <User className="w-5 h-5" /> },
];

const DEMO_VIDEO_CHAPTERS = [
  {
    id: 'ch1',
    stepNumber: 1,
    title: 'Prepare three calm everyday items',
    caption: 'Place a wooden spoon, small rounded steel katori, and folded muslin cloth neatly on a woven mat.',
  },
  {
    id: 'ch2',
    stepNumber: 2,
    title: 'Sit warmly at baby’s side',
    caption: 'Keep your hands relaxed in your lap and allow baby to reach and choose freely.',
  },
  {
    id: 'ch3',
    stepNumber: 3,
    title: 'Name each texture softly',
    caption: 'Say “cool steel bowl” or “soft cotton cloth” and pause 5 seconds for baby’s response.',
  },
];

export function DesignSystemShowcasePage({ onOpenPrototype }: DesignSystemShowcasePageProps) {
  const { notify } = useToast();

  // Navigation & Tabs state
  const [activeSection, setActiveSection] = useState<ShowcaseSection>('foundations');
  const [sampleTab, setSampleTab] = useState('today');
  const [mobilePreviewTab, setMobilePreviewTab] = useState('today');

  // Form states demonstrating hover, focus, validation, loading, disabled
  const [babyName, setBabyName] = useState('Aarav');
  const [caregiverEmail, setCaregiverEmail] = useState('meera@littlesteps.in');
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const [selectedDomain, setSelectedDomain] = useState('sensory');
  const [babyDob, setBabyDob] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [selectedAgeSlug, setSelectedAgeSlug] = useState('6-9m');
  const [isSavingForm, setIsSavingForm] = useState(false);

  // Dialog & Skeleton toggles
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmDeleting, setConfirmDeleting] = useState(false);
  const [showLoadingDemo, setShowLoadingDemo] = useState(false);

  const handleSelectSection = (id: string) => {
    setActiveSection(id as ShowcaseSection);
    const el = document.getElementById(`ds-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSampleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!caregiverEmail.includes('@')) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    setEmailError(undefined);
    setIsSavingForm(true);
    window.setTimeout(() => {
      setIsSavingForm(false);
      notify({
        tone: 'success',
        title: 'Family details saved',
        description: `${babyName}’s daily activities are matched to the selected age stage.`,
      });
    }, 650);
  };

  const handleConfirmDelete = () => {
    setConfirmDeleting(true);
    window.setTimeout(() => {
      setConfirmDeleting(false);
      setConfirmOpen(false);
      notify({
        tone: 'info',
        title: 'Practice clip deleted',
        description: 'Your written coaching feedback remains safely preserved.',
      });
    }, 500);
  };

  return (
    <div className="min-h-screen bg-offwhite text-charcoal pb-24 md:pb-12">
      {/* Reusable Component #5: Navigation Bar (3-Zone Contract) */}
      <Navbar
        brandLabel="LittleSteps"
        items={[
          { id: 'foundations', label: 'Foundations' },
          { id: 'forms', label: 'Controls' },
          { id: 'navigation', label: 'Navigation' },
          { id: 'feedback', label: 'States' },
          { id: 'domain', label: 'Modules' },
        ]}
        activeId={activeSection}
        onSelect={handleSelectSection}
        onBrandClick={() => handleSelectSection('foundations')}
        action={
          onOpenPrototype ? (
            <Button variant="subtle" size="sm" onClick={onOpenPrototype}>
              Open App
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={() =>
                notify({
                  tone: 'success',
                  title: 'Design System Ready',
                  description: 'All 20 LittleSteps UI components are interactive on this reference page.',
                })
              }
            >
              Test Toast
            </Button>
          )
        }
      />

      {/* Desktop Max-Width Layout with Reusable Component #6: Sidebar */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <div className="hidden lg:block sticky top-24">
            <Sidebar
              title="Design System"
              subtitle="Step 1 · UI Foundation"
              items={SHOWCASE_SIDEBAR_ITEMS}
              activeId={activeSection}
              onSelect={handleSelectSection}
              footer={
                <div className="space-y-1 text-xs text-muted">
                  <p className="font-medium text-charcoal">WCAG 2.2 AA Ready</p>
                  <p>Min touch target: {LAYOUT_TOKENS.minTouchTarget}</p>
                  <p>Min viewport: {LAYOUT_TOKENS.mobileMinViewport}</p>
                </div>
              }
            />
          </div>

          <main className="flex-1 min-w-0 w-full space-y-12">
            {/* Reusable Component #20: Page Header */}
            <PageHeader
              kicker="Step 1 · LittleSteps Visual Reference & Component Library"
              title="Warm, calm UI foundation for mothers and caregivers"
              description="Built for everyday ease on 320px smartphones and wide desktop screens alike—pairing soft sage green, warm cream, muted peach, and soft lavender with accessible WCAG 2.2 AA contrast."
              action={
                <Button
                  variant="primary"
                  onClick={() =>
                    notify({
                      tone: 'success',
                      title: 'Welcome to LittleSteps',
                      description: 'All 20 reusable components are live and interactive below.',
                    })
                  }
                >
                  Trigger Notification
                </Button>
              }
            />

            {/* ================================================================ */}
            {/* SECTION 01: COLOR PALETTE & TYPOGRAPHY                           */}
            {/* ================================================================ */}
            <section id="ds-foundations" className="scroll-mt-24 space-y-8">
              <div className="space-y-1">
                <p className="font-mono text-xs text-sage tabular-nums">01 · Foundations</p>
                <h2 className="font-display text-2xl font-semibold text-charcoal">
                  Color Palette Tokens
                </h2>
                <p className="text-sm text-muted max-w-2xl">
                  Restrained, natural tones designed to feel welcoming and composed without heavy shadows, gradients, or clinical sterility.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {COLOR_TOKENS.map((token) => (
                  <Card key={token.name} padding="sm" className="space-y-3">
                    <div
                      className={`h-16 w-full rounded-lg border border-border ${token.swatchClass}`}
                    />
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-charcoal">{token.name}</p>
                        <span className="font-mono text-xs text-muted tabular-nums">
                          {token.hex}
                        </span>
                      </div>
                      <p className="text-xs text-sage font-medium">{token.role}</p>
                      <p className="text-xs text-muted">{token.contrastNote}</p>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Typography Hierarchy */}
              <div className="space-y-4">
                <div>
                  <h3 className="font-display text-xl font-semibold text-charcoal">
                    Typography Scale
                  </h3>
                  <p className="text-sm text-muted">
                    Nunito for warm, friendly headings paired with Plus Jakarta Sans for clean body legibility and IBM Plex Mono for tabular numbers.
                  </p>
                </div>

                <Card padding="none" className="divide-y divide-border overflow-hidden">
                  {TYPOGRAPHY_SCALE.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-12 gap-3 items-baseline"
                    >
                      <div className="sm:col-span-4 space-y-0.5">
                        <p className="text-xs font-semibold text-charcoal">{item.name}</p>
                        <p className="font-mono text-[11px] text-muted tabular-nums">
                          {item.font} · {item.size}
                        </p>
                      </div>
                      <div className="sm:col-span-8">
                        <p className={item.className}>{item.sample}</p>
                      </div>
                    </div>
                  ))}
                </Card>
              </div>
            </section>

            {/* ================================================================ */}
            {/* SECTION 02: BUTTONS, INPUTS, DROPDOWNS & DATE PICKER             */}
            {/* ================================================================ */}
            <section id="ds-forms" className="scroll-mt-24 space-y-8 border-t border-border pt-10">
              <div className="space-y-1">
                <p className="font-mono text-xs text-sage tabular-nums">02 · Controls & Forms</p>
                <h2 className="font-display text-2xl font-semibold text-charcoal">
                  Buttons, Inputs, Dropdowns & Date Picker
                </h2>
                <p className="text-sm text-muted max-w-2xl">
                  Every interactive control provides a comfortable 44px minimum touch target, visible keyboard focus ring, and clear error/loading states for effortless one-handed mobile use.
                </p>
              </div>

              {/* Component #1: Buttons */}
              <Card className="space-y-5">
                <h3 className="font-display text-lg font-semibold text-charcoal">
                  1. Primary, Secondary, Subtle & Danger Buttons
                </h3>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="primary"
                    onClick={() =>
                      notify({
                        tone: 'success',
                        title: 'Primary action clicked',
                        description: 'Soft sage green with 5.7:1 white text contrast.',
                      })
                    }
                  >
                    Start Today’s Activity
                  </Button>
                  <Button variant="secondary">Save for Later</Button>
                  <Button variant="subtle" leftIcon={<BookOpen className="w-4 h-4" />}>
                    Read Guide
                  </Button>
                  <Button
                    variant="danger"
                    leftIcon={<Trash2 className="w-4 h-4" />}
                    onClick={() => setConfirmOpen(true)}
                  >
                    Delete Video
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-border">
                  <Button variant="primary" size="sm">
                    Compact Action
                  </Button>
                  <Button variant="primary" loading>
                    Saving Progress
                  </Button>
                  <Button variant="secondary" disabled>
                    Disabled State
                  </Button>
                </div>
              </Card>

              {/* Components #2, #3, #4: Input, Dropdown, DatePicker */}
              <Card>
                <form onSubmit={handleSampleFormSubmit} className="space-y-5">
                  <div className="space-y-1">
                    <h3 className="font-display text-lg font-semibold text-charcoal">
                      2–4. One-Handed Form Controls
                    </h3>
                    <p className="text-xs text-muted">
                      Try clearing the `@` from the email field and submitting to verify accessible inline validation.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Baby’s name or nickname"
                      required
                      value={babyName}
                      onChange={(e) => setBabyName(e.target.value)}
                      placeholder="e.g., Aarav"
                      helperText="Used gently across your daily activity cards."
                    />

                    <Input
                      label="Caregiver email"
                      type="text"
                      required
                      value={caregiverEmail}
                      onChange={(e) => {
                        setCaregiverEmail(e.target.value);
                        if (emailError) setEmailError(undefined);
                      }}
                      error={emailError}
                      helperText="We never share your email with reviewers."
                    />

                    <Select
                      label="Preferred daily focus domain"
                      value={selectedDomain}
                      onChange={(e) => setSelectedDomain(e.target.value)}
                      options={[
                        { value: 'cognitive', label: 'Cognitive development' },
                        { value: 'language', label: 'Language and communication' },
                        { value: 'physical', label: 'Physical development' },
                        { value: 'social-emotional', label: 'Social and emotional development' },
                        { value: 'sensory', label: 'Sensory development' },
                        { value: 'early-independence', label: 'Early independence and everyday skills' },
                      ]}
                      helperText="Rotates calmly across all six domains each week."
                    />

                    <DatePicker
                      label="Baby’s date of birth"
                      required
                      value={babyDob}
                      max={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setBabyDob(e.target.value)}
                      showBabyAgePreview
                      helperText="Automatically matches daily plans to the right 3-month band."
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
                    <Input
                      label="Disabled field example"
                      value="India (English · i18n Ready)"
                      disabled
                      onChange={() => {}}
                    />
                    <div className="flex items-end justify-start sm:justify-end">
                      <Button type="submit" variant="primary" loading={isSavingForm}>
                        Save Family Preferences
                      </Button>
                    </div>
                  </div>
                </form>
              </Card>
            </section>

            {/* ================================================================ */}
            {/* SECTION 03: NAVIGATION, TABS, CARDS, BADGES & PROGRESS           */}
            {/* ================================================================ */}
            <section
              id="ds-navigation"
              className="scroll-mt-24 space-y-8 border-t border-border pt-10"
            >
              <div className="space-y-1">
                <p className="font-mono text-xs text-sage tabular-nums">
                  03 · Navigation, Cards, Badges & Progress
                </p>
                <h2 className="font-display text-2xl font-semibold text-charcoal">
                  Hierarchy, Status & Mobile Thumb Navigation
                </h2>
              </div>

              {/* Components #8, #9, #10, #11: Tabs, Badges, Cards, Progress */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Card className="space-y-5">
                  <div className="space-y-2">
                    <h3 className="font-display text-lg font-semibold text-charcoal">
                      10–11. Tabs & Restrained Badges
                    </h3>
                    <Tabs
                      ariaLabel="Sample journey tabs"
                      activeTabId={sampleTab}
                      onChange={setSampleTab}
                      tabs={[
                        { id: 'today', label: 'Today', count: 3 },
                        { id: 'reviewed', label: 'Reviewed', count: 2 },
                        { id: 'saved', label: 'Saved' },
                      ]}
                    />
                    <p className="text-xs text-muted pt-1">
                      Active tab: <span className="font-medium text-charcoal">{sampleTab}</span>{' '}
                      (supports Left/Right keyboard arrows).
                    </p>
                  </div>

                  <div className="space-y-2 pt-3 border-t border-border">
                    <p className="text-xs font-medium text-muted">Status & Domain Badges</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="sage" icon={<CheckCircle2 className="w-3.5 h-3.5" />}>
                        Completed
                      </Badge>
                      <Badge tone="peach" icon={<CalendarHeart className="w-3.5 h-3.5" />}>
                        Awaiting Review
                      </Badge>
                      <Badge tone="lavender" icon={<Sparkles className="w-3.5 h-3.5" />}>
                        Sensory Play
                      </Badge>
                      <Badge tone="neutral">6–9 months</Badge>
                      <Badge tone="warning">Expires in 3d</Badge>
                      <Badge tone="danger">Action Needed</Badge>
                    </div>
                  </div>
                </Card>

                <Card className="space-y-5">
                  <h3 className="font-display text-lg font-semibold text-charcoal">
                    9. Progress Indicators (Linear & Ring)
                  </h3>
                  <ProgressIndicator
                    value={2}
                    max={3}
                    label="Today’s Gentle Rhythm"
                    sublabel="2 of 3 moments shared"
                    tone="sage"
                  />
                  <ProgressIndicator
                    value={88}
                    max={100}
                    label="Caregiver Instruction-Match"
                    sublabel="88%"
                    tone="peach"
                    size="sm"
                  />
                  <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-border">
                    <ProgressIndicator
                      variant="ring"
                      value={88}
                      label="Instruction Match"
                      sublabel="Caregiver steps only"
                      tone="sage"
                    />
                    <ProgressIndicator
                      variant="ring"
                      value={67}
                      size="sm"
                      label="Weekly Balance"
                      sublabel="4 of 6 domains"
                      tone="lavender"
                    />
                  </div>
                </Card>
              </div>

              {/* Card Surface Tones + Inline Mobile Bottom Nav Preview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Card tone="cream" className="space-y-2">
                  <p className="text-xs font-medium text-sage">Card Tone · Warm Cream</p>
                  <h3 className="font-display text-lg font-semibold text-charcoal">
                    Non-Diagnostic Caregiver Promise
                  </h3>
                  <p className="text-sm text-muted leading-relaxed">
                    Instruction-match feedback celebrates how calmly and clearly the caregiver demonstrated activity steps—never grading a baby’s intelligence or health.
                  </p>
                </Card>

                <Card className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-muted">
                      Component #7 · Mobile Bottom Navigation Preview
                    </p>
                    <p className="text-xs text-muted mt-0.5">
                      Anchored automatically at the bottom on screens under 768px (also live on mobile right now).
                    </p>
                  </div>
                  <MobileBottomNav
                    fixed={false}
                    items={MOBILE_PARENT_NAV}
                    activeId={mobilePreviewTab}
                    onSelect={setMobilePreviewTab}
                  />
                </Card>
              </div>
            </section>

            {/* ================================================================ */}
            {/* SECTION 04: MODALS, CONFIRMATION, TOASTS, EMPTY & SKELETONS      */}
            {/* ================================================================ */}
            <section
              id="ds-feedback"
              className="scroll-mt-24 space-y-8 border-t border-border pt-10"
            >
              <div className="space-y-1">
                <p className="font-mono text-xs text-sage tabular-nums">
                  04 · Overlays & Asynchronous States
                </p>
                <h2 className="font-display text-2xl font-semibold text-charcoal">
                  Modals, Confirmations, Toasts, Empty States & Skeletons
                </h2>
              </div>

              {/* Components #12, #13, #16: Dialogs & Toasts */}
              <Card className="space-y-4">
                <h3 className="font-display text-lg font-semibold text-charcoal">
                  12, 13 & 16. Interactive Overlays & Notifications
                </h3>
                <div className="flex flex-wrap gap-3">
                  <Button variant="primary" onClick={() => setModalOpen(true)}>
                    Open Modal Dialog
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
                    Open Confirmation Dialog
                  </Button>
                  <Button
                    variant="subtle"
                    onClick={() =>
                      notify({
                        tone: 'success',
                        title: 'Activity completed',
                        description: 'Logged gently to Aarav’s journal.',
                      })
                    }
                  >
                    Success Toast
                  </Button>
                  <Button
                    variant="subtle"
                    onClick={() =>
                      notify({
                        tone: 'warning',
                        title: 'Clip nearing 30-day retention',
                        description: 'This private video will auto-delete in 2 days.',
                      })
                    }
                  >
                    Warning Toast
                  </Button>
                </div>
              </Card>

              {/* Components #14 & #15: Empty State & Loading Skeletons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
                <EmptyState
                  icon={<HeartHandshake className="w-6 h-6" />}
                  title="No practice clips shared yet"
                  description="Whenever you would like warm coaching on an activity’s steps, upload a short private clip. Clips auto-delete in 30 days."
                  actionLabel="Record First Clip"
                  onAction={() => setModalOpen(true)}
                />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-charcoal">15. Loading Skeletons</p>
                    <Button
                      variant="subtle"
                      size="sm"
                      onClick={() => setShowLoadingDemo((v) => !v)}
                    >
                      {showLoadingDemo ? 'Show Card Skeleton' : 'Show Text Skeleton'}
                    </Button>
                  </div>
                  {showLoadingDemo ? (
                    <Card>
                      <SkeletonText lines={4} />
                    </Card>
                  ) : (
                    <SkeletonCard />
                  )}
                </div>
              </div>
            </section>

            {/* ================================================================ */}
            {/* SECTION 05: LITTLESTEPS DOMAIN MODULES                           */}
            {/* ================================================================ */}
            <section id="ds-domain" className="scroll-mt-24 space-y-8 border-t border-border pt-10">
              <div className="space-y-1">
                <p className="font-mono text-xs text-sage tabular-nums">
                  05 · LittleSteps Domain Components
                </p>
                <h2 className="font-display text-2xl font-semibold text-charcoal">
                  Age-Group Selector, Video Player & Activity Cards
                </h2>
              </div>

              {/* Component #19: Age-Group Selector */}
              <Card>
                <AgeGroupSelector
                  selectedSlug={selectedAgeSlug}
                  onSelect={setSelectedAgeSlug}
                  label="19. Age-Group Selector (8 Stages · 0–24 Months)"
                  helperText="Select any three-month band to preview how daily activities adapt cleanly without overwhelming caregivers."
                />
              </Card>

              {/* Component #17: Video Player */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <PlayCircle className="w-4 h-4 text-sage" aria-hidden="true" />
                  <h3 className="font-display text-lg font-semibold text-charcoal">
                    17. Reusable Video Player (Guided Demonstration & Private Stream Footer)
                  </h3>
                </div>
                <VideoPlayer
                  title="Household Texture Basket"
                  posterUrl={EDITORIAL_IMAGES.sensoryLinen}
                  chapters={DEMO_VIDEO_CHAPTERS}
                  privacyNote="Private signed playback · Non-downloadable"
                  retentionLabel="30-day auto-deletion policy"
                />
              </div>

              {/* Component #18: Activity Cards */}
              <div className="space-y-3">
                <h3 className="font-display text-lg font-semibold text-charcoal">
                  18. Activity Cards ({selectedAgeSlug} Stage Preview)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <ActivityCard
                    title="Household Texture Basket"
                    summary="Introduce everyday Indian home textures—smooth wood, cool steel katori, and soft muslin—one item at a time."
                    domainName="Sensory development"
                    ageGroupLabel="6–9 months"
                    durationMinutes={6}
                    materials={['Woven cotton mat', 'Neem wooden spoon', 'Rounded steel katori']}
                    posterUrl={EDITORIAL_IMAGES.sensoryLinen}
                    statusText="Reviewed · 88% Match"
                    statusTone="sage"
                    completed
                    onAction={() => setModalOpen(true)}
                  />
                  <ActivityCard
                    title="Two-Handed Open Cup Sip Practice"
                    summary="Practice a tiny, joyful sip of water from a small open steel cup with calm hand-over-hand guidance."
                    domainName="Early independence"
                    ageGroupLabel="6–9 months"
                    durationMinutes={5}
                    materials={['Small open steel cup', 'Soft linen napkin']}
                    posterUrl={EDITORIAL_IMAGES.everydayCup}
                    statusText="Ready Today"
                    statusTone="peach"
                    onAction={() => setModalOpen(true)}
                  />
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>

      {/* Live Mobile Bottom Navigation (visible below md breakpoint, 320px+) */}
      <MobileBottomNav
        fixed
        items={[
          { id: 'foundations', label: 'Tokens', icon: <Palette className="w-5 h-5" /> },
          { id: 'forms', label: 'Forms', icon: <Type className="w-5 h-5" /> },
          { id: 'feedback', label: 'States', icon: <Bell className="w-5 h-5" /> },
          { id: 'domain', label: 'Modules', icon: <Baby className="w-5 h-5" /> },
        ]}
        activeId={activeSection === 'navigation' ? 'forms' : activeSection}
        onSelect={handleSelectSection}
      />

      {/* Component #12: Sample Modal Dialog */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Calm Activity Preparation"
        description="A quick checklist before starting floor play with your baby."
        footer={
          <>
            <Button variant="subtle" onClick={() => setModalOpen(false)}>
              Close
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setModalOpen(false);
                notify({
                  tone: 'success',
                  title: 'Ready for floor time',
                  description: 'Take it at baby’s natural pace—5 peaceful minutes is plenty.',
                });
              }}
            >
              Begin Calmly
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-muted leading-relaxed">
          <p>
            Spread a clean cotton dhurrie in natural window light and set out two or three familiar items within comfortable reach.
          </p>
          <Card tone="lavender" padding="sm" className="flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-lavender-ink shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-xs text-charcoal">
              If you record a short clip for coaching, it stays strictly private and automatically deletes after 30 days.
            </p>
          </Card>
        </div>
      </Modal>

      {/* Component #13: Sample Confirmation Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Practice Video Now?"
        message="This immediately removes the video file from LittleSteps’ private vault. Your reviewer’s written coaching notes and caregiver instruction-match score will stay saved."
        confirmLabel="Delete Video"
        cancelLabel="Keep Video"
        destructive
        loading={confirmDeleting}
      />
    </div>
  );
}

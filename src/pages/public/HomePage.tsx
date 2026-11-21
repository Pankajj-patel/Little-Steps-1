import React, { useState } from 'react';
import {
  ArrowRight,
  Baby,
  Brain,
  CalendarCheck2,
  Check,
  CheckCircle2,
  Compass,
  HandHeart,
  Heart,
  Lock,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Sprout,
} from 'lucide-react';
import { EditorialImage } from '../../components/EditorialImage';
import {
  ActivityCard,
  AgeGroupSelector,
  Badge,
  Button,
  Card,
  ProgressIndicator,
  VideoPlayer,
} from '../../design-system';
import type { PublicRoute } from '../../lib/router';
import { CANONICAL_LEARNING_DOMAINS, EDITORIAL_IMAGES } from '../../shared/domain';

interface HomePageProps {
  onNavigate: (route: PublicRoute) => void;
}

const DOMAIN_VISUALS: Record<
  string,
  { icon: React.ReactNode; surfaceClass: string; iconColorClass: string }
> = {
  cognitive: {
    icon: <Brain className="w-5 h-5" />,
    surfaceClass: 'bg-lavender-soft',
    iconColorClass: 'text-lavender-ink',
  },
  language: {
    icon: <MessageCircle className="w-5 h-5" />,
    surfaceClass: 'bg-peach-soft',
    iconColorClass: 'text-peach-ink',
  },
  physical: {
    icon: <Compass className="w-5 h-5" />,
    surfaceClass: 'bg-sage-soft',
    iconColorClass: 'text-sage',
  },
  'social-emotional': {
    icon: <Heart className="w-5 h-5" />,
    surfaceClass: 'bg-peach-soft',
    iconColorClass: 'text-peach-ink',
  },
  sensory: {
    icon: <Sparkles className="w-5 h-5" />,
    surfaceClass: 'bg-lavender-soft',
    iconColorClass: 'text-lavender-ink',
  },
  'early-independence': {
    icon: <Sprout className="w-5 h-5" />,
    surfaceClass: 'bg-sage-soft',
    iconColorClass: 'text-sage',
  },
};

const AGE_STAGE_PREVIEWS: Record<
  string,
  { focus: string; sampleTitle: string; everydayItems: string }
> = {
  '0-3m': {
    focus: 'Calm face-to-face connection, gentle voice pauses, and slow visual tracking during alert windows.',
    sampleTitle: 'Unhurried Face-to-Face Greeting',
    everydayItems: 'Soft cotton dhurrie, natural window light',
  },
  '3-6m': {
    focus: 'Comfortable floor tummy time with a safe low mirror and warm back-and-forth cooing turns.',
    sampleTitle: 'Supported Mirror Tummy Time',
    everydayItems: 'Firm floor mat, baby-safe low mirror, rolled cotton towel',
  },
  '6-9m': {
    focus: 'Exploring safe home textures, simple peek-a-boo permanence, reaching, and early open-cup sips.',
    sampleTitle: 'Household Texture Basket',
    everydayItems: 'Neem wooden spoon, rounded steel katori, folded muslin cloth',
  },
  '9-12m': {
    focus: 'In-and-out container play, reassuring goodbye-and-return routines, and pointing communication.',
    sampleTitle: 'In-and-Out Steel Katori Drop',
    everydayItems: 'Wide rounded steel katori, knitted cotton balls',
  },
  '12-15m': {
    focus: 'Purposeful hand coordination, real two-option naming choices, and joining everyday tidying.',
    sampleTitle: 'Wooden Ring Stack & Linen Fold',
    everydayItems: 'Wooden ring stacker, small folded linen cloth',
  },
  '15-18m': {
    focus: 'Capable participation in daily care—wiping tiny spills, pouring practice, and naming routines.',
    sampleTitle: 'Cloth Wiping a Tiny Water Spill',
    everydayItems: 'Small cotton cloth, low tray, a few drops of water',
  },
  '18-21m': {
    focus: 'Matching familiar home objects, calm two-step routines, and expanding everyday vocabulary.',
    sampleTitle: 'Two-Basket Natural Matching',
    everydayItems: 'Two wide bowls, wooden spoons, folded cotton cloths',
  },
  '21-24m': {
    focus: 'Naming everyday feelings, gentle self-dressing steps, and calm breathing transitions together.',
    sampleTitle: 'Calm Naming of Everyday Feelings',
    everydayItems: 'Low floor mirror, woven cotton mat',
  },
};

const DEMO_CHAPTERS = [
  {
    id: 'step-1',
    stepNumber: 1,
    title: 'Offer just three everyday items',
    caption:
      'Place a smooth wooden spoon, small rounded steel katori, and folded muslin cloth neatly on a woven mat—avoid visual clutter.',
  },
  {
    id: 'step-2',
    stepNumber: 2,
    title: 'Sit calmly beside your baby',
    caption:
      'Rest your hands quietly in your lap so your baby feels free to reach, grasp, and choose at their own pace.',
  },
  {
    id: 'step-3',
    stepNumber: 3,
    title: 'Name each texture softly',
    caption:
      'When baby touches an object, narrate gently—“Cool steel bowl” or “Soft cotton cloth”—and leave space for pauses.',
  },
  {
    id: 'step-4',
    stepNumber: 4,
    title: 'Allow unhurried exploration',
    caption:
      'Stay within arm’s reach for safety and close gently whenever your baby’s curiosity naturally winds down.',
  },
];

export function HomePage({ onNavigate }: HomePageProps) {
  const [selectedStageSlug, setSelectedStageSlug] = useState('6-9m');
  const stagePreview = AGE_STAGE_PREVIEWS[selectedStageSlug] ?? AGE_STAGE_PREVIEWS['6-9m'];

  return (
    <div className="space-y-20 sm:space-y-24 pb-8">
      {/* ================================================================= */}
      {/* 1. HERO SECTION                                                   */}
      {/* ================================================================= */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14 lg:pt-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
            <p className="text-xs font-medium text-muted">
              Birth to 24 months <span aria-hidden="true">·</span> Daily guided play at home
            </p>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-[54px] font-bold text-charcoal leading-[1.1] tracking-tight">
              Little moments. Big milestones.
            </h1>

            <p className="text-base sm:text-lg text-muted leading-relaxed max-w-lg">
              LittleSteps guides mothers and caregivers with calm, age-appropriate daily activities—using simple everyday items at home so you always feel supported, never overwhelmed.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                variant="primary"
                size="lg"
                rightIcon={<ArrowRight className="w-4 h-4" />}
                onClick={() => onNavigate('/register')}
              >
                Start Your Journey
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => onNavigate('/how-it-works')}
              >
                Explore How It Works
              </Button>
            </div>

            <p className="text-xs text-muted pt-1">
              Designed for Indian homes <span aria-hidden="true">·</span> Two to three short activities a day <span aria-hidden="true">·</span> Private caregiver coaching
            </p>
          </div>

          <div className="lg:col-span-6 flex">
            <div className="w-full rounded-2xl border border-border bg-surface overflow-hidden flex flex-col">
              <div className="flex-1 min-h-[280px] sm:min-h-[360px] lg:min-h-0">
                <EditorialImage
                  src={EDITORIAL_IMAGES.heroMontessori}
                  alt="Mother smiling calmly beside her baby playing with wooden rings on a sunlit woven cotton floor mat"
                  aspectClassName="w-full h-full"
                  priority
                />
              </div>
              <div className="px-5 py-3.5 border-t border-border bg-cream/60 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                <span>Unhurried floor play with familiar home objects</span>
                <span className="font-mono tabular-nums text-charcoal">0–24 months</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* 2. HOW IT WORKS (THREE SIMPLE STEPS)                              */}
      {/* ================================================================= */}
      <section className="border-y border-border bg-surface py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="max-w-2xl space-y-2">
            <p className="font-mono text-xs text-sage tabular-nums">How It Works</p>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-charcoal">
              Three calm steps woven into your daily routine
            </h2>
            <p className="text-sm sm:text-base text-muted leading-relaxed">
              No long parenting textbooks or complicated schedules—just clear, gentle guidance ready when you and your baby have a quiet moment.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-sage-soft text-sage flex items-center justify-center">
                  <Baby className="w-5 h-5" aria-hidden="true" />
                </div>
                <span className="font-mono text-xs text-muted tabular-nums">01</span>
              </div>
              <div className="space-y-1.5">
                <h3 className="font-display text-xl font-semibold text-charcoal">
                  Choose your baby’s age
                </h3>
                <p className="text-sm text-muted leading-relaxed">
                  Enter your baby’s date of birth once. LittleSteps places your family in the right three-month stage from 0 to 24 months automatically.
                </p>
              </div>
            </Card>

            <Card className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-peach-soft text-peach-ink flex items-center justify-center">
                  <CalendarCheck2 className="w-5 h-5" aria-hidden="true" />
                </div>
                <span className="font-mono text-xs text-muted tabular-nums">02</span>
              </div>
              <div className="space-y-1.5">
                <h3 className="font-display text-xl font-semibold text-charcoal">
                  Follow daily activities
                </h3>
                <p className="text-sm text-muted leading-relaxed">
                  Receive two to three short, step-by-step activities each day with visual previews, household items, and clear safety notes.
                </p>
              </div>
            </Card>

            <Card className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-lavender-soft text-lavender-ink flex items-center justify-center">
                  <HandHeart className="w-5 h-5" aria-hidden="true" />
                </div>
                <span className="font-mono text-xs text-muted tabular-nums">03</span>
              </div>
              <div className="space-y-1.5">
                <h3 className="font-display text-xl font-semibold text-charcoal">
                  Learn, practice, and track your journey
                </h3>
                <p className="text-sm text-muted leading-relaxed">
                  Mark completed moments at your own pace, and optionally share a short private clip for warm caregiver instruction-match feedback.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* 3. DEVELOPMENT AREAS (SIX DOMAIN CARDS)                           */}
      {/* ================================================================= */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="max-w-2xl space-y-2">
          <p className="font-mono text-xs text-sage tabular-nums">Six Development Areas</p>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-charcoal">
            Balanced everyday support across every area of early growth
          </h2>
          <p className="text-sm sm:text-base text-muted leading-relaxed">
            Daily plans gently rotate across six foundational domains so play feels varied, natural, and unhurried.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {CANONICAL_LEARNING_DOMAINS.map((domain, idx) => {
            const visual = DOMAIN_VISUALS[domain.slug] ?? DOMAIN_VISUALS.cognitive;
            return (
              <Card key={domain.slug} className="space-y-3.5 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div
                      aria-hidden="true"
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${visual.surfaceClass} ${visual.iconColorClass}`}
                    >
                      {visual.icon}
                    </div>
                    <span className="font-mono text-xs text-muted tabular-nums">
                      0{idx + 1}
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-semibold text-charcoal">
                    {domain.name}
                  </h3>
                  <p className="text-sm text-muted leading-relaxed">{domain.description}</p>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ================================================================= */}
      {/* 4. PERSONALIZED LEARNING JOURNEY (BY BABY'S AGE)                  */}
      {/* ================================================================= */}
      <section className="border-y border-border bg-cream/60 py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-5 space-y-4">
            <p className="font-mono text-xs text-sage tabular-nums">Personalized By Age</p>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-charcoal">
              Eight gentle stages from newborn to two years
            </h2>
            <p className="text-sm sm:text-base text-muted leading-relaxed">
              A two-month-old and a fifteen-month-old explore the world in completely different ways. LittleSteps selects daily activities based on your baby’s exact three-month band and transitions smoothly as they grow.
            </p>
            <div className="pt-2">
              <Button variant="subtle" onClick={() => onNavigate('/our-approach')}>
                Read About Our Approach
              </Button>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-5">
            <Card className="space-y-5">
              <AgeGroupSelector
                selectedSlug={selectedStageSlug}
                onSelect={setSelectedStageSlug}
                label="Preview any 3-month age band"
                helperText="Select a stage below to see how daily activities adapt to your baby’s age."
              />

              <div className="rounded-xl border border-border bg-offwhite p-5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-sage">
                    Stage Focus · {selectedStageSlug}
                  </p>
                  <Badge tone="lavender">Sample Daily Activity</Badge>
                </div>
                <p className="font-display text-lg font-semibold text-charcoal">
                  {stagePreview.sampleTitle}
                </p>
                <p className="text-sm text-muted leading-relaxed">{stagePreview.focus}</p>
                <p className="text-xs text-muted pt-1">
                  Everyday home items:{' '}
                  <span className="text-charcoal font-medium">{stagePreview.everydayItems}</span>
                </p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* 5. ACTIVITY DEMONSTRATION                                         */}
      {/* ================================================================= */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="max-w-2xl space-y-2">
          <p className="font-mono text-xs text-sage tabular-nums">Inside a Daily Activity</p>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-charcoal">
            Clear visual guidance you can follow in five peaceful minutes
          </h2>
          <p className="text-sm sm:text-base text-muted leading-relaxed">
            Every activity includes a calm step-paced preview, everyday items you already own, a safety reminder, and numbered plain-language instructions.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 space-y-5">
            <VideoPlayer
              title="Household Texture Basket"
              posterUrl={EDITORIAL_IMAGES.sensoryLinen}
              chapters={DEMO_CHAPTERS}
              privacyNote="Step-paced caregiver preview · Press Play to preview calm pacing"
              retentionLabel="6 min · 6–9 months"
            />

            <Card tone="cream" padding="sm" className="space-y-3">
              <p className="text-xs font-semibold text-charcoal">Numbered Caregiver Steps</p>
              <ol className="space-y-2 text-sm text-muted">
                {DEMO_CHAPTERS.map((step) => (
                  <li key={step.id} className="flex items-start gap-2.5">
                    <span className="font-mono text-xs text-sage mt-0.5 tabular-nums">
                      0{step.stepNumber}
                    </span>
                    <span>
                      <strong className="text-charcoal font-medium">{step.title}:</strong>{' '}
                      {step.caption}
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          </div>

          <div className="lg:col-span-5 space-y-5">
            <ActivityCard
              title="Household Texture Basket"
              summary="Introduce everyday Indian home textures—smooth neem wood, cool steel katori, and soft unbleached muslin—one item at a time."
              domainName="Sensory development"
              ageGroupLabel="6–9 months"
              durationMinutes={6}
              materials={[
                'Woven cotton mat',
                'Smooth neem wooden spoon',
                'Small rounded steel katori',
              ]}
              posterUrl={EDITORIAL_IMAGES.sensoryLinen}
              statusText="Ready Today"
              statusTone="peach"
              actionLabel="Try in LittleSteps"
              onAction={() => onNavigate('/register')}
            />
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* 6. PROGRESS AND ACHIEVEMENTS                                      */}
      {/* ================================================================= */}
      <section className="border-y border-border bg-surface py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-6 space-y-5">
            <p className="font-mono text-xs text-sage tabular-nums">Calm Progress Tracking</p>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-charcoal">
              Notice your shared rhythm without pressure or checklists
            </h2>
            <p className="text-sm sm:text-base text-muted leading-relaxed">
              Mark activities complete, jot down a brief reflection, and see how your everyday moments gently span all six development domains over time.
            </p>
            <ul className="space-y-3 text-sm text-charcoal">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-sage shrink-0 mt-1" aria-hidden="true" />
                <span>
                  <strong className="font-medium">Simple daily completion log:</strong> Keep track of activities you have tried together across each stage.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-sage shrink-0 mt-1" aria-hidden="true" />
                <span>
                  <strong className="font-medium">Balanced domain overview:</strong> See which areas you have practiced recently without comparative rankings or grades on your baby.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-sage shrink-0 mt-1" aria-hidden="true" />
                <span>
                  <strong className="font-medium">Optional caregiver coaching:</strong> Upload a short clip when you want step-by-step instruction-match feedback on how you demonstrated the activity.
                </span>
              </li>
            </ul>
          </div>

          <div className="lg:col-span-6">
            <Card className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                <div>
                  <p className="text-xs text-muted">Example Parent Journal View</p>
                  <p className="font-display text-lg font-semibold text-charcoal">
                    This Week’s Gentle Balance
                  </p>
                </div>
                <Badge tone="sage">No baby grades</Badge>
              </div>

              <div className="space-y-4">
                <ProgressIndicator
                  value={2}
                  max={3}
                  label="Today’s Daily Plan"
                  sublabel="2 of 3 activities completed"
                  tone="sage"
                />
                <ProgressIndicator
                  value={5}
                  max={6}
                  label="Domains Practiced This Week"
                  sublabel="5 of 6 domains"
                  tone="lavender"
                  size="sm"
                />
              </div>

              <div className="pt-4 border-t border-border flex flex-wrap items-center justify-between gap-4">
                <ProgressIndicator
                  variant="ring"
                  value={88}
                  label="Caregiver Instruction-Match"
                  sublabel="Evaluates caregiver steps only"
                  tone="sage"
                />
                <p className="text-xs text-muted max-w-[210px] leading-relaxed">
                  Written strengths and one calm next-time tip stay saved even after you delete your practice video.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* 7. SAFETY AND TRUST (HONEST, NON-DIAGNOSTIC, NO FAKE CLAIMS)      */}
      {/* ================================================================= */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-5 rounded-2xl border border-border overflow-hidden bg-surface min-h-[260px]">
            <EditorialImage
              src={EDITORIAL_IMAGES.tummyMirror}
              alt="Safe low wooden Montessori floor mirror beside a folded cotton play mat in natural daylight"
              aspectClassName="w-full h-full"
            />
          </div>

          <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
            <div className="space-y-2.5">
              <p className="font-mono text-xs text-sage tabular-nums">Safety & Trust</p>
              <h2 className="font-display text-3xl sm:text-4xl font-semibold text-charcoal">
                Thoughtful safety guidance and strict respect for your family’s privacy
              </h2>
              <p className="text-sm sm:text-base text-muted leading-relaxed">
                Every activity is written with age appropriateness, everyday household safety reminders, and parental supervision at the center. LittleSteps is an educational parenting companion—it does not diagnose or evaluate your baby’s health, intelligence, or developmental status.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card tone="cream" padding="sm" className="space-y-2">
                <div className="flex items-center gap-2 text-sage">
                  <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <h3 className="font-display text-base font-semibold text-charcoal">
                    Age-Appropriate Safety Notes
                  </h3>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  Every guide highlights safe positioning, choking-size precautions, and when to pause if your baby seems tired. Always consult your pediatrician for medical or developmental questions.
                </p>
              </Card>

              <Card tone="lavender" padding="sm" className="space-y-2">
                <div className="flex items-center gap-2 text-lavender-ink">
                  <Lock className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <h3 className="font-display text-base font-semibold text-charcoal">
                    Private 30-Day Video Vault
                  </h3>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  Uploaded activity clips are never public. They stream via short-lived signed access for your assigned reviewer (without your contact info), auto-delete after 30 days, and can be deleted anytime.
                </p>
              </Card>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-sage" aria-hidden="true" />
                Caregiver-only instruction feedback
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-sage" aria-hidden="true" />
                No public sharing of children’s videos
              </span>
              <button
                type="button"
                onClick={() => onNavigate('/privacy')}
                className="text-sage font-medium hover:underline cursor-pointer"
              >
                Read Privacy Policy
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* 8. FINAL CTA                                                      */}
      {/* ================================================================= */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <Card tone="sage" padding="lg" className="text-center space-y-5">
          <div className="space-y-2.5 max-w-xl mx-auto">
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-charcoal">
              Begin with one calm moment today
            </h2>
            <p className="text-sm sm:text-base text-muted leading-relaxed">
              Create your family profile in less than a minute and receive gentle, age-appropriate activities matched to your baby’s stage.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <Button
              variant="primary"
              size="lg"
              rightIcon={<ArrowRight className="w-4 h-4" />}
              onClick={() => onNavigate('/register')}
            >
              Start Your Journey
            </Button>
            <Button
              variant="subtle"
              size="lg"
              onClick={() => onNavigate('/login')}
            >
              Sign In to Existing Account
            </Button>
          </div>
        </Card>
      </section>
    </div>
  );
}

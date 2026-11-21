import React from 'react';
import {
  ArrowRight,
  Baby,
  CheckCircle2,
  ClipboardCheck,
  Heart,
  Lock,
  ShieldCheck,
  Video,
} from 'lucide-react';
import { EditorialImage } from '../../components/EditorialImage';
import { Button, Card, PageHeader } from '../../design-system';
import type { PublicRoute } from '../../lib/router';
import {
  CANONICAL_AGE_GROUPS,
  CANONICAL_LEARNING_DOMAINS,
  EDITORIAL_IMAGES,
} from '../../shared/domain';

interface PublicPageProps {
  onNavigate: (route: PublicRoute) => void;
}

/* ========================================================================= */
/* 2. ABOUT LITTLESTEPS                                                      */
/* ========================================================================= */
export function AboutPage({ onNavigate }: PublicPageProps) {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-12">
      <PageHeader
        kicker="About LittleSteps"
        title="Calm daily companionship for your baby’s first two years"
        description="LittleSteps was created to make early-childhood daily routines simpler, warmer, and less overwhelming for mothers and caregivers."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-6 space-y-4 text-sm sm:text-base text-muted leading-relaxed">
          <h2 className="font-display text-2xl font-semibold text-charcoal">
            Why we built LittleSteps
          </h2>
          <p>
            New mothers often face an endless stream of conflicting parenting advice, complicated milestone charts, and pressure to buy expensive toys. Instead of adding more noise, LittleSteps focuses on a small, reassuring daily rhythm.
          </p>
          <p>
            Each day offers two or three simple, age-appropriate activities crafted for real Indian homes—using clean everyday items like a cotton dhurrie, steel katori, neem wooden spoon, or muslin cloth—while staying simple and adaptable for families everywhere.
          </p>
        </div>

        <div className="lg:col-span-6 rounded-2xl border border-border overflow-hidden bg-surface">
          <EditorialImage
            src={EDITORIAL_IMAGES.everydayCup}
            alt="Small open stainless steel cup, unpainted wooden ring stacker, and folded linen cloth on natural wood"
            aspectClassName="aspect-[4/3]"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="space-y-2">
          <Heart className="w-5 h-5 text-sage" aria-hidden="true" />
          <h3 className="font-display text-lg font-semibold text-charcoal">Mother-Friendly Pace</h3>
          <p className="text-sm text-muted leading-relaxed">
            Short, clear step-by-step instructions designed to be read easily on a phone with one hand during busy days.
          </p>
        </Card>
        <Card className="space-y-2">
          <ShieldCheck className="w-5 h-5 text-sage" aria-hidden="true" />
          <h3 className="font-display text-lg font-semibold text-charcoal">
            Respectful, Non-Diagnostic
          </h3>
          <p className="text-sm text-muted leading-relaxed">
            Our coaching feedback evaluates only how clearly the caregiver followed the activity instructions—never grading your baby.
          </p>
        </Card>
        <Card className="space-y-2">
          <Lock className="w-5 h-5 text-sage" aria-hidden="true" />
          <h3 className="font-display text-lg font-semibold text-charcoal">
            Built Around Child Privacy
          </h3>
          <p className="text-sm text-muted leading-relaxed">
            Practice clips stay strictly private with short-lived access tokens, 30-day automatic deletion, and one-tap deletion anytime.
          </p>
        </Card>
      </div>

      <Card tone="cream" className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1 max-w-xl">
          <h2 className="font-display text-xl font-semibold text-charcoal">
            Ready to see how a daily session feels?
          </h2>
          <p className="text-sm text-muted">
            Create your free parent account or explore how daily guidance and optional coaching work.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" onClick={() => onNavigate('/register')}>
            Start Your Journey
          </Button>
          <Button variant="subtle" onClick={() => onNavigate('/how-it-works')}>
            Explore How It Works
          </Button>
        </div>
      </Card>
    </div>
  );
}

/* ========================================================================= */
/* 3. HOW IT WORKS                                                           */
/* ========================================================================= */
export function HowItWorksPage({ onNavigate }: PublicPageProps) {
  const steps = [
    {
      num: '01',
      icon: <Baby className="w-5 h-5" />,
      title: 'Add your baby’s date of birth',
      body: 'Create your account and enter your baby’s name and date of birth. LittleSteps automatically matches your family to one of eight 3-month stages (0–3m through 21–24m) and updates gently as your baby grows.',
    },
    {
      num: '02',
      icon: <CheckCircle2 className="w-5 h-5" />,
      title: 'Receive 2–3 focused daily activities',
      body: 'Instead of browsing hundreds of articles, open Today’s Journey to see just two or three age-appropriate activities covering cognitive, language, physical, social-emotional, sensory, and everyday skills.',
    },
    {
      num: '03',
      icon: <Video className="w-5 h-5" />,
      title: 'Preview, practice, and optionally record a short clip',
      body: 'Watch the step-paced visual guide, gather everyday household items, read the safety note, and enjoy unhurried play. Whenever you want coaching, record or upload a short private clip (up to 2 minutes).',
    },
    {
      num: '04',
      icon: <ClipboardCheck className="w-5 h-5" />,
      title: 'Receive caregiver-only instruction-match feedback',
      body: 'A reviewer evaluates how closely the caregiver demonstrated the activity steps using an objective rubric, returning a percentage instruction-match score, what went well, and one practical tip for next time.',
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-12">
      <PageHeader
        kicker="How It Works"
        title="A step-by-step daily journey designed never to overwhelm you"
        description="From setting up your baby’s age stage to practicing calmly at home and receiving constructive caregiver coaching."
        action={
          <Button
            variant="primary"
            rightIcon={<ArrowRight className="w-4 h-4" />}
            onClick={() => onNavigate('/register')}
          >
            Start Your Journey
          </Button>
        }
      />

      <div className="space-y-5">
        {steps.map((step) => (
          <Card key={step.num} className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-start">
            <div className="sm:col-span-2 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-sage-soft text-sage flex items-center justify-center shrink-0">
                {step.icon}
              </div>
              <span className="font-mono text-sm text-muted tabular-nums">{step.num}</span>
            </div>
            <div className="sm:col-span-10 space-y-1.5">
              <h2 className="font-display text-xl font-semibold text-charcoal">{step.title}</h2>
              <p className="text-sm sm:text-base text-muted leading-relaxed">{step.body}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card tone="lavender" className="space-y-2.5">
        <h2 className="font-display text-xl font-semibold text-charcoal">
          What the Instruction-Match Score means
        </h2>
        <p className="text-sm text-muted leading-relaxed">
          Every activity has clear caregiver execution criteria—such as calm uncluttered setup, safe positioning, unhurried voice pauses, and following baby’s lead. The percentage score reflects how closely those caregiver steps were demonstrated in your practice clip. It never grades or diagnoses your baby’s intelligence, development level, or health.
        </p>
      </Card>
    </div>
  );
}

/* ========================================================================= */
/* 4. OUR APPROACH                                                           */
/* ========================================================================= */
export function OurApproachPage({ onNavigate }: PublicPageProps) {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-12">
      <PageHeader
        kicker="Our Approach"
        title="Everyday home moments, guided with calm structure"
        description="How LittleSteps organizes activities across eight age groups and six developmental domains while honoring each baby’s individual pace."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="space-y-2.5">
          <h2 className="font-display text-xl font-semibold text-charcoal">
            Less clutter, deeper presence
          </h2>
          <p className="text-sm text-muted leading-relaxed">
            We believe two or three calm, familiar items invite more focused curiosity than a room full of noisy plastic gadgets. Activities use safe objects already in Indian homes so starting takes seconds.
          </p>
        </Card>
        <Card className="space-y-2.5">
          <h2 className="font-display text-xl font-semibold text-charcoal">
            Caregiver confidence first
          </h2>
          <p className="text-sm text-muted leading-relaxed">
            Mothers and caregivers are a baby’s warmest everyday companions. By offering clear step-by-step demonstrations and supportive coaching on caregiver technique, LittleSteps builds confidence without judgment.
          </p>
        </Card>
      </div>

      {/* Six Domains */}
      <section className="space-y-4">
        <h2 className="font-display text-2xl font-semibold text-charcoal">
          The Six Development Domains
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CANONICAL_LEARNING_DOMAINS.map((domain, i) => (
            <Card key={domain.slug} padding="sm" className="space-y-1.5">
              <p className="font-mono text-xs text-sage tabular-nums">0{i + 1}</p>
              <h3 className="font-display text-base font-semibold text-charcoal">{domain.name}</h3>
              <p className="text-xs text-muted leading-relaxed">{domain.description}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Eight Age Groups */}
      <section className="space-y-4">
        <h2 className="font-display text-2xl font-semibold text-charcoal">
          Eight Three-Month Age Stages (0–24 Months)
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {CANONICAL_AGE_GROUPS.map((band) => (
            <Card key={band.slug} tone="cream" padding="sm" className="text-center">
              <p className="font-mono text-sm font-medium text-charcoal tabular-nums">
                {band.label}
              </p>
            </Card>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-8">
        <p className="text-sm text-muted max-w-xl">
          Have a question about our activities, safety notes, or privacy safeguards? We would love to hear from you.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" onClick={() => onNavigate('/register')}>
            Start Your Journey
          </Button>
          <Button variant="subtle" onClick={() => onNavigate('/contact')}>
            Contact Us
          </Button>
        </div>
      </div>
    </div>
  );
}

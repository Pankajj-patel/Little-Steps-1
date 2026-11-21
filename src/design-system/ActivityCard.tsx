import React from 'react';
import { Award, CheckCircle2, CircleDashed, Clock, PlayCircle, UploadCloud } from 'lucide-react';
import { EditorialImage } from '../components/EditorialImage';
import type { JourneyDisplayStatus } from '../shared/types';
import { Badge, type BadgeTone } from './Badge';
import { Button } from './Button';

export interface ActivityCardProps {
  title: string;
  summary: string;
  domainName: string;
  ageGroupLabel: string;
  durationMinutes: number;
  prepLevelLabel?: string;
  materials: string[];
  posterUrl: string;
  statusText: string;
  statusTone?: BadgeTone;
  statusState?: JourneyDisplayStatus;
  completed?: boolean;
  actionLabel?: string;
  onAction: () => void;
}

const STATE_STYLES: Record<
  JourneyDisplayStatus,
  {
    articleClass: string;
    topStripeClass: string;
    badgeTone: BadgeTone;
    buttonVariant: 'primary' | 'secondary';
    icon: React.ReactNode;
  }
> = {
  not_started: {
    articleClass: 'border-border bg-surface',
    topStripeClass: 'bg-border/60',
    badgeTone: 'neutral',
    buttonVariant: 'primary',
    icon: <CircleDashed className="w-3.5 h-3.5" aria-hidden="true" />,
  },
  in_progress: {
    articleClass: 'border-peach bg-peach-soft/20',
    topStripeClass: 'bg-peach-ink/70',
    badgeTone: 'peach',
    buttonVariant: 'primary',
    icon: <PlayCircle className="w-3.5 h-3.5" aria-hidden="true" />,
  },
  completed: {
    articleClass: 'border-sage-border bg-sage-soft/25',
    topStripeClass: 'bg-sage',
    badgeTone: 'sage',
    buttonVariant: 'secondary',
    icon: <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />,
  },
  submitted_for_review: {
    articleClass: 'border-lavender bg-lavender-soft/35',
    topStripeClass: 'bg-lavender-ink/75',
    badgeTone: 'lavender',
    buttonVariant: 'secondary',
    icon: <UploadCloud className="w-3.5 h-3.5" aria-hidden="true" />,
  },
  reviewed: {
    articleClass: 'border-sage bg-sage-soft/45',
    topStripeClass: 'bg-sage',
    badgeTone: 'sage',
    buttonVariant: 'secondary',
    icon: <Award className="w-3.5 h-3.5" aria-hidden="true" />,
  },
};

export function ActivityCard({
  title,
  summary,
  domainName,
  ageGroupLabel,
  durationMinutes,
  prepLevelLabel,
  materials,
  posterUrl,
  statusText,
  statusTone,
  statusState,
  completed = false,
  actionLabel = 'Open Guide',
  onAction,
}: ActivityCardProps) {
  const stateVisual = statusState ? STATE_STYLES[statusState] : null;
  const resolvedTone: BadgeTone = statusTone ?? stateVisual?.badgeTone ?? 'neutral';
  const resolvedIcon = stateVisual ? (
    stateVisual.icon
  ) : completed ? (
    <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
  ) : (
    <Clock className="w-3.5 h-3.5" aria-hidden="true" />
  );
  const resolvedButtonVariant = stateVisual?.buttonVariant ?? 'primary';

  return (
    <article
      data-status={statusState ?? (completed ? 'completed' : 'not_started')}
      className={`rounded-xl border overflow-hidden flex flex-col transition-colors ${
        stateVisual ? stateVisual.articleClass : 'border-border bg-surface'
      }`}
    >
      {stateVisual && (
        <div
          aria-hidden="true"
          className={`h-1 w-full shrink-0 ${stateVisual.topStripeClass}`}
        />
      )}

      <EditorialImage
        src={posterUrl}
        alt={title}
        aspectClassName="aspect-[16/10]"
      />

      <div className="p-5 flex-1 flex flex-col justify-between gap-4">
        <div className="space-y-2">
          {/* Quiet unboxed metadata line */}
          <p className="text-xs text-muted leading-relaxed">
            {domainName} <span aria-hidden="true">·</span> {ageGroupLabel}{' '}
            <span aria-hidden="true">·</span>{' '}
            <span className="font-mono tabular-nums">{durationMinutes} min</span>
            {prepLevelLabel && (
              <>
                {' '}
                <span aria-hidden="true">·</span> <span>{prepLevelLabel}</span>
              </>
            )}
          </p>

          <h3 className="font-display text-xl font-semibold text-charcoal leading-snug">
            {title}
          </h3>

          <p className="text-sm text-muted leading-relaxed">{summary}</p>

          {materials.length > 0 && (
            <p className="text-xs text-muted pt-1">
              Materials:{' '}
              <span className="text-charcoal">{materials.slice(0, 3).join(', ')}</span>
            </p>
          )}
        </div>

        <div className="pt-3.5 border-t border-border/80 flex flex-wrap items-center justify-between gap-3">
          <Badge tone={resolvedTone} icon={resolvedIcon}>
            {statusText}
          </Badge>

          <Button variant={resolvedButtonVariant} size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      </div>
    </article>
  );
}


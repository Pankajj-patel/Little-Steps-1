import React from 'react';

export type BadgeTone = 'neutral' | 'sage' | 'peach' | 'lavender' | 'warning' | 'danger';

export interface BadgeProps {
  tone?: BadgeTone;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-cream text-charcoal border-border',
  sage: 'bg-sage-soft text-sage border-sage-border',
  peach: 'bg-peach-soft text-peach-ink border-peach/60',
  lavender: 'bg-lavender-soft text-lavender-ink border-lavender',
  warning: 'bg-warning-soft text-warning border-warning/25',
  danger: 'bg-danger-soft text-danger border-danger/25',
};

/**
 * Restrained status and highlight badge. Always pairs semantic color with explicit text
 * (and optional icon) for WCAG 2.2 AA color-blind legibility.
 */
export function Badge({ tone = 'neutral', icon, children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap shrink-0 ${TONE_CLASSES[tone]} ${className}`}
    >
      {icon && <span className="shrink-0" aria-hidden="true">{icon}</span>}
      <span>{children}</span>
    </span>
  );
}

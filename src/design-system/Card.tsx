import React from 'react';

export type CardTone = 'default' | 'cream' | 'sage' | 'peach' | 'lavender';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: CardTone;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
}

const TONE_CLASSES: Record<CardTone, string> = {
  default: 'bg-surface border-border',
  cream: 'bg-cream border-border',
  sage: 'bg-sage-soft border-sage-border',
  peach: 'bg-peach-soft border-peach/60',
  lavender: 'bg-lavender-soft border-lavender',
};

const PADDING_CLASSES = {
  none: '',
  sm: 'p-4',
  md: 'p-5 sm:p-6',
  lg: 'p-6 sm:p-8',
};

export function Card({
  tone = 'default',
  padding = 'md',
  interactive = false,
  className = '',
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={`rounded-xl border transition-colors ${TONE_CLASSES[tone]} ${
        PADDING_CLASSES[padding]
      } ${interactive ? 'hover:border-sage/60 cursor-pointer' : ''} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

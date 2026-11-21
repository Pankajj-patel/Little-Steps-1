import React from 'react';
import { Sprout } from 'lucide-react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`rounded-xl border border-border bg-surface p-8 sm:p-10 text-center flex flex-col items-center justify-center space-y-3 ${className}`}
    >
      <div
        aria-hidden="true"
        className="w-12 h-12 rounded-xl bg-cream border border-border flex items-center justify-center text-sage"
      >
        {icon ?? <Sprout className="w-6 h-6" />}
      </div>
      <div className="space-y-1 max-w-md">
        <h3 className="font-display text-lg font-semibold text-charcoal">{title}</h3>
        <p className="text-sm text-muted leading-relaxed">{description}</p>
      </div>
      {actionLabel && onAction && (
        <div className="pt-2">
          <Button variant="primary" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

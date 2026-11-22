import React from 'react';
import { ArrowLeft } from 'lucide-react';

export interface PageHeaderProps {
  title: string;
  description?: string;
  kicker?: string;
  backLabel?: string;
  onBack?: () => void;
  action?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  kicker,
  backLabel,
  onBack,
  action,
}: PageHeaderProps) {
  return (
    <div className="border-b border-border pb-5 space-y-3">
      {backLabel && onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 min-h-[44px] text-sm font-medium text-muted hover:text-charcoal transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sage rounded"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>{backLabel}</span>
        </button>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          {kicker && <p className="text-xs font-semibold uppercase tracking-wider text-muted">{kicker}</p>}
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-charcoal leading-tight">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted leading-relaxed">{description}</p>
          )}
        </div>

        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}

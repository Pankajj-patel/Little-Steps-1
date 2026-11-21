import React from 'react';

export interface ProgressIndicatorProps {
  value: number;
  max?: number;
  label?: string;
  sublabel?: string;
  variant?: 'linear' | 'ring';
  tone?: 'sage' | 'peach' | 'lavender';
  size?: 'sm' | 'md';
}

const FILL_CLASSES = {
  sage: 'bg-sage',
  peach: 'bg-peach-ink',
  lavender: 'bg-lavender-ink',
};

const STROKE_COLORS = {
  sage: '#446E5A',
  peach: '#844825',
  lavender: '#4F4278',
};

export function ProgressIndicator({
  value,
  max = 100,
  label,
  sublabel,
  variant = 'linear',
  tone = 'sage',
  size = 'md',
}: ProgressIndicatorProps) {
  const safeMax = max <= 0 ? 100 : max;
  const clamped = Math.max(0, Math.min(safeMax, value));
  const pct = Math.round((clamped / safeMax) * 100);

  if (variant === 'ring') {
    const dim = size === 'sm' ? 56 : 76;
    const stroke = size === 'sm' ? 5 : 6;
    const radius = (dim - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (pct / 100) * circumference;

    return (
      <div className="inline-flex items-center gap-3.5">
        <div
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={safeMax}
          aria-label={label || 'Progress'}
          className="relative inline-flex items-center justify-center shrink-0"
          style={{ width: dim, height: dim }}
        >
          <svg width={dim} height={dim} className="-rotate-90" aria-hidden="true">
            <circle
              cx={dim / 2}
              cy={dim / 2}
              r={radius}
              fill="none"
              stroke="#EAE6DD"
              strokeWidth={stroke}
            />
            <circle
              cx={dim / 2}
              cy={dim / 2}
              r={radius}
              fill="none"
              stroke={STROKE_COLORS[tone]}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="transition-all duration-300"
            />
          </svg>
          <span className="absolute font-mono text-xs font-medium text-charcoal tabular-nums">
            {pct}%
          </span>
        </div>

        {(label || sublabel) && (
          <div className="min-w-0">
            {label && <p className="text-sm font-medium text-charcoal">{label}</p>}
            {sublabel && <p className="text-xs text-muted">{sublabel}</p>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5 w-full">
      {(label || sublabel) && (
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium text-charcoal">{label}</span>
          <span className="font-mono text-xs text-muted tabular-nums">
            {sublabel ?? `${pct}%`}
          </span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-label={label || 'Progress'}
        className={`w-full rounded-full bg-cream overflow-hidden ${size === 'sm' ? 'h-1.5' : 'h-2.5'}`}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${FILL_CLASSES[tone]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

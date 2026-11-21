import React from 'react';
import { CANONICAL_AGE_GROUPS } from '../shared/domain';

export interface AgeGroupSelectorProps {
  selectedSlug: string;
  onSelect: (slug: string) => void;
  label?: string;
  helperText?: string;
  allowAll?: boolean;
}

/**
 * Interactive selector covering all 8 canonical LittleSteps age bands (0–3m through 21–24m).
 * Uses >= 44px touch targets and responsive grid layout with zero horizontal overflow at 320px+.
 */
export function AgeGroupSelector({
  selectedSlug,
  onSelect,
  label = 'Choose age group',
  helperText,
  allowAll = false,
}: AgeGroupSelectorProps) {
  const options = allowAll
    ? [{ slug: 'all', label: 'All ages (0–24m)' }, ...CANONICAL_AGE_GROUPS]
    : [...CANONICAL_AGE_GROUPS];

  return (
    <fieldset className="space-y-2.5">
      <legend className="text-sm font-medium text-charcoal">{label}</legend>
      {helperText && <p className="text-xs text-muted">{helperText}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {options.map((group) => {
          const active = group.slug === selectedSlug;
          return (
            <button
              key={group.slug}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(group.slug)}
              className={`min-h-[44px] px-3 py-2 rounded-lg border text-sm font-mono tabular-nums transition-colors text-center whitespace-nowrap cursor-pointer ${
                active
                  ? 'bg-sage text-white border-sage font-medium'
                  : 'bg-surface text-charcoal border-border hover:bg-cream hover:border-border-strong'
              }`}
            >
              {group.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

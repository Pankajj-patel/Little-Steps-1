import React, { useId } from 'react';
import { Calendar } from 'lucide-react';
import {
  calculateAgeInMonths,
  CANONICAL_AGE_GROUPS,
  resolveAgeGroupSlug,
} from '../shared/domain';

export interface DatePickerProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  helperText?: string;
  error?: string;
  showBabyAgePreview?: boolean;
}

export const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(function DatePicker(
  {
    label,
    helperText,
    error,
    showBabyAgePreview = false,
    value,
    id,
    required,
    disabled,
    className = '',
    ...rest
  },
  ref
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const helperId = `${inputId}-helper`;
  const errorId = `${inputId}-error`;

  let agePreviewText: string | null = null;
  if (showBabyAgePreview && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const months = calculateAgeInMonths(value);
    const slug = resolveAgeGroupSlug(months);
    const band = CANONICAL_AGE_GROUPS.find((g) => g.slug === slug)?.label ?? '0–3 months';
    agePreviewText = `${months} months · Matched to ${band} stage`;
  }

  return (
    <div className="space-y-1.5 w-full">
      <label htmlFor={inputId} className="block text-sm font-medium text-charcoal">
        {label}
        {required && (
          <span className="text-danger ml-0.5" aria-hidden="true">
            *
          </span>
        )}
      </label>

      <div className="relative">
        <Calendar
          className="pointer-events-none w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2"
          aria-hidden="true"
        />
        <input
          ref={ref}
          id={inputId}
          type="date"
          value={value}
          required={required}
          disabled={disabled}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={`w-full min-h-[44px] rounded-lg border bg-surface pl-10 pr-3.5 py-2.5 text-sm text-charcoal font-mono tabular-nums transition-colors disabled:bg-cream disabled:text-muted disabled:cursor-not-allowed ${
            error
              ? 'border-danger focus:border-danger'
              : 'border-border-strong hover:border-sage/70 focus:border-sage'
          } ${className}`}
          {...rest}
        />
      </div>

      {agePreviewText && !error && (
        <p className="text-xs font-mono tabular-nums text-sage">{agePreviewText}</p>
      )}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : helperText ? (
        <p id={helperId} className="text-xs text-muted">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});

import React, { useId } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label: string;
  options: SelectOption[];
  placeholder?: string;
  helperText?: string;
  error?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    label,
    options,
    placeholder,
    helperText,
    error,
    id,
    required,
    disabled,
    className = '',
    ...rest
  },
  ref
) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const helperId = `${selectId}-helper`;
  const errorId = `${selectId}-error`;
  const describedBy = [error ? errorId : null, helperText && !error ? helperId : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="space-y-1.5 w-full">
      <label htmlFor={selectId} className="block text-sm font-medium text-charcoal">
        {label}
        {required && (
          <span className="text-danger ml-0.5" aria-hidden="true">
            *
          </span>
        )}
      </label>

      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          required={required}
          disabled={disabled}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy || undefined}
          className={`w-full min-h-[44px] appearance-none rounded-lg border bg-surface pl-3.5 pr-10 py-2.5 text-sm text-charcoal transition-colors disabled:bg-cream disabled:text-muted disabled:cursor-not-allowed ${
            error
              ? 'border-danger focus:border-danger'
              : 'border-border-strong hover:border-sage/70 focus:border-sage'
          } ${className}`}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>

        <ChevronDown
          className="pointer-events-none w-4 h-4 text-muted absolute right-3.5 top-1/2 -translate-y-1/2"
          aria-hidden="true"
        />
      </div>

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

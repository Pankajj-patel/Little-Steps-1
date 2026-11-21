import React, { useId } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  helperText?: string;
  error?: string;
  leadingIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, helperText, error, leadingIcon, id, required, disabled, className = '', ...rest },
  ref
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const helperId = `${inputId}-helper`;
  const errorId = `${inputId}-error`;

  const describedBy = [error ? errorId : null, helperText && !error ? helperId : null]
    .filter(Boolean)
    .join(' ');

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
        {leadingIcon && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
          >
            {leadingIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          required={required}
          disabled={disabled}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy || undefined}
          className={`w-full min-h-[44px] rounded-lg border bg-surface px-3.5 py-2.5 text-sm text-charcoal placeholder:text-muted/70 transition-colors disabled:bg-cream disabled:text-muted disabled:cursor-not-allowed ${
            leadingIcon ? 'pl-10' : ''
          } ${
            error
              ? 'border-danger focus:border-danger'
              : 'border-border-strong hover:border-sage/70 focus:border-sage'
          } ${className}`}
          {...rest}
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

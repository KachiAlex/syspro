"use client";

import { InputHTMLAttributes, ChangeEvent, FocusEvent } from "react";

interface CheckboxInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "onBlur" | "type"> {
  label?: string;
  error?: string;
  hint?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
  helperText?: string;
}

export function CheckboxInput({
  label,
  error,
  hint,
  helperText,
  className = "",
  onChange,
  onBlur,
  ...props
}: CheckboxInputProps) {
  const hasError = !!error;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <input
          {...props}
          type="checkbox"
          onChange={onChange}
          onBlur={onBlur}
          className={`h-4 w-4 rounded border transition-colors ${
            hasError
              ? "border-rose-300 bg-rose-50 accent-rose-600"
              : "border-theme-border bg-theme-surface accent-slate-900"
          } ${className}`}
        />
        {label && <label className="text-sm font-medium text-theme-text-primary">{label}</label>}
      </div>
      {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
      {hint && !error && <p className="text-xs text-theme-text-tertiary">{hint}</p>}
      {helperText && !error && <p className="text-xs text-theme-text-tertiary">{helperText}</p>}
    </div>
  );
}

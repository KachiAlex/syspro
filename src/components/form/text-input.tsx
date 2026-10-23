"use client";

import { InputHTMLAttributes, ChangeEvent, FocusEvent } from "react";

interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "onBlur"> {
  label?: string;
  error?: string;
  hint?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
  required?: boolean;
  helperText?: string;
}

export function TextInput({
  label,
  error,
  hint,
  required,
  helperText,
  className = "",
  onChange,
  onBlur,
  ...props
}: TextInputProps) {
  const hasError = !!error;

  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-theme-text-primary">
          {label}
          {required && <span className="ml-1 text-rose-600">*</span>}
        </label>
      )}
      <input
        {...props}
        onChange={onChange}
        onBlur={onBlur}
        className={`w-full rounded-lg border px-3 py-2 text-sm transition-colors ${
          hasError
            ? "border-rose-300 bg-rose-50 text-theme-text-primary placeholder-rose-300 focus:border-rose-500 focus:bg-theme-surface focus:outline-none focus:ring-1 focus:ring-rose-500"
            : "border-theme-border bg-theme-surface text-theme-text-primary placeholder-theme-text-tertiary focus:border-theme-border focus:outline-none focus:ring-1 focus:ring-slate-300"
        } ${className}`}
      />
      {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
      {hint && !error && <p className="text-xs text-theme-text-tertiary">{hint}</p>}
      {helperText && !error && <p className="text-xs text-theme-text-tertiary">{helperText}</p>}
    </div>
  );
}

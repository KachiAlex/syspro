"use client";

import { SelectHTMLAttributes, ChangeEvent, FocusEvent } from "react";

interface SelectInputProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "onBlur"> {
  label?: string;
  error?: string;
  hint?: string;
  options: Array<{ value: string | number; label: string; disabled?: boolean }>;
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
  onBlur?: (e: FocusEvent<HTMLSelectElement>) => void;
  required?: boolean;
  placeholder?: string;
  helperText?: string;
}

export function SelectInput({
  label,
  error,
  hint,
  options,
  required,
  placeholder,
  helperText,
  className = "",
  onChange,
  onBlur,
  ...props
}: SelectInputProps) {
  const hasError = !!error;

  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-theme-text-primary">
          {label}
          {required && <span className="ml-1 text-rose-600">*</span>}
        </label>
      )}
      <select
        {...props}
        onChange={onChange}
        onBlur={onBlur}
        className={`w-full rounded-lg border px-3 py-2 text-sm transition-colors ${
          hasError
            ? "border-rose-300 bg-rose-50 text-theme-text-primary focus:border-rose-500 focus:bg-theme-surface focus:outline-none focus:ring-1 focus:ring-rose-500"
            : "border-theme-border bg-theme-surface text-theme-text-primary focus:border-theme-border focus:outline-none focus:ring-1 focus:ring-slate-300"
        } ${className}`}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
      {hint && !error && <p className="text-xs text-theme-text-tertiary">{hint}</p>}
      {helperText && !error && <p className="text-xs text-theme-text-tertiary">{helperText}</p>}
    </div>
  );
}

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
        <label className="block text-sm font-medium text-slate-900">
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
            ? "border-rose-300 bg-rose-50 text-slate-900 placeholder-rose-300 focus:border-rose-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-rose-500"
            : "border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300"
        } ${className}`}
      />
      {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {helperText && !error && <p className="text-xs text-slate-500">{helperText}</p>}
    </div>
  );
}

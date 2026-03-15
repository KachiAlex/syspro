"use client";

import React from "react";
import { UseFormValidation, UseFormValidationOptions } from "@/hooks/use-form-validation";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";

export interface EnhancedFormProps<T extends Record<string, any>> extends UseFormValidationOptions<T> {
  children: (form: UseFormValidation<T>) => React.ReactNode;
  className?: string;
  noValidate?: boolean;
  autoComplete?: string;
}

export function EnhancedForm<T extends Record<string, any>>({
  children,
  className = "",
  noValidate = true,
  autoComplete = "off",
  ...formOptions
}: EnhancedFormProps<T>) {
  const form = UseFormValidation(formOptions);

  return (
    <form
      className={className}
      onSubmit={form.handleSubmit}
      noValidate={noValidate}
      autoComplete={autoComplete}
    >
      {children(form)}
    </form>
  );
}

// Form field components with built-in validation
export interface FormFieldProps {
  label?: string;
  error?: string | null;
  touched?: boolean;
  required?: boolean;
  helperText?: string;
  className?: string;
  children: React.ReactNode;
}

export function FormField({ label, error, touched, required, helperText, className = "", children }: FormFieldProps) {
  const hasError = error && touched;
  
  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-slate-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      {children}
      {helperText && !hasError && (
        <p className="text-xs text-slate-500">{helperText}</p>
      )}
      {hasError && (
        <div className="flex items-center gap-2 text-xs text-red-600">
          <AlertCircle className="w-3 h-3" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

// Enhanced input component
export interface EnhancedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string | null;
  touched?: boolean;
  label?: string;
  helperText?: string;
  required?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerClassName?: string;
}

export function EnhancedInput({
  error,
  touched,
  label,
  helperText,
  required,
  leftIcon,
  rightIcon,
  containerClassName = "",
  className = "",
  ...props
}: EnhancedInputProps) {
  const hasError = error && touched;
  
  return (
    <FormField
      label={label}
      error={error}
      touched={touched}
      required={required}
      helperText={helperText}
      className={containerClassName}
    >
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">
            {leftIcon}
          </div>
        )}
        <input
          className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
            leftIcon ? "pl-10" : ""
          } ${rightIcon ? "pr-10" : ""} ${
            hasError
              ? "border-red-300 focus:ring-red-500"
              : "border-slate-300"
          } ${className}`}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400">
            {rightIcon}
          </div>
        )}
      </div>
    </FormField>
  );
}

// Enhanced textarea component
export interface EnhancedTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string | null;
  touched?: boolean;
  label?: string;
  helperText?: string;
  required?: boolean;
  containerClassName?: string;
}

export function EnhancedTextarea({
  error,
  touched,
  label,
  helperText,
  required,
  containerClassName = "",
  className = "",
  ...props
}: EnhancedTextareaProps) {
  const hasError = error && touched;
  
  return (
    <FormField
      label={label}
      error={error}
      touched={touched}
      required={required}
      helperText={helperText}
      className={containerClassName}
    >
      <textarea
        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical transition-colors ${
          hasError
            ? "border-red-300 focus:ring-red-500"
            : "border-slate-300"
        } ${className}`}
        {...props}
      />
    </FormField>
  );
}

// Enhanced select component
export interface EnhancedSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string | null;
  touched?: boolean;
  label?: string;
  helperText?: string;
  required?: boolean;
  options: { value: string; label: string; disabled?: boolean }[];
  containerClassName?: string;
}

export function EnhancedSelect({
  error,
  touched,
  label,
  helperText,
  required,
  options,
  containerClassName = "",
  className = "",
  ...props
}: EnhancedSelectProps) {
  const hasError = error && touched;
  
  return (
    <FormField
      label={label}
      error={error}
      touched={touched}
      required={required}
      helperText={helperText}
      className={containerClassName}
    >
      <select
        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
          hasError
            ? "border-red-300 focus:ring-red-500"
            : "border-slate-300"
        } ${className}`}
        {...props}
      >
        <option value="">{props.placeholder || "Select an option"}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </FormField>
  );
}

// Enhanced checkbox component
export interface EnhancedCheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string | null;
  touched?: boolean;
  label?: string;
  helperText?: string;
  required?: boolean;
  containerClassName?: string;
}

export function EnhancedCheckbox({
  error,
  touched,
  label,
  helperText,
  required,
  containerClassName = "",
  className = "",
  ...props
}: EnhancedCheckboxProps) {
  const hasError = error && touched;
  
  return (
    <FormField
      label={label}
      error={error}
      touched={touched}
      required={required}
      helperText={helperText}
      className={containerClassName}
    >
      <div className="flex items-center">
        <input
          type="checkbox"
          className={`w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 focus:ring-2 ${
            hasError ? "border-red-300" : ""
          } ${className}`}
          {...props}
        />
        {label && (
          <label className="ml-2 text-sm text-slate-700 cursor-pointer">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
      </div>
    </FormField>
  );
}

// Enhanced radio group component
export interface EnhancedRadioOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface EnhancedRadioGroupProps {
  error?: string | null;
  touched?: boolean;
  label?: string;
  helperText?: string;
  required?: boolean;
  options: EnhancedRadioOption[];
  value: string;
  onChange: (value: string) => void;
  containerClassName?: string;
  orientation?: "horizontal" | "vertical";
}

export function EnhancedRadioGroup({
  error,
  touched,
  label,
  helperText,
  required,
  options,
  value,
  onChange,
  containerClassName = "",
  orientation = "vertical",
}: EnhancedRadioGroupProps) {
  const hasError = error && touched;
  
  return (
    <FormField
      label={label}
      error={error}
      touched={touched}
      required={required}
      helperText={helperText}
      className={containerClassName}
    >
      <div className={`space-y-2 ${orientation === "horizontal" ? "flex flex-row gap-4" : ""}`}>
        {options.map((option) => (
          <div key={option.value} className="flex items-center">
            <input
              type="radio"
              value={option.value}
              checked={value === option.value}
              onChange={(e) => onChange(e.target.value)}
              disabled={option.disabled}
              className={`w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500 focus:ring-2 ${
                hasError ? "border-red-300" : ""
              }`}
            />
            <label className="ml-2 text-sm text-slate-700 cursor-pointer">
              {option.label}
            </label>
          </div>
        ))}
      </div>
    </FormField>
  );
}

// Form submission button
export interface FormSubmitButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isSubmitting?: boolean;
  submitText?: string;
  loadingText?: string;
  successText?: string;
  showSuccessIcon?: boolean;
}

export function FormSubmitButton({
  isSubmitting = false,
  submitText = "Submit",
  loadingText = "Submitting...",
  successText = "Success!",
  showSuccessIcon = true,
  children,
  className = "",
  disabled,
  ...props
}: FormSubmitButtonProps) {
  const [showSuccess, setShowSuccess] = React.useState(false);

  React.useEffect(() => {
    if (!isSubmitting && showSuccess) {
      const timer = setTimeout(() => setShowSuccess(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isSubmitting, showSuccess]);

  const handleClick = (e: React.FormEvent) => {
    if (!isSubmitting && !disabled) {
      setShowSuccess(true);
      props.onClick?.(e);
    }
  };

  return (
    <button
      type="submit"
      disabled={disabled || isSubmitting}
      className={`w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${className}`}
      onClick={handleClick}
      {...props}
    >
      {isSubmitting ? (
        <div className="flex items-center justify-center">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          {loadingText}
        </div>
      ) : showSuccess && showSuccessIcon ? (
        <div className="flex items-center justify-center">
          <CheckCircle className="w-4 h-4 mr-2" />
          {successText}
        </div>
      ) : (
        children || submitText
      )}
    </button>
  );
}

// Global message display
export interface FormMessagesProps {
  error?: string | null;
  success?: string | null;
  onClear?: () => void;
  className?: string;
}

export function FormMessages({ error, success, onClear, className = "" }: FormMessagesProps) {
  if (!error && !success) {
    return null;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {error && (
        <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-sm text-red-800">{error}</span>
          </div>
          {onClear && (
            <button
              onClick={onClear}
              className="text-red-600 hover:text-red-800"
              aria-label="Clear error"
            >
              ×
            </button>
          )}
        </div>
      )}
      
      {success && (
        <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-sm text-green-800">{success}</span>
          </div>
          {onClear && (
            <button
              onClick={onClear}
              className="text-green-600 hover:text-green-800"
              aria-label="Clear success"
            >
              ×
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Form progress indicator
export interface FormProgressProps {
  steps: { label: string; completed: boolean; current?: boolean }[];
  className?: string;
}

export function FormProgress({ steps, className = "" }: FormProgressProps) {
  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={index} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                step.completed
                  ? "bg-green-600 text-white"
                  : step.current
                  ? "bg-blue-600 text-white"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              {step.completed ? "✓" : index + 1}
            </div>
            {index < steps.length - 1 && (
              <div
                className={`w-12 h-1 mx-2 ${
                  step.completed ? "bg-green-600" : "bg-slate-200"
                }`}
              />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-2">
        {steps.map((step, index) => (
          <div
            key={index}
            className={`text-xs ${
              step.current ? "text-blue-600 font-medium" : "text-slate-600"
            }`}
            style={{ width: `${100 / steps.length}%` }}
          >
            {step.label}
          </div>
        ))}
      </div>
    </div>
  );
}

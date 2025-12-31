/**
 * Form Field Component
 * Provides consistent form field styling with error highlighting
 */

import React from 'react';

interface FormFieldProps {
  label: string;
  name: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  className?: string;
  helpText?: string;
}

export function FormField({
  label,
  name,
  type = 'text',
  value,
  onChange,
  error,
  placeholder,
  required = false,
  disabled = false,
  autoComplete,
  className = '',
  helpText,
}: FormFieldProps) {
  const hasError = Boolean(error);

  return (
    <div className={className}>
      <label 
        htmlFor={name} 
        className="block text-sm font-medium text-gray-700 mb-2"
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoComplete={autoComplete}
        className={`w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
          hasError 
            ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
            : 'border-gray-300'
        } ${
          disabled 
            ? 'bg-gray-50 text-gray-500 cursor-not-allowed' 
            : 'bg-white'
        }`}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${name}-error` : helpText ? `${name}-help` : undefined}
      />
      
      {error && (
        <p 
          id={`${name}-error`}
          className="mt-1 text-sm text-red-600"
          role="alert"
        >
          {error}
        </p>
      )}
      
      {helpText && !error && (
        <p 
          id={`${name}-help`}
          className="mt-1 text-sm text-gray-500"
        >
          {helpText}
        </p>
      )}
    </div>
  );
}

interface TextAreaFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  error?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  rows?: number;
  className?: string;
  helpText?: string;
}

export function TextAreaField({
  label,
  name,
  value,
  onChange,
  error,
  placeholder,
  required = false,
  disabled = false,
  rows = 3,
  className = '',
  helpText,
}: TextAreaFieldProps) {
  const hasError = Boolean(error);

  return (
    <div className={className}>
      <label 
        htmlFor={name} 
        className="block text-sm font-medium text-gray-700 mb-2"
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      <textarea
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        rows={rows}
        className={`w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-vertical ${
          hasError 
            ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
            : 'border-gray-300'
        } ${
          disabled 
            ? 'bg-gray-50 text-gray-500 cursor-not-allowed' 
            : 'bg-white'
        }`}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${name}-error` : helpText ? `${name}-help` : undefined}
      />
      
      {error && (
        <p 
          id={`${name}-error`}
          className="mt-1 text-sm text-red-600"
          role="alert"
        >
          {error}
        </p>
      )}
      
      {helpText && !error && (
        <p 
          id={`${name}-help`}
          className="mt-1 text-sm text-gray-500"
        >
          {helpText}
        </p>
      )}
    </div>
  );
}

interface SelectFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  helpText?: string;
  placeholder?: string;
}

export function SelectField({
  label,
  name,
  value,
  onChange,
  options,
  error,
  required = false,
  disabled = false,
  className = '',
  helpText,
  placeholder = 'Select an option...',
}: SelectFieldProps) {
  const hasError = Boolean(error);

  return (
    <div className={className}>
      <label 
        htmlFor={name} 
        className="block text-sm font-medium text-gray-700 mb-2"
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
          hasError 
            ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
            : 'border-gray-300'
        } ${
          disabled 
            ? 'bg-gray-50 text-gray-500 cursor-not-allowed' 
            : 'bg-white'
        }`}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${name}-error` : helpText ? `${name}-help` : undefined}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option 
            key={option.value} 
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
      
      {error && (
        <p 
          id={`${name}-error`}
          className="mt-1 text-sm text-red-600"
          role="alert"
        >
          {error}
        </p>
      )}
      
      {helpText && !error && (
        <p 
          id={`${name}-help`}
          className="mt-1 text-sm text-gray-500"
        >
          {helpText}
        </p>
      )}
    </div>
  );
}
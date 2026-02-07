/**
 * Client-side form validation utilities for better UX
 */

import { z } from "zod";

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validate a form against a Zod schema
 */
export function validateForm<T extends z.ZodSchema>(
  schema: T,
  data: unknown
): ValidationResult {
  const result = schema.safeParse(data);

  if (result.success) {
    return { valid: true, errors: [] };
  }

  const errors: ValidationError[] = [];
  for (const issue of result.error.issues) {
    const field = issue.path.join(".");
    errors.push({
      field: field || "general",
      message: issue.message,
    });
  }

  return { valid: false, errors };
}

/**
 * Get all errors as a flat map for quick lookup
 */
export function getErrorMap(errors: ValidationError[]): Record<string, string> {
  return errors.reduce(
    (acc, err) => {
      acc[err.field] = err.message;
      return acc;
    },
    {} as Record<string, string>
  );
}

/**
 * Check if a specific field has an error
 */
export function getFieldError(
  errors: ValidationError[],
  field: string
): string | undefined {
  return errors.find((e) => e.field === field)?.message;
}

/**
 * Common validation utilities
 */
export const commonValidations = {
  email: (value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  },

  phone: (value: string): boolean => {
    // Simple phone validation - accept 7-15 digits with optional + and dashes
    const phoneRegex = /^\+?[\d\s\-()]{7,}$/;
    return phoneRegex.test(value.replace(/\s/g, ""));
  },

  url: (value: string): boolean => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  },

  positiveNumber: (value: number): boolean => {
    return value > 0 && Number.isFinite(value);
  },

  nonNegativeNumber: (value: number): boolean => {
    return value >= 0 && Number.isFinite(value);
  },

  strongPassword: (value: string): boolean => {
    // At least 8 chars, 1 uppercase, 1 lowercase, 1 number
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(value);
  },

  percentageNumber: (value: number): boolean => {
    return value >= 0 && value <= 100 && Number.isFinite(value);
  },
};

/**
 * Format validation errors for display
 */
export function formatValidationErrors(
  errors: ValidationError[]
): string {
  if (errors.length === 0) return "";
  if (errors.length === 1) return errors[0].message;

  return `${errors.length} validation errors:\n${errors
    .map((e) => `  • ${e.field}: ${e.message}`)
    .join("\n")}`;
}

/**
 * Check if form is dirty (has changes)
 */
export function isFormDirty<T extends Record<string, any>>(
  original: T,
  current: T
): boolean {
  return JSON.stringify(original) !== JSON.stringify(current);
}

/**
 * Merge validation errors with form state
 */
export function mergeValidationErrors<T extends Record<string, any>>(
  formState: T,
  errors: ValidationError[]
): T & { __errors?: Record<string, string> } {
  const errorMap = getErrorMap(errors);
  return { ...formState, __errors: errorMap };
}

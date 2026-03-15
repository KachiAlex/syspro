import { useState, useCallback, useEffect } from "react";
import { z, ZodSchema, ZodError } from "zod";

export type ValidationRule<T = any> = {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  email?: boolean;
  url?: boolean;
  custom?: (value: T) => string | null;
};

export type FieldValidation<T = any> = {
  value: T;
  error: string | null;
  touched: boolean;
  dirty: boolean;
  rules: ValidationRule<T>;
};

export type FormValidation<T extends Record<string, any> = Record<string, any>> = {
  fields: Record<keyof T, FieldValidation>;
  isValid: boolean;
  isDirty: boolean;
  isSubmitting: boolean;
  errors: Record<keyof T, string | null>;
  values: T;
  touched: Record<keyof T, boolean>;
};

export type UseFormValidationOptions<T> = {
  initialValues: T;
  validationSchema?: ZodSchema<T>;
  validationRules?: Partial<Record<keyof T, ValidationRule>>;
  onSubmit?: (values: T) => Promise<void> | void;
  onError?: (errors: Record<keyof T, string>) => void;
  onSuccess?: (values: T) => void;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  resetOnSubmit?: boolean;
};

export function useFormValidation<T extends Record<string, any>>({
  initialValues,
  validationSchema,
  validationRules = {},
  onSubmit,
  onError,
  onSuccess,
  validateOnChange = true,
  validateOnBlur = true,
  resetOnSubmit = false,
}: UseFormValidationOptions<T>) {
  const [formState, setFormState] = useState<FormValidation<T>>(() => ({
    fields: Object.keys(initialValues).reduce((acc, key) => {
      const fieldKey = key as keyof T;
      return {
        ...acc,
        [fieldKey]: {
          value: initialValues[fieldKey],
          error: null,
          touched: false,
          dirty: false,
          rules: validationRules[fieldKey] || {},
        },
      };
    }, {} as Record<keyof T, FieldValidation>),
    isValid: true,
    isDirty: false,
    isSubmitting: false,
    errors: {} as Record<keyof T, string | null>,
    values: initialValues,
    touched: {} as Record<keyof T, boolean>,
  }));

  const [globalError, setGlobalError] = useState<string | null>(null);
  const [globalSuccess, setGlobalSuccess] = useState<string | null>(null);

  // Validate a single field
  const validateField = useCallback((fieldKey: keyof T, value: any): string | null => {
    const field = formState.fields[fieldKey];
    const rules = field.rules;

    // Required validation
    if (rules.required && (!value || value === "")) {
      return `${fieldKey as string} is required`;
    }

    // Skip other validations if field is empty and not required
    if (!value || value === "") {
      return null;
    }

    // String validations
    if (typeof value === "string") {
      if (rules.minLength && value.length < rules.minLength) {
        return `${fieldKey as string} must be at least ${rules.minLength} characters`;
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        return `${fieldKey as string} must not exceed ${rules.maxLength} characters`;
      }
      if (rules.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return "Please enter a valid email address";
      }
      if (rules.url && !/^https?:\/\/.+/.test(value)) {
        return "Please enter a valid URL";
      }
      if (rules.pattern && !rules.pattern.test(value)) {
        return `${fieldKey as string} format is invalid`;
      }
    }

    // Number validations
    if (typeof value === "number") {
      if (rules.min !== undefined && value < rules.min) {
        return `${fieldKey as string} must be at least ${rules.min}`;
      }
      if (rules.max !== undefined && value > rules.max) {
        return `${fieldKey as string} must not exceed ${rules.max}`;
      }
    }

    // Custom validation
    if (rules.custom) {
      const customError = rules.custom(value);
      if (customError) {
        return customError;
      }
    }

    return null;
  }, [formState.fields]);

  // Validate entire form using Zod schema
  const validateFormWithSchema = useCallback((values: T): Record<keyof T, string | null> => {
    if (!validationSchema) {
      return {} as Record<keyof T, string | null>;
    }

    try {
      validationSchema.parse(values);
      return {} as Record<keyof T, string | null>;
    } catch (error) {
      if (error instanceof ZodError) {
        const errors: Record<string, string | null> = {} as Record<string, string | null>;
        error.errors.forEach((err) => {
          const path = err.path.join(".");
          errors[path as keyof T] = err.message;
        });
        return errors as Record<keyof T, string | null>;
      }
      return {} as Record<keyof T, string | null>;
    }
  }, [validationSchema]);

  // Validate entire form
  const validateForm = useCallback((values?: T): Record<keyof T, string | null> => {
    const currentValues = values || formState.values;
    
    // First validate with field rules
    const fieldErrors: Record<keyof T, string | null> = {} as Record<keyof T, string | null>;
    Object.keys(currentValues).forEach((key) => {
      const fieldKey = key as keyof T;
      fieldErrors[fieldKey] = validateField(fieldKey, currentValues[fieldKey]);
    });

    // Then validate with Zod schema if provided
    const schemaErrors = validateFormWithSchema(currentValues);
    
    // Merge errors (schema errors take precedence)
    const mergedErrors = { ...fieldErrors, ...schemaErrors };
    
    return mergedErrors;
  }, [formState.values, validateField, validateFormWithSchema]);

  // Update field value
  const setFieldValue = useCallback((fieldKey: keyof T, value: any) => {
    setFormState((prev) => {
      const newFields = {
        ...prev.fields,
        [fieldKey]: {
          ...prev.fields[fieldKey],
          value,
          dirty: value !== initialValues[fieldKey],
          error: validateOnChange ? validateField(fieldKey, value) : prev.fields[fieldKey].error,
        },
      };

      const newValues = { ...prev.values, [fieldKey]: value };
      const newErrors = { ...prev.errors, [fieldKey]: newFields[fieldKey].error };
      const newTouched = { ...prev.touched, [fieldKey]: true };

      return {
        ...prev,
        fields: newFields,
        values: newValues,
        errors: newErrors,
        touched: newTouched,
        isDirty: Object.values(newFields).some((field) => field.dirty),
        isValid: !Object.values(newErrors).some((error) => error !== null),
      };
    });
  }, [initialValues, validateOnChange, validateField]);

  // Set field error manually
  const setFieldError = useCallback((fieldKey: keyof T, error: string | null) => {
    setFormState((prev) => ({
      ...prev,
      fields: {
        ...prev.fields,
        [fieldKey]: {
          ...prev.fields[fieldKey],
          error,
        },
      },
      errors: {
        ...prev.errors,
        [fieldKey]: error,
      },
      isValid: !Object.values({ ...prev.errors, [fieldKey]: error }).some((e) => e !== null),
    }));
  }, []);

  // Set field touched state
  const setFieldTouched = useCallback((fieldKey: keyof T, touched: boolean = true) => {
    setFormState((prev) => {
      const newFields = {
        ...prev.fields,
        [fieldKey]: {
          ...prev.fields[fieldKey],
          touched,
          error: validateOnBlur && touched ? validateField(fieldKey, prev.fields[fieldKey].value) : prev.fields[fieldKey].error,
        },
      };

      const newErrors = { ...prev.errors, [fieldKey]: newFields[fieldKey].error };
      const newTouched = { ...prev.touched, [fieldKey]: touched };

      return {
        ...prev,
        fields: newFields,
        errors: newErrors,
        touched: newTouched,
        isValid: !Object.values(newErrors).some((error) => error !== null),
      };
    });
  }, [validateOnBlur, validateField]);

  // Handle field blur
  const handleFieldBlur = useCallback((fieldKey: keyof T) => {
    setFieldTouched(fieldKey, true);
  }, [setFieldTouched]);

  // Handle field change
  const handleFieldChange = useCallback((fieldKey: keyof T, value: any) => {
    setFieldValue(fieldKey, value);
  }, [setFieldValue]);

  // Reset form
  const resetForm = useCallback(() => {
    setFormState({
      fields: Object.keys(initialValues).reduce((acc, key) => {
        const fieldKey = key as keyof T;
        return {
          ...acc,
          [fieldKey]: {
            value: initialValues[fieldKey],
            error: null,
            touched: false,
            dirty: false,
            rules: validationRules[fieldKey] || {},
          },
        };
      }, {} as Record<keyof T, FieldValidation>),
      isValid: true,
      isDirty: false,
      isSubmitting: false,
      errors: {} as Record<keyof T, string | null>,
      values: initialValues,
      touched: {} as Record<keyof T, boolean>,
    });
    setGlobalError(null);
    setGlobalSuccess(null);
  }, [initialValues, validationRules]);

  // Submit form
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    // Validate all fields
    const errors = validateForm();
    
    if (Object.values(errors).some((error) => error !== null)) {
      // Update form state with errors
      setFormState((prev) => ({
        ...prev,
        errors,
        isValid: false,
      }));
      
      if (onError) {
        onError(errors as Record<keyof T, string>);
      }
      return;
    }

    setFormState((prev) => ({ ...prev, isSubmitting: true }));
    setGlobalError(null);
    setGlobalSuccess(null);

    try {
      await onSubmit?.(formState.values);
      
      if (resetOnSubmit) {
        resetForm();
      }
      
      if (onSuccess) {
        onSuccess(formState.values);
      }
      
      setGlobalSuccess("Form submitted successfully!");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An error occurred";
      setGlobalError(errorMessage);
      
      if (onError) {
        onError(errors as Record<keyof T, string>);
      }
    } finally {
      setFormState((prev) => ({ ...prev, isSubmitting: false }));
    }
  }, [formState.values, validateForm, onSubmit, onError, onSuccess, resetOnSubmit, resetForm]);

  // Clear global messages
  const clearMessages = useCallback(() => {
    setGlobalError(null);
    setGlobalSuccess(null);
  }, []);

  // Set global error
  const setGlobalErrorMessage = useCallback((error: string) => {
    setGlobalError(error);
    setGlobalSuccess(null);
  }, []);

  // Set global success
  const setGlobalSuccessMessage = useCallback((success: string) => {
    setGlobalSuccess(success);
    setGlobalError(null);
  }, []);

  // Get field props for form inputs
  const getFieldProps = useCallback((fieldKey: keyof T) => {
    const field = formState.fields[fieldKey];
    return {
      name: fieldKey,
      value: field.value,
      error: field.error,
      touched: field.touched,
      dirty: field.dirty,
      onChange: (value: any) => handleFieldChange(fieldKey, value),
      onBlur: () => handleFieldBlur(fieldKey),
      setError: (error: string | null) => setFieldError(fieldKey, error),
      setTouched: (touched: boolean) => setFieldTouched(fieldKey, touched),
    };
  }, [formState.fields, handleFieldChange, handleFieldBlur, setFieldError, setFieldTouched]);

  return {
    // Form state
    values: formState.values,
    errors: formState.errors,
    touched: formState.touched,
    isValid: formState.isValid,
    isDirty: formState.isDirty,
    isSubmitting: formState.isSubmitting,
    
    // Global messages
    globalError,
    globalSuccess,
    
    // Actions
    setFieldValue,
    setFieldError,
    setFieldTouched,
    handleFieldChange,
    handleFieldBlur,
    handleSubmit,
    resetForm,
    
    // Message actions
    clearMessages,
    setGlobalErrorMessage,
    setGlobalSuccessMessage,
    
    // Utilities
    getFieldProps,
    validateForm,
    validateField,
  };
}

// Common validation rules
export const commonValidationRules = {
  required: { required: true },
  email: { required: true, email: true },
  password: { 
    required: true, 
    minLength: 8,
    custom: (value: string) => {
      if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
        return "Password must contain at least one uppercase letter, one lowercase letter, and one number";
      }
      return null;
    }
  },
  phone: {
    required: true,
    pattern: /^\+?[\d\s\-\(\)]+$/,
    custom: (value: string) => {
      const digits = value.replace(/\D/g, '');
      if (digits.length < 10) {
        return "Phone number must be at least 10 digits";
      }
      return null;
    }
  },
  url: { required: true, url: true },
  name: { required: true, minLength: 2, maxLength: 50 },
  description: { maxLength: 500 },
  positiveNumber: { required: true, min: 0 },
  percentage: { required: true, min: 0, max: 100 },
};

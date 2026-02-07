/**
 * Custom React hook for managing form state with validation
 */

import { useState, useCallback } from "react";
import { z } from "zod";
import { validateForm, ValidationError, getErrorMap } from "@/lib/form-validation";

export interface UseFormOptions<T> {
  initialValues: T;
  schema?: z.ZodSchema;
  onSubmit?: (values: T) => Promise<void> | void;
}

export interface UseFormReturn<T> {
  values: T;
  errors: ValidationError[];
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isDirty: boolean;
  errorMap: Record<string, string>;

  // Methods
  setValue: <K extends keyof T>(field: K, value: T[K]) => void;
  setValues: (values: Partial<T>) => void;
  setFieldError: (field: string, message: string) => void;
  setFieldTouched: (field: string, touched?: boolean) => void;
  validateField: (field: keyof T) => ValidationError[];
  validate: () => ValidationError[];
  resetForm: () => void;
  handleChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => void;
  handleBlur: (
    e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  getFieldProps: (field: keyof T) => {
    value: T[keyof T];
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
    "aria-invalid": boolean;
  };
}

export function useForm<T extends Record<string, any>>(
  options: UseFormOptions<T>
): UseFormReturn<T> {
  const { initialValues, schema, onSubmit } = options;

  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const errorMap = getErrorMap(errors);
  const isDirty = JSON.stringify(values) !== JSON.stringify(initialValues);

  const setValue = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const setFieldValues = useCallback((newValues: Partial<T>) => {
    setValues((prev) => ({ ...prev, ...newValues }));
  }, []);

  const setFieldError = useCallback((field: string, message: string) => {
    setErrors((prev) => {
      const filtered = prev.filter((e) => e.field !== field);
      return [...filtered, { field, message }];
    });
  }, []);

  const setFieldTouched = useCallback(
    (field: string, touched: boolean = true) => {
      setTouched((prev) => ({ ...prev, [field]: touched }));
    },
    []
  );

  const validate = useCallback((): ValidationError[] => {
    if (!schema) return [];
    const result = validateForm(schema, values);
    setErrors(result.errors);
    return result.errors;
  }, [schema, values]);

  const validateField = useCallback(
    (field: keyof T): ValidationError[] => {
      if (!schema) return [];
      // Validate just this field
      const fieldSchema = (schema as any).pick({ [field]: true });
      const result = validateForm(fieldSchema, { [field]: values[field] });
      return result.errors;
    },
    [schema, values]
  );

  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors([]);
    setTouched({});
  }, [initialValues]);

  const handleChange = useCallback(
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >
    ) => {
      const { name, value, type } = e.target;
      const actualValue =
        type === "checkbox"
          ? (e.target as HTMLInputElement).checked
          : type === "number"
            ? Number(value)
            : value;
      setValue(name as keyof T, actualValue as T[keyof T]);
    },
    [setValue]
  );

  const handleBlur = useCallback(
    (
      e: React.FocusEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >
    ) => {
      const { name } = e.target;
      setFieldTouched(name, true);
      if (schema) {
        validateField(name as keyof T);
      }
    },
    [setFieldTouched, schema, validateField]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);

      try {
        // Validate form if schema exists
        const validationErrors = validate();
        if (validationErrors.length > 0) {
          setIsSubmitting(false);
          return;
        }

        // Call submit handler
        if (onSubmit) {
          await onSubmit(values);
        }
      } catch (error) {
        console.error("Form submit error:", error);
        setFieldError("general", error instanceof Error ? error.message : "Submit failed");
      } finally {
        setIsSubmitting(false);
      }
    },
    [validate, onSubmit, values, setFieldError]
  );

  const getFieldProps = useCallback(
    (field: keyof T) => ({
      value: values[field] ?? "",
      onChange: handleChange,
      onBlur: handleBlur,
      "aria-invalid": errorMap[field as string] ? true : false,
    }),
    [values, handleChange, handleBlur, errorMap]
  );

  return {
    values,
    errors,
    touched,
    isSubmitting,
    isDirty,
    errorMap,
    setValue,
    setValues: setFieldValues,
    setFieldError,
    setFieldTouched,
    validateField,
    validate,
    resetForm,
    handleChange,
    handleBlur,
    handleSubmit,
    getFieldProps,
  };
}

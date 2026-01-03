import { Logger } from '@nestjs/common';
import {
  ModuleRegistryError,
  ModuleNotFoundError,
  ModuleValidationError,
  ModuleDependencyError,
  InvalidInputError,
  InternalServerError,
} from './module-registry.errors';

/**
 * Error handler utility for module registry operations
 */
export class ModuleRegistryErrorHandler {
  private static readonly logger = new Logger(ModuleRegistryErrorHandler.name);

  /**
   * Handle and log errors
   */
  static handle(error: any, context: string): never {
    this.logger.error(`Error in ${context}: ${error.message}`, error.stack);

    if (error instanceof ModuleRegistryError) {
      throw error;
    }

    if (error instanceof Error) {
      // Handle specific error types
      if (error.message.includes('not found')) {
        throw new ModuleNotFoundError(error.message);
      }

      if (error.message.includes('validation')) {
        throw new ModuleValidationError(error.message);
      }

      if (error.message.includes('dependency')) {
        throw new ModuleDependencyError(error.message);
      }

      if (error.message.includes('invalid')) {
        throw new InvalidInputError(error.message);
      }
    }

    // Default to internal server error
    throw new InternalServerError(
      'An unexpected error occurred',
      { originalError: error?.message },
    );
  }

  /**
   * Validate required fields
   */
  static validateRequired(
    data: Record<string, any>,
    requiredFields: string[],
    context: string,
  ): void {
    const missingFields = requiredFields.filter(field => !data[field]);

    if (missingFields.length > 0) {
      throw new InvalidInputError(
        `Missing required fields: ${missingFields.join(', ')}`,
        { context, missingFields },
      );
    }
  }

  /**
   * Validate field types
   */
  static validateTypes(
    data: Record<string, any>,
    typeMap: Record<string, string>,
    context: string,
  ): void {
    const errors: string[] = [];

    for (const [field, expectedType] of Object.entries(typeMap)) {
      if (data[field] !== undefined) {
        const actualType = typeof data[field];
        if (actualType !== expectedType) {
          errors.push(`${field}: expected ${expectedType}, got ${actualType}`);
        }
      }
    }

    if (errors.length > 0) {
      throw new InvalidInputError(
        `Type validation failed: ${errors.join('; ')}`,
        { context, errors },
      );
    }
  }

  /**
   * Validate array items
   */
  static validateArrayItems(
    array: any[],
    itemType: string,
    fieldName: string,
    context: string,
  ): void {
    if (!Array.isArray(array)) {
      throw new InvalidInputError(
        `${fieldName} must be an array`,
        { context, fieldName },
      );
    }

    const invalidItems = array.filter(item => typeof item !== itemType);

    if (invalidItems.length > 0) {
      throw new InvalidInputError(
        `${fieldName} contains invalid items. Expected all items to be ${itemType}`,
        { context, fieldName, invalidItemCount: invalidItems.length },
      );
    }
  }

  /**
   * Validate string length
   */
  static validateStringLength(
    value: string,
    minLength: number,
    maxLength: number,
    fieldName: string,
    context: string,
  ): void {
    if (value.length < minLength || value.length > maxLength) {
      throw new InvalidInputError(
        `${fieldName} must be between ${minLength} and ${maxLength} characters`,
        { context, fieldName, length: value.length, minLength, maxLength },
      );
    }
  }

  /**
   * Validate URL format
   */
  static validateUrl(url: string, fieldName: string, context: string): void {
    try {
      new URL(url);
    } catch (error) {
      throw new InvalidInputError(
        `${fieldName} is not a valid URL`,
        { context, fieldName, url },
      );
    }
  }

  /**
   * Validate enum value
   */
  static validateEnum(
    value: string,
    allowedValues: string[],
    fieldName: string,
    context: string,
  ): void {
    if (!allowedValues.includes(value)) {
      throw new InvalidInputError(
        `${fieldName} must be one of: ${allowedValues.join(', ')}`,
        { context, fieldName, value, allowedValues },
      );
    }
  }

  /**
   * Validate numeric range
   */
  static validateNumberRange(
    value: number,
    min: number,
    max: number,
    fieldName: string,
    context: string,
  ): void {
    if (value < min || value > max) {
      throw new InvalidInputError(
        `${fieldName} must be between ${min} and ${max}`,
        { context, fieldName, value, min, max },
      );
    }
  }

  /**
   * Wrap async function with error handling
   */
  static async wrapAsync<T>(
    fn: () => Promise<T>,
    context: string,
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      this.handle(error, context);
    }
  }

  /**
   * Wrap sync function with error handling
   */
  static wrapSync<T>(
    fn: () => T,
    context: string,
  ): T {
    try {
      return fn();
    } catch (error) {
      this.handle(error, context);
    }
  }
}

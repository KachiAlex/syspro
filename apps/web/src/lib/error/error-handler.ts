/**
 * Error Handler Service
 * Provides centralized error handling and user-friendly error messages
 */

export interface ApiError {
  success: false;
  message: string;
  errors?: ValidationError[];
  code?: string;
  statusCode?: number;
}

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface NetworkError extends Error {
  code?: string;
  status?: number;
}

/**
 * Error Handler Class
 * Converts various error types into user-friendly messages
 */
export class ErrorHandler {
  /**
   * Handle API errors and return user-friendly messages
   */
  static handleApiError(error: any): string {
    // Handle network errors
    if (error.code === 'NETWORK_ERROR' || error.name === 'NetworkError') {
      return 'Unable to connect to the server. Please check your internet connection and try again.';
    }

    // Handle timeout errors
    if (error.code === 'TIMEOUT_ERROR' || error.message?.includes('timeout')) {
      return 'The request timed out. Please try again.';
    }

    // Handle API response errors
    if (error.response) {
      const { status, data } = error.response;
      
      switch (status) {
        case 400:
          return data?.message || 'Invalid request. Please check your input and try again.';
        case 401:
          return 'Your session has expired. Please log in again.';
        case 403:
          return 'You do not have permission to perform this action.';
        case 404:
          return 'The requested resource was not found.';
        case 409:
          return data?.message || 'A conflict occurred. The resource may already exist.';
        case 422:
          return data?.message || 'Validation failed. Please check your input.';
        case 429:
          return 'Too many requests. Please wait a moment and try again.';
        case 500:
          return 'An internal server error occurred. Please try again later.';
        case 502:
        case 503:
        case 504:
          return 'The server is temporarily unavailable. Please try again later.';
        default:
          return data?.message || `An error occurred (${status}). Please try again.`;
      }
    }

    // Handle structured API errors
    if (error.success === false) {
      return error.message || 'An error occurred. Please try again.';
    }

    // Handle generic errors
    if (error.message) {
      return error.message;
    }

    // Fallback error message
    return 'An unexpected error occurred. Please try again.';
  }

  /**
   * Handle validation errors and return field-specific messages
   */
  static handleValidationErrors(errors: ValidationError[]): Record<string, string> {
    const fieldErrors: Record<string, string> = {};
    
    errors.forEach((error) => {
      fieldErrors[error.field] = error.message;
    });
    
    return fieldErrors;
  }

  /**
   * Log errors for debugging while showing user-friendly messages
   */
  static logError(error: any, context?: string): void {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
      url: typeof window !== 'undefined' ? window.location.href : 'server',
    };

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error logged:', errorInfo);
    }

    // In production, you might want to send to an error tracking service
    // Example: Sentry, LogRocket, etc.
    // if (process.env.NODE_ENV === 'production') {
    //   sendToErrorTrackingService(errorInfo);
    // }
  }

  /**
   * Check if an error is a network error
   */
  static isNetworkError(error: any): boolean {
    return (
      error.code === 'NETWORK_ERROR' ||
      error.name === 'NetworkError' ||
      error.message?.includes('Network Error') ||
      error.message?.includes('fetch')
    );
  }

  /**
   * Check if an error is an authentication error
   */
  static isAuthError(error: any): boolean {
    return (
      error.response?.status === 401 ||
      error.statusCode === 401 ||
      error.code === 'UNAUTHORIZED' ||
      error.message?.includes('unauthorized') ||
      error.message?.includes('token')
    );
  }

  /**
   * Check if an error is a validation error
   */
  static isValidationError(error: any): boolean {
    return (
      error.response?.status === 422 ||
      error.statusCode === 422 ||
      error.code === 'VALIDATION_ERROR' ||
      (error.errors && Array.isArray(error.errors))
    );
  }

  /**
   * Get retry delay for exponential backoff
   */
  static getRetryDelay(attempt: number, baseDelay = 1000): number {
    return Math.min(baseDelay * Math.pow(2, attempt), 30000); // Max 30 seconds
  }

  /**
   * Create a user-friendly error message for common scenarios
   */
  static createUserMessage(errorType: string, details?: any): string {
    const messages = {
      login_failed: 'Login failed. Please check your email, password, and tenant ID.',
      registration_failed: 'Registration failed. Please check your information and try again.',
      network_error: 'Unable to connect to the server. Please check your internet connection.',
      timeout_error: 'The request timed out. Please try again.',
      server_error: 'A server error occurred. Please try again later.',
      validation_error: 'Please check your input and correct any errors.',
      permission_error: 'You do not have permission to perform this action.',
      not_found_error: 'The requested item was not found.',
      conflict_error: 'This item already exists or conflicts with existing data.',
      rate_limit_error: 'Too many requests. Please wait a moment and try again.',
    };

    return messages[errorType as keyof typeof messages] || 'An error occurred. Please try again.';
  }
}

/**
 * Hook for handling errors in React components
 */
export function useErrorHandler() {
  const handleError = (error: any, context?: string) => {
    ErrorHandler.logError(error, context);
    return ErrorHandler.handleApiError(error);
  };

  const handleValidationErrors = (errors: ValidationError[]) => {
    return ErrorHandler.handleValidationErrors(errors);
  };

  const isNetworkError = (error: any) => {
    return ErrorHandler.isNetworkError(error);
  };

  const isAuthError = (error: any) => {
    return ErrorHandler.isAuthError(error);
  };

  return {
    handleError,
    handleValidationErrors,
    isNetworkError,
    isAuthError,
  };
}
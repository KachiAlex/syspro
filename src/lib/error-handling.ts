// Error types and classes
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public field?: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class NetworkError extends AppError {
  constructor(message: string, public status?: number, details?: any) {
    super(message, 'NETWORK_ERROR', status || 500, details);
    this.name = 'NetworkError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 'AUTHORIZATION_ERROR', 403);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 'NOT_FOUND_ERROR', 404);
    this.name = 'NotFoundError';
  }
}

export class ServerError extends AppError {
  constructor(message: string = 'Internal server error') {
    super(message, 'SERVER_ERROR', 500);
    this.name = 'ServerError';
  }
}

// Error handler utilities
export interface ErrorInfo {
  type: string;
  message: string;
  code?: string;
  statusCode?: number;
  details?: any;
  timestamp: Date;
  stack?: string;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorLog: ErrorInfo[] = [];
  private maxLogSize = 1000;

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  // Log error for debugging
  log(error: Error | AppError, context?: string): ErrorInfo {
    const errorInfo: ErrorInfo = {
      type: error.name || 'UnknownError',
      message: error.message,
      code: (error as AppError).code,
      statusCode: (error as AppError).statusCode,
      details: (error as AppError).details,
      timestamp: new Date(),
      stack: error.stack,
    };

    // Add context to details
    if (context) {
      errorInfo.details = { ...errorInfo.details, context };
    }

    // Add to log (with size limit)
    this.errorLog.push(errorInfo);
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error logged:', errorInfo);
    }

    return errorInfo;
  }

  // Get error log
  getErrorLog(): ErrorInfo[] {
    return [...this.errorLog];
  }

  // Clear error log
  clearErrorLog(): void {
    this.errorLog = [];
  }

  // Get user-friendly error message
  getUserMessage(error: Error | AppError): string {
    if (error instanceof ValidationError) {
      return error.message;
    }

    if (error instanceof AuthenticationError) {
      return 'Please log in to continue';
    }

    if (error instanceof AuthorizationError) {
      return "You don't have permission to perform this action";
    }

    if (error instanceof NotFoundError) {
      return 'The requested resource was not found';
    }

    if (error instanceof NetworkError) {
      if (error.status === 429) {
        return 'Too many requests. Please try again later';
      }
      if (error.status && error.status >= 500) {
        return 'Server is temporarily unavailable. Please try again later';
      }
      return 'Network error. Please check your connection';
    }

    if (error instanceof ServerError) {
      return 'Something went wrong. Please try again later';
    }

    // Default error message
    return 'An unexpected error occurred. Please try again';
  }

  // Check if error is recoverable
  isRecoverable(error: Error | AppError): boolean {
    if (error instanceof NetworkError) {
      return error.status !== 404 && error.status !== 401 && error.status !== 403;
    }

    if (error instanceof ValidationError) {
      return true;
    }

    return false;
  }

  // Get error severity
  getErrorSeverity(error: Error | AppError): 'low' | 'medium' | 'high' | 'critical' {
    if (error instanceof ValidationError) {
      return 'low';
    }

    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      return 'medium';
    }

    if (error instanceof NetworkError) {
      if (error.status && error.status >= 500) {
        return 'high';
      }
      return 'medium';
    }

    if (error instanceof ServerError) {
      return 'critical';
    }

    return 'medium';
  }
}

// API error handling utilities
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  statusCode?: number;
}

export async function handleApiCall<T>(
  apiCall: () => Promise<Response>,
  options?: {
    errorMessage?: string;
    showUserMessage?: boolean;
    context?: string;
  }
): Promise<ApiResponse<T>> {
  const errorHandler = ErrorHandler.getInstance();
  const { errorMessage = 'Request failed', showUserMessage = true, context } = options || {};

  try {
    const response = await apiCall();
    
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: response.statusText };
      }

      const error = new NetworkError(
        errorData.message || errorMessage,
        response.status,
        errorData
      );

      errorHandler.log(error, context);

      return {
        success: false,
        error: {
          code: error.code,
          message: showUserMessage ? errorHandler.getUserMessage(error) : error.message,
          details: error.details,
        },
        statusCode: response.status,
      };
    }

    const data = await response.json();
    return {
      success: true,
      data,
      statusCode: response.status,
    };
  } catch (error) {
    const appError = error instanceof Error ? error : new Error(String(error));
    errorHandler.log(appError, context);

    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: showUserMessage ? errorHandler.getUserMessage(appError) : appError.message,
      },
    };
  }
}

// Form validation error handling
export interface FormValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  globalError?: string;
}

export function handleFormValidation(
  validationResult: { success: boolean; data?: any; error?: any },
  options?: {
    fieldName?: string;
    customMessages?: Record<string, string>;
  }
): FormValidationResult {
  const { fieldName, customMessages } = options || {};

  if (validationResult.success) {
    return { isValid: true, errors: {} };
  }

  const errors: Record<string, string> = {};

  if (validationResult.error) {
    if (fieldName) {
      errors[fieldName] = customMessages?.[validationResult.error.code] || 
                         validationResult.error.message || 
                         'Validation failed';
    } else {
      // Handle Zod errors
      if (validationResult.error.errors) {
        validationResult.error.errors.forEach((err: any) => {
          const path = err.path.join('.');
          errors[path] = customMessages?.[err.code] || err.message;
        });
      } else {
        errors.global = validationResult.error.message || 'Validation failed';
      }
    }
  }

  return {
    isValid: false,
    errors,
    globalError: errors.global,
  };
}

// React error boundary
export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundaryUtils {
  static getInitialState(): ErrorBoundaryState {
    return {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static handleError(error: Error, errorInfo: React.ErrorInfo): ErrorBoundaryState {
    const errorHandler = ErrorHandler.getInstance();
    const loggedError = errorHandler.log(error, 'React Error Boundary');

    return {
      hasError: true,
      error,
      errorInfo: loggedError,
    };
  }

  static canRecover(error: Error): boolean {
    const errorHandler = ErrorHandler.getInstance();
    return errorHandler.isRecoverable(error);
  }

  static getErrorMessage(error: Error): string {
    const errorHandler = ErrorHandler.getInstance();
    return errorHandler.getUserMessage(error);
  }

  static getErrorSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical' {
    const errorHandler = ErrorHandler.getInstance();
    return errorHandler.getErrorSeverity(error);
  }
}

// Toast notification utilities
export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  persistent?: boolean;
  actions?: Array<{
    label: string;
    action: () => void;
    variant?: 'primary' | 'secondary';
  }>;
}

export class ToastManager {
  private static instance: ToastManager;
  private toasts: ToastMessage[] = [];
  private listeners: ((toasts: ToastMessage[]) => void)[] = [];

  static getInstance(): ToastManager {
    if (!ToastManager.instance) {
      ToastManager.instance = new ToastManager();
    }
    return ToastManager.instance;
  }

  // Subscribe to toast updates
  subscribe(listener: (toasts: ToastMessage[]) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // Notify listeners
  private notify(): void {
    this.listeners.forEach(listener => listener([...this.toasts]));
  }

  // Add toast
  addToast(toast: Omit<ToastMessage, 'id'>): string {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: ToastMessage = { ...toast, id };
    
    this.toasts.push(newToast);
    this.notify();

    // Auto-remove non-persistent toasts
    if (!newToast.persistent) {
      const duration = newToast.duration || 5000;
      setTimeout(() => this.removeToast(id), duration);
    }

    return id;
  }

  // Remove toast
  removeToast(id: string): void {
    this.toasts = this.toasts.filter(toast => toast.id !== id);
    this.notify();
  }

  // Clear all toasts
  clearToasts(): void {
    this.toasts = [];
    this.notify();
  }

  // Convenience methods
  success(title: string, message?: string, options?: Partial<ToastMessage>): string {
    return this.addToast({ type: 'success', title, message, ...options });
  }

  error(title: string, message?: string, options?: Partial<ToastMessage>): string {
    return this.addToast({ type: 'error', title, message, persistent: true, ...options });
  }

  warning(title: string, message?: string, options?: Partial<ToastMessage>): string {
    return this.addToast({ type: 'warning', title, message, ...options });
  }

  info(title: string, message?: string, options?: Partial<ToastMessage>): string {
    return this.addToast({ type: 'info', title, message, ...options });
  }

  // Get current toasts
  getToasts(): ToastMessage[] {
    return [...this.toasts];
  }
}

// Global error handler setup
export function setupGlobalErrorHandling(): void {
  // Handle uncaught JavaScript errors
  window.addEventListener('error', (event) => {
    const errorHandler = ErrorHandler.getInstance();
    errorHandler.log(event.error || new Error(event.message), 'Global Error Handler');
  });

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const errorHandler = ErrorHandler.getInstance();
    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    errorHandler.log(error, 'Unhandled Promise Rejection');
  });

  // Handle console errors in development
  if (process.env.NODE_ENV === 'development') {
    const originalConsoleError = console.error;
    console.error = (...args) => {
      originalConsoleError.apply(console, args);
      
      // Try to extract error information
      const firstArg = args[0];
      if (firstArg instanceof Error) {
        const errorHandler = ErrorHandler.getInstance();
        errorHandler.log(firstArg, 'Console Error');
      }
    };
  }
}

// Export singleton instances
export const errorHandler = ErrorHandler.getInstance();
export const toastManager = ToastManager.getInstance();

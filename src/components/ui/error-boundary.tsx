"use client";

import React, { Component, ReactNode } from "react";
import { ErrorBoundaryUtils } from "@/lib/error-handling";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: any) => void;
  showRetry?: boolean;
  showHome?: boolean;
  customMessage?: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = ErrorBoundaryUtils.getInitialState();
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const newState = ErrorBoundaryUtils.handleError(error, errorInfo);
    this.setState(newState);
    
    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState(ErrorBoundaryUtils.getInitialState());
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback component
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      const error = this.state.error;
      const canRecover = error ? ErrorBoundaryUtils.canRecover(error) : false;
      const severity = error ? ErrorBoundaryUtils.getErrorSeverity(error) : 'medium';
      const message = this.props.customMessage || 
                      (error ? ErrorBoundaryUtils.getErrorMessage(error) : 'Something went wrong');

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
          <div className="max-w-lg w-full">
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              {/* Error Icon */}
              <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-6 ${
                severity === 'critical' ? 'bg-red-100' :
                severity === 'high' ? 'bg-orange-100' :
                severity === 'medium' ? 'bg-yellow-100' :
                'bg-blue-100'
              }`}>
                <AlertTriangle className={`w-8 h-8 ${
                  severity === 'critical' ? 'text-red-600' :
                  severity === 'high' ? 'text-orange-600' :
                  severity === 'medium' ? 'text-yellow-600' :
                  'text-blue-600'
                }`} />
              </div>

              {/* Error Message */}
              <h1 className="text-2xl font-bold text-slate-900 mb-2">
                Oops! Something went wrong
              </h1>
              <p className="text-slate-600 mb-6">
                {message}
              </p>

              {/* Error Details (Development Only) */}
              {process.env.NODE_ENV === 'development' && error && (
                <details className="mb-6 text-left">
                  <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-700 mb-2">
                    Error Details (Development Only)
                  </summary>
                  <div className="mt-2 p-3 bg-slate-100 rounded text-xs text-slate-700 overflow-auto max-h-32">
                    <div className="font-semibold mb-1">{error.name}</div>
                    <div className="mb-2">{error.message}</div>
                    {error.stack && (
                      <pre className="whitespace-pre-wrap">{error.stack}</pre>
                    )}
                  </div>
                </details>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {canRecover && this.props.showRetry !== false && (
                  <button
                    onClick={this.handleRetry}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Try Again
                  </button>
                )}
                
                {this.props.showHome !== false && (
                  <button
                    onClick={this.handleGoHome}
                    className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <Home className="w-4 h-4" />
                    Go Home
                  </button>
                )}
              </div>

              {/* Support Info */}
              <div className="mt-8 pt-6 border-t border-slate-200">
                <p className="text-sm text-slate-500">
                  If this problem persists, please contact our support team.
                </p>
                <div className="mt-2 flex justify-center gap-4 text-sm">
                  <a href="mailto:support@example.com" className="text-blue-600 hover:text-blue-800">
                    Email Support
                  </a>
                  <span className="text-slate-300">•</span>
                  <a href="/help" className="text-blue-600 hover:text-blue-800">
                    Help Center
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for error boundaries in functional components
export function useErrorHandler() {
  const handleError = (error: Error, errorInfo?: any) => {
    ErrorBoundaryUtils.handleError(error, errorInfo || { componentStack: '' });
  };

  const getUserMessage = (error: Error) => {
    return ErrorBoundaryUtils.getErrorMessage(error);
  };

  const canRecover = (error: Error) => {
    return ErrorBoundaryUtils.canRecover(error);
  };

  const getSeverity = (error: Error) => {
    return ErrorBoundaryUtils.getErrorSeverity(error);
  };

  return {
    handleError,
    getUserMessage,
    canRecover,
    getSeverity,
  };
}

// Simple error fallback component
export function SimpleErrorFallback({ error, resetError }: { error?: Error; resetError?: () => void }) {
  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-center gap-2 text-red-800">
        <AlertTriangle className="w-5 h-5" />
        <span className="font-medium">Something went wrong</span>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-700">
          {ErrorBoundaryUtils.getErrorMessage(error)}
        </p>
      )}
      {resetError && (
        <button
          onClick={resetError}
          className="mt-3 text-sm text-red-600 hover:text-red-800 underline"
        >
          Try again
        </button>
      )}
    </div>
  );
}

// Inline error boundary for specific components
export function InlineErrorBoundary({ 
  children, 
  fallback 
}: { 
  children: ReactNode; 
  fallback?: ReactNode;
}) {
  return (
    <ErrorBoundary
      fallback={fallback || <SimpleErrorFallback />}
      showRetry={true}
      showHome={false}
    >
      {children}
    </ErrorBoundary>
  );
}

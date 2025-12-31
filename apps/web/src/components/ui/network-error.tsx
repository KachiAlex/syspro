/**
 * Network Error Component
 * Provides retry options and handles network errors gracefully
 */

import React, { useState } from 'react';
import { LoadingButton } from './loading-spinner';

interface NetworkErrorProps {
  error: string;
  onRetry?: () => Promise<void>;
  onDismiss?: () => void;
  showRetry?: boolean;
  className?: string;
}

export function NetworkError({ 
  error, 
  onRetry, 
  onDismiss, 
  showRetry = true,
  className = '' 
}: NetworkErrorProps) {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    if (!onRetry) return;
    
    setIsRetrying(true);
    try {
      await onRetry();
    } catch (error) {
      console.error('Retry failed:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className={`bg-red-50 border border-red-200 rounded-lg p-6 ${className}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          <svg 
            className="h-6 w-6 text-red-400" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
            aria-hidden="true"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" 
            />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800">
            Connection Error
          </h3>
          <div className="mt-2 text-sm text-red-700">
            <p>{error}</p>
          </div>
          {showRetry && (
            <div className="mt-4 flex space-x-3">
              <LoadingButton
                isLoading={isRetrying}
                onClick={handleRetry}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Try Again
              </LoadingButton>
              {onDismiss && (
                <button
                  type="button"
                  onClick={onDismiss}
                  className="bg-white border border-red-300 text-red-700 hover:bg-red-50 px-3 py-2 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface RetryableActionProps {
  children: React.ReactNode;
  onAction: () => Promise<void>;
  maxRetries?: number;
  retryDelay?: number;
  className?: string;
}

export function RetryableAction({ 
  children, 
  onAction, 
  maxRetries = 3, 
  retryDelay = 1000,
  className = '' 
}: RetryableActionProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const executeAction = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await onAction();
      setRetryCount(0); // Reset on success
    } catch (err: any) {
      const errorMessage = err.message || 'An error occurred';
      setError(errorMessage);
      console.error('Action failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = async () => {
    if (retryCount >= maxRetries) {
      setError('Maximum retry attempts reached. Please try again later.');
      return;
    }

    setRetryCount(prev => prev + 1);
    
    // Add delay before retry
    if (retryDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, retryDelay * retryCount));
    }
    
    await executeAction();
  };

  const handleDismiss = () => {
    setError(null);
    setRetryCount(0);
  };

  return (
    <div className={className}>
      {error ? (
        <NetworkError
          error={error}
          onRetry={retryCount < maxRetries ? handleRetry : undefined}
          onDismiss={handleDismiss}
          showRetry={retryCount < maxRetries}
        />
      ) : (
        <div onClick={executeAction}>
          {children}
        </div>
      )}
      
      {isLoading && (
        <div className="mt-2 text-sm text-gray-600">
          {retryCount > 0 ? `Retrying... (${retryCount}/${maxRetries})` : 'Loading...'}
        </div>
      )}
    </div>
  );
}

interface OfflineIndicatorProps {
  className?: string;
}

export function OfflineIndicator({ className = '' }: OfflineIndicatorProps) {
  const [isOnline, setIsOnline] = useState(
    typeof window !== 'undefined' ? window.navigator.onLine : true
  );

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className={`bg-yellow-50 border-l-4 border-yellow-400 p-4 ${className}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          <svg 
            className="h-5 w-5 text-yellow-400" 
            viewBox="0 0 20 20" 
            fill="currentColor"
            aria-hidden="true"
          >
            <path 
              fillRule="evenodd" 
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" 
              clipRule="evenodd" 
            />
          </svg>
        </div>
        <div className="ml-3">
          <p className="text-sm text-yellow-700">
            You are currently offline. Some features may not be available.
          </p>
        </div>
      </div>
    </div>
  );
}
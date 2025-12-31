/**
 * Environment Check Component
 * Validates environment configuration and displays helpful error messages
 */

'use client';

import React, { useEffect, useState } from 'react';
import { validateEnvironment, env } from '../../lib/config/env';
import { ErrorMessage } from '../ui/error-message';
import { LoadingSpinner } from '../ui/loading-spinner';

interface EnvironmentCheckProps {
  children: React.ReactNode;
}

export function EnvironmentCheck({ children }: EnvironmentCheckProps) {
  const [isValidating, setIsValidating] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    const validateConfig = async () => {
      try {
        validateEnvironment();
        setIsValid(true);
        setValidationError(null);
      } catch (error: any) {
        setValidationError(error.message);
        setIsValid(false);
      } finally {
        setIsValidating(false);
      }
    };

    validateConfig();
  }, []);

  // Show loading while validating
  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <h2 className="mt-4 text-lg font-semibold text-gray-900">
            Initializing Application
          </h2>
          <p className="mt-2 text-gray-600">
            Validating configuration...
          </p>
        </div>
      </div>
    );
  }

  // Show error if validation failed
  if (!isValid && validationError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Configuration Error
            </h1>
            <p className="text-gray-600">
              The application cannot start due to missing or invalid configuration.
            </p>
          </div>
          
          <ErrorMessage 
            error={validationError}
            className="mb-6"
          />
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              Quick Setup Guide
            </h3>
            
            <div className="space-y-4 text-sm text-blue-800">
              <div>
                <h4 className="font-medium mb-2">1. Create Environment File</h4>
                <p>Create a <code className="bg-blue-100 px-2 py-1 rounded">.env.local</code> file in your project root:</p>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">2. Add Required Variables</h4>
                <pre className="bg-blue-100 p-3 rounded text-xs overflow-x-auto">
{`NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
NODE_ENV=development`}
                </pre>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">3. Restart Development Server</h4>
                <p>Stop your development server and run <code className="bg-blue-100 px-2 py-1 rounded">npm run dev</code> again.</p>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-blue-200">
              <button
                onClick={() => window.location.reload()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Retry Configuration Check
              </button>
            </div>
          </div>
          
          {env.isDevelopment && (
            <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Development Info</h4>
              <div className="text-sm text-gray-600 space-y-1">
                <p><strong>Current API URL:</strong> {env.apiBaseUrl || 'Not set'}</p>
                <p><strong>Environment:</strong> {env.nodeEnv}</p>
                <p><strong>Browser:</strong> {typeof window !== 'undefined' ? 'Client-side' : 'Server-side'}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render children if validation passed
  return <>{children}</>;
}

/**
 * Environment Status Indicator
 * Shows current environment configuration in development
 */
export function EnvironmentStatus() {
  if (!env.isDevelopment) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg z-50">
      <div className="flex items-center space-x-2">
        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
        <span>
          {env.nodeEnv} | API: {env.apiBaseUrl}
        </span>
      </div>
    </div>
  );
}
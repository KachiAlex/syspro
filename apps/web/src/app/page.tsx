'use client';

/**
 * Home Page - Landing page with authentication routing
 * Redirects authenticated users to dashboard, shows login for unauthenticated users
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/auth-context';
import { LoadingSpinner } from '../components/ui/loading-spinner';

export default function HomePage() {
  const { isAuthenticated, isLoading, error } = useAuth();
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setRedirecting(true);
      
      if (isAuthenticated) {
        router.push('/dashboard');
      } else {
        router.push('/login');
      }
    }
  }, [isAuthenticated, isLoading, router]);

  // Show error state if authentication initialization failed
  if (error && !isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Initialization Error
          </h2>
          <p className="text-gray-600 mb-4">
            Unable to initialize the authentication system.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Show loading while determining authentication state or redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <LoadingSpinner size="xl" />
        <h2 className="mt-4 text-xl font-semibold text-gray-900">
          Syspro ERP System
        </h2>
        <p className="mt-2 text-gray-600">
          {isLoading 
            ? 'Initializing...' 
            : redirecting 
              ? (isAuthenticated ? 'Redirecting to dashboard...' : 'Redirecting to login...')
              : 'Loading...'
          }
        </p>
        
        {/* Progress indicator */}
        <div className="mt-4 w-48 mx-auto">
          <div className="bg-gray-200 rounded-full h-1">
            <div className="bg-blue-600 h-1 rounded-full animate-pulse" style={{ width: '60%' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}
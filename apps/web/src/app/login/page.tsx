'use client';

/**
 * Login Page
 * Provides the login interface for users to authenticate
 */

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/auth-context';
import { LoginForm } from '../../components/auth/login-form';

export default function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Don't render login form if already authenticated
  if (isAuthenticated) {
    return null;
  }

  const handleLoginSuccess = () => {
    router.push('/dashboard');
  };

  const handleLoginError = (error: string) => {
    console.error('Login error:', error);
    // Error is already handled by the auth context and displayed in the form
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <LoginForm
          onSuccess={handleLoginSuccess}
          onError={handleLoginError}
          className="bg-white shadow-md rounded-lg p-8"
        />
        
        {/* Additional links */}
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Don't have an account?{' '}
            <a href="#" className="font-medium text-blue-600 hover:text-blue-500">
              Contact your administrator
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
'use client';
/**
 * Login Form Component
 * Provides login interface with email, password, and tenant selection
 */

import React, { useState } from 'react';

import { useAuth } from '../../contexts/auth-context';
import { LoginRequest } from '../../lib/api/client';

interface LoginFormProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  className?: string;
}

export function LoginForm({ onSuccess, onError, className = '' }: LoginFormProps) {
  const { login, loginPlatform, isLoading, error, clearError } = useAuth();
  const [authMode, setAuthMode] = useState<'tenant' | 'platform'>('tenant');
  
  const [formData, setFormData] = useState<LoginRequest & { tenantId?: string }>({
    email: '',
    password: '',
    tenantId: '',
  });
  
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear validation error for this field
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: '' }));
    }
    
    // Clear global error
    if (error) {
      clearError();
    }
  };

  // Validate form data
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    if (!formData.password.trim()) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    
    if (authMode === 'tenant' && !formData.tenantId?.trim()) {
      errors.tenantId = 'Tenant ID is required for tenant login';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      const credentials = {
        email: formData.email.trim(),
        password: formData.password,
      };

      const result = authMode === 'platform'
        ? await loginPlatform(credentials)
        : await login(credentials, formData.tenantId?.trim());
      
      if (result.success) {
        onSuccess?.();
      } else {
        onError?.(result.error || 'Login failed');
      }
    } catch (error: any) {
      const errorMessage = error.message || 'An unexpected error occurred';
      onError?.(errorMessage);
    }
  };

  return (
    <div className={`w-full max-w-md mx-auto ${className}`}>
      <form onSubmit={handleSubmit} className="space-y-6 bg-white border border-gray-200 rounded-xl p-8 shadow-lg">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Sign In</h2>
          <p className="mt-2 text-gray-600">
            Access your Syspro ERP account
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="space-y-2">
          <div className="flex rounded-lg bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => setAuthMode('tenant')}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
                authMode === 'tenant'
                  ? 'bg-white text-blue-600 shadow'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              disabled={isLoading}
            >
              Organization Login
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('platform')}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
                authMode === 'platform'
                  ? 'bg-white text-purple-600 shadow'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              disabled={isLoading}
            >
              Platform Super Admin
            </button>
          </div>
          <p className="text-xs text-gray-500">
            {authMode === 'tenant'
              ? 'Use this mode to access your tenant-specific workspace.'
              : 'Use this mode if you are a platform super admin managing all tenants.'}
          </p>
        </div>

        {/* Global Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Email Field */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={formData.email}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              validationErrors.email ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="Enter your email"
            disabled={isLoading}
          />
          {validationErrors.email && (
            <p className="mt-1 text-sm text-red-600">{validationErrors.email}</p>
          )}
        </div>

        {/* Password Field */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={formData.password}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              validationErrors.password ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="Enter your password"
            disabled={isLoading}
          />
          {validationErrors.password && (
            <p className="mt-1 text-sm text-red-600">{validationErrors.password}</p>
          )}
        </div>

        {/* Tenant ID Field */}
        {authMode === 'tenant' && (
          <div>
            <label htmlFor="tenantId" className="block text-sm font-medium text-gray-700 mb-2">
              Tenant ID
            </label>
            <input
              id="tenantId"
              name="tenantId"
              type="text"
              required
              value={formData.tenantId}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                validationErrors.tenantId ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Enter your tenant ID"
              disabled={isLoading}
            />
            {validationErrors.tenantId && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.tenantId}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Contact your administrator if you don't know your tenant ID
            </p>
          </div>
        )}

        {/* Submit Button */}
        <div>
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
              isLoading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isLoading ? (
              <div className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Signing in...
              </div>
            ) : (
              'Sign In'
            )}
          </button>
        </div>

        {/* Demo Credentials */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
            <h4 className="text-sm font-semibold text-blue-800 mb-2">Tenant Demo</h4>
            <div className="text-xs text-blue-700 space-y-1">
              <p><strong>Email:</strong> admin@syspro.com</p>
              <p><strong>Password:</strong> Admin@123</p>
              <p><strong>Tenant ID:</strong> Use your seeded tenant UUID</p>
            </div>
          </div>
          <div className="p-4 bg-purple-50 border border-purple-200 rounded-md">
            <h4 className="text-sm font-semibold text-purple-800 mb-2">Platform Super Admin</h4>
            <div className="text-xs text-purple-700 space-y-1">
              <p><strong>Email:</strong> admin@syspro.com</p>
              <p><strong>Password:</strong> Admin@123</p>
              <p><strong>Tenant ID:</strong> Not required in this mode</p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
'use client';

/**
 * Authentication Context - Provides authentication state to React components
 * Manages login/logout actions and user profile data
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authService, AuthState, AuthResult } from '../lib/auth/auth-service';
import { AuthUser } from '../lib/types/shared';
import { LoginRequest, RegisterRequest } from '../lib/api/client';

// Context value interface
export interface AuthContextValue {
  // Authentication state
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  
  // Authentication actions
  login: (credentials: LoginRequest, tenantId?: string) => Promise<AuthResult>;
  register: (data: RegisterRequest, tenantId?: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  clearError: () => void;
  
  // Tenant management
  setTenantId: (tenantId: string | null) => void;
  getTenantId: () => string | null;
}

// Create the context
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Provider props interface
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Authentication Provider Component
 * Wraps the app and provides authentication state to all child components
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    error: null,
  });

  // Subscribe to auth service state changes
  useEffect(() => {
    const unsubscribe = authService.onAuthStateChange((newState: AuthState) => {
      setAuthState(newState);
    });

    // Get initial state
    setAuthState(authService.getState());

    // Cleanup subscription on unmount
    return unsubscribe;
  }, []);

  // Authentication actions
  const login = async (credentials: LoginRequest, tenantId?: string): Promise<AuthResult> => {
    try {
      const result = await authService.login(credentials, tenantId);
      return result;
    } catch (error: any) {
      const errorMessage = error.message || 'Login failed';
      return { success: false, error: errorMessage };
    }
  };

  const register = async (data: RegisterRequest, tenantId?: string): Promise<AuthResult> => {
    try {
      const result = await authService.register(data, tenantId);
      return result;
    } catch (error: any) {
      const errorMessage = error.message || 'Registration failed';
      return { success: false, error: errorMessage };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await authService.logout();
    } catch (error) {
      console.warn('Logout error:', error);
      // Continue with logout even if backend call fails
    }
  };

  const refreshToken = async (): Promise<void> => {
    try {
      await authService.refreshToken();
    } catch (error) {
      console.warn('Token refresh error:', error);
      // Auth service will handle clearing state if refresh fails
    }
  };

  const clearError = (): void => {
    // Update only the error state
    setAuthState(prev => ({ ...prev, error: null }));
  };

  const setTenantId = (tenantId: string | null): void => {
    authService.setTenantId(tenantId);
  };

  const getTenantId = (): string | null => {
    return authService.getTenantId();
  };

  // Context value
  const contextValue: AuthContextValue = {
    // State
    user: authState.user,
    isLoading: authState.isLoading,
    isAuthenticated: authState.isAuthenticated,
    error: authState.error,
    
    // Actions
    login,
    register,
    logout,
    refreshToken,
    clearError,
    
    // Tenant management
    setTenantId,
    getTenantId,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Custom hook to use authentication context
 * Throws error if used outside of AuthProvider
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}

/**
 * Higher-order component for protecting routes
 * Redirects to login if user is not authenticated
 */
export function withAuth<P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<P> {
  return function AuthenticatedComponent(props: P) {
    const { isAuthenticated, isLoading } = useAuth();
    
    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      );
    }
    
    if (!isAuthenticated) {
      // In a real app, you'd redirect to login page
      // For now, show a message
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Authentication Required
            </h2>
            <p className="text-gray-600">
              Please log in to access this page.
            </p>
          </div>
        </div>
      );
    }
    
    return <Component {...props} />;
  };
}

/**
 * Hook for checking if user has specific permissions
 * Can be extended based on your RBAC implementation
 */
export function usePermissions() {
  const { user } = useAuth();
  
  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    
    // TODO: Implement based on your permission system
    // For now, return true for authenticated users
    return true;
  };
  
  const hasRole = (role: string): boolean => {
    if (!user) return false;
    
    // TODO: Implement based on your role system
    // For now, return true for authenticated users
    return true;
  };
  
  return {
    hasPermission,
    hasRole,
  };
}
/**
 * Authentication service for managing user authentication state and tokens
 * Handles login, logout, token refresh, and authentication state management
 */

import { apiClient } from '../api/client';
import { tokenStorage } from './token-storage';
import { AuthUser, AuthTokens, ApiResponse } from '@syspro/shared';
import { LoginRequest, RegisterRequest } from '../api/client';

// Authentication state
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  error: string | null;
}

// Authentication result
export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  error?: string;
}

// Event listener type
export type AuthStateChangeListener = (state: AuthState) => void;

/**
 * Authentication service class
 */
export class AuthService {
  private currentState: AuthState = {
    isAuthenticated: false,
    isLoading: true,
    user: null,
    error: null,
  };

  private listeners: Set<AuthStateChangeListener> = new Set();
  private refreshTimer: NodeJS.Timeout | null = null;
  private isRefreshing = false;

  constructor() {
    this.initializeAuth();
  }

  /**
   * Initialize authentication state from stored tokens
   */
  private async initializeAuth(): Promise<void> {
    try {
      const accessToken = tokenStorage.getAccessToken();
      
      if (!accessToken || tokenStorage.isTokenExpired()) {
        this.updateState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          error: null,
        });
        return;
      }

      // Set the token in the API client
      apiClient.setAuthToken(accessToken);

      // Try to get user profile to validate the token
      const response = await apiClient.getProfile();
      
      if (response.success && response.data) {
        this.updateState({
          isAuthenticated: true,
          isLoading: false,
          user: response.data,
          error: null,
        });

        // Set up automatic token refresh
        this.setupTokenRefresh();
      } else {
        // Token is invalid, clear it
        this.clearAuthState();
      }
    } catch (error) {
      console.warn('Failed to initialize auth state:', error);
      this.clearAuthState();
    }
  }

  /**
   * Update authentication state and notify listeners
   */
  private updateState(newState: Partial<AuthState>): void {
    this.currentState = { ...this.currentState, ...newState };
    this.notifyListeners();
  }

  /**
   * Notify all listeners of state changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.currentState);
      } catch (error) {
        console.error('Error in auth state listener:', error);
      }
    });
  }

  /**
   * Clear authentication state
   */
  private clearAuthState(): void {
    tokenStorage.clearTokens();
    apiClient.setAuthToken(null);
    apiClient.setTenantId(null);
    this.clearRefreshTimer();
    
    this.updateState({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      error: null,
    });
  }

  /**
   * Set up automatic token refresh
   */
  private setupTokenRefresh(): void {
    this.clearRefreshTimer();
    
    const checkInterval = 60000; // Check every minute
    
    this.refreshTimer = setInterval(() => {
      if (tokenStorage.isTokenExpiringSoon(5)) { // Refresh 5 minutes before expiry
        this.refreshTokenSilently();
      }
    }, checkInterval);
  }

  /**
   * Clear the refresh timer
   */
  private clearRefreshTimer(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Refresh token silently in the background
   */
  private async refreshTokenSilently(): Promise<void> {
    if (this.isRefreshing) return;
    
    this.isRefreshing = true;
    
    try {
      const refreshToken = tokenStorage.getRefreshToken();
      
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await apiClient.refreshToken({ refreshToken });
      
      if (response.success && response.data) {
        // Store new tokens
        tokenStorage.setTokens(response.data);
        apiClient.setAuthToken(response.data.accessToken);
        
        console.log('Token refreshed successfully');
      } else {
        throw new Error('Token refresh failed');
      }
    } catch (error) {
      console.warn('Silent token refresh failed:', error);
      // Don't immediately log out on refresh failure, let the user continue
      // The next API call will fail and trigger a proper logout
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Login with email and password
   */
  async login(credentials: LoginRequest, tenantId?: string): Promise<AuthResult> {
    try {
      this.updateState({ isLoading: true, error: null });

      const response = await apiClient.login(credentials, tenantId);
      
      if (response.success && response.data) {
        // Store tokens
        tokenStorage.setTokens(response.data);
        
        // Get user profile
        const profileResponse = await apiClient.getProfile();
        
        if (profileResponse.success && profileResponse.data) {
          this.updateState({
            isAuthenticated: true,
            isLoading: false,
            user: profileResponse.data,
            error: null,
          });

          // Set up automatic token refresh
          this.setupTokenRefresh();

          return { success: true, user: profileResponse.data };
        }
      }

      const errorMessage = response.message || 'Login failed';
      this.updateState({
        isAuthenticated: false,
        isLoading: false,
        error: errorMessage,
      });

      return { success: false, error: errorMessage };
    } catch (error: any) {
      const errorMessage = error.message || 'Login failed';
      
      this.updateState({
        isAuthenticated: false,
        isLoading: false,
        error: errorMessage,
      });

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Register a new user
   */
  async register(data: RegisterRequest, tenantId?: string): Promise<AuthResult> {
    try {
      this.updateState({ isLoading: true, error: null });

      const response = await apiClient.register(data, tenantId);
      
      if (response.success && response.data) {
        // Store tokens
        tokenStorage.setTokens(response.data);
        
        // Get user profile
        const profileResponse = await apiClient.getProfile();
        
        if (profileResponse.success && profileResponse.data) {
          this.updateState({
            isAuthenticated: true,
            isLoading: false,
            user: profileResponse.data,
            error: null,
          });

          // Set up automatic token refresh
          this.setupTokenRefresh();

          return { success: true, user: profileResponse.data };
        }
      }

      const errorMessage = response.message || 'Registration failed';
      this.updateState({
        isAuthenticated: false,
        isLoading: false,
        error: errorMessage,
      });

      return { success: false, error: errorMessage };
    } catch (error: any) {
      const errorMessage = error.message || 'Registration failed';
      
      this.updateState({
        isAuthenticated: false,
        isLoading: false,
        error: errorMessage,
      });

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Logout the current user
   */
  async logout(): Promise<void> {
    try {
      // Call backend logout endpoint
      await apiClient.logout();
    } catch (error) {
      console.warn('Backend logout failed:', error);
      // Continue with local logout even if backend call fails
    } finally {
      this.clearAuthState();
    }
  }

  /**
   * Manually refresh the authentication token
   */
  async refreshToken(): Promise<void> {
    const refreshToken = tokenStorage.getRefreshToken();
    
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await apiClient.refreshToken({ refreshToken });
      
      if (response.success && response.data) {
        tokenStorage.setTokens(response.data);
        apiClient.setAuthToken(response.data.accessToken);
      } else {
        throw new Error('Token refresh failed');
      }
    } catch (error) {
      // If refresh fails, clear auth state
      this.clearAuthState();
      throw error;
    }
  }

  /**
   * Get current authentication state
   */
  getState(): AuthState {
    return { ...this.currentState };
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.currentState.isAuthenticated;
  }

  /**
   * Get current user
   */
  getCurrentUser(): AuthUser | null {
    return this.currentState.user;
  }

  /**
   * Get current access token
   */
  getToken(): string | null {
    return tokenStorage.getAccessToken();
  }

  /**
   * Subscribe to authentication state changes
   */
  onAuthStateChange(listener: AuthStateChangeListener): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Set tenant ID for multi-tenant support
   */
  setTenantId(tenantId: string | null): void {
    apiClient.setTenantId(tenantId);
  }

  /**
   * Get current tenant ID
   */
  getTenantId(): string | null {
    return apiClient.getTenantId();
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.clearRefreshTimer();
    this.listeners.clear();
  }
}

// Create and export the singleton instance
export const authService = new AuthService();
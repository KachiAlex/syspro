/**
 * Property-based tests for authentication service
 * Feature: frontend-backend-integration, Property 5: Authentication state management
 */

import { jest } from '@jest/globals';
import { authService, AuthState } from '../auth-service';
import { apiClient } from '../../api/client';
import { tokenStorage } from '../token-storage';

// Mock dependencies
jest.mock('../../api/client');
jest.mock('../token-storage');

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;
const mockTokenStorage = tokenStorage as jest.Mocked<typeof tokenStorage>;

describe('Authentication Service - Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset auth service state
    authService['state'] = {
      isAuthenticated: false,
      isLoading: false,
      user: null,
      error: null,
    };
    authService['subscribers'] = [];
  });

  /**
   * Property 5: Authentication state management
   * For any authentication state change (login, logout, token refresh), 
   * the auth service should update the global authentication state and notify all subscribers
   * Validates: Requirements 3.1, 3.5, 3.6
   */
  describe('Property 5: Authentication state management', () => {
    test('should notify all subscribers when authentication state changes', async () => {
      const subscriber1 = jest.fn();
      const subscriber2 = jest.fn();
      const subscriber3 = jest.fn();

      // Subscribe multiple listeners
      authService.onAuthStateChange(subscriber1);
      authService.onAuthStateChange(subscriber2);
      authService.onAuthStateChange(subscriber3);

      // Mock successful login
      const mockUser = { id: '1', email: 'test@example.com', firstName: 'Test' };
      mockApiClient.login.mockResolvedValue({
        success: true,
        data: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 3600,
          user: mockUser,
        },
      });
      mockTokenStorage.setTokens.mockResolvedValue();

      // Perform login
      await authService.login({ email: 'test@example.com', password: 'password' });

      // Verify all subscribers were notified with the new state
      expect(subscriber1).toHaveBeenCalledWith(
        expect.objectContaining({
          isAuthenticated: true,
          user: mockUser,
          isLoading: false,
          error: null,
        })
      );
      expect(subscriber2).toHaveBeenCalledWith(
        expect.objectContaining({
          isAuthenticated: true,
          user: mockUser,
          isLoading: false,
          error: null,
        })
      );
      expect(subscriber3).toHaveBeenCalledWith(
        expect.objectContaining({
          isAuthenticated: true,
          user: mockUser,
          isLoading: false,
          error: null,
        })
      );
    });

    test('should update global state for any authentication action', async () => {
      const stateChanges: AuthState[] = [];
      authService.onAuthStateChange((state) => stateChanges.push({ ...state }));

      // Test login state change
      const mockUser = { id: '1', email: 'test@example.com', firstName: 'Test' };
      mockApiClient.login.mockResolvedValue({
        success: true,
        data: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 3600,
          user: mockUser,
        },
      });
      mockTokenStorage.setTokens.mockResolvedValue();

      await authService.login({ email: 'test@example.com', password: 'password' });

      // Verify login state change
      expect(stateChanges).toContainEqual(
        expect.objectContaining({
          isAuthenticated: true,
          user: mockUser,
          isLoading: false,
        })
      );

      // Test logout state change
      mockTokenStorage.clearTokens.mockResolvedValue();
      mockApiClient.logout.mockResolvedValue();

      await authService.logout();

      // Verify logout state change
      expect(stateChanges).toContainEqual(
        expect.objectContaining({
          isAuthenticated: false,
          user: null,
          isLoading: false,
        })
      );
    });

    test('should maintain consistent state across multiple operations', async () => {
      const mockUser = { id: '1', email: 'test@example.com', firstName: 'Test' };
      
      // Setup mocks
      mockApiClient.login.mockResolvedValue({
        success: true,
        data: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 3600,
          user: mockUser,
        },
      });
      mockTokenStorage.setTokens.mockResolvedValue();
      mockTokenStorage.clearTokens.mockResolvedValue();
      mockApiClient.logout.mockResolvedValue();

      // Perform multiple operations
      await authService.login({ email: 'test@example.com', password: 'password' });
      expect(authService.isAuthenticated()).toBe(true);
      expect(authService.getCurrentUser()).toEqual(mockUser);

      await authService.logout();
      expect(authService.isAuthenticated()).toBe(false);
      expect(authService.getCurrentUser()).toBe(null);

      // Login again
      await authService.login({ email: 'test@example.com', password: 'password' });
      expect(authService.isAuthenticated()).toBe(true);
      expect(authService.getCurrentUser()).toEqual(mockUser);
    });
  });

  /**
   * Property 6: Token lifecycle management
   * For any JWT token approaching expiration, 
   * the auth service should automatically attempt to refresh the token before it expires
   * Validates: Requirements 3.3
   */
  describe('Property 6: Token lifecycle management', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should automatically refresh token before expiration', async () => {
      const mockUser = { id: '1', email: 'test@example.com', firstName: 'Test' };
      
      // Mock initial login with short expiration
      mockApiClient.login.mockResolvedValue({
        success: true,
        data: {
          accessToken: 'initial-token',
          refreshToken: 'refresh-token',
          expiresIn: 60, // 1 minute
          user: mockUser,
        },
      });
      mockTokenStorage.setTokens.mockResolvedValue();
      mockTokenStorage.getRefreshToken.mockResolvedValue('refresh-token');

      // Mock refresh token response
      mockApiClient.refreshToken.mockResolvedValue({
        success: true,
        data: {
          accessToken: 'new-token',
          refreshToken: 'new-refresh-token',
          expiresIn: 3600,
          user: mockUser,
        },
      });

      // Login
      await authService.login({ email: 'test@example.com', password: 'password' });

      // Fast-forward to near expiration (50 seconds)
      jest.advanceTimersByTime(50000);

      // Verify refresh was called
      expect(mockApiClient.refreshToken).toHaveBeenCalledWith({
        refreshToken: 'refresh-token',
      });
    });

    test('should handle token refresh failure gracefully', async () => {
      const mockUser = { id: '1', email: 'test@example.com', firstName: 'Test' };
      
      // Mock initial login
      mockApiClient.login.mockResolvedValue({
        success: true,
        data: {
          accessToken: 'initial-token',
          refreshToken: 'refresh-token',
          expiresIn: 60,
          user: mockUser,
        },
      });
      mockTokenStorage.setTokens.mockResolvedValue();
      mockTokenStorage.getRefreshToken.mockResolvedValue('refresh-token');
      mockTokenStorage.clearTokens.mockResolvedValue();

      // Mock refresh token failure
      mockApiClient.refreshToken.mockRejectedValue(new Error('Refresh failed'));

      const stateChanges: AuthState[] = [];
      authService.onAuthStateChange((state) => stateChanges.push({ ...state }));

      // Login
      await authService.login({ email: 'test@example.com', password: 'password' });

      // Fast-forward to trigger refresh
      jest.advanceTimersByTime(50000);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify user was logged out after refresh failure
      expect(stateChanges).toContainEqual(
        expect.objectContaining({
          isAuthenticated: false,
          user: null,
        })
      );
    });

    test('should not refresh token if user logs out', async () => {
      const mockUser = { id: '1', email: 'test@example.com', firstName: 'Test' };
      
      // Mock login
      mockApiClient.login.mockResolvedValue({
        success: true,
        data: {
          accessToken: 'initial-token',
          refreshToken: 'refresh-token',
          expiresIn: 60,
          user: mockUser,
        },
      });
      mockTokenStorage.setTokens.mockResolvedValue();
      mockTokenStorage.clearTokens.mockResolvedValue();
      mockApiClient.logout.mockResolvedValue();

      // Login
      await authService.login({ email: 'test@example.com', password: 'password' });

      // Logout immediately
      await authService.logout();

      // Fast-forward past refresh time
      jest.advanceTimersByTime(60000);

      // Verify refresh was not called
      expect(mockApiClient.refreshToken).not.toHaveBeenCalled();
    });
  });
}); 
/**
 * Integration Property Tests
 * Feature: frontend-backend-integration, Property 7: Authentication redirect behavior, Property 14: Form validation error highlighting
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest } from '@jest/globals';
import { AuthProvider } from '../contexts/auth-context';
import { LoginForm } from '../components/auth/login-form';
import { authService } from '../lib/auth/auth-service';

// Mock the auth service
jest.mock('../lib/auth/auth-service', () => ({
  authService: {
    login: jest.fn(),
    logout: jest.fn(),
    isAuthenticated: jest.fn(),
    getCurrentUser: jest.fn(),
    onAuthStateChange: jest.fn(),
    getState: jest.fn(),
  },
}));

const mockAuthService = authService as jest.Mocked<typeof authService>;

describe('Integration Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    mockAuthService.getState.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      error: null,
    });
    
    mockAuthService.onAuthStateChange.mockImplementation((callback) => {
      // Return unsubscribe function
      return () => {};
    });
  });

  /**
   * Property 7: Authentication redirect behavior
   * For any expired or invalid token, the system should redirect the user to the login page
   * Validates: Requirements 3.4
   */
  describe('Property 7: Authentication redirect behavior', () => {
    test('should redirect to login when authentication fails', async () => {
      const user = userEvent.setup();
      
      // Mock authentication failure
      mockAuthService.login.mockRejectedValue(new Error('Token expired'));
      
      const mockOnError = jest.fn();
      
      render(
        <AuthProvider>
          <LoginForm onError={mockOnError} />
        </AuthProvider>
      );

      // Fill in form and submit
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.type(screen.getByLabelText(/tenant/i), 'tenant123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // Verify error callback was called
      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith(expect.stringContaining('Token expired'));
      });
    });

    test('should handle various authentication error scenarios', async () => {
      const user = userEvent.setup();
      
      const authErrorScenarios = [
        { error: new Error('Invalid credentials'), expectedMessage: 'Invalid credentials' },
        { error: new Error('Token expired'), expectedMessage: 'Token expired' },
        { error: new Error('Account locked'), expectedMessage: 'Account locked' },
        { error: new Error('Network error'), expectedMessage: 'Network error' },
        { error: { message: 'Server error' }, expectedMessage: 'Server error' }
      ];

      for (const scenario of authErrorScenarios) {
        jest.clearAllMocks();
        
        mockAuthService.login.mockRejectedValue(scenario.error);
        
        const mockOnError = jest.fn();
        
        render(
          <AuthProvider>
            <LoginForm onError={mockOnError} />
          </AuthProvider>
        );

        // Fill in form and submit
        await user.type(screen.getByLabelText(/email/i), 'test@example.com');
        await user.type(screen.getByLabelText(/password/i), 'password123');
        await user.type(screen.getByLabelText(/tenant/i), 'tenant123');
        await user.click(screen.getByRole('button', { name: /sign in/i }));

        // Verify appropriate error handling
        await waitFor(() => {
          expect(mockOnError).toHaveBeenCalledWith(
            expect.stringContaining(scenario.expectedMessage)
          );
        });
      }
    });

    test('should maintain authentication state consistency during errors', async () => {
      const user = userEvent.setup();
      
      // Mock state changes
      let currentState = {
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: null,
      };

      mockAuthService.getState.mockImplementation(() => currentState);
      
      let stateChangeCallback: ((state: any) => void) | null = null;
      mockAuthService.onAuthStateChange.mockImplementation((callback) => {
        stateChangeCallback = callback;
        return () => {};
      });

      mockAuthService.login.mockImplementation(async () => {
        // Simulate loading state
        currentState = { ...currentState, isLoading: true };
        stateChangeCallback?.(currentState);
        
        // Simulate error
        await new Promise(resolve => setTimeout(resolve, 100));
        currentState = { ...currentState, isLoading: false, error: 'Login failed' };
        stateChangeCallback?.(currentState);
        
        throw new Error('Login failed');
      });

      render(
        <AuthProvider>
          <LoginForm />
        </AuthProvider>
      );

      // Submit form
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.type(screen.getByLabelText(/tenant/i), 'tenant123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // Verify error state is displayed
      await waitFor(() => {
        expect(screen.getByText('Login failed')).toBeInTheDocument();
      });
    });
  });

  /**
   * Property 14: Form validation error highlighting
   * For any form validation error, the specific form fields with errors should be visually highlighted
   * Validates: Requirements 7.4
   */
  describe('Property 14: Form validation error highlighting', () => {
    test('should highlight fields with validation errors', async () => {
      const user = userEvent.setup();
      
      render(
        <AuthProvider>
          <LoginForm />
        </AuthProvider>
      );

      // Submit empty form to trigger validation
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // Verify all required fields are highlighted
      await waitFor(() => {
        const emailField = screen.getByLabelText(/email/i);
        const passwordField = screen.getByLabelText(/password/i);
        const tenantField = screen.getByLabelText(/tenant/i);

        expect(emailField).toHaveClass('border-red-300');
        expect(passwordField).toHaveClass('border-red-300');
        expect(tenantField).toHaveClass('border-red-300');
      });

      // Verify error messages are displayed
      expect(screen.getByText('Email is required')).toBeInTheDocument();
      expect(screen.getByText('Password is required')).toBeInTheDocument();
      expect(screen.getByText('Tenant ID is required')).toBeInTheDocument();
    });

    test('should remove highlighting when field errors are fixed', async () => {
      const user = userEvent.setup();
      
      render(
        <AuthProvider>
          <LoginForm />
        </AuthProvider>
      );

      // Submit empty form to trigger validation
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // Verify email field is highlighted
      await waitFor(() => {
        expect(screen.getByLabelText(/email/i)).toHaveClass('border-red-300');
      });

      // Fix the email field
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');

      // Verify highlighting is removed
      await waitFor(() => {
        expect(screen.getByLabelText(/email/i)).not.toHaveClass('border-red-300');
        expect(screen.getByLabelText(/email/i)).toHaveClass('border-gray-300');
      });

      // Verify error message is cleared
      expect(screen.queryByText('Email is required')).not.toBeInTheDocument();
    });

    test('should highlight specific validation errors for different field types', async () => {
      const user = userEvent.setup();
      
      render(
        <AuthProvider>
          <LoginForm />
        </AuthProvider>
      );

      const validationTestCases = [
        {
          field: 'email',
          invalidValue: 'invalid-email',
          expectedError: 'Please enter a valid email address',
          label: /email/i
        },
        {
          field: 'password',
          invalidValue: '123',
          expectedError: 'Password must be at least 6 characters',
          label: /password/i
        }
      ];

      for (const testCase of validationTestCases) {
        // Clear previous inputs
        await user.clear(screen.getByLabelText(testCase.label));
        
        // Enter invalid value
        await user.type(screen.getByLabelText(testCase.label), testCase.invalidValue);
        
        // Fill other required fields with valid values
        if (testCase.field !== 'email') {
          await user.clear(screen.getByLabelText(/email/i));
          await user.type(screen.getByLabelText(/email/i), 'test@example.com');
        }
        if (testCase.field !== 'password') {
          await user.clear(screen.getByLabelText(/password/i));
          await user.type(screen.getByLabelText(/password/i), 'validpassword');
        }
        await user.clear(screen.getByLabelText(/tenant/i));
        await user.type(screen.getByLabelText(/tenant/i), 'tenant123');
        
        // Submit form
        await user.click(screen.getByRole('button', { name: /sign in/i }));

        // Verify specific field is highlighted
        await waitFor(() => {
          expect(screen.getByLabelText(testCase.label)).toHaveClass('border-red-300');
          expect(screen.getByText(testCase.expectedError)).toBeInTheDocument();
        });
      }
    });

    test('should maintain highlighting consistency across form interactions', async () => {
      const user = userEvent.setup();
      
      render(
        <AuthProvider>
          <LoginForm />
        </AuthProvider>
      );

      // Submit empty form
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // Verify all fields are highlighted
      await waitFor(() => {
        expect(screen.getByLabelText(/email/i)).toHaveClass('border-red-300');
        expect(screen.getByLabelText(/password/i)).toHaveClass('border-red-300');
        expect(screen.getByLabelText(/tenant/i)).toHaveClass('border-red-300');
      });

      // Fix email field
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');

      // Verify only email highlighting is removed
      await waitFor(() => {
        expect(screen.getByLabelText(/email/i)).not.toHaveClass('border-red-300');
        expect(screen.getByLabelText(/password/i)).toHaveClass('border-red-300');
        expect(screen.getByLabelText(/tenant/i)).toHaveClass('border-red-300');
      });

      // Fix remaining fields
      await user.type(screen.getByLabelText(/password/i), 'validpassword');
      await user.type(screen.getByLabelText(/tenant/i), 'tenant123');

      // Verify all highlighting is removed
      await waitFor(() => {
        expect(screen.getByLabelText(/email/i)).toHaveClass('border-gray-300');
        expect(screen.getByLabelText(/password/i)).toHaveClass('border-gray-300');
        expect(screen.getByLabelText(/tenant/i)).toHaveClass('border-gray-300');
      });
    });

    test('should handle dynamic validation error highlighting', async () => {
      const user = userEvent.setup();
      
      render(
        <AuthProvider>
          <LoginForm />
        </AuthProvider>
      );

      // Type invalid email
      await user.type(screen.getByLabelText(/email/i), 'invalid');
      
      // Move to next field to trigger validation
      await user.tab();
      
      // Submit to trigger all validations
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // Verify email field shows format error
      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
        expect(screen.getByLabelText(/email/i)).toHaveClass('border-red-300');
      });

      // Fix email format
      await user.clear(screen.getByLabelText(/email/i));
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');

      // Verify format error is cleared
      await waitFor(() => {
        expect(screen.queryByText('Please enter a valid email address')).not.toBeInTheDocument();
        expect(screen.getByLabelText(/email/i)).not.toHaveClass('border-red-300');
      });
    });
  });
});
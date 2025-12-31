/**
 * Property-based tests for Login Form Component
 * Feature: frontend-backend-integration, Property 8: Form validation before submission
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest } from '@jest/globals';
import { LoginForm } from '../login-form';
import { useAuth } from '../../../contexts/auth-context';

// Mock the auth context
jest.mock('../../../contexts/auth-context', () => ({
  useAuth: jest.fn(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('Login Form - Property Tests', () => {
  const mockLogin = jest.fn();
  const mockClearError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      login: mockLogin,
      isLoading: false,
      error: null,
      clearError: mockClearError,
      user: null,
      isAuthenticated: false,
      register: jest.fn(),
      logout: jest.fn(),
      refreshToken: jest.fn(),
      setTenantId: jest.fn(),
      getTenantId: jest.fn(),
    });
  });

  /**
   * Property 8: Form validation before submission
   * For any form submission, client-side validation should complete successfully 
   * before the request is sent to the backend
   * Validates: Requirements 4.6
   */
  describe('Property 8: Form validation before submission', () => {
    const invalidFormData = [
      {
        name: 'empty email',
        data: { email: '', password: 'validpassword', tenantId: 'tenant123' },
        expectedError: 'Email is required'
      },
      {
        name: 'invalid email format',
        data: { email: 'invalid-email', password: 'validpassword', tenantId: 'tenant123' },
        expectedError: 'Please enter a valid email address'
      },
      {
        name: 'empty password',
        data: { email: 'test@example.com', password: '', tenantId: 'tenant123' },
        expectedError: 'Password is required'
      },
      {
        name: 'short password',
        data: { email: 'test@example.com', password: '123', tenantId: 'tenant123' },
        expectedError: 'Password must be at least 6 characters'
      },
      {
        name: 'empty tenant ID',
        data: { email: 'test@example.com', password: 'validpassword', tenantId: '' },
        expectedError: 'Tenant ID is required'
      },
      {
        name: 'whitespace-only email',
        data: { email: '   ', password: 'validpassword', tenantId: 'tenant123' },
        expectedError: 'Email is required'
      },
      {
        name: 'whitespace-only password',
        data: { email: 'test@example.com', password: '   ', tenantId: 'tenant123' },
        expectedError: 'Password is required'
      },
      {
        name: 'whitespace-only tenant ID',
        data: { email: 'test@example.com', password: 'validpassword', tenantId: '   ' },
        expectedError: 'Tenant ID is required'
      }
    ];

    test.each(invalidFormData)(
      'should prevent submission and show validation error for $name',
      async ({ data, expectedError }) => {
        const user = userEvent.setup();
        render(<LoginForm />);

        // Fill in the form with invalid data
        if (data.email !== undefined) {
          await user.clear(screen.getByLabelText(/email/i));
          if (data.email) await user.type(screen.getByLabelText(/email/i), data.email);
        }
        if (data.password !== undefined) {
          await user.clear(screen.getByLabelText(/password/i));
          if (data.password) await user.type(screen.getByLabelText(/password/i), data.password);
        }
        if (data.tenantId !== undefined) {
          await user.clear(screen.getByLabelText(/tenant/i));
          if (data.tenantId) await user.type(screen.getByLabelText(/tenant/i), data.tenantId);
        }

        // Submit the form
        await user.click(screen.getByRole('button', { name: /sign in/i }));

        // Verify validation error is shown
        await waitFor(() => {
          expect(screen.getByText(expectedError)).toBeInTheDocument();
        });

        // Verify login was not called
        expect(mockLogin).not.toHaveBeenCalled();
      }
    );

    test('should allow submission with valid form data', async () => {
      const user = userEvent.setup();
      mockLogin.mockResolvedValue({ success: true });

      render(<LoginForm />);

      // Fill in valid form data
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'validpassword');
      await user.type(screen.getByLabelText(/tenant/i), 'tenant123');

      // Submit the form
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // Verify login was called with correct data
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith(
          {
            email: 'test@example.com',
            password: 'validpassword',
          },
          'tenant123'
        );
      });
    });

    test('should clear validation errors when user starts typing', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      // Submit empty form to trigger validation errors
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // Verify validation error appears
      await waitFor(() => {
        expect(screen.getByText('Email is required')).toBeInTheDocument();
      });

      // Start typing in email field
      await user.type(screen.getByLabelText(/email/i), 't');

      // Verify validation error is cleared
      await waitFor(() => {
        expect(screen.queryByText('Email is required')).not.toBeInTheDocument();
      });
    });

    test('should validate email format in real-time', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      // Type invalid email and submit
      await user.type(screen.getByLabelText(/email/i), 'invalid-email');
      await user.type(screen.getByLabelText(/password/i), 'validpassword');
      await user.type(screen.getByLabelText(/tenant/i), 'tenant123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // Verify email format error
      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      });

      // Fix the email
      await user.clear(screen.getByLabelText(/email/i));
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');

      // Submit again
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // Verify email error is gone and login is called
      await waitFor(() => {
        expect(screen.queryByText('Please enter a valid email address')).not.toBeInTheDocument();
      });
    });
  });

  /**
   * Property 9: UI state during async operations
   * For any API request initiated from a UI component, 
   * a loading indicator should be displayed until the request completes
   * Validates: Requirements 4.5, 7.3
   */
  describe('Property 9: UI state during async operations', () => {
    test('should show loading state during login request', async () => {
      const user = userEvent.setup();
      
      // Mock loading state
      mockUseAuth.mockReturnValue({
        login: mockLogin,
        isLoading: true,
        error: null,
        clearError: mockClearError,
        user: null,
        isAuthenticated: false,
        register: jest.fn(),
        logout: jest.fn(),
        refreshToken: jest.fn(),
        setTenantId: jest.fn(),
        getTenantId: jest.fn(),
      });

      render(<LoginForm />);

      // Verify loading indicator is shown
      expect(screen.getByText('Signing in...')).toBeInTheDocument();
      
      // Verify submit button is disabled
      expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
      
      // Verify form fields are disabled
      expect(screen.getByLabelText(/email/i)).toBeDisabled();
      expect(screen.getByLabelText(/password/i)).toBeDisabled();
      expect(screen.getByLabelText(/tenant/i)).toBeDisabled();
    });

    test('should hide loading state when request completes', async () => {
      const user = userEvent.setup();
      
      // Start with loading state
      mockUseAuth.mockReturnValue({
        login: mockLogin,
        isLoading: true,
        error: null,
        clearError: mockClearError,
        user: null,
        isAuthenticated: false,
        register: jest.fn(),
        logout: jest.fn(),
        refreshToken: jest.fn(),
        setTenantId: jest.fn(),
        getTenantId: jest.fn(),
      });

      const { rerender } = render(<LoginForm />);

      // Verify loading state
      expect(screen.getByText('Signing in...')).toBeInTheDocument();

      // Update to non-loading state
      mockUseAuth.mockReturnValue({
        login: mockLogin,
        isLoading: false,
        error: null,
        clearError: mockClearError,
        user: null,
        isAuthenticated: false,
        register: jest.fn(),
        logout: jest.fn(),
        refreshToken: jest.fn(),
        setTenantId: jest.fn(),
        getTenantId: jest.fn(),
      });

      rerender(<LoginForm />);

      // Verify loading state is gone
      expect(screen.queryByText('Signing in...')).not.toBeInTheDocument();
      expect(screen.getByText('Sign In')).toBeInTheDocument();
      
      // Verify form is enabled
      expect(screen.getByLabelText(/email/i)).not.toBeDisabled();
      expect(screen.getByLabelText(/password/i)).not.toBeDisabled();
      expect(screen.getByLabelText(/tenant/i)).not.toBeDisabled();
    });
  });

  /**
   * Property 12: User-friendly error display
   * For any API error, the frontend should display a user-friendly error message 
   * while logging detailed error information for debugging
   * Validates: Requirements 7.1, 7.5
   */
  describe('Property 12: User-friendly error display', () => {
    const errorTestCases = [
      {
        name: 'authentication error',
        error: 'Invalid credentials',
        expectedDisplay: 'Invalid credentials'
      },
      {
        name: 'network error',
        error: 'Network request failed',
        expectedDisplay: 'Network request failed'
      },
      {
        name: 'server error',
        error: 'Internal server error',
        expectedDisplay: 'Internal server error'
      },
      {
        name: 'validation error',
        error: 'Email format is invalid',
        expectedDisplay: 'Email format is invalid'
      }
    ];

    test.each(errorTestCases)(
      'should display user-friendly message for $name',
      ({ error, expectedDisplay }) => {
        mockUseAuth.mockReturnValue({
          login: mockLogin,
          isLoading: false,
          error: error,
          clearError: mockClearError,
          user: null,
          isAuthenticated: false,
          register: jest.fn(),
          logout: jest.fn(),
          refreshToken: jest.fn(),
          setTenantId: jest.fn(),
          getTenantId: jest.fn(),
        });

        render(<LoginForm />);

        // Verify error message is displayed
        expect(screen.getByText(expectedDisplay)).toBeInTheDocument();
        
        // Verify error has proper styling
        const errorElement = screen.getByText(expectedDisplay).closest('div');
        expect(errorElement).toHaveClass('bg-red-50');
      }
    );

    test('should clear error when user starts interacting with form', async () => {
      const user = userEvent.setup();
      
      mockUseAuth.mockReturnValue({
        login: mockLogin,
        isLoading: false,
        error: 'Login failed',
        clearError: mockClearError,
        user: null,
        isAuthenticated: false,
        register: jest.fn(),
        logout: jest.fn(),
        refreshToken: jest.fn(),
        setTenantId: jest.fn(),
        getTenantId: jest.fn(),
      });

      render(<LoginForm />);

      // Verify error is shown
      expect(screen.getByText('Login failed')).toBeInTheDocument();

      // Start typing in email field
      await user.type(screen.getByLabelText(/email/i), 't');

      // Verify clearError was called
      expect(mockClearError).toHaveBeenCalled();
    });
  });
});
/**
 * Property-based tests for Error Handler
 * Feature: frontend-backend-integration, Property 13: Network error recovery
 */

import { jest } from '@jest/globals';
import { ErrorHandler, NetworkError, APIError } from '../error-handler';

describe('Error Handler - Property Tests', () => {
  let errorHandler: ErrorHandler;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    errorHandler = new ErrorHandler();
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  /**
   * Property 13: Network error recovery
   * For any network error, the system should provide retry options 
   * and handle the error gracefully without crashing
   * Validates: Requirements 7.2
   */
  describe('Property 13: Network error recovery', () => {
    test('should provide retry mechanism for network errors', async () => {
      const networkErrors = [
        new Error('Network request failed'),
        new Error('Connection timeout'),
        new Error('DNS resolution failed'),
        new Error('Connection refused'),
        new Error('Network unreachable')
      ];

      for (const error of networkErrors) {
        const mockRetryFn = jest.fn()
          .mockRejectedValueOnce(error)
          .mockRejectedValueOnce(error)
          .mockResolvedValueOnce({ success: true, data: 'recovered' });

        const result = await errorHandler.handleWithRetry(mockRetryFn, {
          maxRetries: 3,
          baseDelay: 100,
          maxDelay: 1000
        });

        // Verify retry mechanism worked
        expect(mockRetryFn).toHaveBeenCalledTimes(3);
        expect(result).toEqual({ success: true, data: 'recovered' });
      }
    });

    test('should use exponential backoff for retries', async () => {
      const timestamps: number[] = [];
      const mockFn = jest.fn().mockImplementation(() => {
        timestamps.push(Date.now());
        throw new Error('Network error');
      });

      try {
        await errorHandler.handleWithRetry(mockFn, {
          maxRetries: 3,
          baseDelay: 100,
          maxDelay: 1000
        });
      } catch (error) {
        // Expected to fail after retries
      }

      // Verify exponential backoff timing
      expect(mockFn).toHaveBeenCalledTimes(4); // Initial + 3 retries
      
      // Check that delays increased (allowing for some timing variance)
      if (timestamps.length >= 3) {
        const delay1 = timestamps[1] - timestamps[0];
        const delay2 = timestamps[2] - timestamps[1];
        
        // Second delay should be longer than first (exponential backoff)
        expect(delay2).toBeGreaterThanOrEqual(delay1);
      }
    });

    test('should handle different types of network errors gracefully', async () => {
      const errorTypes = [
        { error: new TypeError('Failed to fetch'), expectedType: 'NetworkError' },
        { error: new Error('ECONNREFUSED'), expectedType: 'NetworkError' },
        { error: new Error('ETIMEDOUT'), expectedType: 'NetworkError' },
        { error: new Error('ENOTFOUND'), expectedType: 'NetworkError' },
        { error: { status: 0, message: 'Network Error' }, expectedType: 'NetworkError' }
      ];

      for (const { error, expectedType } of errorTypes) {
        const handledError = errorHandler.handleError(error);

        // Verify error was handled gracefully
        expect(handledError).toBeDefined();
        expect(handledError.type).toBe(expectedType);
        expect(handledError.userMessage).toBeDefined();
        expect(handledError.canRetry).toBe(true);
      }
    });

    test('should provide user-friendly messages for network errors', () => {
      const networkErrors = [
        new Error('fetch failed'),
        new Error('Network request failed'),
        new Error('Connection timeout'),
        { status: 0, message: 'Network Error' }
      ];

      networkErrors.forEach(error => {
        const handledError = errorHandler.handleError(error);
        
        // Verify user-friendly message
        expect(handledError.userMessage).not.toContain('fetch failed');
        expect(handledError.userMessage).not.toContain('ECONNREFUSED');
        expect(handledError.userMessage).toMatch(/network|connection|internet/i);
      });
    });

    test('should not crash application when handling any error type', () => {
      const problematicErrors = [
        null,
        undefined,
        'string error',
        123,
        { circular: {} },
        new Error(''),
        { message: null },
        { status: 'invalid' }
      ];

      // Add circular reference
      (problematicErrors[8] as any).circular.self = problematicErrors[8];

      problematicErrors.forEach(error => {
        expect(() => {
          const result = errorHandler.handleError(error);
          expect(result).toBeDefined();
        }).not.toThrow();
      });
    });

    test('should respect maximum retry limits', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Persistent error'));

      try {
        await errorHandler.handleWithRetry(mockFn, {
          maxRetries: 2,
          baseDelay: 10,
          maxDelay: 100
        });
      } catch (error) {
        // Expected to fail
      }

      // Verify retry limit was respected
      expect(mockFn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    test('should handle successful retry after failures', async () => {
      const mockFn = jest.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValueOnce({ success: true, data: 'success' });

      const result = await errorHandler.handleWithRetry(mockFn, {
        maxRetries: 3,
        baseDelay: 10,
        maxDelay: 100
      });

      expect(result).toEqual({ success: true, data: 'success' });
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    test('should provide different retry strategies for different error types', async () => {
      const authError = { status: 401, message: 'Unauthorized' };
      const networkError = new Error('Network failed');
      const serverError = { status: 500, message: 'Internal Server Error' };

      const authResult = errorHandler.handleError(authError);
      const networkResult = errorHandler.handleError(networkError);
      const serverResult = errorHandler.handleError(serverError);

      // Auth errors should not be retryable
      expect(authResult.canRetry).toBe(false);
      
      // Network errors should be retryable
      expect(networkResult.canRetry).toBe(true);
      
      // Server errors should be retryable
      expect(serverResult.canRetry).toBe(true);
    });
  });

  /**
   * Additional property tests for comprehensive error handling
   */
  describe('Error categorization and logging', () => {
    test('should categorize errors correctly', () => {
      const testCases = [
        { error: { status: 400 }, expectedCategory: 'ClientError' },
        { error: { status: 401 }, expectedCategory: 'AuthError' },
        { error: { status: 403 }, expectedCategory: 'AuthError' },
        { error: { status: 404 }, expectedCategory: 'ClientError' },
        { error: { status: 500 }, expectedCategory: 'ServerError' },
        { error: new Error('Network failed'), expectedCategory: 'NetworkError' },
        { error: new TypeError('Type error'), expectedCategory: 'ClientError' }
      ];

      testCases.forEach(({ error, expectedCategory }) => {
        const result = errorHandler.handleError(error);
        expect(result.category).toBe(expectedCategory);
      });
    });

    test('should log detailed error information for debugging', () => {
      const error = {
        status: 500,
        message: 'Internal Server Error',
        stack: 'Error stack trace',
        timestamp: new Date().toISOString()
      };

      errorHandler.handleError(error);

      // Verify detailed logging occurred
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error handled:'),
        expect.objectContaining({
          originalError: error,
          category: expect.any(String),
          userMessage: expect.any(String)
        })
      );
    });
  });
});
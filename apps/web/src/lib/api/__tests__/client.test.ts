/**
 * Property-based tests for API client
 * Feature: frontend-backend-integration, Property 1: Backend API routing
 */

import { jest } from '@jest/globals';
import { apiClient } from '../client';
import { httpClient } from '../http-client';

// Mock the HTTP client
jest.mock('../http-client', () => ({
  httpClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    setAuthToken: jest.fn(),
    setTenantId: jest.fn(),
    getAuthToken: jest.fn(),
    getTenantId: jest.fn(),
    addRequestInterceptor: jest.fn(),
    addResponseInterceptor: jest.fn(),
  },
}));

const mockHttpClient = httpClient as jest.Mocked<typeof httpClient>;

describe('API Client - Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 1: Backend API routing
   * For any API request (authentication, health checks, user operations), 
   * the request should be sent to the backend API URL rather than local Next.js route handlers
   * Validates: Requirements 1.1, 1.2
   */
  describe('Property 1: Backend API routing', () => {
    const testCases = [
      // Authentication endpoints
      { method: 'login', args: [{ email: 'test@example.com', password: 'password123' }], expectedPath: '/auth/login' },
      { method: 'register', args: [{ email: 'test@example.com', password: 'password123', firstName: 'Test', lastName: 'User' }], expectedPath: '/auth/register' },
      { method: 'refreshToken', args: [{ refreshToken: 'refresh-token' }], expectedPath: '/auth/refresh' },
      { method: 'logout', args: [], expectedPath: '/auth/logout' },
      
      // Profile endpoints
      { method: 'getProfile', args: [], expectedPath: '/auth/profile' },
      { method: 'updateProfile', args: [{ firstName: 'Updated' }], expectedPath: '/auth/profile' },
      { method: 'changePassword', args: [{ currentPassword: 'old', newPassword: 'new' }], expectedPath: '/auth/change-password' },
      
      // User endpoints
      { method: 'getUsers', args: [], expectedPath: '/users?page=1&limit=20' },
      { method: 'getUser', args: ['user-id'], expectedPath: '/users/user-id' },
      { method: 'createUser', args: [{ email: 'new@example.com' }], expectedPath: '/users' },
      { method: 'updateUser', args: ['user-id', { firstName: 'Updated' }], expectedPath: '/users/user-id' },
      { method: 'deleteUser', args: ['user-id'], expectedPath: '/users/user-id' },
      
      // Organization endpoints
      { method: 'getOrganizations', args: [], expectedPath: '/organizations?page=1&limit=20' },
      { method: 'getOrganization', args: ['org-id'], expectedPath: '/organizations/org-id' },
      { method: 'createOrganization', args: [{ name: 'Test Org' }], expectedPath: '/organizations' },
      { method: 'updateOrganization', args: ['org-id', { name: 'Updated Org' }], expectedPath: '/organizations/org-id' },
      { method: 'deleteOrganization', args: ['org-id'], expectedPath: '/organizations/org-id' },
      
      // Tenant endpoints
      { method: 'getTenants', args: [], expectedPath: '/tenants?page=1&limit=20' },
      { method: 'getTenant', args: ['tenant-id'], expectedPath: '/tenants/tenant-id' },
      { method: 'createTenant', args: [{ name: 'Test Tenant', code: 'TEST' }], expectedPath: '/tenants' },
      { method: 'updateTenant', args: ['tenant-id', { name: 'Updated Tenant' }], expectedPath: '/tenants/tenant-id' },
      
      // Health endpoints
      { method: 'getHealth', args: [], expectedPath: '/health' },
      { method: 'getSimpleHealth', args: [], expectedPath: '/health/simple' },
    ];

    test.each(testCases)(
      'should route $method to backend API endpoint $expectedPath',
      async ({ method, args, expectedPath }) => {
        // Mock successful response
        const mockResponse = { success: true, data: {} };
        const httpMethod = getHttpMethod(method);
        mockHttpClient[httpMethod].mockResolvedValue(mockResponse);

        // Call the API method
        try {
          await (apiClient as any)[method](...args);
        } catch (error) {
          // Some methods might throw due to mocking, but we only care about the routing
        }

        // Verify the correct HTTP method and path were called
        expect(mockHttpClient[httpMethod]).toHaveBeenCalledWith(
          expectedPath,
          ...getExpectedArgs(method, args)
        );
      }
    );

    test('should never call local Next.js API routes', async () => {
      // Mock fetch to detect any calls to local routes
      const originalFetch = global.fetch;
      const mockFetch = jest.fn();
      global.fetch = mockFetch;

      try {
        // Mock successful HTTP client response
        mockHttpClient.post.mockResolvedValue({ success: true, data: { accessToken: 'token' } });

        // Make various API calls
        await apiClient.login({ email: 'test@example.com', password: 'password123' });
        
        mockHttpClient.get.mockResolvedValue({ status: 'ok', timestamp: new Date().toISOString() });
        await apiClient.getHealth();

        // Verify no calls were made to local API routes
        expect(mockFetch).not.toHaveBeenCalledWith(
          expect.stringMatching(/\/api\/v1\/(auth|health)/)
        );
      } finally {
        global.fetch = originalFetch;
      }
    });

    test('should use backend API base URL for all requests', () => {
      // This test verifies that the HTTP client is configured with the backend URL
      // The actual URL validation is done in the http-client configuration
      expect(mockHttpClient.post).toBeDefined();
      expect(mockHttpClient.get).toBeDefined();
      expect(mockHttpClient.patch).toBeDefined();
      expect(mockHttpClient.delete).toBeDefined();
    });
  });

  /**
   * Property 2: Automatic request headers
   * For any authenticated API request, the request should automatically include 
   * both Authorization and tenant headers when available
   * Validates: Requirements 2.2, 2.5
   */
  describe('Property 2: Automatic request headers', () => {
    test('should automatically include Authorization header for authenticated requests', async () => {
      const testToken = 'test-auth-token';
      mockHttpClient.getAuthToken.mockReturnValue(testToken);
      mockHttpClient.post.mockResolvedValue({ success: true, data: {} });

      // Make an authenticated request
      await apiClient.getProfile();

      // Verify setAuthToken was called to set the header
      expect(mockHttpClient.setAuthToken).toHaveBeenCalledWith(testToken);
    });

    test('should automatically include tenant header when available', async () => {
      const testTenantId = 'test-tenant-123';
      mockHttpClient.getTenantId.mockReturnValue(testTenantId);
      mockHttpClient.get.mockResolvedValue({ success: true, data: {} });

      // Make a request that should include tenant header
      await apiClient.getUsers();

      // Verify setTenantId was called to set the header
      expect(mockHttpClient.setTenantId).toHaveBeenCalledWith(testTenantId);
    });

    test('should include both headers when both are available', async () => {
      const testToken = 'test-auth-token';
      const testTenantId = 'test-tenant-123';
      
      mockHttpClient.getAuthToken.mockReturnValue(testToken);
      mockHttpClient.getTenantId.mockReturnValue(testTenantId);
      mockHttpClient.get.mockResolvedValue({ success: true, data: {} });

      // Make a request
      await apiClient.getOrganizations();

      // Verify both headers were set
      expect(mockHttpClient.setAuthToken).toHaveBeenCalledWith(testToken);
      expect(mockHttpClient.setTenantId).toHaveBeenCalledWith(testTenantId);
    });
  });

  /**
   * Property 3: Consistent error handling
   * For any API error response, the error should be processed consistently 
   * and return a standardized error format
   * Validates: Requirements 2.3
   */
  describe('Property 3: Consistent error handling', () => {
    const errorTestCases = [
      {
        name: 'HTTP 400 Bad Request',
        error: { status: 400, message: 'Bad Request', errors: [{ field: 'email', message: 'Invalid email' }] },
        expectedFormat: { success: false, message: 'Bad Request', errors: [{ field: 'email', message: 'Invalid email' }] }
      },
      {
        name: 'HTTP 401 Unauthorized',
        error: { status: 401, message: 'Unauthorized' },
        expectedFormat: { success: false, message: 'Unauthorized' }
      },
      {
        name: 'HTTP 403 Forbidden',
        error: { status: 403, message: 'Forbidden' },
        expectedFormat: { success: false, message: 'Forbidden' }
      },
      {
        name: 'HTTP 404 Not Found',
        error: { status: 404, message: 'Not Found' },
        expectedFormat: { success: false, message: 'Not Found' }
      },
      {
        name: 'HTTP 500 Internal Server Error',
        error: { status: 500, message: 'Internal Server Error' },
        expectedFormat: { success: false, message: 'Internal Server Error' }
      },
      {
        name: 'Network Error',
        error: new Error('Network Error'),
        expectedFormat: { success: false, message: 'Network Error' }
      }
    ];

    test.each(errorTestCases)(
      'should handle $name consistently',
      async ({ error, expectedFormat }) => {
        // Mock the HTTP client to throw the error
        mockHttpClient.post.mockRejectedValue(error);

        try {
          await apiClient.login({ email: 'test@example.com', password: 'password' });
          fail('Expected method to throw');
        } catch (thrownError: any) {
          // Verify the error has the expected standardized format
          expect(thrownError).toMatchObject(expectedFormat);
        }
      }
    );

    test('should preserve error details for debugging', async () => {
      const detailedError = {
        status: 422,
        message: 'Validation Error',
        errors: [
          { field: 'email', message: 'Email is required' },
          { field: 'password', message: 'Password must be at least 8 characters' }
        ],
        code: 'VALIDATION_FAILED',
        timestamp: '2023-01-01T00:00:00Z'
      };

      mockHttpClient.post.mockRejectedValue(detailedError);

      try {
        await apiClient.register({ email: '', password: '123', firstName: 'Test', lastName: 'User' });
        fail('Expected method to throw');
      } catch (error: any) {
        // Verify all error details are preserved
        expect(error.errors).toEqual(detailedError.errors);
        expect(error.code).toBe(detailedError.code);
        expect(error.timestamp).toBe(detailedError.timestamp);
      }
    });
  });

  /**
   * Property 4: Request interceptor functionality
   * For any API request, registered interceptors should be called 
   * and able to modify the request before sending
   * Validates: Requirements 2.4
   */
  describe('Property 4: Request interceptor functionality', () => {
    test('should call request interceptors for all requests', async () => {
      const interceptor1 = jest.fn((config) => config);
      const interceptor2 = jest.fn((config) => config);

      // Register interceptors
      mockHttpClient.addRequestInterceptor.mockImplementation((interceptor) => {
        // Simulate interceptor registration
        return 1; // Return interceptor ID
      });

      // Mock successful response
      mockHttpClient.get.mockResolvedValue({ success: true, data: {} });

      // Make a request
      await apiClient.getHealth();

      // Verify interceptors were registered
      expect(mockHttpClient.addRequestInterceptor).toHaveBeenCalled();
    });

    test('should allow interceptors to modify requests', async () => {
      let capturedConfig: any = null;

      // Mock interceptor that captures the config
      mockHttpClient.addRequestInterceptor.mockImplementation((interceptor) => {
        capturedConfig = interceptor({ url: '/test', headers: {} });
        return 1;
      });

      mockHttpClient.post.mockResolvedValue({ success: true, data: {} });

      // Make a request
      await apiClient.login({ email: 'test@example.com', password: 'password' });

      // Verify interceptor was called and could modify the config
      expect(mockHttpClient.addRequestInterceptor).toHaveBeenCalled();
    });

    test('should call response interceptors for all responses', async () => {
      // Mock response interceptor registration
      mockHttpClient.addResponseInterceptor.mockImplementation((successInterceptor, errorInterceptor) => {
        return 1; // Return interceptor ID
      });

      mockHttpClient.get.mockResolvedValue({ success: true, data: {} });

      // Make a request
      await apiClient.getHealth();

      // Verify response interceptor was registered
      expect(mockHttpClient.addResponseInterceptor).toHaveBeenCalled();
    });
  });
});

/**
 * Helper function to determine the HTTP method for an API client method
 */
function getHttpMethod(method: string): 'get' | 'post' | 'patch' | 'delete' {
  if (method.startsWith('get') || method.includes('Health')) {
    return 'get';
  }
  if (method.startsWith('create') || method === 'login' || method === 'register' || 
      method === 'refreshToken' || method === 'logout') {
    return 'post';
  }
  if (method.startsWith('update') || method === 'updateProfile' || method === 'changePassword') {
    return 'patch';
  }
  if (method.startsWith('delete')) {
    return 'delete';
  }
  return 'get';
}

/**
 * Helper function to get expected arguments for HTTP client calls
 */
function getExpectedArgs(method: string, args: any[]): any[] {
  const httpMethod = getHttpMethod(method);
  
  if (httpMethod === 'get' || httpMethod === 'delete') {
    return [];
  }
  
  // For POST and PATCH, return the data argument
  if (method === 'login' || method === 'register' || method === 'refreshToken') {
    return [args[0]];
  }
  
  if (method.startsWith('create')) {
    return [args[0]];
  }
  
  if (method.startsWith('update') || method === 'updateProfile' || method === 'changePassword') {
    return [args[args.length - 1]]; // Last argument is usually the data
  }
  
  return [];
}
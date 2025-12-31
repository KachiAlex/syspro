/**
 * API module exports
 * Centralized exports for all API-related functionality
 */

// Export the main API client
export { apiClient, ApiClient } from './client';

// Export HTTP client for advanced usage
export { httpClient, HttpClient } from './http-client';

// Export types
export type {
  LoginRequest,
  RegisterRequest,
  RefreshTokenRequest,
  ChangePasswordRequest,
  UpdateProfileRequest,
  HealthStatus,
} from './client';

export type {
  HttpClientConfig,
  RequestInterceptor,
  ResponseInterceptor,
} from './http-client';

// Export custom error types
export { ApiError, NetworkError } from './http-client';
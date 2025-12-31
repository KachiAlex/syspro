/**
 * API Client - Centralized interface for all backend communication
 * Provides typed methods for all backend endpoints
 */

import { httpClient } from './http-client';
import { 
  ApiResponse, 
  AuthTokens, 
  AuthUser,
  User,
  Organization,
  Tenant
} from '@syspro/shared';

// Request/Response types for API endpoints
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  avatar?: string;
}

export interface HealthStatus {
  status: string;
  timestamp: string;
  uptime?: number;
  version?: string;
  info?: Record<string, any>;
  error?: Record<string, any>;
  details?: Record<string, any>;
}

/**
 * API Client class providing typed methods for all backend endpoints
 */
export class ApiClient {
  // Authentication endpoints
  async login(credentials: LoginRequest, tenantId?: string): Promise<ApiResponse<AuthTokens>> {
    // Set tenant ID if provided
    if (tenantId) {
      httpClient.setTenantId(tenantId);
    }

    const response = await httpClient.post<ApiResponse<AuthTokens>>('/auth/login', credentials);
    
    // Store the auth token for subsequent requests
    if (response.success && response.data?.accessToken) {
      httpClient.setAuthToken(response.data.accessToken);
    }

    return response;
  }

  async register(data: RegisterRequest, tenantId?: string): Promise<ApiResponse<AuthTokens>> {
    // Set tenant ID if provided
    if (tenantId) {
      httpClient.setTenantId(tenantId);
    }

    const response = await httpClient.post<ApiResponse<AuthTokens>>('/auth/register', data);
    
    // Store the auth token for subsequent requests
    if (response.success && response.data?.accessToken) {
      httpClient.setAuthToken(response.data.accessToken);
    }

    return response;
  }

  async refreshToken(refreshTokenData: RefreshTokenRequest): Promise<ApiResponse<AuthTokens>> {
    const response = await httpClient.post<ApiResponse<AuthTokens>>('/auth/refresh', refreshTokenData);
    
    // Update the auth token
    if (response.success && response.data?.accessToken) {
      httpClient.setAuthToken(response.data.accessToken);
    }

    return response;
  }

  async logout(): Promise<ApiResponse> {
    const response = await httpClient.post<ApiResponse>('/auth/logout');
    
    // Clear stored tokens
    httpClient.setAuthToken(null);
    httpClient.setTenantId(null);

    return response;
  }

  // User profile endpoints
  async getProfile(): Promise<ApiResponse<AuthUser>> {
    return httpClient.get<ApiResponse<AuthUser>>('/auth/profile');
  }

  async updateProfile(data: UpdateProfileRequest): Promise<ApiResponse<AuthUser>> {
    return httpClient.patch<ApiResponse<AuthUser>>('/auth/profile', data);
  }

  async changePassword(data: ChangePasswordRequest): Promise<ApiResponse> {
    return httpClient.patch<ApiResponse>('/auth/change-password', data);
  }

  // User management endpoints
  async getUsers(page = 1, limit = 20): Promise<ApiResponse<User[]>> {
    return httpClient.get<ApiResponse<User[]>>(`/users?page=${page}&limit=${limit}`);
  }

  async getUser(userId: string): Promise<ApiResponse<User>> {
    return httpClient.get<ApiResponse<User>>(`/users/${userId}`);
  }

  async createUser(userData: Partial<User>): Promise<ApiResponse<User>> {
    return httpClient.post<ApiResponse<User>>('/users', userData);
  }

  async updateUser(userId: string, userData: Partial<User>): Promise<ApiResponse<User>> {
    return httpClient.patch<ApiResponse<User>>(`/users/${userId}`, userData);
  }

  async deleteUser(userId: string): Promise<ApiResponse> {
    return httpClient.delete<ApiResponse>(`/users/${userId}`);
  }

  // Organization endpoints
  async getOrganizations(page = 1, limit = 20): Promise<ApiResponse<Organization[]>> {
    return httpClient.get<ApiResponse<Organization[]>>(`/organizations?page=${page}&limit=${limit}`);
  }

  async getOrganization(orgId: string): Promise<ApiResponse<Organization>> {
    return httpClient.get<ApiResponse<Organization>>(`/organizations/${orgId}`);
  }

  async createOrganization(orgData: Partial<Organization>): Promise<ApiResponse<Organization>> {
    return httpClient.post<ApiResponse<Organization>>('/organizations', orgData);
  }

  async updateOrganization(orgId: string, orgData: Partial<Organization>): Promise<ApiResponse<Organization>> {
    return httpClient.patch<ApiResponse<Organization>>(`/organizations/${orgId}`, orgData);
  }

  async deleteOrganization(orgId: string): Promise<ApiResponse> {
    return httpClient.delete<ApiResponse>(`/organizations/${orgId}`);
  }

  // Tenant endpoints
  async getTenants(page = 1, limit = 20): Promise<ApiResponse<Tenant[]>> {
    return httpClient.get<ApiResponse<Tenant[]>>(`/tenants?page=${page}&limit=${limit}`);
  }

  async getTenant(tenantId: string): Promise<ApiResponse<Tenant>> {
    return httpClient.get<ApiResponse<Tenant>>(`/tenants/${tenantId}`);
  }

  async createTenant(tenantData: Partial<Tenant>): Promise<ApiResponse<Tenant>> {
    return httpClient.post<ApiResponse<Tenant>>('/tenants', tenantData);
  }

  async updateTenant(tenantId: string, tenantData: Partial<Tenant>): Promise<ApiResponse<Tenant>> {
    return httpClient.patch<ApiResponse<Tenant>>(`/tenants/${tenantId}`, tenantData);
  }

  // Health check endpoints
  async getHealth(): Promise<HealthStatus> {
    return httpClient.get<HealthStatus>('/health');
  }

  async getSimpleHealth(): Promise<HealthStatus> {
    return httpClient.get<HealthStatus>('/health/simple');
  }

  // Utility methods for token and tenant management
  setAuthToken(token: string | null): void {
    httpClient.setAuthToken(token);
  }

  setTenantId(tenantId: string | null): void {
    httpClient.setTenantId(tenantId);
  }

  getAuthToken(): string | null {
    return httpClient.getAuthToken();
  }

  getTenantId(): string | null {
    return httpClient.getTenantId();
  }

  // Add custom interceptors
  addRequestInterceptor(interceptor: any): number {
    return httpClient.addRequestInterceptor(interceptor);
  }

  addResponseInterceptor(interceptor: any): number {
    return httpClient.addResponseInterceptor(interceptor);
  }
}

// Create and export the default API client instance
export const apiClient = new ApiClient();

// Types are already exported above as interfaces
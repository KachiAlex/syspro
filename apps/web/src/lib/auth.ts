import { AuthTokens, AuthUser } from '@syspro/shared';
import { apiClient } from './api';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

class AuthService {
  async login(credentials: LoginCredentials, tenantId: string): Promise<AuthTokens> {
    // Set tenant ID before making the request
    apiClient.setTenantId(tenantId);
    
    const response = await apiClient.post<AuthTokens>('/api/v1/auth/login', credentials);
    
    if (response.success && response.data) {
      apiClient.setTokens(response.data);
      return response.data;
    }
    
    throw new Error(response.message || 'Login failed');
  }

  async register(data: RegisterData, tenantId: string): Promise<AuthTokens> {
    // Set tenant ID before making the request
    apiClient.setTenantId(tenantId);
    
    const response = await apiClient.post<AuthTokens>('/api/v1/auth/register', data);
    
    if (response.success && response.data) {
      apiClient.setTokens(response.data);
      return response.data;
    }
    
    throw new Error(response.message || 'Registration failed');
  }

  async getProfile(): Promise<AuthUser> {
    const response = await apiClient.get<AuthUser>('/api/v1/auth/profile');
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.message || 'Failed to get profile');
  }

  async changePassword(data: ChangePasswordData): Promise<void> {
    const response = await apiClient.patch('/api/v1/auth/change-password', data);
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to change password');
    }
  }

  async logout(): Promise<void> {
    try {
      await apiClient.post('/api/v1/auth/logout');
    } catch (error) {
      // Logout endpoint might fail, but we still want to clear local tokens
      console.warn('Logout request failed:', error);
    } finally {
      apiClient.clearTokens();
    }
  }

  isAuthenticated(): boolean {
    const token = apiClient.getAccessToken();
    return !!token && !apiClient.isTokenExpired();
  }

  getTenantId(): string | null {
    return apiClient.getTenantId();
  }

  setTenantId(tenantId: string): void {
    apiClient.setTenantId(tenantId);
  }
}

export const authService = new AuthService();
export default authService;
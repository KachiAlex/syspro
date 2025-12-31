import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { AuthTokens, ApiResponse } from '@syspro/shared';

class ApiClient {
  private client: AxiosInstance;
  private tenantId: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add auth token
        const token = this.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Add tenant ID
        if (this.tenantId) {
          config.headers['X-Tenant-ID'] = this.tenantId;
        }

        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshToken = this.getRefreshToken();
            if (refreshToken) {
              const tokens = await this.refreshAccessToken(refreshToken);
              this.setTokens(tokens);
              
              // Retry original request
              originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
              return this.client(originalRequest);
            }
          } catch (refreshError) {
            this.clearTokens();
            window.location.href = '/auth/login';
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // Token management
  setTenantId(tenantId: string) {
    this.tenantId = tenantId;
    localStorage.setItem('tenantId', tenantId);
  }

  getTenantId(): string | null {
    if (!this.tenantId) {
      this.tenantId = localStorage.getItem('tenantId');
    }
    return this.tenantId;
  }

  setTokens(tokens: AuthTokens) {
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    localStorage.setItem('tokenExpiry', (Date.now() + tokens.expiresIn * 1000).toString());
  }

  getAccessToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  }

  clearTokens() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('tokenExpiry');
    localStorage.removeItem('tenantId');
    this.tenantId = null;
  }

  isTokenExpired(): boolean {
    const expiry = localStorage.getItem('tokenExpiry');
    if (!expiry) return true;
    return Date.now() > parseInt(expiry);
  }

  // API methods
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await this.client.get(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await this.client.post(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await this.client.put(url, data, config);
    return response.data;
  }

  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await this.client.patch(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await this.client.delete(url, config);
    return response.data;
  }

  // Auth-specific methods
  async refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
    const response = await axios.post(
      `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/refresh`,
      { refreshToken }
    );
    return response.data.data;
  }

  // Health check
  async healthCheck() {
    try {
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/health`);
      return response.data;
    } catch (error) {
      throw new Error('API health check failed');
    }
  }
}

// Create singleton instance
export const apiClient = new ApiClient();

// Export for use in components
export default apiClient;
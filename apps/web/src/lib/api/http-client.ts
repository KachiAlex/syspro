/**
 * HTTP client configuration and setup
 * Provides a centralized axios instance with interceptors and error handling
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { env } from '../config/env';
import { ApiResponse, ValidationError } from '../types/shared';

// Types for the HTTP client
export interface HttpClientConfig {
  baseURL: string;
  timeout: number;
  retries: number;
}

export interface RequestInterceptor {
  onFulfilled?: (config: AxiosRequestConfig) => AxiosRequestConfig | Promise<AxiosRequestConfig>;
  onRejected?: (error: any) => any;
}

export interface ResponseInterceptor {
  onFulfilled?: (response: AxiosResponse) => AxiosResponse | Promise<AxiosResponse>;
  onRejected?: (error: AxiosError) => any;
}

// Custom error types
export class ApiError extends Error {
  constructor(
    public status: number,
    public message: string,
    public errors?: ValidationError[],
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class NetworkError extends Error {
  constructor(message: string, public originalError: Error) {
    super(message);
    this.name = 'NetworkError';
  }
}

/**
 * HTTP Client class that wraps axios with additional functionality
 */
export class HttpClient {
  private axiosInstance: AxiosInstance;
  private authToken: string | null = null;
  private tenantId: string | null = null;

  constructor(config: HttpClientConfig) {
    this.axiosInstance = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  /**
   * Set up request and response interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor - automatically add auth and tenant headers
    this.axiosInstance.interceptors.request.use(
      (config) => {
        // Add authorization header if token is available
        if (this.authToken) {
          config.headers.Authorization = `Bearer ${this.authToken}`;
        }

        // Add tenant header if tenant ID is available
        if (this.tenantId) {
          config.headers['X-Tenant-ID'] = this.tenantId;
        }

        // Log request in development
        if (env.isDevelopment) {
          console.log(`[HTTP] ${config.method?.toUpperCase()} ${config.url}`, {
            headers: config.headers,
            data: config.data,
          });
        }

        return config;
      },
      (error) => {
        console.error('[HTTP] Request error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor - handle errors consistently
    this.axiosInstance.interceptors.response.use(
      (response) => {
        // Log response in development
        if (env.isDevelopment) {
          console.log(`[HTTP] Response ${response.status}:`, response.data);
        }

        return response;
      },
      (error: AxiosError) => {
        return this.handleResponseError(error);
      }
    );
  }

  /**
   * Handle response errors consistently
   */
  private handleResponseError(error: AxiosError): Promise<never> {
    // Network errors (no response received)
    if (!error.response) {
      const networkError = new NetworkError(
        'Network error: Unable to connect to the server. Please check your internet connection.',
        error
      );
      console.error('[HTTP] Network error:', error);
      return Promise.reject(networkError);
    }

    // HTTP errors (response received with error status)
    const { status, data } = error.response;
    const errorData = data as ApiResponse;

    const apiError = new ApiError(
      status,
      errorData?.message || `HTTP ${status} Error`,
      errorData?.errors,
      errorData?.message
    );

    // Log error details in development
    if (env.isDevelopment) {
      console.error(`[HTTP] API Error ${status}:`, {
        url: error.config?.url,
        method: error.config?.method,
        data: errorData,
      });
    }

    return Promise.reject(apiError);
  }

  /**
   * Set the authentication token for all requests
   */
  setAuthToken(token: string | null): void {
    this.authToken = token;
  }

  /**
   * Set the tenant ID for all requests
   */
  setTenantId(tenantId: string | null): void {
    this.tenantId = tenantId;
  }

  /**
   * Get the current authentication token
   */
  getAuthToken(): string | null {
    return this.authToken;
  }

  /**
   * Get the current tenant ID
   */
  getTenantId(): string | null {
    return this.tenantId;
  }

  /**
   * Add a request interceptor
   */
  addRequestInterceptor(interceptor: RequestInterceptor): number {
    return this.axiosInstance.interceptors.request.use(
      interceptor.onFulfilled,
      interceptor.onRejected
    );
  }

  /**
   * Add a response interceptor
   */
  addResponseInterceptor(interceptor: ResponseInterceptor): number {
    return this.axiosInstance.interceptors.response.use(
      interceptor.onFulfilled,
      interceptor.onRejected
    );
  }

  /**
   * Remove a request interceptor
   */
  removeRequestInterceptor(interceptorId: number): void {
    this.axiosInstance.interceptors.request.eject(interceptorId);
  }

  /**
   * Remove a response interceptor
   */
  removeResponseInterceptor(interceptorId: number): void {
    this.axiosInstance.interceptors.response.eject(interceptorId);
  }

  /**
   * Make a GET request
   */
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.axiosInstance.get<T>(url, config);
    return response.data;
  }

  /**
   * Make a POST request
   */
  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.axiosInstance.post<T>(url, data, config);
    return response.data;
  }

  /**
   * Make a PUT request
   */
  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.axiosInstance.put<T>(url, data, config);
    return response.data;
  }

  /**
   * Make a PATCH request
   */
  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.axiosInstance.patch<T>(url, data, config);
    return response.data;
  }

  /**
   * Make a DELETE request
   */
  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.axiosInstance.delete<T>(url, config);
    return response.data;
  }
}

// Create and export the default HTTP client instance
const defaultConfig: HttpClientConfig = {
  baseURL: `${env.apiBaseUrl}/api/v1`,
  timeout: 30000, // 30 seconds
  retries: 3,
};

export const httpClient = new HttpClient(defaultConfig);
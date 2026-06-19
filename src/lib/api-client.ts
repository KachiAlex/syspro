import React from "react";
import { performanceCache, createOptimizedRequest } from "./performance";

// API configuration
export interface ApiConfig {
  baseURL: string;
  timeout: number;
  retries: number;
  retryDelay: number;
  cache: {
    enabled: boolean;
    defaultTTL: number;
  maxSize: number;
  };
  compression: {
    enabled: boolean;
    threshold: number;
  };
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: any;
  cacheKey?: string;
  cacheTTL?: number;
  skipCache?: boolean;
  deduplicate?: boolean;
  timeout?: number;
  retries?: number;
}

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
  config: RequestOptions;
}

class ApiClient {
  private config: ApiConfig;
  private defaultHeaders: Record<string, string>;

  constructor(config: Partial<ApiConfig> = {}) {
    const { baseURL, ...restConfig } = config;
    const envBaseURL = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
    const normalizedEnvBaseURL = envBaseURL && envBaseURL.length > 0 ? envBaseURL : undefined;
    const resolvedBaseURL = baseURL ?? normalizedEnvBaseURL ?? "/api";

    this.config = {
      baseURL: resolvedBaseURL,
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      cache: {
        enabled: true,
        defaultTTL: 5 * 60 * 1000, // 5 minutes
        maxSize: 1000
      },
      compression: {
        enabled: true,
        threshold: 1024 // 1KB
      },
      ...restConfig
    };

    this.defaultHeaders = {
      "Content-Type": "application/json",
      "Accept": "application/json",
    };
  }

  // Main request method
  async request<T = any>(
    url: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const {
      method = "GET",
      headers = {},
      body,
      cacheKey,
      cacheTTL,
      skipCache = false,
      deduplicate = true,
      timeout = this.config.timeout,
      retries = this.config.retries
    } = options;

    const fullUrl = this.buildUrl(url);
    const requestHeaders = { ...this.defaultHeaders, ...headers };
    const cacheKeyToUse = cacheKey || this.generateCacheKey(method, fullUrl, body);

    // Check cache first (for GET requests)
    if (method === "GET" && this.config.cache.enabled && !skipCache) {
      const cached = performanceCache.get<ApiResponse<T>>(cacheKeyToUse);
      if (cached) {
        return cached;
      }
    }

    // Create request function
    const makeRequest = async (): Promise<ApiResponse<T>> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const { body: _ignoredBody, ...fetchOptions } = options;
        const response = await fetch(fullUrl, {
          method,
          headers: requestHeaders,
          body: this.serializeBody(body),
          signal: controller.signal,
          ...fetchOptions,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          let errorData: any;
          const errorContentType = response.headers.get("content-type");
          try {
            if (errorContentType && errorContentType.includes("application/json")) {
              errorData = await response.json();
            } else {
              errorData = await response.text();
            }
          } catch {
            errorData = null;
          }
          const bodyText = typeof errorData === "string" ? errorData : JSON.stringify(errorData);
          const err = new Error(`HTTP error! status: ${response.status} - ${bodyText}`) as any;
          err.response = { data: errorData, status: response.status, statusText: response.statusText };
          throw err;
        }

        let data: T;
        const contentType = response.headers.get("content-type");
        
        if (contentType && contentType.includes("application/json")) {
          data = await response.json();
        } else if (contentType && contentType.includes("text/")) {
          data = await response.text() as any;
        } else {
          data = await response.blob() as any;
        }

        const result: ApiResponse<T> = {
          data,
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          config: options
        };

        // Cache successful GET requests
        if (method === "GET" && this.config.cache.enabled && !skipCache) {
          performanceCache.set(cacheKeyToUse, result, cacheTTL);
        }

        return result;
      } catch (error: unknown) {
        clearTimeout(timeoutId);

        const err = error instanceof Error ? error : new Error(String(error));

        if (err.name === "AbortError") {
          throw new Error("Request timeout");
        }

        throw err;
      }
    };

    // Implement retry logic
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await makeRequest();
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        lastError = err;

        if (attempt < retries) {
          await this.delay(this.config.retryDelay * Math.pow(2, attempt));
        }
      }
    }

    throw lastError ?? new Error("Request failed after retries");
  }

  // HTTP method helpers
  async get<T = any>(
    url: string,
    options: Omit<RequestOptions, "method"> = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...options, method: "GET" });
  }

  async post<T = any>(
    url: string,
    data?: any,
    options: Omit<RequestOptions, "method"> = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...options, method: "POST", body: data });
  }

  async put<T = any>(
    url: string,
    data?: any,
    options: Omit<RequestOptions, "method"> = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...options, method: "PUT", body: data });
  }

  async patch<T = any>(
    url: string,
    data?: any,
    options: Omit<RequestOptions, "method"> = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...options, method: "PATCH", body: data });
  }

  async delete<T = any>(
    url: string,
    options: Omit<RequestOptions, "method"> = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...options, method: "DELETE" });
  }

  // Batch requests
  async batch<T = any>(requests: Array<{
    url: string;
    options?: RequestOptions;
  }>): Promise<ApiResponse<T>[]> {
    const results = await Promise.all(
      requests.map(({ url, options = {} }) => this.request<T>(url, options))
    );
    return results;
  }

  // Parallel requests with concurrency control
  async parallel<T = any>(
    requests: Array<{
      url: string;
      options?: RequestOptions;
    }>,
    concurrency: number = 5
  ): Promise<ApiResponse<T>[]> {
    const results: ApiResponse<T>[] = [];
    
    for (let i = 0; i < requests.length; i += concurrency) {
      const batch = requests.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(({ url, options }) => this.request<T>(url, options))
      );
      results.push(...batchResults);
    }
    
    return results;
  }

  // File upload
  async uploadFile(
    url: string,
    file: File,
    options: {
      onProgress?: (progress: number) => void;
      field?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<ApiResponse<any>> {
    const formData = new FormData();
    formData.append(options.field || "file", file);
    
    if (options.metadata) {
      Object.entries(options.metadata).forEach(([key, value]) => {
        formData.append(key, JSON.stringify(value));
      });
    }

    return this.request(url, {
      method: "POST",
      headers: {
        "Content-Type": "multipart/form-data",
      },
      body: formData,
      onUploadProgress: options.onProgress
    } as any);
  }

  // Download file
  async downloadFile(
    url: string,
    filename?: string,
    options: {
      onProgress?: (progress: number) => void;
    } = {}
  ): Promise<void> {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`);
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = filename || "download";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    window.URL.revokeObjectURL(downloadUrl);
  }

  // Utility methods
  private buildUrl(url: string): string {
    if (/^https?:\/\//.test(url)) {
      return url;
    }

    const baseRaw = (this.config.baseURL ?? "").trim();
    const tempUrl = new URL(url, "http://placeholder");
    const suffix = `${tempUrl.search}${tempUrl.hash}`;

    const normalize = (value: string) => value.replace(/^\/+|\/+$/g, "");
    const buildPath = (basePath: string, requestPath: string) => {
      if (!basePath && !requestPath) {
        return "/";
      }
      if (!basePath) {
        return `/${requestPath}`.replace(/\/{2,}/g, "/");
      }
      if (!requestPath) {
        return `/${basePath}`.replace(/\/{2,}/g, "/");
      }
      if (requestPath === basePath || requestPath.startsWith(`${basePath}/`)) {
        return `/${requestPath}`.replace(/\/{2,}/g, "/");
      }
      return `/${basePath}/${requestPath}`.replace(/\/{2,}/g, "/");
    };

    const requestPath = normalize(tempUrl.pathname);

    if (!baseRaw) {
      const path = buildPath("", requestPath);
      return `${path}${suffix}`;
    }

    if (/^https?:\/\//.test(baseRaw)) {
      const baseUrl = new URL(baseRaw);
      const basePath = normalize(baseUrl.pathname);
      const path = buildPath(basePath, requestPath);
      return `${baseUrl.origin}${path}${suffix}`;
    }

    const basePath = normalize(baseRaw);
    const path = buildPath(basePath, requestPath);
    return `${path}${suffix}`;
  }

  private generateCacheKey(method: string, url: string, body?: any): string {
    const key = `${method}:${url}`;
    if (body) {
      const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
      return `${key}:${this.hashString(bodyStr)}`;
    }
    return key;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (((hash << 5) - hash) + char) & 0xffffffff;
    }
    return hash.toString(36);
  }

  private serializeBody(body: any): BodyInit | undefined {
    if (!body) return undefined;
    
    if (body instanceof FormData) {
      return body;
    }
    
    if (typeof body === "string") {
      return body;
    }
    
    if (body instanceof Blob) {
      return body;
    }
    
    return JSON.stringify(body);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Cache management
  clearCache(pattern?: string): void {
    if (pattern) {
      // Clear cache entries matching pattern
      performanceCache.keys().forEach(key => {
        if (key.includes(pattern)) {
          performanceCache.delete(key);
        }
      });
    } else {
      // Clear all cache
      performanceCache.clear();
    }
  }

  getCacheStats() {
    return performanceCache.getStats();
  }

  // Performance monitoring
  getPerformanceMetrics() {
    return {
      cache: this.getCacheStats(),
      config: this.config
    };
  }

  // Health check
  async healthCheck(): Promise<{
    status: "healthy" | "degraded" | "unhealthy";
    timestamp: number;
    metrics: any;
  }> {
    try {
      const startTime = performance.now();
      const response = await this.get("/health");
      const endTime = performance.now();
      
      return {
        status: response.status === 200 ? "healthy" : "unhealthy",
        timestamp: Date.now(),
        metrics: {
          responseTime: endTime - startTime,
          cacheHitRate: this.getCacheStats().hitRate || 0,
          cacheSize: this.getCacheStats().memoryUsage.used
        }
      };
    } catch (error) {
      return {
        status: "unhealthy",
        timestamp: Date.now(),
        metrics: {
          error: error instanceof Error ? error.message : "Unknown error"
        }
      };
    }
  }

  // Cleanup
  destroy(): void {
    this.clearCache();
    performanceCache.destroy();
  }
}

// Create default API client instance
export const apiClient = new ApiClient({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
  timeout: 30000,
  retries: 3,
  retryDelay: 1000,
  cache: {
    enabled: true,
    defaultTTL: 5 * 60 * 1000,
    maxSize: 1000
  },
  compression: {
    enabled: true,
    threshold: 1024
  }
});

// Typed API methods for different modules
export class ApiMethods {
  private client: ApiClient;

  constructor(client: ApiClient = apiClient) {
    this.client = client;
  }

  // CRM methods
  async getLeads(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }) {
    const searchParams = new URLSearchParams(params as any).toString();
    return this.client.get(`/leads?${searchParams}`);
  }

  async createLead(data: any) {
    return this.client.post("/leads", data);
  }

  async updateLead(id: string, data: any) {
    return this.client.patch(`/leads/${id}`, data);
  }

  async deleteLead(id: string) {
    return this.client.delete(`/leads/${id}`);
  }

  // Financial methods
  async getInvoices(params?: {
    page?: number;
    limit?: number;
    status?: string;
    clientId?: string;
  }) {
    const searchParams = new URLSearchParams(params as any).toString();
    return this.client.get(`/invoices?${searchParams}`);
  }

  async createInvoice(data: any) {
    return this.client.post("/invoices", data);
  }

  async updateInvoice(id: string, data: any) {
    return this.client.patch(`/invoices/${id}`, data);
  }

  // Project methods
  async getProjects(params?: {
    page?: number;
    limit?: number;
    status?: string;
    assigneeId?: string;
  }) {
    const searchParams = new URLSearchParams(params as any).toString();
    return this.client.get(`/projects?${searchParams}`);
  }

  async createProject(data: any) {
    return this.client.post("/projects", data);
  }

  // User methods
  async getUsers(params?: {
    page?: number;
    limit?: number;
    role?: string;
    department?: string;
  }) {
    const searchParams = new URLSearchParams(params as any).toString();
    return this.client.get(`/users?${searchParams}`);
  }

  // Analytics methods
  async getAnalytics(params?: {
    startDate?: string;
    endDate?: string;
    metrics?: string[];
  }) {
    const searchParams = new URLSearchParams(params as any).toString();
    return this.client.get(`/analytics?${searchParams}`);
  }

  // Reports methods
  async getReports(params?: {
    type?: string;
    dateRange?: string;
  }) {
    const searchParams = new URLSearchParams(params as any).toString();
    return this.client.get(`/reports?${searchParams}`);
  }

  // Settings methods
  async getSettings() {
    return this.client.get("/settings");
  }

  async updateSettings(data: any) {
    return this.client.patch("/settings", data);
  }
}

// Create typed API methods instance
export const apiMethods = new ApiMethods();

// React hooks for API
export function useApi<T = any>(
  url: string,
  options?: RequestOptions
) {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const execute = React.useCallback(async (overrideOptions?: RequestOptions) => {
    setLoading(true);
        setError(null);
        
        try {
          const response = await apiClient.request<T>(url, { ...options, ...overrideOptions });
          setData(response.data);
          return response;
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : "An error occurred";
          setError(errorMessage);
          throw err;
        } finally {
          setLoading(false);
        }
    }, [url, options]);

  const mutate = React.useCallback(async (data?: any, method?: "POST" | "PUT" | "PATCH" | "DELETE") => {
      return execute({ method, body: data });
    }, [execute]);

  const refetch = React.useCallback(() => {
    if (data !== null) {
      return execute();
    }
  }, [data, execute]);

  return {
    data,
    loading,
    error,
    execute,
    mutate,
    refetch
  };
}

// Prefetching utility
export function usePrefetch() {
  const prefetch = React.useCallback(async (url: string, options?: RequestOptions) => {
    try {
      await apiClient.request(url, { ...options, cacheTTL: 10 * 60 * 1000 }); // 10 minutes
    } catch (error) {
      // Silently fail prefetching
      console.warn("Prefetch failed:", error);
    }
  }, []);

  return { prefetch };
}

// Optimized SWR-like hook
export function useSWR<T = any>(
  key: string | null,
  fetcher: () => Promise<T>,
  options?: {
    dedupingInterval?: number;
    refreshInterval?: number;
    revalidateOnFocus?: boolean;
    revalidateOnReconnect?: boolean;
    errorRetryCount?: number;
    errorRetryInterval?: number;
  }
) {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<Error | null>(null);
  const [loading, setLoading] = React.useState(false);

  const fetchData = React.useCallback(async () => {
    if (!key) return;

    setLoading(true);
    setError(null);

    try {
      const result = await fetcher();
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [key, fetcher]);

  // Initial fetch
  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto refresh
  React.useEffect(() => {
    if (!options?.refreshInterval) return;

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchData();
      }
    }, options.refreshInterval);

    return () => clearInterval(interval);
  }, [options?.refreshInterval, fetchData]);

  // Revalidate on focus
  React.useEffect(() => {
    if (!options?.revalidateOnFocus) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchData();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [options?.revalidateOnFocus, fetchData]);

  return {
    data,
    error,
    loading,
    mutate: fetchData,
    revalidate: fetchData
  };
}

// Performance optimization utilities and caching system

// Cache configuration
export interface CacheConfig {
  maxSize: number;
  defaultTTL: number; // Time to live in milliseconds
  cleanupInterval: number;
  enableCompression: boolean;
}

// Cache entry with metadata
export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
  lastAccessed: number;
  compressed?: boolean;
  originalSize?: number;
}

// Performance metrics
export interface PerformanceMetrics {
  cacheHits: number;
  cacheMisses: number;
  averageResponseTime: number;
  totalRequests: number;
  slowQueries: Array<{
    query: string;
    time: number;
    timestamp: number;
  }>;
  memoryUsage: {
    used: number;
    total: number;
  };
}

// Request deduplication
export interface PendingRequest<T = any> {
  promise: Promise<T>;
  timestamp: number;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

class PerformanceCache {
  private cache = new Map<string, CacheEntry>();
  private pendingRequests = new Map<string, PendingRequest>();
  private metrics: PerformanceMetrics = {
    cacheHits: 0,
    cacheMisses: 0,
    averageResponseTime: 0,
    totalRequests: 0,
    slowQueries: [],
    memoryUsage: { used: 0, total: 0 }
  };
  private config: CacheConfig;
  private cleanupTimer: NodeJS.Timeout;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 1000,
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      cleanupInterval: 60 * 1000, // 1 minute
      enableCompression: true,
      ...config
    };

    this.startCleanup();
  }

  // Get data from cache
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.metrics.cacheMisses++;
      return null;
    }

    // Check if entry is expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.metrics.cacheMisses++;
      return null;
    }

    // Update access metadata
    entry.hits++;
    entry.lastAccessed = Date.now();
    this.metrics.cacheHits++;

    return entry.data;
  }

  // Set data in cache
  set<T>(key: string, data: T, ttl?: number): void {
    const now = Date.now();
    const entryTTL = ttl || this.config.defaultTTL;
    
    // Check cache size limit
    if (this.cache.size >= this.config.maxSize) {
      this.evictLeastRecentlyUsed();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      ttl: entryTTL,
      hits: 0,
      lastAccessed: now,
      originalSize: this.estimateSize(data)
    };

    // Compress if enabled and data is large enough
    if (this.config.enableCompression && entry.originalSize > 1024) {
      entry.compressed = true;
      entry.data = this.compress(data);
    }

    this.cache.set(key, entry);
    this.updateMemoryUsage();
  }

  // Delete from cache
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.updateMemoryUsage();
    }
    return deleted;
  }

  // Clear cache
  clear(): void {
    this.cache.clear();
    this.updateMemoryUsage();
  }

  // Check if key exists and is not expired
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  // Get cache statistics
  getStats(): PerformanceMetrics {
    const hitRate = this.metrics.totalRequests > 0 
      ? (this.metrics.cacheHits / this.metrics.totalRequests) * 100 
      : 0;

    return {
      ...this.metrics,
      hitRate
    };
  }

  // Deduplicate requests
  async deduplicate<T>(
    key: string,
    requestFn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Check cache first
    const cached = this.get<T>(key);
    if (cached !== null) {
      return Promise.resolve(cached);
    }

    // Check if request is already pending
    const pending = this.pendingRequests.get(key);
    if (pending) {
      return pending.promise;
    }

    // Create new request
    const promise = new Promise<T>((resolve, reject) => {
      const startTime = Date.now();
      
      requestFn()
        .then((data) => {
          const endTime = Date.now();
          const responseTime = endTime - startTime;
          
          // Cache the result
          this.set(key, data, ttl);
          
          // Update metrics
          this.updateMetrics(responseTime, key);
          
          // Resolve all pending requests
          const pending = this.pendingRequests.get(key);
          if (pending) {
            pending.resolve(data);
            this.pendingRequests.delete(key);
          }
          
          resolve(data);
        })
        .catch((error) => {
          // Reject all pending requests
          const pending = this.pendingRequests.get(key);
          if (pending) {
            pending.reject(error);
            this.pendingRequests.delete(key);
          }
          
          reject(error);
        });
    });

    // Store pending request
    this.pendingRequests.set(key, {
      promise,
      timestamp: Date.now(),
      resolve: () => {},
      reject: () => {}
    });

    return promise;
  }

  // Private methods
  private evictLeastRecentlyUsed(): void {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
    this.updateMemoryUsage();
  }

  private updateMetrics(responseTime: number, query: string): void {
    this.metrics.totalRequests++;
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + responseTime) / 
      this.metrics.totalRequests;

    // Track slow queries (> 1 second)
    if (responseTime > 1000) {
      this.metrics.slowQueries.push({
        query,
        time: responseTime,
        timestamp: Date.now()
      });

      // Keep only last 100 slow queries
      if (this.metrics.slowQueries.length > 100) {
        this.metrics.slowQueries = this.metrics.slowQueries.slice(-100);
      }
    }
  }

  private updateMemoryUsage(): void {
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += entry.originalSize || this.estimateSize(entry.data);
    }
    
    this.metrics.memoryUsage = {
      used: totalSize,
      total: this.config.maxSize * 1024 * 1024 // Convert to bytes
    };
  }

  private estimateSize(data: any): number {
    if (typeof data === 'string') {
      return data.length * 2; // Rough estimate for UTF-16
    }
    
    if (typeof data === 'object' && data !== null) {
      return JSON.stringify(data).length * 2;
    }
    
    return 100; // Default estimate
  }

  private compress(data: any): any {
    // Simple compression simulation
    // In production, use a proper compression library
    return data;
  }

  private decompress(data: any): any {
    // Simple decompression simulation
    // In production, use a proper compression library
    return data;
  }

  // Destroy cleanup
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.cache.clear();
    this.pendingRequests.clear();
  }
}

// Global cache instance
export const performanceCache = new PerformanceCache({
  maxSize: 1000,
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  cleanupInterval: 60 * 1000, // 1 minute
  enableCompression: true
});

// Performance monitoring
export class PerformanceMonitor {
  private observers: PerformanceObserver[] = [];
  private metrics: Map<string, number> = new Map();
  private marks: Map<string, number> = new Map();

  constructor() {
    this.setupObservers();
  }

  private setupObservers(): void {
    // Navigation timing
    if ('PerformanceObserver' in window) {
      const navObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach(entry => {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming;
            this.metrics.set('domContentLoaded', navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart);
            this.metrics.set('loadComplete', navEntry.loadEventEnd - navEntry.loadEventStart);
            this.metrics.set('firstPaint', navEntry.responseStart - navEntry.requestStart);
          }
        });
      });
      navObserver.observe({ entryTypes: ['navigation'] });

      // Resource timing
      const resourceObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach(entry => {
          if (entry.entryType === 'resource') {
            const resourceEntry = entry as PerformanceResourceTiming;
            const url = new URL(resourceEntry.name).pathname;
            this.metrics.set(`resource_${url}`, resourceEntry.responseEnd - resourceEntry.requestStart);
          }
        });
      });
      resourceObserver.observe({ entryTypes: ['resource'] });
    }
  }

  // Mark performance point
  mark(name: string): void {
    this.marks.set(name, performance.now());
  }

  // Measure time between marks
  measure(name: string, startMark: string, endMark?: string): number {
    const startTime = this.marks.get(startMark);
    const endTime = endMark ? this.marks.get(endMark) : performance.now();
    
    if (startTime !== undefined) {
      const duration = endTime - startTime;
      this.metrics.set(name, duration);
      return duration;
    }
    
    return 0;
  }

  // Get performance metrics
  getMetrics(): Record<string, number> {
    const metrics: Record<string, number> = {};
    
    // Add cache metrics
    const cacheStats = performanceCache.getStats();
    metrics.cacheHitRate = cacheStats.hitRate || 0;
    metrics.cacheSize = cacheStats.memoryUsage.used;
    
    // Add performance metrics
    this.metrics.forEach((value, key) => {
      metrics[key] = value;
    });
    
    // Add browser metrics
    if ('performance' in window) {
      const perf = performance as any;
      metrics.memoryUsed = perf.memory ? perf.memory.usedJSHeapSize : 0;
      metrics.memoryTotal = perf.memory ? perf.memory.totalJSHeapSize : 0;
    }
    
    return metrics;
  }

  // Log performance metrics
  logMetrics(): void {
    const metrics = this.getMetrics();
    console.groupCollapsed('Performance Metrics');
    
    Object.entries(metrics).forEach(([key, value]) => {
      console.log(`${key}:`, value);
    });
    
    console.groupEnd();
  }
}

// Global performance monitor
export const performanceMonitor = new PerformanceMonitor();

// Loading states management
export interface LoadingState {
  isLoading: boolean;
  message?: string;
  progress?: number;
  error?: string;
}

export class LoadingStateManager {
  private loadingStates = new Map<string, LoadingState>();
  private listeners: Set<() => void> = new Set();

  // Set loading state
  setLoading(key: string, loading: boolean, message?: string): void {
    const currentState = this.loadingStates.get(key) || { isLoading: false };
    
    this.loadingStates.set(key, {
      ...currentState,
      isLoading: loading,
      message: message || currentState.message
    });
    
    this.notifyListeners();
  }

  // Set progress
  setProgress(key: string, progress: number): void {
    const currentState = this.loadingStates.get(key) || { isLoading: false };
    
    this.loadingStates.set(key, {
      ...currentState,
      progress
    });
    
    this.notifyListeners();
  }

  // Set error
  setError(key: string, error: string): void {
    const currentState = this.loadingStates.get(key) || { isLoading: false };
    
    this.loadingStates.set(key, {
      ...currentState,
      isLoading: false,
      error
    });
    
    this.notifyListeners();
  }

  // Get loading state
  getLoadingState(key: string): LoadingState {
    return this.loadingStates.get(key) || { isLoading: false };
  }

  // Check if any loading states are active
  hasActiveLoading(): boolean {
    return Array.from(this.loadingStates.values()).some(state => state.isLoading);
  }

  // Subscribe to loading state changes
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // Clear loading state
  clear(key: string): void {
    this.loadingStates.delete(key);
    this.notifyListeners();
  }

  // Clear all loading states
  clearAll(): void {
    this.loadingStates.clear();
    this.notifyListeners();
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }
}

// Global loading state manager
export const loadingStateManager = new LoadingStateManager();

// Debounce utility
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): T {
  let timeout: NodeJS.Timeout;
  
  return ((...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  }) as T;
}

// Throttle utility
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): T {
  let inThrottle = false;
  
  return ((...args: any[]) => {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  }) as T;
}

// Memoization utility
export function memoize<T extends (...args: any[]) => any>(
  func: T,
  keyGenerator?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();
  
  return ((...args: Parameters<T>) => {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = func.apply(this, args);
    cache.set(key, result);
    return result;
  }) as T;
}

// Lazy loading utility
export function lazyLoad<T>(
  loader: () => Promise<T>,
  options: {
    cacheKey?: string;
    ttl?: number;
  } = {}
): () => Promise<T> {
  const cacheKey = options.cacheKey || 'lazy_' + Math.random().toString(36);
  
  return async (): Promise<T> => {
    // Check cache first
    const cached = performanceCache.get<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // Load data
    const data = await loader();
    
    // Cache the result
    performanceCache.set(cacheKey, data, options.ttl);
    
    return data;
  };
}

// Image optimization utilities
export class ImageOptimizer {
  private imageCache = new Map<string, HTMLImageElement>();
  private loadingPromises = new Map<string, Promise<HTMLImageElement>>();

  // Preload image
  preloadImage(src: string): Promise<HTMLImageElement> {
    if (this.imageCache.has(src)) {
      return Promise.resolve(this.imageCache.get(src)!);
    }

    if (this.loadingPromises.has(src)) {
      return this.loadingPromises.get(src)!;
    }

    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        this.imageCache.set(src, img);
        this.loadingPromises.delete(src);
        resolve(img);
      };
      
      img.onerror = () => {
        this.loadingPromises.delete(src);
        reject(new Error(`Failed to load image: ${src}`));
      };
      
      img.src = src;
    });

    this.loadingPromises.set(src, promise);
    return promise;
  }

  // Get cached image
  getImage(src: string): HTMLImageElement | null {
    return this.imageCache.get(src) || null;
  }

  // Clear cache
  clearCache(): void {
    this.imageCache.clear();
    this.loadingPromises.clear();
  }
}

// Global image optimizer
export const imageOptimizer = new ImageOptimizer();

// Performance hooks
export function usePerformanceMetrics() {
  const [metrics, setMetrics] = useState<Record<string, number>>({});

  useEffect(() => {
    const updateMetrics = () => {
      setMetrics(performanceMonitor.getMetrics());
    };

    updateMetrics();
    
    const interval = setInterval(updateMetrics, 5000); // Update every 5 seconds
    
    return () => clearInterval(interval);
  }, []);

  return metrics;
}

export function useLoadingState(key: string) {
  const [loadingState, setLoadingStateLocal] = useState<LoadingState>({ isLoading: false });

  useEffect(() => {
    const updateLoadingState = () => {
      setLoadingStateLocal(loadingStateManager.getLoadingState(key));
    };

    updateLoadingState();
    
    const unsubscribe = loadingStateManager.subscribe(updateLoadingState);
    
    return unsubscribe;
  }, [key]);

  return {
    ...loadingState,
    setLoading: (loading: boolean, message?: string) => {
      loadingStateManager.setLoading(key, loading, message);
    },
    setProgress: (progress: number) => {
      loadingStateManager.setProgress(key, progress);
    },
    setError: (error: string) => {
      loadingStateManager.setError(key, error);
    },
    clear: () => {
      loadingStateManager.clear(key);
    }
  };
}

// API request optimization
export function createOptimizedRequest<T>(
  url: string,
  options: RequestInit & {
    cacheKey?: string;
    cacheTTL?: number;
    deduplicate?: boolean;
  } = {}
): Promise<T> {
  const {
    cacheKey,
    cacheTTL = 5 * 60 * 1000, // 5 minutes
    deduplicate = true,
    ...fetchOptions
  } = options;

  const requestKey = cacheKey || url;

  if (deduplicate) {
    return performanceCache.deduplicate(
      requestKey,
      () => fetch(url, fetchOptions).then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      }),
      cacheTTL
    );
  }

  // Regular request without deduplication
  return fetch(url, fetchOptions).then(res => {
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    return res.json();
  });
}

// Note: individual utilities are exported above to avoid duplicate exports.

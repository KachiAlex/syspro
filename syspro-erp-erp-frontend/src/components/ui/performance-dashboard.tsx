"use client";

import React, { useState, useEffect } from "react";
import { 
  Activity, 
  Database, 
  FileText, 
  Users, 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  AlertCircle,
  CheckCircle,
  XCircle,
  BarChart3,
  PieChart,
  LineChart,
  Download,
  RefreshCw,
  Settings
} from "lucide-react";
import { performanceCache, performanceMonitor, usePerformanceMetrics } from "@/lib/performance";
import { apiClient, useApi } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  trend?: {
    value: number;
    direction: "up" | "down" | "neutral";
  };
  icon?: React.ReactNode;
  color?: "blue" | "green" | "yellow" | "red" | "gray";
  className?: string;
}

function MetricCard({ 
  title, 
  value, 
  unit, 
  trend, 
  icon, 
  color = "blue",
  className = ""
}: MetricCardProps) {
  const colorClasses = {
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    green: "border-green-200 bg-green-50 text-green-900",
    yellow: "border-yellow-200 bg-yellow-50 text-yellow-900",
    red: "border-red-200 bg-red-50 text-red-900",
    gray: "border-gray-200 bg-gray-50 text-gray-900"
  };

  const trendIcon = trend?.direction === "up" ? (
    <TrendingUp className="w-4 h-4 text-green-600" />
  ) : trend?.direction === "down" ? (
    <TrendingDown className="w-4 h-4 text-red-600" />
  ) : null;

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color]} ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <p className="text-sm font-medium">{title}</p>
            <p className="text-2xl font-bold">{value}{unit}</p>
          </div>
        </div>
        
        {trend && (
          <div className={`flex items-center gap-1 text-sm ${
            trend.direction === "up" ? "text-green-600" : 
            trend.direction === "down" ? "text-red-600" : 
            "text-gray-600"
          }`}>
            {trendIcon}
            <span>{Math.abs(trend.value).toFixed(1)}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

interface SlowQuery {
  query: string;
  time: number;
  timestamp: number;
  count: number;
}

export function PerformanceDashboard({ className = "" }: { className?: string }) {
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [cacheStats, setCacheStats] = useState(performanceCache.getStats());
  const [slowQueries, setSlowQueries] = useState<SlowQuery[]>([]);
  const [apiHealth, setApiHealth] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const updateMetrics = () => {
      setMetrics(performanceMonitor.getMetrics());
      setCacheStats(performanceCache.getStats());
      setSlowQueries(performanceCache.getStats().slowQueries || []);
    };

    updateMetrics();
    
    const interval = setInterval(updateMetrics, 5000); // Update every 5 seconds
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    checkApiHealth();
    const interval = setInterval(checkApiHealth, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  const checkApiHealth = async () => {
    try {
      const health = await apiClient.healthCheck();
      setApiHealth(health);
    } catch (error) {
      setApiHealth({
        status: "unhealthy",
        timestamp: Date.now(),
        metrics: { error: error instanceof Error ? error.message : "Unknown error" }
      });
    }
  };

  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      updateMetrics();
      setCacheStats(performanceCache.getStats());
      setSlowQueries(performanceCache.getStats().slowQueries || []);
      await checkApiHealth();
      toast.success("Success", "Performance data refreshed");
    } catch (error) {
      toast.error("Error", "Failed to refresh performance data");
    } finally {
      setIsRefreshing(false);
    }
  };

  const clearCache = () => {
    performanceCache.clearCache();
    setCacheStats(performanceCache.getStats());
    toast.success("Success", "Cache cleared");
  };

  const formatBytes = (bytes: number): string => {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const formatTime = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${( ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${( ms / 60000).toFixed(1)}m`;
    return `${( ms / 3600000).toFixed(1)}h`;
  };

  const getCacheEfficiency = () => {
    if (cacheStats.totalRequests === 0) return 0;
    return ((cacheStats.cacheHits / cacheStats.totalRequests) * 100).toFixed(1);
  };

  const getMemoryUsage = () => {
    if (metrics.memoryTotal === 0) return 0;
    return ((metrics.memoryUsed / metrics.memoryTotal) * 100).toFixed(1);
  };

  const getSlowQueryTrend = () => {
    if (slowQueries.length < 2) return 0;
    
    const recent = slowQueries.slice(-5);
    const avgRecent = recent.reduce((sum, q) => sum + q.time, 0) / recent.length;
    const older = slowQueries.slice(0, Math.max(0, slowQueries.length - 5));
    const avgOlder = older.length > 0 ? older.reduce((sum, q) => sum + q.time, 0) / older.length : 0;
    
    return avgRecent - avgOlder;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Performance Dashboard</h2>
          <p className="text-sm text-gray-600">Monitor system performance and optimization</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={refreshData}
            disabled={isRefreshing}
            className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border ${
              isRefreshing 
                ? "bg-gray-100 text-gray-400" 
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
          
          <button
            onClick={clearCache}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border bg-white text-gray-700 hover:bg-gray-50"
          >
            <Database className="w-4 h-4" />
            Clear Cache
          </button>
          
          <button className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border bg-white text-gray-700 hover:bg-gray-50">
            <Settings className="w-4 h-4" />
            Settings
          </button>
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="API Status"
          value={apiHealth?.status === "healthy" ? "Online" : "Offline"}
          icon={apiHealth?.status === "healthy" ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          color={apiHealth?.status === "healthy" ? "green" : "red"}
        />
        
        <MetricCard
          title="Cache Hit Rate"
          value={getCacheEfficiency()}
          unit="%"
          trend={{
            value: getCacheEfficiency() > 80 ? 5 : -2,
            direction: getCacheEfficiency() > 80 ? "up" : "down"
          }}
          icon={<Database className="w-5 h-5" />}
          color={getCacheEfficiency() > 80 ? "green" : "yellow"}
        />
        
        <MetricCard
          title="Cache Size"
          value={formatBytes(cacheStats.memoryUsage.used)}
          icon={<Database className="w-5 h-5" />}
          color="blue"
        />
        
        <MetricCard
          title="Memory Usage"
          value={getMemoryUsage()}
          unit="%"
          icon={<Activity className="w-5 h-5" />}
          color={getMemoryUsage() > 80 ? "red" : getMemoryUsage() > 60 ? "yellow" : "green"}
        />
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Response Times */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Response Times</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Average Response Time</span>
              <span className="text-sm font-medium text-gray-900">
                {formatTime(metrics.averageResponseTime || 0)}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Total Requests</span>
              <span className="text-sm font-medium text-gray-900">
                {cacheStats.totalRequests}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Cache Hits</span>
              <span className="text-sm font-medium text-green-600">
                {cacheStats.cacheHits}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Cache Misses</span>
              <span className="text-sm font-medium text-red-600">
                {cacheStats.cacheMisses}
              </span>
            </div>
          </div>
        </div>

        {/* Slow Queries */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Slow Queries
            {slowQueries.length > 0 && (
              <span className="text-sm text-gray-500">({slowQueries.length} queries)</span>
            )}
          </h3>
          
          {slowQueries.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm">No slow queries detected</p>
            </div>
          ) : (
            <div className="space-y-2">
              {slowQueries.slice(0, 5).map((query, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-red-900 truncate">
                      {query.query}
                    </p>
                    <p className="text-xs text-red-700">
                      {formatTime(query.time)} • {query.count} occurrences
                    </p>
                  </div>
                  <div className="text-sm text-red-600 font-medium">
                    {formatTime(query.timestamp)}
                  </div>
                </div>
              ))}
              
              {slowQueries.length > 5 && (
                <div className="text-center py-2">
                  <p className="text-sm text-gray-500">
                    ... and {slowQueries.length - 5} more
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Response Time Chart */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Response Time Trend</h3>
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
            <LineChart className="w-12 h-12 text-gray-400" />
            <p className="text-sm text-gray-500 mt-2">Response time chart</p>
          </div>
        </div>

        {/* Cache Distribution */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Cache Distribution</h3>
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
            <PieChart className="w-12 h-12 text-gray-400" />
            <p className="text-sm text-gray-500 mt-2">Cache distribution</p>
          </div>
        </div>
      </div>

      {/* Detailed Metrics */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Detailed Metrics</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-900">Navigation</h4>
            <p className="text-sm text-gray-600">
              DOM Content: {formatTime(metrics.domContentLoaded || 0)}
            </p>
            <p className="text-sm text-gray-600">
              Load Complete: {formatTime(metrics.loadComplete || 0)}
            </p>
          </div>
          
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-900">Resources</h4>
            <p className="text-sm text-gray-600">
              First Paint: {formatTime(metrics.firstPaint || 0)}
            </p>
          </div>
          
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-900">Memory</h4>
            <p className="text-sm text-gray-600">
              Used: {formatBytes(metrics.memoryUsed || 0)}
            </p>
            <p className="text-sm text-gray-600">
              Total: {formatBytes(metrics.memoryTotal || 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => performanceMonitor.logMetrics()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <BarChart3 className="w-4 h-4" />
            Log Metrics
          </button>
          
          <button
            onClick={() => {
              performanceCache.clearCache();
              setCacheStats(performanceCache.getStats());
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            <Database className="w-4 h-4" />
            Clear Cache
          </button>
          
          <button
            onClick={() => {
              // Export metrics data
              const data = {
                metrics,
                cacheStats,
                slowQueries,
                timestamp: Date.now()
              };
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `performance-metrics-${new Date().toISOString()}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Download className="w-4 h-4" />
            Export Data
          </button>
          
          <button
            onClick={() => {
              // Open browser performance tools
              if (window.performance && window.performance.memory) {
                window.performance.memory = {
                  usedJSHeapSize: 0,
                  totalJSHeapSize: 0,
                  jsHeapSizeLimit: 0
                };
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <Zap className="w-4 h-4" />
            Reset Memory
          </button>
        </div>
      </div>
    </div>
  );
}

// Hook for performance monitoring
export function usePerformanceMonitoring() {
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [alerts, setAlerts] = useState<Array<{
    type: "warning" | "error" | "info";
    message: string;
    timestamp: number;
  }>>([]);
  useEffect(() => {
    const updateMetrics = () => {
      const currentMetrics = performanceMonitor.getMetrics();
      setMetrics(currentMetrics);
      
      // Check for performance issues
      const newAlerts: Array<{
        type: "warning" | "error" | "info";
        message: string;
        timestamp: number;
      }> = [];

      // Check memory usage
      if (currentMetrics.memoryUsed && currentMetrics.memoryTotal) {
        const usagePercent = (currentMetrics.memoryUsed / currentMetrics.memoryTotal) * 100;
        if (usagePercent > 80) {
          newAlerts.push({
            type: "warning",
            message: `Memory usage is high: ${usagePercent.toFixed(1)}%`,
            timestamp: Date.now()
          });
        }
      }

      // Check cache hit rate
      const cacheStats = performanceCache.getStats();
      if (cacheStats.totalRequests > 100) {
        const hitRate = (cacheStats.cacheHits / cacheStats.totalRequests) * 100;
        if (hitRate < 50) {
          newAlerts.push({
            type: "info",
            message: `Cache hit rate is low: ${hitRate.toFixed(1)}%`,
            timestamp: Date.now()
          });
        }
      }

      // Check slow queries
      if (cacheStats.slowQueries.length > 5) {
        newAlerts.push({
          type: "warning",
          message: `Detected ${cacheStats.slowQueries.length} slow queries`,
          timestamp: Date.now()
        });
      }

      setAlerts(prev => [...prev.slice(-5), ...newAlerts]);
    };

    const interval = setInterval(updateMetrics, 10000); // Check every 10 seconds
    
    return () => clearInterval(interval);
  }, []);

  return {
    metrics,
    alerts,
    clearAlerts: () => setAlerts([])
  };
}

// Performance optimization hook
export function usePerformanceOptimization() {
  const [isOptimized, setIsOptimized] = useState(false);

  useEffect(() => {
    // Enable performance optimizations
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            // Lazy load content when it comes into view
            const img = entry.target as HTMLImageElement;
            if (img.dataset.src) {
              img.src = img.dataset.src;
            }
          }
        });
      },
      {
        rootMargin: "50px"
      }
    );

    // Observe all images with data-src attributes
    const images = document.querySelectorAll("img[data-src]");
    images.forEach(img => observer.observe(img));

    setIsOptimized(true);

    return () => {
      observer.disconnect();
    };
  }, []);

  return {
    isOptimized
  };
}

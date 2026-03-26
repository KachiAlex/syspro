"use client";

import React from "react";
import { 
  Loader2, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  Wifi,
  WifiOff,
  Database,
  FileText,
  Users,
  Activity,
  Clock,
  Zap
} from "lucide-react";

export interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  color?: "primary" | "secondary" | "success" | "error" | "warning";
}

export function LoadingSpinner({ 
  size = "md", 
  className = "", 
  color = "primary" 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
    xl: "w-12 h-12"
  };

  const colorClasses = {
    primary: "text-blue-600",
    secondary: "text-gray-600",
    success: "text-green-600",
    error: "text-red-600",
    warning: "text-yellow-600"
  };

  return (
    <div className={`${sizeClasses[size]} ${colorClasses[color]} ${className}`}>
      <Loader2 className="w-full h-full animate-spin" />
    </div>
  );
}

export interface LoadingProps {
  isLoading: boolean;
  message?: string;
  progress?: number;
  error?: string;
  children?: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function Loading({ 
  isLoading, 
  message, 
  progress, 
  error, 
  children, 
  className = "",
  size = "md"
}: LoadingProps) {
  if (!isLoading && !error && !children) {
    return null;
  }

  const sizeClasses = {
    sm: "p-4",
    md: "p-6",
    lg: "p-8"
  };

  return (
    <div className={`${sizeClasses[size]} ${className}`}>
      {error ? (
        <div className="flex items-center gap-3 text-red-600">
          <XCircle className="w-5 h-5" />
          <div>
            <p className="font-medium">Error</p>
            <p className="text-sm text-red-500">{error}</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <LoadingSpinner size={size} color="primary" />
          <div className="flex-1">
            {message && <p className="font-medium text-gray-900">{message}</p>}
            {progress !== undefined && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                ></div>
              </div>
            )}
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

export interface PageLoadingProps {
  message?: string;
  description?: string;
  showLogo?: boolean;
  className?: string;
}

export function PageLoading({ 
  message = "Loading...", 
  description = "Please wait while we load your content",
  showLogo = true,
  className = ""
}: PageLoadingProps) {
  return (
    <div className={`flex flex-col items-center justify-center min-h-screen ${className}`}>
      {showLogo && (
        <div className="mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center">
            <Zap className="w-8 h-8 text-white" />
          </div>
        </div>
      )}
      
      <LoadingSpinner size="lg" className="mb-4" />
      
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{message}</h2>
        <p className="text-gray-600">{description}</p>
      </div>
    </div>
  );
}

export interface SkeletonProps {
  className?: string;
  lines?: number;
  height?: string;
  width?: string;
  variant?: "text" | "avatar" | "button" | "card" | "table";
}

export function Skeleton({ 
  className = "", 
  lines = 3, 
  height = "h-4", 
  width = "w-full",
  variant = "text"
}: SkeletonProps) {
  if (variant === "avatar") {
    return (
      <div className={`w-10 h-10 bg-gray-200 rounded-full ${className}`}></div>
    );
  }

  if (variant === "button") {
    return (
      <div className={`h-10 bg-gray-200 rounded-lg ${width} ${className}`}></div>
    );
  }

  if (variant === "card") {
    return (
      <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
        <div className="space-y-2">
          <div className="h-3 bg-gray-200 rounded"></div>
          <div className="h-3 bg-gray-200 rounded w-5/6"></div>
          <div className="h-3 bg-gray-200 rounded w-4/6"></div>
        </div>
      </div>
    );
  }

  if (variant === "table") {
    return (
      <div className={`border border-gray-200 rounded-lg overflow-hidden ${className}`}>
        <div className="bg-gray-50 p-4 border-b border-gray-200">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        </div>
        <div className="divide-y divide-gray-200">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="p-4">
              <div className="grid grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, colIndex) => (
                  <div key={colIndex} className="h-4 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, index) => (
        <div key={index} className={`${height} ${width} bg-gray-200 rounded animate-pulse`}></div>
      ))}
    </div>
  );
}

export interface LoadingStateProps {
  state: "loading" | "error" | "success" | "empty";
  message?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function LoadingState({ 
  state, 
  message, 
  description, 
  action,
  className = ""
}: LoadingStateProps) {
  const getStateIcon = () => {
    switch (state) {
      case "loading":
        return <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />;
      case "error":
        return <XCircle className="w-8 h-8 text-red-600" />;
      case "success":
        return <CheckCircle className="w-8 h-8 text-green-600" />;
      case "empty":
        return <AlertCircle className="w-8 h-8 text-gray-400" />;
      default:
        return <AlertCircle className="w-8 h-8 text-gray-400" />;
    }
  };

  const getStateColor = () => {
    switch (state) {
      case "loading":
        return "text-blue-600";
      case "error":
        return "text-red-600";
      case "success":
        return "text-green-600";
      case "empty":
        return "text-gray-400";
      default:
        return "text-gray-400";
    }
  };

  const getStateMessage = () => {
    switch (state) {
      case "loading":
        return message || "Loading...";
      case "error":
        return message || "Something went wrong";
      case "success":
        return message || "Success!";
      case "empty":
        return message || "No data available";
      default:
        return message || "Unknown state";
    }
  };

  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center ${className}`}>
      <div className={`mb-4 ${getStateColor()}`}>
        {getStateIcon()}
      </div>
      
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {getStateMessage()}
      </h3>
      
      {description && (
        <p className="text-gray-600 mb-4">{description}</p>
      )}
      
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

export interface ConnectionStatusProps {
  isConnected: boolean;
  className?: string;
}

export function ConnectionStatus({ isConnected, className = "" }: ConnectionStatusProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {isConnected ? (
        <>
          <Wifi className="w-4 h-4 text-green-600" />
          <span className="text-sm text-green-600">Connected</span>
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4 text-red-600" />
          <span className="text-sm text-red-600">Disconnected</span>
        </>
      )}
    </div>
  );
}

export interface DataLoadingProps {
  isLoading: boolean;
  error?: string;
  data?: any;
  children: React.ReactNode;
  emptyMessage?: string;
  emptyDescription?: string;
  className?: string;
}

export function DataLoading({ 
  isLoading, 
  error, 
  data, 
  children, 
  emptyMessage = "No data available",
  emptyDescription = "There are no items to display",
  className = ""
}: DataLoadingProps) {
  if (isLoading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <LoadingState
        state="error"
        message="Error loading data"
        description={error}
        action={{
          label: "Retry",
          onClick: () => window.location.reload()
        }}
        className={className}
      />
    );
  }

  if (!data || (Array.isArray(data) && data.length === 0)) {
    return (
        <LoadingState
          state="empty"
          message={emptyMessage}
          description={emptyDescription}
          className={className}
        />
      );
  }

  return <>{children}</>;
}

export interface ProgressProps {
  value: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  color?: "primary" | "secondary" | "success" | "warning" | "error";
  showLabel?: boolean;
  label?: string;
  className?: string;
}

export function Progress({ 
  value, 
  max = 100, 
  size = "md", 
  color = "primary",
  showLabel = false,
  label,
  className = ""
}: ProgressProps) {
  const percentage = Math.min((value / max) * 100, 100);
  
  const sizeClasses = {
    sm: "h-1",
    md: "h-2",
    lg: "h-3"
  };

  const colorClasses = {
    primary: "bg-blue-600",
    secondary: "bg-gray-600",
    success: "bg-green-600",
    warning: "bg-yellow-600",
    error: "bg-red-600"
  };

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>{label || "Progress"}</span>
          <span>{percentage.toFixed(0)}%</span>
        </div>
      )}
      <div className={`w-full bg-gray-200 rounded-full ${sizeClasses[size]}`}>
        <div 
          className={`${colorClasses[color]} ${sizeClasses[size]} rounded-full transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
}

export interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  backdrop?: boolean;
  className?: string;
}

export function LoadingOverlay({ 
  isLoading, 
  message = "Loading...", 
  backdrop = true,
  className = ""
}: LoadingOverlayProps) {
  if (!isLoading) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${
      backdrop ? "bg-black bg-opacity-50" : ""
    } ${className}`}>
      <div className="bg-white rounded-lg p-6 shadow-xl">
        <LoadingSpinner size="lg" className="mb-4" />
        <p className="text-gray-900 font-medium">{message}</p>
      </div>
    </div>
  );
}

// Loading states for specific contexts
export function TableLoading({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-gray-50 p-4 border-b border-gray-200">
        <div className="h-4 bg-gray-200 rounded w-1/4"></div>
      </div>
      <div className="divide-y divide-gray-200">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="p-4">
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <div key={colIndex} className="h-4 bg-gray-200 rounded animate-pulse"></div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardLoading() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <Skeleton lines={3} />
    </div>
  );
}

export function ListLoading({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: items }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg">
          <Skeleton variant="avatar" />
          <div className="flex-1">
            <Skeleton lines={2} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Hook for loading states
export function useLoadingState(initialState = false) {
  const [isLoading, setIsLoading] = React.useState(initialState);
  const [error, setError] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<number>(0);

  const startLoading = React.useCallback(() => {
    setIsLoading(true);
    setError(null);
    setProgress(0);
  }, []);

  const stopLoading = React.useCallback(() => {
    setIsLoading(false);
    setProgress(0);
  }, []);

  const setLoadingError = React.useCallback((errorMessage: string) => {
    setError(errorMessage);
    setIsLoading(false);
    setProgress(0);
  }, []);

  const updateProgress = React.useCallback((value: number) => {
    setProgress(value);
  }, []);

  return {
    isLoading,
    error,
    progress,
    startLoading,
    stopLoading,
    setLoadingError,
    updateProgress,
  };
}

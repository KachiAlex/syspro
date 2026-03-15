"use client";

import React, { useEffect, useState } from "react";
import { ToastManager, ToastMessage } from "@/lib/error-handling";
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react";

export interface ToastProps {
  toast: ToastMessage;
  onRemove: (id: string) => void;
}

export function Toast({ toast, onRemove }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    setIsVisible(true);

    // Handle auto-removal
    if (!toast.persistent) {
      const duration = toast.duration || 5000;
      const timer = setTimeout(() => {
        setIsLeaving(true);
        setTimeout(() => onRemove(toast.id), 300);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [toast, onRemove]);

  const handleRemove = () => {
    setIsLeaving(true);
    setTimeout(() => onRemove(toast.id), 300);
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle className="w-5 h-5" />;
      case 'error':
        return <AlertCircle className="w-5 h-5" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5" />;
      case 'info':
        return <Info className="w-5 h-5" />;
      default:
        return <Info className="w-5 h-5" />;
    }
  };

  const getColors = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getIconColors = () => {
    switch (toast.type) {
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      case 'warning':
        return 'text-yellow-600';
      case 'info':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div
      className={`
        transform transition-all duration-300 ease-in-out
        ${isVisible && !isLeaving ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        ${isLeaving ? 'translate-x-full opacity-0' : ''}
      `}
    >
      <div className={`
        max-w-sm w-full bg-white border rounded-lg shadow-lg pointer-events-auto
        ${getColors()}
      `}>
        <div className="p-4">
          <div className="flex items-start">
            <div className={`flex-shrink-0 ${getIconColors()}`}>
              {getIcon()}
            </div>
            <div className="ml-3 w-0 flex-1">
              <p className="text-sm font-medium">
                {toast.title}
              </p>
              {toast.message && (
                <p className="mt-1 text-sm opacity-90">
                  {toast.message}
                </p>
              )}
              {toast.actions && toast.actions.length > 0 && (
                <div className="mt-3 flex gap-2">
                  {toast.actions.map((action, index) => (
                    <button
                      key={index}
                      onClick={action.action}
                      className={`
                        text-xs font-medium px-2 py-1 rounded transition-colors
                        ${action.variant === 'primary' 
                          ? 'bg-current text-white hover:opacity-90' 
                          : 'border border-current hover:bg-current hover:text-white'
                        }
                      `}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="ml-4 flex-shrink-0 flex">
              <button
                className="inline-flex rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-current"
                onClick={handleRemove}
              >
                <span className="sr-only">Dismiss</span>
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export interface ToastContainerProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  className?: string;
}

export function ToastContainer({ position = 'top-right', className = "" }: ToastContainerProps) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const toastManager = ToastManager.getInstance();
    
    // Subscribe to toast updates
    const unsubscribe = toastManager.subscribe(setToasts);
    
    return unsubscribe;
  }, []);

  const handleRemove = (id: string) => {
    const toastManager = ToastManager.getInstance();
    toastManager.removeToast(id);
  };

  const getPositionClasses = () => {
    switch (position) {
      case 'top-right':
        return 'top-4 right-4';
      case 'top-left':
        return 'top-4 left-4';
      case 'bottom-right':
        return 'bottom-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'top-center':
        return 'top-4 left-1/2 transform -translate-x-1/2';
      case 'bottom-center':
        return 'bottom-4 left-1/2 transform -translate-x-1/2';
      default:
        return 'top-4 right-4';
    }
  };

  const getFlexDirection = () => {
    return position.includes('bottom') ? 'flex-col-reverse' : 'flex-col';
  };

  return (
    <div
      className={`
        fixed z-50 flex max-h-screen w-full max-w-sm gap-2
        ${getPositionClasses()}
        ${getFlexDirection()}
        ${className}
      `}
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onRemove={handleRemove} />
      ))}
    </div>
  );
}

// Hook for using toast notifications
export function useToast() {
  const toastManager = ToastManager.getInstance();

  return {
    success: (title: string, message?: string, options?: Partial<ToastMessage>) => 
      toastManager.success(title, message, options),
    error: (title: string, message?: string, options?: Partial<ToastMessage>) => 
      toastManager.error(title, message, options),
    warning: (title: string, message?: string, options?: Partial<ToastMessage>) => 
      toastManager.warning(title, message, options),
    info: (title: string, message?: string, options?: Partial<ToastMessage>) => 
      toastManager.info(title, message, options),
    remove: (id: string) => toastManager.removeToast(id),
    clear: () => toastManager.clearToasts(),
    getToasts: () => toastManager.getToasts(),
  };
}

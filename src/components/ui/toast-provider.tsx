"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 4000);
  }, [removeToast]);

  const iconMap = {
    success: <CheckCircle className="w-5 h-5 text-green-400" />,
    error: <AlertCircle className="w-5 h-5 text-red-400" />,
    info: <Info className="w-5 h-5 text-blue-400" />,
  };

  const borderMap = {
    success: "border-green-500/20",
    error: "border-red-500/20",
    info: "border-blue-500/20",
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 bg-[#111827] border ${borderMap[t.type]} rounded-xl shadow-lg min-w-[280px] max-w-sm animate-in slide-in-from-right fade-in`}
          >
            {iconMap[t.type]}
            <p className="text-sm text-[#F8FAFC] flex-1">{t.message}</p>
            <button
              onClick={() => removeToast(t.id)}
              className="p-1 hover:bg-[rgba(255,255,255,0.05)] rounded transition-colors"
            >
              <X className="w-4 h-4 text-[#64748B]" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

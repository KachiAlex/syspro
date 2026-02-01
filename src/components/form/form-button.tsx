"use client";

import { ButtonHTMLAttributes } from "react";

interface FormButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "success";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export function FormButton({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  fullWidth = false,
  children,
  className = "",
  disabled,
  ...props
}: FormButtonProps) {
  const baseClasses = "inline-flex items-center justify-center gap-2 font-medium rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  const variantClasses = {
    primary: "bg-slate-900 text-white hover:bg-slate-800 disabled:hover:bg-slate-900",
    secondary: "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50 disabled:hover:bg-white",
    danger: "bg-rose-600 text-white hover:bg-rose-700 disabled:hover:bg-rose-600",
    success: "bg-emerald-600 text-white hover:bg-emerald-700 disabled:hover:bg-emerald-600",
  };

  const sizeClasses = {
    sm: "px-3 py-1 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  return (
    <button
      {...props}
      disabled={loading || disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${fullWidth ? "w-full" : ""} ${className}`}
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {icon && !loading && icon}
      <span>{loading ? "Loading..." : children}</span>
    </button>
  );
}

"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#0a0a0a",
          color: "#e5e5e5",
          gap: "1rem",
        }}>
          <h1 style={{ fontSize: "1.875rem", fontWeight: 700 }}>
            Something went wrong
          </h1>
          <p style={{ color: "#a3a3a3", maxWidth: "28rem", textAlign: "center" }}>
            An unexpected error occurred. You can try again or return to the dashboard.
          </p>
          {error.digest && (
            <p style={{ fontSize: "0.75rem", color: "#525252" }}>
              Error ID: {error.digest}
            </p>
          )}
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              onClick={reset}
              style={{
                padding: "0.5rem 1.25rem",
                background: "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: "0.375rem",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              Try again
            </button>
            <Link
              href="/"
              style={{
                padding: "0.5rem 1.25rem",
                background: "transparent",
                color: "#a3a3a3",
                border: "1px solid #404040",
                borderRadius: "0.375rem",
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              Go home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}

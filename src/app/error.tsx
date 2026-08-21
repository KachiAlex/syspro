"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[error-boundary]", error);
  }, [error]);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "60vh",
      gap: "1rem",
      padding: "2rem",
    }}>
      <h2 style={{ fontSize: "1.5rem", fontWeight: 600 }}>
        Something went wrong
      </h2>
      <p style={{ color: "#737373", maxWidth: "24rem", textAlign: "center" }}>
        {error.message || "An unexpected error occurred while loading this page."}
      </p>
      {error.digest && (
        <p style={{ fontSize: "0.75rem", color: "#a3a3a3" }}>
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
            color: "#737373",
            border: "1px solid #d4d4d4",
            borderRadius: "0.375rem",
            textDecoration: "none",
            fontWeight: 500,
          }}
        >
          Go home
        </Link>
      </div>
    </div>
  );
}

import Link from "next/link";

export default function NotFound() {
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
      <h1 style={{ fontSize: "3rem", fontWeight: 800, color: "#404040" }}>
        404
      </h1>
      <p style={{ color: "#737373", fontSize: "1.125rem" }}>
        This page could not be found.
      </p>
      <Link
        href="/"
        style={{
          padding: "0.5rem 1.25rem",
          background: "#2563eb",
          color: "#fff",
          borderRadius: "0.375rem",
          textDecoration: "none",
          fontWeight: 500,
        }}
      >
        Go home
      </Link>
    </div>
  );
}

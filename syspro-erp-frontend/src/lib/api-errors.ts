import { NextResponse } from "next/server";

export function handleDatabaseError(error: unknown, operation: string) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`${operation} failed:`, error);

  // Check for database configuration issues
  if (message.includes("DATABASE_URL")) {
    return NextResponse.json(
      {
        error: "Database not configured. Contact system administrator.",
        details: message,
      },
      { status: 500 }
    );
  }

  // Check for connection errors
  if (
    message.includes("ECONNREFUSED") ||
    message.includes("ENOTFOUND") ||
    message.includes("connection")
  ) {
    return NextResponse.json(
      {
        error: "Database connection failed. Please try again later.",
        details: message,
      },
      { status: 503 }
    );
  }

  // Generic database error
  return NextResponse.json(
    {
      error: `${operation} failed`,
      details: message,
    },
    { status: 500 }
  );
}

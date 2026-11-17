import { NextResponse } from "next/server";

/**
 * Validates that an identifier (e.g. employeeId, departmentId) is a clean primitive string.
 * Strictly rejects objects, arrays, injection operators (e.g. {"$gt": ""}), and special characters.
 */
export function isValidId(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 64) {
    return false;
  }
  // Allow alphanumeric, underscores, and hyphens (standard for CUIDs, UUIDs, and custom employee IDs)
  return /^[a-zA-Z0-9_-]+$/.test(trimmed);
}

/**
 * Returns a standardized, sanitized HTTP 400 Bad Request response.
 */
export function badRequestResponse(message = "Invalid request parameters.") {
  return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * Returns a standardized, sanitized HTTP 500 Internal Server Error response.
 * Completely strips stack traces, Prisma AST queries, and server filesystem paths.
 */
export function safeErrorResponse(
  error: unknown,
  fallbackMessage = "An unexpected error occurred while processing your request.",
  status = 500
) {
  // Always log the full detail server-side for internal diagnostics
  console.error("[Internal Server Error]:", error);

  // Return sanitized generic message to prevent reconnaissance
  return NextResponse.json(
    { error: fallbackMessage },
    { status }
  );
}

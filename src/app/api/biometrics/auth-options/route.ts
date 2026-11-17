import { NextRequest, NextResponse } from "next/server";
import { createAuthenticationChallenge } from "@/lib/webauthn";
import { isValidId, badRequestResponse, safeErrorResponse } from "@/lib/validation";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

// POST /api/biometrics/auth-options
export async function POST(req: NextRequest) {
  // 1. Enforce rate limiting to prevent automated enumeration
  const rateLimit = checkRateLimit(req, 20, 60 * 1000);
  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(rateLimit.resetMs);
  }

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return badRequestResponse("Invalid JSON payload.");
    }

    const { employeeId } = body || {};

    // 2. Strict primitive type validation
    if (!isValidId(employeeId)) {
      return badRequestResponse("Valid employeeId is required.");
    }

    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
    const options = await createAuthenticationChallenge(employeeId, host);

    return NextResponse.json(options);
  } catch (error: any) {
    // If it's a known user-facing validation error from webauthn challenge generation
    if (
      typeof error?.message === "string" &&
      error.message.includes("No biometric passkey registered")
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return safeErrorResponse(error, "Failed to generate authentication challenge.", 500);
  }
}

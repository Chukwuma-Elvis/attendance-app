import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createRegistrationChallenge } from "@/lib/webauthn";
import { isValidId, badRequestResponse, safeErrorResponse } from "@/lib/validation";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

// POST /api/biometrics/register-options
export async function POST(req: NextRequest) {
  // 1. Enforce rate limiting
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

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        biometricCredentials: true,
      },
    });

    if (!employee || !employee.active) {
      return NextResponse.json({ error: "Active employee not found." }, { status: 404 });
    }

    const hasExistingBiometrics = employee.biometricCredentials.length > 0;

    // If biometrics are already registered, admin permission is strictly required
    if (hasExistingBiometrics && !employee.biometricResetAllowed) {
      return NextResponse.json(
        {
          error:
            "Biometric device is already registered. You must obtain administrator authorization before changing your biometric device.",
          requiresAdminPermission: true,
          biometricResetRequested: employee.biometricResetRequested,
        },
        { status: 403 }
      );
    }

    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
    const options = await createRegistrationChallenge(employee, host);

    return NextResponse.json(options);
  } catch (error) {
    return safeErrorResponse(error, "Failed to generate biometric registration options.", 500);
  }
}

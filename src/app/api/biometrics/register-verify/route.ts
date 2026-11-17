import { NextRequest, NextResponse } from "next/server";
import { verifyAndSaveRegistration } from "@/lib/webauthn";
import { isValidId, badRequestResponse, safeErrorResponse } from "@/lib/validation";

export const runtime = "nodejs";

// POST /api/biometrics/register-verify
export async function POST(req: NextRequest) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return badRequestResponse("Invalid JSON payload.");
    }

    const { employeeId, response, deviceName } = body || {};

    if (!isValidId(employeeId)) {
      return badRequestResponse("Valid employeeId is required.");
    }

    if (!response || typeof response !== "object") {
      return badRequestResponse("Biometric authentication response object is required.");
    }

    const cleanDeviceName =
      typeof deviceName === "string" ? deviceName.slice(0, 100).trim() : undefined;

    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
    const verification = await verifyAndSaveRegistration(employeeId, response, host, cleanDeviceName);

    if (verification.verified) {
      return NextResponse.json({
        verified: true,
        message: "Biometric passkey registered successfully! You can now check in with your phone.",
      });
    }

    return NextResponse.json(
      { verified: false, error: "Biometric verification failed." },
      { status: 400 }
    );
  } catch (error: any) {
    if (
      typeof error?.message === "string" &&
      (error.message.includes("challenge has expired") ||
        error.message.includes("Verification failed") ||
        error.message.includes("expected"))
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return safeErrorResponse(error, "Biometric registration verification failed.", 500);
  }
}

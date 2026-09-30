import { NextRequest, NextResponse } from "next/server";
import { verifyAndSaveRegistration } from "@/lib/webauthn";

export const runtime = "nodejs";

// POST /api/biometrics/register-verify
export async function POST(req: NextRequest) {
  try {
    const { employeeId, response, deviceName } = await req.json();

    if (!employeeId || !response) {
      return NextResponse.json({ error: "employeeId and biometric response are required." }, { status: 400 });
    }

    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
    const verification = await verifyAndSaveRegistration(employeeId, response, host, deviceName);

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
    console.error("Biometric registration verification error:", error);
    return NextResponse.json(
      { error: error?.message || "Biometric verification failed." },
      { status: 400 }
    );
  }
}

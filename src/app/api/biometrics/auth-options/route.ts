import { NextRequest, NextResponse } from "next/server";
import { createAuthenticationChallenge } from "@/lib/webauthn";

export const runtime = "nodejs";

// POST /api/biometrics/auth-options
export async function POST(req: NextRequest) {
  try {
    const { employeeId } = await req.json();

    if (!employeeId) {
      return NextResponse.json({ error: "employeeId is required." }, { status: 400 });
    }

    const host = req.headers.get("host") || "localhost:3000";
    const options = await createAuthenticationChallenge(employeeId, host);

    return NextResponse.json(options);
  } catch (error: any) {
    console.error("Failed to generate authentication challenge:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate authentication challenge." },
      { status: 400 }
    );
  }
}

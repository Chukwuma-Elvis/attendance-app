import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createRegistrationChallenge } from "@/lib/webauthn";

export const runtime = "nodejs";

// POST /api/biometrics/register-options
export async function POST(req: NextRequest) {
  try {
    const { employeeId } = await req.json();

    if (!employeeId) {
      return NextResponse.json({ error: "employeeId is required." }, { status: 400 });
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

    const host = req.headers.get("host") || "localhost:3000";
    const options = await createRegistrationChallenge(employee, host);

    return NextResponse.json(options);
  } catch (error: any) {
    console.error("Failed to generate biometric registration options:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate biometric registration options." },
      { status: 500 }
    );
  }
}

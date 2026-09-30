import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

// POST /api/employees/[id]/biometrics
// Actions: "ALLOW_RESET" | "REVOKE" | "REJECT_RESET"
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id: employeeId } = await params;
  const body = await req.json();
  const { action } = body;

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, departmentId: session.departmentId },
    include: { biometricCredentials: true },
  });

  if (!employee) {
    return NextResponse.json({ error: "Employee not found in your department." }, { status: 404 });
  }

  if (action === "ALLOW_RESET") {
    // Grant permission for the employee to register a new biometric device
    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        biometricResetAllowed: true,
        biometricResetRequested: false,
      },
    });

    // Mark pending changes as approved
    await prisma.pendingChange.updateMany({
      where: {
        departmentId: session.departmentId,
        kind: "BIOMETRIC_RESET",
        status: "PENDING",
        payload: {
          path: ["employeeId"],
          equals: employee.id,
        },
      },
      data: {
        status: "APPROVED",
        resolvedAt: new Date(),
        resolvedBy: session.username,
      },
    });

    return NextResponse.json({
      ok: true,
      success: true,
      message: `Permission granted! ${employee.name} can now register their new device biometric from the check-in portal.`,
    });
  } else if (action === "REVOKE") {
    // Delete existing credentials completely
    await prisma.biometricCredential.deleteMany({
      where: { employeeId: employee.id },
    });

    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        biometricResetAllowed: false,
        biometricResetRequested: false,
      },
    });

    return NextResponse.json({
      ok: true,
      success: true,
      message: `Biometric credentials for ${employee.name} have been revoked and cleared.`,
    });
  } else if (action === "REJECT_RESET") {
    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        biometricResetRequested: false,
      },
    });

    await prisma.pendingChange.updateMany({
      where: {
        departmentId: session.departmentId,
        kind: "BIOMETRIC_RESET",
        status: "PENDING",
        payload: {
          path: ["employeeId"],
          equals: employee.id,
        },
      },
      data: {
        status: "REJECTED",
        resolvedAt: new Date(),
        resolvedBy: session.username,
      },
    });

    return NextResponse.json({
      ok: true,
      success: true,
      message: `Biometric change request for ${employee.name} was rejected.`,
    });
  }

  return NextResponse.json({ error: "Invalid action. Supported: ALLOW_RESET, REVOKE, REJECT_RESET." }, { status: 400 });
}

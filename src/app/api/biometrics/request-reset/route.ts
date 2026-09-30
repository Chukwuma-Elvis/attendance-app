import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

// POST /api/biometrics/request-reset
// Called by an employee from the check-in portal when they need to change/re-register their device
export async function POST(req: NextRequest) {
  try {
    const { employeeId } = await req.json();

    if (!employeeId) {
      return NextResponse.json({ error: "employeeId is required." }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        department: true,
        biometricCredentials: true,
      },
    });

    if (!employee || !employee.active) {
      return NextResponse.json({ error: "Active employee not found." }, { status: 404 });
    }

    if (employee.biometricCredentials.length === 0) {
      return NextResponse.json(
        { message: "Initial biometric setup does not require admin permission. You can register now." },
        { status: 200 }
      );
    }

    if (employee.biometricResetAllowed) {
      return NextResponse.json(
        { message: "Admin permission has already been granted! You can register your new device now." },
        { status: 200 }
      );
    }

    if (employee.biometricResetRequested) {
      return NextResponse.json(
        { message: "Your biometric change request has already been submitted and is awaiting admin approval." },
        { status: 200 }
      );
    }

    // Set flag on employee
    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        biometricResetRequested: true,
      },
    });

    // Create a pending change for admin review
    await prisma.pendingChange.create({
      data: {
        departmentId: employee.departmentId,
        kind: "BIOMETRIC_RESET",
        summary: `Biometric device change requested for ${employee.name} (${employee.role}).`,
        payload: {
          employeeId: employee.id,
          employeeName: employee.name,
          employeeRole: employee.role,
        },
        requestedBy: `${employee.name} (Employee Self-Service)`,
      },
    });

    return NextResponse.json({
      ok: true,
      success: true,
      message: "Biometric change request submitted! An administrator must approve it before you can pair a new device.",
    });
  } catch (error: any) {
    console.error("Failed to request biometric reset:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to submit biometric change request." },
      { status: 500 }
    );
  }
}

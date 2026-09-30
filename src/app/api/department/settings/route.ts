import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

// GET /api/department/settings
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const department = await prisma.department.findUnique({
    where: { id: session.departmentId },
    select: {
      id: true,
      name: true,
      venueName: true,
      venueLatitude: true,
      venueLongitude: true,
      venueRadiusMeters: true,
      checkInStartTime: true,
      checkInCutoffTime: true,
      checkInEndTime: true,
      checkOutStartTime: true,
      checkOutEndTime: true,
    },
  });

  if (!department) {
    return NextResponse.json({ error: "Department not found." }, { status: 404 });
  }

  return NextResponse.json(department);
}

// PATCH /api/department/settings (Admin / Owner only)
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  if (session.role !== "OWNER") {
    return NextResponse.json(
      { error: "Only department Owners / Admins can modify venue and shift timing settings." },
      { status: 403 }
    );
  }

  const body = await req.json();
  const {
    venueName,
    venueLatitude,
    venueLongitude,
    venueRadiusMeters,
    checkInStartTime,
    checkInCutoffTime,
    checkInEndTime,
    checkOutStartTime,
    checkOutEndTime,
  } = body;

  const dataToUpdate: Record<string, any> = {};

  if (venueName !== undefined) dataToUpdate.venueName = venueName ? String(venueName).trim() : null;
  if (venueLatitude !== undefined) {
    dataToUpdate.venueLatitude = venueLatitude === null || venueLatitude === "" ? null : Number(venueLatitude);
  }
  if (venueLongitude !== undefined) {
    dataToUpdate.venueLongitude = venueLongitude === null || venueLongitude === "" ? null : Number(venueLongitude);
  }
  if (venueRadiusMeters !== undefined) {
    dataToUpdate.venueRadiusMeters = Math.max(10, Number(venueRadiusMeters) || 100);
  }
  if (checkInStartTime !== undefined) dataToUpdate.checkInStartTime = String(checkInStartTime);
  if (checkInCutoffTime !== undefined) dataToUpdate.checkInCutoffTime = String(checkInCutoffTime);
  if (checkInEndTime !== undefined) dataToUpdate.checkInEndTime = String(checkInEndTime);
  if (checkOutStartTime !== undefined) dataToUpdate.checkOutStartTime = String(checkOutStartTime);
  if (checkOutEndTime !== undefined) dataToUpdate.checkOutEndTime = String(checkOutEndTime);

  const updated = await prisma.department.update({
    where: { id: session.departmentId },
    data: dataToUpdate,
  });

  return NextResponse.json({
    success: true,
    department: {
      id: updated.id,
      name: updated.name,
      venueName: updated.venueName,
      venueLatitude: updated.venueLatitude,
      venueLongitude: updated.venueLongitude,
      venueRadiusMeters: updated.venueRadiusMeters,
      checkInStartTime: updated.checkInStartTime,
      checkInCutoffTime: updated.checkInCutoffTime,
      checkInEndTime: updated.checkInEndTime,
      checkOutStartTime: updated.checkOutStartTime,
      checkOutEndTime: updated.checkOutEndTime,
    },
  });
}

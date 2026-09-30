import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/check-in/departments
// Public endpoint for mobile employee check-in portal
export async function GET() {
  const departments = await prisma.department.findMany({
    orderBy: { name: "asc" },
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
      employees: {
        where: { active: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          role: true,
          workingDays: true,
          biometricResetRequested: true,
          biometricResetAllowed: true,
          _count: {
            select: { biometricCredentials: true },
          },
        },
      },
    },
  });

  const formatted = departments.map((d) => ({
    id: d.id,
    name: d.name,
    venueName: d.venueName || "Configured Workplace Venue",
    hasVenueLocation: d.venueLatitude !== null && d.venueLongitude !== null,
    venueLatitude: d.venueLatitude,
    venueLongitude: d.venueLongitude,
    venueRadiusMeters: d.venueRadiusMeters,
    shifts: {
      checkInStart: d.checkInStartTime,
      checkInCutoff: d.checkInCutoffTime,
      checkInEnd: d.checkInEndTime,
      checkOutStart: d.checkOutStartTime,
      checkOutEnd: d.checkOutEndTime,
    },
    employees: d.employees.map((e) => ({
      id: e.id,
      name: e.name,
      role: e.role,
      workingDays: e.workingDays,
      hasBiometricsRegistered: e._count.biometricCredentials > 0,
      biometricResetRequested: e.biometricResetRequested,
      biometricResetAllowed: e.biometricResetAllowed,
    })),
  }));

  return NextResponse.json(formatted, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

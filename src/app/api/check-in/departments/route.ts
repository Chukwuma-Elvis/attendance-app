import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { safeErrorResponse } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/check-in/departments
// Hardened public endpoint for mobile employee check-in portal:
// - Redacts sensitive venue GPS coordinates (venueLatitude, venueLongitude, venueRadiusMeters)
// - Redacts internal employee roles and database credential hashes
// - Authoritative physical distance verification is strictly performed server-side on POST /api/check-in
export async function GET() {
  try {
    const departments = await prisma.department.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        venueName: true,
        venueLatitude: true,
        venueLongitude: true,
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
            workingDays: true,
            biometricResetRequested: true,
            biometricResetAllowed: true,
            customCheckInStartTime: true,
            customCheckInCutoffTime: true,
            customCheckInEndTime: true,
            customCheckOutStartTime: true,
            customCheckOutEndTime: true,
            pinCheckInAllowed: true,
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
      venueName: d.venueName || "Assigned Workplace Venue",
      hasVenueLocation: d.venueLatitude !== null && d.venueLongitude !== null,
      // Redacted to prevent physical reconnaissance; geofencing is verified server-side on check-in submission
      venueLatitude: null,
      venueLongitude: null,
      venueRadiusMeters: 0,
      shifts: {
        checkInStart: d.checkInStartTime,
        checkInCutoff: d.checkInCutoffTime,
        checkInEnd: d.checkInEndTime,
        checkOutStart: d.checkOutStartTime,
        checkOutEnd: d.checkOutEndTime,
      },
      employees: d.employees.map((e) => {
        const hasCustom = Boolean(
          e.customCheckInStartTime ||
            e.customCheckInCutoffTime ||
            e.customCheckInEndTime ||
            e.customCheckOutStartTime ||
            e.customCheckOutEndTime
        );

        return {
          id: e.id,
          name: e.name,
          workingDays: e.workingDays,
          hasBiometricsRegistered: e._count.biometricCredentials > 0,
          biometricResetRequested: e.biometricResetRequested,
          biometricResetAllowed: e.biometricResetAllowed,
          pinCheckInAllowed: Boolean(e.pinCheckInAllowed),
          customShifts: hasCustom
            ? {
                checkInStart: e.customCheckInStartTime || d.checkInStartTime,
                checkInCutoff: e.customCheckInCutoffTime || d.checkInCutoffTime,
                checkInEnd: e.customCheckInEndTime || d.checkInEndTime,
                checkOutStart: e.customCheckOutStartTime || d.checkOutStartTime,
                checkOutEnd: e.customCheckOutEndTime || d.checkOutEndTime,
              }
            : null,
        };
      }),
    }));

    return NextResponse.json(formatted, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    return safeErrorResponse(error, "Failed to retrieve department check-in options.", 500);
  }
}

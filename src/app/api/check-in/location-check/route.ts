import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyGeofence } from "@/lib/geo";
import { isValidId, badRequestResponse, safeErrorResponse } from "@/lib/validation";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

// POST /api/check-in/location-check
// Secure pre-flight proximity verification:
// - Evaluates whether client GPS coordinates are within department venue radius
// - Returns proximity verdict (isInsideGeofence, distanceMeters, allowedRadiusMeters)
// - NEVER discloses raw venueLatitude or venueLongitude to the client
export async function POST(req: NextRequest) {
  // 1. Rate limiting (max 30 location checks per minute per IP)
  const rateLimit = checkRateLimit(req, 30, 60 * 1000);
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

    const { departmentId, latitude, longitude } = body || {};

    if (!isValidId(departmentId)) {
      return badRequestResponse("Valid departmentId is required.");
    }

    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      isNaN(latitude) ||
      isNaN(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return badRequestResponse(
        "Valid GPS coordinates (latitude [-90,90], longitude [-180,180]) are required."
      );
    }

    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      select: {
        id: true,
        venueName: true,
        venueLatitude: true,
        venueLongitude: true,
        venueRadiusMeters: true,
      },
    });

    if (!department) {
      return NextResponse.json({ error: "Department not found." }, { status: 404 });
    }

    const hasVenueLocation =
      department.venueLatitude !== null && department.venueLongitude !== null;

    if (!hasVenueLocation) {
      return NextResponse.json({
        hasVenueLocation: false,
        isInsideGeofence: true,
        distanceMeters: null,
        allowedRadiusMeters: department.venueRadiusMeters,
        venueName: department.venueName || "Assigned Workplace Venue",
      });
    }

    const geofence = verifyGeofence(
      latitude,
      longitude,
      department.venueLatitude,
      department.venueLongitude,
      department.venueRadiusMeters
    );

    return NextResponse.json({
      hasVenueLocation: true,
      isInsideGeofence: geofence.isWithinGeofence,
      distanceMeters: geofence.distanceMeters,
      allowedRadiusMeters: geofence.allowedRadiusMeters,
      venueName: department.venueName || "Assigned Workplace Venue",
    });
  } catch (error) {
    return safeErrorResponse(error, "Failed to verify location proximity.", 500);
  }
}

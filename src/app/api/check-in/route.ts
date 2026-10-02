import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAuthentication } from "@/lib/webauthn";
import {
  verifyGeofence,
  evaluateCheckInTime,
  evaluateCheckOutTime,
  isOvernightDepartment,
  getLogicalShiftDate,
} from "@/lib/geo";

export const runtime = "nodejs";

function getLocalDateString(d: Date, clientDate?: string): string {
  if (clientDate && /^\d{4}-\d{2}-\d{2}$/.test(clientDate)) {
    return clientDate;
  }
  return d.toISOString().slice(0, 10);
}

function getLocalTimeString(d: Date, clientTime?: string): string {
  if (clientTime && /^\d{1,2}:\d{2}$/.test(clientTime)) {
    const parts = clientTime.split(":");
    return `${parts[0].padStart(2, "0")}:${parts[1]}`;
  }
  // Fall back to server's local time (not UTC)
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${mins}`;
}

// POST /api/check-in
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      employeeId,
      response,
      latitude,
      longitude,
      action = "CHECK_IN",
      clientTime,
      clientDate,
    } = body;

    if (!employeeId) {
      return NextResponse.json({ error: "employeeId is required." }, { status: 400 });
    }

    if (
      latitude === undefined ||
      latitude === null ||
      longitude === undefined ||
      longitude === null ||
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      isNaN(latitude) ||
      isNaN(longitude)
    ) {
      return NextResponse.json(
        {
          error:
            "Location access is strictly required to verify physical attendance. Please grant location access on your phone.",
        },
        { status: 400 }
      );
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return NextResponse.json(
        { error: "Invalid GPS coordinates received. Please re-enable location and try again." },
        { status: 400 }
      );
    }

    if (!response) {
      return NextResponse.json(
        { error: "Biometric authentication signature is required." },
        { status: 400 }
      );
    }

    // 1. Fetch employee and their department settings
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        department: true,
      },
    });

    if (!employee || !employee.active) {
      return NextResponse.json({ error: "Active employee not found." }, { status: 404 });
    }

    const { department } = employee;
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";

    // 2. Verify Phone Biometric Signature (WebAuthn Passkey)
    const verification = await verifyAuthentication(employeeId, response, host);
    if (!verification.verified) {
      return NextResponse.json(
        { error: "Biometric identity verification failed. Please try again." },
        { status: 401 }
      );
    }

    // 3. Verify Geofence / Location
    const geofence = verifyGeofence(
      Number(latitude),
      Number(longitude),
      department.venueLatitude,
      department.venueLongitude,
      department.venueRadiusMeters
    );

    if (!geofence.isWithinGeofence) {
      return NextResponse.json(
        {
          error: `Location check failed: You are ${geofence.distanceMeters} meters away from ${
            department.venueName || "the assigned workplace venue"
          }. Maximum allowed radius is ${geofence.allowedRadiusMeters} meters.`,
          distanceMeters: geofence.distanceMeters,
          allowedRadiusMeters: geofence.allowedRadiusMeters,
        },
        { status: 403 }
      );
    }

    // 4. Determine Date & Time (using local wall clock)
    const now = new Date();
    const dateStr = getLocalDateString(now, clientDate);
    const timeStr = getLocalTimeString(now, clientTime);

    // Detect if this department operates an overnight shift spanning into the next morning
    const isOvernight = isOvernightDepartment({
      checkInStart: department.checkInStartTime,
      checkInEnd: department.checkInEndTime,
      checkOutStart: department.checkOutStartTime,
      checkOutEnd: department.checkOutEndTime,
    });

    // Logical shift date maps early-morning check-ins/check-outs back to the night the shift started
    const shiftDateStr = getLogicalShiftDate(
      dateStr,
      timeStr,
      department.checkInStartTime,
      isOvernight
    );
    const shiftDateObj = new Date(`${shiftDateStr}T00:00:00.000Z`);

    // Check existing attendance record for the shift date
    let existingAttendance = await prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId: employee.id,
          date: shiftDateObj,
        },
      },
    });

    // Fallback for CHECK_OUT: if no record is found on shiftDateObj,
    // look for the most recent open check-in (within 24h) for this employee
    if (action === "CHECK_OUT" && !existingAttendance) {
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      existingAttendance = await prisma.attendance.findFirst({
        where: {
          employeeId: employee.id,
          checkInTime: { gte: twentyFourHoursAgo },
          checkOutTime: null,
        },
        orderBy: { checkInTime: "desc" },
      });
    }

    if (action === "CHECK_IN") {
      // Check if already checked in today
      if (existingAttendance?.checkInTime) {
        return NextResponse.json({
          success: true,
          alreadyCheckedIn: true,
          message: `Already checked in today at ${existingAttendance.checkInTime.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}.`,
          attendance: existingAttendance,
        });
      }

      // Check shift timing rules
      const shiftEvaluation = evaluateCheckInTime(
        timeStr,
        department.checkInStartTime,
        department.checkInCutoffTime,
        department.checkInEndTime
      );

      if (!shiftEvaluation.allowed) {
        return NextResponse.json(
          { error: shiftEvaluation.message },
          { status: 400 }
        );
      }

      const status = shiftEvaluation.status || "PRESENT";
      const note = status === "LATE" ? `Mobile Biometric: ${shiftEvaluation.message}` : null;

      // Upsert attendance record
      const attendance = await prisma.attendance.upsert({
        where: {
          employeeId_date: {
            employeeId: employee.id,
            date: shiftDateObj,
          },
        },
        create: {
          employeeId: employee.id,
          date: shiftDateObj,
          status,
          note,
          checkInTime: now,
          checkInLat: Number(latitude),
          checkInLng: Number(longitude),
          checkInMethod: "BIOMETRIC_MOBILE",
        },
        update: {
          status,
          note: existingAttendance?.note ? `${existingAttendance.note} | ${note}` : note,
          checkInTime: now,
          checkInLat: Number(latitude),
          checkInLng: Number(longitude),
          checkInMethod: "BIOMETRIC_MOBILE",
        },
      });

      return NextResponse.json({
        success: true,
        action: "CHECK_IN",
        status: attendance.status,
        checkInTime: now.toISOString(),
        distanceMeters: geofence.distanceMeters,
        message:
          status === "PRESENT"
            ? `Checked in on time at ${timeStr}. Attendance marked as PRESENT.`
            : `Checked in late at ${timeStr}. Attendance marked as LATE.`,
        attendance,
      });
    } else if (action === "CHECK_OUT") {
      if (!existingAttendance) {
        return NextResponse.json(
          { error: "No check-in record found for this shift. You must check in before checking out." },
          { status: 400 }
        );
      }

      if (existingAttendance.checkOutTime) {
        return NextResponse.json({
          success: true,
          alreadyCheckedOut: true,
          message: `Already checked out for this shift at ${existingAttendance.checkOutTime.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}.`,
          attendance: existingAttendance,
        });
      }

      const checkOutEval = evaluateCheckOutTime(
        timeStr,
        department.checkOutStartTime,
        department.checkOutEndTime
      );

      if (!checkOutEval.allowed) {
        return NextResponse.json({ error: checkOutEval.message }, { status: 400 });
      }

      const updated = await prisma.attendance.update({
        where: { id: existingAttendance.id },
        data: {
          checkOutTime: now,
          checkOutLat: Number(latitude),
          checkOutLng: Number(longitude),
          checkOutMethod: "BIOMETRIC_MOBILE",
        },
      });

      return NextResponse.json({
        success: true,
        action: "CHECK_OUT",
        checkOutTime: now.toISOString(),
        distanceMeters: geofence.distanceMeters,
        message: `Successfully checked out at ${timeStr}. Have a great rest!`,
        attendance: updated,
      });
    }

    return NextResponse.json({ error: "Invalid action. Expected CHECK_IN or CHECK_OUT." }, { status: 400 });
  } catch (error: any) {
    console.error("Check-in error:", error);
    return NextResponse.json(
      { error: error?.message || "Check-in failed due to server error." },
      { status: 500 }
    );
  }
}

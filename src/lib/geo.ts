/**
 * Geolocation & Haversine Distance Calculation Utilities
 */

/**
 * Calculates great-circle distance in meters between two coordinates using the Haversine formula.
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export type GeofenceCheckResult = {
  isWithinGeofence: boolean;
  distanceMeters: number;
  allowedRadiusMeters: number;
};

/**
 * Checks if the user's location is within the venue's configured geofence radius.
 */
export function verifyGeofence(
  userLat: number,
  userLng: number,
  venueLat: number | null,
  venueLng: number | null,
  allowedRadiusMeters: number
): GeofenceCheckResult {
  // If venue coordinates are not yet set by admin, allow check-in with a notice
  if (venueLat === null || venueLng === null) {
    return {
      isWithinGeofence: true,
      distanceMeters: 0,
      allowedRadiusMeters,
    };
  }

  const distance = calculateDistanceMeters(userLat, userLng, venueLat, venueLng);
  return {
    isWithinGeofence: distance <= allowedRadiusMeters,
    distanceMeters: distance,
    allowedRadiusMeters,
  };
}

/**
 * Time shift validation utilities & overnight shift support
 */
export function timeToMinutes(t: string): number {
  if (!t || typeof t !== "string") return 0;
  const parts = t.split(":");
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

/**
 * Determines whether a department operates an overnight shift spanning into the next calendar day.
 */
export function isOvernightDepartment(shifts: {
  checkInStart: string;
  checkOutStart: string;
  checkInEnd?: string;
  checkOutEnd?: string;
}): boolean {
  const inStart = timeToMinutes(shifts.checkInStart);
  const outStart = timeToMinutes(shifts.checkOutStart);

  // If checkout opens at a numerically earlier hour than checkin starts (e.g. checkin 20:00, checkout 01:00)
  if (outStart < inStart) return true;

  // If check-in window itself crosses midnight (e.g. 21:00 to 02:00)
  if (shifts.checkInEnd && timeToMinutes(shifts.checkInEnd) < inStart) return true;

  // If check-out window itself crosses midnight (e.g. 23:30 to 04:00)
  if (shifts.checkOutEnd && timeToMinutes(shifts.checkOutEnd) < outStart) return true;

  return false;
}

/**
 * Checks whether currentTime is within [startTime, endTime], correctly handling
 * windows that cross midnight (e.g. 22:00 - 04:00 or 01:00 - 05:00).
 */
export function isTimeInWindow(
  currentTimeStr: string,
  startTimeStr: string,
  endTimeStr: string
): boolean {
  const curr = timeToMinutes(currentTimeStr);
  const start = timeToMinutes(startTimeStr);
  const end = timeToMinutes(endTimeStr);

  if (start <= end) {
    // Standard window on the same calendar day (e.g. 08:00 to 17:00, or 01:00 to 05:00)
    return curr >= start && curr <= end;
  } else {
    // Window crosses midnight (e.g. 22:00 to 04:00)
    return curr >= start || curr <= end;
  }
}

export type ShiftTimeEvaluation = {
  allowed: boolean;
  status?: "PRESENT" | "LATE";
  message?: string;
};

/**
 * Evaluates whether current time is within check-in window and whether it is marked LATE or PRESENT.
 * Fully supports overnight shifts and cross-midnight check-in windows.
 */
export function evaluateCheckInTime(
  currentTimeStr: string,
  startTimeStr: string,
  cutoffTimeStr: string,
  endTimeStr: string
): ShiftTimeEvaluation {
  const curr = timeToMinutes(currentTimeStr);
  const start = timeToMinutes(startTimeStr);
  const cutoff = timeToMinutes(cutoffTimeStr);
  const end = timeToMinutes(endTimeStr);

  // Normalize all points on a 24-hour cycle relative to start (0 to 1439)
  let normEnd = (end - start + 1440) % 1440;
  if (normEnd === 0 && end !== start) normEnd = 1440;
  const normCutoff = (cutoff - start + 1440) % 1440;
  const normCurr = (curr - start + 1440) % 1440;

  if (normCurr > normEnd) {
    // Outside window: check if before start or after end
    const distToStart = (start - curr + 1440) % 1440;
    const distFromEnd = (curr - end + 1440) % 1440;
    if (distToStart < distFromEnd) {
      return {
        allowed: false,
        message: `Check-in has not started yet. Today's check-in opens at ${startTimeStr}.`,
      };
    }
    return {
      allowed: false,
      message: `Check-in window closed at ${endTimeStr}. Please contact your supervisor.`,
    };
  }

  if (normCurr <= normCutoff) {
    return {
      allowed: true,
      status: "PRESENT",
      message: "On-time arrival.",
    };
  } else {
    return {
      allowed: true,
      status: "LATE",
      message: `Late arrival (arrived at ${currentTimeStr}, on-time cutoff was ${cutoffTimeStr}).`,
    };
  }
}

/**
 * Evaluates whether current time is within check-out window.
 * Fully supports overnight shifts and early morning check-out hours.
 */
export function evaluateCheckOutTime(
  currentTimeStr: string,
  startTimeStr: string,
  endTimeStr: string
): { allowed: boolean; message?: string } {
  if (isTimeInWindow(currentTimeStr, startTimeStr, endTimeStr)) {
    return { allowed: true };
  }

  const curr = timeToMinutes(currentTimeStr);
  const start = timeToMinutes(startTimeStr);
  const end = timeToMinutes(endTimeStr);

  const distToStart = (start - curr + 1440) % 1440;
  const distFromEnd = (curr - end + 1440) % 1440;

  if (distToStart < distFromEnd) {
    return {
      allowed: false,
      message: `Check-out has not opened yet. Check-out starts at ${startTimeStr}.`,
    };
  }

  return {
    allowed: false,
    message: `Check-out window closed at ${endTimeStr}. Please contact an administrator.`,
  };
}

/**
 * Returns the logical shift date (YYYY-MM-DD) for an attendance action.
 * For overnight shifts (e.g. shift starts evening and runs to next morning):
 * If the current time is in the early morning before the evening check-in starts,
 * the shift logically belongs to yesterday!
 */
export function getLogicalShiftDate(
  currentDateStr: string,
  currentTimeStr: string,
  checkInStartStr: string,
  isOvernight: boolean
): string {
  if (!isOvernight) return currentDateStr;

  const curr = timeToMinutes(currentTimeStr);
  const start = timeToMinutes(checkInStartStr);

  // If current time is in the early morning before evening check-in starts (e.g. 01:30 AM < 20:00)
  if (curr < start) {
    const [year, month, day] = currentDateStr.split("-").map(Number);
    const d = new Date(Date.UTC(year, month - 1, day));
    d.setUTCDate(d.getUTCDate() - 1);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  return currentDateStr;
}

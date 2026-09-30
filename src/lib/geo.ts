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
 * Time shift validation utility
 */
export type ShiftTimeEvaluation = {
  allowed: boolean;
  status?: "PRESENT" | "LATE";
  message?: string;
};

/**
 * Evaluates whether current time is within check-in window and whether it is marked LATE or PRESENT.
 * timeStr: "HH:mm" (24-hour format)
 */
export function evaluateCheckInTime(
  currentTimeStr: string,
  startTimeStr: string,
  cutoffTimeStr: string,
  endTimeStr: string
): ShiftTimeEvaluation {
  if (currentTimeStr < startTimeStr) {
    return {
      allowed: false,
      message: `Check-in has not started yet. Today's check-in opens at ${startTimeStr}.`,
    };
  }

  if (currentTimeStr > endTimeStr) {
    return {
      allowed: false,
      message: `Check-in window for today closed at ${endTimeStr}. Please contact your supervisor.`,
    };
  }

  if (currentTimeStr <= cutoffTimeStr) {
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
 */
export function evaluateCheckOutTime(
  currentTimeStr: string,
  startTimeStr: string,
  endTimeStr: string
): { allowed: boolean; message?: string } {
  if (currentTimeStr < startTimeStr) {
    return {
      allowed: false,
      message: `Check-out has not opened yet. Check-out starts at ${startTimeStr}.`,
    };
  }

  if (currentTimeStr > endTimeStr) {
    return {
      allowed: false,
      message: `Check-out window closed at ${endTimeStr}. Please contact an administrator.`,
    };
  }

  return { allowed: true };
}

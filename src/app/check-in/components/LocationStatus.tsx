"use client";

import { memo, useCallback, useMemo } from "react";
import { calculateDistanceMeters } from "@/lib/utils/optimization";

type LocationStatusProps = {
  location: { lat: number; lng: number; accuracy: number } | null;
  locating: boolean;
  permissionDenied: boolean;
  locationError: string | null;
  isInsideGeofence: boolean | null;
  distanceToVenue: number | null;
  venueName: string;
  venueRadiusMeters: number;
  onRequestLocation: () => void;
};

const LocationStatus = memo(function LocationStatus({
  location,
  locating,
  permissionDenied,
  locationError,
  isInsideGeofence,
  distanceToVenue,
  venueName,
  venueRadiusMeters,
  onRequestLocation,
}: LocationStatusProps) {
  const locationMessage = useMemo(() => {
    if (permissionDenied) {
      return {
        title: "Location Access Denied — Check-In Blocked",
        detail: "Physical presence verification is strictly required. Check-in cannot be recorded without GPS confirmation.",
      };
    }
    if (locating) {
      return {
        title: "Confirming GPS Location...",
        detail: "Please tap 'Allow' if your phone prompts for location access.",
      };
    }
    if (!location && !permissionDenied) {
      return {
        title: "Location Confirmation Required",
        detail: "You must confirm your physical location to verify you are at the workplace venue before check-in can be unlocked.",
      };
    }
    if (isInsideGeofence === false && distanceToVenue !== null) {
      return {
        title: "Outside Workplace Venue",
        detail: `Check-in blocked: You are ${distanceToVenue}m away from ${venueName}. Maximum allowed radius is ${venueRadiusMeters}m.`,
      };
    }
    return null;
  }, [permissionDenied, locating, location, isInsideGeofence, distanceToVenue, venueName, venueRadiusMeters]);

  const geofenceDisplay = useMemo(() => {
    if (!location) return null;
    const distanceColor = isInsideGeofence === true
      ? "bg-emerald-100 text-emerald-800"
      : "bg-red-100 text-red-800";
    return (
      <span className={`text-[11px] font-mono px-2 py-0.5 rounded font-bold self-start sm:self-auto ${distanceColor}`}>
        {distanceToVenue !== null ? `${distanceToVenue}m away (Max: ${venueRadiusMeters}m)` : "—"}
      </span>
    );
  }, [location, isInsideGeofence, distanceToVenue, venueRadiusMeters]);

  const buttonText = useMemo(() => {
    if (locating) return "Acquiring GPS...";
    if (location) return "🔄 Refresh Location";
    return "📍 Confirm Location";
  }, [locating, location]);

  const handleLocationClick = useCallback(() => {
    onRequestLocation();
  }, [onRequestLocation]);

  if (!location && !locating && !permissionDenied && !locationMessage) {
    return (
      <div className="bg-amber-50/80 rounded-xl p-3.5 text-xs text-amber-950 border border-amber-200 space-y-2">
        <div className="flex items-center gap-1.5 font-bold text-amber-900">
          <span>📍</span>
          <span>Location Confirmation Required</span>
        </div>
        <button
          type="button"
          onClick={handleLocationClick}
          className="btn-primary !bg-amber-600 hover:!bg-amber-700 w-full !py-2 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm"
        >
          <span>📍</span>
          <span>Allow & Confirm Location</span>
        </button>
      </div>
    );
  }

  if (permissionDenied) {
    return (
      <div className="p-4 rounded-xl text-xs space-y-2.5 bg-red-50 text-red-950 border border-red-200">
        <div className="flex items-center gap-2 font-bold text-sm text-red-700">
          <span>🚫</span>
          <span>{locationMessage?.title || "Location Access Denied"}</span>
        </div>
        <p className="text-xs text-red-800 leading-relaxed">{locationMessage?.detail}</p>
        <button
          type="button"
          onClick={handleLocationClick}
          className="btn-primary w-full !bg-red-600 hover:!bg-red-700 text-xs font-semibold !py-2 flex items-center justify-center gap-1.5 shadow-sm"
        >
          <span>🔄</span>
          <span>Check Location Permission Again</span>
        </button>
      </div>
    );
  }

  if (locating) {
    return (
      <div className="p-3.5 rounded-xl text-xs bg-blue-50 text-blue-900 border border-blue-200 flex items-center gap-3 animate-pulse">
        <span className="text-lg">📡</span>
        <div>
          <p className="font-bold">{locationMessage?.title || "Confirming GPS Location..."}</p>
          <p className="text-[11px] text-blue-700">Please tap "Allow" if your phone prompts for location access.</p>
        </div>
      </div>
    );
  }

  if (location && isInsideGeofence) {
    return (
      <div className="p-3.5 rounded-xl text-xs space-y-1.5 border bg-emerald-50 text-emerald-900 border-emerald-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 font-bold">
          <span className="flex items-center gap-1.5">
            <span className="text-emerald-600 text-sm">✓</span>
            <span>Workplace Location Confirmed</span>
          </span>
          {geofenceDisplay}
        </div>
        <p className="text-[11px] opacity-85">
          GPS verified within allowed radius (Accuracy: ±{Math.round(location.accuracy)}m).
        </p>
      </div>
    );
  }

  return null;
});

export default LocationStatus;
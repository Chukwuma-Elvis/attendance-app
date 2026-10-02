"use client";

import { useEffect, useState } from "react";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { isTimeInWindow, isOvernightDepartment } from "@/lib/geo";

type DepartmentInfo = {
  id: string;
  name: string;
  venueName: string;
  hasVenueLocation: boolean;
  venueLatitude: number | null;
  venueLongitude: number | null;
  venueRadiusMeters: number;
  shifts: {
    checkInStart: string;
    checkInCutoff: string;
    checkInEnd: string;
    checkOutStart: string;
    checkOutEnd: string;
  };
  employees: Array<{
    id: string;
    name: string;
    role: string;
    workingDays: number[];
    hasBiometricsRegistered: boolean;
    biometricResetRequested: boolean;
    biometricResetAllowed: boolean;
  }>;
};

function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export default function MobileCheckInPage() {
  const [departments, setDepartments] = useState<DepartmentInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Selections
  const [selectedDeptId, setSelectedDeptId] = useState<string>("");
  const [selectedEmpId, setSelectedEmpId] = useState<string>("");

  // Location state
  const [location, setLocation] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
  } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Status feedback
  const [processing, setProcessing] = useState(false);
  const [resultMessage, setResultMessage] = useState<{
    type: "success" | "error" | "warning";
    title: string;
    detail: string;
  } | null>(null);

  // Live clock
  const [currentTime, setCurrentTime] = useState("");
  const [currentHM, setCurrentHM] = useState("");

  useEffect(() => {
    function updateClock() {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      );
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      setCurrentHM(`${hh}:${mm}`);
    }
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  async function loadDepartments(showLoading = false) {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch("/api/check-in/departments", {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (res.ok) {
        const data: DepartmentInfo[] = await res.json();
        setDepartments(data);
        if (data.length > 0 && !selectedDeptId) {
          setSelectedDeptId(data[0].id);
        }
      }
    } catch (e) {
      console.error("Failed to load departments:", e);
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    loadDepartments(true);
    const onFocus = () => loadDepartments(false);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  // Request & confirm GPS coordinates
  function requestLocation(): Promise<{ lat: number; lng: number; accuracy: number }> {
    return new Promise((resolve, reject) => {
      if (typeof window === "undefined" || !navigator.geolocation) {
        const err = "Geolocation is not supported on this browser or device.";
        setLocationError(err);
        setPermissionDenied(true);
        return reject(new Error(err));
      }

      setLocating(true);
      setLocationError(null);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          };
          setLocation(loc);
          setLocationError(null);
          setPermissionDenied(false);
          setLocating(false);
          resolve(loc);
        },
        (err) => {
          setLocating(false);
          setLocation(null);
          let msg = "Could not confirm location.";
          if (err.code === err.PERMISSION_DENIED) {
            msg = "Location access was denied. You must grant location permission to check in.";
            setPermissionDenied(true);
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            msg = "Location unavailable. Please ensure device GPS / Location Services is turned ON.";
          } else if (err.code === err.TIMEOUT) {
            msg = "Location request timed out. Please tap retry to confirm location.";
          }
          setLocationError(msg);
          reject(new Error(msg));
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  }

  // Automatically prompt/confirm location as soon as portal opens
  useEffect(() => {
    if (typeof window !== "undefined" && navigator.geolocation) {
      requestLocation().catch(() => {
        // Error state handled inside requestLocation
      });
    }
  }, []);

  // When an employee is chosen, ensure location is actively confirmed
  useEffect(() => {
    if (selectedEmpId && !location && !locating && !permissionDenied) {
      requestLocation().catch(() => {});
    }
  }, [selectedEmpId]);

  // Selected department & employee objects
  const activeDept = departments.find((d) => d.id === selectedDeptId);
  const activeEmp = activeDept?.employees.find((e) => e.id === selectedEmpId);

  // Auto-poll when employee is waiting for admin approval
  useEffect(() => {
    if (!activeEmp?.biometricResetRequested) return;
    const interval = setInterval(() => {
      loadDepartments(false);
    }, 3000);
    return () => clearInterval(interval);
  }, [activeEmp?.biometricResetRequested]);

  // Compute distance to venue
  let distanceToVenue: number | null = null;
  let isInsideGeofence: boolean | null = null;

  if (location && activeDept && activeDept.venueLatitude && activeDept.venueLongitude) {
    distanceToVenue = calculateDistanceMeters(
      location.lat,
      location.lng,
      activeDept.venueLatitude,
      activeDept.venueLongitude
    );
    isInsideGeofence = distanceToVenue <= activeDept.venueRadiusMeters;
  } else if (location && activeDept && (!activeDept.venueLatitude || !activeDept.venueLongitude)) {
    // Venue GPS not set by admin yet, but device location is confirmed
    isInsideGeofence = true;
  } else {
    // No confirmed location yet
    isInsideGeofence = null;
  }

  // Shift time window evaluations (using local device clock)
  const nowHM =
    currentHM ||
    `${String(new Date().getHours()).padStart(2, "0")}:${String(
      new Date().getMinutes()
    ).padStart(2, "0")}`;

  const isOvernight = activeDept
    ? isOvernightDepartment({
        checkInStart: activeDept.shifts.checkInStart,
        checkInEnd: activeDept.shifts.checkInEnd,
        checkOutStart: activeDept.shifts.checkOutStart,
        checkOutEnd: activeDept.shifts.checkOutEnd,
      })
    : false;

  const isCheckInTimeActive = activeDept
    ? isTimeInWindow(nowHM, activeDept.shifts.checkInStart, activeDept.shifts.checkInEnd)
    : false;

  const isCheckOutTimeActive = activeDept
    ? isTimeInWindow(nowHM, activeDept.shifts.checkOutStart, activeDept.shifts.checkOutEnd)
    : false;

  const checkInTimeNotice = isCheckInTimeActive
    ? `Open until ${activeDept?.shifts.checkInEnd}`
    : `Opens at ${activeDept?.shifts.checkInStart}`;

  const checkOutTimeNotice = isCheckOutTimeActive
    ? `Open until ${activeDept?.shifts.checkOutEnd}`
    : `Opens at ${activeDept?.shifts.checkOutStart}${isOvernight ? " (Next Morning)" : ""}`;

  // Location MUST be granted and confirmed before check-in or check-out is allowed
  const hasConfirmedLocation = location !== null && !locating && !permissionDenied;
  const isLocationInside = hasConfirmedLocation && isInsideGeofence === true;

  const canCheckIn = isLocationInside && isCheckInTimeActive && !processing;
  const canCheckOut = isLocationInside && isCheckOutTimeActive && !processing;

  // 1. Biometric Registration (Passkey enrollment)
  async function handleRegisterBiometrics() {
    if (!activeEmp) return;
    setProcessing(true);
    setResultMessage(null);

    try {
      // 1. Fetch registration challenge options
      const optRes = await fetch("/api/biometrics/register-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: activeEmp.id }),
      });

      const options = await optRes.json();
      if (!optRes.ok) throw new Error(options.error || "Failed to start registration.");

      // 2. Prompt device biometrics (Face ID, Touch ID, Android Biometric)
      const regResponse = await startRegistration(options);

      // 3. Verify on server and save credential
      const verifyRes = await fetch("/api/biometrics/register-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: activeEmp.id,
          response: regResponse,
          deviceName: navigator.userAgent.includes("iPhone")
            ? "Apple iPhone Biometrics"
            : navigator.userAgent.includes("Android")
            ? "Android Phone Biometrics"
            : "Smartphone Biometrics",
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyData.error || "Biometric registration failed.");

      setResultMessage({
        type: "success",
        title: "Biometrics Registered Successfully! 🔐",
        detail: "Your device is now paired. You can check in and check out using Face ID / Fingerprint.",
      });

      // Refresh list to update employee badge
      loadDepartments();
    } catch (err: any) {
      console.error(err);
      setResultMessage({
        type: "error",
        title: "Registration Error",
        detail: err.message || "Failed to register biometrics.",
      });
    } finally {
      setProcessing(false);
    }
  }

  // Request admin authorization to change biometric device
  async function handleRequestBiometricReset() {
    if (!activeEmp) return;
    setProcessing(true);
    setResultMessage(null);

    try {
      const res = await fetch("/api/biometrics/request-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: activeEmp.id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit biometric change request.");

      setResultMessage({
        type: "success",
        title: "Request Submitted to Admin 📨",
        detail:
          data.message ||
          "Your request to change biometric devices has been submitted for administrator review.",
      });

      // Refresh list to update employee badge and pending status
      loadDepartments();
    } catch (err: any) {
      console.error(err);
      setResultMessage({
        type: "error",
        title: "Request Error",
        detail: err.message || "Failed to submit biometric change request.",
      });
    } finally {
      setProcessing(false);
    }
  }

  // 2. Biometric Check-In or Check-Out
  async function handleCheckAction(action: "CHECK_IN" | "CHECK_OUT") {
    if (!activeEmp) return;
    setResultMessage(null);

    // Step A: Strictly confirm and acquire location
    let coords = location;
    if (!coords) {
      setProcessing(true);
      try {
        coords = await requestLocation();
      } catch (err: any) {
        setProcessing(false);
        setResultMessage({
          type: "error",
          title: "Location Access Required",
          detail:
            "Check-in was blocked because location access is required. Please grant location permissions in your browser.",
        });
        return;
      }
    }

    if (!coords) {
      setResultMessage({
        type: "error",
        title: "Location Access Required",
        detail: "Check-in was blocked: Physical location could not be confirmed.",
      });
      return;
    }

    // Step B: Verify geofence before proceeding
    if (activeDept && activeDept.venueLatitude && activeDept.venueLongitude) {
      const dist = calculateDistanceMeters(
        coords.lat,
        coords.lng,
        activeDept.venueLatitude,
        activeDept.venueLongitude
      );
      if (dist > activeDept.venueRadiusMeters) {
        setResultMessage({
          type: "error",
          title: "Outside Workplace Venue",
          detail: `Check-in blocked: You are ${dist}m away from ${
            activeDept.venueName || "the venue"
          }. Maximum allowed radius is ${activeDept.venueRadiusMeters}m.`,
        });
        return;
      }
    }

    setProcessing(true);
    try {
      // Step C: Generate WebAuthn challenge
      const optRes = await fetch("/api/biometrics/auth-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: activeEmp.id }),
      });

      const options = await optRes.json();
      if (!optRes.ok) throw new Error(options.error || "Failed to start biometric authentication.");

      // Step D: Trigger phone biometric prompt (Face ID / Fingerprint)
      const authResponse = await startAuthentication(options);

      // Step E: Submit verification + location + local client time to check-in endpoint
      const dNow = new Date();
      const cHours = String(dNow.getHours()).padStart(2, "0");
      const cMins = String(dNow.getMinutes()).padStart(2, "0");
      const clientTime = `${cHours}:${cMins}`;
      const clientDate = `${dNow.getFullYear()}-${String(dNow.getMonth() + 1).padStart(2, "0")}-${String(dNow.getDate()).padStart(2, "0")}`;

      const checkRes = await fetch("/api/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: activeEmp.id,
          response: authResponse,
          latitude: coords.lat,
          longitude: coords.lng,
          action,
          clientTime,
          clientDate,
        }),
      });

      const checkData = await checkRes.json();
      if (!checkRes.ok) {
        throw new Error(checkData.error || `${action === "CHECK_IN" ? "Check-in" : "Check-out"} failed.`);
      }

      setResultMessage({
        type: checkData.status === "LATE" ? "warning" : "success",
        title:
          action === "CHECK_IN"
            ? checkData.status === "LATE"
              ? "Checked In (LATE) ⚠️"
              : "Checked In (On Time) ✓"
            : "Checked Out Successfully! 👋",
        detail: checkData.message,
      });
    } catch (err: any) {
      console.error(err);
      setResultMessage({
        type: "error",
        title: `${action === "CHECK_IN" ? "Check-In" : "Check-Out"} Failed`,
        detail: err.message || "An error occurred during verification.",
      });
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-between p-3 sm:p-6">
      <div className="max-w-md w-full mx-auto space-y-4 pt-2 pb-8">
        
        {/* Header Banner */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 text-center space-y-1">
          <div className="w-12 h-12 bg-blue-50 text-brand rounded-2xl flex items-center justify-center mx-auto text-2xl mb-2">
            📍
          </div>
          <h1 className="text-xl font-bold text-gray-900">Attendance Portal</h1>
          <p className="text-xs text-gray-500">Biometric & GPS Geofenced Check-In</p>

          <div className="inline-block mt-2 bg-gray-100 px-3 py-1 rounded-full text-xs font-semibold text-gray-700 font-mono">
            {currentTime || "--:--:--"}
          </div>
        </div>

        {/* Step 1: Select Department */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200 space-y-3">
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
            1. Select Department
          </label>
          <select
            className="input w-full font-medium"
            value={selectedDeptId}
            onChange={(e) => {
              setSelectedDeptId(e.target.value);
              setSelectedEmpId("");
              setResultMessage(null);
            }}
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          {/* Department Venue & Shift Info */}
          {activeDept && (
            <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-1.5 border border-gray-100">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Workplace Venue:</span>
                <span className="font-semibold text-gray-800 text-right">{activeDept.venueName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">On-Time Cutoff:</span>
                <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  {activeDept.shifts.checkInCutoff}
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px] text-gray-500">
                <span>Check-Out Window:</span>
                <span className="font-medium text-gray-800">
                  {activeDept.shifts.checkOutStart} – {activeDept.shifts.checkOutEnd}
                  {isOvernight && (
                    <span className="ml-1.5 inline-block text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.2 rounded">
                      Next Morning 🌙
                    </span>
                  )}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Select Employee */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200 space-y-3">
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
            2. Select Your Name
          </label>
          <select
            className="input w-full font-medium"
            value={selectedEmpId}
            onChange={(e) => {
              setSelectedEmpId(e.target.value);
              setResultMessage(null);
            }}
          >
            <option value="">-- Choose your name --</option>
            {activeDept?.employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({e.role})
              </option>
            ))}
          </select>
        </div>

        {/* Step 3: Location Status */}
        {activeEmp && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                3. Physical Location
              </span>
              <button
                type="button"
                onClick={() => requestLocation()}
                disabled={locating}
                className="text-xs text-brand font-semibold hover:underline flex items-center gap-1"
              >
                {locating ? "Acquiring GPS..." : location ? "🔄 Refresh Location" : "📍 Confirm Location"}
              </button>
            </div>

            {/* A. If permission was denied */}
            {permissionDenied && (
              <div className="p-4 rounded-xl text-xs space-y-2.5 bg-red-50 text-red-950 border border-red-200">
                <div className="flex items-center gap-2 font-bold text-sm text-red-700">
                  <span>🚫</span>
                  <span>Location Access Denied — Check-In Blocked</span>
                </div>
                <p className="text-xs text-red-800 leading-relaxed">
                  Physical presence verification is strictly required. Check-in cannot be recorded without GPS confirmation.
                </p>
                <div className="bg-white/80 p-3 rounded-lg border border-red-200 text-[11px] text-red-900 space-y-1.5">
                  <p className="font-semibold text-gray-900">How to allow location in your phone browser:</p>
                  <ul className="list-disc pl-4 space-y-1 text-gray-700">
                    <li>
                      <strong>iPhone (Safari):</strong> Tap the <em>aA</em> icon on the address bar &rarr; <em>Website Settings</em> &rarr; <em>Location</em> &rarr; Set to <strong>Allow</strong>.
                    </li>
                    <li>
                      <strong>Android (Chrome):</strong> Tap the <em>Lock 🔒 / Tune</em> icon next to the address bar &rarr; <em>Permissions</em> &rarr; Enable <strong>Location</strong>.
                    </li>
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => requestLocation()}
                  className="btn-primary w-full !bg-red-600 hover:!bg-red-700 text-xs font-semibold !py-2 flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <span>🔄</span>
                  <span>Check Location Permission Again</span>
                </button>
              </div>
            )}

            {/* B. If currently acquiring GPS */}
            {locating && (
              <div className="p-3.5 rounded-xl text-xs bg-blue-50 text-blue-900 border border-blue-200 flex items-center gap-3 animate-pulse">
                <span className="text-lg">📡</span>
                <div>
                  <p className="font-bold">Confirming GPS Location...</p>
                  <p className="text-[11px] text-blue-700">Please tap &ldquo;Allow&rdquo; if your phone prompts for location access.</p>
                </div>
              </div>
            )}

            {/* C. If location is NOT acquired and not denied/locating */}
            {!location && !locating && !permissionDenied && (
              <div className="bg-amber-50/80 rounded-xl p-3.5 text-xs text-amber-950 border border-amber-200 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <span>📍</span>
                  <span>Location Confirmation Required</span>
                </div>
                <p className="text-[11px] text-amber-800">
                  You must confirm your physical location to verify you are at the workplace venue before check-in can be unlocked.
                </p>
                <button
                  type="button"
                  onClick={() => requestLocation()}
                  className="btn-primary !bg-amber-600 hover:!bg-amber-700 w-full !py-2 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <span>📍</span>
                  <span>Allow & Confirm Location</span>
                </button>
              </div>
            )}

            {/* D. If location is confirmed */}
            {location && (
              <div
                className={`p-3.5 rounded-xl text-xs space-y-1.5 border ${
                  isInsideGeofence
                    ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                    : "bg-red-50 text-red-900 border-red-200"
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1.5">
                    {isInsideGeofence ? (
                      <>
                        <span className="text-emerald-600 text-sm">✓</span>
                        <span>Workplace Location Confirmed</span>
                      </>
                    ) : (
                      <>
                        <span>⚠️</span>
                        <span>Outside Allowed Workplace Radius</span>
                      </>
                    )}
                  </span>
                  {distanceToVenue !== null && (
                    <span
                      className={`text-[11px] font-mono px-2 py-0.5 rounded font-bold ${
                        isInsideGeofence
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {distanceToVenue}m away (Max: {activeDept?.venueRadiusMeters}m)
                    </span>
                  )}
                </div>
                <p className="text-[11px] opacity-85">
                  {isInsideGeofence
                    ? `GPS verified within allowed radius (Accuracy: ±${Math.round(location.accuracy)}m).`
                    : `You are too far from ${activeDept?.venueName || "the assigned workplace"}. Check-in is blocked until you arrive at the venue.`}
                </p>
              </div>
            )}

            {locationError && !permissionDenied && (
              <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-200">
                {locationError}
              </p>
            )}
          </div>
        )}

        {/* Step 4: Biometric Action Controls */}
        {activeEmp && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200 space-y-4">
            <span className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
              4. Biometric Identification
            </span>

            {/* If passkey is NOT registered yet */}
            {!activeEmp.hasBiometricsRegistered ? (
              <div className="space-y-2.5 bg-blue-50/60 p-3.5 rounded-xl border border-blue-200 text-center">
                <p className="text-xs font-semibold text-blue-900">
                  First Time on this Device?
                </p>
                <p className="text-[11px] text-blue-700">
                  Pair your phone&apos;s Face ID, Touch ID, or Fingerprint to confirm your identity when checking in.
                </p>
                <button
                  type="button"
                  onClick={handleRegisterBiometrics}
                  disabled={processing}
                  className="btn-primary w-full text-xs !py-2.5 flex items-center justify-center gap-2"
                >
                  <span>🔐</span>
                  <span>{processing ? "Registering..." : "Register Phone Biometric"}</span>
                </button>
              </div>
            ) : (
              /* Already registered: Show Check-In & Check-Out buttons */
              <div className="space-y-3">
                {/* Contextual status banner */}
                {!hasConfirmedLocation || isInsideGeofence === false ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2">
                    <span className="text-base shrink-0">
                      {permissionDenied ? "🚫" : locating ? "📡" : !hasConfirmedLocation ? "📍" : "⚠️"}
                    </span>
                    <div className="space-y-0.5">
                      <p className="font-bold">
                        {permissionDenied
                          ? "Location Access Blocked"
                          : locating
                          ? "Acquiring GPS Location..."
                          : !hasConfirmedLocation
                          ? "Step 3: Location Confirmation Required"
                          : "Outside Workplace Venue Radius"}
                      </p>
                      <p className="text-[11px] text-amber-800">
                        {permissionDenied
                          ? "Location access is denied. Check-in cannot proceed without GPS confirmation."
                          : locating
                          ? "Please wait while your GPS coordinates are being acquired."
                          : !hasConfirmedLocation
                          ? 'Please tap "Confirm Location" in Step 3 above so we can verify your presence at the venue.'
                          : `You are ${distanceToVenue}m away from ${activeDept?.venueName || "the workplace"}. Check-in is allowed within ${activeDept?.venueRadiusMeters}m.`}
                      </p>
                    </div>
                  </div>
                ) : isCheckOutTimeActive && !isCheckInTimeActive ? (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-950 flex items-start gap-2">
                    <span className="text-base shrink-0">🌙</span>
                    <div className="space-y-0.5">
                      <p className="font-bold text-indigo-900">Check-Out Window is Active</p>
                      <p className="text-[11px] text-indigo-800">
                        Departure check-out is currently open until {activeDept?.shifts.checkOutEnd}. Tap &ldquo;Check Out&rdquo; below to confirm your departure.
                      </p>
                    </div>
                  </div>
                ) : isCheckInTimeActive && !isCheckOutTimeActive ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-950 flex items-start gap-2">
                    <span className="text-base shrink-0">☀️</span>
                    <div className="space-y-0.5">
                      <p className="font-bold text-emerald-900">Check-In Window is Active</p>
                      <p className="text-[11px] text-emerald-800">
                        Arrival check-in is currently open until {activeDept?.shifts.checkInEnd}. Tap &ldquo;Check In&rdquo; below to record your attendance.
                      </p>
                    </div>
                  </div>
                ) : !isCheckInTimeActive && !isCheckOutTimeActive ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2">
                    <span className="text-base shrink-0">⏰</span>
                    <div className="space-y-0.5">
                      <p className="font-bold">Outside Shift Hours</p>
                      <p className="text-[11px] text-amber-800">
                        Check-in: {activeDept?.shifts.checkInStart} – {activeDept?.shifts.checkInEnd} | Check-out: {activeDept?.shifts.checkOutStart} – {activeDept?.shifts.checkOutEnd}. Current time: {nowHM}.
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleCheckAction("CHECK_IN")}
                    disabled={!canCheckIn}
                    className="btn-primary !bg-emerald-600 hover:!bg-emerald-700 !py-3 text-xs font-bold flex flex-col items-center justify-center gap-1 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                  >
                    <span className="text-lg">☀️</span>
                    <span>{processing ? "Verifying..." : "Check In"}</span>
                    <span className="text-[10px] font-normal opacity-90">
                      {!isCheckInTimeActive
                        ? checkInTimeNotice
                        : !hasConfirmedLocation
                        ? "Confirm Location Above"
                        : isInsideGeofence === false
                        ? `${distanceToVenue}m away (Out of Range)`
                        : "Arrival"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCheckAction("CHECK_OUT")}
                    disabled={!canCheckOut}
                    className="btn-secondary !border-brand text-brand hover:bg-brand/5 !py-3 text-xs font-bold flex flex-col items-center justify-center gap-1 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                  >
                    <span className="text-lg">🌙</span>
                    <span>{processing ? "Verifying..." : "Check Out"}</span>
                    <span className="text-[10px] font-normal opacity-90">
                      {!isCheckOutTimeActive
                        ? checkOutTimeNotice
                        : !hasConfirmedLocation
                        ? "Confirm Location Above"
                        : isInsideGeofence === false
                        ? `${distanceToVenue}m away (Out of Range)`
                        : "Departure"}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Device Switch / Re-Registration Section (Strictly Protected by Admin Permission) */}
            {activeEmp.hasBiometricsRegistered && (
              <div className="pt-2 border-t border-gray-100">
                {activeEmp.biometricResetAllowed ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                      <span>🔓</span>
                      <span>Admin Permission Granted</span>
                    </div>
                    <p className="text-[11px] text-emerald-700">
                      Your administrator has authorized a new biometric registration. You may now pair your new phone or device.
                    </p>
                    <button
                      type="button"
                      onClick={handleRegisterBiometrics}
                      disabled={processing}
                      className="btn-primary w-full !bg-emerald-600 hover:!bg-emerald-700 text-xs !py-2 flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <span>🔐</span>
                      <span>Pair New Device Biometrics</span>
                    </button>
                  </div>
                ) : activeEmp.biometricResetRequested ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs space-y-2 text-center">
                    <div className="flex items-center justify-center gap-1.5 font-bold text-amber-900">
                      <span>⏳</span>
                      <span>Reset Request Pending Admin Approval</span>
                    </div>
                    <p className="text-[11px] text-amber-800">
                      Your request to change devices was submitted. Please ask your administrator to approve it in the admin dashboard.
                    </p>
                    <button
                      type="button"
                      onClick={() => loadDepartments(false)}
                      className="text-[11px] text-amber-800 hover:text-amber-950 font-medium underline flex items-center justify-center gap-1 mx-auto pt-1"
                    >
                      <span>🔄</span>
                      <span>Check Status Now</span>
                    </button>
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-700 flex items-center gap-1">
                        <span>🔒</span> Device Biometrics Locked
                      </span>
                      <span className="text-[10px] text-gray-400 font-medium">Security Protected</span>
                    </div>
                    <p className="text-[11px] text-gray-500">
                      Got a new phone or changed device? Re-registering requires administrator authorization.
                    </p>
                    <button
                      type="button"
                      onClick={handleRequestBiometricReset}
                      disabled={processing}
                      className="btn-secondary w-full text-xs !py-1.5 font-medium flex items-center justify-center gap-1.5 text-gray-700 hover:text-brand"
                    >
                      <span>📨</span>
                      <span>Request Admin Permission to Change Device</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Feedback / Result notification */}
        {resultMessage && (
          <div
            className={`p-4 rounded-2xl border text-xs space-y-1 animate-in fade-in duration-150 ${
              resultMessage.type === "success"
                ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                : resultMessage.type === "warning"
                ? "bg-amber-50 text-amber-900 border-amber-300"
                : "bg-red-50 text-red-900 border-red-300"
            }`}
          >
            <p className="font-bold text-sm">{resultMessage.title}</p>
            <p className="opacity-90">{resultMessage.detail}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center text-gray-400 text-xs py-3">
        <span>Employee Attendance &amp; Geofenced Clock-In</span>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { isOvernightDepartment } from "@/lib/geo";

type Rule = { id: string; key: string; label: string; amount: number };

type DepartmentSettings = {
  id: string;
  name: string;
  venueName: string | null;
  venueLatitude: number | null;
  venueLongitude: number | null;
  venueRadiusMeters: number;
  checkInStartTime: string;
  checkInCutoffTime: string;
  checkInEndTime: string;
  checkOutStartTime: string;
  checkOutEndTime: string;
};

export default function SettingsPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [deptSettings, setDeptSettings] = useState<DepartmentSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Penalty rule state
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [ruleMessage, setRuleMessage] = useState<string | null>(null);

  // Venue & Shift state
  const [savingDept, setSavingDept] = useState(false);
  const [deptMessage, setDeptMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [detectingGps, setDetectingGps] = useState(false);

  const isOvernight = deptSettings
    ? isOvernightDepartment({
        checkInStart: deptSettings.checkInStartTime,
        checkInEnd: deptSettings.checkInEndTime,
        checkOutStart: deptSettings.checkOutStartTime,
        checkOutEnd: deptSettings.checkOutEndTime,
      })
    : false;

  async function load() {
    setLoading(true);
    try {
      const [rulesRes, deptRes] = await Promise.all([
        fetch("/api/penalty-rules"),
        fetch("/api/department/settings"),
      ]);

      if (rulesRes.ok) setRules(await rulesRes.json());
      if (deptRes.ok) setDeptSettings(await deptRes.json());
    } catch (e) {
      console.error("Failed to load settings:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function updateLocalRule(key: string, amount: number) {
    setRules((prev) => prev.map((r) => (r.key === key ? { ...r, amount } : r)));
  }

  async function saveRule(rule: Rule) {
    setSavingKey(rule.key);
    setRuleMessage(null);
    const res = await fetch("/api/penalty-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: rule.key, amount: rule.amount }),
    });
    const data = await res.json().catch(() => ({}));
    setSavingKey(null);
    setRuleMessage(data.pending ? "Sent to the owner for approval." : "Saved penalty rule.");
    setTimeout(() => setRuleMessage(null), 3000);
  }

  function detectCurrentGps() {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    setDetectingGps(true);
    setDeptMessage(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDeptSettings((prev) =>
          prev
            ? {
                ...prev,
                venueLatitude: Number(pos.coords.latitude.toFixed(6)),
                venueLongitude: Number(pos.coords.longitude.toFixed(6)),
              }
            : null
        );
        setDetectingGps(false);
        setDeptMessage({
          text: `Detected GPS location: ${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)} (Accuracy: ${Math.round(pos.coords.accuracy)}m). Click "Save Venue & Shift Settings" to apply.`,
        });
      },
      (err) => {
        setDetectingGps(false);
        setDeptMessage({
          error: true,
          text: `GPS detection failed: ${err.message}. Please enter coordinates manually.`,
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function saveDepartmentSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!deptSettings) return;

    setSavingDept(true);
    setDeptMessage(null);

    try {
      const res = await fetch("/api/department/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deptSettings),
      });

      const data = await res.json();
      if (res.ok) {
        setDeptMessage({ text: "Workplace venue location and shift timings updated successfully." });
        setDeptSettings(data.department);
      } else {
        setDeptMessage({ error: true, text: data.error || "Failed to update settings." });
      }
    } catch {
      setDeptMessage({ error: true, text: "Network error while saving settings." });
    } finally {
      setSavingDept(false);
      setTimeout(() => setDeptMessage(null), 4000);
    }
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Department Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure workplace GPS location, daily check-in windows, and automated penalty deductions for{" "}
          <span className="font-semibold text-brand">{deptSettings?.name || "your team"}</span>.
        </p>
      </div>

      {/* SECTION 1: WORKPLACE VENUE & SHIFTS */}
      <div className="card space-y-6">
        <div className="border-b border-gray-100 pb-3">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <span>📍</span>
            <span>Workplace Venue & Geofencing (Mobile Check-In)</span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Employees must be physically within this GPS radius when checking in or checking out with their phones.
          </p>
        </div>

        {deptMessage && (
          <div
            className={`p-3 rounded-xl text-xs font-medium ${
              deptMessage.error
                ? "bg-red-50 text-red-700 border border-red-200"
                : "bg-emerald-50 text-emerald-800 border border-emerald-200"
            }`}
          >
            {deptMessage.text}
          </div>
        )}

        <form onSubmit={saveDepartmentSettings} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Venue Name / Description
              </label>
              <input
                className="input w-full"
                placeholder="e.g. Studio A / Main Headquarters"
                value={deptSettings?.venueName ?? ""}
                onChange={(e) =>
                  setDeptSettings((prev) => (prev ? { ...prev, venueName: e.target.value } : null))
                }
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-gray-700">Latitude</label>
                <button
                  type="button"
                  onClick={detectCurrentGps}
                  disabled={detectingGps}
                  className="text-[11px] text-brand hover:underline font-semibold flex items-center gap-1"
                >
                  {detectingGps ? "Detecting GPS..." : "📍 Use My Location"}
                </button>
              </div>
              <input
                type="number"
                step="0.000001"
                className="input w-full"
                placeholder="e.g. 6.524379"
                value={deptSettings?.venueLatitude ?? ""}
                onChange={(e) =>
                  setDeptSettings((prev) =>
                    prev
                      ? {
                          ...prev,
                          venueLatitude: e.target.value === "" ? null : Number(e.target.value),
                        }
                      : null
                  )
                }
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Longitude</label>
              <input
                type="number"
                step="0.000001"
                className="input w-full"
                placeholder="e.g. 3.379206"
                value={deptSettings?.venueLongitude ?? ""}
                onChange={(e) =>
                  setDeptSettings((prev) =>
                    prev
                      ? {
                          ...prev,
                          venueLongitude: e.target.value === "" ? null : Number(e.target.value),
                        }
                      : null
                  )
                }
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Allowed Geofence Radius (Meters)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="20"
                  max="5000"
                  className="input w-36"
                  value={deptSettings?.venueRadiusMeters ?? 100}
                  onChange={(e) =>
                    setDeptSettings((prev) =>
                      prev ? { ...prev, venueRadiusMeters: Number(e.target.value) || 100 } : null
                    )
                  }
                />
                <span className="text-xs text-gray-500">
                  Employees must be within this distance from the venue coordinates to check in. Recommended: <strong>100m - 200m</strong>.
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 2: SHIFT TIMINGS */}
          <div className="pt-4 border-t border-gray-100 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                  <span>⏰</span>
                  <span>Check-In & Check-Out Shift Windows</span>
                </h3>
                <p className="text-xs text-gray-500">
                  Check-ins after the <strong>On-Time Cutoff</strong> are automatically marked as <strong>LATE</strong> and deduct the late penalty.
                </p>
              </div>
              {isOvernight && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200 self-start sm:self-auto">
                  <span>🌙</span> Overnight Shift Active
                </span>
              )}
            </div>

            {isOvernight && (
              <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3 text-xs text-purple-950 flex items-start gap-2.5">
                <span className="text-base shrink-0">🌙</span>
                <div className="space-y-0.5">
                  <p className="font-bold text-purple-900">Overnight Shift (Crosses Midnight)</p>
                  <p className="text-[11px] text-purple-700 leading-relaxed">
                    Check-out occurs in the early morning of the following calendar day. The system will automatically map next-morning check-outs back to the shift date on which staff arrived.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Check-In Window Opens
                </label>
                <input
                  type="time"
                  className="input w-full"
                  value={deptSettings?.checkInStartTime ?? "07:00"}
                  onChange={(e) =>
                    setDeptSettings((prev) =>
                      prev ? { ...prev, checkInStartTime: e.target.value } : null
                    )
                  }
                />
                <span className="text-[10px] text-gray-400">Earliest allowed arrival</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-amber-800 mb-1">
                  On-Time Cutoff (Lateness Deadline)
                </label>
                <input
                  type="time"
                  className="input w-full border-amber-300 bg-amber-50/30 font-bold"
                  value={deptSettings?.checkInCutoffTime ?? "09:15"}
                  onChange={(e) =>
                    setDeptSettings((prev) =>
                      prev ? { ...prev, checkInCutoffTime: e.target.value } : null
                    )
                  }
                />
                <span className="text-[10px] text-amber-700">Check-in after this = LATE</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Check-In Window Closes
                </label>
                <input
                  type="time"
                  className="input w-full"
                  value={deptSettings?.checkInEndTime ?? "13:00"}
                  onChange={(e) =>
                    setDeptSettings((prev) =>
                      prev ? { ...prev, checkInEndTime: e.target.value } : null
                    )
                  }
                />
                <span className="text-[10px] text-gray-400">No arrival check-in after this</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Check-Out Window Opens
                </label>
                <input
                  type="time"
                  className="input w-full"
                  value={deptSettings?.checkOutStartTime ?? "16:30"}
                  onChange={(e) =>
                    setDeptSettings((prev) =>
                      prev ? { ...prev, checkOutStartTime: e.target.value } : null
                    )
                  }
                />
                <span className="text-[10px] text-gray-400">
                  {isOvernight ? "Earliest departure (Next Morning 🌙)" : "Earliest allowed departure"}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Check-Out Window Closes
                </label>
                <input
                  type="time"
                  className="input w-full"
                  value={deptSettings?.checkOutEndTime ?? "21:00"}
                  onChange={(e) =>
                    setDeptSettings((prev) =>
                      prev ? { ...prev, checkOutEndTime: e.target.value } : null
                    )
                  }
                />
                <span className="text-[10px] text-gray-400">
                  {isOvernight ? "Latest departure (Next Morning 🌙)" : "Latest departure check-out"}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button type="submit" className="btn-primary" disabled={savingDept || loading}>
              {savingDept ? "Saving Settings..." : "Save Venue & Shift Settings"}
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 3: PENALTY DEDUCTIONS */}
      <div className="card space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <span>💰</span>
            <span>Penalty Rules (Automated Deductions)</span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            These amounts are applied automatically whenever an employee is marked late, absent, or given an infraction.
          </p>
        </div>

        {ruleMessage && <p className="text-xs text-emerald-600 font-semibold">{ruleMessage}</p>}

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Deduction Type</th>
                <th>Cash Penalty (₦)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={3} className="text-center text-gray-400 py-6">
                    Loading settings...
                  </td>
                </tr>
              )}
              {rules.map((r) => (
                <tr key={r.key}>
                  <td className="font-medium text-gray-900">{r.label}</td>
                  <td>
                    <input
                      type="number"
                      className="input w-36"
                      value={r.amount}
                      onChange={(e) => updateLocalRule(r.key, Number(e.target.value))}
                    />
                  </td>
                  <td>
                    <button
                      className="btn-secondary text-xs"
                      onClick={() => saveRule(r)}
                      disabled={savingKey === r.key}
                    >
                      {savingKey === r.key ? "Saving..." : "Save Amount"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

type Row = {
  employeeId: string;
  name: string;
  role: string;
  status: string | null;
  note: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  checkInMethod?: string | null;
  checkOutMethod?: string | null;
};

function formatClock(iso?: string | null) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

type OffDutyEmployee = {
  employeeId: string;
  name: string;
  role: string;
};

type PendingChange = {
  kind: "ATTENDANCE" | "INFRACTION" | "PENALTY_RULE";
  status: "PENDING" | "APPROVED" | "REJECTED";
  payload: { employeeId: string; date: string; status: string };
};

const STATUSES = ["PRESENT", "LATE", "ABSENT", "EXCUSED"];

const STATUS_COLORS: Record<string, string> = {
  PRESENT: "bg-green-50 text-green-700 border-green-300 focus:ring-green-500",
  LATE: "bg-amber-50 text-amber-700 border-amber-300 focus:ring-amber-500",
  ABSENT: "bg-red-50 text-red-700 border-red-300 focus:ring-red-500",
  EXCUSED: "bg-purple-50 text-purple-700 border-purple-300 focus:ring-purple-500",
};

const STATUS_BUTTON_COLORS: Record<string, string> = {
  PRESENT: "bg-green-100 text-green-700 hover:bg-green-200",
  LATE: "bg-amber-100 text-amber-700 hover:bg-amber-200",
  ABSENT: "bg-red-100 text-red-700 hover:bg-red-200",
  EXCUSED: "bg-purple-100 text-purple-700 hover:bg-purple-200",
};

function statusSelectClasses(status: string | null) {
  const colors = status ? STATUS_COLORS[status] : "bg-white text-gray-900 border-gray-300 focus:ring-brand";
  return `rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${colors}`;
}

function dayHeaderLabel(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function shiftDate(dateStr: string, delta: number) {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function AttendancePage() {
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState<Row[]>([]);
  const [offDuty, setOffDuty] = useState<OffDutyEmployee[]>([]);
  const [pendingByEmployee, setPendingByEmployee] = useState<Record<string, string>>({});
  const [addingId, setAddingId] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<"name" | "role">("name");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [showTimes, setShowTimes] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("attendance_show_times");
      if (saved !== null) {
        setShowTimes(saved === "true");
      }
    } catch {}
  }, []);

  function toggleShowTimes() {
    setShowTimes((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("attendance_show_times", String(next));
      } catch {}
      return next;
    });
  }

  async function load(d: string) {
    setLoading(true);
    const [res, approvalsRes] = await Promise.all([
      fetch(`/api/attendance?date=${d}`),
      fetch("/api/approvals"),
    ]);
    const data = await res.json();
    const approvalsData = await approvalsRes.json().catch(() => ({ changes: [] }));
    setRows(data.rows);
    setOffDuty(data.offDuty);
    const pending: Record<string, string> = {};
    for (const c of approvalsData.changes ?? []) {
      const change = c as PendingChange;
      if (change.kind === "ATTENDANCE" && change.status === "PENDING" && change.payload.date === d) {
        pending[change.payload.employeeId] = change.payload.status;
      }
    }
    setPendingByEmployee(pending);
    setAddingId("");
    setLoading(false);
  }

  useEffect(() => {
    load(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  function setStatus(employeeId: string, status: string) {
    setRows((prev) => prev.map((r) => (r.employeeId === employeeId ? { ...r, status } : r)));
  }

  function markAll(status: string) {
    setRows((prev) =>
      prev.map((r) => (roleFilter === "ALL" || r.role === roleFilter ? { ...r, status } : r))
    );
  }

  function addOffDutyEmployee() {
    if (!addingId) return;
    const emp = offDuty.find((e) => e.employeeId === addingId);
    if (!emp) return;
    setRows((prev) => [...prev, { employeeId: emp.employeeId, name: emp.name, role: emp.role, status: null, note: null }]);
    setOffDuty((prev) => prev.filter((e) => e.employeeId !== addingId));
    setAddingId("");
  }

  async function save() {
    setSaving(true);
    setSavedMsg(null);
    const res = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        records: rows.map((r) => ({ employeeId: r.employeeId, status: r.status ?? "" })),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    setSavedMsg(
      data.queued
        ? `Saved. ${data.queued} change(s) sent to the owner for approval.`
        : "Saved."
    );
    load(date);
    setTimeout(() => setSavedMsg(null), 4000);
  }

  const roles = Array.from(new Set(rows.map((r) => r.role))).sort();

  const displayRows = rows
    .filter((r) => roleFilter === "ALL" || r.role === roleFilter)
    .sort((a, b) =>
      sortBy === "role" ? a.role.localeCompare(b.role) || a.name.localeCompare(b.name) : a.name.localeCompare(b.name)
    );

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500">Mark Attendance</p>
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setDate((d) => shiftDate(d, -1))}
                aria-label="Previous day"
                className="btn-secondary text-lg px-3 py-1 shrink-0"
              >
                ‹
              </button>
              <h1 className="text-xl sm:text-3xl font-bold text-brand">{dayHeaderLabel(date)}</h1>
              <button
                onClick={() => setDate((d) => shiftDate(d, 1))}
                aria-label="Next day"
                className="btn-secondary text-lg px-3 py-1 shrink-0"
              >
                ›
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
            {savedMsg && <span className="text-sm text-green-600">{savedMsg}</span>}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => markAll(s)}
            className={`text-xs rounded-lg px-4 py-2 font-medium transition-colors ${STATUS_BUTTON_COLORS[s]}`}
          >
            Mark all: {s.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="card flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-auto">
          <label className="block text-sm font-medium mb-1">Add someone not on duty today</label>
          <select
            className="input w-full sm:w-auto"
            value={addingId}
            onChange={(e) => setAddingId(e.target.value)}
          >
            <option value="">Select employee...</option>
            {offDuty.map((e) => (
              <option key={e.employeeId} value={e.employeeId}>
                {e.name} ({e.role})
              </option>
            ))}
          </select>
        </div>
        <button className="btn-secondary" onClick={addOffDutyEmployee} disabled={!addingId}>
          Add
        </button>
      </div>

      <div className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Filter by Role</label>
          <select className="input" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="ALL">All Roles</option>
            {roles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Sort By</label>
          <select className="input" value={sortBy} onChange={(e) => setSortBy(e.target.value as "name" | "role")}>
            <option value="name">Name</option>
            <option value="role">Role</option>
          </select>
        </div>
      </div>

      <div className="card space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-gray-900 text-sm">Attendance List</h2>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
              {displayRows.length}
            </span>
          </div>
          <button
            type="button"
            onClick={toggleShowTimes}
            className={`btn text-xs !py-1.5 !px-3 font-medium flex items-center gap-1.5 border transition-all ${
              showTimes
                ? "bg-brand/10 text-brand border-brand/30 hover:bg-brand/20"
                : "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200"
            }`}
          >
            <span>⏱️</span>
            <span>{showTimes ? "Hide Check-In / Out Times" : "Show Check-In / Out Times"}</span>
            <span className="text-[10px]">{showTimes ? "◂" : "▸"}</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="min-w-[140px]">Name</th>
                <th className="min-w-[100px]">Role</th>
                <th className="min-w-[180px]">
                  <div className="flex items-center justify-between gap-2">
                    <span>Status (Manual Override)</span>
                    {!showTimes && (
                      <button
                        type="button"
                        onClick={toggleShowTimes}
                        className="text-xs font-normal text-brand hover:underline flex items-center gap-0.5 shrink-0"
                        title="Expand Check-In and Check-Out columns"
                      >
                        <span>⏱️ Times</span>
                        <span>▸</span>
                      </button>
                    )}
                  </div>
                </th>
                {showTimes && (
                  <>
                    <th className="w-28 text-center whitespace-nowrap">Check-In</th>
                    <th className="w-28 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <span>Check-Out</span>
                        <button
                          type="button"
                          onClick={toggleShowTimes}
                          className="text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded px-1 text-xs"
                          title="Collapse check-in/out columns"
                        >
                          ◂
                        </button>
                      </div>
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={showTimes ? 5 : 3} className="text-center text-gray-400 py-6">
                    Loading...
                  </td>
                </tr>
              )}
              {!loading && displayRows.length === 0 && (
                <tr>
                  <td colSpan={showTimes ? 5 : 3} className="text-center text-gray-400 py-6">
                    No employees match this filter.
                  </td>
                </tr>
              )}
              {displayRows.map((r) => (
                <tr key={r.employeeId}>
                  <td className="font-medium text-gray-900">{r.name}</td>
                  <td className="text-gray-600">{r.role}</td>
                  <td>
                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        className={statusSelectClasses(r.status)}
                        value={r.status ?? ""}
                        onChange={(e) => setStatus(r.employeeId, e.target.value)}
                      >
                        <option value="">Unset</option>
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s.replace("_", " ")}
                          </option>
                        ))}
                      </select>
                      {pendingByEmployee[r.employeeId] && (
                        <span className="text-xs rounded-full px-2 py-1 bg-yellow-100 text-yellow-700">
                          Pending: {pendingByEmployee[r.employeeId].replace("_", " ")}
                        </span>
                      )}
                    </div>
                  </td>
                  {showTimes && (
                    <>
                      <td className="w-28 text-center whitespace-nowrap">
                        {r.checkInTime ? (
                          <span
                            className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono ${
                              r.checkInMethod === "BIOMETRIC_MOBILE"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                : "bg-gray-100 text-gray-700 border border-gray-200"
                            }`}
                            title={r.checkInMethod === "BIOMETRIC_MOBILE" ? "Verified with Phone Biometric + GPS" : "Check-In"}
                          >
                            {formatClock(r.checkInTime)}
                          </span>
                        ) : (
                          <span className="text-gray-300 font-mono text-xs">—</span>
                        )}
                      </td>
                      <td className="w-28 text-center whitespace-nowrap">
                        {r.checkOutTime ? (
                          <span
                            className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono ${
                              r.checkOutMethod === "BIOMETRIC_MOBILE"
                                ? "bg-indigo-100 text-indigo-800 border border-indigo-200"
                                : "bg-gray-100 text-gray-700 border border-gray-200"
                            }`}
                            title={r.checkOutMethod === "BIOMETRIC_MOBILE" ? "Verified with Phone Biometric + GPS" : "Check-Out"}
                          >
                            {formatClock(r.checkOutTime)}
                          </span>
                        ) : (
                          <span className="text-gray-300 font-mono text-xs">—</span>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

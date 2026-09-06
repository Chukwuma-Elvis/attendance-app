"use client";

import { useEffect, useState } from "react";

type Row = {
  employeeId: string;
  name: string;
  role: string;
  status: string | null;
  note: string | null;
};

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

function dayOfWeekLabel(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

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
    setRows((prev) => prev.map((r) => ({ ...r, status })));
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
        records: rows.filter((r) => r.status).map((r) => ({ employeeId: r.employeeId, status: r.status })),
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold">Mark Attendance</h1>
        <div className="flex items-center gap-2">
          <div>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
            <p className="text-xs text-gray-500 mt-1">{dayOfWeekLabel(date)}</p>
          </div>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
          {savedMsg && <span className="text-sm text-green-600">{savedMsg}</span>}
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

      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={3} className="text-center text-gray-400 py-6">
                  Loading...
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.employeeId}>
                <td>{r.name}</td>
                <td>{r.role}</td>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

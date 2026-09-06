"use client";

import { useEffect, useState } from "react";

type Row = {
  employeeId: string;
  name: string;
  role: string;
  status: string | null;
};

type DeductionEvent = {
  employeeId: string;
  name: string;
  role: string;
  label: string;
  amount: number;
};

const STATUS_BADGE_COLORS: Record<string, string> = {
  PRESENT: "bg-green-100 text-green-700",
  LATE: "bg-amber-100 text-amber-700",
  ABSENT: "bg-red-100 text-red-700",
  EXCUSED: "bg-purple-100 text-purple-700",
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
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

export default function DaySummaryPage() {
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState<Row[]>([]);
  const [deductions, setDeductions] = useState<DeductionEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<"name" | "role" | "status">("name");
  const [loading, setLoading] = useState(true);

  async function load(d: string) {
    setLoading(true);
    const res = await fetch(`/api/day-summary?date=${d}`);
    const data = await res.json();
    setRows(data.rows ?? []);
    setDeductions(data.deductions ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }

  useEffect(() => {
    load(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const roles = Array.from(new Set(rows.map((r) => r.role))).sort();

  const filteredRows = rows
    .filter(
      (r) =>
        (roleFilter === "ALL" || r.role === roleFilter) &&
        (statusFilter === "ALL" || (statusFilter === "UNSET" ? !r.status : r.status === statusFilter))
    )
    .sort((a, b) => {
      if (sortBy === "role") return a.role.localeCompare(b.role) || a.name.localeCompare(b.name);
      if (sortBy === "status") return (a.status ?? "").localeCompare(b.status ?? "") || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDate((d) => shiftDate(d, -1))}
              aria-label="Previous day"
              className="btn-secondary text-lg px-3 py-1"
            >
              ‹
            </button>
            <div>
              <p className="text-sm text-gray-500">Day Summary</p>
              <h1 className="text-3xl font-bold text-brand">{dayHeaderLabel(date)}</h1>
            </div>
            <button
              onClick={() => setDate((d) => shiftDate(d, 1))}
              aria-label="Next day"
              className="btn-secondary text-lg px-3 py-1"
            >
              ›
            </button>
          </div>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
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
          <label className="block text-sm font-medium mb-1">Filter by Status</label>
          <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">All Statuses</option>
            <option value="PRESENT">Present</option>
            <option value="LATE">Late</option>
            <option value="ABSENT">Absent</option>
            <option value="EXCUSED">Excused</option>
            <option value="UNSET">Unset</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Sort By</label>
          <select
            className="input"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "name" | "role" | "status")}
          >
            <option value="name">Name</option>
            <option value="role">Role</option>
            <option value="status">Status</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card overflow-x-auto lg:col-span-2">
          <h2 className="font-semibold mb-4">On Duty ({filteredRows.length})</h2>
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
              {!loading && filteredRows.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center text-gray-400 py-6">
                    No one matches this filter.
                  </td>
                </tr>
              )}
              {filteredRows.map((r) => (
                <tr key={r.employeeId}>
                  <td>{r.name}</td>
                  <td>{r.role}</td>
                  <td>
                    <span
                      className={`text-xs rounded-full px-2 py-1 ${
                        r.status ? STATUS_BADGE_COLORS[r.status] : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {r.status ? r.status.replace("_", " ") : "Unset"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2 className="font-semibold mb-1">Deductions</h2>
          <p className="text-xs text-gray-500 mb-4">Cash penalties from this day only.</p>
          <div className="space-y-2 mb-4">
            {loading && <p className="text-sm text-gray-400">Loading...</p>}
            {!loading && deductions.length === 0 && <p className="text-sm text-gray-400">No deductions on this day.</p>}
            {deductions.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-sm border-b border-gray-100 pb-2">
                <div>
                  <p className="font-medium">{d.name}</p>
                  <p className="text-xs text-gray-500">
                    {d.role} — {d.label}
                  </p>
                </div>
                <p className="font-semibold text-red-600">{formatCurrency(d.amount)}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-gray-200 pt-3">
            <p className="text-sm font-semibold text-gray-600">Total</p>
            <p className="text-lg font-bold text-brand">{formatCurrency(total)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

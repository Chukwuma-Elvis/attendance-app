"use client";

import { useState } from "react";

type DayStatus = "PRESENT" | "LATE" | "ABSENT" | "EXCUSED" | "OFF" | null;

export type WeekRow = {
  employeeId: string;
  name: string;
  role: string;
  days: { key: string; status: DayStatus }[];
};

type WeekDayLabel = { key: string; label: string; dateLabel: string };

const STATUS_BADGE_COLORS: Record<string, string> = {
  PRESENT: "bg-green-100 text-green-700",
  LATE: "bg-amber-100 text-amber-700",
  ABSENT: "bg-red-100 text-red-700",
  EXCUSED: "bg-purple-100 text-purple-700",
  OFF: "bg-gray-100 text-gray-500",
};

function statusLabel(status: DayStatus) {
  if (!status) return "—";
  if (status === "OFF") return "Off";
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export default function WeeklyAttendanceTable({
  rows,
  weekDayLabels,
}: {
  rows: WeekRow[];
  weekDayLabels: WeekDayLabel[];
}) {
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<"name" | "role">("name");

  const roles = Array.from(new Set(rows.map((r) => r.role))).sort();

  const filteredRows = rows
    .filter((r) => roleFilter === "ALL" || r.role === roleFilter)
    .sort((a, b) =>
      sortBy === "role" ? a.role.localeCompare(b.role) || a.name.localeCompare(b.name) : a.name.localeCompare(b.name)
    );

  return (
    <div className="space-y-4">
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

      <div className="card overflow-x-auto">
        <h2 className="font-semibold mb-4">This Week's Attendance</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              {weekDayLabels.map((d) => (
                <th key={d.key} className="text-center">
                  {d.label}
                  <br />
                  <span className="font-normal text-gray-400">{d.dateLabel}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={2 + weekDayLabels.length} className="text-center text-gray-400 py-6">
                  No employees match this filter.
                </td>
              </tr>
            )}
            {filteredRows.map((r) => (
              <tr key={r.employeeId}>
                <td>{r.name}</td>
                <td>{r.role}</td>
                {r.days.map((d) => (
                  <td key={d.key} className="text-center">
                    {d.status ? (
                      <span className={`text-xs rounded-full px-2 py-1 ${STATUS_BADGE_COLORS[d.status]}`}>
                        {statusLabel(d.status)}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

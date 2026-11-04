"use client";

import { useMemo, memo } from "react";

type DayInfo = {
  date: string;
  dayNum: number;
  dayOfWeek: number;
  dayLabel: string;
  dateLabel: string;
};

type EmployeeDayStatus = {
  date: string;
  dayNum: number;
  dayOfWeek: number;
  status: "PRESENT" | "LATE" | "ABSENT" | "EXCUSED" | "OFF" | null;
  note: string | null;
  infractionAmount: number;
};

type EmployeeRow = {
  employeeId: string;
  name: string;
  role: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
  offDay: number;
  infractionsCount: number;
  infractionsTotal: number;
  cashFromAttendance: number;
  totalDeductions: number;
  attendanceRate: number | null;
  days: EmployeeDayStatus[];
};

const STATUS_CELL_CLASSES: Record<string, string> = {
  OFF: "bg-gray-100/90 text-gray-400",
  PRESENT: "bg-green-50 text-green-800",
  LATE: "bg-amber-50 text-amber-800",
  ABSENT: "bg-red-50 text-red-800",
  EXCUSED: "bg-purple-50 text-purple-800",
  "": "bg-white text-gray-300",
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  OFF: "bg-gray-200/90 text-gray-500 border border-gray-300",
  PRESENT: "bg-green-100 text-green-800 border border-green-300",
  LATE: "bg-amber-100 text-amber-800 border border-amber-300",
  ABSENT: "bg-red-100 text-red-800 border border-red-300",
  EXCUSED: "bg-purple-100 text-purple-800 border border-purple-300",
  "": "bg-gray-50 text-gray-400 border border-gray-200",
};

function getStatusLabel(status: string | null): string {
  if (!status) return "—";
  if (status === "OFF") return "Off";
  return status.charAt(0) + status.slice(1).toLowerCase();
}

type CalendarGridProps = {
  employees: EmployeeRow[];
  daysInMonth: DayInfo[];
  todayStr: string;
  roleFilter: string;
  sortBy: "name" | "deductions" | "rate" | "absent" | "late";
  onEmployeeClick: (employee: EmployeeRow) => void;
};

const CalendarGrid = memo(function CalendarGrid({
  employees,
  daysInMonth,
  todayStr,
  roleFilter,
  sortBy,
  onEmployeeClick,
}: CalendarGridProps) {
  const filteredEmployees = useMemo(() => {
    return employees
      .filter((e) => roleFilter === "ALL" || e.role === roleFilter)
      .sort((a, b) => {
        if (sortBy === "deductions") return b.totalDeductions - a.totalDeductions;
        if (sortBy === "rate") return (b.attendanceRate ?? 0) - (a.attendanceRate ?? 0);
        if (sortBy === "absent") return b.absent - a.absent;
        if (sortBy === "late") return b.late - a.late;
        return a.name.localeCompare(b.name);
      });
  }, [employees, roleFilter, sortBy]);

  return (
    <div className="card overflow-x-auto !p-0 border border-gray-200 shadow-sm rounded-xl">
      <div className="min-w-full inline-block align-middle">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="sticky left-0 z-30 bg-gray-50 py-3 px-3 text-left font-bold text-gray-700 min-w-[160px] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                Employee
              </th>
              <th className="py-3 px-2 text-left font-semibold text-gray-500 min-w-[90px]">Role</th>
              {daysInMonth.map((d) => (
                <th
                  key={d.date}
                  className={`py-2 px-1 text-center font-medium min-w-[42px] max-w-[46px] border-l border-gray-100 ${
                    d.dayOfWeek === 0 || d.dayOfWeek === 6
                      ? "bg-gray-100/60 text-gray-500"
                      : "text-gray-700"
                  }`}
                >
                  <div className="text-[10px] uppercase">{d.dayLabel}</div>
                  <div className="text-xs font-bold">{d.dayNum}</div>
                </th>
              ))}
              <th className="py-3 px-2 text-center font-semibold text-emerald-800 bg-emerald-50/50 min-w-[45px] border-l border-gray-200">P</th>
              <th className="py-3 px-2 text-center font-semibold text-amber-800 bg-amber-50/50 min-w-[45px]">L</th>
              <th className="py-3 px-2 text-center font-semibold text-rose-800 bg-rose-50/50 min-w-[45px]">A</th>
              <th className="py-3 px-2 text-center font-semibold text-purple-800 bg-purple-50/50 min-w-[45px]">E</th>
              <th className="py-3 px-2 text-center font-semibold text-gray-600 bg-gray-100/60 min-w-[45px]">Off</th>
              <th className="py-3 px-3 text-right font-bold text-gray-800 min-w-[95px] border-l border-gray-200">Deductions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.length === 0 && (
              <tr>
                <td colSpan={daysInMonth.length + 8} className="text-center text-gray-400 py-6">
                  No employees match this filter.
                </td>
              </tr>
            )}
            {filteredEmployees.map((emp) => (
              <tr key={emp.employeeId} className="hover:bg-blue-50/20 transition">
                <td className="sticky left-0 z-20 bg-white hover:bg-blue-50/20 py-2.5 px-3 font-semibold text-gray-900 truncate max-w-[180px] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                  <button
                    type="button"
                    onClick={() => onEmployeeClick(emp)}
                    className="text-left hover:text-brand hover:underline truncate"
                    title="Click to view detailed calendar"
                  >
                    {emp.name}
                  </button>
                </td>

                <td className="py-2 px-2 text-gray-500 truncate max-w-[90px]">{emp.role}</td>

                {emp.days.map((day) => {
                  const status = day.status;
                  const bgClass = STATUS_CELL_CLASSES[status ?? ""] || STATUS_CELL_CLASSES[""];
                  const badgeClass = STATUS_BADGE_CLASSES[status ?? ""] || STATUS_BADGE_CLASSES[""];
                  const text = getStatusLabel(status);

                  return (
                    <td
                      key={day.date}
                      className={`p-1 text-center border-l border-gray-100 cursor-pointer transition hover:opacity-80 relative ${bgClass} ${
                        day.date === todayStr ? "ring-1 ring-blue-300" : ""
                      }`}
                      title={`${emp.name} (${day.date}): ${
                        day.status
                          ? day.status
                          : "Unset"
                      }${day.infractionAmount > 0 ? ` - Infraction: ₦${day.infractionAmount}` : ""}`}
                    >
                      <div className="flex items-center justify-center relative">
                        <span
                          className={`inline-flex items-center justify-center w-7 h-6 rounded text-[10px] font-bold leading-none ${badgeClass}`}
                        >
                          {text}
                        </span>
                        {day.infractionAmount > 0 && (
                          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-600 rounded-full border border-white" />
                        )}
                      </div>
                    </td>
                  );
                })}

                <td className="py-2 px-2 text-center font-bold text-emerald-800 bg-emerald-50/30 border-l border-gray-200">
                  {emp.present}
                </td>
                <td className="py-2 px-2 text-center font-bold text-amber-800 bg-amber-50/30">
                  {emp.late}
                </td>
                <td className="py-2 px-2 text-center font-bold text-rose-800 bg-rose-50/30">
                  {emp.absent}
                </td>
                <td className="py-2 px-2 text-center font-bold text-purple-800 bg-purple-50/30">
                  {emp.excused}
                </td>
                <td className="py-2 px-2 text-center text-gray-500 bg-gray-100/40">
                  {emp.offDay}
                </td>
                <td className="py-2 px-3 text-right font-bold text-gray-900 border-l border-gray-200 whitespace-nowrap">
                  {emp.totalDeductions > 0 ? (
                    <span className="text-red-600 font-extrabold">₦{emp.totalDeductions.toLocaleString()}</span>
                  ) : (
                    <span className="text-gray-400">₦0</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

export default CalendarGrid;
"use client";

import { useEffect, useState } from "react";
import EmployeeCalendarModal from "../employees/EmployeeCalendarModal";

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
  workingDays: number[];
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

type ItemizedDeduction = {
  id: string;
  date: string;
  employeeId: string;
  employeeName: string;
  role: string;
  category: "LATE" | "ABSENT" | "INFRACTION";
  label: string;
  description: string | null;
  amount: number;
};

type MonthSummaryData = {
  month: string;
  departmentName: string;
  daysInMonth: DayInfo[];
  overview: {
    totalEmployees: number;
    totalPresent: number;
    totalLate: number;
    totalAbsent: number;
    totalExcused: number;
    totalOffDay: number;
    totalInfractions: number;
    cashFromLateness: number;
    cashFromAbsence: number;
    cashFromInfractions: number;
    totalDeductions: number;
    attendanceRate: number | null;
  };
  employees: EmployeeRow[];
  itemizedDeductions: ItemizedDeduction[];
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(n);
}

function getInitialMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function MonthSummaryPage() {
  const currentMonthISO = getInitialMonth();
  const todayStr = todayISO();
  const [selectedMonth, setSelectedMonth] = useState(currentMonthISO);
  const [data, setData] = useState<MonthSummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  // View mode: Full Month Grid vs Calendar View vs Deductions List
  const [viewMode, setViewMode] = useState<"grid" | "calendar" | "deductions">("grid");

  // Filters & sorting
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<"name" | "deductions" | "rate" | "absent" | "late">("name");

  // Selected cell detail tooltip / modal
  const [selectedCell, setSelectedCell] = useState<{
    employeeName: string;
    role: string;
    day: EmployeeDayStatus;
  } | null>(null);

  // Employee calendar modal
  const [selectedEmployeeForModal, setSelectedEmployeeForModal] = useState<any | null>(null);

  async function loadData(m: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/month-summary?month=${m}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error("Failed to load month summary:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData(selectedMonth);
  }, [selectedMonth]);

  function prevMonth() {
    const [y, m] = selectedMonth.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 2, 1));
    setSelectedMonth(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }

  function nextMonth() {
    const [y, m] = selectedMonth.split("-").map(Number);
    const d = new Date(Date.UTC(y, m, 1));
    setSelectedMonth(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }

  const [yearNum, monthNum] = selectedMonth.split("-").map(Number);
  const monthName = MONTH_NAMES[monthNum - 1] ?? "";

  const employees = data?.employees ?? [];
  const daysInMonth = data?.daysInMonth ?? [];
  const roles = Array.from(new Set(employees.map((e) => e.role))).sort();

  // Filter & sort employees
  const filteredEmployees = employees
    .filter((e) => roleFilter === "ALL" || e.role === roleFilter)
    .filter((e) => e.name.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "deductions") return b.totalDeductions - a.totalDeductions;
      if (sortBy === "rate") return (b.attendanceRate ?? 0) - (a.attendanceRate ?? 0);
      if (sortBy === "absent") return b.absent - a.absent;
      if (sortBy === "late") return b.late - a.late;
      return a.name.localeCompare(b.name);
    });

  const overview = data?.overview;
  const itemized = data?.itemizedDeductions ?? [];

  // Calendar view setup (7 columns Sun-Sat)
  const firstDayOfWeek = daysInMonth.length > 0 ? daysInMonth[0].dayOfWeek : 0;

  return (
    <div className="space-y-6">
      {/* Month Navigator Card */}
      <div className="card">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-semibold text-gray-500">
                {data?.departmentName || "Team"}
              </span>
              <span className="text-xs text-gray-400">•</span>
              <span className="text-xs text-gray-500 font-medium">General Month View</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 mt-1">
              <button
                onClick={prevMonth}
                aria-label="Previous month"
                className="btn-secondary text-lg px-3 py-1 shrink-0"
              >
                ‹
              </button>
              <h1 className="text-2xl sm:text-3xl font-bold text-brand">
                {monthName} {yearNum}
              </h1>
              <button
                onClick={nextMonth}
                aria-label="Next month"
                className="btn-secondary text-lg px-3 py-1 shrink-0"
              >
                ›
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="month"
              className="input font-medium"
              value={selectedMonth}
              onChange={(e) => {
                if (e.target.value) setSelectedMonth(e.target.value);
              }}
            />
            {selectedMonth !== currentMonthISO && (
              <button
                onClick={() => setSelectedMonth(currentMonthISO)}
                className="text-xs text-brand hover:underline font-semibold"
              >
                Current Month
              </button>
            )}
            <a
              href={`/api/export/attendance?from=${selectedMonth}-01&to=${selectedMonth}-${new Date(
                Date.UTC(yearNum, monthNum, 0)
              ).getUTCDate()}`}
              className="btn-secondary text-xs flex items-center gap-1.5"
              download
            >
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Export Excel</span>
            </a>
          </div>
        </div>
      </div>

      {/* Quick Color Legend & View Mode Toggle */}
      <div className="card !p-3 sm:!p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Color Legend */}
        <div className="flex items-center gap-3 flex-wrap text-xs">
          <span className="font-semibold text-gray-500 uppercase tracking-wider text-[11px]">Legend:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-green-100 border border-green-300" />
            <span className="font-medium text-gray-700">Present (P)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-100 border border-amber-300" />
            <span className="font-medium text-gray-700">Late (L)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-red-100 border border-red-300" />
            <span className="font-medium text-gray-700">Absent (A)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-purple-100 border border-purple-300" />
            <span className="font-medium text-gray-700">Excused (E)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-gray-100 border border-gray-300" />
            <span className="font-bold text-gray-700">Off Day (Grey)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-600 text-white text-[8px] flex items-center justify-center font-bold">
              !
            </span>
            <span className="font-medium text-gray-700">Infraction</span>
          </div>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
              viewMode === "grid"
                ? "bg-white text-brand shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            📊 Month Grid (All Days)
          </button>
          <button
            type="button"
            onClick={() => setViewMode("calendar")}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
              viewMode === "calendar"
                ? "bg-white text-brand shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            🗓️ Calendar View
          </button>
          <button
            type="button"
            onClick={() => setViewMode("deductions")}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
              viewMode === "deductions"
                ? "bg-white text-brand shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            💰 Deductions ({itemized.length})
          </button>
        </div>
      </div>

      {/* VIEW 1: FULL MONTH GRID (EVERY DAY VISIBLE AND COLOUR CODED) */}
      {viewMode === "grid" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Filter Bar */}
          <div className="card flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">Search Employee</label>
              <input
                className="input w-full"
                placeholder="Search by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
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
              <label className="block text-xs font-medium text-gray-500 mb-1">Sort By</label>
              <select
                className="input"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
              >
                <option value="name">Name</option>
                <option value="deductions">Highest Deductions</option>
                <option value="rate">Attendance Rate</option>
                <option value="absent">Most Absences</option>
                <option value="late">Most Lateness</option>
              </select>
            </div>
          </div>

          {/* Month Attendance Matrix Table */}
          <div className="card overflow-x-auto !p-0 border border-gray-200 shadow-sm rounded-xl">
            <div className="min-w-full inline-block align-middle">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {/* Sticky Name column */}
                    <th className="sticky left-0 z-30 bg-gray-50 py-3 px-3 text-left font-bold text-gray-700 min-w-[160px] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                      Employee
                    </th>
                    <th className="py-3 px-2 text-left font-semibold text-gray-500 min-w-[90px]">
                      Role
                    </th>

                    {/* Every Day of the Month Column Header (1 to 30/31) */}
                    {daysInMonth.map((d) => {
                      const isToday = d.date === todayStr;
                      const isWeekend = d.dayOfWeek === 0 || d.dayOfWeek === 6;
                      return (
                        <th
                          key={d.date}
                          className={`py-2 px-1 text-center font-medium min-w-[42px] max-w-[46px] border-l border-gray-100 ${
                            isToday
                              ? "bg-blue-50 text-brand font-bold ring-1 ring-brand"
                              : isWeekend
                              ? "bg-gray-100/60 text-gray-500"
                              : "text-gray-700"
                          }`}
                        >
                          <div className="text-[10px] uppercase">{d.dayLabel}</div>
                          <div className="text-xs font-bold">{d.dayNum}</div>
                        </th>
                      );
                    })}

                    {/* Summary Totals at end of row */}
                    <th className="py-3 px-2 text-center font-semibold text-emerald-800 bg-emerald-50/50 min-w-[45px] border-l border-gray-200">
                      P
                    </th>
                    <th className="py-3 px-2 text-center font-semibold text-amber-800 bg-amber-50/50 min-w-[45px]">
                      L
                    </th>
                    <th className="py-3 px-2 text-center font-semibold text-rose-800 bg-rose-50/50 min-w-[45px]">
                      A
                    </th>
                    <th className="py-3 px-2 text-center font-semibold text-purple-800 bg-purple-50/50 min-w-[45px]">
                      E
                    </th>
                    <th className="py-3 px-2 text-center font-semibold text-gray-600 bg-gray-100/60 min-w-[45px]">
                      Off
                    </th>
                    <th className="py-3 px-3 text-right font-bold text-gray-800 min-w-[95px] border-l border-gray-200">
                      Deductions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {loading && (
                    <tr>
                      <td
                        colSpan={daysInMonth.length + 8}
                        className="text-center text-gray-400 py-12 text-sm"
                      >
                        Loading complete month attendance...
                      </td>
                    </tr>
                  )}

                  {!loading && filteredEmployees.length === 0 && (
                    <tr>
                      <td
                        colSpan={daysInMonth.length + 8}
                        className="text-center text-gray-400 py-12 text-sm"
                      >
                        No employees match the filter.
                      </td>
                    </tr>
                  )}

                  {filteredEmployees.map((emp) => (
                    <tr key={emp.employeeId} className="hover:bg-blue-50/20 transition group">
                      {/* Sticky Employee Name */}
                      <td className="sticky left-0 z-20 bg-white group-hover:bg-blue-50/30 py-2.5 px-3 font-semibold text-gray-900 truncate max-w-[170px] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedEmployeeForModal({
                              id: emp.employeeId,
                              name: emp.name,
                              role: emp.role,
                              active: true,
                              workingDays: emp.workingDays,
                            })
                          }
                          className="text-left hover:text-brand hover:underline truncate w-full"
                          title="Click to view detailed calendar"
                        >
                          {emp.name}
                        </button>
                      </td>

                      {/* Role */}
                      <td className="py-2 px-2 text-gray-500 truncate max-w-[90px]">
                        {emp.role}
                      </td>

                      {/* Day Cells: Every Day of the Month Visible & Color Coded */}
                      {emp.days.map((day) => {
                        const isToday = day.date === todayStr;
                        const isWeekend = day.dayOfWeek === 0 || day.dayOfWeek === 6;

                        let bgClass = "bg-white text-gray-300";
                        let badgeClass = "text-gray-300";
                        let text = "—";

                        if (day.status === "OFF") {
                          // Off days marked in grey
                          bgClass = "bg-gray-100/90 text-gray-400";
                          badgeClass = "bg-gray-200/90 text-gray-500 border border-gray-300";
                          text = "Off";
                        } else if (day.status === "PRESENT") {
                          bgClass = "bg-green-50 text-green-800";
                          badgeClass = "bg-green-100 text-green-800 border border-green-300";
                          text = "P";
                        } else if (day.status === "LATE") {
                          bgClass = "bg-amber-50 text-amber-800";
                          badgeClass = "bg-amber-100 text-amber-800 border border-amber-300";
                          text = "L";
                        } else if (day.status === "ABSENT") {
                          bgClass = "bg-red-50 text-red-800";
                          badgeClass = "bg-red-100 text-red-800 border border-red-300";
                          text = "A";
                        } else if (day.status === "EXCUSED") {
                          bgClass = "bg-purple-50 text-purple-800";
                          badgeClass = "bg-purple-100 text-purple-800 border border-purple-300";
                          text = "E";
                        }

                        return (
                          <td
                            key={day.date}
                            onClick={() =>
                              setSelectedCell({
                                employeeName: emp.name,
                                role: emp.role,
                                day,
                              })
                            }
                            className={`p-1 text-center border-l border-gray-100 cursor-pointer transition hover:opacity-80 relative ${bgClass} ${
                              isToday ? "ring-1 ring-blue-300" : ""
                            }`}
                            title={`${emp.name} (${day.date}): ${
                              day.status === "OFF"
                                ? "Off Day"
                                : day.status
                                ? day.status
                                : "Unset"
                            }${day.note ? ` - Note: "${day.note}"` : ""}${
                              day.infractionAmount > 0
                                ? ` - Infraction: ${formatCurrency(day.infractionAmount)}`
                                : ""
                            }`}
                          >
                            <div className="flex items-center justify-center relative">
                              <span
                                className={`inline-flex items-center justify-center w-7 h-6 rounded text-[10px] font-bold leading-none ${badgeClass}`}
                              >
                                {text}
                              </span>

                              {/* Infraction Pip */}
                              {day.infractionAmount > 0 && (
                                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-600 rounded-full border border-white" />
                              )}
                            </div>
                          </td>
                        );
                      })}

                      {/* Totals at end */}
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
                          <span className="text-red-600 font-extrabold">
                            {formatCurrency(emp.totalDeductions)}
                          </span>
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
        </div>
      )}

      {/* VIEW 2: TEAM MONTHLY CALENDAR VIEW (Sun - Sat 7 Columns) */}
      {viewMode === "calendar" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="card !p-0 overflow-hidden border border-gray-200 rounded-2xl shadow-sm bg-white">
            {/* Weekdays header */}
            <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 text-center py-2.5 text-xs font-bold text-gray-700">
              {WEEKDAY_NAMES.map((w, idx) => (
                <div key={w} className={idx === 0 || idx === 6 ? "text-gray-400" : ""}>
                  {w}
                </div>
              ))}
            </div>

            {/* Calendar Day Grid */}
            <div className="grid grid-cols-7 gap-px bg-gray-200">
              {/* Leading blanks */}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`blank-${i}`} className="bg-gray-50/50 min-h-[90px] sm:min-h-[110px]" />
              ))}

              {/* Days of the month */}
              {daysInMonth.map((d) => {
                const isToday = d.date === todayStr;

                // Aggregate stats for this day across all employees
                let present = 0;
                let late = 0;
                let absent = 0;
                let excused = 0;
                let off = 0;

                for (const emp of employees) {
                  const dayRecord = emp.days.find((x) => x.date === d.date);
                  if (dayRecord) {
                    if (dayRecord.status === "PRESENT") present++;
                    else if (dayRecord.status === "LATE") late++;
                    else if (dayRecord.status === "ABSENT") absent++;
                    else if (dayRecord.status === "EXCUSED") excused++;
                    else if (dayRecord.status === "OFF") off++;
                  }
                }

                const dayInfractions = itemized.filter((i) => i.date === d.date);

                return (
                  <div
                    key={d.date}
                    className={`bg-white p-2 min-h-[90px] sm:min-h-[110px] flex flex-col justify-between transition hover:bg-gray-50/80 ${
                      isToday ? "ring-2 ring-brand z-10" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center ${
                          isToday ? "bg-brand text-white" : "text-gray-800"
                        }`}
                      >
                        {d.dayNum}
                      </span>

                      {dayInfractions.length > 0 && (
                        <span
                          title={`${dayInfractions.length} infraction(s)`}
                          className="text-[9px] font-bold text-white bg-red-600 rounded-full px-1.5 py-0.5 leading-none"
                        >
                          ! {dayInfractions.length}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 my-1">
                      {present > 0 && (
                        <div className="flex items-center justify-between text-[11px] px-1.5 py-0.5 rounded bg-green-50 text-green-800 border border-green-200">
                          <span>Present</span>
                          <span className="font-bold">{present}</span>
                        </div>
                      )}
                      {late > 0 && (
                        <div className="flex items-center justify-between text-[11px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                          <span>Late</span>
                          <span className="font-bold">{late}</span>
                        </div>
                      )}
                      {absent > 0 && (
                        <div className="flex items-center justify-between text-[11px] px-1.5 py-0.5 rounded bg-red-50 text-red-800 border border-red-200">
                          <span>Absent</span>
                          <span className="font-bold">{absent}</span>
                        </div>
                      )}
                      {excused > 0 && (
                        <div className="flex items-center justify-between text-[11px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200">
                          <span>Excused</span>
                          <span className="font-bold">{excused}</span>
                        </div>
                      )}
                    </div>

                    <div className="text-[10px] text-gray-400 text-right">
                      {off} off
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: ITEMIZED DEDUCTIONS LOG */}
      {viewMode === "deductions" && (
        <div className="card overflow-x-auto animate-in fade-in duration-150">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Itemized Deductions ({itemized.length})</h2>
            <p className="text-sm font-bold text-gray-700">
              Total Sum:{" "}
              <span className="text-brand font-extrabold text-base">
                {formatCurrency(overview?.totalDeductions ?? 0)}
              </span>
            </p>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Employee</th>
                <th>Role</th>
                <th>Category</th>
                <th>Description</th>
                <th className="text-right">Amount (₦)</th>
              </tr>
            </thead>
            <tbody>
              {itemized.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-gray-400 py-8">
                    No deductions recorded in {monthName} {yearNum}.
                  </td>
                </tr>
              )}
              {itemized.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50 transition">
                  <td className="whitespace-nowrap font-medium text-gray-900">
                    {new Date(`${d.date}T00:00:00Z`).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      timeZone: "UTC",
                    })}
                  </td>
                  <td className="font-semibold">{d.employeeName}</td>
                  <td className="text-gray-500">{d.role}</td>
                  <td>
                    <span
                      className={`text-xs rounded-full px-2 py-0.5 font-medium ${
                        d.category === "LATE"
                          ? "bg-amber-100 text-amber-800"
                          : d.category === "ABSENT"
                          ? "bg-rose-100 text-rose-800 font-bold"
                          : "bg-purple-100 text-purple-800"
                      }`}
                    >
                      {d.label}
                    </span>
                  </td>
                  <td className="text-gray-600 text-xs">{d.description || "—"}</td>
                  <td className="text-right font-bold text-red-600 whitespace-nowrap">
                    {formatCurrency(d.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Day Cell Click Inspector Modal */}
      {selectedCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setSelectedCell(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-4 space-y-3 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <div>
                <p className="font-bold text-gray-900 text-sm">{selectedCell.employeeName}</p>
                <p className="text-xs text-gray-500">{selectedCell.role}</p>
              </div>
              <button
                onClick={() => setSelectedCell(null)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                &times;
              </button>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Date:</span>
                <span className="font-semibold text-gray-800">
                  {new Date(`${selectedCell.day.date}T00:00:00Z`).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                    timeZone: "UTC",
                  })}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-500">Status:</span>
                <span
                  className={`px-2 py-0.5 rounded font-bold ${
                    selectedCell.day.status === "OFF"
                      ? "bg-gray-100 text-gray-600 border border-gray-300"
                      : selectedCell.day.status === "PRESENT"
                      ? "bg-green-100 text-green-800"
                      : selectedCell.day.status === "LATE"
                      ? "bg-amber-100 text-amber-800"
                      : selectedCell.day.status === "ABSENT"
                      ? "bg-red-100 text-red-800"
                      : selectedCell.day.status === "EXCUSED"
                      ? "bg-purple-100 text-purple-800"
                      : "text-gray-400"
                  }`}
                >
                  {selectedCell.day.status === "OFF"
                    ? "Off Day"
                    : selectedCell.day.status ?? "Unset"}
                </span>
              </div>

              {selectedCell.day.note && (
                <div className="bg-gray-50 p-2 rounded text-gray-600 italic">
                  Note: &ldquo;{selectedCell.day.note}&rdquo;
                </div>
              )}

              {selectedCell.day.infractionAmount > 0 && (
                <div className="bg-red-50 p-2 rounded text-red-700 font-semibold flex justify-between">
                  <span>Infraction Penalty:</span>
                  <span>{formatCurrency(selectedCell.day.infractionAmount)}</span>
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedCell(null)}
              className="btn-secondary w-full text-xs"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Individual Employee Calendar Modal */}
      {selectedEmployeeForModal && (
        <EmployeeCalendarModal
          employee={selectedEmployeeForModal}
          onClose={() => setSelectedEmployeeForModal(null)}
          onEmployeeUpdated={() => {
            loadData(selectedMonth);
          }}
        />
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import EmployeeCalendarModal from "../employees/EmployeeCalendarModal";

type EmployeeSummary = {
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

type DailyStat = {
  date: string;
  dayNum: number;
  dayOfWeek: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  totalMarked: number;
  deductions: number;
};

type MonthSummaryData = {
  month: string;
  departmentName: string;
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
  employees: EmployeeSummary[];
  itemizedDeductions: ItemizedDeduction[];
  dailyBreakdown: DailyStat[];
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

export default function MonthSummaryPage() {
  const currentMonthISO = getInitialMonth();
  const [selectedMonth, setSelectedMonth] = useState(currentMonthISO);
  const [data, setData] = useState<MonthSummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters & sorting for employees tab
  const [activeTab, setActiveTab] = useState<"employees" | "deductions" | "daily">("employees");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<"name" | "deductions" | "rate" | "absent" | "late">("deductions");

  // Deductions filter
  const [deductionCategoryFilter, setDeductionCategoryFilter] = useState<string>("ALL");

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

  // Filter deductions
  const itemized = data?.itemizedDeductions ?? [];
  const filteredDeductions = itemized.filter((d) => {
    if (deductionCategoryFilter === "ALL") return true;
    return d.category === deductionCategoryFilter;
  });

  const overview = data?.overview;

  return (
    <div className="space-y-6">
      {/* Header & Month Selector */}
      <div className="card">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-semibold text-gray-500">
                {data?.departmentName || "Team"}
              </span>
              <span className="text-xs text-gray-400">•</span>
              <span className="text-xs text-gray-500 font-medium">Monthly Overview</span>
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
              className="btn-secondary text-xs flex items-center gap-1.5 ml-auto sm:ml-0"
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

      {/* Top Overview KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="card !p-4 bg-emerald-50/70 border-emerald-200">
          <p className="text-xs font-semibold text-emerald-800">Attendance Rate</p>
          <p className="text-2xl font-bold text-emerald-950 mt-1">
            {overview?.attendanceRate !== null && overview?.attendanceRate !== undefined
              ? `${overview.attendanceRate}%`
              : "—"}
          </p>
          <p className="text-[11px] text-emerald-700 mt-0.5">
            {overview?.totalPresent ?? 0} shifts worked
          </p>
        </div>

        <div className="card !p-4 bg-amber-50/70 border-amber-200">
          <p className="text-xs font-semibold text-amber-800">Lateness</p>
          <p className="text-2xl font-bold text-amber-950 mt-1">{overview?.totalLate ?? 0}</p>
          <p className="text-[11px] text-amber-700 mt-0.5">
            {formatCurrency(overview?.cashFromLateness ?? 0)}
          </p>
        </div>

        <div className="card !p-4 bg-rose-50/70 border-rose-200">
          <p className="text-xs font-semibold text-rose-800">Absences</p>
          <p className="text-2xl font-bold text-rose-950 mt-1">{overview?.totalAbsent ?? 0}</p>
          <p className="text-[11px] text-rose-700 mt-0.5">
            {formatCurrency(overview?.cashFromAbsence ?? 0)}
          </p>
        </div>

        <div className="card !p-4 bg-purple-50/70 border-purple-200">
          <p className="text-xs font-semibold text-purple-800">Excused</p>
          <p className="text-2xl font-bold text-purple-950 mt-1">{overview?.totalExcused ?? 0}</p>
          <p className="text-[11px] text-purple-700 mt-0.5">Authorized leaves</p>
        </div>

        <div className="card !p-4 bg-orange-50/70 border-orange-200">
          <p className="text-xs font-semibold text-orange-800">Infractions</p>
          <p className="text-2xl font-bold text-orange-950 mt-1">{overview?.totalInfractions ?? 0}</p>
          <p className="text-[11px] text-orange-700 mt-0.5">
            {formatCurrency(overview?.cashFromInfractions ?? 0)}
          </p>
        </div>

        <div className="card !p-4 bg-brand/5 border-brand/20 col-span-2 lg:col-span-1">
          <p className="text-xs font-semibold text-brand">Total Deductions</p>
          <p className="text-xl sm:text-2xl font-bold text-brand mt-1 truncate">
            {formatCurrency(overview?.totalDeductions ?? 0)}
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">Attendance + penalties</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white rounded-t-xl px-4 pt-2">
        <button
          onClick={() => setActiveTab("employees")}
          className={`py-3 px-4 text-sm font-semibold border-b-2 transition -mb-px flex items-center gap-2 ${
            activeTab === "employees"
              ? "border-brand text-brand"
              : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
        >
          <span>👥</span>
          <span>Employee Breakdown ({employees.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("deductions")}
          className={`py-3 px-4 text-sm font-semibold border-b-2 transition -mb-px flex items-center gap-2 ${
            activeTab === "deductions"
              ? "border-brand text-brand"
              : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
        >
          <span>💰</span>
          <span>Itemized Deductions ({itemized.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("daily")}
          className={`py-3 px-4 text-sm font-semibold border-b-2 transition -mb-px flex items-center gap-2 ${
            activeTab === "daily"
              ? "border-brand text-brand"
              : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
        >
          <span>📅</span>
          <span>Daily Trends</span>
        </button>
      </div>

      {/* Tab 1: Employees Breakdown */}
      {activeTab === "employees" && (
        <div className="space-y-4">
          {/* Controls */}
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
                <option value="deductions">Highest Deductions</option>
                <option value="rate">Attendance Rate</option>
                <option value="absent">Most Absences</option>
                <option value="late">Most Lateness</option>
                <option value="name">Employee Name</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="card overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Role</th>
                  <th className="text-center">Present</th>
                  <th className="text-center">Late</th>
                  <th className="text-center">Absent</th>
                  <th className="text-center">Excused</th>
                  <th className="text-center">Off Days</th>
                  <th className="text-center">Infractions</th>
                  <th className="text-right">Deductions</th>
                  <th className="text-right">Rate</th>
                  <th className="text-center">Calendar</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={11} className="text-center text-gray-400 py-8">
                      Loading monthly summary...
                    </td>
                  </tr>
                )}
                {!loading && filteredEmployees.length === 0 && (
                  <tr>
                    <td colSpan={11} className="text-center text-gray-400 py-8">
                      No employees match this filter.
                    </td>
                  </tr>
                )}
                {filteredEmployees.map((emp) => (
                  <tr key={emp.employeeId} className="hover:bg-gray-50/80 transition">
                    <td className="font-medium whitespace-nowrap">
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
                        className="text-left hover:text-brand hover:underline font-semibold"
                      >
                        {emp.name}
                      </button>
                    </td>
                    <td className="text-gray-500 whitespace-nowrap">{emp.role}</td>
                    <td className="text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                        {emp.present}
                      </span>
                    </td>
                    <td className="text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                          emp.late > 0 ? "bg-amber-100 text-amber-800" : "text-gray-400"
                        }`}
                      >
                        {emp.late}
                      </span>
                    </td>
                    <td className="text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                          emp.absent > 0 ? "bg-rose-100 text-rose-800 font-bold" : "text-gray-400"
                        }`}
                      >
                        {emp.absent}
                      </span>
                    </td>
                    <td className="text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                          emp.excused > 0 ? "bg-purple-100 text-purple-800" : "text-gray-400"
                        }`}
                      >
                        {emp.excused}
                      </span>
                    </td>
                    <td className="text-center text-gray-500 text-xs">{emp.offDay}</td>
                    <td className="text-center">
                      {emp.infractionsCount > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                          <span>⚠️</span>
                          <span>{emp.infractionsCount}</span>
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="text-right font-semibold whitespace-nowrap">
                      {emp.totalDeductions > 0 ? (
                        <span className="text-red-600">{formatCurrency(emp.totalDeductions)}</span>
                      ) : (
                        <span className="text-gray-400">₦0</span>
                      )}
                    </td>
                    <td className="text-right font-semibold whitespace-nowrap">
                      {emp.attendanceRate !== null ? (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                            emp.attendanceRate >= 90
                              ? "bg-green-100 text-green-800"
                              : emp.attendanceRate >= 75
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {emp.attendanceRate}%
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="text-center">
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
                        className="btn-secondary !py-1 !px-2 text-xs"
                        title="View monthly calendar"
                      >
                        📅 View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Itemized Deductions */}
      {activeTab === "deductions" && (
        <div className="space-y-4">
          <div className="card flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 uppercase">Filter:</span>
              <button
                onClick={() => setDeductionCategoryFilter("ALL")}
                className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition ${
                  deductionCategoryFilter === "ALL"
                    ? "bg-brand text-white border-brand"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                }`}
              >
                All ({itemized.length})
              </button>
              <button
                onClick={() => setDeductionCategoryFilter("LATE")}
                className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition ${
                  deductionCategoryFilter === "LATE"
                    ? "bg-amber-600 text-white border-amber-600"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                }`}
              >
                Lateness ({itemized.filter((d) => d.category === "LATE").length})
              </button>
              <button
                onClick={() => setDeductionCategoryFilter("ABSENT")}
                className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition ${
                  deductionCategoryFilter === "ABSENT"
                    ? "bg-rose-600 text-white border-rose-600"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                }`}
              >
                Absences ({itemized.filter((d) => d.category === "ABSENT").length})
              </button>
              <button
                onClick={() => setDeductionCategoryFilter("INFRACTION")}
                className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition ${
                  deductionCategoryFilter === "INFRACTION"
                    ? "bg-purple-600 text-white border-purple-600"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                }`}
              >
                Infractions ({itemized.filter((d) => d.category === "INFRACTION").length})
              </button>
            </div>

            <p className="text-xs font-bold text-gray-700">
              Total Sum:{" "}
              <span className="text-brand font-extrabold text-sm">
                {formatCurrency(filteredDeductions.reduce((sum, d) => sum + d.amount, 0))}
              </span>
            </p>
          </div>

          <div className="card overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Employee</th>
                  <th>Role</th>
                  <th>Category</th>
                  <th>Reason / Note</th>
                  <th className="text-right">Amount (₦)</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeductions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-gray-400 py-8">
                      No deductions found in this category for {monthName} {yearNum}.
                    </td>
                  </tr>
                )}
                {filteredDeductions.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50/80 transition">
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
        </div>
      )}

      {/* Tab 3: Daily Trends */}
      {activeTab === "daily" && (
        <div className="card overflow-x-auto">
          <h2 className="font-semibold mb-3">Day-by-Day Attendance Trend</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Day</th>
                <th className="text-center">Present</th>
                <th className="text-center">Late</th>
                <th className="text-center">Absent</th>
                <th className="text-center">Excused</th>
                <th className="text-center">Duty Shifts</th>
                <th className="text-right">Deductions</th>
              </tr>
            </thead>
            <tbody>
              {(data?.dailyBreakdown ?? []).map((day) => {
                const isWeekend = day.dayOfWeek === 0 || day.dayOfWeek === 6;
                return (
                  <tr
                    key={day.date}
                    className={`hover:bg-gray-50 transition ${isWeekend ? "bg-gray-50/50" : ""}`}
                  >
                    <td className="font-medium text-gray-900">{day.date}</td>
                    <td className="text-gray-500 font-medium">
                      {WEEKDAY_NAMES[day.dayOfWeek]}
                    </td>
                    <td className="text-center">
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                        {day.present}
                      </span>
                    </td>
                    <td className="text-center">
                      <span
                        className={`text-xs font-semibold ${
                          day.late > 0 ? "text-amber-800 bg-amber-50 px-2 py-0.5 rounded font-bold" : "text-gray-400"
                        }`}
                      >
                        {day.late}
                      </span>
                    </td>
                    <td className="text-center">
                      <span
                        className={`text-xs font-semibold ${
                          day.absent > 0 ? "text-rose-800 bg-rose-50 px-2 py-0.5 rounded font-bold" : "text-gray-400"
                        }`}
                      >
                        {day.absent}
                      </span>
                    </td>
                    <td className="text-center">
                      <span
                        className={`text-xs font-semibold ${
                          day.excused > 0 ? "text-purple-800 bg-purple-50 px-2 py-0.5 rounded" : "text-gray-400"
                        }`}
                      >
                        {day.excused}
                      </span>
                    </td>
                    <td className="text-center text-xs text-gray-600 font-medium">
                      {day.totalMarked}
                    </td>
                    <td className="text-right font-bold text-xs whitespace-nowrap">
                      {day.deductions > 0 ? (
                        <span className="text-red-600">{formatCurrency(day.deductions)}</span>
                      ) : (
                        <span className="text-gray-400">₦0</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Interactive Employee Calendar Modal */}
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

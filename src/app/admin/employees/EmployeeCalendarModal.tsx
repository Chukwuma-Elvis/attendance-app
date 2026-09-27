"use client";

import { useEffect, useState } from "react";

type Employee = {
  id: string;
  name: string;
  role: string;
  active: boolean;
  workingDays: number[];
};

type AttendanceRecord = {
  id: string;
  date: string; // YYYY-MM-DD
  status: "PRESENT" | "LATE" | "ABSENT" | "EXCUSED" | "OFF_DAY";
  note: string | null;
};

type InfractionRecord = {
  id: string;
  date: string; // YYYY-MM-DD
  type: "MINOR" | "MAJOR" | "MISCELLANEOUS";
  description: string | null;
  amount: number;
};

type PenaltyRule = {
  key: string;
  label: string;
  amount: number;
};

type DayCell = {
  dateStr: string; // YYYY-MM-DD
  dayNumber: number;
  dayOfWeek: number; // 0 = Sun ... 6 = Sat
  isWorkingDay: boolean;
  status: "PRESENT" | "LATE" | "ABSENT" | "EXCUSED" | "OFF" | "UNSET";
  attendanceRecord?: AttendanceRecord;
  infractions: InfractionRecord[];
  isToday: boolean;
  isFuture: boolean;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAYS_SCHEDULE = [
  { n: 0, label: "Sun" },
  { n: 1, label: "Mon" },
  { n: 2, label: "Tue" },
  { n: 3, label: "Wed" },
  { n: 4, label: "Thu" },
  { n: 5, label: "Fri" },
  { n: 6, label: "Sat" },
];

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(n);
}

function getTodayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function EmployeeCalendarModal({
  employee,
  onClose,
  onEmployeeUpdated,
}: {
  employee: Employee;
  onClose: () => void;
  onEmployeeUpdated: () => void;
}) {
  const todayISO = getTodayISO();
  const initialMonth = todayISO.slice(0, 7); // "YYYY-MM"

  const [activeTab, setActiveTab] = useState<"calendar" | "settings">("calendar");
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [infractions, setInfractions] = useState<InfractionRecord[]>([]);
  const [penaltyRules, setPenaltyRules] = useState<PenaltyRule[]>([]);
  const [selectedDay, setSelectedDay] = useState<DayCell | null>(null);

  // Settings & Schedule edit state
  const [nameDraft, setNameDraft] = useState(employee.name);
  const [roleDraft, setRoleDraft] = useState(employee.role);
  const [savingDetails, setSavingDetails] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Fetch monthly attendance and infractions for the employee
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`/api/employees/${employee.id}?month=${selectedMonth}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data) {
          setAttendance(data.attendance ?? []);
          setInfractions(data.infractions ?? []);
          setPenaltyRules(data.penaltyRules ?? []);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [employee.id, selectedMonth]);

  // Navigate months
  function prevMonth() {
    const [y, m] = selectedMonth.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 2, 1));
    setSelectedMonth(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
    setSelectedDay(null);
  }

  function nextMonth() {
    const [y, m] = selectedMonth.split("-").map(Number);
    const d = new Date(Date.UTC(y, m, 1));
    setSelectedMonth(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
    setSelectedDay(null);
  }

  // Parse current selected year and month
  const [yearNum, monthNum] = selectedMonth.split("-").map(Number);
  const monthName = MONTH_NAMES[monthNum - 1] ?? "";

  // Build calendar days
  const firstDayOfWeek = new Date(Date.UTC(yearNum, monthNum - 1, 1)).getUTCDay(); // 0 = Sun
  const totalDaysInMonth = new Date(Date.UTC(yearNum, monthNum, 0)).getUTCDate();

  const attendanceMap = new Map<string, AttendanceRecord>(
    attendance.map((a) => [a.date, a])
  );

  const infractionsMap = new Map<string, InfractionRecord[]>();
  for (const inf of infractions) {
    const list = infractionsMap.get(inf.date) ?? [];
    list.push(inf);
    infractionsMap.set(inf.date, list);
  }

  const calendarDays: DayCell[] = [];
  for (let day = 1; day <= totalDaysInMonth; day++) {
    const dateStr = `${yearNum}-${String(monthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayOfWeek = (firstDayOfWeek + day - 1) % 7;
    const isWorkingDay = employee.workingDays.includes(dayOfWeek);
    const att = attendanceMap.get(dateStr);
    const dayInfractions = infractionsMap.get(dateStr) ?? [];

    let status: DayCell["status"] = "UNSET";
    if (att) {
      if (att.status === "OFF_DAY") {
        status = "OFF";
      } else {
        status = att.status;
      }
    } else if (!isWorkingDay) {
      // Not on working roster and not recorded otherwise -> off day!
      status = "OFF";
    }

    const isToday = dateStr === todayISO;
    const isFuture = dateStr > todayISO;

    calendarDays.push({
      dateStr,
      dayNumber: day,
      dayOfWeek,
      isWorkingDay,
      status,
      attendanceRecord: att,
      infractions: dayInfractions,
      isToday,
      isFuture,
    });
  }

  // Monthly stats calculations
  const presentCount = calendarDays.filter((d) => d.status === "PRESENT").length;
  const lateCount = calendarDays.filter((d) => d.status === "LATE").length;
  const absentCount = calendarDays.filter((d) => d.status === "ABSENT").length;
  const excusedCount = calendarDays.filter((d) => d.status === "EXCUSED").length;
  const offCount = calendarDays.filter((d) => d.status === "OFF").length;
  const totalInfractions = infractions.length;

  const ruleMap = Object.fromEntries(penaltyRules.map((r) => [r.key, r.amount]));
  const cashFromAttendance =
    lateCount * (ruleMap.LATE ?? 10000) + absentCount * (ruleMap.ABSENT ?? 50000);
  const cashFromInfractions = infractions.reduce((sum, i) => sum + i.amount, 0);
  const totalDeductions = cashFromAttendance + cashFromInfractions;

  const markedDutyDays = presentCount + lateCount + absentCount;
  const attendanceRate = markedDutyDays > 0 ? Math.round((presentCount / markedDutyDays) * 100) : null;

  // Settings handlers
  async function saveDetails() {
    if (!nameDraft.trim() || !roleDraft.trim()) return;
    setSavingDetails(true);
    await fetch(`/api/employees/${employee.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nameDraft.trim(), role: roleDraft.trim() }),
    });
    setSavingDetails(false);
    onEmployeeUpdated();
  }

  async function toggleActive() {
    await fetch(`/api/employees/${employee.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !employee.active }),
    });
    onEmployeeUpdated();
  }

  async function toggleWorkingDay(day: number) {
    const workingDays = employee.workingDays.includes(day)
      ? employee.workingDays.filter((d) => d !== day)
      : [...employee.workingDays, day].sort();
    await fetch(`/api/employees/${employee.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workingDays }),
    });
    onEmployeeUpdated();
  }

  async function deleteEmployee() {
    const confirmed = window.confirm(
      `Delete ${employee.name}? This permanently removes their attendance history, infractions, and schedule. This cannot be undone.`
    );
    if (!confirmed) return;
    setDeleting(true);
    await fetch(`/api/employees/${employee.id}`, { method: "DELETE" });
    setDeleting(false);
    onClose();
    onEmployeeUpdated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between gap-3 p-4 sm:p-5 border-b border-gray-200 bg-white shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-gray-900 truncate">{employee.name}</h2>
              <span
                className={`text-xs font-medium rounded-full px-2 py-0.5 ${
                  employee.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                }`}
              >
                {employee.active ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="text-sm text-gray-500 truncate">{employee.role}</p>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-1.5 transition text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-gray-200 px-4 sm:px-5 bg-gray-50/50 shrink-0">
          <button
            onClick={() => setActiveTab("calendar")}
            className={`py-2.5 px-4 text-sm font-medium border-b-2 transition -mb-px flex items-center gap-2 ${
              activeTab === "calendar"
                ? "border-brand text-brand font-semibold"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <span>📅</span>
            <span>Monthly Summary</span>
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`py-2.5 px-4 text-sm font-medium border-b-2 transition -mb-px flex items-center gap-2 ${
              activeTab === "settings"
                ? "border-brand text-brand font-semibold"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <span>⚙️</span>
            <span>Profile & Schedule</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1">
          {activeTab === "calendar" && (
            <>
              {/* Month Navigation & Selector */}
              <div className="flex items-center justify-between gap-2 flex-wrap bg-gray-50 p-3 rounded-xl border border-gray-200">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={prevMonth}
                    aria-label="Previous month"
                    className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 shadow-sm transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <span className="font-bold text-gray-900 text-base sm:text-lg min-w-[140px] text-center">
                    {monthName} {yearNum}
                  </span>
                  <button
                    onClick={nextMonth}
                    aria-label="Next month"
                    className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 shadow-sm transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => {
                      if (e.target.value) {
                        setSelectedMonth(e.target.value);
                        setSelectedDay(null);
                      }
                    }}
                    className="input !py-1 !px-2.5 text-xs font-medium"
                  />
                  {selectedMonth !== initialMonth && (
                    <button
                      onClick={() => {
                        setSelectedMonth(initialMonth);
                        setSelectedDay(null);
                      }}
                      className="text-xs text-brand hover:underline font-medium"
                    >
                      Current Month
                    </button>
                  )}
                </div>
              </div>

              {/* Monthly Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
                <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-2.5 sm:p-3 text-center">
                  <p className="text-xs text-emerald-800 font-medium">Present</p>
                  <p className="text-xl sm:text-2xl font-bold text-emerald-900">{presentCount}</p>
                  <p className="text-[10px] text-emerald-700">
                    {attendanceRate !== null ? `${attendanceRate}% rate` : "No duty records"}
                  </p>
                </div>

                <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-2.5 sm:p-3 text-center">
                  <p className="text-xs text-amber-800 font-medium">Late</p>
                  <p className="text-xl sm:text-2xl font-bold text-amber-900">{lateCount}</p>
                  <p className="text-[10px] text-amber-700">Days late</p>
                </div>

                <div className="bg-rose-50/80 border border-rose-200 rounded-xl p-2.5 sm:p-3 text-center">
                  <p className="text-xs text-rose-800 font-medium">Absent</p>
                  <p className="text-xl sm:text-2xl font-bold text-rose-900">{absentCount}</p>
                  <p className="text-[10px] text-rose-700">Days absent</p>
                </div>

                <div className="bg-purple-50/80 border border-purple-200 rounded-xl p-2.5 sm:p-3 text-center">
                  <p className="text-xs text-purple-800 font-medium">Excused</p>
                  <p className="text-xl sm:text-2xl font-bold text-purple-900">{excusedCount}</p>
                  <p className="text-[10px] text-purple-700">Excused leave</p>
                </div>

                <div className="bg-gray-100 border border-gray-200 rounded-xl p-2.5 sm:p-3 text-center col-span-2 sm:col-span-1">
                  <p className="text-xs text-gray-600 font-medium">Off Days</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-800">{offCount}</p>
                  <p className="text-[10px] text-gray-500">Rest / off days</p>
                </div>
              </div>

              {/* Deductions banner if any */}
              {totalDeductions > 0 && (
                <div className="flex items-center justify-between bg-red-50/70 border border-red-200 rounded-xl px-3.5 py-2 text-xs text-red-900">
                  <div className="flex items-center gap-1.5 font-medium">
                    <span>⚠️ Deductions this month:</span>
                    <span>{formatCurrency(totalDeductions)}</span>
                  </div>
                  {totalInfractions > 0 && (
                    <span className="text-red-700">
                      ({totalInfractions} infraction{totalInfractions > 1 ? "s" : ""})
                    </span>
                  )}
                </div>
              )}

              {/* Calendar Grid */}
              <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                {/* Weekday headers */}
                <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50/80 text-center text-xs font-semibold text-gray-600 py-2">
                  {WEEKDAYS.map((w, idx) => (
                    <div key={w} className={idx === 0 || idx === 6 ? "text-gray-400" : ""}>
                      {w}
                    </div>
                  ))}
                </div>

                {/* Day cells */}
                <div className="grid grid-cols-7 gap-px bg-gray-200">
                  {/* Leading blanks for offset */}
                  {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                    <div key={`blank-${i}`} className="bg-gray-50/40 min-h-[58px] sm:min-h-[64px]" />
                  ))}

                  {/* Month days */}
                  {calendarDays.map((day) => {
                    const isSelected = selectedDay?.dateStr === day.dateStr;

                    // Color coding styling
                    let cellBg = "bg-white hover:bg-gray-50";
                    let badgeClass = "";
                    let label = "";

                    if (day.status === "OFF") {
                      // Off day marked in GREY as requested
                      cellBg = "bg-gray-100/90 text-gray-400 hover:bg-gray-200/70";
                      badgeClass = "bg-gray-200/90 text-gray-600 border border-gray-300";
                      label = "Off";
                    } else if (day.status === "PRESENT") {
                      cellBg = "bg-emerald-50 text-emerald-900 hover:bg-emerald-100/70";
                      badgeClass = "bg-emerald-100 text-emerald-800 border border-emerald-300";
                      label = "Present";
                    } else if (day.status === "LATE") {
                      cellBg = "bg-amber-50 text-amber-900 hover:bg-amber-100/70";
                      badgeClass = "bg-amber-100 text-amber-800 border border-amber-300";
                      label = "Late";
                    } else if (day.status === "ABSENT") {
                      cellBg = "bg-rose-50 text-rose-900 hover:bg-rose-100/70";
                      badgeClass = "bg-rose-100 text-rose-800 border border-rose-300";
                      label = "Absent";
                    } else if (day.status === "EXCUSED") {
                      cellBg = "bg-purple-50 text-purple-900 hover:bg-purple-100/70";
                      badgeClass = "bg-purple-100 text-purple-800 border border-purple-300";
                      label = "Excused";
                    } else if (day.isWorkingDay && !day.isFuture) {
                      // Unrecorded past working day
                      cellBg = "bg-white text-gray-600 hover:bg-gray-50";
                      badgeClass = "bg-gray-50 text-gray-400 border border-gray-200";
                      label = "Unset";
                    }

                    return (
                      <button
                        key={day.dateStr}
                        type="button"
                        onClick={() => setSelectedDay(day)}
                        className={`min-h-[58px] sm:min-h-[64px] p-1.5 flex flex-col justify-between text-left transition relative ${cellBg} ${
                          isSelected ? "ring-2 ring-brand z-10" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span
                            className={`text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center ${
                              day.isToday
                                ? "bg-brand text-white font-bold"
                                : day.status === "OFF"
                                ? "text-gray-400"
                                : "text-gray-700"
                            }`}
                          >
                            {day.dayNumber}
                          </span>

                          {/* Infraction indicator dot/badge */}
                          {day.infractions.length > 0 && (
                            <span
                              title={`${day.infractions.length} infraction(s)`}
                              className="text-[10px] font-bold text-white bg-red-600 rounded-full w-3.5 h-3.5 flex items-center justify-center shrink-0 shadow-sm"
                            >
                              !
                            </span>
                          )}
                        </div>

                        {/* Status Label Badge */}
                        {label && (
                          <div className="mt-1 flex items-center">
                            <span
                              className={`text-[9px] sm:text-[10px] font-semibold px-1 sm:px-1.5 py-0.5 rounded leading-none truncate max-w-full ${badgeClass}`}
                            >
                              {label}
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Day Inspector card if a day is clicked */}
              {selectedDay && (
                <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3 text-xs space-y-1.5 animate-in fade-in duration-100">
                  <div className="flex items-center justify-between font-semibold text-blue-900">
                    <span>
                      {new Date(`${selectedDay.dateStr}T00:00:00Z`).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        timeZone: "UTC",
                      })}
                    </span>
                    <button
                      onClick={() => setSelectedDay(null)}
                      className="text-blue-500 hover:text-blue-800 text-sm leading-none"
                    >
                      &times;
                    </button>
                  </div>

                  <div className="text-gray-700 flex items-center gap-2 flex-wrap">
                    <span>
                      Status:{" "}
                      <strong className="text-gray-900">
                        {selectedDay.status === "OFF"
                          ? "Off Day (Rest Day)"
                          : selectedDay.status === "UNSET"
                          ? "Unset (Not Marked)"
                          : selectedDay.status}
                      </strong>
                    </span>
                    <span>•</span>
                    <span>
                      Schedule:{" "}
                      {selectedDay.isWorkingDay ? "Scheduled Work Day" : "Regular Non-Working Day"}
                    </span>
                  </div>

                  {selectedDay.attendanceRecord?.note && (
                    <p className="text-gray-600 italic">
                      Note: &ldquo;{selectedDay.attendanceRecord.note}&rdquo;
                    </p>
                  )}

                  {selectedDay.infractions.length > 0 && (
                    <div className="mt-1 pt-1 border-t border-blue-200/60 space-y-1">
                      <p className="font-semibold text-red-700">Infractions on this date:</p>
                      {selectedDay.infractions.map((inf) => (
                        <div key={inf.id} className="text-red-900 flex justify-between">
                          <span>
                            • {inf.type} {inf.description ? `(${inf.description})` : ""}
                          </span>
                          <span className="font-medium">{formatCurrency(inf.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Color Code Legend */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">
                  Color Legend
                </p>
                <div className="flex items-center gap-3 flex-wrap text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded bg-emerald-100 border border-emerald-300 shrink-0" />
                    <span className="text-gray-700 font-medium">Present</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded bg-amber-100 border border-amber-300 shrink-0" />
                    <span className="text-gray-700 font-medium">Late</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded bg-rose-100 border border-rose-300 shrink-0" />
                    <span className="text-gray-700 font-medium">Absent</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded bg-purple-100 border border-purple-300 shrink-0" />
                    <span className="text-gray-700 font-medium">Excused</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded bg-gray-100 border border-gray-300 shrink-0" />
                    <span className="text-gray-700 font-semibold">Off Day (Grey)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded-full bg-red-600 text-white text-[8px] flex items-center justify-center font-bold shrink-0">
                      !
                    </span>
                    <span className="text-gray-700 font-medium">Infraction</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === "settings" && (
            <div className="space-y-6 animate-in fade-in duration-100">
              {/* Edit Details */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">Employee Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Full Name</label>
                    <input
                      className="input w-full"
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Role / Position</label>
                    <input
                      className="input w-full"
                      value={roleDraft}
                      onChange={(e) => setRoleDraft(e.target.value)}
                    />
                  </div>
                </div>
                <button
                  onClick={saveDetails}
                  disabled={savingDetails}
                  className="btn-primary text-xs"
                >
                  {savingDetails ? "Saving..." : "Save Details"}
                </button>
              </div>

              {/* Weekly Working Days Schedule */}
              <div className="space-y-2 pt-4 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900">Weekly Working Days Schedule</h3>
                <p className="text-xs text-gray-500">
                  Select the days this employee is normally scheduled to work. Days not selected are treated as Off Days (marked in grey on the calendar).
                </p>
                <div className="flex gap-1.5 flex-wrap pt-1">
                  {DAYS_SCHEDULE.map((d) => {
                    const isScheduled = employee.workingDays.includes(d.n);
                    return (
                      <button
                        key={d.n}
                        type="button"
                        onClick={() => toggleWorkingDay(d.n)}
                        className={`text-xs font-medium rounded-lg px-3 py-1.5 border transition ${
                          isScheduled
                            ? "bg-brand text-white border-brand shadow-sm"
                            : "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200"
                        }`}
                      >
                        {d.label} {isScheduled ? "✓" : ""}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status and Danger Zone */}
              <div className="pt-4 border-t border-gray-200 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">Account Status</h3>
                <div className="flex items-center gap-3">
                  <button onClick={toggleActive} className="btn-secondary text-xs">
                    {employee.active ? "Deactivate Employee" : "Reactivate Employee"}
                  </button>
                  <button
                    onClick={deleteEmployee}
                    disabled={deleting}
                    className="text-xs rounded-lg px-4 py-2 font-medium bg-red-50 text-red-600 hover:bg-red-100 transition"
                  >
                    {deleting ? "Deleting..." : "Delete Employee Permanently"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

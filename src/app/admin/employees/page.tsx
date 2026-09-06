"use client";

import { useEffect, useState } from "react";

type Employee = {
  id: string;
  name: string;
  role: string;
  active: boolean;
  workingDays: number[];
};

type Breakdown = {
  employeeId: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
  offDay: number;
  minorInfractions: number;
  majorInfractions: number;
  miscDeductions: number;
  totalDeduction: number;
};

const DAYS = [
  { n: 0, label: "Sun" },
  { n: 1, label: "Mon" },
  { n: 2, label: "Tue" },
  { n: 3, label: "Wed" },
  { n: 4, label: "Thu" },
  { n: 5, label: "Fri" },
  { n: 6, label: "Sat" },
];

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);
}

function pct(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : null;
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfMonthISO() {
  const now = new Date();
  return toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
}

function endOfMonthISO() {
  const now = new Date();
  return toISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [breakdowns, setBreakdowns] = useState<Record<string, Breakdown>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, { name: string; role: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(startOfMonthISO());
  const [to, setTo] = useState(endOfMonthISO());

  async function load(rangeFrom = from, rangeTo = to) {
    const qs = new URLSearchParams({ from: rangeFrom, to: rangeTo });
    const [empRes, dedRes] = await Promise.all([
      fetch("/api/employees"),
      fetch(`/api/deductions?${qs.toString()}`),
    ]);
    const empData: Employee[] = await empRes.json();
    const dedData: Breakdown[] = await dedRes.json();
    setEmployees(empData);
    setBreakdowns(Object.fromEntries(dedData.map((b) => [b.employeeId, b])));
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyRange(e: React.FormEvent) {
    e.preventDefault();
    load();
  }

  function toggleExpanded(emp: Employee) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(emp.id)) next.delete(emp.id);
      else next.add(emp.id);
      return next;
    });
    setDrafts((prev) => (prev[emp.id] ? prev : { ...prev, [emp.id]: { name: emp.name, role: emp.role } }));
  }

  function updateDraft(id: string, field: "name" | "role", value: string) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  async function saveDetails(emp: Employee) {
    const draft = drafts[emp.id];
    if (!draft || !draft.name.trim() || !draft.role.trim()) return;
    setSavingId(emp.id);
    await fetch(`/api/employees/${emp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: draft.name.trim(), role: draft.role.trim() }),
    });
    setSavingId(null);
    load();
  }

  async function deleteEmployee(emp: Employee) {
    const confirmed = window.confirm(
      `Delete ${emp.name}? This permanently removes their attendance history, infractions, and schedule. This cannot be undone.`
    );
    if (!confirmed) return;
    setDeletingId(emp.id);
    await fetch(`/api/employees/${emp.id}`, { method: "DELETE" });
    setDeletingId(null);
    setExpanded((prev) => {
      const next = new Set(prev);
      next.delete(emp.id);
      return next;
    });
    load();
  }

  async function addEmployee(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !role) return;
    await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, role }),
    });
    setName("");
    setRole("");
    load();
  }

  async function toggleActive(emp: Employee) {
    await fetch(`/api/employees/${emp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !emp.active }),
    });
    load();
  }

  async function toggleWorkingDay(emp: Employee, day: number) {
    const workingDays = emp.workingDays.includes(day)
      ? emp.workingDays.filter((d) => d !== day)
      : [...emp.workingDays, day].sort();
    await fetch(`/api/employees/${emp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workingDays }),
    });
    load();
  }

  const filteredEmployees = employees.filter((emp) =>
    emp.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Employees</h1>

      <div className="card">
        <label className="block text-sm font-medium mb-1">Search by Name</label>
        <input
          className="input w-full sm:w-80"
          placeholder="Type a name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <form onSubmit={addEmployee} className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Role</label>
          <input className="input" value={role} onChange={(e) => setRole(e.target.value)} />
        </div>
        <button className="btn-primary">Add Employee</button>
      </form>

      <form onSubmit={applyRange} className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Summary From</label>
          <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">To</label>
          <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button className="btn-secondary">Apply</button>
        <span className="text-xs text-gray-500">Defaults to the current month.</span>
      </form>

      {loading && <div className="card text-center text-gray-400 py-6">Loading...</div>}
      {!loading && filteredEmployees.length === 0 && (
        <div className="card text-center text-gray-400 py-6">No employees match "{search}".</div>
      )}

      <div className="space-y-3">
        {filteredEmployees.map((emp) => {
          const isOpen = expanded.has(emp.id);
          const b = breakdowns[emp.id];
          const totalMarked = b ? b.present + b.late + b.absent + b.excused : 0;
          const presentPct = b ? pct(b.present, totalMarked) : null;
          const latePct = b ? pct(b.late, totalMarked) : null;

          return (
            <div key={emp.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <button
                onClick={() => toggleExpanded(emp)}
                className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-gray-50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`text-gray-400 transition-transform ${isOpen ? "rotate-90" : ""}`}>▸</span>
                  <span className="font-medium truncate">{emp.name}</span>
                  <span className="text-sm text-gray-500 truncate">{emp.role}</span>
                </div>
                <span
                  className={`shrink-0 text-xs rounded-full px-2 py-1 ${
                    emp.active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {emp.active ? "Active" : "Inactive"}
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-gray-200 p-4 space-y-5">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-600 mb-2">Details</h3>
                    <div className="flex flex-wrap items-end gap-3">
                      <div>
                        <label className="block text-sm font-medium mb-1">Name</label>
                        <input
                          className="input"
                          value={drafts[emp.id]?.name ?? emp.name}
                          onChange={(e) => updateDraft(emp.id, "name", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Role</label>
                        <input
                          className="input"
                          value={drafts[emp.id]?.role ?? emp.role}
                          onChange={(e) => updateDraft(emp.id, "role", e.target.value)}
                        />
                      </div>
                      <button
                        className="btn-primary text-xs"
                        onClick={() => saveDetails(emp)}
                        disabled={savingId === emp.id}
                      >
                        {savingId === emp.id ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-600 mb-2">Attendance Summary</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500">Present</p>
                        <p className="text-lg font-semibold">{presentPct === null ? "—" : `${presentPct}%`}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500">Late</p>
                        <p className="text-lg font-semibold">{latePct === null ? "—" : `${latePct}%`}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500">Absences</p>
                        <p className="text-lg font-semibold">{b?.absent ?? 0}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500">Excused</p>
                        <p className="text-lg font-semibold">{b?.excused ?? 0}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500">Minor Infractions</p>
                        <p className="text-lg font-semibold">{b?.minorInfractions ?? 0}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500">Major Infractions</p>
                        <p className="text-lg font-semibold">{b?.majorInfractions ?? 0}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3 col-span-2 sm:col-span-2">
                        <p className="text-xs text-gray-500">Total Deductions</p>
                        <p className="text-lg font-semibold text-brand">{formatCurrency(b?.totalDeduction ?? 0)}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-600 mb-2">Weekly Schedule</h3>
                    <div className="flex gap-1 flex-wrap">
                      {DAYS.map((d) => (
                        <button
                          key={d.n}
                          onClick={() => toggleWorkingDay(emp, d.n)}
                          className={`text-xs rounded px-2 py-1 ${
                            emp.workingDays.includes(d.n)
                              ? "bg-brand text-white"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => toggleActive(emp)} className="btn-secondary text-xs">
                      {emp.active ? "Deactivate" : "Reactivate"}
                    </button>
                    <button
                      onClick={() => deleteEmployee(emp)}
                      disabled={deletingId === emp.id}
                      className="text-xs rounded-lg px-4 py-2 font-medium bg-red-50 text-red-600 hover:bg-red-100"
                    >
                      {deletingId === emp.id ? "Deleting..." : "Delete Employee"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

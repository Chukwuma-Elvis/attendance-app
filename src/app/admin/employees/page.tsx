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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { name: string; role: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<"name" | "role">("name");
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

  // Lock background scroll and interaction while any modal is open.
  useEffect(() => {
    document.body.style.overflow = expandedId || addOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [expandedId, addOpen]);

  function applyRange(e: React.FormEvent) {
    e.preventDefault();
    load();
    setRangeOpen(false);
  }

  function toggleExpanded(emp: Employee) {
    setExpandedId((prev) => (prev === emp.id ? null : emp.id));
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
    setExpandedId((prev) => (prev === emp.id ? null : prev));
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
    setAddOpen(false);
    load();
  }

  function toggleSearch() {
    if (searchOpen) setSearch("");
    setSearchOpen((v) => !v);
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

  const roles = Array.from(new Set(employees.map((e) => e.role))).sort();

  // Role filter is applied first so the search box only searches within
  // whatever the filters already narrowed down to.
  const filteredEmployees = employees
    .filter((emp) => roleFilter === "ALL" || emp.role === roleFilter)
    .filter((emp) => emp.name.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) =>
      sortBy === "role" ? a.role.localeCompare(b.role) || a.name.localeCompare(b.name) : a.name.localeCompare(b.name)
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold">Employees</h1>
        <div className="flex items-end gap-2 flex-wrap">
          <button
            type="button"
            onClick={toggleSearch}
            aria-label={searchOpen ? "Close search" : "Search by name"}
            aria-expanded={searchOpen}
            className="btn-secondary !p-2 shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
          {searchOpen && (
            <input
              autoFocus
              className="input w-full sm:w-64"
              placeholder="Type a name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}
          <button
            type="button"
            onClick={() => setRangeOpen((v) => !v)}
            aria-label={rangeOpen ? "Close summary date range" : "Summary date range"}
            aria-expanded={rangeOpen}
            className="btn-secondary !p-2 shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            aria-label="Add employee"
            className="btn-primary !p-2 shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      {rangeOpen && (
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
      )}

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

      {loading && <div className="card text-center text-gray-400 py-6">Loading...</div>}
      {!loading && filteredEmployees.length === 0 && (
        <div className="card text-center text-gray-400 py-6">No employees match "{search}".</div>
      )}

      <div className="space-y-3">
        {filteredEmployees.map((emp) => (
          <button
            key={emp.id}
            onClick={() => toggleExpanded(emp)}
            className="w-full flex items-center justify-between gap-3 p-4 text-left bg-white rounded-xl shadow-sm border border-gray-200 hover:bg-gray-50"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-gray-400">▸</span>
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
        ))}
      </div>

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setAddOpen(false)} />
          <form
            onSubmit={addEmployee}
            className="relative bg-white rounded-xl shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between gap-3 p-4 border-b border-gray-200">
              <p className="font-medium">Add Employee</p>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                aria-label="Close"
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none px-1"
              >
                &times;
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input autoFocus className="input w-full" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <input className="input w-full" value={role} onChange={(e) => setRole(e.target.value)} />
              </div>
              <button className="btn-primary w-full">Add Employee</button>
            </div>
          </form>
        </div>
      )}

      {expandedId &&
        (() => {
          const emp = employees.find((e) => e.id === expandedId);
          if (!emp) return null;
          const b = breakdowns[emp.id];
          const totalMarked = b ? b.present + b.late + b.absent + b.excused : 0;
          const presentPct = b ? pct(b.present, totalMarked) : null;
          const latePct = b ? pct(b.late, totalMarked) : null;

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/50" onClick={() => setExpandedId(null)} />
              <div className="relative bg-white rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between gap-3 p-4 border-b border-gray-200">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{emp.name}</p>
                    <p className="text-sm text-gray-500 truncate">{emp.role}</p>
                  </div>
                  <button
                    onClick={() => setExpandedId(null)}
                    aria-label="Close"
                    className="text-gray-400 hover:text-gray-600 text-2xl leading-none px-1"
                  >
                    &times;
                  </button>
                </div>

                <div className="p-4 space-y-5">
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
              </div>
            </div>
          );
        })()}
    </div>
  );
}

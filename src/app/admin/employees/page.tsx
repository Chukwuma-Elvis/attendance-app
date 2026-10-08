"use client";

import { useEffect, useState } from "react";
import EmployeeCalendarModal from "./EmployeeCalendarModal";

type Employee = {
  id: string;
  name: string;
  role: string;
  active: boolean;
  workingDays: number[];
  biometricResetRequested?: boolean;
  biometricResetAllowed?: boolean;
  customCheckInStartTime?: string | null;
  customCheckInCutoffTime?: string | null;
  customCheckInEndTime?: string | null;
  customCheckOutStartTime?: string | null;
  customCheckOutEndTime?: string | null;
  _count?: {
    biometricCredentials: number;
  };
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
            <div className="flex items-center gap-2 shrink-0">
              {emp.biometricResetRequested && (
                <span className="text-xs bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded-full border border-amber-300 animate-pulse">
                  ⏳ Reset Requested
                </span>
              )}
              {emp.biometricResetAllowed && !emp.biometricResetRequested && (
                <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full border border-blue-300">
                  🔓 Reset Allowed
                </span>
              )}
              {(emp.customCheckInStartTime || emp.customCheckInCutoffTime) && (
                <span className="text-[11px] bg-purple-50 text-purple-700 font-medium px-2 py-0.5 rounded-full border border-purple-200">
                  ⏰ {emp.customCheckInStartTime || "Custom"}
                </span>
              )}
              <span
                className={`text-xs rounded-full px-2 py-1 ${
                  emp.active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"
                }`}
              >
                {emp.active ? "Active" : "Inactive"}
              </span>
            </div>
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
          return (
            <EmployeeCalendarModal
              employee={emp}
              onClose={() => setExpandedId(null)}
              onEmployeeUpdated={load}
            />
          );
        })()}
    </div>
  );
}

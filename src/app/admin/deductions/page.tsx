"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Breakdown = {
  employeeId: string;
  name: string;
  role: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
  offDay: number;
  minorInfractions: number;
  majorInfractions: number;
  miscDeductions: number;
  cashFromAttendance: number;
  cashFromInfractions: number;
  totalDeduction: number;
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);
}

export default function DeductionsPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<Breakdown[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    const res = await fetch(`/api/deductions?${qs.toString()}`);
    setRows(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grandTotal = rows.reduce((s, r) => s + r.totalDeduction, 0);

  const canExport = Boolean(from && to);
  const exportHref = `/api/export/attendance?from=${from}&to=${to}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Deductions</h1>
        <Link href="/admin/infractions" className="btn-secondary text-sm">
          Apply an Infraction →
        </Link>
      </div>

      <div className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">From</label>
          <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">To</label>
          <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button className="btn-secondary" onClick={load}>
          Apply Filter
        </button>
        <a
          href={canExport ? exportHref : undefined}
          aria-disabled={!canExport}
          title={canExport ? undefined : "Select both a From and To date to export"}
          className={`btn-primary ${!canExport ? "pointer-events-none opacity-50" : ""}`}
        >
          Export to Excel
        </a>
        <div className="ml-auto text-right">
          <p className="text-xs uppercase text-gray-500">Grand Total</p>
          <p className="text-xl font-bold text-brand">{formatCurrency(grandTotal)}</p>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Present</th>
              <th>Late</th>
              <th>Absent</th>
              <th>Excused</th>
              <th>Off Day</th>
              <th>Minor Infr.</th>
              <th>Major Infr.</th>
              <th>Total Deduction</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={10} className="text-center text-gray-400 py-6">
                  Loading...
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.employeeId}>
                <td>{r.name}</td>
                <td>{r.role}</td>
                <td>{r.present}</td>
                <td>{r.late}</td>
                <td>{r.absent}</td>
                <td>{r.excused}</td>
                <td>{r.offDay}</td>
                <td>{r.minorInfractions}</td>
                <td>{r.majorInfractions}</td>
                <td className="font-medium">{formatCurrency(r.totalDeduction)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
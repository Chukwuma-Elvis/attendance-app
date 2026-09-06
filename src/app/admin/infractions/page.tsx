"use client";

import { useEffect, useState } from "react";

type Employee = { id: string; name: string };
type Rule = { id: string; key: string; label: string; amount: number };
type InfractionRow = {
  id: string;
  date: string;
  type: string;
  amount: number;
  description: string | null;
  employee: { name: string };
};
type PendingChange = {
  id: string;
  kind: "ATTENDANCE" | "INFRACTION" | "PENALTY_RULE";
  status: "PENDING" | "APPROVED" | "REJECTED";
  payload: any;
};
type DisplayRow = {
  id: string;
  date: string;
  type: string;
  amount: number;
  description: string | null;
  employeeName: string;
  pending: boolean;
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);
}

export default function InfractionsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [recent, setRecent] = useState<InfractionRow[]>([]);
  const [pendingInfractions, setPendingInfractions] = useState<PendingChange[]>([]);
  const [loading, setLoading] = useState(true);

  const [empId, setEmpId] = useState("");
  const [date, setDate] = useState("");
  const [type, setType] = useState("MINOR");
  const [description, setDescription] = useState("");
  const [customName, setCustomName] = useState("");
  const [customAmount, setCustomAmount] = useState(0);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    const [empRes, ruleRes, infRes, approvalsRes] = await Promise.all([
      fetch("/api/employees"),
      fetch("/api/penalty-rules"),
      fetch("/api/infractions"),
      fetch("/api/approvals"),
    ]);
    const empData = await empRes.json();
    const ruleData: Rule[] = await ruleRes.json();
    const infData = await infRes.json();
    const approvalsData = await approvalsRes.json().catch(() => ({ changes: [] }));

    setEmployees(empData.map((e: any) => ({ id: e.id, name: e.name })));
    setRules(ruleData);
    setRecent(infData);
    setPendingInfractions(
      (approvalsData.changes ?? []).filter((c: PendingChange) => c.kind === "INFRACTION" && c.status === "PENDING")
    );
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  function ruleFor(key: string) {
    return rules.find((r) => r.key === key);
  }
  const minorRule = ruleFor("MINOR_INFRACTION");
  const majorRule = ruleFor("MAJOR_INFRACTION");
  const isCustom = type === "CUSTOM";

  async function applyInfraction(e: React.FormEvent) {
    e.preventDefault();
    if (!empId || !date) return;
    if (isCustom && (!customName.trim() || customAmount <= 0)) return;
    setApplying(true);
    setMessage(null);
    const res = await fetch("/api/infractions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        isCustom
          ? { employeeId: empId, date, type: "MISCELLANEOUS", description: customName, amount: customAmount }
          : { employeeId: empId, date, type, description }
      ),
    });
    const data = await res.json().catch(() => ({}));
    setApplying(false);
    setMessage(data.pending ? "Sent to the owner for approval." : "Infraction applied.");
    setDescription("");
    setCustomName("");
    setCustomAmount(0);
    setType("MINOR");
    loadAll();
    setTimeout(() => setMessage(null), 2500);
  }

  function typeLabel(t: string) {
    if (t === "MINOR") return minorRule?.label ?? "Infraction";
    if (t === "MAJOR") return majorRule?.label ?? "Major Infraction";
    return "Custom";
  }

  function nameFor(employeeId: string) {
    return employees.find((e) => e.id === employeeId)?.name ?? "Unknown";
  }

  const displayRows: DisplayRow[] = [
    ...pendingInfractions.map((c) => ({
      id: c.id,
      date: c.payload.date,
      type: c.payload.type,
      amount: c.payload.amount,
      description: c.payload.description ?? null,
      employeeName: nameFor(c.payload.employeeId),
      pending: true,
    })),
    ...recent.map((r) => ({
      id: r.id,
      date: r.date,
      type: r.type,
      amount: r.amount,
      description: r.description,
      employeeName: r.employee.name,
      pending: false,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Infractions</h1>

      <div className="card">
        <h2 className="font-semibold mb-4">Apply Infraction</h2>
        <form onSubmit={applyInfraction} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Employee</label>
            <select className="input" value={empId} onChange={(e) => setEmpId(e.target.value)}>
              <option value="">Select...</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Work Day</label>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="MINOR">
                {minorRule ? `${minorRule.label} (${formatCurrency(minorRule.amount)})` : "Minor Infraction"}
              </option>
              <option value="MAJOR">
                {majorRule ? `${majorRule.label} (${formatCurrency(majorRule.amount)})` : "Major Infraction"}
              </option>
              <option value="CUSTOM">Custom...</option>
            </select>
          </div>
          {isCustom ? (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Infraction Name</label>
                <input
                  className="input"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Amount to Deduct (₦)</label>
                <input
                  type="number"
                  min={1}
                  className="input w-32"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(Number(e.target.value))}
                  required
                />
              </div>
            </>
          ) : (
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium mb-1">Description (optional)</label>
              <input className="input w-full" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          )}
          <button className="btn-primary" disabled={applying}>
            {applying ? "Applying..." : "Apply"}
          </button>
          {message && <span className="text-sm text-green-600">{message}</span>}
        </form>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="font-semibold mb-4">Recent Infractions</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Date</th>
              <th>Type</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="text-center text-gray-400 py-6">Loading...</td>
              </tr>
            )}
            {displayRows.map((r) => (
              <tr key={r.id}>
                <td>{r.employeeName}</td>
                <td>{new Date(r.date).toLocaleDateString()}</td>
                <td>{typeLabel(r.type)}</td>
                <td>{r.description || "—"}</td>
                <td className="font-medium">{formatCurrency(r.amount)}</td>
                <td>
                  {r.pending ? (
                    <span className="text-xs rounded-full px-2 py-1 bg-yellow-100 text-yellow-700">Pending</span>
                  ) : (
                    <span className="text-xs rounded-full px-2 py-1 bg-green-100 text-green-700">Applied</span>
                  )}
                </td>
              </tr>
            ))}
            {!loading && displayRows.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-gray-400 py-6">No infractions recorded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
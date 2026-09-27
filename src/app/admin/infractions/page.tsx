"use client";

import { useEffect, useState } from "react";

type Employee = { id: string; name: string };
type Rule = { id: string; key: string; label: string; amount: number };

type InfractionRow = {
  id: string;
  employeeId: string;
  date: string;
  type: string;
  amount: number;
  description: string | null;
  employee: { id: string; name: string };
};

type PendingChange = {
  id: string;
  kind: "ATTENDANCE" | "INFRACTION" | "PENALTY_RULE";
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedBy: string;
  summary: string;
  payload: any;
};

type DisplayRow = {
  id: string;
  infractionId?: string;
  pendingChangeId?: string;
  employeeId: string;
  employeeName: string;
  date: string;
  type: string;
  amount: number;
  description: string | null;
  status: "APPLIED" | "PENDING_CREATE" | "PENDING_UPDATE" | "PENDING_DELETE";
  pendingChange?: PendingChange;
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function InfractionsPage() {
  const [role, setRole] = useState<"OWNER" | "ASSISTANT" | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [recent, setRecent] = useState<InfractionRow[]>([]);
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [loading, setLoading] = useState(true);

  // Apply form state
  const [empId, setEmpId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [type, setType] = useState("MINOR");
  const [description, setDescription] = useState("");
  const [customName, setCustomName] = useState("");
  const [customAmount, setCustomAmount] = useState(0);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Edit modal state
  const [editingRow, setEditingRow] = useState<DisplayRow | null>(null);
  const [editEmpId, setEditEmpId] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editType, setEditType] = useState("MINOR");
  const [editDescription, setEditDescription] = useState("");
  const [editCustomName, setEditCustomName] = useState("");
  const [editAmount, setEditAmount] = useState(0);
  const [savingEdit, setSavingEdit] = useState(false);

  // Actions loading state
  const [actingId, setActingId] = useState<string | null>(null);

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
    const approvalsData = await approvalsRes.json().catch(() => ({ role: null, changes: [] }));

    setRole(approvalsData.role ?? null);
    setEmployees(empData.map((e: any) => ({ id: e.id, name: e.name })));
    setRules(ruleData);
    setRecent(infData);
    setPendingChanges(
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
  const isEditCustom = editType === "CUSTOM";

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
    setMessage(
      data.pending
        ? "Submitted! Sent to the manager/owner for approval."
        : "Infraction applied successfully."
    );
    setDescription("");
    setCustomName("");
    setCustomAmount(0);
    setType("MINOR");
    loadAll();
    setTimeout(() => setMessage(null), 3500);
  }

  function openEditModal(row: DisplayRow) {
    setEditingRow(row);
    setEditEmpId(row.employeeId);
    setEditDate(row.date.slice(0, 10));
    if (row.type === "MISCELLANEOUS" || row.type === "CUSTOM") {
      setEditType("CUSTOM");
      setEditCustomName(row.description ?? "");
      setEditAmount(row.amount);
      setEditDescription("");
    } else {
      setEditType(row.type);
      setEditCustomName("");
      setEditDescription(row.description ?? "");
      setEditAmount(row.amount);
    }
  }

  function handleEditTypeChange(newType: string) {
    setEditType(newType);
    if (newType === "MINOR") {
      setEditAmount(minorRule?.amount ?? 10000);
    } else if (newType === "MAJOR") {
      setEditAmount(majorRule?.amount ?? 50000);
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingRow || !editingRow.infractionId) return;
    if (!editEmpId || !editDate) return;
    if (isEditCustom && (!editCustomName.trim() || editAmount <= 0)) return;

    setSavingEdit(true);
    const body = isEditCustom
      ? {
          employeeId: editEmpId,
          date: editDate,
          type: "MISCELLANEOUS",
          description: editCustomName.trim(),
          amount: editAmount,
        }
      : {
          employeeId: editEmpId,
          date: editDate,
          type: editType,
          description: editDescription.trim() || null,
          amount: editAmount,
        };

    const res = await fetch(`/api/infractions/${editingRow.infractionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setSavingEdit(false);
    setEditingRow(null);

    setMessage(
      data.pending
        ? "Edit request submitted! Awaiting manager/owner approval."
        : "Infraction updated successfully."
    );
    loadAll();
    setTimeout(() => setMessage(null), 3500);
  }

  async function deleteInfraction(row: DisplayRow) {
    if (!row.infractionId) return;
    const confirmed = window.confirm(
      `Delete infraction for ${row.employeeName} on ${row.date.slice(0, 10)} (${formatCurrency(row.amount)})?`
    );
    if (!confirmed) return;

    setActingId(row.id);
    const res = await fetch(`/api/infractions/${row.infractionId}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    setActingId(null);

    setMessage(
      data.pending
        ? "Deletion request submitted! Awaiting manager/owner approval."
        : "Infraction deleted."
    );
    loadAll();
    setTimeout(() => setMessage(null), 3500);
  }

  async function cancelPendingChange(changeId: string) {
    const confirmed = window.confirm("Cancel this pending infraction request?");
    if (!confirmed) return;

    setActingId(changeId);
    await fetch(`/api/approvals/${changeId}`, { method: "DELETE" });
    setActingId(null);
    setMessage("Pending request cancelled.");
    loadAll();
    setTimeout(() => setMessage(null), 2500);
  }

  async function actOnPending(changeId: string, action: "approve" | "reject") {
    setActingId(changeId);
    await fetch(`/api/approvals/${changeId}/${action}`, { method: "POST" });
    setActingId(null);
    setMessage(`Request ${action}d successfully.`);
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

  // Correlate pending changes with applied infractions
  const pendingUpdates = new Map<string, PendingChange>();
  const pendingDeletes = new Map<string, PendingChange>();
  const pendingCreates: PendingChange[] = [];

  for (const c of pendingChanges) {
    const act = c.payload?.action;
    const targetId = c.payload?.infractionId;
    if (act === "UPDATE" && targetId) {
      pendingUpdates.set(targetId, c);
    } else if (act === "DELETE" && targetId) {
      pendingDeletes.set(targetId, c);
    } else {
      pendingCreates.push(c);
    }
  }

  const displayRows: DisplayRow[] = [
    // Pending creations
    ...pendingCreates.map((c) => ({
      id: `pending-${c.id}`,
      pendingChangeId: c.id,
      employeeId: c.payload.employeeId,
      date: c.payload.date,
      type: c.payload.type,
      amount: c.payload.amount,
      description: c.payload.description ?? null,
      employeeName: nameFor(c.payload.employeeId),
      status: "PENDING_CREATE" as const,
      pendingChange: c,
    })),
    // Applied infractions (with any pending update or delete annotations)
    ...recent.map((r) => {
      const pDelete = pendingDeletes.get(r.id);
      const pUpdate = pendingUpdates.get(r.id);

      if (pDelete) {
        return {
          id: r.id,
          infractionId: r.id,
          pendingChangeId: pDelete.id,
          employeeId: r.employeeId,
          employeeName: r.employee.name,
          date: r.date,
          type: r.type,
          amount: r.amount,
          description: r.description,
          status: "PENDING_DELETE" as const,
          pendingChange: pDelete,
        };
      }

      if (pUpdate) {
        return {
          id: r.id,
          infractionId: r.id,
          pendingChangeId: pUpdate.id,
          employeeId: pUpdate.payload.employeeId || r.employeeId,
          employeeName: nameFor(pUpdate.payload.employeeId || r.employeeId),
          date: pUpdate.payload.date || r.date,
          type: pUpdate.payload.type || r.type,
          amount: pUpdate.payload.amount ?? r.amount,
          description: pUpdate.payload.description ?? r.description,
          status: "PENDING_UPDATE" as const,
          pendingChange: pUpdate,
        };
      }

      return {
        id: r.id,
        infractionId: r.id,
        employeeId: r.employeeId,
        employeeName: r.employee.name,
        date: r.date,
        type: r.type,
        amount: r.amount,
        description: r.description,
        status: "APPLIED" as const,
      };
    }),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Infractions</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {role === "ASSISTANT"
              ? "Applying, editing, or deleting an infraction will be queued for manager/owner approval."
              : "Apply, edit, or remove infractions. As manager/owner, changes apply immediately."}
          </p>
        </div>
      </div>

      {message && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-800 rounded-xl text-sm font-medium animate-in fade-in duration-150">
          {message}
        </div>
      )}

      {/* Apply Infraction Card */}
      <div className="card">
        <h2 className="font-semibold mb-4">Apply Infraction</h2>
        <form onSubmit={applyInfraction} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Employee</label>
            <select className="input" value={empId} onChange={(e) => setEmpId(e.target.value)} required>
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
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} required />
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
                  placeholder="e.g. Broken glass"
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
              <input
                className="input w-full"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Reason or notes..."
              />
            </div>
          )}
          <button className="btn-primary" disabled={applying}>
            {applying ? "Submitting..." : role === "ASSISTANT" ? "Submit for Approval" : "Apply Infraction"}
          </button>
        </form>
      </div>

      {/* Infractions Table Card */}
      <div className="card overflow-x-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Recent Infractions</h2>
          <span className="text-xs text-gray-500">{displayRows.length} record(s)</span>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Date</th>
              <th>Type</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="text-center text-gray-400 py-6">Loading...</td>
              </tr>
            )}
            {displayRows.map((r) => (
              <tr key={r.id}>
                <td className="font-medium">{r.employeeName}</td>
                <td>{new Date(`${r.date.slice(0, 10)}T00:00:00Z`).toLocaleDateString(undefined, { timeZone: "UTC" })}</td>
                <td>{typeLabel(r.type)}</td>
                <td>{r.description || "—"}</td>
                <td className="font-semibold text-brand">{formatCurrency(r.amount)}</td>
                <td>
                  {r.status === "PENDING_CREATE" && (
                    <span className="text-xs rounded-full px-2.5 py-1 bg-yellow-100 text-yellow-800 font-medium">
                      Pending Approval
                    </span>
                  )}
                  {r.status === "PENDING_UPDATE" && (
                    <span className="text-xs rounded-full px-2.5 py-1 bg-amber-100 text-amber-800 font-medium" title="Edit request waiting for owner approval">
                      Pending Edit
                    </span>
                  )}
                  {r.status === "PENDING_DELETE" && (
                    <span className="text-xs rounded-full px-2.5 py-1 bg-red-100 text-red-800 font-medium" title="Delete request waiting for owner approval">
                      Pending Delete
                    </span>
                  )}
                  {r.status === "APPLIED" && (
                    <span className="text-xs rounded-full px-2.5 py-1 bg-green-100 text-green-700 font-medium">
                      Applied
                    </span>
                  )}
                </td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-1.5 flex-wrap">
                    {/* Normal applied infraction actions */}
                    {r.status === "APPLIED" && (
                      <>
                        <button
                          type="button"
                          onClick={() => openEditModal(r)}
                          className="btn-secondary !py-1 !px-2.5 text-xs"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={actingId === r.id}
                          onClick={() => deleteInfraction(r)}
                          className="text-xs rounded-lg px-2.5 py-1 font-medium bg-red-50 text-red-600 hover:bg-red-100 transition"
                        >
                          {actingId === r.id ? "Processing..." : "Delete"}
                        </button>
                      </>
                    )}

                    {/* Pending updates or deletes: Owner can approve/reject, assistant/owner can cancel */}
                    {(r.status === "PENDING_UPDATE" || r.status === "PENDING_DELETE" || r.status === "PENDING_CREATE") && (
                      <>
                        {role === "OWNER" && r.pendingChangeId && (
                          <>
                            <button
                              type="button"
                              disabled={actingId === r.pendingChangeId}
                              onClick={() => actOnPending(r.pendingChangeId!, "approve")}
                              className="btn-primary !py-1 !px-2.5 text-xs bg-green-600 hover:bg-green-700"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={actingId === r.pendingChangeId}
                              onClick={() => actOnPending(r.pendingChangeId!, "reject")}
                              className="btn-secondary !py-1 !px-2.5 text-xs"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {r.pendingChangeId && (
                          <button
                            type="button"
                            disabled={actingId === r.pendingChangeId}
                            onClick={() => cancelPendingChange(r.pendingChangeId!)}
                            className="text-xs rounded-lg px-2 py-1 font-medium text-gray-500 hover:bg-gray-100"
                            title="Cancel pending request"
                          >
                            Cancel Request
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && displayRows.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-gray-400 py-6">No infractions recorded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Infraction Modal */}
      {editingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEditingRow(null)} />
          <form
            onSubmit={saveEdit}
            className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Edit Infraction</h3>
              <button
                type="button"
                onClick={() => setEditingRow(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none px-1"
              >
                &times;
              </button>
            </div>

            <div className="p-4 space-y-4">
              {role === "ASSISTANT" && (
                <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                  Note: As an assistant, this edit will be submitted to the manager/owner for approval before taking effect.
                </p>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Employee</label>
                <select
                  className="input w-full"
                  value={editEmpId}
                  onChange={(e) => setEditEmpId(e.target.value)}
                  required
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Work Day</label>
                <input
                  type="date"
                  className="input w-full"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                <select
                  className="input w-full"
                  value={editType}
                  onChange={(e) => handleEditTypeChange(e.target.value)}
                >
                  <option value="MINOR">
                    {minorRule ? `${minorRule.label} (${formatCurrency(minorRule.amount)})` : "Minor Infraction"}
                  </option>
                  <option value="MAJOR">
                    {majorRule ? `${majorRule.label} (${formatCurrency(majorRule.amount)})` : "Major Infraction"}
                  </option>
                  <option value="CUSTOM">Custom...</option>
                </select>
              </div>

              {isEditCustom ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Infraction Name</label>
                    <input
                      className="input w-full"
                      value={editCustomName}
                      onChange={(e) => setEditCustomName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Amount to Deduct (₦)</label>
                    <input
                      type="number"
                      min={1}
                      className="input w-full"
                      value={editAmount}
                      onChange={(e) => setEditAmount(Number(e.target.value))}
                      required
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Description (optional)</label>
                    <input
                      className="input w-full"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Reason or notes..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Amount (₦)</label>
                    <input
                      type="number"
                      min={0}
                      className="input w-full"
                      value={editAmount}
                      onChange={(e) => setEditAmount(Number(e.target.value))}
                      required
                    />
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingRow(null)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="btn-primary text-xs"
                >
                  {savingEdit
                    ? "Saving..."
                    : role === "ASSISTANT"
                    ? "Submit for Approval"
                    : "Save Changes"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
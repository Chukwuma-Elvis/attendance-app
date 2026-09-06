"use client";

import { useEffect, useState } from "react";

type Change = {
  id: string;
  kind: "ATTENDANCE" | "INFRACTION" | "PENALTY_RULE";
  summary: string;
  requestedBy: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
};

function StatusBadge({ status }: { status: Change["status"] }) {
  const styles =
    status === "PENDING"
      ? "bg-yellow-100 text-yellow-700"
      : status === "APPROVED"
      ? "bg-green-100 text-green-700"
      : "bg-red-100 text-red-700";
  return <span className={`text-xs rounded-full px-2 py-1 ${styles}`}>{status}</span>;
}

export default function ApprovalsPage() {
  const [role, setRole] = useState<"OWNER" | "ASSISTANT" | null>(null);
  const [changes, setChanges] = useState<Change[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/approvals");
    const data = await res.json();
    setRole(data.role);
    setChanges(data.changes);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function act(id: string, action: "approve" | "reject") {
    setActingId(id);
    await fetch(`/api/approvals/${id}/${action}`, { method: "POST" });
    setActingId(null);
    load();
  }

  const pending = changes.filter((c) => c.status === "PENDING");
  const resolved = changes.filter((c) => c.status !== "PENDING");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Approvals</h1>
        <p className="text-sm text-gray-500 mt-1">
          {role === "OWNER"
            ? "Changes submitted by the assistant account that lead to a cash deduction wait here until you approve or reject them."
            : "Your submitted changes that lead to a cash deduction wait here until the owner approves or rejects them."}
        </p>
      </div>

      {loading && <div className="card text-center text-gray-400 py-6">Loading...</div>}

      <div className="card overflow-x-auto">
        <h2 className="font-semibold mb-4">Pending ({pending.length})</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Summary</th>
              <th>Requested By</th>
              <th>Submitted</th>
              {role === "OWNER" && <th></th>}
            </tr>
          </thead>
          <tbody>
            {!loading && pending.length === 0 && (
              <tr>
                <td colSpan={role === "OWNER" ? 4 : 3} className="text-center text-gray-400 py-6">
                  Nothing pending.
                </td>
              </tr>
            )}
            {pending.map((c) => (
              <tr key={c.id}>
                <td>{c.summary}</td>
                <td>{c.requestedBy}</td>
                <td>{new Date(c.createdAt).toLocaleString()}</td>
                {role === "OWNER" && (
                  <td>
                    <div className="flex gap-2">
                      <button
                        className="btn-primary text-xs"
                        disabled={actingId === c.id}
                        onClick={() => act(c.id, "approve")}
                      >
                        Approve
                      </button>
                      <button
                        className="btn-secondary text-xs"
                        disabled={actingId === c.id}
                        onClick={() => act(c.id, "reject")}
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="font-semibold mb-4">History</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Summary</th>
              <th>Requested By</th>
              <th>Status</th>
              <th>Resolved By</th>
            </tr>
          </thead>
          <tbody>
            {!loading && resolved.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-gray-400 py-6">
                  No resolved requests yet.
                </td>
              </tr>
            )}
            {resolved.map((c) => (
              <tr key={c.id}>
                <td>{c.summary}</td>
                <td>{c.requestedBy}</td>
                <td>
                  <StatusBadge status={c.status} />
                </td>
                <td>{c.resolvedBy ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

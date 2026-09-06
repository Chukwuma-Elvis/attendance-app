"use client";

import { useEffect, useState } from "react";

type Rule = { id: string; key: string; label: string; amount: number };

export default function SettingsPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/penalty-rules");
    setRules(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function updateLocal(key: string, amount: number) {
    setRules((prev) => prev.map((r) => (r.key === key ? { ...r, amount } : r)));
  }

  async function save(rule: Rule) {
    setSavingKey(rule.key);
    setMessage(null);
    const res = await fetch("/api/penalty-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: rule.key, amount: rule.amount }),
    });
    const data = await res.json().catch(() => ({}));
    setSavingKey(null);
    setMessage(data.pending ? "Sent to the owner for approval." : "Saved.");
    setTimeout(() => setMessage(null), 2500);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Penalty Settings</h1>
      <p className="text-sm text-gray-500">
        These amounts are applied automatically wherever lateness, absence, or an infraction is recorded.
      </p>
      {message && <p className="text-sm text-green-600">{message}</p>}

      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Deduction Type</th>
              <th>Cash Penalty (₦)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={3} className="text-center text-gray-400 py-6">
                  Loading...
                </td>
              </tr>
            )}
            {rules.map((r) => (
              <tr key={r.key}>
                <td>{r.label}</td>
                <td>
                  <input
                    type="number"
                    className="input w-32"
                    value={r.amount}
                    onChange={(e) => updateLocal(r.key, Number(e.target.value))}
                  />
                </td>
                <td>
                  <button className="btn-secondary text-xs" onClick={() => save(r)} disabled={savingKey === r.key}>
                    {savingKey === r.key ? "Saving..." : "Save"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

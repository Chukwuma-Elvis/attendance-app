import { computeDeductions } from "@/lib/deductions";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);
}

export default async function DashboardPage() {
  const [employeeCount, breakdown] = await Promise.all([
    prisma.employee.count({ where: { active: true } }),
    computeDeductions(),
  ]);

  const totalAbsences = breakdown.reduce((s, b) => s + b.absent, 0);
  const totalLate = breakdown.reduce((s, b) => s + b.late, 0);
  const totalInfractions = breakdown.reduce((s, b) => s + b.minorInfractions + b.majorInfractions, 0);
  const totalDeductions = breakdown.reduce((s, b) => s + b.totalDeduction, 0);

  const topDeductions = [...breakdown].sort((a, b) => b.totalDeduction - a.totalDeduction).slice(0, 5);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Active Employees" value={employeeCount.toString()} />
        <StatCard label="Total Absences" value={totalAbsences.toString()} />
        <StatCard label="Total Lateness" value={totalLate.toString()} />
        <StatCard label="Total Infractions" value={totalInfractions.toString()} />
        <StatCard label="Total Deductions" value={formatCurrency(totalDeductions)} highlight />
      </div>

      <div className="card">
        <h2 className="font-semibold mb-4">Top 5 by Deduction Amount</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Absences</th>
              <th>Lateness</th>
              <th>Infractions</th>
              <th>Total Deduction</th>
            </tr>
          </thead>
          <tbody>
            {topDeductions.map((b) => (
              <tr key={b.employeeId}>
                <td>{b.name}</td>
                <td>{b.role}</td>
                <td>{b.absent}</td>
                <td>{b.late}</td>
                <td>{b.minorInfractions + b.majorInfractions}</td>
                <td className="font-medium">{formatCurrency(b.totalDeduction)}</td>
              </tr>
            ))}
            {topDeductions.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-gray-400 py-6">
                  No attendance recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`card ${highlight ? "border-brand" : ""}`}>
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${highlight ? "text-brand" : ""}`}>{value}</p>
    </div>
  );
}

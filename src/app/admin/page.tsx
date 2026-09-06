import { computeDeductions } from "@/lib/deductions";
import { prisma } from "@/lib/db";
import WeeklyAttendanceTable, { type WeekRow } from "./WeeklyAttendanceTable";

export const dynamic = "force-dynamic";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);
}

function toISODateUTC(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function DashboardPage() {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekStart = new Date(todayUTC);
  weekStart.setUTCDate(todayUTC.getUTCDate() - todayUTC.getUTCDay());
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setUTCDate(weekStart.getUTCDate() + i);
    return d;
  });
  const weekEnd = weekDates[6];

  const [employeeCount, monthBreakdown, weekEmployees] = await Promise.all([
    prisma.employee.count({ where: { active: true } }),
    computeDeductions({ from: monthStart, to: monthEnd }),
    prisma.employee.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: { attendance: { where: { date: { gte: weekStart, lte: weekEnd } } } },
    }),
  ]);

  const totalAbsences = monthBreakdown.reduce((s, b) => s + b.absent, 0);
  const totalLate = monthBreakdown.reduce((s, b) => s + b.late, 0);
  const totalInfractions = monthBreakdown.reduce((s, b) => s + b.minorInfractions + b.majorInfractions, 0);
  const totalDeductions = monthBreakdown.reduce((s, b) => s + b.totalDeduction, 0);

  const topDeductions = [...monthBreakdown]
    .filter((b) => b.totalDeduction > 0)
    .sort((a, b) => b.totalDeduction - a.totalDeduction)
    .slice(0, 5);

  const weekDayLabels = weekDates.map((d) => ({
    key: toISODateUTC(d),
    label: d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
    dateLabel: `${d.getUTCMonth() + 1}/${d.getUTCDate()}`,
  }));

  const weekRows: WeekRow[] = weekEmployees.map((e) => {
    const byDate = new Map(e.attendance.map((a) => [toISODateUTC(a.date), a.status as string]));
    return {
      employeeId: e.id,
      name: e.name,
      role: e.role,
      days: weekDates.map((d) => {
        const dow = d.getUTCDay();
        const key = toISODateUTC(d);
        const status = byDate.get(key);
        // An actual recorded status (e.g. someone added despite not normally
        // being on duty) always wins over the schedule-based "Off" default.
        if (status && status !== "OFF_DAY") return { key, status: status as WeekRow["days"][number]["status"] };
        if (!e.workingDays.includes(dow)) return { key, status: "OFF" as const };
        return { key, status: null };
      }),
    };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Active Employees" value={employeeCount.toString()} />
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">This Month</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xl font-bold">{totalAbsences}</p>
              <p className="text-xs text-gray-500">Absences</p>
            </div>
            <div>
              <p className="text-xl font-bold">{totalLate}</p>
              <p className="text-xs text-gray-500">Lateness</p>
            </div>
            <div>
              <p className="text-xl font-bold">{totalInfractions}</p>
              <p className="text-xs text-gray-500">Infractions</p>
            </div>
          </div>
        </div>
        <StatCard label="Total Deductions (This Month)" value={formatCurrency(totalDeductions)} highlight />
      </div>

      <div className="card">
        <h2 className="font-semibold mb-4">Top 5 by Deduction Amount (This Month)</h2>
        {topDeductions.length === 0 ? (
          <p className="text-sm text-gray-400">No deductions this month.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {topDeductions.map((b) => (
              <div
                key={b.employeeId}
                className="flex items-center gap-2 rounded-full bg-red-50 border border-red-100 px-4 py-2"
              >
                <span className="text-sm font-medium text-gray-800">{b.name}</span>
                <span className="text-sm font-semibold text-red-600">{formatCurrency(b.totalDeduction)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <WeeklyAttendanceTable rows={weekRows} weekDayLabels={weekDayLabels} />
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

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/day-summary?date=2026-09-06
// Returns everyone on duty that date with their attendance status (reusing
// the same on-duty logic as /api/attendance), plus an itemized list of every
// cash deduction that occurred on that exact date (late/absent pay docks and
// infractions), for a single-day review page.
export async function GET(req: NextRequest) {
  const dateParam = req.nextUrl.searchParams.get("date");
  if (!dateParam) {
    return NextResponse.json({ error: "date query param is required (YYYY-MM-DD)." }, { status: 400 });
  }
  const date = new Date(dateParam);
  const dayOfWeek = date.getUTCDay();

  const [employees, rules, dayInfractions] = await Promise.all([
    prisma.employee.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: { attendance: { where: { date } } },
    }),
    prisma.penaltyRule.findMany(),
    prisma.infraction.findMany({ where: { date }, include: { employee: true } }),
  ]);

  const ruleByKey = Object.fromEntries(rules.map((r) => [r.key, r]));

  const onDuty = employees.filter((e) => e.workingDays.includes(dayOfWeek) || e.attendance.length > 0);

  const rows = onDuty.map((e) => ({
    employeeId: e.id,
    name: e.name,
    role: e.role,
    status: e.attendance[0]?.status ?? null,
  }));

  const attendanceDeductions = onDuty
    .filter((e) => e.attendance[0]?.status === "LATE" || e.attendance[0]?.status === "ABSENT")
    .map((e) => {
      const status = e.attendance[0].status as "LATE" | "ABSENT";
      const rule = status === "LATE" ? ruleByKey.LATE : ruleByKey.ABSENT;
      return {
        employeeId: e.id,
        name: e.name,
        role: e.role,
        label: rule?.label ?? (status === "LATE" ? "Late" : "Absent"),
        amount: rule?.amount ?? 0,
      };
    });

  const infractionDeductions = dayInfractions.map((i) => {
    const rule = i.type === "MINOR" ? ruleByKey.MINOR_INFRACTION : i.type === "MAJOR" ? ruleByKey.MAJOR_INFRACTION : null;
    const label = rule?.label ?? (i.type === "MINOR" ? "Minor Infraction" : i.type === "MAJOR" ? "Major Infraction" : i.description || "Custom Infraction");
    return {
      employeeId: i.employeeId,
      name: i.employee.name,
      role: i.employee.role,
      label,
      amount: i.amount,
    };
  });

  const deductions = [...attendanceDeductions, ...infractionDeductions];
  const total = deductions.reduce((sum, d) => sum + d.amount, 0);

  return NextResponse.json({ rows, deductions, total });
}

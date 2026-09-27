import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

// GET /api/month-summary?month=YYYY-MM
// Returns a comprehensive monthly summary for the caller's department:
// - Overall team KPI stats (Present rate, Lateness, Absences, Infractions, Total Deductions)
// - Per-employee breakdown for the month
// - Itemized list of all deductions and infractions that occurred in the month
// - Daily trends across the days of the month
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const monthParam = req.nextUrl.searchParams.get("month");
  const monthMatch = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : null;
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const targetMonth = monthMatch || defaultMonth;

  const [yearStr, mStr] = targetMonth.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(mStr, 10);

  const from = new Date(Date.UTC(year, month - 1, 1));
  const totalDaysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const to = new Date(Date.UTC(year, month - 1, totalDaysInMonth));

  const [employees, rules, monthInfractions] = await Promise.all([
    prisma.employee.findMany({
      where: { active: true, departmentId: session.departmentId },
      orderBy: { name: "asc" },
      include: {
        attendance: {
          where: { date: { gte: from, lte: to } },
          orderBy: { date: "asc" },
        },
        infractions: {
          where: { date: { gte: from, lte: to } },
          orderBy: { date: "asc" },
        },
      },
    }),
    prisma.penaltyRule.findMany({
      where: { departmentId: session.departmentId },
    }),
    prisma.infraction.findMany({
      where: {
        date: { gte: from, lte: to },
        employee: { departmentId: session.departmentId },
      },
      include: { employee: true },
      orderBy: { date: "desc" },
    }),
  ]);

  const ruleMap = Object.fromEntries(rules.map((r) => [r.key, r]));
  const latePenalty = ruleMap.LATE?.amount ?? 10000;
  const absentPenalty = ruleMap.ABSENT?.amount ?? 50000;

  // Build per-employee summaries
  let totalPresent = 0;
  let totalLate = 0;
  let totalAbsent = 0;
  let totalExcused = 0;
  let totalOffDay = 0;

  const employeeSummaries = employees.map((emp) => {
    const present = emp.attendance.filter((a) => a.status === "PRESENT").length;
    const late = emp.attendance.filter((a) => a.status === "LATE").length;
    const absent = emp.attendance.filter((a) => a.status === "ABSENT").length;
    const excused = emp.attendance.filter((a) => a.status === "EXCUSED").length;
    const offDay = emp.attendance.filter((a) => a.status === "OFF_DAY").length;

    totalPresent += present;
    totalLate += late;
    totalAbsent += absent;
    totalExcused += excused;
    totalOffDay += offDay;

    const infractionsCount = emp.infractions.length;
    const infractionsTotal = emp.infractions.reduce((sum, i) => sum + i.amount, 0);

    const cashFromAttendance = late * latePenalty + absent * absentPenalty;
    const totalDeductions = cashFromAttendance + infractionsTotal;

    const totalDutyMarked = present + late + absent;
    const attendanceRate = totalDutyMarked > 0 ? Math.round((present / totalDutyMarked) * 100) : null;

    return {
      employeeId: emp.id,
      name: emp.name,
      role: emp.role,
      workingDays: emp.workingDays,
      present,
      late,
      absent,
      excused,
      offDay,
      infractionsCount,
      infractionsTotal,
      cashFromAttendance,
      totalDeductions,
      attendanceRate,
    };
  });

  const cashFromLateness = totalLate * latePenalty;
  const cashFromAbsence = totalAbsent * absentPenalty;
  const cashFromInfractions = monthInfractions.reduce((sum, i) => sum + i.amount, 0);
  const grandTotalDeductions = cashFromLateness + cashFromAbsence + cashFromInfractions;

  const totalMarkedDuty = totalPresent + totalLate + totalAbsent;
  const overallAttendanceRate =
    totalMarkedDuty > 0 ? Math.round((totalPresent / totalMarkedDuty) * 100) : null;

  // Itemized deductions list across the whole month
  const attendanceDeductionEvents: Array<{
    id: string;
    date: string;
    employeeId: string;
    employeeName: string;
    role: string;
    category: "LATE" | "ABSENT";
    label: string;
    description: string | null;
    amount: number;
  }> = [];

  for (const emp of employees) {
    for (const att of emp.attendance) {
      if (att.status === "LATE" || att.status === "ABSENT") {
        const isLate = att.status === "LATE";
        attendanceDeductionEvents.push({
          id: `att-${att.id}`,
          date: toISODate(att.date),
          employeeId: emp.id,
          employeeName: emp.name,
          role: emp.role,
          category: isLate ? "LATE" : "ABSENT",
          label: isLate ? ruleMap.LATE?.label ?? "Late" : ruleMap.ABSENT?.label ?? "Absent",
          description: att.note,
          amount: isLate ? latePenalty : absentPenalty,
        });
      }
    }
  }

  const infractionDeductionEvents = monthInfractions.map((i) => {
    const rule =
      i.type === "MINOR"
        ? ruleMap.MINOR_INFRACTION
        : i.type === "MAJOR"
        ? ruleMap.MAJOR_INFRACTION
        : null;
    const label =
      rule?.label ??
      (i.type === "MINOR"
        ? "Minor Infraction"
        : i.type === "MAJOR"
        ? "Major Infraction"
        : i.description || "Custom Infraction");

    return {
      id: `inf-${i.id}`,
      date: toISODate(i.date),
      employeeId: i.employeeId,
      employeeName: i.employee.name,
      role: i.employee.role,
      category: "INFRACTION" as const,
      label,
      description: i.description,
      amount: i.amount,
    };
  });

  const allItemizedDeductions = [...attendanceDeductionEvents, ...infractionDeductionEvents].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Daily statistics trend across days 1..totalDaysInMonth
  const dailyBreakdown = Array.from({ length: totalDaysInMonth }, (_, index) => {
    const dayNum = index + 1;
    const dateStr = `${yearStr}-${mStr}-${String(dayNum).padStart(2, "0")}`;
    const d = new Date(Date.UTC(year, month - 1, dayNum));
    const dayOfWeek = d.getUTCDay();

    let present = 0;
    let late = 0;
    let absent = 0;
    let excused = 0;

    for (const emp of employees) {
      for (const a of emp.attendance) {
        if (toISODate(a.date) === dateStr) {
          if (a.status === "PRESENT") present++;
          else if (a.status === "LATE") late++;
          else if (a.status === "ABSENT") absent++;
          else if (a.status === "EXCUSED") excused++;
        }
      }
    }

    const dayDeductions = allItemizedDeductions
      .filter((ev) => ev.date === dateStr)
      .reduce((sum, ev) => sum + ev.amount, 0);

    return {
      date: dateStr,
      dayNum,
      dayOfWeek,
      present,
      late,
      absent,
      excused,
      totalMarked: present + late + absent + excused,
      deductions: dayDeductions,
    };
  });

  return NextResponse.json({
    month: targetMonth,
    departmentName: session.departmentName,
    overview: {
      totalEmployees: employees.length,
      totalPresent,
      totalLate,
      totalAbsent,
      totalExcused,
      totalOffDay,
      totalInfractions: monthInfractions.length,
      cashFromLateness,
      cashFromAbsence,
      cashFromInfractions,
      totalDeductions: grandTotalDeductions,
      attendanceRate: overallAttendanceRate,
    },
    employees: employeeSummaries,
    itemizedDeductions: allItemizedDeductions,
    dailyBreakdown,
  });
}

import { prisma } from "@/lib/db";

export type EmployeeDeductionBreakdown = {
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
  cashFromAttendance: number; // late + absent penalties
  cashFromInfractions: number; // infraction penalties
  totalDeduction: number;
};

/**
 * Computes a per-employee deduction breakdown for an optional date range.
 * Pass no dates to compute across all recorded attendance.
 */
export async function computeDeductions(opts?: { from?: Date; to?: Date }): Promise<EmployeeDeductionBreakdown[]> {
  const rules = await prisma.penaltyRule.findMany();
  const ruleMap = Object.fromEntries(rules.map((r) => [r.key, r.amount]));

  const employees = await prisma.employee.findMany({
    orderBy: { name: "asc" },
    include: {
      attendance: opts?.from || opts?.to
        ? { where: dateFilter(opts) }
        : true,
      infractions: opts?.from || opts?.to
        ? { where: dateFilter(opts) }
        : true,
    },
  });

  return employees.map((emp) => {
    const present = emp.attendance.filter((a) => a.status === "PRESENT").length;
    const late = emp.attendance.filter((a) => a.status === "LATE").length;
    const absent = emp.attendance.filter((a) => a.status === "ABSENT").length;
    const excused = emp.attendance.filter((a) => a.status === "EXCUSED").length;
    const offDay = emp.attendance.filter((a) => a.status === "OFF_DAY").length;

    const minorInfractions = emp.infractions.filter((i) => i.type === "MINOR").length;
    const majorInfractions = emp.infractions.filter((i) => i.type === "MAJOR").length;
    const miscDeductions = emp.infractions.filter((i) => i.type === "MISCELLANEOUS").length;

    const cashFromAttendance = late * (ruleMap.LATE ?? 0) + absent * (ruleMap.ABSENT ?? 0);
    const cashFromInfractions = emp.infractions.reduce((sum, i) => sum + i.amount, 0);

    return {
      employeeId: emp.id,
      name: emp.name,
      role: emp.role,
      present,
      late,
      absent,
      excused,
      offDay,
      minorInfractions,
      majorInfractions,
      miscDeductions,
      cashFromAttendance,
      cashFromInfractions,
      totalDeduction: cashFromAttendance + cashFromInfractions,
    };
  });
}

function dateFilter(opts: { from?: Date; to?: Date }) {
  const filter: Record<string, unknown> = {};
  if (opts.from || opts.to) {
    filter.date = {
      ...(opts.from ? { gte: opts.from } : {}),
      ...(opts.to ? { lte: opts.to } : {}),
    };
  }
  return filter;
}

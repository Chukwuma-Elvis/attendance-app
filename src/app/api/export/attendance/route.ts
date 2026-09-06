import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computeDeductions } from "@/lib/deductions";
import ExcelJS from "exceljs";

export const runtime = "nodejs";

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

// GET /api/export/attendance?from=2026-08-25&to=2026-09-30
// Streams back an .xlsx file with an Attendance grid sheet and a Deductions sheet.
export async function GET(req: NextRequest) {
  const fromParam = req.nextUrl.searchParams.get("from");
  const toParam = req.nextUrl.searchParams.get("to");

  if (!fromParam || !toParam) {
    return NextResponse.json({ error: "from and to query params are required (YYYY-MM-DD)." }, { status: 400 });
  }

  const from = new Date(fromParam);
  const to = new Date(toParam);

  const dates: Date[] = [];
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    dates.push(new Date(d));
  }

  const employees = await prisma.employee.findMany({
    orderBy: { name: "asc" },
    include: { attendance: { where: { date: { gte: from, lte: to } } } },
  });

  const workbook = new ExcelJS.Workbook();

  // --- Sheet 1: Attendance grid ---
  const attSheet = workbook.addWorksheet("Attendance");
  attSheet.addRow(["Name", "Role", ...dates.map(toISODate)]);
  attSheet.getRow(1).font = { bold: true };
  attSheet.getColumn(1).width = 28;
  attSheet.columns.forEach((col, i) => {
    if (i > 0) col.width = 12;
  });

  for (const emp of employees) {
    const statusByDate = new Map(emp.attendance.map((a) => [toISODate(a.date), a.status]));
    attSheet.addRow([emp.name, emp.role, ...dates.map((d) => statusByDate.get(toISODate(d)) ?? "")]);
  }

  // --- Sheet 2: Deductions breakdown ---
  const breakdown = await computeDeductions({ from, to });
  const dedSheet = workbook.addWorksheet("Deductions");
  dedSheet.addRow([
    "Name", "Role", "Present", "Late", "Absent", "Excused", "Off Day",
    "Minor Infractions", "Major Infractions", "Cash from Attendance",
    "Cash from Infractions", "Total Deduction",
  ]);
  dedSheet.getRow(1).font = { bold: true };
  dedSheet.getColumn(1).width = 28;
  dedSheet.columns.forEach((col, i) => {
    if (i > 0) col.width = 16;
  });
  // Columns 10-12 are Naira amounts (Cash from Attendance, Cash from Infractions, Total Deduction).
  [10, 11, 12].forEach((colIndex) => {
    dedSheet.getColumn(colIndex).numFmt = '"₦"#,##0';
  });

  for (const b of breakdown) {
    dedSheet.addRow([
      b.name, b.role, b.present, b.late, b.absent, b.excused, b.offDay,
      b.minorInfractions, b.majorInfractions, b.cashFromAttendance,
      b.cashFromInfractions, b.totalDeduction,
    ]);
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="attendance_${fromParam}_to_${toParam}.xlsx"`,
    },
  });
}
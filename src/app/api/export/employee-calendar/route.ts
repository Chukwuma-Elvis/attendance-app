import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import {
  generateEmployeeCalendarExcel,
  generateEmployeeCalendarPdf,
} from "@/lib/export-employee-calendar";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const employeeId = req.nextUrl.searchParams.get("employeeId");
  const monthParam = req.nextUrl.searchParams.get("month");
  const format =
    req.nextUrl.searchParams.get("format")?.toLowerCase() === "pdf" ? "pdf" : "excel";

  if (!employeeId || !monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
    return NextResponse.json(
      { error: "employeeId and month (YYYY-MM) query parameters are required." },
      { status: 400 }
    );
  }

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, departmentId: session.departmentId },
  });

  if (!employee) {
    return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  }

  const department = await prisma.department.findUnique({
    where: { id: session.departmentId },
  });
  const departmentName = department?.name ?? session.departmentName ?? "Operations";

  const [yearStr, mStr] = monthParam.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(mStr, 10);

  const from = new Date(Date.UTC(year, month - 1, 1));
  const totalDaysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const to = new Date(Date.UTC(year, month - 1, totalDaysInMonth));

  const [attendance, infractions, penaltyRules] = await Promise.all([
    prisma.attendance.findMany({
      where: {
        employeeId,
        date: { gte: from, lte: to },
      },
      orderBy: { date: "asc" },
    }),
    prisma.infraction.findMany({
      where: {
        employeeId,
        date: { gte: from, lte: to },
      },
      orderBy: { date: "asc" },
    }),
    prisma.penaltyRule.findMany({
      where: { departmentId: session.departmentId },
    }),
  ]);

  const sanitizedEmployeeName = employee.name.replace(/[^a-zA-Z0-9_-]/g, "_");
  const baseFilename = `${sanitizedEmployeeName}_${monthParam}_calendar`;

  const exportPayload = {
    employee: {
      id: employee.id,
      name: employee.name,
      role: employee.role,
      workingDays: employee.workingDays,
    },
    departmentName,
    year,
    month,
    attendance: attendance.map((a) => ({
      id: a.id,
      date: a.date.toISOString().slice(0, 10),
      status: a.status,
      note: a.note,
    })),
    infractions: infractions.map((i) => ({
      id: i.id,
      date: i.date.toISOString().slice(0, 10),
      type: i.type,
      description: i.description,
      amount: i.amount,
    })),
    penaltyRules: penaltyRules.map((r) => ({
      key: r.key,
      label: r.label,
      amount: r.amount,
    })),
  };

  if (format === "pdf") {
    const pdfBuffer = await generateEmployeeCalendarPdf(exportPayload);
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${baseFilename}.pdf"`,
      },
    });
  } else {
    const excelBuffer = await generateEmployeeCalendarExcel(exportPayload);
    return new NextResponse(new Uint8Array(excelBuffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${baseFilename}.xlsx"`,
      },
    });
  }
}

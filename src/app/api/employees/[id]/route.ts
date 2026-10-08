import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const employee = await prisma.employee.findFirst({
    where: { id, departmentId: session.departmentId },
    include: {
      department: {
        select: {
          checkInStartTime: true,
          checkInCutoffTime: true,
          checkInEndTime: true,
          checkOutStartTime: true,
          checkOutEndTime: true,
        },
      },
    },
  });

  if (!employee) {
    return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  }

  const monthParam = req.nextUrl.searchParams.get("month"); // e.g. "2026-09"
  const monthMatch = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : null;
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const targetMonth = monthMatch || defaultMonth;

  const [yearStr, mStr] = targetMonth.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(mStr, 10);

  const from = new Date(Date.UTC(year, month - 1, 1));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const to = new Date(Date.UTC(year, month - 1, lastDay));

  const [attendance, infractions, penaltyRules] = await Promise.all([
    prisma.attendance.findMany({
      where: {
        employeeId: id,
        date: { gte: from, lte: to },
      },
      orderBy: { date: "asc" },
    }),
    prisma.infraction.findMany({
      where: {
        employeeId: id,
        date: { gte: from, lte: to },
      },
      orderBy: { date: "asc" },
    }),
    prisma.penaltyRule.findMany({
      where: { departmentId: session.departmentId },
    }),
  ]);

  return NextResponse.json({
    employee,
    month: targetMonth,
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
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await req.json();
  const {
    name,
    role,
    active,
    workingDays,
    customCheckInStartTime,
    customCheckInCutoffTime,
    customCheckInEndTime,
    customCheckOutStartTime,
    customCheckOutEndTime,
  } = body;

  const dataToUpdate: Record<string, any> = {};
  if (name !== undefined) dataToUpdate.name = String(name).trim();
  if (role !== undefined) dataToUpdate.role = String(role).trim();
  if (active !== undefined) dataToUpdate.active = Boolean(active);
  if (workingDays !== undefined) dataToUpdate.workingDays = workingDays;

  // Custom shift timings: allow string or null (empty string -> null to reset to department default)
  if (customCheckInStartTime !== undefined) {
    dataToUpdate.customCheckInStartTime = customCheckInStartTime ? String(customCheckInStartTime).trim() : null;
  }
  if (customCheckInCutoffTime !== undefined) {
    dataToUpdate.customCheckInCutoffTime = customCheckInCutoffTime ? String(customCheckInCutoffTime).trim() : null;
  }
  if (customCheckInEndTime !== undefined) {
    dataToUpdate.customCheckInEndTime = customCheckInEndTime ? String(customCheckInEndTime).trim() : null;
  }
  if (customCheckOutStartTime !== undefined) {
    dataToUpdate.customCheckOutStartTime = customCheckOutStartTime ? String(customCheckOutStartTime).trim() : null;
  }
  if (customCheckOutEndTime !== undefined) {
    dataToUpdate.customCheckOutEndTime = customCheckOutEndTime ? String(customCheckOutEndTime).trim() : null;
  }

  // updateMany scoped to the caller's department so one department can never
  // edit another's employee, even by guessing an id.
  const result = await prisma.employee.updateMany({
    where: { id, departmentId: session.departmentId },
    data: dataToUpdate,
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  }

  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      department: {
        select: {
          checkInStartTime: true,
          checkInCutoffTime: true,
          checkInEndTime: true,
          checkOutStartTime: true,
          checkOutEndTime: true,
        },
      },
    },
  });
  return NextResponse.json(employee);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const result = await prisma.employee.deleteMany({
    where: { id, departmentId: session.departmentId },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

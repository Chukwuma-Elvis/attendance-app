import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { queuePendingChange } from "@/lib/approvals";

// Statuses that carry a cash deduction - these are the ones the assistant
// account cannot apply directly, per the approval policy.
const DEDUCTING_STATUSES = new Set(["LATE", "ABSENT"]);

// GET /api/attendance?date=2026-09-05
// Returns employees scheduled to work that date (by workingDays) plus anyone
// already marked for that date, alongside their attendance record (if any).
// Also returns the off-duty roster so an admin can add someone not
// ordinarily on duty that day.
export async function GET(req: NextRequest) {
  const dateParam = req.nextUrl.searchParams.get("date");
  if (!dateParam) {
    return NextResponse.json({ error: "date query param is required (YYYY-MM-DD)." }, { status: 400 });
  }
  const date = new Date(dateParam);
  const dayOfWeek = date.getUTCDay();

  const employees = await prisma.employee.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: { attendance: { where: { date } } },
  });

  const onDuty = employees.filter((e) => e.workingDays.includes(dayOfWeek) || e.attendance.length > 0);
  const offDuty = employees.filter((e) => !e.workingDays.includes(dayOfWeek) && e.attendance.length === 0);

  const rows = onDuty.map((e) => ({
    employeeId: e.id,
    name: e.name,
    role: e.role,
    status: e.attendance[0]?.status ?? null,
    note: e.attendance[0]?.note ?? null,
  }));

  return NextResponse.json({
    rows,
    offDuty: offDuty.map((e) => ({ employeeId: e.id, name: e.name, role: e.role })),
  });
}

// POST { date, records: [{ employeeId, status, note? }, ...] }
// Upserts one row per employee for the given date - this is how the
// "mark attendance" grid on /admin/attendance saves in bulk. A record with
// an empty/falsy status means "set back to Unset", which deletes any
// existing attendance row for that employee/date (there's no "unset" value
// in the AttendanceStatus enum, so clearing it means removing the row).
// LATE and ABSENT carry a cash deduction, so when the assistant account
// submits those they are queued for owner approval instead of applied here;
// PRESENT/EXCUSED/unset (no deduction) still apply immediately either way.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await req.json();
  const { date: dateParam, records } = body as {
    date: string;
    records: { employeeId: string; status: string; note?: string }[];
  };

  if (!dateParam || !Array.isArray(records)) {
    return NextResponse.json({ error: "date and records[] are required." }, { status: 400 });
  }

  const date = new Date(dateParam);

  const toClear = records.filter((r) => !r.status);
  const withStatus = records.filter((r) => r.status);

  let toApply = withStatus;
  let queuedCount = 0;

  if (session.role === "ASSISTANT") {
    const toQueue = withStatus.filter((r) => DEDUCTING_STATUSES.has(r.status));
    toApply = withStatus.filter((r) => !DEDUCTING_STATUSES.has(r.status));

    if (toQueue.length > 0) {
      const employees = await prisma.employee.findMany({
        where: { id: { in: toQueue.map((r) => r.employeeId) } },
      });
      const nameById = Object.fromEntries(employees.map((e) => [e.id, e.name]));

      await Promise.all(
        toQueue.map((r) =>
          queuePendingChange({
            kind: "ATTENDANCE",
            requestedBy: session.username,
            payload: { employeeId: r.employeeId, date: dateParam, status: r.status, note: r.note },
            summary: `Mark ${nameById[r.employeeId] ?? "employee"} ${r.status} on ${dateParam}`,
          })
        )
      );
      queuedCount = toQueue.length;
    }
  }

  if (toApply.length > 0) {
    await prisma.$transaction(
      toApply.map((r) =>
        prisma.attendance.upsert({
          where: { employeeId_date: { employeeId: r.employeeId, date } },
          update: { status: r.status as any, note: r.note },
          create: { employeeId: r.employeeId, date, status: r.status as any, note: r.note },
        })
      )
    );
  }

  if (toClear.length > 0) {
    await prisma.attendance.deleteMany({
      where: { date, employeeId: { in: toClear.map((r) => r.employeeId) } },
    });
  }

  return NextResponse.json({ ok: true, applied: toApply.length, queued: queuedCount, cleared: toClear.length });
}

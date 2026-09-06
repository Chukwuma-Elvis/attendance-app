import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { queuePendingChange } from "@/lib/approvals";

export async function GET(req: NextRequest) {
  const employeeId = req.nextUrl.searchParams.get("employeeId");
  const infractions = await prisma.infraction.findMany({
    where: employeeId ? { employeeId } : undefined,
    include: { employee: true },
    orderBy: { date: "desc" },
  });
  return NextResponse.json(infractions);
}

// POST { employeeId, date, type: "MINOR"|"MAJOR"|"MISCELLANEOUS", description?, amount? }
// If amount is omitted, the current PenaltyRule amount for that type is used,
// so admins can just pick a type and the correct cash penalty is applied automatically.
// Infractions always carry a cash deduction, so when the assistant account
// submits one it is queued for the owner to approve instead of applied here.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await req.json();
  const { employeeId, date, type, description, amount } = body;

  if (!employeeId || !date || !type) {
    return NextResponse.json({ error: "employeeId, date and type are required." }, { status: 400 });
  }

  let resolvedAmount = amount;
  if (resolvedAmount === undefined || resolvedAmount === null) {
    const ruleKey =
      type === "MINOR" ? "MINOR_INFRACTION" : type === "MAJOR" ? "MAJOR_INFRACTION" : "MISCELLANEOUS";
    const rule = await prisma.penaltyRule.findUnique({ where: { key: ruleKey } });
    resolvedAmount = rule?.amount ?? 0;
  }

  if (session.role === "ASSISTANT") {
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    const pending = await queuePendingChange({
      kind: "INFRACTION",
      requestedBy: session.username,
      payload: { employeeId, date, type, description, amount: resolvedAmount },
      summary: `Infraction for ${employee?.name ?? "employee"} on ${date} — ₦${resolvedAmount.toLocaleString()}`,
    });
    return NextResponse.json({ pending: true, request: pending }, { status: 202 });
  }

  const infraction = await prisma.infraction.create({
    data: {
      employeeId,
      date: new Date(date),
      type,
      description,
      amount: resolvedAmount,
    },
  });

  return NextResponse.json(infraction, { status: 201 });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { queuePendingChange } from "@/lib/approvals";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const infraction = await prisma.infraction.findFirst({
    where: { id, employee: { departmentId: session.departmentId } },
    include: { employee: true },
  });

  if (!infraction) {
    return NextResponse.json({ error: "Infraction not found." }, { status: 404 });
  }

  return NextResponse.json(infraction);
}

// PATCH /api/infractions/[id]
// Edits an infraction. If called by an ASSISTANT, the edit is queued as a
// pending change for the OWNER to approve. If called by an OWNER, it is applied immediately.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const existing = await prisma.infraction.findFirst({
    where: { id, employee: { departmentId: session.departmentId } },
    include: { employee: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Infraction not found." }, { status: 404 });
  }

  const body = await req.json();
  const { employeeId, date, type, description, amount } = body;

  const targetEmployeeId = employeeId || existing.employeeId;
  const targetEmployee = await prisma.employee.findFirst({
    where: { id: targetEmployeeId, departmentId: session.departmentId },
  });
  if (!targetEmployee) {
    return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  }

  const targetDateStr = date || existing.date.toISOString().slice(0, 10);
  const targetType = type || existing.type;
  const targetDescription = description !== undefined ? description : existing.description;

  let resolvedAmount = amount;
  if (resolvedAmount === undefined || resolvedAmount === null) {
    if (type && type !== existing.type) {
      const ruleKey =
        type === "MINOR"
          ? "MINOR_INFRACTION"
          : type === "MAJOR"
          ? "MAJOR_INFRACTION"
          : "MISCELLANEOUS";
      const rule = await prisma.penaltyRule.findUnique({
        where: { departmentId_key: { departmentId: session.departmentId, key: ruleKey } },
      });
      resolvedAmount = rule?.amount ?? existing.amount;
    } else {
      resolvedAmount = existing.amount;
    }
  }

  if (session.role === "ASSISTANT") {
    const pending = await queuePendingChange({
      kind: "INFRACTION",
      requestedBy: session.username,
      departmentId: session.departmentId,
      payload: {
        action: "UPDATE",
        infractionId: id,
        employeeId: targetEmployeeId,
        date: targetDateStr,
        type: targetType,
        description: targetDescription,
        amount: resolvedAmount,
        oldValues: {
          employeeName: existing.employee.name,
          date: existing.date.toISOString().slice(0, 10),
          type: existing.type,
          description: existing.description,
          amount: existing.amount,
        },
      },
      summary: `Edit infraction for ${targetEmployee.name} on ${targetDateStr} — ${targetType} (₦${Number(
        resolvedAmount
      ).toLocaleString()})`,
    });

    return NextResponse.json({ pending: true, request: pending }, { status: 202 });
  }

  const updated = await prisma.infraction.update({
    where: { id },
    data: {
      employeeId: targetEmployeeId,
      date: new Date(targetDateStr),
      type: targetType,
      description: targetDescription,
      amount: resolvedAmount,
    },
    include: { employee: true },
  });

  return NextResponse.json(updated);
}

// DELETE /api/infractions/[id]
// Deletes an infraction. If called by an ASSISTANT, the deletion is queued as a
// pending change for the OWNER to approve. If called by an OWNER, it is deleted immediately.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const existing = await prisma.infraction.findFirst({
    where: { id, employee: { departmentId: session.departmentId } },
    include: { employee: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Infraction not found." }, { status: 404 });
  }

  const dateStr = existing.date.toISOString().slice(0, 10);

  if (session.role === "ASSISTANT") {
    const pending = await queuePendingChange({
      kind: "INFRACTION",
      requestedBy: session.username,
      departmentId: session.departmentId,
      payload: {
        action: "DELETE",
        infractionId: id,
        employeeName: existing.employee.name,
        date: dateStr,
        amount: existing.amount,
        type: existing.type,
        description: existing.description,
      },
      summary: `Delete infraction for ${existing.employee.name} on ${dateStr} (₦${existing.amount.toLocaleString()})`,
    });

    return NextResponse.json({ pending: true, request: pending }, { status: 202 });
  }

  await prisma.infraction.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

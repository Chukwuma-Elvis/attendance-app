import { prisma } from "@/lib/db";
import type { PendingChangeKind } from "@prisma/client";

export async function queuePendingChange(opts: {
  kind: PendingChangeKind;
  summary: string;
  payload: object;
  requestedBy: string;
  departmentId: string;
}) {
  return prisma.pendingChange.create({
    data: {
      kind: opts.kind,
      summary: opts.summary,
      payload: opts.payload as any,
      requestedBy: opts.requestedBy,
      departmentId: opts.departmentId,
    },
  });
}

// Applies the effect of an approved PendingChange to the real tables.
// Mirrors exactly what the owner's direct (non-queued) request would have done.
export async function applyPendingChange(id: string) {
  const change = await prisma.pendingChange.findUnique({ where: { id } });
  if (!change || change.status !== "PENDING") return null;

  const payload = change.payload as any;

  if (change.kind === "ATTENDANCE") {
    const { employeeId, date, status, note } = payload;
    await prisma.attendance.upsert({
      where: { employeeId_date: { employeeId, date: new Date(date) } },
      update: { status, note },
      create: { employeeId, date: new Date(date), status, note },
    });
  } else if (change.kind === "INFRACTION") {
    const { action, infractionId, employeeId, date, type, description, amount } = payload;
    if (action === "DELETE") {
      const existing = await prisma.infraction.findUnique({ where: { id: infractionId } });
      if (existing) {
        await prisma.infraction.delete({ where: { id: infractionId } });
      }
    } else if (action === "UPDATE") {
      const existing = await prisma.infraction.findUnique({ where: { id: infractionId } });
      if (existing) {
        await prisma.infraction.update({
          where: { id: infractionId },
          data: {
            ...(employeeId ? { employeeId } : {}),
            ...(date ? { date: new Date(date) } : {}),
            ...(type ? { type } : {}),
            description: description !== undefined ? description : existing.description,
            ...(amount !== undefined ? { amount } : {}),
          },
        });
      }
    } else {
      // Default: create new infraction
      await prisma.infraction.create({
        data: { employeeId, date: new Date(date), type, description, amount },
      });
    }
  } else if (change.kind === "PENALTY_RULE") {
    const { key, amount, label } = payload;
    await prisma.penaltyRule.update({
      where: { departmentId_key: { departmentId: change.departmentId, key } },
      data: {
        ...(amount !== undefined ? { amount: Number(amount) } : {}),
        ...(label !== undefined ? { label: String(label) } : {}),
      },
    });
  } else if (change.kind === "BIOMETRIC_RESET") {
    const { employeeId } = payload;
    if (employeeId) {
      await prisma.employee.update({
        where: { id: employeeId },
        data: {
          biometricResetAllowed: true,
          biometricResetRequested: false,
        },
      });
    }
  }

  return change;
}

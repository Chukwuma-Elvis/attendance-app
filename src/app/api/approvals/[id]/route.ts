import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

// DELETE /api/approvals/[id]
// Allows cancelling/deleting a pending change.
// The owner can cancel any pending change; the assistant can cancel changes they submitted.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const change = await prisma.pendingChange.findUnique({
    where: { id },
  });

  if (!change || change.departmentId !== session.departmentId) {
    return NextResponse.json({ error: "Pending change not found." }, { status: 404 });
  }

  if (session.role !== "OWNER" && change.requestedBy !== session.username) {
    return NextResponse.json({ error: "You can only cancel your own pending changes." }, { status: 403 });
  }

  await prisma.pendingChange.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

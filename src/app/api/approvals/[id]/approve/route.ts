import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { applyPendingChange } from "@/lib/approvals";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (session.role !== "OWNER") {
    return NextResponse.json({ error: "Only the owner account can approve changes." }, { status: 403 });
  }

  const change = await applyPendingChange(id);
  if (!change) {
    return NextResponse.json({ error: "Pending change not found or already resolved." }, { status: 404 });
  }

  const updated = await prisma.pendingChange.update({
    where: { id },
    data: { status: "APPROVED", resolvedAt: new Date(), resolvedBy: session.username },
  });

  return NextResponse.json(updated);
}

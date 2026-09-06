import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

// GET /api/approvals - the owner sees every request; the assistant sees only
// the ones they submitted (read-only - they cannot approve their own work).
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const changes = await prisma.pendingChange.findMany({
    where: session.role === "OWNER" ? undefined : { requestedBy: session.username },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ role: session.role, changes });
}

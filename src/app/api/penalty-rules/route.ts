import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { queuePendingChange } from "@/lib/approvals";

export async function GET() {
  const rules = await prisma.penaltyRule.findMany({ orderBy: { key: "asc" } });
  return NextResponse.json(rules);
}

// POST { key, amount?, label? } - updates a rule's amount and/or its display label.
// Changing the amount changes every future deduction it drives, so when the
// assistant account submits an amount change it is queued for owner approval.
// A label-only rename doesn't affect any deduction and applies immediately.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { key, amount, label } = await req.json();
  if (!key || (amount === undefined && label === undefined)) {
    return NextResponse.json({ error: "key and at least one of amount/label are required." }, { status: 400 });
  }

  if (session.role === "ASSISTANT" && amount !== undefined) {
    const existing = await prisma.penaltyRule.findUnique({ where: { key } });
    const pending = await queuePendingChange({
      kind: "PENALTY_RULE",
      requestedBy: session.username,
      payload: { key, amount, label },
      summary: `Change ${existing?.label ?? key} penalty from ₦${(existing?.amount ?? 0).toLocaleString()} to ₦${Number(amount).toLocaleString()}`,
    });
    return NextResponse.json({ pending: true, request: pending }, { status: 202 });
  }

  const rule = await prisma.penaltyRule.update({
    where: { key },
    data: {
      ...(amount !== undefined ? { amount: Number(amount) } : {}),
      ...(label !== undefined ? { label: String(label) } : {}),
    },
  });
  return NextResponse.json(rule);
}
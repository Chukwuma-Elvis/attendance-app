import { NextRequest, NextResponse } from "next/server";
import { computeDeductions } from "@/lib/deductions";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const fromParam = req.nextUrl.searchParams.get("from");
  const toParam = req.nextUrl.searchParams.get("to");

  const breakdown = await computeDeductions({
    departmentId: session.departmentId,
    from: fromParam ? new Date(fromParam) : undefined,
    to: toParam ? new Date(toParam) : undefined,
  });

  return NextResponse.json(breakdown);
}

import { NextRequest, NextResponse } from "next/server";
import { computeDeductions } from "@/lib/deductions";

export async function GET(req: NextRequest) {
  const fromParam = req.nextUrl.searchParams.get("from");
  const toParam = req.nextUrl.searchParams.get("to");

  const breakdown = await computeDeductions({
    from: fromParam ? new Date(fromParam) : undefined,
    to: toParam ? new Date(toParam) : undefined,
  });

  return NextResponse.json(breakdown);
}

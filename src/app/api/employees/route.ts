import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const employees = await prisma.employee.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(employees);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, role, workingDays } = body;

  if (!name || !role) {
    return NextResponse.json({ error: "name and role are required." }, { status: 400 });
  }

  const employee = await prisma.employee.create({
    data: {
      name: String(name).trim(),
      role: String(role).trim(),
      workingDays: Array.isArray(workingDays) ? workingDays : [0, 1, 2, 3, 4, 5, 6],
    },
  });

  return NextResponse.json(employee, { status: 201 });
}

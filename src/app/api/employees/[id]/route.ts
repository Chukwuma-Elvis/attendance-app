import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await req.json();
  const { name, role, active, workingDays } = body;

  // updateMany scoped to the caller's department so one department can never
  // edit another's employee, even by guessing an id.
  const result = await prisma.employee.updateMany({
    where: { id, departmentId: session.departmentId },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(role !== undefined ? { role } : {}),
      ...(active !== undefined ? { active } : {}),
      ...(workingDays !== undefined ? { workingDays } : {}),
    },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  }

  const employee = await prisma.employee.findUnique({ where: { id } });
  return NextResponse.json(employee);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const result = await prisma.employee.deleteMany({
    where: { id, departmentId: session.departmentId },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

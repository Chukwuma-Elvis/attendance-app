import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/session";
import { verifyPassword } from "@/lib/password";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();
  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
  }

  const account = await prisma.adminAccount.findUnique({
    where: { username },
    include: { department: true },
  });

  if (!account || !verifyPassword(password, account.passwordHash)) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  await createSession(account.username, account.role, account.departmentId, account.department.name);
  return NextResponse.json({ ok: true, role: account.role, department: account.department.name });
}

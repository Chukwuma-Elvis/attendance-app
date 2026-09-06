import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  const ownerUsername = process.env.ADMIN_USERNAME;
  const ownerPassword = process.env.ADMIN_PASSWORD;
  const assistantUsername = process.env.ASSISTANT_USERNAME;
  const assistantPassword = process.env.ASSISTANT_PASSWORD;

  if (!ownerUsername || !ownerPassword) {
    return NextResponse.json(
      { error: "Server is missing ADMIN_USERNAME/ADMIN_PASSWORD configuration." },
      { status: 500 }
    );
  }

  if (username === ownerUsername && password === ownerPassword) {
    await createSession(username, "OWNER");
    return NextResponse.json({ ok: true, role: "OWNER" });
  }

  if (assistantUsername && assistantPassword && username === assistantUsername && password === assistantPassword) {
    await createSession(username, "ASSISTANT");
    return NextResponse.json({ ok: true, role: "ASSISTANT" });
  }

  return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
}

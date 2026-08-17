import { NextResponse } from "next/server";
import { createSession } from "@/lib/sessions";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const session = await createSession({
      candidateName: body.candidateName,
      role: body.role,
    });
    return NextResponse.json({ session });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

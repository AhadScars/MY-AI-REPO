import { NextResponse } from "next/server";
import { appendNote, readNotes, getSession } from "@/lib/sessions";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }
    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    const notes = await readNotes(sessionId);
    return NextResponse.json({ session, ...notes });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to read notes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sessionId, text, type = "observation" } = body as {
      sessionId: string;
      text: string;
      type?: "question" | "answer" | "observation" | "system";
    };
    if (!sessionId || !text) {
      return NextResponse.json(
        { error: "sessionId and text required" },
        { status: 400 }
      );
    }
    const entries = await appendNote(sessionId, {
      time: new Date().toISOString(),
      type,
      text,
    });
    const { md } = await readNotes(sessionId);
    return NextResponse.json({ entries, md });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save note";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

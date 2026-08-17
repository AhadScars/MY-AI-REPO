import { NextResponse } from "next/server";
import {
  startInterviewOffline,
  nextTurnOffline,
  type Analysis,
} from "@/lib/offline-interviewer";
import {
  getSession,
  appendNote,
  saveTranscript,
  updateSession,
} from "@/lib/sessions";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      sessionId,
      message,
      history = [],
      analysis,
      action = "answer",
    } = body as {
      sessionId: string;
      message?: string;
      history?: Array<{ role: string; content: string }>;
      analysis?: Analysis;
      action?: "start" | "answer" | "end";
    };

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (!analysis) {
      return NextResponse.json(
        { error: "analysis required — analyze resume first" },
        { status: 400 }
      );
    }

    await updateSession(sessionId, { status: "in_progress" });
    const role = session.role || "Software Engineer";

    let turn;
    if (action === "start") {
      turn = startInterviewOffline(analysis, role);
    } else {
      const userMessage = (message || "").trim();
      if (!userMessage && action !== "end") {
        return NextResponse.json({ error: "message required" }, { status: 400 });
      }

      if (userMessage) {
        await appendNote(sessionId, {
          time: new Date().toISOString(),
          type: "answer",
          text: userMessage,
        });
      }

      turn = nextTurnOffline({
        analysis,
        role,
        history,
        message: userMessage || "",
        action: action === "end" ? "end" : "answer",
      });
    }

    if (action === "start" && turn.nextQuestion) {
      await appendNote(sessionId, {
        time: new Date().toISOString(),
        type: "question",
        text: turn.nextQuestion,
      });
    }

    if (turn.note && action !== "start") {
      await appendNote(sessionId, {
        time: new Date().toISOString(),
        type: "observation",
        text: turn.note,
      });
    }

    if (turn.nextQuestion && action !== "start") {
      await appendNote(sessionId, {
        time: new Date().toISOString(),
        type: "question",
        text: turn.nextQuestion,
      });
    }

    const userMessage = (message || "").trim();
    const transcript = [
      ...history.map((h) => ({
        role: h.role,
        content: h.content,
        ts: new Date().toISOString(),
      })),
      ...(action !== "start" && userMessage
        ? [{ role: "user", content: userMessage, ts: new Date().toISOString() }]
        : []),
      {
        role: "assistant",
        content: turn.spokenReply,
        ts: new Date().toISOString(),
      },
    ];
    await saveTranscript(sessionId, transcript);

    if (turn.done || action === "end") {
      await updateSession(sessionId, { status: "completed" });
    }

    return NextResponse.json({ ...turn, mode: "offline" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Interview turn failed";
    console.error("interview error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

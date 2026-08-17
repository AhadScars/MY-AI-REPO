import { NextResponse } from "next/server";
import { feedbackOffline, type Analysis } from "@/lib/offline-interviewer";
import {
  getSession,
  readNotes,
  saveFeedback,
  appendNote,
} from "@/lib/sessions";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sessionId, analysis, history = [] } = body as {
      sessionId: string;
      analysis?: Analysis;
      history?: Array<{ role: string; content: string }>;
    };

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (!analysis) {
      return NextResponse.json({ error: "analysis required" }, { status: 400 });
    }

    const { md: notesMd } = await readNotes(sessionId);
    const role = session.role || "Software Engineer";

    const feedback = feedbackOffline({
      analysis,
      role,
      history,
      notesMd,
    });

    const feedbackMd = `# Interview Feedback (Offline)

**Session:** ${sessionId}  
**Candidate:** ${session.candidateName || "N/A"}  
**Role:** ${session.role || "N/A"}  
**Date:** ${new Date().toISOString()}  
**Overall score:** ${feedback.overallScore}/10  
**Mode:** Fully offline (no cloud AI)

## Strengths
${feedback.strengths.map((s) => `- ${s}`).join("\n")}

## Areas to improve
${feedback.areasToImprove.map((s) => `- ${s}`).join("\n")}

## Key takeaways
${feedback.keyTakeaways.map((s) => `- ${s}`).join("\n")}

## Detailed feedback
${feedback.detailedFeedback}

## Spoken summary
${feedback.spokenSummary}
`;

    await saveFeedback(sessionId, feedbackMd, feedback);
    await appendNote(sessionId, {
      time: new Date().toISOString(),
      type: "system",
      text: `Final offline feedback saved.\nScore: ${feedback.overallScore}/10\nStrengths: ${feedback.strengths.join("; ")}\nImprove: ${feedback.areasToImprove.join("; ")}`,
    });

    return NextResponse.json({ feedback, feedbackMd, mode: "offline" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Feedback failed";
    console.error("feedback error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

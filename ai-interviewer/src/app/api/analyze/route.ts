import { NextResponse } from "next/server";
import {
  analyzeResumeOffline,
  reviewResumeOffline,
} from "@/lib/offline-interviewer";
import { extractResumeText } from "@/lib/resume-parse";
import {
  createSession,
  saveResumeText,
  appendNote,
  updateSession,
} from "@/lib/sessions";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const role = String(form.get("role") || "Software Engineer");
    const resumeText = String(form.get("resumeText") || "");
    const file = form.get("file") as File | null;
    const wantReview = String(form.get("includeReview") || "true") !== "false";

    // File always wins over leftover paste text
    const extracted = await extractResumeText({ file, pastedText: resumeText });
    const plainResume = extracted.text;

    if (!plainResume.trim() || plainResume.trim().length < 40) {
      return NextResponse.json(
        {
          error:
            "Could not read enough resume text. Upload a text-based PDF/DOCX/TXT, or paste the full resume. Scanned image PDFs are not supported offline.",
          extractMeta: extracted,
        },
        { status: 400 }
      );
    }

    const analysis = analyzeResumeOffline(plainResume, role);
    const review = wantReview ? reviewResumeOffline(plainResume, role) : null;

    const session = await createSession({
      candidateName: analysis.candidateName,
      role,
      resumeSummary: analysis.summary,
      status: "ready",
    });

    await saveResumeText(session.id, plainResume);

    await appendNote(session.id, {
      time: new Date().toISOString(),
      type: "system",
      text: [
        `Resume analyzed OFFLINE for role: ${role}`,
        `**Extract source:** ${extracted.source}${extracted.pages ? ` (${extracted.pages} pages)` : ""} · ${extracted.charCount} chars`,
        extracted.warning ? `**Warning:** ${extracted.warning}` : "",
        ``,
        `**Summary:** ${analysis.summary}`,
        `**Skills:** ${analysis.skills.join(", ") || "n/a"}`,
        `**Highlights:** ${analysis.experienceHighlights.join("; ") || "n/a"}`,
        `**Gaps to probe:** ${analysis.potentialGaps.join("; ")}`,
        `**Focus areas:** ${analysis.suggestedFocusAreas.join(", ")}`,
        review
          ? `\n**Resume review score:** ${review.overallScore}/10\n**Review strengths:** ${review.strengths.join("; ")}\n**Review improvements:** ${review.weaknesses.join("; ")}`
          : "",
        ``,
        `**Extracted text preview (first 500 chars):**\n${plainResume.slice(0, 500)}`,
      ]
        .filter(Boolean)
        .join("\n"),
    });

    await updateSession(session.id, {
      candidateName: analysis.candidateName,
      resumeSummary: analysis.summary,
    });

    return NextResponse.json({
      sessionId: session.id,
      analysis,
      review,
      mode: "offline",
      extractMeta: {
        source: extracted.source,
        pages: extracted.pages,
        charCount: extracted.charCount,
        warning: extracted.warning,
        preview: plainResume.slice(0, 800),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analyze failed";
    console.error("analyze error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import PDFDocument from "pdfkit";
import type { Interview, InterviewReport, User } from "@prisma/client";
import { safeJson } from "./utils";
import type {
  communicationAnalysisSchema,
  improvementDaySchema,
  questionAnalysisSchema,
  resumeConsistencySchema,
  strengthSchema,
  technicalAnalysisSchema,
  weaknessSchema,
} from "./schemas";
import type { z } from "zod";

type Strength = z.infer<typeof strengthSchema>;
type Weakness = z.infer<typeof weaknessSchema>;
type QAnalysis = z.infer<typeof questionAnalysisSchema>;
type Comm = z.infer<typeof communicationAnalysisSchema>;
type Tech = z.infer<typeof technicalAnalysisSchema>;
type Consistency = z.infer<typeof resumeConsistencySchema>;
type PlanDay = z.infer<typeof improvementDaySchema>;

const NAVY = "#0F172A";
const BLUE = "#2563EB";
const MUTED = "#475569";
const LINE = "#E2E8F0";
const GREEN = "#166534";
const AMBER = "#92400E";

type ReportPayload = {
  user: Pick<User, "name" | "email">;
  interview: Interview;
  report: InterviewReport;
};

function writeWrapped(doc: PDFKit.PDFDocument, text: string, options?: PDFKit.Mixins.TextOptions) {
  doc.text(text || "—", options);
}

export async function buildReportPdf(payload: ReportPayload): Promise<Buffer> {
  const { user, interview, report } = payload;
  const strengths = safeJson<Strength[]>(report.strengths, []);
  const weaknesses = safeJson<Weakness[]>(report.weaknesses, []);
  const questions = safeJson<QAnalysis[]>(report.questionAnalysis, []);
  const communication = safeJson<Comm>(report.communicationAnalysis, {
    clarity: "",
    structure: "",
    conciseness: "",
    fillerWords: "",
    storytelling: "",
    starUsage: "",
    technicalExplanation: "",
    suggestion: "",
  });
  const technical = safeJson<Tech>(report.technicalAnalysis, {
    summary: "",
    strengths: [],
    gaps: [],
    recommendation: "",
  });
  const consistency = safeJson<Consistency>(report.resumeConsistency, {
    supportedClaims: [],
    needsClarification: [],
    listedButNotDemonstrated: [],
    demonstratedBeyondResume: [],
    summary: "",
  });
  const plan = safeJson<PlanDay[]>(report.improvementPlan, []);
  const recommendations = safeJson<string[]>(report.recommendations, []);

  const doc = new PDFDocument({
    size: "LETTER",
    margins: { top: 64, bottom: 56, left: 64, right: 64 },
    info: {
      Title: "AI Mock Interview Assessment",
      Author: "Prepwise",
      Subject: `${interview.role} interview assessment for ${user.name}`,
    },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const pageBottom = () => doc.page.height - doc.page.margins.bottom;

  const ensureSpace = (needed: number) => {
    if (doc.y + needed > pageBottom()) {
      doc.addPage();
    }
  };

  const hr = () => {
    doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor(LINE).lineWidth(1).stroke();
    doc.moveDown(0.8);
  };

  const heading = (text: string) => {
    ensureSpace(48);
    doc.moveDown(0.4);
    doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(14).text(text);
    doc.moveDown(0.25);
    hr();
  };

  const body = (text: string) => {
    doc.fillColor(NAVY).font("Helvetica").fontSize(10).lineGap(2.4);
    writeWrapped(doc, text);
    doc.moveDown(0.6);
  };

  const bullet = (text: string, color = NAVY) => {
    ensureSpace(28);
    doc.fillColor(color).font("Helvetica").fontSize(10).text(`•  ${text}`, { indent: 8 });
    doc.moveDown(0.25);
  };

  // Cover
  doc.fillColor(BLUE).rect(0, 0, 12, doc.page.height).fill();
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(11).text("PREPWISE", 64, 72);
  doc.moveDown(2.4);
  doc.font("Helvetica-Bold").fontSize(28).fillColor(NAVY).text("AI Mock Interview\nAssessment");
  doc.moveDown(0.6);
  doc.font("Helvetica").fontSize(12).fillColor(MUTED).text("Confidential candidate report");
  doc.moveDown(1.6);

  const details = [
    ["Candidate", user.name],
    ["Email", user.email],
    ["Target role", interview.role],
    ["Company", interview.company || "Not specified"],
    ["Experience level", interview.experienceLevel],
    ["Interview type", interview.interviewType.replace(/_/g, " ")],
    ["Difficulty", interview.difficulty],
    ["Date", (interview.completedAt ?? interview.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })],
    ["Duration", `${interview.duration} minutes`],
  ];

  details.forEach(([label, value]) => {
    doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(label, { continued: false });
    doc.font("Helvetica-Bold").fontSize(11).fillColor(NAVY).text(String(value));
    doc.moveDown(0.35);
  });

  doc.moveDown(1);
  doc.roundedRect(64, doc.y, 200, 88, 8).fill("#EFF6FF");
  const scoreY = doc.y;
  doc.fillColor(BLUE).font("Helvetica-Bold").fontSize(36).text(String(report.overallScore), 84, scoreY + 16);
  doc.font("Helvetica").fontSize(10).fillColor(MUTED).text("/ 100 overall", 84, scoreY + 58);
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(12).text(report.readiness, 280, scoreY + 28, { width: 250 });
  doc.font("Helvetica").fontSize(10).fillColor(MUTED).text(`Readiness ${report.readinessPercent}%`, 280, scoreY + 50);

  doc.addPage();
  heading("Executive Summary");
  body(report.executiveSummary);

  heading("Category Scores");
  const scores: Array<[string, number]> = [
    ["Technical Knowledge", report.technicalScore],
    ["Problem Solving", report.problemSolvingScore],
    ["Communication", report.communicationScore],
    ["Confidence", report.confidenceScore],
    ["Role Knowledge", report.roleKnowledgeScore],
    ["Behavioral Responses", report.behavioralScore],
    ["Resume Knowledge", report.resumeKnowledgeScore],
  ];
  scores.forEach(([label, score]) => {
    ensureSpace(28);
    const x = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    doc.font("Helvetica").fontSize(9).fillColor(NAVY).text(label, x, doc.y, { continued: false });
    doc.font("Helvetica-Bold").text(String(score), { align: "right" });
    const barY = doc.y + 4;
    doc.rect(x, barY, width, 6).fill("#E2E8F0");
    doc.rect(x, barY, (width * Math.max(0, Math.min(100, score))) / 100, 6).fill(BLUE);
    doc.y = barY + 16;
  });

  heading("Strengths");
  strengths.forEach((item) => {
    ensureSpace(70);
    doc.fillColor(GREEN).font("Helvetica-Bold").fontSize(11).text(item.title);
    doc.moveDown(0.2);
    body(item.detail);
    doc.font("Helvetica-Oblique").fontSize(9).fillColor(MUTED).text(`Evidence: ${item.evidence}`);
    doc.moveDown(0.6);
  });

  heading("Areas for Improvement");
  weaknesses.forEach((item) => {
    ensureSpace(90);
    doc.fillColor(AMBER).font("Helvetica-Bold").fontSize(11).text(item.title);
    doc.moveDown(0.25);
    body(`What happened: ${item.whatHappened}`);
    body(`Why it matters: ${item.whyItMatters}`);
    body(`Example: ${item.example}`);
    doc.font("Helvetica-Bold").fontSize(10).fillColor(NAVY).text("How to improve");
    doc.moveDown(0.2);
    item.howToImprove.forEach((step) => bullet(step, AMBER));
    doc.moveDown(0.4);
  });

  heading("Question Analysis");
  questions.forEach((q) => {
    ensureSpace(110);
    doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(11).text(`Question ${q.order}  ·  ${q.score}/100`);
    doc.moveDown(0.2);
    doc.font("Helvetica-Oblique").fontSize(10).fillColor(MUTED).text(`“${q.question}”`);
    doc.moveDown(0.35);
    body(`Candidate: ${q.candidateAnswer}`);
    body(`What you did well: ${q.whatWentWell}`);
    body(`What was missing: ${q.whatWasMissing}`);
    body(`Better approach: ${q.betterApproach}`);
    if (q.strongAnswerIncludes?.length) {
      doc.font("Helvetica-Bold").fontSize(10).fillColor(NAVY).text("A strong answer should include");
      doc.moveDown(0.15);
      q.strongAnswerIncludes.forEach((line) => bullet(line));
    }
    doc.moveDown(0.4);
  });

  heading("Communication Assessment");
  body(communication.suggestion);
  body(`Clarity: ${communication.clarity}`);
  body(`Structure: ${communication.structure}`);
  body(`Conciseness: ${communication.conciseness}`);
  body(`Filler words / pacing: ${communication.fillerWords}`);
  body(`Storytelling: ${communication.storytelling}`);
  body(`STAR method: ${communication.starUsage}`);
  body(`Technical explanation: ${communication.technicalExplanation}`);

  heading("Technical Assessment");
  body(technical.summary);
  technical.strengths.forEach((s) => bullet(s, GREEN));
  technical.gaps.forEach((s) => bullet(s, AMBER));
  body(technical.recommendation);

  heading("Resume Assessment");
  body(consistency.summary);
  if (consistency.supportedClaims.length) {
    doc.font("Helvetica-Bold").fontSize(10).fillColor(NAVY).text("Strongly supported claims");
    doc.moveDown(0.2);
    consistency.supportedClaims.forEach((s) => bullet(s, GREEN));
  }
  if (consistency.needsClarification.length) {
    doc.font("Helvetica-Bold").fontSize(10).fillColor(NAVY).text("May benefit from clearer explanation");
    doc.moveDown(0.2);
    consistency.needsClarification.forEach((s) => bullet(s, AMBER));
  }
  if (consistency.listedButNotDemonstrated.length) {
    doc.font("Helvetica-Bold").fontSize(10).fillColor(NAVY).text("Listed but not demonstrated");
    doc.moveDown(0.2);
    consistency.listedButNotDemonstrated.forEach((s) => bullet(s));
  }
  if (consistency.demonstratedBeyondResume.length) {
    doc.font("Helvetica-Bold").fontSize(10).fillColor(NAVY).text("Demonstrated beyond the resume");
    doc.moveDown(0.2);
    consistency.demonstratedBeyondResume.forEach((s) => bullet(s, GREEN));
  }

  heading("Recommended Preparation");
  recommendations.forEach((s) => bullet(s));

  heading("7-Day Improvement Plan");
  plan.forEach((day) => {
    ensureSpace(40);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(BLUE).text(`Day ${day.day}  ·  ${day.title}`);
    doc.moveDown(0.15);
    body(day.focus);
  });

  heading("Final Recommendation");
  body(report.finalRecommendation);

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.font("Helvetica").fontSize(8).fillColor(MUTED);
    doc.text("Prepwise  ·  AI Mock Interview Assessment  ·  Confidential", 64, doc.page.height - 36, {
      width: 360,
      lineBreak: false,
    });
    doc.text(`${i + 1} / ${range.count}`, 0, doc.page.height - 36, { align: "right", width: doc.page.width - 64 });
  }

  doc.end();

  return await new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

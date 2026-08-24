import type {
  Interview,
  InterviewAnswer,
  InterviewQuestion,
  InterviewReport,
  Resume,
  User,
} from "@prisma/client";
import { safeJson } from "./utils";
import type { FinalReport, ParsedResume } from "./schemas";

type QuestionWithAnswers = InterviewQuestion & { answers: InterviewAnswer[] };
type InterviewWithRelations = Interview & {
  questions: QuestionWithAnswers[];
  report?: InterviewReport | null;
  resume?: Resume | null;
  user?: Pick<User, "name" | "email"> | null;
};

export function publicResume(resume: Resume) {
  return {
    id: resume.id,
    fileName: resume.fileName,
    parsedData: safeJson<ParsedResume>(resume.parsedData, {
      name: "",
      email: "",
      phone: "",
      summary: "",
      skills: [],
      experience: [],
      education: [],
      projects: [],
      certifications: [],
      achievements: [],
      technologies: [],
      jobTitles: [],
      yearsOfExperience: 0,
    }),
    createdAt: resume.createdAt,
  };
}

function publicQuestion(q: QuestionWithAnswers, revealScores: boolean) {
  const latest = q.answers.at(-1);
  return {
    id: q.id,
    order: q.order,
    question: q.question,
    category: q.category,
    difficulty: q.difficulty,
    answer: latest
      ? {
          id: latest.id,
          text: latest.answer,
          skipped: latest.skipped,
          createdAt: latest.createdAt,
          ...(revealScores ? { score: latest.score } : {}),
        }
      : null,
  };
}

export function publicInterview(interview: InterviewWithRelations, opts?: { revealScores?: boolean }) {
  const reveal = Boolean(opts?.revealScores || interview.status === "completed");
  return {
    id: interview.id,
    status: interview.status,
    role: interview.role,
    company: interview.company,
    experienceLevel: interview.experienceLevel,
    interviewType: interview.interviewType,
    difficulty: interview.difficulty,
    duration: interview.duration,
    style: interview.style,
    currentQuestion: interview.currentQuestion,
    totalQuestions: interview.totalQuestions,
    topicsCovered: safeJson<string[]>(interview.topicsCovered, []),
    topicsRemaining: safeJson<string[]>(interview.topicsRemaining, []),
    overallScore: reveal ? interview.overallScore : null,
    startedAt: interview.startedAt,
    completedAt: interview.completedAt,
    createdAt: interview.createdAt,
    questions: [...interview.questions]
      .sort((a, b) => a.order - b.order)
      .map((q) => publicQuestion(q, reveal)),
    resume: interview.resume ? publicResume(interview.resume) : undefined,
  };
}

export function publicReport(report: InterviewReport): import("./types").PublicReport {
  return {
    id: report.id,
    interviewId: report.interviewId,
    overallScore: report.overallScore,
    scores: {
      technical: report.technicalScore,
      communication: report.communicationScore,
      problemSolving: report.problemSolvingScore,
      confidence: report.confidenceScore,
      roleKnowledge: report.roleKnowledgeScore,
      behavioral: report.behavioralScore,
      resumeKnowledge: report.resumeKnowledgeScore,
    },
    readiness: report.readiness,
    readinessPercent: report.readinessPercent,
    executiveSummary: report.executiveSummary,
    strengths: safeJson(report.strengths, []),
    weaknesses: safeJson(report.weaknesses, []),
    questionAnalysis: safeJson(report.questionAnalysis, []),
    communicationAnalysis: safeJson(report.communicationAnalysis, {
      clarity: "",
      structure: "",
      conciseness: "",
      fillerWords: "",
      storytelling: "",
      starUsage: "",
      technicalExplanation: "",
      suggestion: "",
    }),
    technicalAnalysis: safeJson(report.technicalAnalysis, {
      summary: "",
      strengths: [] as string[],
      gaps: [] as string[],
      recommendation: "",
    }),
    resumeConsistency: safeJson(report.resumeConsistency, {
      supportedClaims: [] as string[],
      needsClarification: [] as string[],
      listedButNotDemonstrated: [] as string[],
      demonstratedBeyondResume: [] as string[],
      summary: "",
    }),
    recommendations: safeJson(report.recommendations, []),
    improvementPlan: safeJson(report.improvementPlan, []),
    finalRecommendation: report.finalRecommendation,
    createdAt: report.createdAt.toISOString(),
  };
}

export function reportFromFinal(data: FinalReport) {
  return {
    overallScore: Math.round(data.overallScore),
    technicalScore: Math.round(data.scores.technical),
    communicationScore: Math.round(data.scores.communication),
    problemSolvingScore: Math.round(data.scores.problemSolving),
    confidenceScore: Math.round(data.scores.confidence),
    roleKnowledgeScore: Math.round(data.scores.roleKnowledge),
    behavioralScore: Math.round(data.scores.behavioral),
    resumeKnowledgeScore: Math.round(data.scores.resumeKnowledge),
    readiness: data.readiness,
    readinessPercent: Math.round(data.readinessPercent),
    executiveSummary: `${data.executiveSummary}\n\n${data.readinessReason}`.trim(),
    strengths: JSON.stringify(data.strengths),
    weaknesses: JSON.stringify(data.weaknesses),
    questionAnalysis: JSON.stringify(data.questionAnalysis),
    communicationAnalysis: JSON.stringify(data.communicationAnalysis),
    technicalAnalysis: JSON.stringify(data.technicalAnalysis),
    resumeConsistency: JSON.stringify(data.resumeConsistency),
    recommendations: JSON.stringify(data.recommendations),
    improvementPlan: JSON.stringify(data.improvementPlan),
    finalRecommendation: data.finalRecommendation,
  };
}

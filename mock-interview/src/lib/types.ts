import type { ParsedResume } from "./schemas";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

export type PublicQuestion = {
  id: string;
  order: number;
  question: string;
  category: string;
  difficulty: string;
  answer: {
    id: string;
    text: string;
    skipped: boolean;
    createdAt: string;
    score?: number | null;
  } | null;
};

export type PublicInterview = {
  id: string;
  status: string;
  role: string;
  company: string | null;
  experienceLevel: string;
  interviewType: string;
  difficulty: string;
  duration: number;
  style: string;
  currentQuestion: number;
  totalQuestions: number;
  topicsCovered: string[];
  topicsRemaining: string[];
  overallScore: number | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  questions: PublicQuestion[];
  resume?: {
    id: string;
    fileName: string;
    parsedData: ParsedResume;
    createdAt: string;
  };
};

export type PublicReport = {
  id: string;
  interviewId: string;
  overallScore: number;
  scores: {
    technical: number;
    communication: number;
    problemSolving: number;
    confidence: number;
    roleKnowledge: number;
    behavioral: number;
    resumeKnowledge: number;
  };
  readiness: string;
  readinessPercent: number;
  executiveSummary: string;
  strengths: Array<{ title: string; detail: string; evidence: string }>;
  weaknesses: Array<{
    title: string;
    whatHappened: string;
    whyItMatters: string;
    example: string;
    howToImprove: string[];
  }>;
  questionAnalysis: Array<{
    order: number;
    question: string;
    candidateAnswer: string;
    score: number;
    whatWentWell: string;
    whatWasMissing: string;
    betterApproach: string;
    strongAnswerIncludes: string[];
  }>;
  communicationAnalysis: {
    clarity: string;
    structure: string;
    conciseness: string;
    fillerWords: string;
    storytelling: string;
    starUsage: string;
    technicalExplanation: string;
    suggestion: string;
  };
  technicalAnalysis: {
    summary: string;
    strengths: string[];
    gaps: string[];
    recommendation: string;
  };
  resumeConsistency: {
    supportedClaims: string[];
    needsClarification: string[];
    listedButNotDemonstrated: string[];
    demonstratedBeyondResume: string[];
    summary: string;
  };
  recommendations: string[];
  improvementPlan: Array<{ day: number; title: string; focus: string }>;
  finalRecommendation: string;
  createdAt: string;
};

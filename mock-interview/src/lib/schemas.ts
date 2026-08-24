import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Please enter your full name.").max(80),
  email: z.string().trim().email("Enter a valid email address."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(72, "Password is too long."),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export const forgotSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});

export const resetSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, "Password must be at least 8 characters.").max(72),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export const experienceSchema = z.object({
  title: z.string(),
  company: z.string(),
  dates: z.string(),
  highlights: z.array(z.string()),
});

export const educationSchema = z.object({
  school: z.string(),
  degree: z.string(),
  year: z.string(),
});

export const projectSchema = z.object({
  name: z.string(),
  description: z.string(),
  technologies: z.array(z.string()),
});

export const parsedResumeSchema = z.object({
  name: z.string().default(""),
  email: z.string().default(""),
  phone: z.string().default(""),
  summary: z.string().default(""),
  skills: z.array(z.string()).default([]),
  experience: z.array(experienceSchema).default([]),
  education: z.array(educationSchema).default([]),
  projects: z.array(projectSchema).default([]),
  certifications: z.array(z.string()).default([]),
  achievements: z.array(z.string()).default([]),
  technologies: z.array(z.string()).default([]),
  jobTitles: z.array(z.string()).default([]),
  yearsOfExperience: z.number().default(0),
});

export type ParsedResume = z.infer<typeof parsedResumeSchema>;

export const updateResumeSchema = parsedResumeSchema;

export const createInterviewSchema = z.object({
  resumeId: z.string().min(1),
  role: z.string().trim().min(2).max(80),
  company: z.string().trim().max(80).optional().or(z.literal("")),
  experienceLevel: z.enum([
    "intern",
    "entry",
    "mid",
    "senior",
    "lead",
    "manager",
    "executive",
  ]),
  interviewType: z.enum([
    "technical",
    "behavioral",
    "hr",
    "system_design",
    "coding",
    "managerial",
    "mixed",
  ]),
  difficulty: z.enum(["easy", "medium", "hard", "expert"]),
  duration: z.number().int().min(8).max(90),
  style: z.enum(["friendly", "professional", "challenging", "strict", "faang", "startup"]),
  parsedData: parsedResumeSchema.optional(),
});

export const answerSchema = z.object({
  answer: z.string().max(12000).default(""),
  skipped: z.boolean().optional(),
});

export const scoreBreakdownSchema = z.object({
  technical: z.number(),
  relevance: z.number(),
  depth: z.number(),
  problemSolving: z.number(),
  communication: z.number(),
  specificity: z.number(),
  ownership: z.number(),
  confidence: z.number(),
  overall: z.number(),
  notes: z.string(),
});

export const interviewTurnSchema = z.object({
  nextQuestion: z.string(),
  questionType: z.string(),
  difficulty: z.string(),
  shouldFollowUp: z.boolean(),
  followUpFocus: z.string(),
  topic: z.string(),
  interviewComplete: z.boolean(),
  reason: z.string().optional().default(""),
  evaluation: scoreBreakdownSchema.nullable(),
});

export type InterviewTurn = z.infer<typeof interviewTurnSchema>;

export const questionOpportunitySchema = z.object({
  claim: z.string(),
  question: z.string(),
});

export const internalAnalysisSchema = z.object({
  careerTrajectory: z.string(),
  primarySkills: z.array(z.string()),
  secondarySkills: z.array(z.string()),
  industry: z.string(),
  resumeStrengths: z.array(z.string()),
  resumeWeaknesses: z.array(z.string()),
  skillGaps: z.array(z.string()),
  questionOpportunities: z.array(questionOpportunitySchema),
  topicsToCover: z.array(z.string()),
  openingQuestion: z.string(),
  openingTopic: z.string(),
  openingType: z.string(),
});

export type InternalAnalysis = z.infer<typeof internalAnalysisSchema>;

export const strengthSchema = z.object({
  title: z.string(),
  detail: z.string(),
  evidence: z.string(),
});

export const weaknessSchema = z.object({
  title: z.string(),
  whatHappened: z.string(),
  whyItMatters: z.string(),
  example: z.string(),
  howToImprove: z.array(z.string()),
});

export const questionAnalysisSchema = z.object({
  order: z.number(),
  question: z.string(),
  candidateAnswer: z.string(),
  score: z.number(),
  whatWentWell: z.string(),
  whatWasMissing: z.string(),
  betterApproach: z.string(),
  strongAnswerIncludes: z.array(z.string()),
});

export const communicationAnalysisSchema = z.object({
  clarity: z.string(),
  structure: z.string(),
  conciseness: z.string(),
  fillerWords: z.string(),
  storytelling: z.string(),
  starUsage: z.string(),
  technicalExplanation: z.string(),
  suggestion: z.string(),
});

export const technicalAnalysisSchema = z.object({
  summary: z.string(),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  recommendation: z.string(),
});

export const resumeConsistencySchema = z.object({
  supportedClaims: z.array(z.string()),
  needsClarification: z.array(z.string()),
  listedButNotDemonstrated: z.array(z.string()),
  demonstratedBeyondResume: z.array(z.string()),
  summary: z.string(),
});

export const improvementDaySchema = z.object({
  day: z.number(),
  title: z.string(),
  focus: z.string(),
});

export const finalReportSchema = z.object({
  overallScore: z.number(),
  scores: z.object({
    technical: z.number(),
    communication: z.number(),
    problemSolving: z.number(),
    confidence: z.number(),
    roleKnowledge: z.number(),
    behavioral: z.number(),
    resumeKnowledge: z.number(),
  }),
  readiness: z.string(),
  readinessPercent: z.number(),
  readinessReason: z.string(),
  executiveSummary: z.string(),
  strengths: z.array(strengthSchema),
  weaknesses: z.array(weaknessSchema),
  questionAnalysis: z.array(questionAnalysisSchema),
  communicationAnalysis: communicationAnalysisSchema,
  technicalAnalysis: technicalAnalysisSchema,
  resumeConsistency: resumeConsistencySchema,
  recommendations: z.array(z.string()),
  improvementPlan: z.array(improvementDaySchema),
  finalRecommendation: z.string(),
});

export type FinalReport = z.infer<typeof finalReportSchema>;

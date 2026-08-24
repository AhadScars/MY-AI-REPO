import { prisma } from "./db";
import { ApiError } from "./errors";
import { grokJson } from "./grok";
import {
  finalReportJsonSchema,
  internalAnalysisJsonSchema,
  interviewTurnJsonSchema,
} from "./json-schema";
import { ANALYZE_RESUME_SYSTEM, interviewerSystemPrompt, REPORT_SYSTEM } from "./prompts";
import {
  finalReportSchema,
  internalAnalysisSchema,
  interviewTurnSchema,
  parsedResumeSchema,
  type ParsedResume,
} from "./schemas";
import { reportFromFinal } from "./serializers";
import { questionCountForDuration, TOPIC_SETS } from "./constants";
import { clampScore, readinessFromScore, safeJson } from "./utils";

function loadParsed(raw: string): ParsedResume {
  return parsedResumeSchema.parse(safeJson(raw, {}));
}

async function loadOwnedInterview(id: string, userId: string) {
  const interview = await prisma.interview.findFirst({
    where: { id, userId },
    include: {
      resume: true,
      questions: { include: { answers: true }, orderBy: { order: "asc" } },
      report: true,
    },
  });
  if (!interview) throw new ApiError(404, "Interview not found.", "not_found");
  return interview;
}

export async function analyzeAndCreateInterview(input: {
  userId: string;
  resumeId: string;
  role: string;
  company?: string | null;
  experienceLevel: string;
  interviewType: string;
  difficulty: string;
  duration: number;
  style: string;
  parsedData?: ParsedResume;
}) {
  const resume = await prisma.resume.findFirst({
    where: { id: input.resumeId, userId: input.userId },
  });
  if (!resume) throw new ApiError(404, "Resume not found.", "not_found");

  if (input.parsedData) {
    await prisma.resume.update({
      where: { id: resume.id },
      data: { parsedData: JSON.stringify(input.parsedData) },
    });
    resume.parsedData = JSON.stringify(input.parsedData);
  }

  const parsed = loadParsed(resume.parsedData);
  const topics = [...(TOPIC_SETS[input.interviewType] ?? TOPIC_SETS.mixed)];
  const totalQuestions = questionCountForDuration(input.duration);

  const analysis = await grokJson({
    schemaName: "internal_analysis",
    jsonSchema: internalAnalysisJsonSchema as unknown as Record<string, unknown>,
    zodSchema: internalAnalysisSchema,
    system: ANALYZE_RESUME_SYSTEM,
    temperature: 0.3,
    user: JSON.stringify({
      role: input.role,
      company: input.company || null,
      experienceLevel: input.experienceLevel,
      interviewType: input.interviewType,
      difficulty: input.difficulty,
      style: input.style,
      topics,
      parsedResume: parsed,
      resumeText: resume.rawText.slice(0, 14000),
    }),
  });

  const opening = analysis.openingQuestion.trim();
  if (!opening) {
    throw new ApiError(502, "Could not prepare the interview. Please retry.", "ai_invalid");
  }

  const remaining = topics.filter((t) => t.toLowerCase() !== analysis.openingTopic.toLowerCase());

  const interview = await prisma.interview.create({
    data: {
      userId: input.userId,
      resumeId: resume.id,
      role: input.role,
      company: input.company || null,
      experienceLevel: input.experienceLevel,
      interviewType: input.interviewType,
      difficulty: input.difficulty,
      duration: input.duration,
      style: input.style,
      status: "ready",
      currentQuestion: 1,
      totalQuestions,
      topicsCovered: JSON.stringify([analysis.openingTopic || topics[0]]),
      topicsRemaining: JSON.stringify(remaining),
      internalAnalysis: JSON.stringify(analysis),
      questions: {
        create: {
          question: opening,
          category: analysis.openingType || "resume",
          difficulty: input.difficulty,
          order: 1,
          reason: "Opening question based on resume and target role.",
        },
      },
    },
    include: {
      resume: true,
      questions: { include: { answers: true }, orderBy: { order: "asc" } },
    },
  });

  return interview;
}

export async function startInterview(id: string, userId: string) {
  const interview = await loadOwnedInterview(id, userId);
  if (interview.status === "completed") {
    throw new ApiError(400, "This interview is already complete.", "completed");
  }
  if (interview.status === "in_progress" && interview.startedAt) {
    return interview;
  }
  return prisma.interview.update({
    where: { id: interview.id },
    data: { status: "in_progress", startedAt: interview.startedAt ?? new Date() },
    include: {
      resume: true,
      questions: { include: { answers: true }, orderBy: { order: "asc" } },
    },
  });
}

export async function submitAnswer(id: string, userId: string, answer: string, skipped = false) {
  const interview = await loadOwnedInterview(id, userId);
  if (interview.status !== "in_progress") {
    throw new ApiError(400, "Start the interview before answering.", "not_started");
  }

  const current = interview.questions.find((q) => q.order === interview.currentQuestion);
  if (!current) throw new ApiError(400, "No active question.", "no_question");

  const alreadyHasNext = interview.questions.some((q) => q.order > current.order);
  let saved = current.answers.at(-1);
  if (saved && alreadyHasNext) {
    throw new ApiError(409, "This question was already answered.", "already_answered");
  }
  if (!saved) {
    saved = await prisma.interviewAnswer.create({
      data: {
        questionId: current.id,
        answer: skipped ? "" : answer.trim(),
        skipped,
      },
    });
  }

  const parsed = loadParsed(interview.resume.parsedData);
  const history = interview.questions
    .filter((q) => q.answers.length > 0 || q.id === current.id)
    .map((q) => {
      const a = q.id === current.id ? saved : q.answers.at(-1);
      return {
        order: q.order,
        question: q.question,
        answer: a?.skipped ? "[skipped]" : a?.answer ?? "",
      };
    });

  const topicsCovered = safeJson<string[]>(interview.topicsCovered, []);
  const topicsRemaining = safeJson<string[]>(interview.topicsRemaining, []);
  const answeredCount = history.length;
  const shouldWindDown = answeredCount >= interview.totalQuestions - 1;

  try {
    const turn = await grokJson({
      schemaName: "interview_turn",
      jsonSchema: interviewTurnJsonSchema as unknown as Record<string, unknown>,
      zodSchema: interviewTurnSchema,
      system: interviewerSystemPrompt({
        resume: parsed,
        resumeText: interview.resume.rawText,
        role: interview.role,
        experienceLevel: interview.experienceLevel,
        interviewType: interview.interviewType,
        difficulty: interview.difficulty,
        style: interview.style,
        company: interview.company,
        duration: interview.duration,
        totalQuestions: interview.totalQuestions,
        topicsRemaining,
        analysis: safeJson(interview.internalAnalysis, {}),
      }),
      temperature: 0.45,
      user: JSON.stringify({
        interviewHistory: history,
        latestAnswer: skipped ? "[The candidate skipped this question.]" : answer.trim(),
        currentQuestionNumber: interview.currentQuestion,
        totalQuestionBudget: interview.totalQuestions,
        topicsCovered,
        topicsRemaining,
        forceComplete: shouldWindDown && !skipped ? false : shouldWindDown,
      }),
    });

    if (turn.evaluation) {
      await prisma.interviewAnswer.update({
        where: { id: saved.id },
        data: {
          score: clampScore(turn.evaluation.overall),
          evaluation: JSON.stringify(turn.evaluation),
        },
      });
    }

    const complete =
      turn.interviewComplete ||
      answeredCount >= interview.totalQuestions ||
      (!turn.nextQuestion.trim() && shouldWindDown);

    const nextTopic = turn.topic || topicsRemaining[0] || "Closing";
    const nextCovered = topicsCovered.includes(nextTopic) ? topicsCovered : [...topicsCovered, nextTopic];
    const nextRemaining = topicsRemaining.filter((t) => t.toLowerCase() !== nextTopic.toLowerCase());

    if (complete) {
      await prisma.interview.update({
        where: { id: interview.id },
        data: {
          topicsCovered: JSON.stringify(nextCovered),
          topicsRemaining: JSON.stringify(nextRemaining),
        },
      });
      return { saved: true, complete: true, interview: await loadOwnedInterview(id, userId) };
    }

    const nextOrder = interview.currentQuestion + 1;
    await prisma.$transaction([
      prisma.interviewQuestion.create({
        data: {
          interviewId: interview.id,
          question: turn.nextQuestion.trim(),
          category: turn.questionType || "technical",
          difficulty: turn.difficulty || interview.difficulty,
          order: nextOrder,
          reason: turn.reason || turn.followUpFocus,
        },
      }),
      prisma.interview.update({
        where: { id: interview.id },
        data: {
          currentQuestion: nextOrder,
          topicsCovered: JSON.stringify(nextCovered),
          topicsRemaining: JSON.stringify(nextRemaining),
        },
      }),
    ]);

    return { saved: true, complete: false, interview: await loadOwnedInterview(id, userId) };
  } catch (err) {
    if (err instanceof ApiError) {
      return {
        saved: true,
        complete: false,
        retryable: true,
        error: err.message,
        interview: await loadOwnedInterview(id, userId),
      };
    }
    throw err;
  }
}

export async function completeInterview(id: string, userId: string) {
  const interview = await loadOwnedInterview(id, userId);
  if (interview.status === "completed" && interview.report) {
    return interview;
  }

  const transcript = interview.questions.map((q) => ({
    order: q.order,
    question: q.question,
    category: q.category,
    answer: q.answers.at(-1)?.skipped ? "[skipped]" : q.answers.at(-1)?.answer ?? "",
    score: q.answers.at(-1)?.score ?? null,
  }));

  if (transcript.every((t) => !t.answer || t.answer === "[skipped]")) {
    throw new ApiError(400, "Answer at least one question before generating a report.", "empty");
  }

  const parsed = loadParsed(interview.resume.parsedData);
  const reportData = await grokJson({
    schemaName: "final_report",
    jsonSchema: finalReportJsonSchema as unknown as Record<string, unknown>,
    zodSchema: finalReportSchema,
    system: REPORT_SYSTEM,
    temperature: 0.3,
    user: JSON.stringify({
      candidateName: parsed.name || "Candidate",
      role: interview.role,
      company: interview.company,
      experienceLevel: interview.experienceLevel,
      interviewType: interview.interviewType,
      difficulty: interview.difficulty,
      style: interview.style,
      duration: interview.duration,
      resume: parsed,
      resumeText: interview.resume.rawText.slice(0, 10000),
      transcript,
      internalNotes: safeJson(interview.internalAnalysis, {}),
    }),
  });

  const readiness = reportData.readiness || readinessFromScore(reportData.overallScore).label;
  reportData.readiness = readiness;
  reportData.readinessPercent = clampScore(reportData.readinessPercent || reportData.overallScore);
  reportData.overallScore = clampScore(reportData.overallScore);

  const savedReport = reportFromFinal(reportData);

  await prisma.$transaction([
    prisma.interviewReport.upsert({
      where: { interviewId: interview.id },
      create: { interviewId: interview.id, ...savedReport },
      update: savedReport,
    }),
    prisma.interview.update({
      where: { id: interview.id },
      data: {
        status: "completed",
        completedAt: interview.completedAt ?? new Date(),
        overallScore: savedReport.overallScore,
      },
    }),
  ]);

  return loadOwnedInterview(id, userId);
}

export async function getOwnedInterview(id: string, userId: string) {
  return loadOwnedInterview(id, userId);
}

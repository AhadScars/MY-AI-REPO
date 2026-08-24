import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/errors";
import { deltaPercent, interviewTypeLabel } from "@/lib/utils";

function avg(nums: number[]) {
  if (!nums.length) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

export async function GET() {
  try {
    const user = await requireUser();
    const interviews = await prisma.interview.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { report: true },
    });

    const completed = interviews.filter((i) => i.status === "completed" && i.report);
    const reports = completed.map((i) => i.report!).filter(Boolean);
    const latest = reports[0];
    const previous = reports[1];
    const first = reports.at(-1);

    const improvement = latest && first && reports.length > 1 ? deltaPercent(latest.overallScore, first.overallScore) : 0;

    return jsonOk({
      user,
      stats: {
        interviewsCompleted: completed.length,
        averageScore: avg(reports.map((r) => r.overallScore)),
        technicalScore: avg(reports.map((r) => r.technicalScore)),
        communicationScore: avg(reports.map((r) => r.communicationScore)),
        confidenceScore: avg(reports.map((r) => r.confidenceScore)),
        interviewReadiness: latest?.readinessPercent ?? 0,
        readinessLabel: latest?.readiness ?? "No interviews yet",
        improvement: improvement ?? 0,
        lastDelta: latest && previous ? deltaPercent(latest.overallScore, previous.overallScore) : null,
      },
      recent: interviews.slice(0, 6).map((item) => ({
        id: item.id,
        role: item.role,
        company: item.company,
        interviewType: item.interviewType,
        interviewTypeLabel: interviewTypeLabel(item.interviewType),
        status: item.status,
        overallScore: item.overallScore,
        createdAt: item.createdAt,
        completedAt: item.completedAt,
        technical: item.report?.technicalScore ?? null,
        communication: item.report?.communicationScore ?? null,
        confidence: item.report?.confidenceScore ?? null,
      })),
    });
  } catch (err) {
    return jsonError(err);
  }
}

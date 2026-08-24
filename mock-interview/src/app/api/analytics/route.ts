import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/errors";

export async function GET() {
  try {
    const user = await requireUser();
    const interviews = await prisma.interview.findMany({
      where: { userId: user.id, status: "completed", report: { isNot: null } },
      orderBy: { completedAt: "asc" },
      include: { report: true },
    });

    const series = interviews.map((item, index) => ({
      index: index + 1,
      id: item.id,
      role: item.role,
      date: item.completedAt ?? item.createdAt,
      overall: item.report!.overallScore,
      technical: item.report!.technicalScore,
      communication: item.report!.communicationScore,
      confidence: item.report!.confidenceScore,
      behavioral: item.report!.behavioralScore,
      problemSolving: item.report!.problemSolvingScore,
    }));

    const last = series.at(-1);
    const prev3 = series.slice(-4, -1);
    const commDelta =
      last && prev3.length
        ? Math.round(last.communication - prev3.reduce((a, p) => a + p.communication, 0) / prev3.length)
        : null;

    return jsonOk({ series, insight: commDelta != null ? { communicationDelta: commDelta } : null });
  } catch (err) {
    return jsonError(err);
  }
}

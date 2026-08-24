import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/errors";
import { deltaPercent, interviewTypeLabel } from "@/lib/utils";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role") || undefined;
    const type = searchParams.get("type") || undefined;
    const minScore = searchParams.get("minScore");

    const interviews = await prisma.interview.findMany({
      where: {
        userId: user.id,
        ...(role ? { role: { contains: role } } : {}),
        ...(type ? { interviewType: type } : {}),
        ...(minScore ? { overallScore: { gte: Number(minScore) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: { report: true },
    });

    const completed = interviews.filter((i) => i.overallScore != null);
    const items = interviews.map((item, index) => {
      const previous = completed.find((c) => c.createdAt < item.createdAt && c.overallScore != null);
      return {
        id: item.id,
        role: item.role,
        company: item.company,
        interviewType: item.interviewType,
        interviewTypeLabel: interviewTypeLabel(item.interviewType),
        difficulty: item.difficulty,
        status: item.status,
        overallScore: item.overallScore,
        createdAt: item.createdAt,
        completedAt: item.completedAt,
        delta: item.overallScore != null ? deltaPercent(item.overallScore, previous?.overallScore) : null,
        index: interviews.length - index,
      };
    });

    return jsonOk({ interviews: items });
  } catch (err) {
    return jsonError(err);
  }
}

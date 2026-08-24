import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ApiError, jsonError, jsonOk } from "@/lib/errors";
import { parseResumeWithGrok, heuristicParse } from "@/lib/resume";
import { publicResume } from "@/lib/serializers";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as { resumeId?: string };
    if (!body.resumeId) throw new ApiError(400, "resumeId is required.");
    const resume = await prisma.resume.findFirst({
      where: { id: body.resumeId, userId: user.id },
    });
    if (!resume) throw new ApiError(404, "Resume not found.");

    const seed = heuristicParse(resume.rawText);
    const parsed = await parseResumeWithGrok(resume.rawText, seed);
    const updated = await prisma.resume.update({
      where: { id: resume.id },
      data: { parsedData: JSON.stringify(parsed) },
    });
    return jsonOk({ resume: publicResume(updated) });
  } catch (err) {
    return jsonError(err);
  }
}

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ApiError, jsonError, jsonOk } from "@/lib/errors";
import { updateResumeSchema } from "@/lib/schemas";
import { publicResume } from "@/lib/serializers";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const resume = await prisma.resume.findFirst({ where: { id, userId: user.id } });
    if (!resume) throw new ApiError(404, "Resume not found.");
    const parsed = updateResumeSchema.parse(await request.json());
    const updated = await prisma.resume.update({
      where: { id: resume.id },
      data: { parsedData: JSON.stringify(parsed) },
    });
    return jsonOk({ resume: publicResume(updated) });
  } catch (err) {
    return jsonError(err);
  }
}

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ApiError, jsonError, jsonOk } from "@/lib/errors";
import { assertResumeFile, saveResumeFile } from "@/lib/files";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { extractResumeText, heuristicParse, parseResumeWithGrok } from "@/lib/resume";
import { publicResume } from "@/lib/serializers";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const limited = rateLimit(`${user.id}:upload`, 10, 60 * 60_000);
    if (!limited.ok) throw new ApiError(429, "Resume upload limit reached. Try again later.", "rate_limited");

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "Choose a resume file to upload.", "missing_file");

    const buf = Buffer.from(await file.arrayBuffer());
    assertResumeFile(file.name, buf);

    let rawText: string;
    try {
      rawText = await extractResumeText(file.name, buf);
    } catch (err) {
      throw new ApiError(400, err instanceof Error ? err.message : "Could not parse this resume.", "parse_failed");
    }

    const seed = heuristicParse(rawText);
    let parsed = seed;
    let grokWarning: string | undefined;
    try {
      parsed = await parseResumeWithGrok(rawText, seed);
    } catch (err) {
      console.warn("[resume] grok parse fallback", err);
      grokWarning = "We extracted your resume locally. You can edit any field before starting.";
    }

    const saved = await saveResumeFile(user.id, file.name, buf);
    const resume = await prisma.resume.create({
      data: {
        userId: user.id,
        fileName: file.name,
        fileUrl: saved.dest,
        mimeType: file.type || "application/octet-stream",
        rawText,
        parsedData: JSON.stringify(parsed),
      },
    });

    return jsonOk({ resume: publicResume(resume), warning: grokWarning }, 201);
  } catch (err) {
    return jsonError(err);
  }
}

import { requireUser } from "@/lib/auth";
import { ApiError, jsonError, jsonOk } from "@/lib/errors";
import { analyzeAndCreateInterview } from "@/lib/interview-service";
import { rateLimit } from "@/lib/rate-limit";
import { createInterviewSchema } from "@/lib/schemas";
import { publicInterview } from "@/lib/serializers";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const limited = rateLimit(`${user.id}:create-interview`, 20, 60 * 60_000);
    if (!limited.ok) throw new ApiError(429, "You have created too many interviews. Try again later.");

    const body = createInterviewSchema.parse(await request.json());
    const interview = await analyzeAndCreateInterview({
      userId: user.id,
      resumeId: body.resumeId,
      role: body.role,
      company: body.company || null,
      experienceLevel: body.experienceLevel,
      interviewType: body.interviewType,
      difficulty: body.difficulty,
      duration: body.duration,
      style: body.style,
      parsedData: body.parsedData,
    });
    return jsonOk({ interview: publicInterview(interview) }, 201);
  } catch (err) {
    return jsonError(err);
  }
}

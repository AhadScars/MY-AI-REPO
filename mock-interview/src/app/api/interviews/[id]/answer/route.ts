import { requireUser } from "@/lib/auth";
import { ApiError, jsonError, jsonOk } from "@/lib/errors";
import { submitAnswer } from "@/lib/interview-service";
import { rateLimit } from "@/lib/rate-limit";
import { answerSchema } from "@/lib/schemas";
import { publicInterview } from "@/lib/serializers";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const limited = rateLimit(`${user.id}:answer`, 30, 10 * 60_000);
    if (!limited.ok) throw new ApiError(429, "You are sending answers too quickly. Pause and retry.");

    const { id } = await params;
    const body = answerSchema.parse(await request.json());
    if (!body.skipped && !body.answer.trim()) {
      throw new ApiError(400, "Type an answer or skip this question.");
    }
    const result = await submitAnswer(id, user.id, body.answer, Boolean(body.skipped));
    return jsonOk({
      interview: publicInterview(result.interview),
      complete: result.complete,
      saved: result.saved,
      retryable: "retryable" in result ? result.retryable : false,
      error: "error" in result ? result.error : undefined,
    });
  } catch (err) {
    return jsonError(err);
  }
}

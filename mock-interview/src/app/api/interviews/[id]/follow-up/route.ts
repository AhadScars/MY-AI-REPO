import { requireUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/errors";
import { getOwnedInterview, submitAnswer } from "@/lib/interview-service";
import { publicInterview } from "@/lib/serializers";

/** Forces the interviewer to continue from the latest saved answer if a previous AI call failed. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const interview = await getOwnedInterview(id, user.id);
    const current = interview.questions.find((q) => q.order === interview.currentQuestion);
    const existing = current?.answers.at(-1);
    if (current && !existing) {
      return jsonOk({
        interview: publicInterview(interview),
        message: "Answer the current question first.",
      });
    }
    if (current && existing) {
      // Delete the extra answer marker so submitAnswer can run again? Better: if already answered, just return state.
      return jsonOk({ interview: publicInterview(interview), saved: true });
    }
    const lastAnswered = [...interview.questions].reverse().find((q) => q.answers.length > 0);
    if (!lastAnswered) {
      return jsonOk({ interview: publicInterview(interview) });
    }
    const result = await submitAnswer(id, user.id, lastAnswered.answers.at(-1)?.answer ?? "", false);
    return jsonOk({
      interview: publicInterview(result.interview),
      complete: result.complete,
      saved: result.saved,
    });
  } catch (err) {
    return jsonError(err);
  }
}

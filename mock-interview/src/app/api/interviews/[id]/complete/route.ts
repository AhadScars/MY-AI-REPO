import { requireUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/errors";
import { completeInterview } from "@/lib/interview-service";
import { publicInterview, publicReport } from "@/lib/serializers";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const interview = await completeInterview(id, user.id);
    return jsonOk({
      interview: publicInterview(interview, { revealScores: true }),
      report: interview.report ? publicReport(interview.report) : null,
    });
  } catch (err) {
    return jsonError(err);
  }
}

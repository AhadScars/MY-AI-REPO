import { requireUser } from "@/lib/auth";
import { ApiError, jsonError, jsonOk } from "@/lib/errors";
import { getOwnedInterview } from "@/lib/interview-service";
import { publicInterview, publicReport } from "@/lib/serializers";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const interview = await getOwnedInterview(id, user.id);
    if (!interview.report) throw new ApiError(404, "Report is not ready yet.");
    return jsonOk({
      interview: publicInterview(interview, { revealScores: true }),
      report: publicReport(interview.report),
    });
  } catch (err) {
    return jsonError(err);
  }
}

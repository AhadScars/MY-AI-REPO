import { requireUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/errors";
import { getOwnedInterview } from "@/lib/interview-service";
import { publicInterview } from "@/lib/serializers";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const interview = await getOwnedInterview(id, user.id);
    return jsonOk({ interview: publicInterview(interview) });
  } catch (err) {
    return jsonError(err);
  }
}

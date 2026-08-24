import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ApiError, jsonError } from "@/lib/errors";
import { getOwnedInterview } from "@/lib/interview-service";
import { buildReportPdf } from "@/lib/pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const interview = await getOwnedInterview(id, user.id);
    if (!interview.report) throw new ApiError(404, "Generate the report before downloading a PDF.");

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser) throw new ApiError(404, "User not found.");

    const pdf = await buildReportPdf({
      user: { name: dbUser.name, email: dbUser.email },
      interview,
      report: interview.report,
    });

    const filename = `prepwise-${interview.role.replace(/\s+/g, "-").toLowerCase()}-report.pdf`;
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}

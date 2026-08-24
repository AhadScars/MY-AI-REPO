import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getOwnedInterview } from "@/lib/interview-service";
import { publicReport } from "@/lib/serializers";
import { ReportView } from "./view";

export const metadata = { title: "Interview report" };

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }
  const { id } = await params;
  let interview;
  try {
    interview = await getOwnedInterview(id, user.id);
  } catch {
    notFound();
  }
  if (!interview.report) redirect(`/interview/${id}/complete`);

  return (
    <ReportView
      userName={user.name}
      userEmail={user.email}
      interview={{
        id: interview.id,
        role: interview.role,
        company: interview.company,
        experienceLevel: interview.experienceLevel,
        interviewType: interview.interviewType,
        difficulty: interview.difficulty,
        duration: interview.duration,
        completedAt: (interview.completedAt ?? interview.createdAt).toISOString(),
      }}
      report={publicReport(interview.report)}
    />
  );
}

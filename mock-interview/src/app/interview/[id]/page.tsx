import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getOwnedInterview } from "@/lib/interview-service";
import { InterviewRoom } from "./room";

export const metadata = { title: "Live interview" };

export default async function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
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
  if (interview.status === "completed") redirect(`/interview/${id}/complete`);
  if (interview.status === "ready") redirect(`/interview/${id}/lobby`);

  return (
    <InterviewRoom
      interviewId={id}
      userName={user.name}
      durationMinutes={interview.duration}
      startedAt={interview.startedAt?.toISOString() ?? new Date().toISOString()}
    />
  );
}

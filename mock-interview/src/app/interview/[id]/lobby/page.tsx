import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getOwnedInterview } from "@/lib/interview-service";
import { AppShell } from "@/components/app-shell";
import { ButtonLink, Card } from "@/components/ui";
import { DIFFICULTIES, EXPERIENCE_LEVELS, INTERVIEW_TYPES, labelFor } from "@/lib/constants";

export const metadata = { title: "Interview lobby" };

export default async function LobbyPage({ params }: { params: Promise<{ id: string }> }) {
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

  if (interview.status === "completed") redirect(`/interview/${id}/report`);
  if (interview.status === "in_progress") redirect(`/interview/${id}`);

  const rows = [
    ["Role", interview.role],
    ["Company", interview.company || "Not specified"],
    ["Interview type", labelFor(INTERVIEW_TYPES, interview.interviewType)],
    ["Difficulty", labelFor(DIFFICULTIES, interview.difficulty)],
    ["Duration", `${interview.duration} minutes`],
    ["Experience", labelFor(EXPERIENCE_LEVELS, interview.experienceLevel)],
    ["Questions", "AI-generated based on your resume"],
    ["Interviewer", "AI Interviewer"],
  ];

  return (
    <AppShell user={user}>
      <div className="mx-auto max-w-2xl">
        <p className="text-sm text-primary">Your interview is ready</p>
        <h1 className="mt-2 font-serif text-4xl text-navy">Your Interview Is Ready</h1>
        <p className="mt-3 text-slate-600">
          The interviewer may ask follow-up questions based on your answers.
        </p>
        <Card className="mt-8 divide-y divide-border">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between px-5 py-3 text-sm">
              <span className="text-slate-500">{label}</span>
              <span className="font-medium text-navy">{value}</span>
            </div>
          ))}
        </Card>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href={`/interview/${id}`}>Start Interview</ButtonLink>
          <ButtonLink href="/dashboard" variant="outline">
            Back to dashboard
          </ButtonLink>
        </div>
      </div>
    </AppShell>
  );
}

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { ButtonLink, Card, EmptyState, ScorePill } from "@/components/ui";
import { formatDate, interviewTypeLabel } from "@/lib/utils";
import { redirect } from "next/navigation";

function avg(nums: number[]) {
  if (!nums.length) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  let user;
  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }

  const interviews = await prisma.interview.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { report: true },
    take: 12,
  });
  const completed = interviews.filter((i) => i.report);
  const reports = completed.map((i) => i.report!);
  const first = reports.at(-1);
  const latest = reports[0];
  const improvement =
    latest && first && reports.length > 1
      ? Math.round(((latest.overallScore - first.overallScore) / Math.max(1, first.overallScore)) * 100)
      : 0;

  const stats = [
    { label: "Interviews completed", value: String(completed.length) },
    { label: "Average score", value: reports.length ? String(avg(reports.map((r) => r.overallScore))) : "—" },
    { label: "Technical", value: reports.length ? String(avg(reports.map((r) => r.technicalScore))) : "—" },
    { label: "Communication", value: reports.length ? String(avg(reports.map((r) => r.communicationScore))) : "—" },
    { label: "Confidence", value: reports.length ? String(avg(reports.map((r) => r.confidenceScore))) : "—" },
    { label: "Interview readiness", value: latest ? `${latest.readinessPercent}%` : "—" },
    { label: "Improvement", value: reports.length > 1 ? `${improvement > 0 ? "+" : ""}${improvement}%` : "—" },
  ];

  return (
    <AppShell user={user}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-primary">Welcome back, {user.name.split(" ")[0]}</p>
          <h1 className="mt-1 font-serif text-4xl text-navy">Ready for your next interview?</h1>
        </div>
        <ButtonLink href="/interview/new">Start New Interview</ButtonLink>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">{stat.label}</p>
            <p className="mt-2 font-serif text-3xl text-navy">{stat.value}</p>
          </Card>
        ))}
      </div>

      <h2 className="mt-10 text-lg font-semibold text-navy">Recent interviews</h2>
      {interviews.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No interviews yet."
            body="Your first mock interview is the beginning of your preparation journey."
            action={<ButtonLink href="/interview/new">Start Your First Interview</ButtonLink>}
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {interviews.map((item) => (
            <Card key={item.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-navy">{item.role}</h3>
                  <p className="text-sm text-slate-500">
                    {interviewTypeLabel(item.interviewType)}
                    {item.company ? ` · ${item.company}` : ""}
                  </p>
                </div>
                {item.overallScore != null ? <ScorePill score={item.overallScore} /> : (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{item.status.replace("_", " ")}</span>
                )}
              </div>
              {item.report ? (
                <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-xs text-slate-400">Technical</div>
                    <div className="font-medium">{item.report.technicalScore}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Communication</div>
                    <div className="font-medium">{item.report.communicationScore}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Confidence</div>
                    <div className="font-medium">{item.report.confidenceScore}</div>
                  </div>
                </div>
              ) : null}
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  {item.status === "completed" ? "Completed" : "Updated"} {formatDate(item.completedAt ?? item.createdAt)}
                </p>
                {item.status === "completed" ? (
                  <ButtonLink href={`/interview/${item.id}/report`} size="sm" variant="outline">
                    View Report
                  </ButtonLink>
                ) : item.status === "in_progress" ? (
                  <ButtonLink href={`/interview/${item.id}`} size="sm">
                    Resume
                  </ButtonLink>
                ) : (
                  <ButtonLink href={`/interview/${item.id}/lobby`} size="sm">
                    Continue
                  </ButtonLink>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}

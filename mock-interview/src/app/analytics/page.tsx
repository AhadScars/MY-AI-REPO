import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { Card, EmptyState, ButtonLink } from "@/components/ui";
import { LineChart } from "@/components/charts";

export const metadata = { title: "Progress" };

export default async function AnalyticsPage() {
  let user;
  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }

  const interviews = await prisma.interview.findMany({
    where: { userId: user.id, status: "completed", report: { isNot: null } },
    orderBy: { completedAt: "asc" },
    include: { report: true },
  });
  const series = interviews.map((item) => item.report!);
  const last = series.at(-1);
  const prev3 = series.slice(-4, -1);
  const commDelta =
    last && prev3.length
      ? Math.round(last.communicationScore - prev3.reduce((a, p) => a + p.communicationScore, 0) / prev3.length)
      : null;

  return (
    <AppShell user={user}>
      <h1 className="font-serif text-4xl text-navy">Interview performance</h1>
      <p className="mt-2 text-slate-600">Track how your scores move across mock interviews.</p>

      {series.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No completed interviews yet"
            body="Complete a mock interview to start a performance history."
            action={<ButtonLink href="/interview/new">Start Your First Interview</ButtonLink>}
          />
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {commDelta != null ? (
            <Card className="p-5 text-sm text-slate-700">
              Your communication score {commDelta >= 0 ? "improved" : "changed"} by {Math.abs(commDelta)} points
              over your last {prev3.length} interview{prev3.length === 1 ? "" : "s"}.
            </Card>
          ) : null}
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-navy">Overall score</h2>
            <LineChart points={series.map((s) => s.overallScore)} label="Overall score over time" />
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-navy">Technical</h2>
              <LineChart points={series.map((s) => s.technicalScore)} label="Technical score" />
            </Card>
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-navy">Communication</h2>
              <LineChart points={series.map((s) => s.communicationScore)} label="Communication score" />
            </Card>
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-navy">Confidence</h2>
              <LineChart points={series.map((s) => s.confidenceScore)} label="Confidence score" />
            </Card>
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-navy">Problem solving</h2>
              <LineChart points={series.map((s) => s.problemSolvingScore)} label="Problem solving score" />
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  );
}

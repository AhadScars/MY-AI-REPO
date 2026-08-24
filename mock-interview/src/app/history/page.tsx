import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { HistoryClient } from "./client";

export const metadata = { title: "Interview history" };

export default async function HistoryPage() {
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
  });
  const completed = interviews.filter((i) => i.overallScore != null);
  const items = interviews.map((item) => {
    const previous = completed.find((c) => c.createdAt < item.createdAt && c.overallScore != null);
    const delta =
      item.overallScore != null && previous?.overallScore
        ? Math.round(((item.overallScore - previous.overallScore) / previous.overallScore) * 100)
        : null;
    return {
      id: item.id,
      role: item.role,
      company: item.company,
      interviewType: item.interviewType,
      status: item.status,
      overallScore: item.overallScore,
      createdAt: item.createdAt.toISOString(),
      delta,
    };
  });
  return (
    <AppShell user={user}>
      <HistoryClient interviews={items} />
    </AppShell>
  );
}

"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button, ButtonLink, Card } from "@/components/ui";
import { RadarChart, ScoreRing } from "@/components/charts";
import type { PublicReport } from "@/lib/types";
import { formatDate, interviewTypeLabel } from "@/lib/utils";

export function ReportView({
  userName,
  userEmail,
  interview,
  report,
}: {
  userName: string;
  userEmail: string;
  interview: {
    id: string;
    role: string;
    company: string | null;
    experienceLevel: string;
    interviewType: string;
    difficulty: string;
    duration: number;
    completedAt: string;
  };
  report: PublicReport;
}) {
  const [score, setScore] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setScore(report.overallScore);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 900);
      setScore(Math.round(report.overallScore * t));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [report.overallScore]);

  async function downloadPdf() {
    setDownloading(true);
    setDownloadError(null);
    try {
      const res = await fetch(`/api/interviews/${interview.id}/report/pdf`, { credentials: "include" });
      if (!res.ok) throw new Error("Preparing your professional report failed. Please retry.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `prepwise-${interview.role.replace(/\s+/g, "-").toLowerCase()}-report.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "PDF generation failed.");
    } finally {
      setDownloading(false);
    }
  }

  const categories = [
    { label: "Technical", value: report.scores.technical },
    { label: "Problem solving", value: report.scores.problemSolving },
    { label: "Communication", value: report.scores.communication },
    { label: "Confidence", value: report.scores.confidence },
    { label: "Role knowledge", value: report.scores.roleKnowledge },
    { label: "Behavioral", value: report.scores.behavioral },
    { label: "Resume", value: report.scores.resumeKnowledge },
  ];

  return (
    <AppShell user={{ name: userName, email: userEmail }}>
      <article className="mx-auto max-w-4xl bg-white">
        <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">AI Mock Interview Assessment</p>
            <h1 className="mt-2 font-serif text-4xl text-navy">{interview.role}</h1>
            <p className="mt-2 text-sm text-slate-500">
              {userName} · {interviewTypeLabel(interview.interviewType)} · {formatDate(interview.completedAt)}
              {interview.company ? ` · ${interview.company}` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={downloadPdf} disabled={downloading}>
              {downloading ? "Preparing your professional report…" : "Download PDF Report"}
            </Button>
            <ButtonLink href={`/interview/new`} variant="outline">
              Retake Interview
            </ButtonLink>
          </div>
        </header>
        {downloadError ? <p className="mt-3 text-sm text-danger">{downloadError}</p> : null}

        <section className="grid gap-6 py-8 md:grid-cols-[auto_1fr]">
          <ScoreRing score={score} />
          <div>
            <h2 className="font-serif text-2xl text-navy">Executive summary</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{report.executiveSummary}</p>
            <div className="mt-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Interview readiness</p>
              <div className="mt-2 progress-bar">
                <span style={{ width: `${report.readinessPercent}%` }} />
              </div>
              <p className="mt-2 text-sm font-medium text-navy">
                {report.readinessPercent}% · {report.readiness.toUpperCase()}
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 border-t border-border py-8 md:grid-cols-2">
          <div>
            <h2 className="font-serif text-2xl text-navy">Category scores</h2>
            <div className="mt-4 space-y-3">
              {categories.map((item) => (
                <div key={item.label}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{item.label}</span>
                    <span className="font-medium">{item.value}</span>
                  </div>
                  <div className="progress-bar">
                    <span style={{ width: `${item.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="h-72">
            <RadarChart values={categories} />
          </div>
        </section>

        <section className="border-t border-border py-8">
          <h2 className="font-serif text-2xl text-navy">Strengths</h2>
          <div className="mt-4 space-y-4">
            {report.strengths.map((item) => (
              <Card key={item.title} className="border-l-4 border-l-emerald-600 p-4 shadow-none">
                <h3 className="font-semibold text-navy">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-700">{item.detail}</p>
                <p className="mt-2 text-xs text-slate-500">Evidence: {item.evidence}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="border-t border-border py-8">
          <h2 className="font-serif text-2xl text-navy">Areas for improvement</h2>
          <div className="mt-4 space-y-4">
            {report.weaknesses.map((item) => (
              <Card key={item.title} className="border-l-4 border-l-amber-500 p-4 shadow-none">
                <h3 className="font-semibold text-navy">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  <strong>What happened.</strong> {item.whatHappened}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  <strong>Why it matters.</strong> {item.whyItMatters}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  <strong>Example.</strong> {item.example}
                </p>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {item.howToImprove.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </section>

        <section className="border-t border-border py-8">
          <h2 className="font-serif text-2xl text-navy">Question analysis</h2>
          <div className="mt-4 space-y-5">
            {report.questionAnalysis.map((q) => (
              <Card key={q.order} className="p-5 shadow-none">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-navy">Question {q.order}</h3>
                  <span className="text-sm font-medium text-primary">{q.score}/100</span>
                </div>
                <p className="mt-2 text-sm italic text-slate-600">“{q.question}”</p>
                <p className="mt-3 text-sm text-slate-700">
                  <strong>Your answer.</strong> {q.candidateAnswer}
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  <strong>What you did well.</strong> {q.whatWentWell}
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  <strong>What was missing.</strong> {q.whatWasMissing}
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  <strong>Better approach.</strong> {q.betterApproach}
                </p>
                {q.strongAnswerIncludes?.length ? (
                  <div className="mt-3 rounded-xl bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      What a strong answer should include
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                      {q.strongAnswerIncludes.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        </section>

        <section className="border-t border-border py-8">
          <h2 className="font-serif text-2xl text-navy">Communication assessment</h2>
          <p className="mt-3 text-sm leading-7 text-slate-700">{report.communicationAnalysis.suggestion}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {Object.entries({
              Clarity: report.communicationAnalysis.clarity,
              Structure: report.communicationAnalysis.structure,
              Conciseness: report.communicationAnalysis.conciseness,
              "Filler words": report.communicationAnalysis.fillerWords,
              Storytelling: report.communicationAnalysis.storytelling,
              "STAR method": report.communicationAnalysis.starUsage,
              "Technical explanation": report.communicationAnalysis.technicalExplanation,
            }).map(([k, v]) => (
              <div key={k} className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{k}</p>
                <p className="mt-1 text-sm text-slate-700">{v}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-border py-8">
          <h2 className="font-serif text-2xl text-navy">Technical assessment</h2>
          <p className="mt-3 text-sm leading-7 text-slate-700">{report.technicalAnalysis.summary}</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-semibold text-emerald-700">Strengths</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {report.technicalAnalysis.strengths.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-700">Gaps</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {report.technicalAnalysis.gaps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-700">{report.technicalAnalysis.recommendation}</p>
        </section>

        <section className="border-t border-border py-8">
          <h2 className="font-serif text-2xl text-navy">Resume assessment</h2>
          <p className="mt-3 text-sm leading-7 text-slate-700">{report.resumeConsistency.summary}</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <ListBlock title="Strongly supported" items={report.resumeConsistency.supportedClaims} />
            <ListBlock title="May benefit from clearer explanation" items={report.resumeConsistency.needsClarification} />
            <ListBlock title="Listed but not demonstrated" items={report.resumeConsistency.listedButNotDemonstrated} />
            <ListBlock title="Demonstrated beyond the resume" items={report.resumeConsistency.demonstratedBeyondResume} />
          </div>
        </section>

        <section className="border-t border-border py-8">
          <h2 className="font-serif text-2xl text-navy">Recommended preparation</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {report.recommendations.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>

        <section className="border-t border-border py-8">
          <h2 className="font-serif text-2xl text-navy">7-day improvement plan</h2>
          <ol className="mt-4 space-y-3">
            {report.improvementPlan.map((day) => (
              <li key={day.day} className="grid gap-1 rounded-xl border border-border p-4 sm:grid-cols-[80px_1fr]">
                <div className="text-sm font-semibold text-primary">Day {day.day}</div>
                <div>
                  <div className="font-medium text-navy">{day.title}</div>
                  <p className="mt-1 text-sm text-slate-600">{day.focus}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-t border-border py-8">
          <h2 className="font-serif text-2xl text-navy">Final recommendation</h2>
          <p className="mt-3 text-sm leading-7 text-slate-700">{report.finalRecommendation}</p>
        </section>
      </article>
    </AppShell>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="text-sm font-semibold text-navy">{title}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

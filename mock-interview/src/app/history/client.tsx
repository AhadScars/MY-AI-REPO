"use client";

import { useMemo, useState } from "react";
import { ButtonLink, Card, EmptyState, Input, Select } from "@/components/ui";
import { INTERVIEW_TYPES } from "@/lib/constants";
import { formatDate, interviewTypeLabel } from "@/lib/utils";

type Item = {
  id: string;
  role: string;
  company: string | null;
  interviewType: string;
  status: string;
  overallScore: number | null;
  createdAt: string;
  delta: number | null;
};

export function HistoryClient({ interviews }: { interviews: Item[] }) {
  const [role, setRole] = useState("");
  const [type, setType] = useState("");
  const [minScore, setMinScore] = useState("");

  const filtered = useMemo(() => {
    return interviews.filter((item) => {
      if (role && !item.role.toLowerCase().includes(role.toLowerCase())) return false;
      if (type && item.interviewType !== type) return false;
      if (minScore && (item.overallScore ?? -1) < Number(minScore)) return false;
      return true;
    });
  }, [interviews, role, type, minScore]);

  return (
    <div>
      <h1 className="font-serif text-4xl text-navy">Interview history</h1>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Input placeholder="Filter by role" value={role} onChange={(e) => setRole(e.target.value)} />
        <Select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All interview types</option>
          {INTERVIEW_TYPES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </Select>
        <Select value={minScore} onChange={(e) => setMinScore(e.target.value)}>
          <option value="">Any score</option>
          <option value="70">70+</option>
          <option value="80">80+</option>
          <option value="90">90+</option>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No matching interviews"
            body="Try a different filter, or sit your first mock interview."
            action={<ButtonLink href="/interview/new">Start New Interview</ButtonLink>}
          />
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {filtered.map((item) => (
            <Card key={item.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-navy">{item.role}</h2>
                <p className="text-sm text-slate-500">
                  {interviewTypeLabel(item.interviewType)}
                  {item.company ? ` · ${item.company}` : ""}
                </p>
                <p className="mt-1 text-xs text-slate-400">{formatDate(item.createdAt)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {item.overallScore != null ? (
                  <div className="text-right">
                    <div className="font-serif text-3xl text-navy">{item.overallScore}/100</div>
                    {item.delta != null ? (
                      <div className={`text-xs ${item.delta >= 0 ? "text-emerald-700" : "text-amber-700"}`}>
                        {item.delta >= 0 ? "↑" : "↓"} {Math.abs(item.delta)}% from previous interview
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-sm capitalize text-slate-500">{item.status.replace("_", " ")}</span>
                )}
                {item.status === "completed" ? (
                  <ButtonLink href={`/interview/${item.id}/report`} variant="outline" size="sm">
                    View Report
                  </ButtonLink>
                ) : (
                  <ButtonLink href={item.status === "in_progress" ? `/interview/${item.id}` : `/interview/${item.id}/lobby`} size="sm">
                    Resume
                  </ButtonLink>
                )}
                <ButtonLink href="/interview/new" variant="ghost" size="sm">
                  Retake Interview
                </ButtonLink>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

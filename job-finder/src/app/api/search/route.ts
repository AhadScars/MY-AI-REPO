import { NextResponse } from "next/server";
import { isRelevantJob, titleNeedles } from "@/lib/relevance";
import { scoreJob } from "@/lib/score";
import { fetchAllJobs } from "@/lib/sources";
import type { Requirements, ScoredJob } from "@/lib/types";
import { emptyRequirements } from "@/lib/types";

export const dynamic = "force-dynamic";

const cache = new Map<string, { at: number; body: unknown }>();
const TTL_MS = 3 * 60 * 1000;

export async function POST(req: Request) {
  try {
    const incoming = (await req.json()) as Partial<Requirements>;
    const requirements = normalizeReq(incoming);
    if (!requirements.title.trim() && requirements.skills.length === 0) {
      return NextResponse.json(
        { error: "Add a target role or at least one skill." },
        { status: 400 },
      );
    }

    const key = JSON.stringify(requirements);
    const cached = cache.get(key);
    if (cached && Date.now() - cached.at < TTL_MS) {
      return NextResponse.json(cached.body);
    }

    const needles = titleNeedles(requirements);
    if (!needles.length) {
      return NextResponse.json(
        {
          error:
            "Be more specific — add a role like “Frontend Developer” or at least one skill. “Software Engineer” alone matches almost everything.",
        },
        { status: 400 },
      );
    }

    const { jobs, sources } = await fetchAllJobs(requirements);
    const relevant = jobs.filter((job) => isRelevantJob(job, requirements));
    const scored = relevant
      .map((job) => scoreJob(job, requirements))
      .filter((job): job is ScoredJob => Boolean(job))
      .sort((a, b) => b.score - a.score || compareDate(b.publishedAt, a.publishedAt));

    const body = {
      jobs: scored.slice(0, 80),
      total: scored.length,
      scanned: jobs.length,
      sources,
      searchedAt: new Date().toISOString(),
    };
    cache.set(key, { at: Date.now(), body });
    return NextResponse.json(body);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search failed" },
      { status: 500 },
    );
  }
}

function normalizeReq(raw: Partial<Requirements>): Requirements {
  const base = emptyRequirements();
  return {
    ...base,
    title: String(raw.title || "").slice(0, 80),
    skills: asList(raw.skills),
    location: String(raw.location || "").slice(0, 80),
    workMode: raw.workMode || "any",
    jobType: raw.jobType || "any",
    seniority: raw.seniority || "any",
    minSalary: typeof raw.minSalary === "number" && raw.minSalary > 0 ? raw.minSalary : null,
    mustHaves: asList(raw.mustHaves),
    dealBreakers: asList(raw.dealBreakers),
    notes: String(raw.notes || "").slice(0, 500),
  };
}

function asList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v).trim()).filter(Boolean).slice(0, 20);
}

function compareDate(a?: string, b?: string) {
  return (Date.parse(a || "") || 0) - (Date.parse(b || "") || 0);
}

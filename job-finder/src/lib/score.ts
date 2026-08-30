import { inferSeniority } from "./infer";
import { hasTerm, rolesCompatible } from "./relevance";
import { includesPhrase, normalize, tokens } from "./text";
import type { Job, Requirements, ScoredJob, Seniority } from "./types";

const WEIGHTS = {
  title: 28,
  skills: 26,
  location: 14,
  jobType: 8,
  seniority: 8,
  salary: 8,
  mustHaves: 8,
};

const SENIORITY_RANK: Record<Exclude<Seniority, "any">, number> = {
  intern: 0,
  junior: 1,
  mid: 2,
  senior: 3,
  lead: 4,
};

export function scoreJob(job: Job, req: Requirements): ScoredJob | null {
  const hay = `${job.title} ${job.company} ${job.location} ${job.tags.join(" ")} ${job.description}`;
  const dealBreakers = req.dealBreakers.filter((d) => d.trim() && includesPhrase(hay, d));
  if (dealBreakers.length) return null;

  const reasons: string[] = [];
  const gaps: string[] = [];

  const roleOk = rolesCompatible(req.title, job.title);
  if (!roleOk) return null;

  const titleScore = scoreTitle(job.title, job.description, req.title, reasons, gaps);
  const skillsScore = scoreSkills(job, req.skills, reasons, gaps, roleOk);
  const locationScore = scoreLocation(job, req, reasons, gaps);
  const jobTypeScore = scoreJobType(job, req, reasons, gaps);
  const seniorityScore = scoreSeniority(job, req, reasons, gaps);
  const salaryScore = scoreSalary(job, req, reasons, gaps);
  const { score: mustScore, missing } = scoreMustHaves(hay, req.mustHaves, reasons, gaps);

  let score =
    titleScore * WEIGHTS.title +
    skillsScore * WEIGHTS.skills +
    locationScore * WEIGHTS.location +
    jobTypeScore * WEIGHTS.jobType +
    seniorityScore * WEIGHTS.seniority +
    salaryScore * WEIGHTS.salary +
    mustScore * WEIGHTS.mustHaves;

  if (req.notes.trim()) {
    const noteHits = tokens(req.notes).filter((t) => includesPhrase(hay, t)).length;
    const noteTokens = tokens(req.notes).length || 1;
    score += Math.min(6, (noteHits / noteTokens) * 6);
  }

  if (missing.length && missing.length === req.mustHaves.filter(Boolean).length) {
    score = Math.min(score, 38);
  } else if (missing.length) {
    score -= missing.length * 8;
  }

  score = Math.max(0, Math.min(99, Math.round(score)));

  return {
    ...job,
    score,
    reasons: reasons.slice(0, 5),
    gaps: gaps.slice(0, 4),
    missingMustHaves: missing,
    breakdown: {
      title: Math.round(titleScore * WEIGHTS.title),
      skills: Math.round(skillsScore * WEIGHTS.skills),
      location: Math.round(locationScore * WEIGHTS.location),
      jobType: Math.round(jobTypeScore * WEIGHTS.jobType),
      seniority: Math.round(seniorityScore * WEIGHTS.seniority),
      salary: Math.round(salaryScore * WEIGHTS.salary),
      mustHaves: Math.round(mustScore * WEIGHTS.mustHaves),
    },
  };
}

function scoreTitle(
  title: string,
  description: string,
  wanted: string,
  reasons: string[],
  gaps: string[],
): number {
  if (!wanted.trim()) return 0.55;
  if (includesPhrase(title, wanted)) {
    reasons.push(`Title matches “${wanted}”`);
    return 1;
  }
  const wantedTokens = tokens(wanted);
  if (!wantedTokens.length) return 0.55;
  const strong = wantedTokens.filter((t) => !WEAK_TITLE.has(t));
  const focus = strong.length ? strong : wantedTokens;
  const titleHits = focus.filter((t) => includesPhrase(title, t));
  if (titleHits.length === focus.length) {
    reasons.push("All role keywords appear in the title");
    return 0.9;
  }
  if (titleHits.length) {
    reasons.push(`Title includes ${titleHits.join(", ")}`);
    return 0.45 + (titleHits.length / focus.length) * 0.4;
  }
  const descHits = focus.filter((t) => includesPhrase(description, t));
  if (descHits.length) return 0.2 + (descHits.length / focus.length) * 0.15;
  gaps.push(`Title is not close to “${wanted}”`);
  return 0.1;
}

function scoreSkills(
  job: Job,
  skills: string[],
  reasons: string[],
  gaps: string[],
  roleOk: boolean,
): number {
  if (!skills.length) return 0.5;
  const titleHay = `${job.title} ${job.tags.join(" ")}`;
  const inTitle = skills.filter((s) => hasTerm(titleHay, s));
  const inDesc = skills.filter((s) => !inTitle.includes(s) && hasTerm(job.description, s));
  const matched = [...inTitle, ...inDesc];
  if (matched.length) reasons.push(`Skills: ${matched.slice(0, 4).join(", ")}`);
  const missing = skills.filter((s) => !matched.includes(s));
  if (missing.length) gaps.push(`Not listed: ${missing.slice(0, 3).join(", ")}`);
  const raw = (inTitle.length * 1 + inDesc.length * 0.5) / skills.length;
  return roleOk ? raw : raw * 0.35;
}

function scoreLocation(
  job: Job,
  req: Requirements,
  reasons: string[],
  gaps: string[],
): number {
  if (req.workMode !== "any" && req.workMode === job.workMode) {
    reasons.push(`${labelMode(job.workMode)} role`);
  }
  if (req.workMode === "remote") {
    if (job.workMode === "remote") return req.location.trim() ? locOverlap(job, req, 1, 0.82) : 1;
    if (job.workMode === "hybrid") {
      gaps.push("Hybrid, not fully remote");
      return 0.45;
    }
    gaps.push("Looks on-site");
    return 0.15;
  }
  if (req.workMode === "onsite" && job.workMode === "remote") {
    gaps.push("Remote-only posting");
    return 0.25;
  }
  if (!req.location.trim()) return req.workMode === "any" || req.workMode === job.workMode ? 0.75 : 0.4;
  return locOverlap(job, req, 1, 0.35);
}

function locOverlap(job: Job, req: Requirements, hit: number, miss: number): number {
  const place = tokens(req.location);
  if (!place.length) return hit;
  const blob = `${job.location} ${job.description.slice(0, 400)}`;
  if (place.some((p) => includesPhrase(blob, p)) || /\bworldwide\b|\banywhere\b/.test(normalize(job.location))) {
    return hit;
  }
  return miss;
}

function scoreJobType(job: Job, req: Requirements, reasons: string[], gaps: string[]): number {
  if (req.jobType === "any") return 0.7;
  if (job.jobType === req.jobType) {
    reasons.push(labelType(job.jobType));
    return 1;
  }
  gaps.push(`Listed as ${labelType(job.jobType)}`);
  return 0.2;
}

function scoreSeniority(job: Job, req: Requirements, reasons: string[], gaps: string[]): number {
  if (req.seniority === "any") return 0.7;
  const jobLevel = job.seniority !== "any" ? job.seniority : inferSeniority(job.title);
  if (jobLevel === req.seniority) {
    reasons.push(`${labelSeniority(jobLevel)} level`);
    return 1;
  }
  const wantedRank = seniorityRank(req.seniority);
  const jobRank = seniorityRank(jobLevel);
  const diff = Math.abs(jobRank - wantedRank);
  if (diff === 1) return 0.55;
  gaps.push(`Looks ${labelSeniority(jobLevel)}, you asked for ${labelSeniority(req.seniority)}`);
  return 0.2;
}

function scoreSalary(job: Job, req: Requirements, reasons: string[], gaps: string[]): number {
  if (!req.minSalary) return 0.65;
  if (!job.salaryMin) {
    gaps.push("Salary not listed");
    return 0.4;
  }
  if (job.salaryMin >= req.minSalary) {
    reasons.push(`Pay at or above ${formatPay(req.minSalary)}`);
    return 1;
  }
  if (job.salaryMin >= req.minSalary * 0.85) return 0.55;
  gaps.push(`Listed pay starts near ${formatPay(job.salaryMin)}`);
  return 0.15;
}

function scoreMustHaves(hay: string, mustHaves: string[], reasons: string[], gaps: string[]) {
  const needed = mustHaves.map((m) => m.trim()).filter(Boolean);
  if (!needed.length) return { score: 0.7, missing: [] as string[] };
  const missing = needed.filter((m) => !includesPhrase(hay, m));
  const hit = needed.length - missing.length;
  if (hit) reasons.push(`Must-haves found: ${needed.filter((m) => !missing.includes(m)).slice(0, 3).join(", ")}`);
  if (missing.length) gaps.push(`Missing must-have: ${missing.slice(0, 3).join(", ")}`);
  return { score: hit / needed.length, missing };
}

function labelMode(mode: Job["workMode"]) {
  return mode === "onsite" ? "On-site" : mode[0].toUpperCase() + mode.slice(1);
}

function labelType(type: Job["jobType"]) {
  return type.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function labelSeniority(level: Seniority) {
  return level === "any" ? "Any" : level[0].toUpperCase() + level.slice(1);
}

function formatPay(n: number) {
  if (n >= 1000) return `$${Math.round(n / 1000)}k`;
  return `$${n}`;
}

function seniorityRank(level: Seniority): number {
  if (level === "any") return SENIORITY_RANK.mid;
  return SENIORITY_RANK[level];
}

const WEAK_TITLE = new Set([
  "developer", "engineer", "specialist", "manager", "analyst", "intern",
  "senior", "junior", "staff", "lead", "principal", "associate",
]);



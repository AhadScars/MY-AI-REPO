import { inferJobType, inferSeniority, inferWorkMode, museCategory } from "./infer";
import { isRelevantJob, sourceQueries } from "./relevance";
import { asText, excerpt, parseSalaryMin, stripHtml, toIsoDate, unique } from "./text";
import type { Job, Requirements, SourceResult } from "./types";

const UA = "JobFinder/1.0 (local career tool)";
const TIMEOUT_MS = 9000;

type Fetched = { jobs: Job[]; source: SourceResult };

export async function fetchAllJobs(req: Requirements): Promise<{
  jobs: Job[];
  sources: SourceResult[];
}> {
  const queries = sourceQueries(req);
  const settled = await Promise.all([
    wrap("Remotive", () => remotive(queries, req)),
    wrap("Remote OK", () => remoteOk(req)),
    wrap("Jobicy", () => jobicy(queries, req)),
    wrap("Arbeitnow", () => arbeitnow(req)),
    wrap("The Muse", () => theMuse(req)),
  ]);

  const jobs = settled.flatMap((item) => item.jobs);
  const sources = settled.map((item) => item.source);
  return { jobs: dedupe(jobs), sources };
}

async function wrap(name: Job["source"], fn: () => Promise<Job[]>): Promise<Fetched> {
  try {
    const jobs = await fn();
    return { jobs, source: { name, count: jobs.length } };
  } catch (err) {
    return {
      jobs: [],
      source: {
        name,
        count: 0,
        error: err instanceof Error ? err.message : "Request failed",
      },
    };
  }
}

async function remotive(queries: string[], req: Requirements): Promise<Job[]> {
  const searches = (queries.length ? queries.slice(0, 3) : ["software"]).map((q) =>
    getJson(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(q)}&limit=50`),
  );
  const pages = await Promise.all(searches);
  const jobs = pages.flatMap((page) => {
    const data = page as {
    jobs?: Array<{
      id: number;
      url: string;
      title: string;
      company_name: string;
      company_logo?: string;
      tags?: string[];
      job_type?: string;
      publication_date?: string;
      candidate_required_location?: string;
      salary?: string;
      description?: string;
    }>;
    };
    return (data.jobs || []).map((j) =>
      toJob({
        id: `remotive-${j.id}`,
        title: j.title,
        company: j.company_name,
        companyLogo: j.company_logo,
        location: j.candidate_required_location || "Remote",
        typeRaw: j.job_type,
        remote: true,
        salary: j.salary,
        tags: j.tags,
        description: j.description,
        url: j.url,
        source: "Remotive",
        publishedAt: j.publication_date,
      }),
    );
  });
  return keepRelevant(jobs, req);
}

async function remoteOk(req: Requirements): Promise<Job[]> {
  const data = (await getJson("https://remoteok.com/api")) as Array<Record<string, unknown>>;
  const jobs = data
    .filter((row) => typeof row.position === "string")
    .map((j) => {
      const title = String(j.position);
      const tags = Array.isArray(j.tags) ? j.tags.map(String) : [];
      const description = stripHtml(String(j.description || ""));
      return toJob({
        id: `remoteok-${j.id || j.slug}`,
        title,
        company: String(j.company || "Company"),
        companyLogo: j.company_logo ? String(j.company_logo) : undefined,
        location: String(j.location || "Remote"),
        typeRaw: tags.join(" "),
        remote: true,
        salary: j.salary_min ? String(j.salary_min) : undefined,
        salaryMin: typeof j.salary_min === "number" ? j.salary_min : parseSalaryMin(String(j.salary_min || "")),
        tags,
        description,
        url: String(j.url || j.apply_url || `https://remoteok.com/remote-jobs/${j.slug}`),
        source: "Remote OK",
        publishedAt: j.date ? String(j.date) : undefined,
      });
    });
  return keepRelevant(jobs, req);
}

async function jobicy(queries: string[], req: Requirements): Promise<Job[]> {
  const tags = unique(
    (queries.length ? queries : ["javascript"])
      .map((q) => {
        const t = q.toLowerCase();
        if (t === "next.js" || t === "nextjs") return "react";
        if (t === "front-end" || t === "front end") return "frontend";
        if (t === "back-end" || t === "back end") return "backend";
        return t.replace(/\.js$/, "");
      })
      .slice(0, 3),
  );
  const pages = await Promise.all(
    tags.map((tag) => getJson(`https://jobicy.com/api/v2/remote-jobs?count=50&tag=${encodeURIComponent(tag)}`)),
  );
  const jobs = pages.flatMap((page) => {
    const data = page as {
      jobs?: Array<{
        id: number;
        url: string;
        jobTitle: string;
        companyName: string;
        companyLogo?: string;
        jobType?: string;
        jobGeo?: string;
        jobExcerpt?: string;
        jobDescription?: string;
        pubDate?: string;
        jobLevel?: string;
        jobIndustry?: string;
      }>;
    };
    return (data.jobs || []).map((j) =>
      toJob({
        id: `jobicy-${j.id}`,
        title: j.jobTitle,
        company: j.companyName,
        companyLogo: j.companyLogo,
        location: j.jobGeo || "Remote",
        typeRaw: asText(j.jobType),
        remote: true,
        tags: [asText(j.jobIndustry), asText(j.jobLevel)].filter(Boolean),
        description: j.jobDescription || j.jobExcerpt,
        url: j.url,
        source: "Jobicy",
        publishedAt: j.pubDate,
        extraSeniority: j.jobLevel,
      }),
    );
  });
  return keepRelevant(jobs, req);
}

async function arbeitnow(req: Requirements): Promise<Job[]> {
  const data = (await getJson("https://www.arbeitnow.com/api/job-board-api")) as {
    data?: Array<{
      slug: string;
      company_name: string;
      title: string;
      description?: string;
      remote?: boolean;
      location?: string;
      created_at?: string | number;
      url?: string;
      tags?: string[];
      job_types?: string[];
    }>;
  };
  const jobs = (data.data || []).map((j) =>
    toJob({
      id: `arbeitnow-${j.slug}`,
      title: j.title,
      company: j.company_name,
      location: j.location || (j.remote ? "Remote" : "Europe"),
      typeRaw: (j.job_types || []).join(" "),
      remote: Boolean(j.remote),
      tags: j.tags,
      description: j.description,
      url: j.url || `https://www.arbeitnow.com/jobs/${j.slug}`,
      source: "Arbeitnow",
      publishedAt: j.created_at,
    }),
  );
  return keepRelevant(jobs, req);
}

async function theMuse(req: Requirements): Promise<Job[]> {
  const params = new URLSearchParams({ page: "0", descending: "true" });
  const category = museCategory(req.title || req.skills.join(" "));
  if (category) params.set("category", category);
  if (req.workMode === "remote" || /remote/i.test(req.location)) {
    params.append("location", "Flexible / Remote");
  } else if (req.location.trim()) {
    params.append("location", req.location.trim());
  }
  const data = (await getJson(`https://www.themuse.com/api/public/jobs?${params}`)) as {
    results?: Array<{
      id: number;
      name: string;
      contents?: string;
      publication_date?: string;
      locations?: Array<{ name: string }>;
      levels?: Array<{ name: string }>;
      categories?: Array<{ name: string }>;
      refs?: { landing_page?: string };
      company?: { name?: string };
    }>;
  };
  const jobs = (data.results || []).map((j) => {
    const location = (j.locations || []).map((l) => l.name).join(" · ") || "Not listed";
    return toJob({
      id: `muse-${j.id}`,
      title: j.name,
      company: j.company?.name || "Company",
      location,
      typeRaw: "full-time",
      remote: /remote|flexible/i.test(location),
      tags: (j.categories || []).map((c) => c.name),
      description: j.contents,
      url: j.refs?.landing_page || `https://www.themuse.com/jobs/${j.id}`,
      source: "The Muse",
      publishedAt: j.publication_date,
      extraSeniority: (j.levels || []).map((l) => l.name).join(" "),
    });
  });
  return keepRelevant(jobs, req);
}

function keepRelevant(jobs: Job[], req: Requirements): Job[] {
  return jobs.filter((job) => isRelevantJob(job, req));
}

function toJob(input: {
  id: string;
  title: string;
  company: string;
  companyLogo?: string;
  location: string;
  typeRaw?: string;
  remote?: boolean;
  salary?: string;
  salaryMin?: number;
  tags?: string[];
  description?: string;
  url: string;
  source: Job["source"];
  publishedAt?: string | number;
  extraSeniority?: string;
}): Job {
  const description = stripHtml(input.description || "").slice(0, 4000);
  return {
    id: String(input.id),
    title: input.title.trim(),
    company: input.company.trim(),
    companyLogo: input.companyLogo,
    location: input.location.trim() || "Not listed",
    workMode: inferWorkMode(input.location, input.remote),
    jobType: inferJobType(input.typeRaw),
    seniority: inferSeniority(input.title, input.extraSeniority || ""),
    salary: input.salary,
    salaryMin: input.salaryMin ?? parseSalaryMin(input.salary),
    tags: unique(input.tags || []),
    description,
    excerpt: excerpt(description),
    url: input.url,
    source: input.source,
    publishedAt: toIsoDate(input.publishedAt),
  };
}

function dedupe(jobs: Job[]): Job[] {
  const seen = new Set<string>();
  const out: Job[] = [];
  for (const job of jobs) {
    const key = `${job.title.toLowerCase()}::${job.company.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(job);
  }
  return out;
}

async function getJson(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`${res.status} from source`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export type WorkMode = "any" | "remote" | "hybrid" | "onsite";
export type JobType = "any" | "full-time" | "part-time" | "contract" | "internship";
export type Seniority = "any" | "intern" | "junior" | "mid" | "senior" | "lead";

export type Requirements = {
  title: string;
  skills: string[];
  location: string;
  workMode: WorkMode;
  jobType: JobType;
  seniority: Seniority;
  minSalary: number | null;
  mustHaves: string[];
  dealBreakers: string[];
  notes: string;
};

export type Job = {
  id: string;
  title: string;
  company: string;
  companyLogo?: string;
  location: string;
  workMode: WorkMode;
  jobType: JobType;
  seniority: Seniority;
  salary?: string;
  salaryMin?: number;
  tags: string[];
  description: string;
  excerpt: string;
  url: string;
  source: "Remotive" | "Remote OK" | "Jobicy" | "Arbeitnow" | "The Muse";
  publishedAt?: string;
};

export type ScoreBreakdown = {
  title: number;
  skills: number;
  location: number;
  jobType: number;
  seniority: number;
  salary: number;
  mustHaves: number;
};

export type ScoredJob = Job & {
  score: number;
  reasons: string[];
  gaps: string[];
  breakdown: ScoreBreakdown;
  missingMustHaves: string[];
};

export type SourceResult = {
  name: Job["source"];
  count: number;
  error?: string;
};

export const emptyRequirements = (): Requirements => ({
  title: "",
  skills: [],
  location: "",
  workMode: "any",
  jobType: "any",
  seniority: "any",
  minSalary: null,
  mustHaves: [],
  dealBreakers: [],
  notes: "",
});

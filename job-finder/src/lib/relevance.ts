import { includesPhrase, normalize, tokens, unique } from "./text";
import type { Job, Requirements } from "./types";

const WEAK = new Set([
  "developer", "engineer", "engineering", "specialist", "manager", "analyst",
  "intern", "senior", "junior", "staff", "lead", "principal", "associate",
  "software", "remote", "full", "time", "contract",
]);

const SYNONYMS: Record<string, string[]> = {
  frontend: ["frontend", "front-end", "front end", "react", "vue", "angular", "next.js", "nextjs"],
  backend: ["backend", "back-end", "back end", "nodejs", "node.js", "django", "rails", "spring", "golang"],
  fullstack: ["full stack", "fullstack", "full-stack"],
  react: ["react", "react.js", "reactjs", "next.js", "nextjs"],
  vue: ["vue", "vue.js", "nuxt"],
  angular: ["angular"],
  python: ["python", "django", "flask", "fastapi"],
  "node.js": ["node", "node.js", "nodejs", "express", "nestjs"],
  javascript: ["javascript", "js", "typescript"],
  typescript: ["typescript", "ts"],
  design: ["designer", "product designer", "ux", "ui designer"],
  data: ["data analyst", "data scientist", "data engineer", "analytics"],
  devops: ["devops", "sre", "platform engineer", "site reliability"],
  mobile: ["ios", "android", "react native", "flutter", "mobile"],
  product: ["product manager", "product owner"],
};

export function titleNeedles(req: Requirements): string[] {
  const fromTitle = tokens(req.title).filter((t) => !WEAK.has(t) && t.length > 2);
  const expanded = fromTitle.flatMap((t) => SYNONYMS[normalize(t)] || [t]);
  return unique([...expanded, ...req.skills.filter((s) => s.trim().length > 1)]);
}

export function sourceQueries(req: Requirements): string[] {
  const needles = titleNeedles(req);
  if (needles.length) return needles.slice(0, 4);
  const fallback = tokens(req.title).filter((t) => t.length > 3);
  return fallback.slice(0, 2);
}

export function hasTerm(haystack: string, term: string): boolean {
  const h = normalize(haystack);
  const n = normalize(term);
  if (!n) return false;
  if (n.length <= 2) {
    return new RegExp(`(?:^|[^a-z0-9])${escapeRe(n)}(?:[^a-z0-9]|$)`).test(h);
  }
  return includesPhrase(h, n);
}

export function isRelevantJob(job: Job, req: Requirements): boolean {
  if (!rolesCompatible(req.title, job.title)) return false;
  const needles = titleNeedles(req);
  if (!needles.length) return false;
  return needles.some((n) => hasTerm(job.title, n));
}

export function rolesCompatible(wanted: string, title: string): boolean {
  const user = roleFamilies(wanted);
  const job = roleFamilies(title);
  if (!user.size || !job.size) return true;
  if ([...user].some((f) => job.has(f))) return true;
  for (const family of ROLE_FAMILIES) {
    if (user.has(family.name) && family.also?.some((a) => job.has(a))) return true;
  }
  return false;
}

const ROLE_FAMILIES: Array<{ name: string; words: string[]; also?: string[] }> = [
  { name: "frontend", words: ["frontend", "front end", "front-end", "react", "vue", "angular", "next.js"], also: ["fullstack"] },
  { name: "backend", words: ["backend", "back end", "back-end", "golang", "django", "rails", "laravel", "spring"], also: ["fullstack"] },
  { name: "fullstack", words: ["fullstack", "full stack", "full-stack"], also: ["frontend", "backend"] },
  { name: "qa", words: ["qa", "quality assurance", "sdet", "tester"] },
  { name: "devops", words: ["devops", "sre", "site reliability"] },
  { name: "data", words: ["data analyst", "data scientist", "data engineer", "machine learning"] },
  { name: "design", words: ["designer", "ux designer", "product designer"] },
  { name: "mobile", words: ["ios", "android", "mobile", "flutter", "react native"] },
  { name: "product", words: ["product manager", "product owner"] },
  { name: "sales", words: ["sales", "account executive", "sdr", "bdr"] },
  { name: "security", words: ["security engineer", "cybersecurity"] },
];

function roleFamilies(text: string): Set<string> {
  const n = normalize(text);
  const hits = new Set<string>();
  for (const family of ROLE_FAMILIES) {
    if (family.words.some((w) => n.includes(w))) hits.add(family.name);
  }
  return hits;
}

function escapeRe(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

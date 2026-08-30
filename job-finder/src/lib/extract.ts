import { inferSeniority } from "./infer";
import { normalize, unique } from "./text";
import type { Requirements, WorkMode } from "./types";

const SKILLS = [
  "JavaScript", "TypeScript", "React", "Next.js", "Node.js", "Python", "Java",
  "Go", "Golang", "Rust", "C++", "C#", "PHP", "Ruby", "Swift", "Kotlin",
  "SQL", "PostgreSQL", "MySQL", "MongoDB", "Redis", "GraphQL", "REST",
  "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Terraform", "Linux",
  "Git", "CI/CD", "Tailwind", "CSS", "HTML", "Vue", "Angular", "Svelte",
  "Django", "Flask", "FastAPI", "Spring", "Express", "NestJS", "Prisma",
  "Pandas", "NumPy", "TensorFlow", "PyTorch", "scikit-learn", "Figma",
  "Cypress", "Playwright", "Jest", "Testing Library", "Redux", "React Native",
  "Flutter", "Laravel", "Rails", "Hadoop", "Spark", "Snowflake", "dbt",
  "Airflow", "Kafka", "Elasticsearch", "Sass", "Webpack", "Vite",
  "Product Management", "Agile", "Scrum", "Jira", "SEO", "Copywriting",
  "Salesforce", "HubSpot", "Excel", "Power BI", "Tableau", "Looker",
];

const ROLES = [
  "Software Engineer", "Frontend Developer", "Frontend Engineer",
  "Backend Developer", "Backend Engineer",
  "Full Stack Developer", "Full-Stack Engineer", "Data Scientist",
  "Data Analyst", "Data Engineer", "Machine Learning Engineer",
  "DevOps Engineer", "SRE", "Product Designer", "UX Designer",
  "UI Designer", "Product Manager", "Project Manager", "QA Engineer",
  "Mobile Developer", "iOS Developer", "Android Developer",
  "Security Engineer", "Cloud Engineer", "Marketing Manager",
];

export function extractFromText(text: string): Partial<Requirements> {
  const blob = text.replace(/\s+/g, " ").trim();
  if (!blob) return {};

  const lower = normalize(blob);
  const skills = unique(
    SKILLS.filter((skill) => {
      const n = normalize(skill).replace(/[+#.]/g, (ch) => `\\${ch}`);
      return new RegExp(`(?:^|[^a-z0-9])${n}(?:[^a-z0-9]|$)`, "i").test(lower);
    }),
  );

  const title =
    pickRole(blob) ||
    firstMatch(blob, /(?:seeking|target(?:ing)?|role|position|title)\s*[:\-]\s*([A-Za-z][A-Za-z0-9+/#&. \-]{2,48})/i);

  const location =
    firstMatch(blob, /(?:location|based in|city)\s*[:\-]\s*([A-Za-z][A-Za-z0-9,. \-]{2,40})/i) ||
    (/\bremote\b/i.test(blob) ? "Remote" : undefined);

  let workMode: WorkMode | undefined;
  if (/\bhybrid\b/i.test(blob)) workMode = "hybrid";
  else if (/\bremote\b|\bwfh\b|work from home/i.test(blob)) workMode = "remote";
  else if (/\bon-?site\b|\bin-?office\b/i.test(blob)) workMode = "onsite";

  const salary = blob.match(/(?:\$|usd\s*)(\d{2,3})\s*k/i);
  const minSalary = salary ? Number(salary[1]) * 1000 : undefined;

  return {
    ...(title ? { title: title.trim() } : {}),
    ...(skills.length ? { skills } : {}),
    ...(location ? { location: location.trim() } : {}),
    ...(workMode ? { workMode } : {}),
    seniority: inferSeniority(title || "", blob),
    ...(minSalary ? { minSalary } : {}),
  };
}

function pickRole(text: string): string | undefined {
  const lower = normalize(text);
  for (const role of ROLES) {
    if (lower.includes(normalize(role))) return role;
  }
  return undefined;
}

function firstMatch(text: string, re: RegExp): string | undefined {
  const m = text.match(re);
  return m?.[1]?.replace(/[,.;]+$/, "").trim();
}

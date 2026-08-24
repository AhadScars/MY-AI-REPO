export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Prepwise";

export const ROLES = [
  "Software Engineer",
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "Data Scientist",
  "Product Manager",
  "UI/UX Designer",
  "Marketing Manager",
  "Business Analyst",
] as const;

export const EXPERIENCE_LEVELS = [
  { value: "intern", label: "Intern" },
  { value: "entry", label: "Entry Level" },
  { value: "mid", label: "Mid Level" },
  { value: "senior", label: "Senior" },
  { value: "lead", label: "Lead" },
  { value: "manager", label: "Manager" },
  { value: "executive", label: "Executive" },
] as const;

export const INTERVIEW_TYPES = [
  { value: "technical", label: "Technical" },
  { value: "behavioral", label: "Behavioral" },
  { value: "hr", label: "HR" },
  { value: "system_design", label: "System Design" },
  { value: "coding", label: "Coding" },
  { value: "managerial", label: "Managerial" },
  { value: "mixed", label: "Mixed Interview" },
] as const;

export const DIFFICULTIES = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
  { value: "expert", label: "Expert" },
] as const;

export const DURATIONS = [
  { value: 10, label: "10 minutes" },
  { value: 20, label: "20 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 45, label: "45 minutes" },
] as const;

export const STYLES = [
  { value: "friendly", label: "Friendly" },
  { value: "professional", label: "Professional" },
  { value: "challenging", label: "Challenging" },
  { value: "strict", label: "Strict" },
  { value: "faang", label: "FAANG-style" },
  { value: "startup", label: "Startup-style" },
] as const;

export const TOPIC_SETS: Record<string, string[]> = {
  technical: [
    "Introduction",
    "Resume Experience",
    "Technical Skills",
    "Problem Solving",
    "System Design",
    "Behavioral",
  ],
  behavioral: [
    "Introduction",
    "Resume Experience",
    "Behavioral",
    "Leadership",
    "Situational",
    "Closing",
  ],
  hr: ["Introduction", "Motivation", "Culture Fit", "Behavioral", "Compensation & Logistics"],
  system_design: [
    "Introduction",
    "Requirements",
    "High-Level Design",
    "Data & Scale",
    "Tradeoffs",
    "Failure Handling",
  ],
  coding: [
    "Introduction",
    "Problem Understanding",
    "Approach",
    "Complexity",
    "Edge Cases",
    "Testing",
  ],
  managerial: [
    "Introduction",
    "Leadership",
    "Conflict",
    "Prioritization",
    "Hiring",
    "Strategy",
  ],
  mixed: [
    "Introduction",
    "Resume Experience",
    "Technical Skills",
    "System Design",
    "Behavioral",
    "Leadership",
  ],
};

export const MAX_RESUME_BYTES = 8 * 1024 * 1024;
export const ALLOWED_RESUME_EXT = [".pdf", ".doc", ".docx"] as const;
export const SESSION_COOKIE = "prepwise_session";
export const SESSION_DAYS = 7;

export function questionCountForDuration(minutes: number): number {
  if (minutes <= 10) return 6;
  if (minutes <= 20) return 9;
  if (minutes <= 30) return 12;
  if (minutes <= 45) return 16;
  return Math.max(6, Math.min(20, Math.round(minutes / 2.8)));
}

export function labelFor(
  list: readonly { value: string; label: string }[],
  value: string,
): string {
  return list.find((item) => item.value === value)?.label ?? value;
}

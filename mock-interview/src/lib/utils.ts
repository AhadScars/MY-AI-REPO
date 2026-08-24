export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function clampScore(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function formatDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function formatMmSs(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function readinessFromScore(score: number): {
  status: string;
  label: string;
} {
  if (score < 45) return { status: "needs_prep", label: "Needs Significant Preparation" };
  if (score < 60) return { status: "developing", label: "Developing" };
  if (score < 75) return { status: "almost_ready", label: "Almost Ready" };
  if (score < 88) return { status: "ready", label: "Ready — With Improvement" };
  return { status: "highly_prepared", label: "Highly Prepared" };
}

export function interviewTypeLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function safeJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function deltaPercent(current: number, previous: number | null | undefined) {
  if (previous == null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function excerpt(text: string, max = 280): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).replace(/\s+\S*$/, "")}…`;
}

export function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(" ");
  if (value && typeof value === "object" && "name" in value) {
    return asText((value as { name: unknown }).name);
  }
  return "";
}

export function normalize(value: unknown): string {
  return asText(value).toLowerCase().replace(/[^a-z0-9+#.\s-]/g, " ").replace(/\s+/g, " ").trim();
}

export function tokens(value: string): string[] {
  return normalize(value)
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOP.has(t));
}

export function includesPhrase(haystack: string, needle: string): boolean {
  const h = normalize(haystack);
  const n = normalize(needle);
  if (!n) return false;
  return h.includes(n);
}

export function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = normalize(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value.trim());
  }
  return out;
}

export function toIsoDate(value: unknown): string | undefined {
  const ms = parseWhen(value);
  if (ms == null) return undefined;
  return new Date(ms).toISOString();
}

export function parseWhen(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value < 1e12 ? value * 1000 : value;
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      const n = Number(trimmed);
      const ms = n < 1e12 ? n * 1000 : n;
      return Number.isFinite(ms) ? ms : null;
    }
    const t = Date.parse(trimmed);
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

export function parseSalaryMin(raw?: string | number | null): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return raw < 1000 ? raw * 1000 : raw;
  }
  if (!raw || typeof raw !== "string") return undefined;
  const text = raw.toLowerCase().replace(/,/g, "");
  const match = text.match(/(\d+(?:\.\d+)?)\s*(k|m)?/);
  if (!match) return undefined;
  let n = Number(match[1]);
  if (match[2] === "k") n *= 1000;
  if (match[2] === "m") n *= 1_000_000;
  if (n > 0 && n < 200) n *= 1000;
  return n > 0 ? n : undefined;
}

const STOP = new Set([
  "a", "an", "the", "and", "or", "of", "to", "for", "in", "on", "at", "by",
  "with", "from", "as", "is", "are", "be", "we", "our", "you", "your",
  "job", "role", "position", "looking", "engineer", "engineering",
]);

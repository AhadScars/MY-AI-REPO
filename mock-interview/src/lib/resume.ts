import path from "node:path";
import { parsedResumeSchema, type ParsedResume } from "./schemas";
import { grokJson } from "./grok";
import { parsedResumeJsonSchema } from "./json-schema";
import { PARSE_RESUME_SYSTEM } from "./prompts";

function cleanExtractedText(raw: string): string {
  return raw
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/(\w)-\n(\w)/g, "$1$2")
    .replace(/[^\S\n]{2,}/g, " ")
    .trim();
}

function crudePdfLatin1(buf: Buffer): string {
  const raw = buf.toString("latin1");
  const chunks: string[] = [];
  const re = /\((?:\\.|[^\\)]){2,}\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    let s = m[0].slice(1, -1);
    s = s
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "")
      .replace(/\\t/g, " ")
      .replace(/\\\(/g, "(")
      .replace(/\\\)/g, ")")
      .replace(/\\\\/g, "\\");
    if (/[A-Za-z]{3,}/.test(s) && !/Font|Identity|Adobe|CID|Glyph/i.test(s)) {
      chunks.push(s);
    }
  }
  return cleanExtractedText(chunks.join(" ").replace(/\s+/g, " "));
}

async function extractPdf(buf: Buffer): Promise<string> {
  try {
    const mod = await import("pdf-parse");
    // pdf-parse v2 class API
    const PDFParse =
      (mod as { PDFParse?: new (opts: { data: Buffer }) => { getText: () => Promise<{ text?: string }>; destroy?: () => Promise<void> } }).PDFParse;
    if (PDFParse) {
      const parser = new PDFParse({ data: buf });
      try {
        const data = await parser.getText();
        const text = cleanExtractedText(String(data?.text || ""));
        if (text.length >= 40) return text;
      } finally {
        try {
          await parser.destroy?.();
        } catch {
          /* ignore */
        }
      }
    } else {
      const pdf = (mod as { default?: (b: Buffer) => Promise<{ text: string }> }).default;
      if (pdf) {
        const data = await pdf(buf);
        const text = cleanExtractedText(data.text || "");
        if (text.length >= 40) return text;
      }
    }
  } catch (err) {
    console.warn("[resume] pdf-parse failed", err);
  }
  const fallback = crudePdfLatin1(buf);
  if (fallback.length >= 40) return fallback;
  throw new Error(
    "Could not read text from this PDF. It may be a scanned image. Export as a text PDF and try again.",
  );
}

async function extractDocx(buf: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer: buf });
  const text = cleanExtractedText(result.value || "");
  if (text.length < 40) {
    throw new Error("Could not read enough text from this Word document.");
  }
  return text;
}

function extractDocFallback(buf: Buffer): string {
  const raw = buf.toString("latin1");
  const text = raw
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ")
    .replace(/\s{2,}/g, " ");
  const cleaned = cleanExtractedText(text);
  if (cleaned.length < 40) {
    throw new Error("Could not read this .doc file. Please upload a PDF or DOCX instead.");
  }
  return cleaned;
}

export async function extractResumeText(fileName: string, buf: Buffer): Promise<string> {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".pdf") return extractPdf(buf);
  if (ext === ".docx") return extractDocx(buf);
  if (ext === ".doc") return extractDocFallback(buf);
  throw new Error("Unsupported file type. Upload a PDF, DOC, or DOCX resume.");
}

export function heuristicParse(text: string): ParsedResume {
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
  const phone =
    text.match(/(\+?\d[\d\s().-]{7,}\d)/)?.[0]?.replace(/\s+/g, " ").trim() ?? "";
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const name =
    lines.find((line) => line.length > 2 && line.length < 60 && !line.includes("@") && !/\d{3}/.test(line)) ??
    "";

  const section = (label: string) => {
    const re = new RegExp(`${label}[:\\s]*([\\s\\S]*?)(?=\\n[A-Z][A-Za-z /]{2,30}\\n|$)`, "i");
    return text.match(re)?.[1]?.trim() ?? "";
  };

  const skillsBlock = section("skills") || section("technical skills");
  const skills = skillsBlock
    .split(/[,|\n•·]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && s.length < 40)
    .slice(0, 30);

  const years = [...text.matchAll(/\b(19|20)\d{2}\b/g)].map((m) => Number(m[0]));
  const minYear = years.length ? Math.min(...years) : 0;
  const yearsOfExperience =
    minYear && minYear > 1980 ? Math.max(0, Math.min(40, new Date().getFullYear() - minYear)) : 0;

  return parsedResumeSchema.parse({
    name,
    email,
    phone,
    summary: lines.slice(0, 4).join(" ").slice(0, 400),
    skills,
    experience: [],
    education: [],
    projects: [],
    certifications: [],
    achievements: [],
    technologies: skills.slice(0, 15),
    jobTitles: [],
    yearsOfExperience,
  });
}

export async function parseResumeWithGrok(text: string, seed: ParsedResume): Promise<ParsedResume> {
  const parsed = await grokJson({
    schemaName: "parsed_resume",
    jsonSchema: parsedResumeJsonSchema as unknown as Record<string, unknown>,
    zodSchema: parsedResumeSchema,
    system: PARSE_RESUME_SYSTEM,
    user: `Heuristic seed (may be incomplete):\n${JSON.stringify(seed, null, 2)}\n\nResume text:\n${text.slice(0, 16000)}`,
    temperature: 0.1,
  });
  return parsedResumeSchema.parse({
    ...parsed,
    name: parsed.name || seed.name,
    email: parsed.email || seed.email,
  });
}

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ALLOWED_RESUME_EXT, MAX_RESUME_BYTES } from "./constants";
import { ApiError } from "./errors";

const UPLOAD_ROOT = path.join(process.cwd(), "data", "uploads");

const MAGIC: Array<{ ext: string; test: (buf: Buffer) => boolean }> = [
  { ext: ".pdf", test: (buf) => buf.slice(0, 5).toString("utf8") === "%PDF-" },
  { ext: ".docx", test: (buf) => buf[0] === 0x50 && buf[1] === 0x4b },
  { ext: ".doc", test: (buf) => buf[0] === 0xd0 && buf[1] === 0xcf },
];

export function assertResumeFile(fileName: string, buf: Buffer) {
  if (buf.byteLength === 0) {
    throw new ApiError(400, "The uploaded file is empty.", "empty_file");
  }
  if (buf.byteLength > MAX_RESUME_BYTES) {
    throw new ApiError(400, "Resume must be 8 MB or smaller.", "file_too_large");
  }
  const ext = path.extname(fileName).toLowerCase();
  if (!ALLOWED_RESUME_EXT.includes(ext as (typeof ALLOWED_RESUME_EXT)[number])) {
    throw new ApiError(400, "Upload a PDF, DOC, or DOCX resume.", "invalid_type");
  }
  const magicOk = MAGIC.some((entry) => entry.ext === ext && entry.test(buf));
  if (!magicOk) {
    throw new ApiError(400, "The file does not look like a valid resume document.", "invalid_file");
  }
  return ext;
}

export async function saveResumeFile(userId: string, fileName: string, buf: Buffer) {
  const ext = path.extname(fileName).toLowerCase() || ".bin";
  const dir = path.join(UPLOAD_ROOT, userId);
  await mkdir(dir, { recursive: true });
  const stored = `${randomUUID()}${ext}`;
  const dest = path.join(dir, stored);
  await writeFile(dest, buf);
  return { dest, storedName: stored };
}

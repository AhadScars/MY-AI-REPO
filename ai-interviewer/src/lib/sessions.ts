import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

const DATA_DIR = path.join(process.cwd(), "data", "sessions");

export type SessionMeta = {
  id: string;
  createdAt: string;
  candidateName?: string;
  role?: string;
  resumeSummary?: string;
  status: "ready" | "in_progress" | "completed";
};

export type NoteEntry = {
  time: string;
  type: "question" | "answer" | "observation" | "system";
  text: string;
};

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export function sessionDir(id: string) {
  return path.join(DATA_DIR, id);
}

export async function createSession(meta: Partial<SessionMeta> = {}) {
  await ensureDir(DATA_DIR);
  const id = randomUUID();
  const session: SessionMeta = {
    id,
    createdAt: new Date().toISOString(),
    status: "ready",
    ...meta,
  };
  const dir = sessionDir(id);
  await ensureDir(dir);
  await fs.writeFile(path.join(dir, "meta.json"), JSON.stringify(session, null, 2));
  await fs.writeFile(
    path.join(dir, "notes.md"),
    `# Interview Notes\n\n**Session:** ${id}\n**Started:** ${session.createdAt}\n\n---\n\n`
  );
  await fs.writeFile(path.join(dir, "transcript.json"), JSON.stringify([], null, 2));
  return session;
}

export async function getSession(id: string): Promise<SessionMeta | null> {
  try {
    const raw = await fs.readFile(path.join(sessionDir(id), "meta.json"), "utf8");
    return JSON.parse(raw) as SessionMeta;
  } catch {
    return null;
  }
}

export async function updateSession(id: string, patch: Partial<SessionMeta>) {
  const current = await getSession(id);
  if (!current) throw new Error("Session not found");
  const next = { ...current, ...patch };
  await fs.writeFile(
    path.join(sessionDir(id), "meta.json"),
    JSON.stringify(next, null, 2)
  );
  return next;
}

export async function appendNote(id: string, entry: NoteEntry) {
  const dir = sessionDir(id);
  await ensureDir(dir);
  const line = `\n### [${entry.time}] ${entry.type.toUpperCase()}\n${entry.text}\n`;
  await fs.appendFile(path.join(dir, "notes.md"), line, "utf8");

  const notesJsonPath = path.join(dir, "notes.json");
  let notes: NoteEntry[] = [];
  try {
    notes = JSON.parse(await fs.readFile(notesJsonPath, "utf8"));
  } catch {
    notes = [];
  }
  notes.push(entry);
  await fs.writeFile(notesJsonPath, JSON.stringify(notes, null, 2));
  return notes;
}

export async function readNotes(id: string): Promise<{ md: string; entries: NoteEntry[] }> {
  const dir = sessionDir(id);
  let md = "";
  let entries: NoteEntry[] = [];
  try {
    md = await fs.readFile(path.join(dir, "notes.md"), "utf8");
  } catch {
    md = "";
  }
  try {
    entries = JSON.parse(await fs.readFile(path.join(dir, "notes.json"), "utf8"));
  } catch {
    entries = [];
  }
  return { md, entries };
}

export async function saveTranscript(
  id: string,
  transcript: Array<{ role: string; content: string; ts: string }>
) {
  await fs.writeFile(
    path.join(sessionDir(id), "transcript.json"),
    JSON.stringify(transcript, null, 2)
  );
}

export async function saveFeedback(id: string, feedbackMd: string, feedbackJson: unknown) {
  const dir = sessionDir(id);
  await fs.writeFile(path.join(dir, "feedback.md"), feedbackMd, "utf8");
  await fs.writeFile(
    path.join(dir, "feedback.json"),
    JSON.stringify(feedbackJson, null, 2),
    "utf8"
  );
  await updateSession(id, { status: "completed" });
}

export async function saveResumeText(id: string, text: string) {
  await fs.writeFile(path.join(sessionDir(id), "resume.txt"), text, "utf8");
}

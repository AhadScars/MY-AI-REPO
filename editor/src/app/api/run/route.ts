import { NextRequest, NextResponse } from "next/server";
import { extractPublicClassName } from "@/lib/languages";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Judge0 CE public instance.
 * Override with JUDGE0_API_URL if you self-host or use RapidAPI.
 * Docs: https://ce.judge0.com
 */
const JUDGE0_BASE =
  process.env.JUDGE0_API_URL ?? "https://ce.judge0.com";

/** Judge0 CE language ids (https://ce.judge0.com/languages) */
const JUDGE0_LANG: Record<
  string,
  { id: number; versionLabel: string; fileName: (code: string) => string }
> = {
  java: {
    id: Number(process.env.JUDGE0_JAVA_LANGUAGE_ID ?? 62),
    versionLabel: "OpenJDK (Judge0)",
    fileName: (code) => `${extractPublicClassName(code)}.java`,
  },
  python: {
    id: Number(process.env.JUDGE0_PYTHON_LANGUAGE_ID ?? 71),
    versionLabel: "Python 3 (Judge0)",
    fileName: () => "main.py",
  },
  c: {
    id: Number(process.env.JUDGE0_C_LANGUAGE_ID ?? 50),
    versionLabel: "C GCC (Judge0)",
    fileName: () => "main.c",
  },
  cpp: {
    id: Number(process.env.JUDGE0_CPP_LANGUAGE_ID ?? 54),
    versionLabel: "C++ GCC (Judge0)",
    fileName: () => "main.cpp",
  },
  javascript: {
    id: Number(process.env.JUDGE0_JS_LANGUAGE_ID ?? 63),
    versionLabel: "Node.js (Judge0)",
    fileName: () => "main.js",
  },
  typescript: {
    id: Number(process.env.JUDGE0_TS_LANGUAGE_ID ?? 74),
    versionLabel: "TypeScript (Judge0)",
    fileName: () => "main.ts",
  },
  go: {
    id: Number(process.env.JUDGE0_GO_LANGUAGE_ID ?? 60),
    versionLabel: "Go (Judge0)",
    fileName: () => "main.go",
  },
  rust: {
    id: Number(process.env.JUDGE0_RUST_LANGUAGE_ID ?? 73),
    versionLabel: "Rust (Judge0)",
    fileName: () => "main.rs",
  },
  kotlin: {
    id: Number(process.env.JUDGE0_KOTLIN_LANGUAGE_ID ?? 78),
    versionLabel: "Kotlin (Judge0)",
    fileName: () => "Main.kt",
  },
  php: {
    id: Number(process.env.JUDGE0_PHP_LANGUAGE_ID ?? 68),
    versionLabel: "PHP (Judge0)",
    fileName: () => "main.php",
  },
  ruby: {
    id: Number(process.env.JUDGE0_RUBY_LANGUAGE_ID ?? 72),
    versionLabel: "Ruby (Judge0)",
    fileName: () => "main.rb",
  },
  csharp: {
    id: Number(process.env.JUDGE0_CSHARP_LANGUAGE_ID ?? 51),
    versionLabel: "C# Mono (Judge0)",
    fileName: () => "Main.cs",
  },
  sql: {
    id: Number(process.env.JUDGE0_SQL_LANGUAGE_ID ?? 82),
    versionLabel: "SQLite (Judge0)",
    fileName: () => "query.sql",
  },
};

type RunRequestBody = {
  code?: string;
  stdin?: string;
  language?: string;
};

type Judge0Status = {
  id: number;
  description: string;
};

type Judge0Submission = {
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  message?: string | null;
  time?: string | null;
  memory?: number | null;
  token?: string;
  status?: Judge0Status;
};

const STATUS = {
  IN_QUEUE: 1,
  PROCESSING: 2,
  ACCEPTED: 3,
  WRONG_ANSWER: 4,
  TIME_LIMIT: 5,
  COMPILATION_ERROR: 6,
  RUNTIME_ERROR_SIGSEGV: 7,
  RUNTIME_ERROR_SIGXFSZ: 8,
  RUNTIME_ERROR_SIGFPE: 9,
  RUNTIME_ERROR_SIGABRT: 10,
  RUNTIME_ERROR_NZEC: 11,
  RUNTIME_ERROR_OTHER: 12,
  INTERNAL_ERROR: 13,
  EXEC_FORMAT_ERROR: 14,
} as const;

function toBase64(value: string): string {
  return Buffer.from(value, "utf8").toString("base64");
}

function fromBase64(value: string | null | undefined): string {
  if (value == null || value === "") return "";
  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return value;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RunRequestBody;
    // Do not trim code body content beyond ends — only outer trim for emptiness check
    const codeRaw = body.code ?? "";
    const code = codeRaw.trim();
    // Keep stdin exactly as sent (newlines matter for Scanner)
    const stdin = typeof body.stdin === "string" ? body.stdin : "";
    const language = (body.language ?? "java").toLowerCase();

    if (!code) {
      return NextResponse.json(
        { ok: false, error: "No code provided." },
        { status: 400 }
      );
    }

    const langConfig = JUDGE0_LANG[language];
    if (!langConfig) {
      return NextResponse.json(
        {
          ok: false,
          error: `Language "${language}" is not run on the server. Use HTML/CSS preview or browser JS.`,
        },
        { status: 400 }
      );
    }

    if (code.length > 100_000) {
      return NextResponse.json(
        { ok: false, error: "Code is too large (max 100KB)." },
        { status: 400 }
      );
    }

    const fileName = langConfig.fileName(code);
    const className =
      language === "java" ? extractPublicClassName(code) : fileName;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (process.env.JUDGE0_API_KEY) {
      headers["X-Auth-Token"] = process.env.JUDGE0_API_KEY;
    }
    if (process.env.JUDGE0_RAPIDAPI_KEY) {
      headers["X-RapidAPI-Key"] = process.env.JUDGE0_RAPIDAPI_KEY;
      headers["X-RapidAPI-Host"] =
        process.env.JUDGE0_RAPIDAPI_HOST ?? "judge0-ce.p.rapidapi.com";
    }

    const submitUrl = `${JUDGE0_BASE.replace(/\/$/, "")}/submissions?base64_encoded=true&wait=true`;

    // Always send stdin as base64, including empty string encoding of ""
    // Judge0 requires base64_encoded=true for non-ASCII; empty is fine as ""
    const stdinB64 = toBase64(stdin);

    const judgeRes = await fetch(submitUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        language_id: langConfig.id,
        source_code: toBase64(code),
        stdin: stdinB64,
        cpu_time_limit: 5,
        wall_time_limit: 10,
        memory_limit: 128000,
      }),
      signal: AbortSignal.timeout(25_000),
    });

    if (!judgeRes.ok) {
      const text = await judgeRes.text().catch(() => "");
      return NextResponse.json(
        {
          ok: false,
          error: `Code runner failed (${judgeRes.status}). ${text.slice(0, 300)}`,
        },
        { status: 502 }
      );
    }

    const result = (await judgeRes.json()) as Judge0Submission;
    const statusId = result.status?.id ?? STATUS.INTERNAL_ERROR;
    const statusDesc = result.status?.description ?? "Unknown";

    const compileOutput = fromBase64(result.compile_output);
    const stdout = fromBase64(result.stdout);
    const stderr = fromBase64(result.stderr);
    const message = fromBase64(result.message);

    const compileFailed = statusId === STATUS.COMPILATION_ERROR;
    const accepted = statusId === STATUS.ACCEPTED;

    let runCode: number | null = null;
    if (accepted) runCode = 0;
    else if (compileFailed) runCode = 1;
    else if (statusId === STATUS.RUNTIME_ERROR_NZEC) runCode = 1;
    else if (
      statusId === STATUS.TIME_LIMIT ||
      statusId === STATUS.INTERNAL_ERROR
    ) {
      runCode = 124;
    } else if (statusId >= STATUS.RUNTIME_ERROR_SIGSEGV) {
      runCode = 1;
    } else {
      runCode = statusId === STATUS.WRONG_ANSWER ? 0 : 1;
    }

    const signal =
      statusId === STATUS.TIME_LIMIT
        ? "TIME_LIMIT"
        : statusId === STATUS.RUNTIME_ERROR_SIGSEGV
          ? "SIGSEGV"
          : statusId === STATUS.RUNTIME_ERROR_SIGABRT
            ? "SIGABRT"
            : null;

    let runStderr = stderr;
    if (
      !compileFailed &&
      !accepted &&
      !runStderr &&
      (message || statusDesc)
    ) {
      runStderr = [message, statusDesc !== "Accepted" ? statusDesc : ""]
        .filter(Boolean)
        .join("\n");
    }

    return NextResponse.json({
      ok: true,
      language,
      version: langConfig.versionLabel,
      fileName,
      className,
      compile: {
        stdout: "",
        stderr: compileFailed
          ? compileOutput || message || statusDesc
          : compileOutput,
        code: compileFailed ? 1 : 0,
        failed: compileFailed,
      },
      run: {
        stdout,
        stderr: compileFailed ? "" : runStderr,
        code: compileFailed ? null : runCode,
        signal: compileFailed ? null : signal,
        time: result.time ?? null,
        memory: result.memory ?? null,
        status: statusDesc,
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unexpected server error.";

    if (message.includes("TimeoutError") || message.includes("aborted")) {
      return NextResponse.json(
        { ok: false, error: "Execution timed out. Try simpler code." },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}

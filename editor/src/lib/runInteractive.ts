/** Detect when a Judge0 run stopped because the program needed more stdin. */
export function needsMoreInput(opts: {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: string | null;
  status?: string;
}): boolean {
  const err = `${opts.stderr}\n${opts.status ?? ""}`;

  // Java Scanner / nextInt / nextLine on exhausted stdin
  if (/NoSuchElementException/i.test(err)) return true;
  if (/No such element/i.test(err)) return true;

  // Python input() on EOF
  if (/EOFError/i.test(err)) return true;
  if (/EOF when reading a line/i.test(err)) return true;

  // Explicit markers from our samples / user code
  if (/(^|\n)\s*EOF\s*($|\n)/i.test(opts.stderr)) return true;
  if (/end of file|end of stream|failed to read input/i.test(err)) return true;

  // Go, Rust, Ruby, PHP, C#, Kotlin common EOF / scan failures
  if (/unexpected end of (JSON )?input|EOFException|Scanner.*exception/i.test(err))
    return true;
  if (/ErrUnexpectedEOF|io\.EOF|unexpected EOF/i.test(err)) return true;
  if (/gets: nil|undefined method.*for nil/i.test(err)) return true;

  // C/C++ often exit non-zero on failed scanf/cin with little stderr
  if (
    opts.exitCode !== null &&
    opts.exitCode !== 0 &&
    opts.signal == null &&
    !opts.stderr.trim() &&
    /enter|input|name|number|n\b|value/i.test(opts.stdout)
  ) {
    return true;
  }

  return false;
}

/** New stdout produced since the previous full run (programs restart each round). */
export function diffStdout(previous: string, current: string): string {
  if (!previous) return current;
  if (current.startsWith(previous)) return current.slice(previous.length);
  // Fallback: if output diverged, show full current (rare)
  return current;
}

export type InteractiveRunResult = {
  ok: boolean;
  compileFailed: boolean;
  version?: string;
  fileName?: string;
  exitCode: number | null;
  signal: string | null;
  time?: string | null;
  memory?: number | null;
  error?: string;
};

export type InteractiveIo = {
  /** Append terminal output */
  write: (
    kind: "stdout" | "stderr" | "system" | "info" | "error" | "success" | "input",
    text: string
  ) => void;
  /** Wait for one line from the user (real IDE style) */
  readLine: () => Promise<string>;
  /** Whether the user aborted the session */
  isAborted: () => boolean;
};

type Judge0Success = {
  ok: true;
  version: string;
  fileName: string;
  compile: {
    stdout: string;
    stderr: string;
    code: number | null;
    failed: boolean;
  };
  run: {
    stdout: string;
    stderr: string;
    code: number | null;
    signal: string | null;
    time?: string | null;
    memory?: number | null;
    status?: string;
  };
};

type Judge0Error = { ok: false; error: string };

/**
 * Run Judge0 languages in an interactive loop:
 * execute → if more input needed, wait for one line in the terminal → re-run with
 * accumulated stdin. Output is streamed like a real IDE (diffed between rounds).
 */
export async function runInteractiveJudge0(
  lang: string,
  code: string,
  io: InteractiveIo,
  options?: { maxRounds?: number }
): Promise<InteractiveRunResult> {
  const maxRounds = options?.maxRounds ?? 40;
  let stdin = "";
  let prevStdout = "";
  let lastVersion: string | undefined;
  let lastFile: string | undefined;
  let lastTime: string | null | undefined;
  let lastMemory: number | null | undefined;

  for (let round = 0; round < maxRounds; round++) {
    if (io.isAborted()) {
      return {
        ok: false,
        compileFailed: false,
        exitCode: null,
        signal: "ABORTED",
        error: "Run cancelled.",
      };
    }

    let data: Judge0Success | Judge0Error;
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, stdin, language: lang }),
      });
      data = (await res.json()) as Judge0Success | Judge0Error;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error";
      return {
        ok: false,
        compileFailed: false,
        exitCode: null,
        signal: null,
        error: message,
      };
    }

    if (!data.ok) {
      return {
        ok: false,
        compileFailed: false,
        exitCode: null,
        signal: null,
        error: data.error,
      };
    }

    lastVersion = data.version;
    lastFile = data.fileName;
    lastTime = data.run.time;
    lastMemory = data.run.memory;

    if (round === 0) {
      io.write("info", `${data.version} · ${data.fileName}`);
    }

    if (data.compile.failed) {
      const msg = data.compile.stderr || "Compilation failed.";
      io.write("stderr", msg);
      return {
        ok: false,
        compileFailed: true,
        version: data.version,
        fileName: data.fileName,
        exitCode: 1,
        signal: null,
        error: "Compilation failed.",
      };
    }

    if (data.compile.stderr) {
      io.write("info", data.compile.stderr);
    }

    const fullOut = data.run.stdout || "";
    const chunk = diffStdout(prevStdout, fullOut);
    if (chunk) {
      io.write("stdout", chunk);
    }
    prevStdout = fullOut;

    const more = needsMoreInput({
      stdout: fullOut,
      stderr: data.run.stderr || "",
      exitCode: data.run.code,
      signal: data.run.signal,
      status: data.run.status,
    });

    if (more) {
      // Don't show EOF errors to the user — wait for input instead
      if (io.isAborted()) {
        return {
          ok: false,
          compileFailed: false,
          exitCode: null,
          signal: "ABORTED",
          error: "Run cancelled.",
        };
      }

      const line = await io.readLine();
      if (io.isAborted()) {
        return {
          ok: false,
          compileFailed: false,
          exitCode: null,
          signal: "ABORTED",
          error: "Run cancelled.",
        };
      }

      io.write("input", line);
      stdin += `${line}\n`;
      continue;
    }

    // Finished (success or real runtime error)
    if (data.run.stderr) {
      io.write("stderr", data.run.stderr);
    }

    const exit = data.run.code;
    const signal = data.run.signal;

    if (signal) {
      io.write("error", `Process killed by signal: ${signal}`);
    } else if (exit === 0 || exit === null) {
      io.write("success", `Process finished with exit code ${exit ?? 0}`);
    } else {
      io.write("error", `Process finished with exit code ${exit}`);
    }

    return {
      ok: exit === 0 || exit === null,
      compileFailed: false,
      version: data.version,
      fileName: data.fileName,
      exitCode: exit,
      signal,
      time: lastTime,
      memory: lastMemory,
    };
  }

  return {
    ok: false,
    compileFailed: false,
    version: lastVersion,
    fileName: lastFile,
    exitCode: null,
    signal: null,
    error: "Too many input rounds. Check your program for an input loop.",
  };
}

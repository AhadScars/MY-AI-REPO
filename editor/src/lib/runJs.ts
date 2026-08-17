export type JsRunResult = {
  ok: boolean;
  logs: string[];
  errors: string[];
  result?: string;
  elapsedMs: number;
};

/**
 * Run JavaScript in the browser, capturing console.log / warn / error / info.
 * Isolated enough for simple snippets (not a full sandbox).
 */
export function runJavaScript(code: string): JsRunResult {
  const logs: string[] = [];
  const errors: string[] = [];
  const started = performance.now();

  const format = (args: unknown[]) =>
    args
      .map((a) => {
        if (typeof a === "string") return a;
        if (a instanceof Error) return a.stack || a.message;
        try {
          return JSON.stringify(a, null, 2);
        } catch {
          return String(a);
        }
      })
      .join(" ");

  const fakeConsole = {
    log: (...args: unknown[]) => logs.push(format(args)),
    info: (...args: unknown[]) => logs.push(format(args)),
    warn: (...args: unknown[]) => logs.push("[warn] " + format(args)),
    error: (...args: unknown[]) => errors.push(format(args)),
    debug: (...args: unknown[]) => logs.push(format(args)),
    clear: () => {
      logs.length = 0;
      errors.length = 0;
    },
  };

  try {
    // Async-friendly: wrap so top-level return works
    // eslint-disable-next-line no-new-func
    const fn = new Function(
      "console",
      `"use strict";\n${code}\n`
    );
    const ret = fn(fakeConsole);
    if (ret !== undefined) {
      logs.push(
        typeof ret === "string" ? ret : JSON.stringify(ret, null, 2) ?? String(ret)
      );
    }
    return {
      ok: errors.length === 0,
      logs,
      errors,
      elapsedMs: performance.now() - started,
    };
  } catch (err) {
    const message = err instanceof Error ? err.stack || err.message : String(err);
    errors.push(message);
    return {
      ok: false,
      logs,
      errors,
      elapsedMs: performance.now() - started,
    };
  }
}

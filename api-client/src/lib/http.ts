import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import type { HeaderRow, HttpMethod, ResponseData } from "@/store/requestStore";

function isTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  );
}

function buildHeaders(rows: HeaderRow[]): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const row of rows) {
    if (row.enabled && row.key.trim()) {
      headers[row.key.trim()] = row.value;
    }
  }
  return headers;
}

function headersToRecord(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

function corsHelpMessage(url: string, raw: string): string {
  const isBrowser = !isTauri();
  if (!isBrowser) return raw;

  const looksLikeNetworkFail =
    /failed to fetch|networkerror|load failed|cors|network request failed/i.test(
      raw
    );

  if (!looksLikeNetworkFail) return raw;

  return [
    `${raw}`,
    "",
    "This is almost always CORS when using npm run dev (browser).",
    "Postman does not enforce CORS, so the same Spring Boot API can work there.",
    "",
    "Fixes (pick one):",
    "1) Prefer the desktop app (no CORS):  npm run tauri:dev",
    "2) Keep browser mode — this app now proxies via Vite automatically.",
    "   Restart npm run dev after pulling this change, then try again.",
    "3) Or enable CORS on Spring Boot, e.g.:",
    "   @CrossOrigin(origins = \"http://localhost:1420\")",
    "   or a global CorsConfigurationSource allowing localhost:1420.",
    "",
    `Target URL: ${url}`,
  ].join("\n");
}

/**
 * Browser-only: send through Vite middleware so the browser never does a
 * cross-origin call (avoids CORS). Same idea as Postman — server-side hop.
 */
async function browserProxyFetch(
  url: string,
  method: HttpMethod,
  headers: Record<string, string>,
  body?: string
): Promise<Response> {
  const res = await fetch("/__proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      method,
      headers,
      body: body ?? null,
    }),
  });

  // Middleware returns the upstream status/headers/body directly.
  return res;
}

export async function sendRequest(options: {
  method: HttpMethod;
  url: string;
  headers: HeaderRow[];
  body: string;
}): Promise<ResponseData> {
  const { method, url, headers, body } = options;
  const trimmedUrl = url.trim();

  if (!trimmedUrl) {
    return {
      status: 0,
      statusText: "Error",
      headers: {},
      body: "",
      timeMs: 0,
      sizeBytes: 0,
      error: "URL is required",
    };
  }

  let finalUrl = trimmedUrl;
  if (!/^https?:\/\//i.test(finalUrl)) {
    // Local Spring Boot defaults to http, not https
    if (
      finalUrl.startsWith("localhost") ||
      finalUrl.startsWith("127.0.0.1") ||
      /^\d{1,3}(\.\d{1,3}){3}/.test(finalUrl)
    ) {
      finalUrl = `http://${finalUrl}`;
    } else {
      finalUrl = `https://${finalUrl}`;
    }
  }

  const requestHeaders = buildHeaders(headers);
  const hasBody =
    method !== "GET" && method !== "HEAD" && body.trim().length > 0;

  const start = performance.now();

  try {
    let response: Response;

    if (isTauri()) {
      const init: RequestInit = {
        method,
        headers: requestHeaders,
      };
      if (hasBody) init.body = body;
      response = await tauriFetch(finalUrl, init);
    } else {
      // Vite dev (and any same-origin host): go through proxy → no CORS
      response = await browserProxyFetch(
        finalUrl,
        method,
        requestHeaders,
        hasBody ? body : undefined
      );
    }

    const timeMs = performance.now() - start;
    const text = await response.text();
    const sizeBytes = new TextEncoder().encode(text).length;

    // Proxy protocol errors (e.g. bad payload) use 502 + text from middleware
    if (
      !isTauri() &&
      response.status === 502 &&
      text.startsWith("Proxy error:")
    ) {
      return {
        status: 0,
        statusText: "Proxy Error",
        headers: {},
        body: "",
        timeMs,
        sizeBytes: 0,
        error: corsHelpMessage(finalUrl, text.replace(/^Proxy error:\s*/i, "")),
      };
    }

    return {
      status: response.status,
      statusText: response.statusText || statusTextFallback(response.status),
      headers: headersToRecord(response.headers),
      body: text,
      timeMs,
      sizeBytes,
    };
  } catch (err) {
    const timeMs = performance.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: 0,
      statusText: "Network Error",
      headers: {},
      body: "",
      timeMs,
      sizeBytes: 0,
      error: corsHelpMessage(finalUrl, message),
    };
  }
}

function statusTextFallback(status: number): string {
  const map: Record<number, string> = {
    200: "OK",
    201: "Created",
    204: "No Content",
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    405: "Method Not Allowed",
    500: "Internal Server Error",
    502: "Bad Gateway",
    503: "Service Unavailable",
  };
  return map[status] ?? "";
}

export function prettyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export function statusVariant(
  status: number
): "success" | "warning" | "error" | "info" | "default" {
  if (status >= 200 && status < 300) return "success";
  if (status >= 300 && status < 400) return "info";
  if (status >= 400 && status < 500) return "warning";
  if (status >= 500) return "error";
  return "default";
}

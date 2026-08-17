import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import type { IncomingMessage, ServerResponse } from "http";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

/**
 * Dev-only reverse proxy so browser fetch can hit Spring Boot / any API
 * without CORS (same behavior as Postman / Tauri HTTP plugin).
 *
 * Client POSTs JSON to /__proxy:
 *   { url, method, headers, body }
 * Middleware forwards the request and streams the upstream response back.
 */
function httpProxyPlugin(): Plugin {
  return {
    name: "api-client-http-proxy",
    configureServer(server) {
      server.middlewares.use("/__proxy", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.end("Method Not Allowed");
          return;
        }

        void handleProxy(req, res).catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          if (!res.headersSent) {
            res.statusCode = 502;
            res.setHeader("Content-Type", "text/plain; charset=utf-8");
            res.end(`Proxy error: ${message}`);
          }
        });
      });
    },
  };
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function handleProxy(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const raw = await readBody(req);
  let payload: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string | null;
  };

  try {
    payload = JSON.parse(raw) as typeof payload;
  } catch {
    res.statusCode = 400;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Proxy error: invalid JSON body");
    return;
  }

  const targetUrl = (payload.url ?? "").trim();
  if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Proxy error: url must be absolute http(s)");
    return;
  }

  const method = (payload.method ?? "GET").toUpperCase();
  const headers = new Headers();
  for (const [k, v] of Object.entries(payload.headers ?? {})) {
    if (!k) continue;
    // Hop-by-hop / unsafe to forward from browser tooling
    const lower = k.toLowerCase();
    if (
      lower === "host" ||
      lower === "connection" ||
      lower === "content-length" ||
      lower === "origin" ||
      lower === "referer"
    ) {
      continue;
    }
    headers.set(k, v);
  }

  const init: RequestInit = {
    method,
    headers,
    // Node fetch follows redirects by default; fine for APIs
    redirect: "follow",
  };

  if (
    payload.body != null &&
    payload.body !== "" &&
    method !== "GET" &&
    method !== "HEAD"
  ) {
    init.body = payload.body;
  }

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, init);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.statusCode = 502;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(
      `Proxy error: could not reach ${targetUrl} — ${message}. Is Spring Boot running?`
    );
    return;
  }

  res.statusCode = upstream.status;
  // Expose useful upstream headers to the UI
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (
      lower === "transfer-encoding" ||
      lower === "connection" ||
      lower === "content-encoding"
    ) {
      return;
    }
    // Avoid duplicate set-cookie weirdness; still show in UI via custom header dump
    try {
      res.setHeader(key, value);
    } catch {
      // ignore invalid header names
    }
  });

  // Help the client know this went through the proxy
  res.setHeader("X-Api-Client-Proxy", "1");

  const buf = Buffer.from(await upstream.arrayBuffer());
  res.end(buf);
}

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss(), httpProxyPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));

import { isLangId, type LangId } from "@/lib/languages";

export type SharePayload = {
  /** language id */
  l: LangId;
  /** source code */
  c: string;
  /** optional stdin */
  s?: string;
  /** optional title */
  t?: string;
};

const SHARE_PARAM = "p";

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  const b64 =
    typeof btoa === "function"
      ? btoa(binary)
      : Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const b64 = padded + pad;
  if (typeof atob === "function") {
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(b64, "base64"));
}

/** Encode playground state into a shareable query value. */
export function encodeSharePayload(payload: SharePayload): string {
  const json = JSON.stringify({
    l: payload.l,
    c: payload.c,
    ...(payload.s ? { s: payload.s } : {}),
    ...(payload.t ? { t: payload.t } : {}),
  });
  const bytes = new TextEncoder().encode(json);
  return toBase64Url(bytes);
}

/** Decode share payload; returns null if invalid. */
export function decodeSharePayload(raw: string): SharePayload | null {
  try {
    const bytes = fromBase64Url(raw);
    const json = new TextDecoder().decode(bytes);
    const data = JSON.parse(json) as Partial<SharePayload>;
    if (!data.l || !isLangId(data.l) || typeof data.c !== "string") return null;
    return {
      l: data.l,
      c: data.c,
      s: typeof data.s === "string" ? data.s : undefined,
      t: typeof data.t === "string" ? data.t : undefined,
    };
  } catch {
    return null;
  }
}

/** Build a full share URL for the current origin + path. */
export function buildShareUrl(
  origin: string,
  pathname: string,
  payload: SharePayload
): string {
  const encoded = encodeSharePayload(payload);
  const url = new URL(pathname || "/", origin);
  url.searchParams.set(SHARE_PARAM, encoded);
  return url.toString();
}

/** Read share payload from the current URL (if any). */
export function readShareFromLocation(
  search: string
): SharePayload | null {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search
  );
  const raw = params.get(SHARE_PARAM);
  if (!raw) return null;
  return decodeSharePayload(raw);
}

export { SHARE_PARAM };

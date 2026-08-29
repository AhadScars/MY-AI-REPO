const TUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;

function parseYouTubeId(input) {
  if (!input) return null;
  const raw = String(input).trim();
  if (TUBE_ID_RE.test(raw)) return raw;

  let url;
  try {
    url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^(www|m|music)\./, "");
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0] || "";
    return TUBE_ID_RE.test(id) ? id : null;
  }

  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const v = url.searchParams.get("v");
    if (TUBE_ID_RE.test(v || "")) return v;

    const parts = url.pathname.split("/").filter(Boolean);
    if (
      parts.length >= 2 &&
      ["shorts", "embed", "live", "v", "e", "watch"].includes(parts[0]) &&
      TUBE_ID_RE.test(parts[1])
    ) {
      return parts[1];
    }
  }

  return null;
}

function watchUrl(id) {
  return `https://www.youtube.com/watch?v=${id}`;
}

function thumbnailUrl(id, quality = "hqdefault") {
  return `https://i.ytimg.com/vi/${id}/${quality}.jpg`;
}

function sanitizeFilename(name, fallback = "youtube-video") {
  const cleaned = String(name || "")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  return cleaned || fallback;
}

function formatDuration(seconds) {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n < 0) return "";
  const s = Math.floor(n % 60);
  const m = Math.floor(n / 60) % 60;
  const h = Math.floor(n / 3600);
  if (h) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function emptyVideo() {
  return {
    id: null,
    url: "",
    title: "",
    channel: "",
    duration: "",
    durationSeconds: 0,
    thumbnail: "",
    isLive: false,
    pageUrl: ""
  };
}

if (typeof globalThis !== "undefined") {
  globalThis.parseYouTubeId = parseYouTubeId;
  globalThis.watchUrl = watchUrl;
  globalThis.thumbnailUrl = thumbnailUrl;
  globalThis.sanitizeFilename = sanitizeFilename;
  globalThis.formatDuration = formatDuration;
  globalThis.emptyVideo = emptyVideo;
  globalThis.TUBE_ID_RE = TUBE_ID_RE;
}

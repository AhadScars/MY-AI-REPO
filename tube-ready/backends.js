const DEFAULT_INVIDIOUS = [
  "https://inv.nadeko.net",
  "https://invidious.nerdvpn.de",
  "https://yt.artemislena.eu",
  "https://invidious.privacyredirect.com",
  "https://invidious.protokolla.fi",
  "https://iv.ggtyler.dev",
  "https://invidious.flokinet.to",
  "https://yewtu.be"
];

const DEFAULT_PIPED = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
  "https://api.piped.private.coffee",
  "https://pipedapi.nosebs.ru"
];

const DEFAULT_COBALT = [];

const DEFAULT_COBALT_FRONTENDS = [
  "https://cobalt.3kh0.net",
  "https://cobalt.canine.tools",
  "https://cobalt.meowing.de"
];

async function fetchJson(url, options = {}, timeoutMs = 9000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: ctrl.signal,
      headers: {
        Accept: "application/json",
        ...(options.headers || {})
      }
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function firstSuccess(items, worker, limit = 4) {
  const errors = [];
  const queue = items.slice(0, limit);
  for (const item of queue) {
    try {
      const result = await worker(item);
      if (result) return result;
    } catch (err) {
      errors.push(`${item}: ${err.message || err}`);
    }
  }
  const fail = new Error(errors[0] || "All backends failed");
  fail.details = errors;
  throw fail;
}

function heightFromLabel(label) {
  const m = String(label || "").match(/(\d{3,4})/);
  return m ? Number(m[1]) : 0;
}

function mimeOf(f) {
  return f.mimeType || f.type || f.mime || "";
}

function extFromMime(mime, fallback) {
  const container = String(mime || fallback || "mp4")
    .split(";")[0]
    .split("/")
    .pop();
  if (container.includes("webm")) return "webm";
  if (container.includes("mp4") && /audio/i.test(mime)) return "m4a";
  return container.includes("mp4") ? "mp4" : fallback || "mp4";
}

function normalizeMuxed(list) {
  return (list || [])
    .filter((f) => f && f.url)
    .map((f) => {
      const height =
        Number(f.height) ||
        heightFromLabel(f.qualityLabel || f.quality || f.resolution) ||
        0;
      const mime = mimeOf(f);
      return {
        kind: "muxed",
        itag: String(f.itag || ""),
        label: f.qualityLabel || f.quality || (height ? `${height}p` : "Video"),
        height,
        url: f.url,
        mime,
        ext: extFromMime(mime, "mp4"),
        size: f.contentLength || f.clen || f.size || null
      };
    })
    .sort((a, b) => b.height - a.height);
}

function normalizeVideo(list) {
  return (list || [])
    .filter((f) => f && f.url && /video\//i.test(mimeOf(f)))
    .map((f) => {
      const height =
        Number(f.height) ||
        heightFromLabel(f.qualityLabel || f.quality || f.resolution) ||
        0;
      const mime = mimeOf(f);
      return {
        kind: "video",
        itag: String(f.itag || ""),
        label: f.qualityLabel || (height ? `${height}p` : "Video"),
        height,
        url: f.url,
        mime,
        ext: extFromMime(mime, "mp4"),
        size: f.contentLength || f.clen || f.size || null
      };
    })
    .sort((a, b) => b.height - a.height);
}

function normalizeAudio(list) {
  return (list || [])
    .filter((f) => f && f.url && /audio/i.test(mimeOf(f)))
    .map((f) => {
      const bitrate = Number(f.bitrate || f.audioBitrate || 0);
      const mime = mimeOf(f);
      return {
        kind: "audio",
        itag: String(f.itag || ""),
        label: f.audioQuality || `${Math.round(bitrate / 1000) || "?"}kbps`,
        bitrate,
        url: f.url,
        mime,
        ext: extFromMime(mime, "m4a")
      };
    })
    .sort((a, b) => b.bitrate - a.bitrate);
}

function pickFormat(formats, quality, mode) {
  const set = pickDownloadSet(formats, quality, mode);
  return set?.files?.[0] || null;
}

function pickDownloadSet(formats, quality, mode) {
  if (mode === "audio") {
    const audio = (formats.audio || [])[0];
    return audio ? { files: [audio] } : null;
  }
  const wanted = quality === "max" ? 9999 : Number(quality) || 720;
  const muxed = formats.muxed || [];
  const videos = formats.video || [];
  const audio = (formats.audio || [])[0];
  const exactMux = muxed.find((f) => f.height === wanted);
  if (exactMux) return { files: [exactMux] };
  const underMux = muxed.find((f) => f.height <= wanted) || muxed[0] || null;
  const exactVid =
    videos.find((f) => f.height === wanted) ||
    videos.find((f) => f.height <= wanted) ||
    videos[0] ||
    null;

  if (exactVid && audio && (!underMux || exactVid.height > (underMux.height || 0) + 80)) {
    return {
      files: [exactVid, audio],
      paired: true,
      note: "Saved video and audio as two files (higher quality is split)."
    };
  }
  if (underMux) return { files: [underMux] };
  if (exactVid && audio) {
    return {
      files: [exactVid, audio],
      paired: true,
      note: "Saved video and audio as two files."
    };
  }
  return exactVid ? { files: [exactVid] } : null;
}

function formatsFromPlayer(player) {
  const sd = player?.streamingData || {};
  const details = player?.videoDetails || {};
  return {
    source: "page",
    title: details.title || "",
    channel: details.author || "",
    durationSeconds: Number(details.lengthSeconds || 0),
    isLive: Boolean(details.isLiveContent && !sd.formats),
    muxed: normalizeMuxed(sd.formats || []),
    video: normalizeVideo(sd.adaptiveFormats || []),
    audio: normalizeAudio(sd.adaptiveFormats || []),
    thumbnail: (details.thumbnail?.thumbnails || []).slice(-1)[0]?.url || ""
  };
}

function emptyFormats() {
  return { muxed: [], video: [], audio: [], source: "" };
}

function mergeFormats(base, extra) {
  const next = {
    muxed: [...(base?.muxed || [])],
    video: [...(base?.video || [])],
    audio: [...(base?.audio || [])],
    source: extra?.source || base?.source || "",
    title: extra?.title || base?.title || "",
    channel: extra?.channel || base?.channel || "",
    durationSeconds: extra?.durationSeconds || base?.durationSeconds || 0,
    isLive: Boolean(extra?.isLive || base?.isLive),
    thumbnail: extra?.thumbnail || base?.thumbnail || ""
  };
  const take = (key, items) => {
    for (const item of items || []) {
      if (!item?.url) continue;
      const dup = next[key].find((f) => (item.itag && f.itag === item.itag) || f.url === item.url);
      if (!dup) next[key].push(item);
    }
    next[key].sort((a, b) => (b.height || b.bitrate || 0) - (a.height || a.bitrate || 0));
  };
  take("muxed", extra?.muxed);
  take("video", extra?.video);
  take("audio", extra?.audio);
  return next;
}

async function loadInvidiousHosts() {
  try {
    const list = await fetchJson("https://api.invidious.io/instances.json", {}, 6000);
    const urls = (list || [])
      .map((row) => {
        const meta = Array.isArray(row) ? row[1] : row;
        const uri = meta?.uri || (Array.isArray(row) ? row[0] : "");
        if (!meta || meta.type !== "https" || meta.api === false) return null;
        return String(uri).replace(/\/$/, "");
      })
      .filter(Boolean);
    return [...new Set([...urls.slice(0, 10), ...DEFAULT_INVIDIOUS])];
  } catch {
    return DEFAULT_INVIDIOUS;
  }
}

async function fetchInvidious(videoId) {
  const hosts = await loadInvidiousHosts();
  return firstSuccess(hosts, async (host) => {
    const data = await fetchJson(`${host}/api/v1/videos/${videoId}?local=true`);
    if (!data || data.error) throw new Error(data?.error || "Empty Invidious response");
    const muxed = normalizeMuxed(data.formatStreams || []);
    const audio = normalizeAudio(data.adaptiveFormats || []);
    if (!muxed.length && !audio.length) throw new Error("No streams");
    return {
      source: `invidious:${host}`,
      title: data.title || "",
      channel: data.author || "",
      durationSeconds: Number(data.lengthSeconds || 0),
      isLive: Boolean(data.liveNow),
      muxed,
      audio,
      thumbnail:
        (data.videoThumbnails || []).find((t) => t.quality === "maxresdefault")?.url ||
        (data.videoThumbnails || [])[0]?.url ||
        ""
    };
  });
}

async function fetchPiped(videoId) {
  return firstSuccess(DEFAULT_PIPED, async (host) => {
    const data = await fetchJson(`${host}/streams/${videoId}`);
    if (!data || data.error) throw new Error(data?.error || "Empty Piped response");
    const muxed = (data.videoStreams || [])
      .filter((s) => s.url && s.videoOnly === false)
      .map((s) => ({
        kind: "muxed",
        itag: "",
        label: s.quality || `${s.height || ""}p`,
        height: Number(s.height) || heightFromLabel(s.quality),
        url: s.url,
        mime: s.mimeType || "video/mp4",
        ext: (s.mimeType || "").includes("webm") ? "webm" : "mp4"
      }))
      .sort((a, b) => b.height - a.height);
    const audio = (data.audioStreams || [])
      .filter((s) => s.url)
      .map((s) => ({
        kind: "audio",
        itag: "",
        label: s.quality || `${Math.round((s.bitrate || 0) / 1000)}kbps`,
        bitrate: Number(s.bitrate || 0),
        url: s.url,
        mime: s.mimeType || "audio/mp4",
        ext: (s.mimeType || "").includes("webm") ? "webm" : "m4a"
      }))
      .sort((a, b) => b.bitrate - a.bitrate);
    if (!muxed.length && !audio.length) throw new Error("No streams");
    return {
      source: `piped:${host}`,
      title: data.title || "",
      channel: data.uploader || "",
      durationSeconds: Number(data.duration || 0),
      isLive: Boolean(data.livestream),
      muxed,
      audio,
      thumbnail: data.thumbnailUrl || ""
    };
  });
}

async function fetchOEmbed(videoId) {
  const data = await fetchJson(
    `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl(videoId))}&format=json`,
    {},
    7000
  );
  return {
    title: data.title || "",
    channel: data.author_name || "",
    thumbnail: data.thumbnail_url || thumbnailUrl(videoId, "hqdefault")
  };
}

async function fetchInnertube(videoId) {
  const clients = [
    {
      clientName: "ANDROID",
      clientVersion: "20.10.38",
      androidSdkVersion: 34,
      ua: "com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip"
    },
    {
      clientName: "IOS",
      clientVersion: "20.10.4",
      ua: "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 17_4 like Mac OS X)"
    }
  ];

  const errors = [];
  for (const client of clients) {
    try {
      const ctxClient = {
        clientName: client.clientName,
        clientVersion: client.clientVersion,
        hl: "en",
        gl: "US"
      };
      if (client.androidSdkVersion) ctxClient.androidSdkVersion = client.androidSdkVersion;
      const data = await fetchJson(
        "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": client.ua
          },
          body: JSON.stringify({
            context: { client: ctxClient },
            videoId,
            contentCheckOk: true,
            racyCheckOk: true
          })
        },
        15000
      );
      const status = data?.playabilityStatus?.status;
      if (status && status !== "OK") {
        errors.push(`${client.clientName}: ${status}`);
        continue;
      }
      const parsed = formatsFromPlayer(data);
      parsed.source = `innertube:${client.clientName}`;
      if (parsed.muxed.length || parsed.audio.length || parsed.video.length) {
        return parsed;
      }
      errors.push(`${client.clientName}: no stream URLs`);
    } catch (err) {
      errors.push(`${client.clientName}: ${err.message || err}`);
    }
  }
  throw new Error(errors[0] || "YouTube player API returned no streams");
}

async function cobaltDownload(videoUrl, settings) {
  const quality = settings.quality === "audio" ? "1080" : settings.quality || "720";
  const body = {
    url: videoUrl,
    videoQuality: quality === "max" ? "1080" : String(quality),
    downloadMode: settings.mode === "audio" ? "audio" : "auto",
    filenameStyle: "pretty",
    youtubeVideoCodec: "h264",
    audioFormat: "mp3"
  };

  const custom = (settings.cobaltApi || "").replace(/\/$/, "");
  if (!custom) {
    throw new Error("Official cobalt.tools blocked YouTube");
  }

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json"
  };
  if (settings.cobaltKey) {
    headers.Authorization = `Api-Key ${settings.cobaltKey}`;
  }
  const data = await fetchJson(
    `${custom}/`,
    { method: "POST", headers, body: JSON.stringify(body) },
    20000
  );
  if (!data || data.status === "error") {
    throw new Error(data?.error?.code || "Cobalt error");
  }
  if (data.status === "tunnel" || data.status === "redirect") {
    return {
      url: data.url,
      filename: data.filename,
      source: `cobalt:${custom}`
    };
  }
  throw new Error(`Cobalt status ${data.status}`);
}

function cobaltWebUrl(videoUrl, frontend) {
  const raw = (frontend || DEFAULT_COBALT_FRONTENDS[0] || "https://cobalt.3kh0.net").replace(/\/$/, "");
  return `${raw}/#${videoUrl}`;
}

if (typeof globalThis !== "undefined") {
  globalThis.fetchJson = fetchJson;
  globalThis.formatsFromPlayer = formatsFromPlayer;
  globalThis.fetchInnertube = fetchInnertube;
  globalThis.fetchInvidious = fetchInvidious;
  globalThis.fetchPiped = fetchPiped;
  globalThis.fetchOEmbed = fetchOEmbed;
  globalThis.cobaltDownload = cobaltDownload;
  globalThis.cobaltWebUrl = cobaltWebUrl;
  globalThis.pickFormat = pickFormat;
  globalThis.pickDownloadSet = pickDownloadSet;
  globalThis.mergeFormats = mergeFormats;
  globalThis.emptyFormats = emptyFormats;
  globalThis.DEFAULT_COBALT_FRONTENDS = DEFAULT_COBALT_FRONTENDS;
  globalThis.heightFromLabel = heightFromLabel;
  globalThis.extFromMime = extFromMime;
}

importScripts("detect.js", "backends.js");

const YTDLP_HOST = "com.tubeready.yt_dlp";
let ytdlpCache = { checkedAt: 0, info: null };

const DEFAULT_SETTINGS = {
  quality: "720",
  mode: "video",
  showOverlay: true,
  cobaltApi: "",
  cobaltKey: "",
  cobaltFrontend: "https://cobalt.3kh0.net"
};

const state = {
  video: emptyVideo(),
  formats: emptyFormats(),
  status: "idle",
  error: "",
  download: null,
  tabId: null
};

async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...stored };
}

function nativeCall(message, { onProgress, timeoutMs = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let port;
    try {
      port = chrome.runtime.connectNative(YTDLP_HOST);
    } catch (err) {
      reject(err);
      return;
    }
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        port.disconnect();
      } catch {
        /* already closed */
      }
      fn(value);
    };
    const timer = setTimeout(() => finish(reject, new Error("yt-dlp helper timed out")), timeoutMs);
    port.onMessage.addListener((msg) => {
      if (msg?.type === "progress") {
        if (onProgress) onProgress(msg);
        return;
      }
      if (msg?.type === "error" || msg?.ok === false) {
        finish(reject, new Error(msg.error || "yt-dlp failed"));
        return;
      }
      finish(resolve, msg);
    });
    port.onDisconnect.addListener(() => {
      const err = chrome.runtime.lastError?.message || "yt-dlp helper is not installed";
      finish(reject, new Error(err));
    });
    try {
      port.postMessage(message);
    } catch (err) {
      finish(reject, err);
    }
  });
}

async function getYtDlpInfo(force = false) {
  const now = Date.now();
  if (!force && ytdlpCache.info && now - ytdlpCache.checkedAt < 20000) {
    return ytdlpCache.info;
  }
  try {
    const info = await nativeCall({ type: "ping" }, { timeoutMs: 5000 });
    ytdlpCache = { checkedAt: now, info: { ok: true, ...info } };
  } catch (err) {
    ytdlpCache = {
      checkedAt: now,
      info: { ok: false, error: err.message || "yt-dlp helper is not installed" }
    };
  }
  return ytdlpCache.info;
}

async function downloadWithYtDlp({ url, quality, mode }) {
  return nativeCall(
    { type: "download", url, quality, mode },
    {
      timeoutMs: 30 * 60 * 1000,
      onProgress: (msg) => {
        state.status = "downloading";
        state.download = {
          ...(state.download || {}),
          progress: msg.percent || 0,
          state: "in_progress",
          source: "yt-dlp",
          note: msg.line || "Downloading with yt-dlp…"
        };
        broadcast();
      }
    }
  );
}

async function setBadge(tabId, text, color = "#ff375f") {
  if (!tabId) return;
  try {
    await chrome.action.setBadgeBackgroundColor({ tabId, color });
    await chrome.action.setBadgeTextColor({ tabId, color: "#ffffff" });
    await chrome.action.setBadgeText({ tabId, text: text || "" });
  } catch {
    /* tab may be gone */
  }
}

function stripUrls(list) {
  return (list || []).map(({ url, ...rest }) => rest);
}

function snapshot() {
  return {
    video: state.video,
    formats: {
      muxed: stripUrls(state.formats.muxed),
      video: stripUrls(state.formats.video),
      audio: stripUrls(state.formats.audio),
      source: state.formats.source
    },
    status: state.status,
    error: state.error,
    download: state.download,
    ytdlp: ytdlpCache.info,
    ready: Boolean(state.video.id)
  };
}

async function broadcast() {
  const payload = { type: "STATE", state: snapshot() };
  if (state.tabId) {
    try {
      await chrome.tabs.sendMessage(state.tabId, payload);
    } catch {
      /* content script not ready */
    }
  }
}

async function rememberHistory(video) {
  if (!video?.id) return;
  const { history = [] } = await chrome.storage.local.get("history");
  const next = [
    {
      id: video.id,
      title: video.title,
      channel: video.channel,
      thumbnail: video.thumbnail,
      url: video.url,
      at: Date.now()
    },
    ...history.filter((item) => item.id !== video.id)
  ].slice(0, 12);
  await chrome.storage.local.set({ history: next });
}

async function enrichVideo(video) {
  const next = { ...video };
  if (!next.title || next.title === "YouTube" || /^- YouTube$/.test(next.title)) {
    try {
      const meta = await fetchOEmbed(next.id);
      next.title = next.title || meta.title;
      next.channel = next.channel || meta.channel;
      next.thumbnail = next.thumbnail || meta.thumbnail;
    } catch {
      /* oEmbed is optional */
    }
  }
  if (!next.thumbnail) next.thumbnail = thumbnailUrl(next.id, "hqdefault");
  if (!next.url) next.url = watchUrl(next.id);
  return next;
}

async function loadFormats(videoId, pageFormats) {
  let formats = mergeFormats(emptyFormats(), pageFormats || emptyFormats());
  try {
    formats = mergeFormats(formats, await fetchInnertube(videoId));
  } catch {
    /* try public mirrors next */
  }
  if (formats.muxed.length || formats.audio.length || formats.video.length) {
    return formats;
  }
  try {
    return mergeFormats(formats, await fetchInvidious(videoId));
  } catch (invidiousErr) {
    try {
      return mergeFormats(formats, await fetchPiped(videoId));
    } catch (pipedErr) {
      const err = new Error("Could not load downloadable formats");
      err.details = [invidiousErr.message, pipedErr.message];
      throw err;
    }
  }
}

async function detectVideo(partial, tabId) {
  const id = partial?.id || parseYouTubeId(partial?.url || partial?.pageUrl || "");
  if (!id) {
    state.video = emptyVideo();
    state.formats = emptyFormats();
    state.status = "idle";
    state.error = "";
    state.tabId = tabId || state.tabId;
    await setBadge(state.tabId, "");
    await broadcast();
    return snapshot();
  }

  const same =
    state.video.id === id &&
    (state.formats.muxed.length || state.formats.audio.length || state.formats.video.length);
  state.tabId = tabId || state.tabId;
  state.video = await enrichVideo({
    ...emptyVideo(),
    ...state.video,
    ...partial,
    id,
    url: watchUrl(id),
    thumbnail: partial?.thumbnail || thumbnailUrl(id, "hqdefault")
  });
  state.status = same ? "ready" : "loading";
  state.error = "";
  await setBadge(state.tabId, "ON");
  await rememberHistory(state.video);
  await broadcast();

  if (same) return snapshot();

  try {
    const formats = await loadFormats(id, partial?.formats || null);
    if (formats.title && !state.video.title) state.video.title = formats.title;
    if (formats.channel && !state.video.channel) state.video.channel = formats.channel;
    if (formats.durationSeconds) {
      state.video.durationSeconds = formats.durationSeconds;
      state.video.duration = formatDuration(formats.durationSeconds);
    }
    if (formats.isLive) state.video.isLive = true;
    state.formats = mergeFormats(emptyFormats(), formats);
    state.status = state.video.isLive ? "live" : "ready";
    await setBadge(state.tabId, state.video.isLive ? "LIVE" : "RDY", state.video.isLive ? "#f59e0b" : "#16a34a");
  } catch (err) {
    state.status = "ready";
    state.error = "";
    state.formats = emptyFormats();
    await setBadge(state.tabId, "RDY", "#16a34a");
  }

  await rememberHistory(state.video);
  await broadcast();
  return snapshot();
}

async function startDownload({ quality, mode, via } = {}) {
  if (!state.video.id) throw new Error("No YouTube video detected");
  if (state.video.isLive) throw new Error("Live streams cannot be downloaded");

  const settings = await getSettings();
  const q = quality || settings.quality;
  const m = mode || settings.mode;
  state.status = "downloading";
  state.error = "";
  state.download = { progress: 0, filename: "", state: "in_progress" };
  await broadcast();

  const filenameBase = sanitizeFilename(state.video.title || state.video.id);

  const finishWithUrl = async (url, filename, source) => {
    const downloadId = await chrome.downloads.download({
      url,
      filename: `TubeReady/${filename}`,
      saveAs: false,
      conflictAction: "uniquify"
    });
    state.download = {
      id: downloadId,
      filename,
      source,
      progress: 0,
      state: "in_progress"
    };
    return snapshot();
  };

  const openFrontend = async () => {
    const tab = await chrome.tabs.create({
      url: cobaltWebUrl(state.video.url, settings.cobaltFrontend),
      active: true
    });
    state.status = "ready";
    state.download = { state: "opened", filename: "", progress: 1, tabId: tab.id };
    await broadcast();
    return snapshot();
  };

  try {
    if (via !== "cobalt") {
      try {
        const ytdlp = await downloadWithYtDlp({ url: state.video.url, quality: q, mode: m });
        state.status = "ready";
        state.download = {
          state: "complete",
          progress: 1,
          filename: ytdlp.filename || filenameBase,
          source: "yt-dlp",
          filepath: ytdlp.filepath || "",
          note: ytdlp.filepath ? `Saved with yt-dlp: ${ytdlp.filename}` : "Saved with yt-dlp"
        };
        await broadcast();
        return snapshot();
      } catch (ytdlpErr) {
        ytdlpCache = {
          checkedAt: Date.now(),
          info: { ok: false, error: ytdlpErr.message || "yt-dlp helper is not installed" }
        };
        if (via === "ytdlp") throw ytdlpErr;
        /* fall through to in-page / Cobalt */
      }
    }

    if (via === "cobalt") {
      if (settings.cobaltApi) {
        try {
          const cobalt = await cobaltDownload(state.video.url, { ...settings, quality: q, mode: m });
          return await finishWithUrl(cobalt.url, cobalt.filename || `${filenameBase}.mp4`, cobalt.source);
        } catch {
          /* community frontend next */
        }
      }
      return await openFrontend();
    }

    if (!state.formats.muxed.length && !state.formats.audio.length && !state.formats.video.length) {
      try {
        state.formats = await loadFormats(state.video.id, state.formats);
      } catch {
        /* still try frontend */
      }
    }

    const pack = pickDownloadSet(state.formats, q, m);
    if (pack?.files?.length) {
      try {
        let last = null;
        for (const file of pack.files) {
          const suffix = pack.paired ? `.${file.kind}` : "";
          last = await finishWithUrl(
            file.url,
            `${filenameBase}${suffix}.${file.ext}`,
            state.formats.source || "direct"
          );
        }
        if (pack.note) state.error = "";
        state.download = { ...(state.download || {}), note: pack.note || "" };
        return last;
      } catch {
        /* fall through */
      }
    }

    return await openFrontend();
  } catch (err) {
    try {
      return await openFrontend();
    } catch {
      state.status = "error";
      state.error = err.message || "Download failed";
      state.download = null;
      await broadcast();
      throw err;
    }
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: "tubeready-download",
    title: "Download with TubeReady",
    contexts: ["page", "link", "video"],
    documentUrlPatterns: [
      "*://*.youtube.com/*",
      "*://youtu.be/*",
      "*://*.youtu.be/*",
      "*://*.youtube-nocookie.com/*"
    ]
  });
  chrome.contextMenus.create({
    id: "tubeready-link",
    title: "Download this YouTube link",
    contexts: ["link"],
    targetUrlPatterns: [
      "*://*.youtube.com/*",
      "*://youtu.be/*",
      "*://*.youtu.be/*"
    ]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const url = info.linkUrl || info.pageUrl || tab?.url || "";
  const id = parseYouTubeId(url);
  if (!id) return;
  await detectVideo({ id, url: watchUrl(id), pageUrl: url }, tab?.id);
  try {
    await startDownload();
  } catch {
    const settings = await getSettings();
    await chrome.tabs.create({ url: cobaltWebUrl(watchUrl(id), settings.cobaltFrontend) });
  }
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== "download-current") return;
  if (tab?.url) {
    await detectVideo({ url: tab.url, pageUrl: tab.url }, tab.id);
  }
  try {
    await startDownload();
  } catch {
    if (state.video.id) {
      const settings = await getSettings();
      await chrome.tabs.create({ url: cobaltWebUrl(state.video.url, settings.cobaltFrontend) });
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  const run = async () => {
    switch (message?.type) {
      case "DETECTED":
        return detectVideo(message.video || {}, tabId);
      case "PAGE_FORMATS":
        if (message.formats && state.video.id) {
          state.formats = mergeFormats(state.formats, message.formats);
          if (state.formats.muxed.length || state.formats.audio.length || state.formats.video.length) {
            state.status = "ready";
            await broadcast();
          }
        }
        return snapshot();
      case "GET_STATE":
        await getYtDlpInfo();
        return snapshot();
      case "PING_YTDLP":
        return getYtDlpInfo(true);
      case "GET_HISTORY": {
        const { history = [] } = await chrome.storage.local.get("history");
        return { history };
      }
      case "GET_SETTINGS":
        return getSettings();
      case "SAVE_SETTINGS":
        await chrome.storage.sync.set(message.settings || {});
        return getSettings();
      case "RESOLVE_URL": {
        const id = parseYouTubeId(message.url);
        if (!id) throw new Error("That is not a YouTube video link");
        return detectVideo({ id, url: watchUrl(id), pageUrl: message.url }, tabId);
      }
      case "DOWNLOAD":
        return startDownload(message);
      case "OPEN_COBALT": {
        const url = state.video.url || message.url;
        if (!url) throw new Error("No video link");
        const settings = await getSettings();
        await chrome.tabs.create({ url: cobaltWebUrl(url, settings.cobaltFrontend) });
        return { ok: true };
      }
      case "CLEAR":
        state.video = emptyVideo();
        state.formats = emptyFormats();
        state.status = "idle";
        state.error = "";
        return snapshot();
      default:
        return { error: "Unknown message" };
    }
  };

  run()
    .then(sendResponse)
    .catch((err) => sendResponse({ error: err.message || String(err) }));
  return true;
});

chrome.downloads.onChanged.addListener((delta) => {
  if (!state.download?.id || delta.id !== state.download.id) return;
  if (delta.state?.current) state.download.state = delta.state.current;
  if (delta.filename?.current) {
    state.download.filename = delta.filename.current.split(/[/\\]/).pop();
  }
  if (state.download.state === "complete") {
    state.status = "ready";
    state.download.progress = 1;
  }
  if (state.download.state === "interrupted") {
    state.status = "error";
    state.error = "Download was interrupted";
  }
  broadcast();
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    const id = parseYouTubeId(tab.url || "");
    if (id) await detectVideo({ id, url: tab.url, pageUrl: tab.url }, tabId);
  } catch {
    /* ignore */
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url && changeInfo.status !== "complete") return;
  const url = changeInfo.url || tab.url || "";
  const id = parseYouTubeId(url);
  if (id) await detectVideo({ id, url, pageUrl: url }, tabId);
});

function capturePlayback(details) {
  try {
    const parsed = new URL(details.url);
    if (!parsed.hostname.includes("googlevideo.com")) return;
    if (!parsed.pathname.includes("videoplayback")) return;
    if (details.tabId !== state.tabId && state.tabId) return;
    const mime = decodeURIComponent(parsed.searchParams.get("mime") || "");
    const itag = parsed.searchParams.get("itag") || "";
    const size = parsed.searchParams.get("size") || "";
    const sizeH = /x(\d+)$/i.exec(size);
    const height = sizeH ? Number(sizeH[1]) : heightFromLabel(size) || 0;
    const item = {
      itag,
      url: details.url,
      mime,
      label: height ? `${height}p` : itag,
      height,
      ext: extFromMime(mime, /audio/i.test(mime) ? "m4a" : "mp4"),
      bitrate: Number(parsed.searchParams.get("bitrate") || 0)
    };
    if (/audio/i.test(mime)) {
      item.kind = "audio";
      state.formats = mergeFormats(state.formats, { audio: [item], source: "player" });
    } else if (/,/.test(mime) || /mp4a|opus/i.test(mime)) {
      item.kind = "muxed";
      state.formats = mergeFormats(state.formats, { muxed: [item], source: "player" });
    } else {
      item.kind = "video";
      state.formats = mergeFormats(state.formats, { video: [item], source: "player" });
    }
  } catch {
    /* ignore bad URLs */
  }
}

if (chrome.webRequest?.onBeforeRequest) {
  chrome.webRequest.onBeforeRequest.addListener(capturePlayback, {
    urls: ["*://*.googlevideo.com/videoplayback*"]
  });
}

(() => {
  const HOST_ID = "tube-ready-root";
  let host = null;
  let shadow = null;
  let lastId = null;
  let expanded = false;
  let current = emptyVideo();
  let appState = { status: "idle", formats: { muxed: [], audio: [] }, ready: false, error: "" };
  let settings = { showOverlay: true, quality: "720", mode: "video" };

  function scrape() {
    const id = parseYouTubeId(location.href);
    if (!id) return emptyVideo();

    const title =
      document.querySelector("h1.ytd-watch-metadata yt-formatted-string")?.textContent?.trim() ||
      document.querySelector("h1.ytd-watch-metadata")?.textContent?.trim() ||
      document.querySelector("yt-formatted-string.ytd-watch-metadata")?.textContent?.trim() ||
      document.querySelector("h2.ytShortsVideoTitleViewModelShortsVideoTitle")?.textContent?.trim() ||
      document.querySelector('meta[name="title"]')?.content?.replace(/ - YouTube$/, "").trim() ||
      document.title.replace(/ - YouTube$/, "").trim();

    const channel =
      document.querySelector("ytd-channel-name a")?.textContent?.trim() ||
      document.querySelector("#channel-name a")?.textContent?.trim() ||
      document.querySelector("yt-formatted-string.ytd-channel-name")?.textContent?.trim() ||
      "";

    const durationText = document.querySelector(".ytp-time-duration")?.textContent?.trim() || "";
    const isLive = Boolean(
      document.querySelector(".ytp-live-badge:not([disabled])") ||
        document.querySelector("span.ytp-live")
    );

    return {
      id,
      url: watchUrl(id),
      title,
      channel,
      duration: durationText,
      thumbnail: thumbnailUrl(id, "hqdefault"),
      isLive,
      pageUrl: location.href
    };
  }

  function send(type, extra = {}) {
    try {
      return chrome.runtime.sendMessage({ type, ...extra });
    } catch {
      return Promise.resolve(null);
    }
  }

  function isFullscreen() {
    return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  }

  function styles() {
    return `
      :host { all: initial; }
      * { box-sizing: border-box; font-family: "Segoe UI", Inter, Roboto, Helvetica, Arial, sans-serif; }
      .wrap {
        position: fixed;
        right: 18px;
        bottom: 96px;
        z-index: 2147483646;
        color: #f4f4f5;
        width: 56px;
      }
      .wrap.expanded { width: 320px; }
      .wrap.hidden { display: none; }
      .fab {
        width: 56px;
        height: 56px;
        border: 0;
        border-radius: 18px;
        background: linear-gradient(180deg, #ff5a76, #ff2d55);
        color: #fff;
        box-shadow: 0 12px 30px rgba(255, 45, 85, 0.38);
        cursor: pointer;
        display: grid;
        place-items: center;
        position: relative;
        margin-left: auto;
      }
      .fab svg { width: 26px; height: 26px; }
      .fab.ready::after {
        content: "";
        position: absolute;
        inset: -5px;
        border-radius: 22px;
        border: 2px solid rgba(255, 45, 85, 0.45);
        animation: pulse 1.8s ease-out infinite;
      }
      @keyframes pulse {
        0% { transform: scale(0.92); opacity: 0.9; }
        100% { transform: scale(1.18); opacity: 0; }
      }
      .card {
        display: none;
        margin-bottom: 10px;
        width: 320px;
        background: #141417;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 18px;
        overflow: hidden;
        box-shadow: 0 20px 50px rgba(0,0,0,0.45);
      }
      .wrap.expanded .card { display: block; }
      .thumb {
        position: relative;
        height: 150px;
        background: #0b0b0d center/cover no-repeat;
      }
      .thumb .badge {
        position: absolute;
        left: 10px;
        top: 10px;
        background: #16a34a;
        color: #fff;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.04em;
        padding: 4px 8px;
        border-radius: 999px;
      }
      .thumb .badge.live { background: #f59e0b; color: #111; }
      .body { padding: 12px 14px 14px; }
      .title {
        font-size: 14px;
        font-weight: 650;
        line-height: 1.35;
        margin: 0 0 4px;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .meta { color: #a1a1aa; font-size: 12px; margin-bottom: 10px; }
      .row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
      .chip {
        border: 1px solid rgba(255,255,255,0.1);
        background: #1d1d22;
        color: #e4e4e7;
        border-radius: 999px;
        font-size: 12px;
        padding: 5px 9px;
        cursor: pointer;
      }
      .chip[aria-pressed="true"] {
        background: #ff2d55;
        border-color: #ff2d55;
        color: #fff;
      }
      .go, .alt {
        width: 100%;
        border: 0;
        border-radius: 12px;
        padding: 11px 12px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
      }
      .go {
        background: linear-gradient(180deg, #ff5a76, #ff2d55);
        color: #fff;
        margin-bottom: 6px;
      }
      .go[disabled] { opacity: 0.55; cursor: wait; }
      .alt {
        background: transparent;
        color: #d4d4d8;
        border: 1px solid rgba(255,255,255,0.1);
      }
      .status {
        margin-top: 8px;
        font-size: 11px;
        color: #a1a1aa;
        min-height: 14px;
      }
      .status.err { color: #fb7185; }
    `;
  }

  function ensureUi() {
    if (host && document.documentElement.contains(host)) return;
    host = document.getElementById(HOST_ID);
    if (!host) {
      host = document.createElement("div");
      host.id = HOST_ID;
      document.documentElement.appendChild(host);
    }
    shadow = host.shadowRoot || host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>${styles()}</style>
      <div class="wrap hidden" id="wrap">
        <div class="card">
          <div class="thumb" id="thumb"><span class="badge" id="badge">READY</span></div>
          <div class="body">
            <p class="title" id="title">Detecting video…</p>
            <div class="meta" id="meta"></div>
            <div class="row" id="quality"></div>
            <button class="go" id="download">Download video</button>
            <button class="alt" id="cobalt">Open working Cobalt instance</button>
            <div class="status" id="status">Auto-detected from this page</div>
          </div>
        </div>
        <button class="fab ready" id="fab" title="TubeReady" aria-label="Open TubeReady">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M12 4v10m0 0 4-4m-4 4-4-4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M5 16.5v1.2C5 19.2 6 20 7.3 20h9.4c1.3 0 2.3-.8 2.3-2.3v-1.2" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    `;

    shadow.getElementById("fab").addEventListener("click", () => {
      expanded = !expanded;
      render();
    });
    shadow.getElementById("download").addEventListener("click", async () => {
      setStatus("Preparing download…");
      const quality = shadow.querySelector('.chip[aria-pressed="true"]')?.dataset.quality || settings.quality;
      const mode = quality === "audio" ? "audio" : "video";
      const result = await send("DOWNLOAD", { quality, mode });
      if (result?.error) setStatus(result.error, true);
      else if (result?.download?.state === "opened") setStatus("Opened a working Cobalt instance");
      else if (result?.download?.note) setStatus(result.download.note);
      else setStatus("Download started");
    });
    shadow.getElementById("cobalt").addEventListener("click", () => send("DOWNLOAD", { via: "cobalt" }));
  }

  function setStatus(text, isError = false) {
    const el = shadow?.getElementById("status");
    if (!el) return;
    el.textContent = text;
    el.classList.toggle("err", isError);
  }

  function qualityOptions() {
    const heights = [
      ...new Set(
        [...(appState.formats?.muxed || []), ...(appState.formats?.video || [])]
          .map((f) => f.height)
          .filter(Boolean)
      )
    ];
    const chips = [];
    if (!heights.length) {
      chips.push(["720", "720p"], ["1080", "1080p"], ["audio", "Audio"]);
    } else {
      for (const h of heights.slice(0, 4)) chips.push([String(h), `${h}p`]);
      chips.push(["audio", "Audio"]);
    }
    return chips;
  }

  function render() {
    ensureUi();
    const wrap = shadow.getElementById("wrap");
    const visible = Boolean(current.id && settings.showOverlay && !isFullscreen());
    wrap.classList.toggle("hidden", !visible);
    wrap.classList.toggle("expanded", expanded);
    if (!visible) return;

    const thumb = shadow.getElementById("thumb");
    const badge = shadow.getElementById("badge");
    const title = shadow.getElementById("title");
    const meta = shadow.getElementById("meta");
    const fab = shadow.getElementById("fab");
    const go = shadow.getElementById("download");

    thumb.style.backgroundImage = current.thumbnail ? `url("${current.thumbnail}")` : "";
    badge.textContent = current.isLive ? "LIVE" : appState.ready ? "READY" : "DETECTED";
    badge.classList.toggle("live", current.isLive);
    title.textContent = current.title || "YouTube video detected";
    meta.textContent = [current.channel, current.duration].filter(Boolean).join(" · ");
    fab.classList.toggle("ready", Boolean(current.id));
    go.disabled = appState.status === "downloading" || current.isLive;
    go.textContent = current.isLive
      ? "Live — can't download"
      : appState.status === "downloading"
        ? "Downloading…"
        : settings.mode === "audio"
          ? "Download audio"
          : "Download video";

    const row = shadow.getElementById("quality");
    const options = qualityOptions();
    const selected =
      options.some(([v]) => v === settings.quality) ? settings.quality : options[0][0];
    row.innerHTML = options
      .map(
        ([value, label]) =>
          `<button class="chip" data-quality="${value}" aria-pressed="${value === selected}">${label}</button>`
      )
      .join("");
    row.querySelectorAll(".chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        settings.quality = btn.dataset.quality;
        settings.mode = settings.quality === "audio" ? "audio" : "video";
        render();
      });
    });

    if (appState.status === "ready") setStatus("Auto-detected. Ready to download.");
    if (appState.status === "loading") setStatus("Finding the best download…");
    if (appState.error) setStatus(appState.error, true);
  }

  async function publish(force = false) {
    const video = scrape();
    if (!video.id) {
      if (lastId) {
        lastId = null;
        current = emptyVideo();
        render();
      }
      return;
    }
    if (!force && video.id === lastId && current.title === video.title) {
      render();
      return;
    }
    lastId = video.id;
    current = video;
    expanded = true;
    render();
    const result = await send("DETECTED", { video });
    if (result && !result.error) {
      appState = result;
      if (result.video) current = { ...current, ...result.video };
      render();
    }
  }

  function injectReader() {
    if (document.documentElement.dataset.tubeReadyInjected) return;
    document.documentElement.dataset.tubeReadyInjected = "1";
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("inject.js");
    script.onerror = () => {
      script.remove();
      const inline = document.createElement("script");
      inline.textContent = `(() => {
        const SOURCE = "tube-ready";
        function readPlayer() {
          let player = window.ytInitialPlayerResponse || null;
          if (!player) {
            try {
              const raw = document.getElementById("movie_player")?.getPlayerResponse?.();
              if (raw) player = typeof raw === "string" ? JSON.parse(raw) : raw;
            } catch (e) { player = null; }
          }
          window.postMessage({ source: SOURCE, type: "PLAYER", player }, "*");
        }
        readPlayer();
        document.addEventListener("yt-navigate-finish", () => setTimeout(readPlayer, 350));
      })();`;
      (document.head || document.documentElement).appendChild(inline);
      inline.remove();
    };
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.data?.source !== "tube-ready" || event.data.type !== "PLAYER") return;
    const formats = formatsFromPlayerSafe(event.data.player);
    if (formats.muxed.length || formats.audio.length) {
      send("PAGE_FORMATS", { formats });
    }
  });

  function formatsFromPlayerSafe(player) {
    try {
      const sd = player?.streamingData || {};
      const muxed = (sd.formats || [])
        .filter((f) => f.url)
        .map((f) => ({
          kind: "muxed",
          label: f.qualityLabel || f.quality,
          height: f.height || 0,
          url: f.url,
          mime: f.mimeType || "video/mp4",
          ext: (f.mimeType || "").includes("webm") ? "webm" : "mp4"
        }));
      const video = (sd.adaptiveFormats || [])
        .filter((f) => f.url && /video\//i.test(f.mimeType || ""))
        .map((f) => ({
          kind: "video",
          label: f.qualityLabel || f.quality,
          height: f.height || 0,
          url: f.url,
          mime: f.mimeType || "video/mp4",
          ext: (f.mimeType || "").includes("webm") ? "webm" : "mp4"
        }));
      const audio = (sd.adaptiveFormats || [])
        .filter((f) => f.url && /audio/i.test(f.mimeType || ""))
        .map((f) => ({
          kind: "audio",
          label: f.audioQuality || "audio",
          bitrate: f.bitrate || 0,
          url: f.url,
          mime: f.mimeType || "audio/mp4",
          ext: (f.mimeType || "").includes("webm") ? "webm" : "m4a"
        }));
      return { source: "page", muxed, video, audio };
    } catch {
      return { source: "page", muxed: [], audio: [] };
    }
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "STATE" && message.state) {
      appState = message.state;
      if (message.state.video?.id) current = { ...current, ...message.state.video };
      render();
    }
  });

  document.addEventListener("yt-navigate-finish", () => {
    expanded = true;
    publish(true);
    setTimeout(injectReader, 200);
  });
  document.addEventListener("fullscreenchange", render);
  document.addEventListener("webkitfullscreenchange", render);

  let href = location.href;
  setInterval(() => {
    if (location.href !== href) {
      href = location.href;
      publish(true);
    }
  }, 800);

  send("GET_SETTINGS").then((s) => {
    if (s) settings = { ...settings, ...s };
    publish(true);
  });
  injectReader();
})();

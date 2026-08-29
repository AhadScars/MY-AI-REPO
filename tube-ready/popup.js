const $ = (id) => document.getElementById(id);

const ui = {
  empty: $("empty"),
  video: $("video"),
  pill: $("pill"),
  hero: $("hero"),
  readyTag: $("ready-tag"),
  title: $("title"),
  meta: $("meta"),
  chips: $("chips"),
  download: $("download"),
  cobalt: $("cobalt"),
  hint: $("hint"),
  url: $("url"),
  form: $("paste-form"),
  history: $("history"),
  historyWrap: $("history-wrap"),
  engine: $("engine")
};

let settings = { quality: "720", mode: "video" };
let snapshot = null;

function send(type, extra = {}) {
  return chrome.runtime.sendMessage({ type, ...extra });
}

function setHint(text, isError = false) {
  ui.hint.textContent = text || "";
  ui.hint.classList.toggle("err", Boolean(isError));
}

function qualityChoices(state) {
  if (state?.ytdlp?.ok) {
    return [
      ["360", "360p"],
      ["720", "720p"],
      ["1080", "1080p"],
      ["max", "Best"],
      ["audio", "Audio only"]
    ];
  }
  const muxed = state?.formats?.muxed || [];
  const video = state?.formats?.video || [];
  const heights = [...new Set([...muxed, ...video].map((f) => f.height).filter(Boolean))];
  const chips = heights.length
    ? heights.slice(0, 5).map((h) => [String(h), `${h}p`])
    : [
        ["360", "360p"],
        ["720", "720p"],
        ["1080", "1080p"]
      ];
  chips.push(["audio", "Audio only"]);
  return chips;
}

function renderEngine(state) {
  if (!ui.engine) return;
  const info = state?.ytdlp;
  if (!info) {
    ui.engine.textContent = "Checking yt-dlp…";
    ui.engine.className = "engine";
    return;
  }
  if (info.ok) {
    ui.engine.textContent = `yt-dlp ${info.version || "ready"}${info.ffmpeg ? " · ffmpeg on" : ""}`;
    ui.engine.className = "engine ok";
    return;
  }
  ui.engine.textContent = "yt-dlp helper not installed — run install-host.bat";
  ui.engine.className = "engine bad";
}

function renderVideo(state) {
  renderEngine(state);
  const video = state.video;
  const hasVideo = Boolean(video?.id);
  ui.empty.classList.toggle("hidden", hasVideo);
  ui.video.classList.toggle("hidden", !hasVideo);
  if (!hasVideo) {
    ui.pill.textContent = "Waiting";
    ui.pill.className = "pill";
    return;
  }

  const live = Boolean(video.isLive);
  const ready = Boolean(state.ready) || Boolean(video.id);
  ui.pill.textContent = live ? "Live" : state.status === "downloading" ? "Saving" : ready ? "Ready" : "Detected";
  ui.pill.className = `pill ${live ? "live" : state.status === "downloading" ? "busy" : "ready"}`;
  ui.hero.style.backgroundImage = video.thumbnail ? `url("${video.thumbnail}")` : "";
  ui.readyTag.textContent = live ? "Live stream" : "Ready to download";
  ui.title.textContent = video.title || "YouTube video";
  ui.meta.textContent = [video.channel, video.duration].filter(Boolean).join(" · ") || video.id;

  const options = qualityChoices(state);
  const selected = options.some(([v]) => v === settings.quality) ? settings.quality : options[0][0];
  ui.chips.innerHTML = options
    .map(
      ([value, label]) =>
        `<button class="chip" data-quality="${value}" aria-pressed="${value === selected}">${label}</button>`
    )
    .join("");
  ui.chips.querySelectorAll(".chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      settings.quality = btn.dataset.quality;
      settings.mode = settings.quality === "audio" ? "audio" : "video";
      renderVideo(snapshot || state);
    });
  });

  ui.download.disabled = live || state.status === "downloading";
  ui.download.textContent = live
    ? "Live streams can't be saved"
    : state.status === "downloading"
      ? "Downloading…"
      : settings.mode === "audio"
        ? "Download audio"
        : "Download video";

  renderEngine(state);

  if (state.status === "downloading") {
    const pct = Math.round((state.download?.progress || 0) * 100);
    setHint(state.download?.note || `Downloading with yt-dlp… ${pct}%`);
  } else if (state.download?.state === "complete") {
    setHint(state.download.note || "Saved to Downloads/TubeReady.");
  }
  else if (state.download?.state === "opened") {
    setHint("Official cobalt.tools blocked YouTube — opened a working instance.");
  } else if (state.download?.note) setHint(state.download.note);
  else if (state.error) setHint(state.error, true);
  else setHint("Auto-detected from the current YouTube tab.");
}

function renderHistory(items) {
  if (!items?.length) {
    ui.historyWrap.classList.add("hidden");
    return;
  }
  ui.historyWrap.classList.remove("hidden");
  ui.history.innerHTML = items
    .slice(0, 5)
    .map(
      (item) => `
      <div class="item" data-id="${item.id}">
        <img src="${item.thumbnail || thumbnailUrl(item.id)}" alt="" />
        <div>
          <b>${item.title || item.id}</b>
          <span>${item.channel || "YouTube"}</span>
        </div>
      </div>`
    )
    .join("");
  ui.history.querySelectorAll(".item").forEach((el) => {
    el.addEventListener("click", async () => {
      const id = el.dataset.id;
      snapshot = await send("RESOLVE_URL", { url: watchUrl(id) });
      if (snapshot?.error) setHint(snapshot.error, true);
      else renderVideo(snapshot);
    });
  });
}

async function refresh({ loadSettings = false } = {}) {
  const [state, historyPack, storedSettings] = await Promise.all([
    send("GET_STATE"),
    send("GET_HISTORY"),
    loadSettings ? send("GET_SETTINGS") : Promise.resolve(null)
  ]);
  if (storedSettings) settings = { ...settings, ...storedSettings };
  snapshot = state;

  if (!state?.video?.id) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const id = parseYouTubeId(tab?.url || "");
    if (id) {
      snapshot = await send("RESOLVE_URL", { url: tab.url });
    }
  }

  renderVideo(snapshot || { video: emptyVideo(), status: "idle" });
  renderHistory(historyPack?.history || []);
}

ui.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const url = ui.url.value.trim();
  if (!url) return;
  setHint("Detecting video…");
  snapshot = await send("RESOLVE_URL", { url });
  if (snapshot?.error) {
    setHint(snapshot.error, true);
    ui.empty.classList.remove("hidden");
    return;
  }
  renderVideo(snapshot);
});

ui.download.addEventListener("click", async () => {
  setHint("Preparing download…");
  ui.download.disabled = true;
  const result = await send("DOWNLOAD", {
    quality: settings.quality,
    mode: settings.quality === "audio" ? "audio" : "video"
  });
  if (result?.error) setHint(result.error, true);
  snapshot = result?.video ? result : snapshot;
  if (snapshot) renderVideo(snapshot);
});

ui.cobalt.addEventListener("click", () => send("DOWNLOAD", { via: "cobalt" }));

refresh({ loadSettings: true });
setInterval(() => refresh(), 1500);

async function load() {
  const settings = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
  if (!settings) return;
  document.getElementById("quality").value = settings.quality || "720";
  document.getElementById("mode").value = settings.mode || "video";
  document.getElementById("showOverlay").checked = settings.showOverlay !== false;
  document.getElementById("cobaltFrontend").value = settings.cobaltFrontend || "https://cobalt.3kh0.net";
  document.getElementById("cobaltApi").value = settings.cobaltApi || "";
  document.getElementById("cobaltKey").value = settings.cobaltKey || "";
}

document.getElementById("form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const settings = {
    quality: document.getElementById("quality").value,
    mode: document.getElementById("mode").value,
    showOverlay: document.getElementById("showOverlay").checked,
    cobaltFrontend: document.getElementById("cobaltFrontend").value,
    cobaltApi: document.getElementById("cobaltApi").value.trim(),
    cobaltKey: document.getElementById("cobaltKey").value.trim()
  };
  await chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", settings });
  const note = document.getElementById("note");
  note.textContent = "Saved.";
  note.className = "note ok";
});

async function loadHelper() {
  const box = document.getElementById("helper");
  const status = document.getElementById("helper-status");
  try {
    const info = await chrome.runtime.sendMessage({ type: "PING_YTDLP" });
    if (info?.ok) {
      box.classList.add("ok");
      status.textContent = `Connected — yt-dlp ${info.version}${info.ffmpeg ? " (ffmpeg found)" : " (install ffmpeg to merge 1080p+ audio)"}`;
    } else {
      box.classList.add("bad");
      status.textContent = info?.error || "Helper is not installed. Run install-host.bat, then reload TubeReady.";
    }
  } catch (err) {
    box.classList.add("bad");
    status.textContent = err.message || "Helper is not installed.";
  }
}

load();
loadHelper();

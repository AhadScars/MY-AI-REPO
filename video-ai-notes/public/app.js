/**
 * Video AI Notes — client
 * Extracts frames in-browser, sends to backend for Gemini analysis + follow-up chat.
 */

const $ = (sel) => document.querySelector(sel);

const state = {
  file: null,
  objectUrl: null,
  frames: [],
  sessionId: null,
  notes: "",
  language: "en",
  voiceGender: "female", // "female" | "male"
  analyzing: false,
  chatting: false,
  translating: false,
  speaking: false,
  speechPaused: false,
  speechMode: null, // "full" | "hover" | null
  speechRate: 1,
  hoverTimer: null,
};

const LANG_SPEECH = {
  en: {
    bcp47: ["en-US", "en-IN", "en-GB", "en"],
    label: "English",
    native: "English",
    code: "EN",
  },
  hi: {
    bcp47: ["hi-IN", "hi"],
    label: "Hindi",
    native: "हिन्दी",
    code: "HI",
  },
  ur: {
    bcp47: ["ur-PK", "ur-IN", "ur"],
    label: "Urdu",
    native: "اردو",
    code: "UR",
  },
};

const UI_I18N = {
  en: {
    hoverHint: "Hover any line to hear it",
    playing: "Playing all notes…",
    paused: "Paused",
    hoverReading: "Reading hovered text…",
    translating: "Translating notes…",
    analyzeHint: (n) => `Notes will be written in <strong>${n}</strong> · voice matches language`,
    analyzeBtn: "Analyze with AI",
  },
  hi: {
    hoverHint: "सुनने के लिए किसी पंक्ति पर होवर करें",
    playing: "सभी नोट्स चल रहे हैं…",
    paused: "रोका गया",
    hoverReading: "होवर किया गया पाठ पढ़ा जा रहा है…",
    translating: "नोट्स का अनुवाद हो रहा है…",
    analyzeHint: (n) => `नोट्स <strong>${n}</strong> में लिखे जाएँगे · आवाज़ भी उसी भाषा में`,
    analyzeBtn: "AI से विश्लेषण करें",
  },
  ur: {
    hoverHint: "سننے کے لیے کسی سطر پر ہوور کریں",
    playing: "تمام نوٹس چل رہے ہیں…",
    paused: "روکا گیا",
    hoverReading: "ہوور کردہ متن پڑھا جا رہا ہے…",
    translating: "نوٹس کا ترجمہ ہو رہا ہے…",
    analyzeHint: (n) => `نوٹس <strong>${n}</strong> میں لکھے جائیں گے · آواز بھی اسی زبان میں`,
    analyzeBtn: "AI سے تجزیہ کریں",
  },
};

// Elements
const dropZone = $("#dropZone");
const fileInput = $("#fileInput");
const playerWrap = $("#playerWrap");
const video = $("#video");
const videoMeta = $("#videoMeta");
const framesStrip = $("#framesStrip");
const btnAnalyze = $("#btnAnalyze");
const btnChange = $("#btnChange");
const frameCountSelect = $("#frameCount");
const notesLanguage = $("#notesLanguage");
const customPrompt = $("#customPrompt");
const progress = $("#progress");
const progressFill = $("#progressFill");
const progressText = $("#progressText");
const notesEmpty = $("#notesEmpty");
const notesView = $("#notesView");
const notesEdit = $("#notesEdit");
const notesToolbar = $("#notesToolbar");
const listenBar = $("#listenBar");
const btnListen = $("#btnListen");
const btnPause = $("#btnPause");
const btnStop = $("#btnStop");
const speechRate = $("#speechRate");
const listenHint = $("#listenHint");
const voiceStatus = $("#voiceStatus");
const notesLangBadge = $("#notesLangBadge");
const langAnalyzeHint = $("#langAnalyzeHint");
const langSwitch = $("#langSwitch");
const voiceGenderEl = $("#voiceGender");
const btnCopy = $("#btnCopy");
const btnDownload = $("#btnDownload");
const btnEditNotes = $("#btnEditNotes");
const btnSaveNotes = $("#btnSaveNotes");
const btnCancelEdit = $("#btnCancelEdit");
const chatLog = $("#chatLog");
const chatForm = $("#chatForm");
const chatInput = $("#chatInput");
const btnSend = $("#btnSend");
const chatEmpty = $("#chatEmpty");
const apiStatus = $("#apiStatus");
const suggestions = $("#suggestions");

/**
 * Parse API JSON safely. Prevents "Unexpected token '<'" when server returns HTML.
 */
async function parseApiJson(res) {
  const text = await res.text();
  const trimmed = (text || "").trim();
  if (!trimmed) {
    throw new Error(`Empty response from server (${res.status}). Is npm start running?`);
  }
  if (trimmed.startsWith("<!") || trimmed.startsWith("<html") || trimmed.startsWith("<HTML")) {
    throw new Error(
      "Server returned a web page instead of API data.\n\n" +
        "Fix:\n" +
        "1. Stop old server (Ctrl+C)\n" +
        "2. Run: npm start\n" +
        "3. Open http://localhost:3847 and hard-refresh (Ctrl+Shift+R)\n" +
        "4. Analyze the video again, then change language"
    );
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error(
      `Invalid JSON from server (${res.status}). Restart with npm start. Preview: ${trimmed.slice(0, 120)}`
    );
  }
}

// ─── Init ───────────────────────────────────────────────
checkHealth();
wireLanguage();
wireVoiceGender();
wireUpload();
wireAnalyze();
wireChat();
wireNotes();
refreshLanguageUI(state.language);
refreshGenderUI();

// ─── Language ───────────────────────────────────────────
function wireLanguage() {
  if (!langSwitch) return;

  langSwitch.addEventListener("click", async (e) => {
    const pill = e.target.closest(".lang-pill");
    if (!pill) return;
    const lang = pill.dataset.lang;
    if (!lang || lang === state.language) {
      setLanguage(lang, { silent: true });
      return;
    }
    await setLanguage(lang);
  });
}

/**
 * Apply language for notes generation, UI chrome, and TTS voice.
 * If notes already exist for a session, translate them into the new language.
 */
async function setLanguage(lang, { silent = false } = {}) {
  const next = LANG_SPEECH[lang] ? lang : "en";
  const prev = state.language;
  if (!next) return;

  state.language = next;
  if (notesLanguage) notesLanguage.value = next;
  refreshLanguageUI(next);

  // Re-translate existing notes when user switches language after analysis
  if (
    !silent &&
    state.sessionId &&
    state.notes &&
    prev !== next
  ) {
    stopListening();
    try {
      await translateExistingNotes(next);
    } catch {
      // Revert UI language if translation failed
      state.language = prev;
      if (notesLanguage) notesLanguage.value = prev;
      refreshLanguageUI(prev);
    }
  }
}

function refreshLanguageUI(lang) {
  const meta = LANG_SPEECH[lang] || LANG_SPEECH.en;
  const ui = UI_I18N[lang] || UI_I18N.en;

  langSwitch?.querySelectorAll(".lang-pill").forEach((pill) => {
    pill.classList.toggle("active", pill.dataset.lang === lang);
  });

  if (notesLangBadge) notesLangBadge.textContent = meta.code;
  if (langAnalyzeHint) {
    langAnalyzeHint.innerHTML = ui.analyzeHint(meta.native);
  }

  const label = btnAnalyze?.querySelector(".btn-label");
  if (label && !state.analyzing) label.textContent = ui.analyzeBtn;

  document.documentElement.lang = lang === "hi" ? "hi" : lang === "ur" ? "ur" : "en";
  updateVoiceStatus();
  updateListenControls();
}

async function translateExistingNotes(language) {
  if (!state.sessionId) {
    throw new Error("No active session. Analyze a video first, then change language.");
  }
  if (state.translating) return;

  const ui = UI_I18N[language] || UI_I18N.en;
  state.translating = true;
  if (listenHint) listenHint.textContent = ui.translating;
  notesView?.classList.add("translating");
  langSwitch?.classList.add("disabled");

  try {
    const res = await fetch(`/api/session/${encodeURIComponent(state.sessionId)}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ language }),
    });
    const data = await parseApiJson(res);
    if (!res.ok) throw new Error(data.error || "Translation failed");

    state.notes = data.notes;
    state.language = data.language || language;
    showNotes(data.notes);
    resetChatUI();
    enableChat();
  } catch (err) {
    console.error(err);
    notesView?.classList.remove("translating");
    updateListenControls();
    alert(err.message || "Could not translate notes.");
    throw err;
  } finally {
    state.translating = false;
    notesView?.classList.remove("translating");
    langSwitch?.classList.remove("disabled");
    updateListenControls();
  }
}

function wireVoiceGender() {
  if (!voiceGenderEl) return;
  voiceGenderEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".gender-pill");
    if (!btn) return;
    const gender = btn.dataset.gender;
    if (gender !== "male" && gender !== "female") return;
    state.voiceGender = gender;
    try {
      localStorage.setItem("voiceGender", gender);
    } catch {
      /* ignore */
    }
    refreshGenderUI();
    updateVoiceStatus();
    // Restart full playback with new voice if currently speaking
    if (state.speaking && state.speechMode === "full" && state.notes) {
      startListening(state.notes, "full");
    }
  });

  try {
    const saved = localStorage.getItem("voiceGender");
    if (saved === "male" || saved === "female") state.voiceGender = saved;
  } catch {
    /* ignore */
  }
}

function refreshGenderUI() {
  voiceGenderEl?.querySelectorAll(".gender-pill").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.gender === state.voiceGender);
  });
}

function updateVoiceStatus() {
  if (!voiceStatus || !("speechSynthesis" in window)) {
    if (voiceStatus) voiceStatus.textContent = "";
    return;
  }
  const meta = LANG_SPEECH[state.language] || LANG_SPEECH.en;
  const genderLabel = state.voiceGender === "male" ? "Male" : "Female";
  const voice = pickVoiceForLanguage(window.speechSynthesis.getVoices());
  if (voice) {
    const matched = voice.lang.toLowerCase().startsWith(meta.bcp47[0].slice(0, 2));
    const gMatch = guessVoiceGender(voice);
    voiceStatus.textContent = matched
      ? `${genderLabel} · ${voice.name} (${voice.lang})`
      : `${genderLabel} · ${voice.name} · install ${meta.label} voice for best quality`;
    if (gMatch && gMatch !== state.voiceGender) {
      voiceStatus.textContent += ` · closest available`;
    }
    voiceStatus.title = voiceStatus.textContent;
  } else {
    voiceStatus.textContent = `${genderLabel} · browser default (${meta.code})`;
  }
}

async function checkHealth() {
  try {
    const res = await fetch("/api/health", { headers: { Accept: "application/json" } });
    const data = await parseApiJson(res);
    if (data.hasApiKey) {
      const features = Array.isArray(data.features) ? data.features : [];
      const hasTranslate = features.includes("translate");
      apiStatus.textContent = hasTranslate
        ? `Ready · ${data.model}`
        : `Old server — restart npm start`;
      apiStatus.className = hasTranslate ? "header-status ok" : "header-status bad";
      apiStatus.title = hasTranslate
        ? "API ready"
        : "Translate route missing. Stop server and run npm start again.";
    } else {
      apiStatus.textContent = "Set GEMINI_API_KEY in .env";
      apiStatus.className = "header-status bad";
    }
  } catch {
    apiStatus.textContent = "Server offline";
    apiStatus.className = "header-status bad";
  }
}

// ─── Upload ─────────────────────────────────────────────
function wireUpload() {
  dropZone.addEventListener("click", () => fileInput.click());
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    const file = e.dataTransfer.files?.[0];
    if (file) loadVideo(file);
  });
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file) loadVideo(file);
  });
  btnChange.addEventListener("click", () => fileInput.click());
}

function loadVideo(file) {
  if (!file.type.startsWith("video/")) {
    alert("Please choose a video file.");
    return;
  }

  // Reset session
  state.file = file;
  state.frames = [];
  state.sessionId = null;
  state.notes = "";
  state.language = notesLanguage?.value || "en";
  if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
  state.objectUrl = URL.createObjectURL(file);

  video.src = state.objectUrl;
  dropZone.classList.add("hidden");
  playerWrap.classList.remove("hidden");
  framesStrip.classList.add("hidden");
  framesStrip.innerHTML = "";
  videoMeta.textContent = `${file.name} · ${formatBytes(file.size)}`;
  btnAnalyze.disabled = false;

  resetNotesUI();
  resetChatUI();

  video.onloadedmetadata = () => {
    const d = video.duration;
    if (Number.isFinite(d)) {
      videoMeta.textContent = `${file.name} · ${formatDuration(d)} · ${formatBytes(file.size)}`;
    }
  };
}

// ─── Frame extraction ───────────────────────────────────
function formatTimestamp(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  const s = Math.floor(seconds % 60);
  const m = Math.floor(seconds / 60) % 60;
  const h = Math.floor(seconds / 3600);
  const pad = (n) => String(n).padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

function formatDuration(seconds) {
  return formatTimestamp(seconds);
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Seek video and capture canvas frames evenly across duration.
 */
async function extractFrames(count) {
  const duration = video.duration;
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Could not read video duration. Try another format (MP4 works best).");
  }

  const canvas = document.createElement("canvas");
  const maxW = 960;
  const scale = Math.min(1, maxW / (video.videoWidth || maxW));
  canvas.width = Math.max(1, Math.round((video.videoWidth || 640) * scale));
  canvas.height = Math.max(1, Math.round((video.videoHeight || 360) * scale));
  const ctx = canvas.getContext("2d");

  const timestamps = [];
  // Skip very start/end a bit so we get contentful frames
  const start = duration * 0.05;
  const end = duration * 0.95;
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? duration / 2 : start + (i / (count - 1)) * (end - start);
    timestamps.push(t);
  }

  const frames = [];
  const wasPaused = video.paused;
  video.pause();

  for (let i = 0; i < timestamps.length; i++) {
    const t = timestamps[i];
    await seekTo(t);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    frames.push({
      timestamp: formatTimestamp(t),
      dataUrl,
    });
    setProgress(((i + 1) / timestamps.length) * 40, `Extracting frames ${i + 1}/${count}…`);
  }

  if (!wasPaused) {
    // leave paused after extraction
  }

  return frames;
}

function seekTo(time) {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      cleanup();
      // Small delay helps some browsers finish decode
      requestAnimationFrame(() => resolve());
    };
    const onError = () => {
      cleanup();
      reject(new Error("Failed to seek in video."));
    };
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    video.currentTime = Math.min(time, Math.max(0, video.duration - 0.05));
  });
}

function showFrameStrip(frames) {
  framesStrip.innerHTML = "";
  for (const f of frames) {
    const wrap = document.createElement("div");
    wrap.className = "frame-chip";
    const img = document.createElement("img");
    img.src = f.dataUrl;
    img.alt = f.timestamp;
    const label = document.createElement("span");
    label.textContent = f.timestamp;
    wrap.appendChild(img);
    wrap.appendChild(label);
    framesStrip.appendChild(wrap);
  }
  framesStrip.classList.remove("hidden");
}

// ─── Analyze ────────────────────────────────────────────
function wireAnalyze() {
  btnAnalyze.addEventListener("click", runAnalyze);
}

async function runAnalyze() {
  if (!state.file || state.analyzing) return;
  state.analyzing = true;
  btnAnalyze.disabled = true;
  btnAnalyze.classList.add("loading");
  progress.classList.remove("hidden");
  setProgress(5, "Preparing video…");

  try {
    if (video.readyState < 1) {
      await new Promise((res, rej) => {
        video.onloadedmetadata = res;
        video.onerror = () => rej(new Error("Video failed to load."));
      });
    }

    const count = parseInt(frameCountSelect.value, 10) || 8;
    setProgress(10, "Extracting key frames…");
    const frames = await extractFrames(count);
    state.frames = frames;
    showFrameStrip(frames);

    setProgress(45, "Sending frames to AI…");

    const language = notesLanguage?.value || "en";
    state.language = language;

    const body = {
      frames,
      filename: state.file.name,
      duration: video.duration,
      customPrompt: customPrompt.value.trim() || undefined,
      language,
    };

    setProgress(55, "Gemini is analyzing the video…");

    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await parseApiJson(res);
    if (!res.ok) throw new Error(data.error || "Analysis failed");

    setProgress(100, "Done!");
    state.sessionId = data.sessionId;
    state.notes = data.notes;
    state.language = data.language || language;
    refreshLanguageUI(state.language);
    showNotes(data.notes);
    enableChat();

    setTimeout(() => {
      progress.classList.add("hidden");
      setProgress(0, "");
    }, 800);
  } catch (err) {
    console.error(err);
    setProgress(0, "");
    progress.classList.add("hidden");
    const msg = err.message || "Something went wrong during analysis.";
    // Browser shows "Failed to fetch" when the server is down or page is opened as a file://
    if (/failed to fetch|networkerror|load failed/i.test(msg)) {
      alert(
        "Can't reach the server.\n\n" +
          "1. Start it:  npm start\n" +
          "2. Open:  http://localhost:3847\n" +
          "   (not by double-clicking index.html)\n" +
          "3. Keep the terminal window open while using the app."
      );
    } else {
      alert(msg);
    }
  } finally {
    state.analyzing = false;
    btnAnalyze.disabled = false;
    btnAnalyze.classList.remove("loading");
  }
}

function setProgress(pct, text) {
  progressFill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  if (text != null) progressText.textContent = text;
}

// ─── Notes ──────────────────────────────────────────────
function wireNotes() {
  btnListen.addEventListener("click", () => {
    if (!state.notes) return;
    if (state.speaking && state.speechMode === "full") {
      stopListening();
    } else {
      startListening(state.notes, "full");
    }
  });

  btnPause.addEventListener("click", () => {
    if (!("speechSynthesis" in window) || !state.speaking) return;
    if (state.speechPaused) {
      window.speechSynthesis.resume();
      state.speechPaused = false;
    } else {
      window.speechSynthesis.pause();
      state.speechPaused = true;
    }
    updateListenControls();
  });

  btnStop.addEventListener("click", () => stopListening());

  speechRate.addEventListener("change", () => {
    const rate = parseFloat(speechRate.value) || 1;
    state.speechRate = rate;
    // Rate only applies to new utterances; restart full listen if active
    if (state.speaking && state.speechMode === "full" && state.notes) {
      startListening(state.notes, "full");
    }
  });

  btnCopy.addEventListener("click", async () => {
    if (!state.notes) return;
    try {
      await navigator.clipboard.writeText(state.notes);
      btnCopy.textContent = "Copied!";
      setTimeout(() => (btnCopy.textContent = "Copy"), 1500);
    } catch {
      alert("Could not copy to clipboard.");
    }
  });

  btnDownload.addEventListener("click", () => {
    if (!state.notes) return;
    const name = (state.file?.name || "video").replace(/\.[^.]+$/, "") + "-notes.md";
    const blob = new Blob([state.notes], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  btnEditNotes.addEventListener("click", () => {
    stopListening();
    notesView.classList.add("hidden");
    notesEdit.classList.remove("hidden");
    notesEdit.value = state.notes;
    btnEditNotes.classList.add("hidden");
    btnSaveNotes.classList.remove("hidden");
    btnCancelEdit.classList.remove("hidden");
    listenBar.classList.add("hidden");
  });

  btnCancelEdit.addEventListener("click", () => {
    notesEdit.classList.add("hidden");
    notesView.classList.remove("hidden");
    btnEditNotes.classList.remove("hidden");
    btnSaveNotes.classList.add("hidden");
    btnCancelEdit.classList.add("hidden");
    listenBar.classList.remove("hidden");
  });

  btnSaveNotes.addEventListener("click", async () => {
    stopListening();
    const notes = notesEdit.value;
    state.notes = notes;
    showNotes(notes);
    btnEditNotes.classList.remove("hidden");
    btnSaveNotes.classList.add("hidden");
    btnCancelEdit.classList.add("hidden");
    if (state.sessionId) {
      try {
        await fetch(`/api/session/${state.sessionId}/notes`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes }),
        });
      } catch {
        /* local edit still kept */
      }
    }
  });

  // Prefetch voices (Chrome loads them async)
  if ("speechSynthesis" in window) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener("voiceschanged", () => {
      window.speechSynthesis.getVoices();
      updateVoiceStatus();
    });
  }

  window.addEventListener("beforeunload", stopListening);
}

/**
 * Strip markdown so TTS reads clean prose, not symbols.
 */
function notesToSpeechText(md) {
  return String(md || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/^>\s?/gm, "")
    .replace(/^[\s]*[-*+]\s+/gm, "")
    .replace(/^[\s]*\d+\.\s+/gm, "")
    .replace(/^[-*_]{3,}\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function getSpeechLang() {
  return LANG_SPEECH[state.language] || LANG_SPEECH.en;
}

const FEMALE_VOICE_RE =
  /female|woman|girl|zira|hazel|samantha|victoria|karen|moira|tessa|veena|lekha|heera|susan|linda|heather|catherine|fiona|aria|jenny|sara|neerja|swara|sonia|nicky|google uk english female|google us english female|microsoft zira|microsoft aria|microsoft jenny|microsoft sonia|microsoft neerja|microsoft swara/i;

const MALE_VOICE_RE =
  /male|man|boy|david|mark|ravi|daniel|fred|james|george|thomas|ryan|eric|guy|hemant|prateek|rishi|google uk english male|google us english male|microsoft david|microsoft mark|microsoft guy|microsoft ravi|microsoft prateek|microsoft hemant/i;

function guessVoiceGender(voice) {
  const name = `${voice?.name || ""} ${voice?.voiceURI || ""}`;
  if (FEMALE_VOICE_RE.test(name)) return "female";
  if (MALE_VOICE_RE.test(name)) return "male";
  return null;
}

function scoreVoice(voice, prefix, gender) {
  let score = 0;
  const lang = (voice.lang || "").toLowerCase();
  const name = (voice.name || "").toLowerCase();

  if (lang.startsWith(prefix)) score += 100;
  else if (lang.startsWith(prefix.slice(0, 2))) score += 80;
  else if (prefix === "hi" && /hindi|हिन्दी|india/.test(name + lang)) score += 60;
  else if (prefix === "ur" && /urdu|اردو|pakistan/.test(name + lang)) score += 60;
  else if (prefix === "en" && lang.startsWith("en")) score += 100;
  else score -= 40;

  if (/natural|neural|google|premium|enhanced|online|microsoft/i.test(name)) score += 15;

  const g = guessVoiceGender(voice);
  if (gender === "female") {
    if (g === "female") score += 50;
    else if (g === "male") score -= 35;
  } else if (gender === "male") {
    if (g === "male") score += 50;
    else if (g === "female") score -= 35;
  }

  return score;
}

function pickVoiceForLanguage(list) {
  const { bcp47 } = getSpeechLang();
  const voices = list || [];
  if (!voices.length) return null;

  const prefix = bcp47[0].toLowerCase();
  const gender = state.voiceGender === "male" ? "male" : "female";

  let best = null;
  let bestScore = -Infinity;
  for (const v of voices) {
    const s = scoreVoice(v, prefix, gender);
    if (s > bestScore) {
      bestScore = s;
      best = v;
    }
  }

  // Prefer a language match even if gender is imperfect
  if (bestScore < 40) {
    const langOnly = voices.find((v) =>
      bcp47.some((code) => new RegExp("^" + code.replace("-", "[-_]"), "i").test(v.lang))
    );
    if (langOnly) return langOnly;
  }

  return best || voices[0];
}

function applyVoice(utterance) {
  const langInfo = getSpeechLang();
  utterance.lang = langInfo.bcp47[0];

  // Soft pitch shift helps when OS only has one gender for the language
  if (state.voiceGender === "male") {
    utterance.pitch = 0.88;
  } else {
    utterance.pitch = 1.08;
  }

  const preferred = pickVoiceForLanguage(window.speechSynthesis.getVoices());
  if (preferred) {
    const voicePrefix = (preferred.lang || "").slice(0, 2).toLowerCase();
    const targetPrefix = langInfo.bcp47[0].slice(0, 2).toLowerCase();
    if (voicePrefix === targetPrefix) {
      utterance.voice = preferred;
      utterance.lang = preferred.lang || utterance.lang;
      // If voice already matches gender, keep neutral pitch
      const g = guessVoiceGender(preferred);
      if (g === state.voiceGender) utterance.pitch = 1;
    } else {
      // Keep language code; optional fallback voice
      utterance.voice = preferred;
      utterance.lang = langInfo.bcp47[0];
    }
  }
  updateVoiceStatus();
}

/**
 * @param {string} textOrMarkdown
 * @param {"full"|"hover"} mode
 */
function startListening(textOrMarkdown, mode = "full") {
  if (!("speechSynthesis" in window)) {
    if (mode === "full") {
      alert("Text-to-speech is not supported in this browser. Try Chrome, Edge, or Safari.");
    }
    return;
  }

  const text =
    mode === "hover"
      ? String(textOrMarkdown || "").replace(/\s+/g, " ").trim()
      : notesToSpeechText(textOrMarkdown);

  if (!text) {
    if (mode === "full") alert("Nothing to read — notes are empty.");
    return;
  }

  // Cancel any current speech (full or hover)
  clearHoverTimer();
  clearSpeakingHighlight();
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }

  const rate = parseFloat(speechRate?.value) || state.speechRate || 1;
  state.speechRate = rate;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = Math.min(2, Math.max(0.5, rate));
  utterance.pitch = 1;
  utterance.volume = 1;
  applyVoice(utterance);

  utterance.onstart = () => {
    state.speaking = true;
    state.speechPaused = false;
    state.speechMode = mode;
    updateListenControls();
  };
  utterance.onend = () => {
    if (state.speechMode === mode) {
      state.speaking = false;
      state.speechPaused = false;
      state.speechMode = null;
      clearSpeakingHighlight();
      updateListenControls();
    }
  };
  utterance.onerror = () => {
    if (state.speechMode === mode) {
      state.speaking = false;
      state.speechPaused = false;
      state.speechMode = null;
      clearSpeakingHighlight();
      updateListenControls();
    }
  };

  const speakNow = () => {
    // Chrome can drop speak() if called immediately after cancel()
    setTimeout(() => {
      applyVoice(utterance);
      window.speechSynthesis.speak(utterance);
    }, 40);
  };

  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) {
    const once = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", once);
      applyVoice(utterance);
      speakNow();
    };
    window.speechSynthesis.addEventListener("voiceschanged", once);
  } else {
    speakNow();
  }

  state.speaking = true;
  state.speechPaused = false;
  state.speechMode = mode;
  updateListenControls();
}

function stopListening() {
  clearHoverTimer();
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  state.speaking = false;
  state.speechPaused = false;
  state.speechMode = null;
  clearSpeakingHighlight();
  updateListenControls();
}

function clearHoverTimer() {
  if (state.hoverTimer) {
    clearTimeout(state.hoverTimer);
    state.hoverTimer = null;
  }
}

function clearSpeakingHighlight() {
  notesView?.querySelectorAll(".speak-active").forEach((el) => {
    el.classList.remove("speak-active");
  });
}

function updateListenControls() {
  if (!btnListen) return;
  const hasNotes = Boolean(state.notes);
  const fullActive = state.speaking && state.speechMode === "full";
  const anyActive = state.speaking;
  const ui = UI_I18N[state.language] || UI_I18N.en;

  btnListen.disabled = !hasNotes;
  btnStop.disabled = !anyActive;
  btnPause.disabled = !fullActive;
  if (speechRate) speechRate.disabled = !hasNotes;

  if (fullActive) {
    btnListen.classList.add("listening");
    btnListen.title = "Playing — use Stop to end";
    btnListen.setAttribute("aria-pressed", "true");
    const icon = btnListen.querySelector(".icon-play");
    if (icon) icon.textContent = "♪";
  } else {
    btnListen.classList.remove("listening");
    btnListen.title = "Read all notes aloud";
    btnListen.setAttribute("aria-pressed", "false");
    const icon = btnListen.querySelector(".icon-play");
    if (icon) icon.textContent = "▶";
  }

  if (btnPause) {
    const pauseIcon = btnPause.querySelector(".icon-pause");
    if (pauseIcon) pauseIcon.textContent = state.speechPaused ? "▶" : "❚❚";
    btnPause.title = state.speechPaused ? "Resume" : "Pause";
    btnPause.classList.toggle("paused", state.speechPaused);
  }

  if (listenHint) {
    if (fullActive) {
      listenHint.textContent = state.speechPaused ? ui.paused : ui.playing;
    } else if (state.speaking && state.speechMode === "hover") {
      listenHint.textContent = ui.hoverReading;
    } else {
      listenHint.textContent = ui.hoverHint;
    }
  }

  updateVoiceStatus();
}

/**
 * Wire hover-to-hear on note blocks (paragraphs, headings, list items).
 */
function enableHoverSpeak() {
  if (!notesView) return;

  notesView.querySelectorAll(".speakable").forEach((el) => {
    el.classList.remove("speakable");
    el.removeAttribute("title");
  });

  const blocks = notesView.querySelectorAll("h1, h2, h3, h4, p, li, blockquote");
  blocks.forEach((el) => {
    const text = (el.textContent || "").trim();
    if (text.length < 2) return;
    el.classList.add("speakable");
    const ui = UI_I18N[state.language] || UI_I18N.en;
    el.title = ui.hoverHint;

    el.addEventListener("mouseenter", () => {
      // Don't interrupt full-notes playback
      if (state.speechMode === "full" && state.speaking) return;

      clearHoverTimer();
      state.hoverTimer = setTimeout(() => {
        clearSpeakingHighlight();
        el.classList.add("speak-active");
        startListening(text, "hover");
      }, 450);
    });

    el.addEventListener("mouseleave", () => {
      clearHoverTimer();
      // Stop hover speech when leaving the block
      if (state.speechMode === "hover" && state.speaking) {
        stopListening();
      } else {
        el.classList.remove("speak-active");
      }
    });

    el.addEventListener("click", (e) => {
      // Don't steal clicks from links inside notes
      if (e.target.closest("a")) return;
      if (state.speechMode === "full" && state.speaking) return;
      e.preventDefault();
      clearHoverTimer();
      clearSpeakingHighlight();
      el.classList.add("speak-active");
      startListening(text, "hover");
    });
  });
}

function showNotes(markdown) {
  notesEmpty.classList.add("hidden");
  notesEdit.classList.add("hidden");
  notesView.classList.remove("hidden");
  notesToolbar.classList.remove("hidden");
  listenBar.classList.remove("hidden");
  notesView.innerHTML = renderMarkdown(markdown);

  notesView.classList.remove("rtl", "lang-hi", "lang-ur", "lang-en");
  if (state.language === "ur") {
    notesView.setAttribute("dir", "rtl");
    notesView.classList.add("rtl", "lang-ur");
  } else if (state.language === "hi") {
    notesView.setAttribute("dir", "ltr");
    notesView.classList.add("lang-hi");
  } else {
    notesView.setAttribute("dir", "ltr");
    notesView.classList.add("lang-en");
  }

  if (notesLangBadge) {
    notesLangBadge.textContent = (LANG_SPEECH[state.language] || LANG_SPEECH.en).code;
  }

  enableHoverSpeak();

  btnListen.disabled = false;
  btnCopy.disabled = false;
  btnDownload.disabled = false;
  if (speechRate) speechRate.disabled = false;
  btnEditNotes.classList.remove("hidden");
  btnSaveNotes.classList.add("hidden");
  btnCancelEdit.classList.add("hidden");
  updateListenControls();
}

function resetNotesUI() {
  stopListening();
  notesEmpty.classList.remove("hidden");
  notesView.classList.add("hidden");
  notesEdit.classList.add("hidden");
  notesToolbar.classList.add("hidden");
  listenBar.classList.add("hidden");
  notesView.innerHTML = "";
  notesView.removeAttribute("dir");
  notesView.classList.remove("rtl", "lang-hi", "lang-ur", "lang-en");
  btnListen.disabled = true;
  btnPause.disabled = true;
  btnStop.disabled = true;
  if (speechRate) speechRate.disabled = true;
  btnCopy.disabled = true;
  btnDownload.disabled = true;
  updateListenControls();
}

function renderMarkdown(md) {
  if (typeof marked !== "undefined" && marked.parse) {
    return marked.parse(md || "");
  }
  // Fallback: escape + basic newlines
  return `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(md || "")}</pre>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ─── Follow-up chat / commands ──────────────────────────
function wireChat() {
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = chatInput.value.trim();
    if (!msg || !state.sessionId || state.chatting) return;
    chatInput.value = "";
    await sendCommand(msg);
  });

  suggestions.addEventListener("click", async (e) => {
    const chip = e.target.closest(".chip");
    if (!chip || chip.disabled || !state.sessionId) return;
    const cmd = chip.dataset.cmd;
    if (cmd) await sendCommand(cmd);
  });
}

function enableChat() {
  chatInput.disabled = false;
  btnSend.disabled = false;
  chatInput.placeholder = "Ask a follow-up command…";
  chatEmpty.querySelectorAll(".chip").forEach((c) => (c.disabled = false));
  // Keep suggestions visible until first message
}

function resetChatUI() {
  chatLog.innerHTML = "";
  chatInput.disabled = true;
  btnSend.disabled = true;
  chatInput.placeholder = "Analyze a video first…";
  chatEmpty.classList.remove("hidden");
  chatEmpty.querySelectorAll(".chip").forEach((c) => (c.disabled = true));
}

async function sendCommand(message) {
  if (!state.sessionId) return;
  state.chatting = true;
  chatEmpty.classList.add("hidden");
  appendMsg("user", message);
  const typing = appendMsg("assistant", "Thinking…", true);
  chatInput.disabled = true;
  btnSend.disabled = true;

  try {
    const res = await fetch("/api/follow-up", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: state.sessionId,
        message,
        includeFrames: true,
      }),
    });
    const data = await parseApiJson(res);
    typing.remove();
    if (!res.ok) throw new Error(data.error || "Follow-up failed");
    appendMsg("assistant", data.reply);
  } catch (err) {
    typing.remove();
    appendMsg("error", err.message || "Request failed");
  } finally {
    state.chatting = false;
    chatInput.disabled = false;
    btnSend.disabled = false;
    chatInput.focus();
  }
}

function appendMsg(role, text, isTyping = false) {
  const el = document.createElement("div");
  el.className = `msg ${role}${isTyping ? " typing" : ""}`;
  if (role === "assistant" && !isTyping) {
    el.innerHTML = renderMarkdown(text);
  } else {
    el.textContent = text;
  }
  chatLog.appendChild(el);
  chatLog.scrollTop = chatLog.scrollHeight;
  return el;
}

// Disable suggestion chips until ready
chatEmpty.querySelectorAll(".chip").forEach((c) => (c.disabled = true));

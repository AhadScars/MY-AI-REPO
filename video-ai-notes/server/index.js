require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const { analyzeVideo, translateNotes, followUp, normalizeLanguage } = require("./ai");

const app = express();
const PORT = process.env.PORT || 3847;

// In-memory session store (notes + frames + chat history)
const sessions = new Map();

app.use(cors());
app.use(express.json({ limit: "50mb" }));

// ─── API routes (must be before static files) ───────────

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    model: process.env.MODEL || "gemini-3.5-flash",
    features: ["analyze", "follow-up", "translate", "notes"],
  });
});

/**
 * Analyze video from client-extracted frames.
 * Body: { frames: [{timestamp, dataUrl}], filename, duration, customPrompt?, language? }
 */
app.post("/api/analyze", async (req, res) => {
  try {
    const { frames, filename, duration, customPrompt, language } = req.body || {};
    const lang = normalizeLanguage(language);

    if (!frames || !Array.isArray(frames) || frames.length === 0) {
      return res.status(400).json({ error: "No frames provided. Extract frames from a video first." });
    }
    if (frames.length > 20) {
      return res.status(400).json({ error: "Too many frames (max 20)." });
    }

    for (const f of frames) {
      if (!f.dataUrl || !String(f.dataUrl).startsWith("data:image")) {
        return res.status(400).json({ error: "Each frame needs a data:image/... dataUrl." });
      }
    }

    console.log(
      `[analyze] ${filename || "video"} — ${frames.length} frames, duration=${duration}, lang=${lang}`
    );

    const result = await analyzeVideo(frames, {
      filename: filename || "video",
      duration,
      customPrompt,
      language: lang,
    });

    const sessionId = uuidv4();
    sessions.set(sessionId, {
      id: sessionId,
      filename: filename || "video",
      duration: duration ?? null,
      notes: result.notes,
      frames,
      history: [],
      createdAt: Date.now(),
      model: result.model,
      language: lang,
    });

    if (sessions.size > 20) {
      const oldest = [...sessions.values()].sort((a, b) => a.createdAt - b.createdAt);
      while (sessions.size > 20) {
        sessions.delete(oldest.shift().id);
      }
    }

    res.json({
      sessionId,
      notes: result.notes,
      model: result.model,
      frameCount: result.frameCount,
      language: lang,
    });
  } catch (err) {
    console.error("[analyze] error:", err.message);
    const status = /api.?key|GEMINI_API_KEY|Missing|API_KEY_INVALID/i.test(err.message) ? 401 : 500;
    res.status(status).json({
      error: err.message || "Analysis failed",
    });
  }
});

/**
 * Follow-up command / chat about an analyzed video.
 * Body: { sessionId, message, includeFrames?: boolean }
 */
app.post("/api/follow-up", async (req, res) => {
  try {
    const { sessionId, message, includeFrames = true } = req.body || {};

    if (!sessionId || !sessions.has(sessionId)) {
      return res.status(404).json({ error: "Session not found. Analyze a video first." });
    }
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: "Message is required." });
    }

    const session = sessions.get(sessionId);
    const frames = includeFrames ? session.frames : [];

    console.log(`[follow-up] session=${sessionId.slice(0, 8)}… msg="${String(message).slice(0, 80)}"`);

    const result = await followUp(
      String(message).trim(),
      session.history,
      session.notes,
      frames,
      session.language || "en"
    );

    session.history.push({ role: "user", content: String(message).trim() });
    session.history.push({ role: "assistant", content: result.reply });

    if (session.history.length > 40) {
      session.history = session.history.slice(-40);
    }

    res.json({
      reply: result.reply,
      model: result.model,
      history: session.history,
    });
  } catch (err) {
    console.error("[follow-up] error:", err.message);
    const status = /api.?key|GEMINI_API_KEY|Missing|API_KEY_INVALID/i.test(err.message) ? 401 : 500;
    res.status(status).json({
      error: err.message || "Follow-up failed",
    });
  }
});

/**
 * Update notes manually (user edits).
 */
app.patch("/api/session/:id/notes", (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found." });
  const { notes } = req.body || {};
  if (typeof notes !== "string") {
    return res.status(400).json({ error: "notes must be a string." });
  }
  session.notes = notes;
  res.json({ ok: true, notes: session.notes });
});

/**
 * Translate existing session notes into another language.
 * Body: { language: "en"|"hi"|"ur" }
 */
app.post("/api/session/:id/translate", async (req, res) => {
  try {
    const session = sessions.get(req.params.id);
    if (!session) {
      return res.status(404).json({
        error: "Session not found. The server may have restarted — please Analyze the video again.",
      });
    }
    const language = normalizeLanguage(req.body?.language);
    if (!session.notes) {
      return res.status(400).json({ error: "No notes to translate. Analyze a video first." });
    }
    if (session.language === language) {
      return res.json({
        notes: session.notes,
        language,
        unchanged: true,
      });
    }

    console.log(`[translate] session=${req.params.id.slice(0, 8)}… → ${language}`);
    const result = await translateNotes(session.notes, language);
    session.notes = result.notes;
    session.language = language;
    session.history = [];

    res.json({
      notes: session.notes,
      language,
      model: result.model,
      unchanged: false,
    });
  } catch (err) {
    console.error("[translate] error:", err.message);
    const status = /api.?key|GEMINI_API_KEY|Missing|API_KEY_INVALID/i.test(err.message) ? 401 : 500;
    res.status(status).json({ error: err.message || "Translation failed" });
  }
});

app.get("/api/session/:id", (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found." });
  res.json({
    id: session.id,
    filename: session.filename,
    duration: session.duration,
    notes: session.notes,
    history: session.history,
    model: session.model,
    frameCount: session.frames?.length || 0,
    language: session.language || "en",
  });
});

// JSON 404 for any unmatched /api/* so clients never parse HTML as JSON
app.use("/api", (req, res) => {
  res.status(404).json({
    error: `API route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Static frontend (after API)
app.use(express.static(path.join(__dirname, "..", "public")));

app.listen(PORT, () => {
  console.log(`\n  Video AI Notes running at http://localhost:${PORT}`);
  console.log(`  API key: ${process.env.GEMINI_API_KEY ? "configured ✓" : "MISSING — set GEMINI_API_KEY in .env"}`);
  console.log(`  Routes: /api/health /api/analyze /api/follow-up /api/session/:id/translate\n`);
});

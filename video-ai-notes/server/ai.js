const { GoogleGenAI } = require("@google/genai");

const MODEL = process.env.MODEL || "gemini-3.5-flash";

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing GEMINI_API_KEY. Copy .env.example to .env and add your key from https://aistudio.google.com/apikey"
    );
  }
  return new GoogleGenAI({ apiKey });
}

/**
 * Parse a data:image/...;base64,... URL into Gemini inlineData parts.
 * @param {string} dataUrl
 * @returns {{ mimeType: string, data: string }}
 */
function parseDataUrl(dataUrl) {
  const match = String(dataUrl).match(
    /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/
  );
  if (!match) {
    throw new Error("Invalid image data URL (expected data:image/...;base64,...)");
  }
  return { mimeType: match[1], data: match[2] };
}

/**
 * Build Gemini content parts from frames + text.
 * @param {Array<{timestamp: string, dataUrl: string}>} frames
 * @param {string} text
 */
function buildParts(frames, text) {
  const parts = [];
  for (const frame of frames) {
    const { mimeType, data } = parseDataUrl(frame.dataUrl);
    parts.push({
      inlineData: { mimeType, data },
    });
    parts.push({ text: `[Frame at ${frame.timestamp}]` });
  }
  if (text) parts.push({ text });
  return parts;
}

const LANGUAGE_META = {
  en: {
    name: "English",
    nativeName: "English",
    script: "Latin script",
    bcp47: "en",
    systemLang:
      "You MUST write every word of your response in English (Latin script). Section titles must be in English.",
    sections: {
      title: "Video Notes",
      summary: "Summary",
      timeline: "Timeline",
      keyPoints: "Key Points",
      topics: "Topics & Tags",
      actions: "Action Items / Takeaways",
      questions: "Open Questions",
      none: "None identified.",
    },
  },
  hi: {
    name: "Hindi",
    nativeName: "हिन्दी",
    script: "Devanagari",
    bcp47: "hi",
    systemLang:
      "आपको पूरी प्रतिक्रिया केवल हिन्दी (देवनागरी लिपि) में लिखनी है। अंग्रेज़ी में नहीं लिखें — केवल नाम, ब्रांड और timestamps (जैसे 1:23) अंग्रेज़ी/अंकों में रह सकते हैं। सभी शीर्षक हिन्दी में हों।",
    sections: {
      title: "वीडियो नोट्स",
      summary: "सारांश",
      timeline: "समयरेखा",
      keyPoints: "मुख्य बिंदु",
      topics: "विषय और टैग",
      actions: "कार्य सूची / निष्कर्ष",
      questions: "खुले प्रश्न",
      none: "कोई नहीं मिला।",
    },
  },
  ur: {
    name: "Urdu",
    nativeName: "اردو",
    script: "Arabic/Nastaliq (Urdu)",
    bcp47: "ur",
    systemLang:
      "آپ کو پورا جواب صرف اردو (عربی/نستعلیق رسم الخط) میں لکھنا ہے۔ انگریزی میں مت لکھیں — صرف نام، برانڈز اور timestamps (جیسے 1:23) انگریزی/ہندسوں میں رہ سکتے ہیں۔ تمام عنوانات اردو میں ہوں۔",
    sections: {
      title: "ویڈیو نوٹس",
      summary: "خلاصہ",
      timeline: "ٹائم لائن",
      keyPoints: "اہم نکات",
      topics: "موضوعات اور ٹیگز",
      actions: "عملی اقدامات / نتائج",
      questions: "کھلے سوالات",
      none: "کوئی نہیں ملا۔",
    },
  },
};

function normalizeLanguage(lang) {
  const key = String(lang || "en").toLowerCase().slice(0, 2);
  return LANGUAGE_META[key] ? key : "en";
}

function buildLanguageSystemInstruction(language) {
  const lang = normalizeLanguage(language);
  const meta = LANGUAGE_META[lang];
  return `CRITICAL OUTPUT LANGUAGE RULE:
- Target language: ${meta.name} (${meta.nativeName}) — ${meta.script}
- ${meta.systemLang}
- Never output the full notes body in a different language.
- Keep markdown structure (# ## - bullets).
- Keep timestamps as digits (e.g. 0:12, 1:45).
- Proper nouns / brand names may stay in original form.`;
}

/**
 * Analyze video frames and produce structured notes.
 * @param {Array<{timestamp: string, dataUrl: string}>} frames
 * @param {{filename?: string, duration?: number, customPrompt?: string, language?: string}} meta
 */
async function analyzeVideo(frames, meta = {}) {
  const ai = getClient();
  const { filename = "video", duration, customPrompt } = meta;
  const language = normalizeLanguage(meta.language);
  const langMeta = LANGUAGE_META[language];
  const s = langMeta.sections;

  const durationText =
    duration != null ? `Duration: about ${formatDuration(duration)}.` : "";

  const focus = customPrompt
    ? `\nUser focus request (honor this, but still write the final notes ONLY in ${langMeta.name}):\n"${customPrompt}"\n`
    : "";

  const instruction = `Analyze this video from the key frames (chronological order).
Video file: "${filename}". ${durationText}
${focus}

Write clear, useful NOTES in Markdown. Use EXACTLY these section headings (already in the target language):

# ${s.title}: ${filename}

## ${s.summary}
A concise 2–4 sentence overview of what the video is about — written in ${langMeta.name}.

## ${s.timeline}
Bullet list of key moments with approximate timestamps (use the frame timestamps). Describe each moment in ${langMeta.name}.

## ${s.keyPoints}
- Important facts, claims, demos, or actions
- People, products, places, or tools shown
- Any numbers, stats, or decisions mentioned
(All bullets in ${langMeta.name}.)

## ${s.topics}
Comma-separated tags (in ${langMeta.name} where possible).

## ${s.actions}
Practical next steps or lessons. If none: "${s.none}"

## ${s.questions}
Things unclear from the frames alone. If none: "${s.none}"

Be specific and factual. If uncertain, say so in ${langMeta.name}. Do not invent details not supported by the frames.

REMINDER: The entire note body must be in ${langMeta.name} (${langMeta.script}).`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: buildParts(frames, instruction),
      },
    ],
    config: {
      systemInstruction: `You are an expert video analyst and multilingual note-taker.\n\n${buildLanguageSystemInstruction(language)}`,
    },
  });

  const notes = extractText(response);
  return {
    notes,
    responseId: response.responseId || null,
    model: MODEL,
    frameCount: frames.length,
    language,
  };
}

/**
 * Translate / rewrite existing notes into another language (keeps structure).
 */
async function translateNotes(notes, language) {
  const ai = getClient();
  const lang = normalizeLanguage(language);
  const langMeta = LANGUAGE_META[lang];
  const s = langMeta.sections;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Translate the following Markdown video notes into ${langMeta.name} (${langMeta.nativeName}, ${langMeta.script}).

Rules:
- Keep Markdown structure.
- Use these section titles when matching sections: ${s.title}, ${s.summary}, ${s.timeline}, ${s.keyPoints}, ${s.topics}, ${s.actions}, ${s.questions}
- Keep timestamps as digits.
- Keep proper nouns/brands as-is when natural.
- Output ONLY the translated Markdown notes, nothing else.

--- NOTES ---
${notes}`,
          },
        ],
      },
    ],
    config: {
      systemInstruction: buildLanguageSystemInstruction(lang),
    },
  });

  return {
    notes: extractText(response),
    language: lang,
    model: MODEL,
  };
}

/**
 * Follow-up chat about a previously analyzed video.
 * @param {string} message
 * @param {Array<{role: string, content: string}>} history - prior user/assistant text turns
 * @param {string} notes - the generated notes (context)
 * @param {Array<{timestamp: string, dataUrl: string}>} [frames] - optional frames for visual Q&A
 * @param {string} [language] - en | hi | ur
 */
async function followUp(message, history = [], notes = "", frames = [], language = "en") {
  const ai = getClient();
  const lang = normalizeLanguage(language);
  const langMeta = LANGUAGE_META[lang];

  const systemInstruction = `You are a helpful AI assistant helping the user understand a video they analyzed.

You have these notes from an earlier analysis of the video:

---
${notes || "(No notes available yet.)"}
---

Answer follow-up questions clearly. Reference the notes and, when frames are provided, the visual content. If you are unsure, say so. Keep answers well-structured; use short lists when helpful.

${buildLanguageSystemInstruction(lang)}
Reply in ${langMeta.name} (${langMeta.nativeName}) unless the user explicitly asks for another language.`;

  const contents = [];

  // Prior conversation (text only) — Gemini uses "model" for assistant turns
  for (const turn of history) {
    if (turn.role === "user") {
      contents.push({
        role: "user",
        parts: [{ text: turn.content }],
      });
    } else if (turn.role === "assistant") {
      contents.push({
        role: "model",
        parts: [{ text: turn.content }],
      });
    }
  }

  // Current user message — include frames if available for visual questions
  const sample =
    frames && frames.length > 0 ? sampleFrames(frames, 6) : [];
  contents.push({
    role: "user",
    parts: buildParts(sample, message),
  });

  const response = await ai.models.generateContent({
    model: MODEL,
    contents,
    config: {
      systemInstruction,
    },
  });

  const reply = extractText(response);
  return {
    reply,
    responseId: response.responseId || null,
    model: MODEL,
  };
}

function sampleFrames(frames, max) {
  if (frames.length <= max) return frames;
  const result = [];
  const step = (frames.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) {
    result.push(frames[Math.round(i * step)]);
  }
  return result;
}

function formatDuration(seconds) {
  const s = Math.floor(seconds % 60);
  const m = Math.floor(seconds / 60) % 60;
  const h = Math.floor(seconds / 3600);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function extractText(response) {
  if (!response) return "";
  if (typeof response.text === "string" && response.text) return response.text;
  // Fallback: walk candidates
  try {
    const parts =
      response.candidates?.[0]?.content?.parts ||
      response.response?.candidates?.[0]?.content?.parts ||
      [];
    const texts = parts
      .map((p) => p.text)
      .filter(Boolean);
    if (texts.length) return texts.join("\n");
  } catch {
    /* ignore */
  }
  return "";
}

module.exports = {
  analyzeVideo,
  translateNotes,
  followUp,
  getClient,
  normalizeLanguage,
  LANGUAGE_META,
};

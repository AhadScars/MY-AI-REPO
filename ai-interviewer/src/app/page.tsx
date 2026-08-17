"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSpeech } from "@/hooks/useSpeech";
import { useMediaSession } from "@/hooks/useMediaSession";

type Analysis = {
  candidateName: string;
  summary: string;
  skills: string[];
  experienceHighlights: string[];
  potentialGaps: string[];
  firstQuestion: string;
  suggestedFocusAreas: string[];
  questionBank?: string[];
};

type ResumeReview = {
  overallScore: number;
  candidateName: string;
  targetRole: string;
  summary: string;
  skills: string[];
  experienceHighlights: string[];
  strengths: string[];
  weaknesses: string[];
  atsTips: string[];
  bulletRewrites: Array<{ original: string; improved: string }>;
  actionPlan: string[];
  detailedReport: string;
};

type ChatMessage = { role: "user" | "assistant"; content: string };

type Feedback = {
  overallScore: number;
  strengths: string[];
  areasToImprove: string[];
  keyTakeaways: string[];
  spokenSummary: string;
  detailedFeedback: string;
};

type Phase = "setup" | "review" | "interview" | "feedback";

export default function Home() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [role, setRole] = useState("Software Engineer");
  const [resumeText, setResumeText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [review, setReview] = useState<ResumeReview | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [notesMd, setNotesMd] = useState("");
  const [answerDraft, setAnswerDraft] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [feedbackMd, setFeedbackMd] = useState("");
  const [status, setStatus] = useState("Upload a resume — everything runs offline on this machine");
  const [typingMode, setTypingMode] = useState(false);
  const [turnLabel, setTurnLabel] = useState("");
  const [extractPreview, setExtractPreview] = useState<string | null>(null);
  const [extractInfo, setExtractInfo] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const speech = useSpeech();
  const media = useMediaSession();

  // Prefer typed draft when user is typing so mic cannot overwrite their edit
  const liveAnswer = useMemo(() => {
    if (typingMode && answerDraft.trim()) return answerDraft;
    const fromMic = [speech.transcript, speech.interim].filter(Boolean).join(" ").trim();
    return fromMic || answerDraft;
  }, [speech.transcript, speech.interim, answerDraft, typingMode]);

  const formatRecTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const userAnswerCount = useMemo(
    () => messages.filter((m) => m.role === "user").length,
    [messages]
  );

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const refreshNotes = useCallback(async (id: string) => {
    const res = await fetch(`/api/notes?sessionId=${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setNotesMd(data.md || "");
  }, []);

  const analyzeResume = async () => {
    setBusy(true);
    setError(null);
    setStatus("Analyzing resume offline (no internet)...");
    try {
      const form = new FormData();
      form.append("role", role);
      form.append("resumeText", resumeText);
      form.append("includeReview", "true");
      if (file) form.append("file", file);

      const res = await fetch("/api/analyze", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analyze failed");

      setSessionId(data.sessionId);
      setAnalysis(data.analysis);
      setReview(data.review || null);
      if (data.extractMeta?.preview) {
        setExtractPreview(data.extractMeta.preview);
        setExtractInfo(
          `Parsed from ${data.extractMeta.source}${
            data.extractMeta.pages ? ` · ${data.extractMeta.pages} page(s)` : ""
          } · ${data.extractMeta.charCount} characters${
            data.extractMeta.warning ? ` · ${data.extractMeta.warning}` : ""
          }`
        );
      } else {
        setExtractPreview(null);
        setExtractInfo(null);
      }
      setNotesMd("");
      await refreshNotes(data.sessionId);
      setPhase("review");
      setStatus("Resume reviewed offline. Read the report, then start a practice interview.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analyze failed");
      setStatus("Analysis failed");
    } finally {
      setBusy(false);
    }
  };

  const enableMedia = async () => {
    setError(null);
    try {
      await media.enableCamera();
      setStatus("Camera and microphone ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Permission denied");
    }
  };

  const startInterview = async () => {
    if (!sessionId || !analysis) return;
    setBusy(true);
    setError(null);
    setPhase("interview");
    setStatus("Starting offline voice interview...");
    setTypingMode(false);
    setTurnLabel("Question 1");
    try {
      // Open camera once — do NOT re-call enableCamera after recording starts
      // (re-acquiring tracks used to kill MediaRecorder after a few seconds)
      if (!media.cameraOn) {
        await media.enableCamera();
        await new Promise((r) => setTimeout(r, 400));
      }
      await media.startRecording();

      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          action: "start",
          analysis,
          history: [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start interview");

      const spoken = data.spokenReply as string;
      setMessages([{ role: "assistant", content: spoken }]);
      await refreshNotes(sessionId);
      setStatus("Your turn — answer, then expect a counter-question");
      await speech.speak(spoken);
      speech.resetTranscript();
      setAnswerDraft("");
      setTypingMode(false);
      speech.startListening();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Start failed");
      setPhase("review");
      media.stopRecording();
    } finally {
      setBusy(false);
    }
  };

  const submitAnswer = async (text?: string) => {
    if (!sessionId || !analysis || busy) return;
    const answer = (text ?? liveAnswer).trim();
    if (!answer) {
      setError("Say or type an answer first.");
      return;
    }

    speech.stopListening();
    speech.stopSpeaking();
    setBusy(true);
    setError(null);
    setStatus("Evaluating answer...");
    setTypingMode(false);

    const nextHistory: ChatMessage[] = [
      ...messages,
      { role: "user", content: answer },
    ];
    // Lock answer into history immediately — cannot edit past bubbles
    setMessages(nextHistory);
    speech.resetTranscript();
    setAnswerDraft("");

    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          action: "answer",
          message: answer,
          analysis,
          history: nextHistory,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Interview turn failed");

      const spoken = data.spokenReply as string;
      const withReply = [...nextHistory, { role: "assistant" as const, content: spoken }];
      setMessages(withReply);
      await refreshNotes(sessionId);

      if (data.followUp) {
        setTurnLabel(`Counter-question after answer #${nextHistory.filter((m) => m.role === "user").length}`);
      } else if (!data.done) {
        setTurnLabel(`Next main question`);
      }

      if (data.done) {
        setStatus("Wrapping up — generating offline feedback...");
        await speech.speak(spoken);
        // Only now stop the long-running recorder
        await finishInterview(withReply);
        return;
      }

      setStatus(
        data.followUp
          ? "Counter-question — answer this probe next"
          : "Next main question — answer fully"
      );
      await speech.speak(spoken);
      setStatus("Your turn — type or use mic, then Submit");
      speech.resetTranscript();
      setAnswerDraft("");
      setTypingMode(false);
      speech.startListening();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
      speech.startListening();
    } finally {
      setBusy(false);
    }
  };

  const finishInterview = async (historyOverride?: ChatMessage[]) => {
    if (!sessionId) return;
    speech.stopListening();
    speech.stopSpeaking();
    media.stopRecording();
    setBusy(true);
    setStatus("Generating strengths and improvement areas offline...");

    try {
      const history = historyOverride || messages;
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, analysis, history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Feedback failed");

      setFeedback(data.feedback);
      setFeedbackMd(data.feedbackMd || "");
      setPhase("feedback");
      setStatus("Interview complete — all processing stayed offline");
      await refreshNotes(sessionId);
      if (data.feedback?.spokenSummary) {
        await speech.speak(data.feedback.spokenSummary);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Feedback failed");
    } finally {
      setBusy(false);
    }
  };

  const downloadText = (filename: string, content: string) => {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetAll = () => {
    speech.stopListening();
    speech.stopSpeaking();
    media.stopRecording();
    media.disableCamera();
    setPhase("setup");
    setSessionId(null);
    setAnalysis(null);
    setReview(null);
    setMessages([]);
    setNotesMd("");
    setFeedback(null);
    setFeedbackMd("");
    setAnswerDraft("");
    setExtractPreview(null);
    setExtractInfo(null);
    setError(null);
    setStatus("Upload a resume — everything runs offline on this machine");
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300/90">
            100% offline · no API keys · data stays on this PC
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
            Offline Resume Coach
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Upload a resume for a local review, then interview yourself with voice.
            Resume parsing, scoring, and feedback run entirely on your machine.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill label="Offline engine" tone="good" />
          <StatusPill
            label={media.cameraOn ? "Camera on" : "Camera off"}
            tone={media.cameraOn ? "good" : "muted"}
          />
          <StatusPill
            label={media.recording ? "Recording" : "Not recording"}
            tone={media.recording ? "danger" : "muted"}
          />
          <StatusPill
            label={
              speech.listening
                ? "Mic listening"
                : speech.speaking
                  ? "Coach speaking"
                  : "Mic idle"
            }
            tone={speech.listening ? "good" : speech.speaking ? "warn" : "muted"}
          />
          {media.recording && (
            <StatusPill
              label={`REC ${formatRecTime(media.recordingSeconds)}`}
              tone="danger"
            />
          )}
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 whitespace-pre-wrap">
          {error}
        </div>
      )}

      <div className="grid flex-1 gap-6 lg:grid-cols-12">
        {/* Left column */}
        <section className="glass flex flex-col gap-4 rounded-2xl p-4 lg:col-span-4">
          <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/40">
            <video
              ref={media.videoRef}
              muted
              playsInline
              autoPlay
              // Mirror preview like a normal webcam; recording itself stays unmirrored
              className="aspect-video w-full scale-x-[-1] object-cover bg-black"
            />
            {!media.cameraOn && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/80 text-center">
                <div className="text-4xl">📷</div>
                <p className="text-sm text-slate-300">Camera preview</p>
                <p className="px-6 text-xs text-slate-500">
                  Optional — record yourself during the mock interview
                </p>
              </div>
            )}
            {media.recording && (
              <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-red-300">
                <span className="rec-pulse h-2.5 w-2.5 rounded-full bg-red-500" />
                REC
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={enableMedia}
              className="rounded-lg bg-indigo-500 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-400"
            >
              Enable camera &amp; mic
            </button>
            {media.cameraOn && (
              <button
                onClick={media.disableCamera}
                className="rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-200 hover:bg-white/5"
              >
                Turn off camera
              </button>
            )}
            {media.recordingUrl && (
              <button
                onClick={() =>
                  media.downloadRecording(
                    `interview-${sessionId?.slice(0, 8) || "session"}.webm`
                  )
                }
                className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-500/20"
              >
                Download recording
                {media.recordingMeta
                  ? ` (${Math.max(1, Math.round(media.recordingMeta.size / 1024))} KB)`
                  : ""}
              </button>
            )}
          </div>

          {media.recordingUrl && (
            <video
              src={media.recordingUrl}
              controls
              className="aspect-video w-full rounded-lg border border-white/10 bg-black object-contain"
            />
          )}

          {media.error && <p className="text-xs text-red-300">{media.error}</p>}
          {speech.voiceName && (
            <p className="text-[11px] text-slate-500">
              Interviewer voice: <span className="text-slate-300">{speech.voiceName}</span>
              {" · "}Tip: Install “Microsoft natural voices” in Windows for less robotic TTS.
            </p>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-200">Live notes</h2>
              {sessionId && notesMd && (
                <button
                  onClick={() =>
                    downloadText(`interview-notes-${sessionId.slice(0, 8)}.md`, notesMd)
                  }
                  className="text-xs text-cyan-300 hover:underline"
                >
                  Download notes
                </button>
              )}
            </div>
            <pre className="scroll-thin h-52 overflow-auto rounded-xl border border-white/10 bg-black/30 p-3 text-xs leading-relaxed text-slate-300 whitespace-pre-wrap">
              {notesMd ||
                "Notes appear here during the interview and are saved under data/sessions/."}
            </pre>
          </div>

          {analysis && (
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <h3 className="text-sm font-semibold">Resume snapshot</h3>
              <p className="mt-1 text-xs text-slate-400">{analysis.summary}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {analysis.skills.slice(0, 10).map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[11px] text-indigo-200"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-amber-400/20 bg-amber-500/5 p-3 text-xs text-amber-100/90">
            <p className="font-semibold text-amber-200">Recording &amp; voice tips</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-amber-100/70">
              <li>Use <strong>Chrome or Edge</strong> for best mic + recording quality.</li>
              <li>Keep this tab focused while recording (background tabs can drop frames).</li>
              <li>Speak clearly after the interviewer finishes — echo cancellation helps.</li>
              <li>Type answers anytime for a fully offline path (browser STT may use cloud).</li>
              <li>Questions are now harder: trade-offs, failure modes, metrics, bar-raisers.</li>
            </ul>
          </div>
        </section>

        {/* Right column */}
        <section className="glass flex min-h-[640px] flex-col rounded-2xl p-4 lg:col-span-8">
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Status</p>
              <p className="text-sm text-slate-200">{status}</p>
            </div>
            {sessionId && (
              <p className="font-mono text-[11px] text-slate-500">
                session {sessionId.slice(0, 8)}…
              </p>
            )}
          </div>

          {phase === "setup" && (
            <div className="flex flex-1 flex-col gap-4">
              <label className="block text-sm">
                <span className="mb-1 block text-slate-300">Target role</span>
                <input
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none ring-indigo-400 focus:ring-2"
                  placeholder="e.g. Frontend Engineer, Data Analyst"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-slate-300">
                  Upload resume (PDF, DOCX, or TXT) — file is preferred over paste
                </span>
                <input
                  type="file"
                  accept=".pdf,.txt,.md,.docx,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setFile(f);
                    // Clear paste so an old paste never overrides a new PDF
                    if (f) setResumeText("");
                  }}
                  className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-500 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-indigo-400"
                />
                {file && (
                  <p className="mt-1 text-xs text-emerald-300/90">
                    Selected: {file.name} ({Math.round(file.size / 1024)} KB) — will parse this file
                  </p>
                )}
              </label>

              <label className="block flex-1 text-sm">
                <span className="mb-1 block text-slate-300">
                  Or paste resume text (only used if no file is selected)
                </span>
                <textarea
                  value={resumeText}
                  onChange={(e) => {
                    setResumeText(e.target.value);
                    if (e.target.value.trim()) setFile(null);
                  }}
                  rows={10}
                  className="h-full min-h-[180px] w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none ring-indigo-400 focus:ring-2"
                  placeholder="Paste only if you are not uploading a file..."
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  disabled={busy || (!file && !resumeText.trim())}
                  onClick={analyzeResume}
                  className="rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 hover:opacity-95 disabled:opacity-50"
                >
                  {busy ? "Reviewing offline..." : "Review resume offline"}
                </button>
              </div>

              {!speech.supported.stt && (
                <p className="text-xs text-amber-300">
                  Speech recognition is limited in this browser. Prefer Chrome/Edge, or type
                  answers.
                </p>
              )}
            </div>
          )}

          {phase === "review" && review && (
            <div className="scroll-thin flex-1 space-y-4 overflow-auto">
              {extractPreview && (
                <div className="rounded-xl border border-cyan-400/25 bg-cyan-500/5 p-4">
                  <h3 className="text-sm font-semibold text-cyan-200">What we read from your file</h3>
                  {extractInfo && (
                    <p className="mt-1 text-xs text-slate-400">{extractInfo}</p>
                  )}
                  <pre className="scroll-thin mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/30 p-2 text-[11px] leading-relaxed text-slate-300">
                    {extractPreview}
                  </pre>
                  <p className="mt-2 text-[11px] text-slate-500">
                    If this text does not match your resume, the PDF may be image-scanned — paste
                    text or export a text-based PDF.
                  </p>
                </div>
              )}

              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                <p className="text-xs uppercase tracking-wider text-emerald-300/80">
                  Resume review score
                </p>
                <p className="mt-1 text-4xl font-semibold text-emerald-200">
                  {review.overallScore}
                  <span className="text-lg text-emerald-300/70">/10</span>
                </p>
                <p className="mt-2 text-sm text-slate-300">{review.summary}</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <h3 className="font-semibold text-emerald-300">Strengths</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
                    {review.strengths.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <h3 className="font-semibold text-amber-300">Improvements</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
                    {review.weaknesses.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <h3 className="font-semibold text-cyan-300">ATS tips</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
                  {review.atsTips.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>

              {review.bulletRewrites.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <h3 className="font-semibold text-indigo-300">Bullet rewrite ideas</h3>
                  <div className="mt-3 space-y-3">
                    {review.bulletRewrites.map((b, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-white/5 bg-black/20 p-3 text-sm"
                      >
                        <p className="text-xs uppercase text-slate-500">Original</p>
                        <p className="text-slate-400">{b.original}</p>
                        <p className="mt-2 text-xs uppercase text-slate-500">Improved</p>
                        <p className="text-emerald-200/90">{b.improved}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <h3 className="font-semibold">Action plan</h3>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-300">
                  {review.actionPlan.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  disabled={busy}
                  onClick={startInterview}
                  className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-50"
                >
                  Start voice interview
                </button>
                <button
                  onClick={() =>
                    downloadText(
                      `resume-review-${sessionId?.slice(0, 8) || "session"}.md`,
                      review.detailedReport
                    )
                  }
                  className="rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/5"
                >
                  Download full review
                </button>
                <button
                  onClick={resetAll}
                  className="rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/5"
                >
                  New resume
                </button>
              </div>
            </div>
          )}

          {phase === "interview" && (
            <div className="flex flex-1 flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300">
                <span>
                  Progress: <strong className="text-white">{userAnswerCount}</strong> answers
                  submitted
                  {turnLabel ? (
                    <>
                      {" · "}
                      <span className="text-cyan-300">{turnLabel}</span>
                    </>
                  ) : null}
                </span>
                <span>
                  {media.recording ? (
                    <span className="font-mono text-red-300">
                      ● REC {formatRecTime(media.recordingSeconds)}
                    </span>
                  ) : (
                    <span className="text-slate-500">Not recording</span>
                  )}
                </span>
              </div>

              {/* Read-only transcript — past answers cannot be edited */}
              <div className="scroll-thin flex-1 space-y-3 overflow-auto rounded-xl border border-white/10 bg-black/20 p-3">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed select-text ${
                      m.role === "assistant"
                        ? "bg-indigo-500/15 text-indigo-50"
                        : "ml-auto bg-emerald-500/15 text-emerald-50"
                    }`}
                  >
                    <p className="mb-1 text-[10px] uppercase tracking-wider opacity-60">
                      {m.role === "assistant" ? "Interviewer (locked)" : "You (locked)"}
                    </p>
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {(speech.listening || speech.speaking) && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <div className="flex h-5 items-end gap-0.5">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <span
                        key={i}
                        className="wave-bar w-1 rounded-full bg-cyan-400"
                        style={{
                          height: 16,
                          animationDelay: `${i * 0.12}s`,
                          opacity: speech.speaking || speech.listening ? 1 : 0.3,
                        }}
                      />
                    ))}
                  </div>
                  {speech.speaking
                    ? "Interviewer is speaking..."
                    : "Listening to your answer..."}
                </div>
              )}

              {/* Compose box ONLY — not the chat history */}
              <div className="rounded-xl border border-cyan-400/20 bg-black/40 p-3">
                <p className="mb-1 text-xs font-medium text-cyan-200">
                  Compose next answer (not submitted until you click Submit)
                </p>
                <p className="mb-2 text-[11px] text-slate-500">
                  Typing here switches off the mic so it won&apos;t overwrite your text. Past
                  chat bubbles stay locked.
                </p>
                <textarea
                  value={
                    typingMode
                      ? answerDraft
                      : speech.transcript || speech.interim
                        ? [speech.transcript, speech.interim].filter(Boolean).join(" ")
                        : answerDraft
                  }
                  onChange={(e) => {
                    setTypingMode(true);
                    speech.stopListening();
                    speech.resetTranscript();
                    setAnswerDraft(e.target.value);
                  }}
                  onFocus={() => {
                    // Focus for typing without wiping mic text until they type
                  }}
                  rows={4}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none ring-cyan-400 focus:ring-2"
                  placeholder="Type your answer here, or use Start mic then Submit..."
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    disabled={busy || speech.speaking}
                    onClick={() => {
                      setTypingMode(false);
                      speech.stopSpeaking();
                      speech.resetTranscript();
                      setAnswerDraft("");
                      speech.startListening();
                      setStatus("Listening...");
                    }}
                    className="rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/5"
                  >
                    {speech.listening ? "Restart mic" : "Start mic"}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => speech.stopListening()}
                    className="rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/5"
                  >
                    Stop mic
                  </button>
                  <button
                    disabled={busy || !liveAnswer.trim() || speech.speaking}
                    onClick={() => submitAnswer()}
                    className="rounded-lg bg-indigo-500 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-400"
                  >
                    Submit answer
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => finishInterview()}
                    className="rounded-lg bg-rose-500/90 px-3 py-2 text-sm font-medium text-white hover:bg-rose-400"
                  >
                    End &amp; get feedback
                  </button>
                </div>
              </div>
            </div>
          )}

          {phase === "feedback" && feedback && (
            <div className="scroll-thin flex-1 space-y-4 overflow-auto">
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                <p className="text-xs uppercase tracking-wider text-emerald-300/80">
                  Interview score
                </p>
                <p className="mt-1 text-4xl font-semibold text-emerald-200">
                  {feedback.overallScore}
                  <span className="text-lg text-emerald-300/70">/10</span>
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <h3 className="font-semibold text-emerald-300">Strengths</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
                    {feedback.strengths.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <h3 className="font-semibold text-amber-300">Areas to improve</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
                    {feedback.areasToImprove.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <h3 className="font-semibold text-cyan-300">Key takeaways</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
                  {feedback.keyTakeaways.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <h3 className="font-semibold">Detailed feedback</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
                  {feedback.detailedFeedback}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => speech.speak(feedback.spokenSummary)}
                  className="rounded-lg bg-indigo-500 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-400"
                >
                  Play audio feedback
                </button>
                {feedbackMd && (
                  <button
                    onClick={() =>
                      downloadText(
                        `interview-feedback-${sessionId?.slice(0, 8) || "session"}.md`,
                        feedbackMd
                      )
                    }
                    className="rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/5"
                  >
                    Download feedback
                  </button>
                )}
                {notesMd && (
                  <button
                    onClick={() =>
                      downloadText(
                        `interview-notes-${sessionId?.slice(0, 8) || "session"}.md`,
                        notesMd
                      )
                    }
                    className="rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/5"
                  >
                    Download notes
                  </button>
                )}
                {media.recordingUrl && (
                  <button
                    onClick={() =>
                      media.downloadRecording(
                        `interview-${sessionId?.slice(0, 8) || "session"}.webm`
                      )
                    }
                    className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200"
                  >
                    Download session video
                  </button>
                )}
                <button
                  onClick={resetAll}
                  className="rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/5"
                >
                  New session
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "good" | "warn" | "danger" | "muted";
}) {
  const map = {
    good: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
    warn: "border-amber-400/30 bg-amber-500/10 text-amber-200",
    danger: "border-rose-400/30 bg-rose-500/10 text-rose-200",
    muted: "border-white/10 bg-white/5 text-slate-300",
  };
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${map[tone]}`}>
      {label}
    </span>
  );
}

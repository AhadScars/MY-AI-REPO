"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Textarea } from "@/components/ui";
import { api } from "@/lib/api-client";
import type { PublicInterview } from "@/lib/types";
import { formatMmSs, interviewTypeLabel } from "@/lib/utils";

type SpeechRec = {
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: (() => void) | null;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
};

function getRecognizer(): SpeechRec | null {
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export function InterviewRoom({
  interviewId,
  userName,
  durationMinutes,
  startedAt,
}: {
  interviewId: string;
  userName: string;
  durationMinutes: number;
  startedAt: string;
}) {
  const router = useRouter();
  const [interview, setInterview] = useState<PublicInterview | null>(null);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [recording, setRecording] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [now, setNow] = useState(Date.now());
  const recRef = useRef<SpeechRec | null>(null);
  const startedRef = useRef(false);

  const remaining = Math.max(
    0,
    durationMinutes * 60 - Math.floor((now - new Date(startedAt).getTime()) / 1000),
  );

  const current = useMemo(() => {
    if (!interview) return null;
    return interview.questions.find((q) => q.order === interview.currentQuestion) ?? interview.questions.at(-1) ?? null;
  }, [interview]);

  const load = useCallback(async () => {
    const data = await api<{ interview: PublicInterview }>(`/api/interviews/${interviewId}`);
    setInterview(data.interview);
    return data.interview;
  }, [interviewId]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      try {
        await api(`/api/interviews/${interviewId}/start`, { method: "POST" });
        const data = await load();
        const answered = data.questions.some((q) => q.answer);
        if (!answered) setCountdown(3);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not start the interview.");
      }
    })();
  }, [interviewId, load]);

  useEffect(() => {
    if (countdown == null) return;
    if (countdown <= 0) {
      setCountdown(null);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c == null ? null : c - 1)), 800);
    return () => clearTimeout(t);
  }, [countdown]);

  function toggleRecord() {
    if (recording) {
      recRef.current?.stop();
      setRecording(false);
      return;
    }
    const rec = getRecognizer();
    if (!rec) {
      setError("Voice capture is not available in this browser. Type your answer instead.");
      return;
    }
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (ev) => {
      let finalText = "";
      for (let i = 0; i < ev.results.length; i++) {
        const piece = ev.results[i];
        if (piece.isFinal) finalText += piece[0].transcript;
      }
      if (finalText) setAnswer((prev) => (prev ? `${prev.trim()} ${finalText}` : finalText));
    };
    rec.onerror = () => setRecording(false);
    recRef.current = rec;
    rec.start();
    setRecording(true);
  }

  async function submit(skipped = false) {
    if (!interview || !current) return;
    recRef.current?.stop();
    setRecording(false);
    setBusy(true);
    setThinking(true);
    setError(null);
    setSaved(false);
    try {
      const data = await api<{
        interview: PublicInterview;
        complete?: boolean;
        saved?: boolean;
        retryable?: boolean;
        error?: string;
      }>(`/api/interviews/${interviewId}/answer`, {
        method: "POST",
        body: JSON.stringify({ answer, skipped }),
      });
      setInterview(data.interview);
      setSaved(true);
      if (data.error) {
        setError(data.error);
        return;
      }
      setAnswer("");
      if (data.complete) {
        router.push(`/interview/${interviewId}/complete`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit that answer.");
    } finally {
      setBusy(false);
      setThinking(false);
    }
  }

  async function endNow() {
    setBusy(true);
    try {
      await api(`/api/interviews/${interviewId}/complete`, { method: "POST" });
      router.push(`/interview/${interviewId}/complete`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not end the interview.");
      setBusy(false);
    }
  }

  const progress = interview
    ? Math.round((interview.questions.filter((q) => q.answer).length / Math.max(1, interview.totalQuestions)) * 100)
    : 0;
  const topics: Array<{ t: string; s: "done" | "next" | "now" }> = interview
    ? [
        ...interview.topicsCovered.map((t) => ({ t, s: "done" as const })),
        ...interview.topicsRemaining.map((t) => ({ t, s: "next" as const })),
      ]
    : [];
  if (topics.length && current) {
    const active =
      topics.find((x) => x.s === "done" && x.t.toLowerCase() === current.category.toLowerCase()) ||
      topics.find((x) => x.s === "done");
    if (active) active.s = "now";
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {countdown != null ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-navy/80 text-white" role="status">
          <div className="text-center">
            <p className="text-sm uppercase tracking-[0.2em] text-blue-200">Interview begins in</p>
            <div className="countdown-digit mt-4 font-serif text-8xl">{countdown || "Go"}</div>
          </div>
        </div>
      ) : null}

      <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-border bg-white px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-navy">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          AI Interviewer
        </div>
        <div className="text-center text-sm font-medium text-slate-600">
          {interview ? `${interview.role} Interview` : "Loading interview"}
        </div>
        <div className="flex items-center justify-end gap-2">
          <span className={`rounded-full px-2.5 py-1 font-mono text-xs ${remaining < 60 ? "bg-red-50 text-red-700" : "bg-slate-100 text-navy"}`}>
            {formatMmSs(remaining)}
          </span>
          <Button size="sm" variant="outline" onClick={() => setConfirmEnd(true)}>
            Exit Interview
          </Button>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 py-6 lg:grid-cols-[1fr_240px]">
        <section>
          {interview ? (
            <div className="mb-4">
              <div className="mb-2 flex justify-between text-xs text-slate-500">
                <span>
                  Question {interview.currentQuestion} of {interview.totalQuestions}
                </span>
                <span>{progress}%</span>
              </div>
              <div className="progress-bar">
                <span style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : null}

          {error ? <Alert tone="error">{error}</Alert> : null}

          <div className="mt-4 rounded-2xl bg-white p-6 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">AI Interviewer</p>
            <p className="mt-3 text-lg leading-8 text-navy">
              {current?.question || "Preparing your first question…"}
            </p>
            {thinking ? (
              <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                AI Interviewer is thinking
                <span className="thinking-dot">.</span>
                <span className="thinking-dot">.</span>
                <span className="thinking-dot">.</span>
              </p>
            ) : null}
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-white p-4">
            <label htmlFor="answer" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Your response
            </label>
            <Textarea
              id="answer"
              className="mt-2 border-0 p-0 shadow-none focus-visible:outline-none"
              placeholder={`Answer as ${userName.split(" ")[0]} would in a real interview…`}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              disabled={busy || !current}
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button size="sm" variant={recording ? "danger" : "outline"} onClick={toggleRecord} disabled={busy}>
                {recording ? "Stop recording" : "Start recording"}
              </Button>
              <Button size="sm" onClick={() => submit(false)} disabled={busy || !answer.trim()}>
                Submit answer
              </Button>
              <Button size="sm" variant="ghost" onClick={() => submit(true)} disabled={busy}>
                Skip
              </Button>
              {saved ? <span className="ml-auto text-xs text-emerald-700">Saved</span> : null}
            </div>
          </div>
        </section>

        <aside className="rounded-2xl border border-border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Coverage</p>
          <ul className="mt-3 space-y-2 text-sm">
            {topics.map((item) => (
              <li key={item.t} className="flex items-center gap-2">
                <span className={item.s === "done" ? "text-emerald-600" : item.s === "now" ? "text-primary" : "text-slate-300"}>
                  {item.s === "done" ? "✓" : item.s === "now" ? "→" : "○"}
                </span>
                <span className={item.s === "now" ? "font-medium text-navy" : "text-slate-600"}>{item.t}</span>
              </li>
            ))}
          </ul>
          {interview ? (
            <p className="mt-6 text-xs leading-5 text-slate-400">
              {interviewTypeLabel(interview.interviewType)} · {interview.difficulty}
            </p>
          ) : null}
        </aside>
      </div>

      {confirmEnd ? (
        <div className="fixed inset-0 z-30 grid place-items-center bg-navy/50 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h2 className="font-serif text-2xl text-navy">End this interview?</h2>
            <p className="mt-2 text-sm text-slate-600">
              Your answers are already saved. We’ll generate a report from what you have completed.
            </p>
            <div className="mt-5 flex gap-2">
              <Button onClick={endNow} disabled={busy}>
                End and generate report
              </Button>
              <Button variant="outline" onClick={() => setConfirmEnd(false)}>
                Keep going
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

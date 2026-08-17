"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function pickRecorderMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=h264,opus",
    "video/webm",
    "video/mp4",
  ];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m));
}

export function useMediaSession() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef<string | undefined>(undefined);
  const recordingFlagRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [recordingMeta, setRecordingMeta] = useState<{ mime: string; size: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<"prompt" | "granted" | "denied" | "unknown">("unknown");

  const clearTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const attachStream = useCallback((stream: MediaStream) => {
    streamRef.current = stream;
    const el = videoRef.current;
    if (el) {
      el.srcObject = stream;
      el.muted = true;
      el.playsInline = true;
      el.setAttribute("playsinline", "true");
      void el.play().catch(() => undefined);
    }
  }, []);

  const enableCamera = useCallback(
    async (opts?: { preserveRecorder?: boolean }) => {
      setError(null);
      try {
        // Never kill tracks while recording — that truncates the file to a few seconds
        if (recordingFlagRef.current && streamRef.current) {
          const live = streamRef.current.getTracks().every((t) => t.readyState === "live");
          if (live) {
            attachStream(streamRef.current);
            setCameraOn(true);
            setPermission("granted");
            return streamRef.current;
          }
        }

        if (!opts?.preserveRecorder) {
          // Only stop old tracks if NOT recording
          if (!recordingFlagRef.current) {
            streamRef.current?.getTracks().forEach((t) => t.stop());
          }
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 },
            frameRate: { ideal: 30, min: 15 },
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: { ideal: 1 },
            sampleRate: { ideal: 48000 },
          },
        });

        for (const track of stream.getTracks()) {
          track.enabled = true;
        }

        attachStream(stream);
        setCameraOn(true);
        setPermission("granted");
        return stream;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not access camera/microphone";
        setError(message);
        setPermission("denied");
        setCameraOn(false);
        throw err;
      }
    },
    [attachStream]
  );

  const disableCamera = useCallback(() => {
    // Do not allow disable while recording
    if (recordingFlagRef.current) {
      setError("Stop the interview/recording before turning off the camera.");
      return;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);

    // Already recording — keep going (idempotent)
    if (recordingFlagRef.current && recorderRef.current?.state === "recording") {
      return;
    }

    let stream = streamRef.current;
    const dead =
      !stream ||
      stream.getTracks().length === 0 ||
      stream.getTracks().some((t) => t.readyState !== "live");
    if (dead) {
      stream = await enableCamera({ preserveRecorder: true });
    }
    if (!stream) {
      setError("Could not open camera/microphone for recording.");
      throw new Error("No media stream");
    }

    const hasVideo = stream.getVideoTracks().some((t) => t.readyState === "live" && t.enabled);
    const hasAudio = stream.getAudioTracks().some((t) => t.readyState === "live" && t.enabled);
    if (!hasVideo || !hasAudio) {
      setError("Need live camera and microphone for a full session recording.");
      throw new Error("Missing A/V tracks");
    }

    // Use the same live stream (do not rebuild in a way that drops tracks mid-session)
    const recordStream = stream;

    chunksRef.current = [];
    if (recordingUrl) {
      URL.revokeObjectURL(recordingUrl);
      setRecordingUrl(null);
    }
    setRecordingMeta(null);

    const mimeType = pickRecorderMime();
    mimeRef.current = mimeType;

    const options: MediaRecorderOptions = {
      videoBitsPerSecond: 2_500_000,
      audioBitsPerSecond: 128_000,
    };
    if (mimeType) options.mimeType = mimeType;

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(recordStream, options);
    } catch {
      recorder = new MediaRecorder(recordStream, mimeType ? { mimeType } : undefined);
    }

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.onerror = () => {
      setError("Recording error — keep this tab focused (Chrome/Edge).");
      recordingFlagRef.current = false;
      clearTick();
      setRecording(false);
    };

    recorder.onstop = () => {
      clearTick();
      recordingFlagRef.current = false;
      const type = mimeRef.current || recorder.mimeType || "video/webm";
      const blob = new Blob(chunksRef.current, { type });
      const secs = startedAtRef.current
        ? Math.round((Date.now() - startedAtRef.current) / 1000)
        : 0;
      if (blob.size < 2000) {
        setError(
          `Recording nearly empty (${secs}s wall time, ${blob.size} bytes). Keep the tab focused and do not re-enable camera mid-interview.`
        );
        setRecording(false);
        return;
      }
      const url = URL.createObjectURL(blob);
      setRecordingUrl(url);
      setRecordingMeta({ mime: type, size: blob.size });
      setRecording(false);
    };

    // If a track ends unexpectedly, surface error but do not auto-destroy chunks
    for (const track of recordStream.getTracks()) {
      track.onended = () => {
        if (recordingFlagRef.current) {
          setError("A camera/mic track ended during recording — ending file now.");
          try {
            if (recorder.state === "recording") {
              recorder.requestData();
              recorder.stop();
            }
          } catch {
            /* ignore */
          }
        }
      };
    }

    recorderRef.current = recorder;
    recordingFlagRef.current = true;
    startedAtRef.current = Date.now();
    setRecordingSeconds(0);

    // 1s timeslice — continuous chunks for long interviews
    recorder.start(1000);

    clearTick();
    tickRef.current = setInterval(() => {
      // Keep collecting; also bump timer
      if (recorder.state === "recording") {
        try {
          recorder.requestData();
        } catch {
          /* ignore */
        }
      }
      if (startedAtRef.current) {
        setRecordingSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }
      // Prevent Chromium from throttling by touching the video element
      const el = videoRef.current;
      if (el && el.paused) {
        void el.play().catch(() => undefined);
      }
    }, 1000);

    setRecording(true);
  }, [clearTick, enableCamera, recordingUrl]);

  const stopRecording = useCallback(() => {
    const rec = recorderRef.current;
    clearTick();
    if (!rec || rec.state === "inactive") {
      recordingFlagRef.current = false;
      setRecording(false);
      return;
    }
    try {
      if (rec.state === "recording") {
        rec.requestData();
      }
      // Small delay so last requestData lands before stop
      setTimeout(() => {
        try {
          if (rec.state !== "inactive") rec.stop();
        } catch {
          recordingFlagRef.current = false;
          setRecording(false);
        }
      }, 120);
    } catch {
      recordingFlagRef.current = false;
      setRecording(false);
    }
  }, [clearTick]);

  const downloadRecording = useCallback(
    (filename?: string) => {
      if (!recordingUrl) return;
      const ext = (recordingMeta?.mime || "").includes("mp4") ? "mp4" : "webm";
      const a = document.createElement("a");
      a.href = recordingUrl;
      a.download = filename || `interview-session.${ext}`;
      a.click();
    },
    [recordingUrl, recordingMeta]
  );

  useEffect(() => {
    return () => {
      clearTick();
      try {
        if (recorderRef.current && recorderRef.current.state !== "inactive") {
          recorderRef.current.stop();
        }
      } catch {
        /* ignore */
      }
      // Only stop tracks on full unmount
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    videoRef,
    cameraOn,
    recording,
    recordingSeconds,
    recordingUrl,
    recordingMeta,
    error,
    permission,
    enableCamera,
    disableCamera,
    startRecording,
    stopRecording,
    downloadRecording,
  };
}

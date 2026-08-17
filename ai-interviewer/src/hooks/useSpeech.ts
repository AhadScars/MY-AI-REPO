"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives?: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string; confidence?: number };
  }>;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

/** Make text less robotic for browser TTS */
function prepareForSpeech(raw: string): string {
  return raw
    .replace(/[`*_#>/\\]/g, " ")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s([,.!?;:])/g, "$1")
    // Slight breathing room after clauses
    .replace(/([.!?])\s+/g, "$1 ")
    .trim();
}

function splitIntoChunks(text: string, maxLen = 180): string[] {
  const prepared = prepareForSpeech(text);
  if (prepared.length <= maxLen) return [prepared];

  const sentences = prepared.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [prepared];
  const chunks: string[] = [];
  let buf = "";

  for (const s of sentences) {
    const piece = s.trim();
    if (!piece) continue;
    if ((buf + " " + piece).trim().length <= maxLen) {
      buf = (buf + " " + piece).trim();
    } else {
      if (buf) chunks.push(buf);
      if (piece.length <= maxLen) {
        buf = piece;
      } else {
        // Hard-split very long sentences on commas
        const parts = piece.split(/,\s+/);
        let sub = "";
        for (const p of parts) {
          if ((sub + ", " + p).replace(/^, /, "").length <= maxLen) {
            sub = sub ? `${sub}, ${p}` : p;
          } else {
            if (sub) chunks.push(sub);
            sub = p;
          }
        }
        buf = sub;
      }
    }
  }
  if (buf) chunks.push(buf);
  return chunks.filter(Boolean);
}

/** Score voices — prefer natural / neural ones available offline-ish on Windows/macOS */
function scoreVoice(v: SpeechSynthesisVoice): number {
  const name = v.name.toLowerCase();
  const lang = v.lang.toLowerCase();
  let score = 0;

  if (/^en(-|_)(us|gb|au|in)/.test(lang) || lang === "en") score += 10;
  else if (lang.startsWith("en")) score += 6;
  else return -100;

  // Prefer higher-quality named voices
  if (/natural|neural|online \(natural\)|premium|enhanced/.test(name)) score += 40;
  if (/microsoft (aria|jenny|guy|ryan|sonia|natasha|zira)/.test(name)) score += 35;
  if (/google (us|uk) english/.test(name)) score += 30;
  if (/samantha|alex|daniel|karen|moira|tessa|fiona/.test(name)) score += 25;
  if (/microsoft/.test(name)) score += 12;
  if (/google/.test(name)) score += 10;
  if (/female|woman|aria|jenny|samantha|sonia|zira/.test(name)) score += 4;
  // Deprioritize clearly robotic/legacy
  if (/espeak|compact|robot|whisper|novelty/.test(name)) score -= 30;
  if (v.localService) score += 3; // prefer offline-capable when quality is similar
  if (v.default) score += 2;

  return score;
}

function pickBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  const ranked = [...voices].sort((a, b) => scoreVoice(b) - scoreVoice(a));
  return ranked[0] || null;
}

export function useSpeech() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState({ stt: false, tts: false });
  const [voiceName, setVoiceName] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const shouldListenRef = useRef(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const speakTokenRef = useRef(0);

  const refreshVoices = useCallback(() => {
    if (!("speechSynthesis" in window)) return;
    const voices = window.speechSynthesis.getVoices();
    const best = pickBestVoice(voices);
    voiceRef.current = best;
    setVoiceName(best?.name || null);
  }, []);

  useEffect(() => {
    const STT = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSupported({
      stt: Boolean(STT),
      tts: "speechSynthesis" in window,
    });

    if ("speechSynthesis" in window) {
      refreshVoices();
      window.speechSynthesis.onvoiceschanged = refreshVoices;
      // Chromium sometimes needs a kick
      window.speechSynthesis.getVoices();
    }

    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [refreshVoices]);

  const speak = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!("speechSynthesis" in window)) {
        resolve();
        return;
      }

      const token = ++speakTokenRef.current;
      window.speechSynthesis.cancel();

      // Chrome bug: cancel can leave synth paused — resume after microtask
      try {
        window.speechSynthesis.resume();
      } catch {
        /* ignore */
      }

      refreshVoices();
      const chunks = splitIntoChunks(text, 160);
      if (!chunks.length) {
        resolve();
        return;
      }

      let index = 0;
      setSpeaking(true);

      const speakNext = () => {
        if (token !== speakTokenRef.current) {
          setSpeaking(false);
          resolve();
          return;
        }
        if (index >= chunks.length) {
          setSpeaking(false);
          resolve();
          return;
        }

        const utter = new SpeechSynthesisUtterance(chunks[index]);
        // Slightly slower + neutral pitch = less "chipmunk robot"
        utter.rate = 0.92;
        utter.pitch = 1.02;
        utter.volume = 1;
        utter.lang = voiceRef.current?.lang || "en-US";
        if (voiceRef.current) utter.voice = voiceRef.current;

        utter.onend = () => {
          index += 1;
          // Short pause between chunks for natural cadence
          if (index < chunks.length) {
            setTimeout(speakNext, 140);
          } else {
            setSpeaking(false);
            resolve();
          }
        };
        utter.onerror = () => {
          // Skip bad chunk rather than hanging
          index += 1;
          if (index < chunks.length) setTimeout(speakNext, 80);
          else {
            setSpeaking(false);
            resolve();
          }
        };

        // Another Chrome quirk: speak after tiny delay post-cancel
        setTimeout(() => {
          if (token !== speakTokenRef.current) return;
          try {
            window.speechSynthesis.resume();
            window.speechSynthesis.speak(utter);
          } catch {
            setSpeaking(false);
            resolve();
          }
        }, 40);
      };

      speakNext();
    });
  }, [refreshVoices]);

  const stopSpeaking = useCallback(() => {
    speakTokenRef.current += 1;
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }, []);

  const startListening = useCallback(() => {
    const STT = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!STT) return;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        /* ignore */
      }
    }

    // Pause TTS so STT doesn't hear the AI
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);

    const recognition = new STT();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;
    shouldListenRef.current = true;

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += piece;
        else interimText += piece;
      }
      if (finalText) {
        setTranscript((prev) => `${prev} ${finalText}`.trim());
      }
      setInterim(interimText);
    };

    recognition.onerror = (event) => {
      if (event.error !== "aborted" && event.error !== "no-speech") {
        console.warn("Speech recognition error:", event.error);
      }
    };

    recognition.onend = () => {
      setListening(false);
      if (shouldListenRef.current) {
        try {
          recognition.start();
          setListening(true);
        } catch {
          /* ignore restart races */
        }
      }
    };

    recognitionRef.current = recognition;
    setTranscript("");
    setInterim("");
    try {
      recognition.start();
      setListening(true);
    } catch (err) {
      console.warn("Could not start mic:", err);
    }
  }, []);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    setListening(false);
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setInterim("");
  }, []);

  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      speakTokenRef.current += 1;
      try {
        recognitionRef.current?.abort();
      } catch {
        /* ignore */
      }
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  return {
    supported,
    listening,
    speaking,
    transcript,
    interim,
    voiceName,
    speak,
    stopSpeaking,
    startListening,
    stopListening,
    resetTranscript,
    setTranscript,
  };
}

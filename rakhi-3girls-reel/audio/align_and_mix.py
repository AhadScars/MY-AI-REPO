#!/usr/bin/env python3
"""Measure center-girl mouth openness and build a lip-aligned VO bed."""
from __future__ import annotations

from pathlib import Path

import wave

import cv2
import numpy as np

WD = Path("/mnt/c/Users/Shoaib Qazi/desktop/ai/rakhi-3girls-reel")
SHOTS = [
    (WD / "shots/shot1_talk.mp4", 6.04),
    (WD / "shots/shot2_mid.mp4", 10.04),
    (WD / "shots/shot3_talk.mp4", 6.04),
]
XFADE = 0.35
# timeline starts
# shot1 0, shot2 starts 6.04-0.35=5.69, shot3 starts 5.69+10.04-0.35=15.38
# total 5.69+10.04+6.04-0.35 = 21.42
SR = 48000


def mouth_curve(path: Path) -> tuple[np.ndarray, float]:
    cap = cv2.VideoCapture(str(path))
    fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
    vals = []
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        h, w = frame.shape[:2]
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        # center girl mouth: middle 22% width, ~40–50% height
        mx, mw = int(w * 0.39), int(w * 0.22)
        my, mh = int(h * 0.38), int(h * 0.10)
        roi = gray[my : my + mh, mx : mx + mw]
        if roi.size < 50:
            vals.append(0.0)
            continue
        dark = float(np.percentile(roi, 18))
        inv = 255.0 - dark
        edges = float(cv2.Laplacian(roi, cv2.CV_64F).var())
        vals.append(inv * 0.7 + min(edges, 400) * 0.08)
    cap.release()
    arr = np.array(vals, dtype=np.float64)
    if arr.size:
        arr = (arr - arr.min()) / (np.ptp(arr) + 1e-6)
        # smooth
        k = 5
        kernel = np.ones(k) / k
        arr = np.convolve(arr, kernel, mode="same")
    return arr, fps


def rms_envelope(samples: np.ndarray, hop=1024) -> np.ndarray:
    if samples.ndim > 1:
        samples = samples.mean(axis=1)
    n = int(np.ceil(len(samples) / hop))
    env = np.zeros(n)
    for i in range(n):
        sl = samples[i * hop : (i + 1) * hop]
        env[i] = np.sqrt(np.mean(sl.astype(np.float64) ** 2) + 1e-12)
    return env


def load_wav_any(path: Path) -> tuple[int, np.ndarray]:
    # decode via ffmpeg to wav in /tmp
    import subprocess
    import tempfile

    out = path.with_suffix(".align.wav")
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(path),
            "-ac",
            "1",
            "-ar",
            str(SR),
            str(out),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    with wave.open(str(out), "rb") as w:
        sr = w.getframerate()
        n = w.getnframes()
        raw = w.readframes(n)
        data = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    return sr, data


def humanize(x: np.ndarray) -> np.ndarray:
    # light high/low pass via simple IIR-ish moving average mix
    # add tiny noise floor + very short slapback
    rng = np.random.default_rng(3)
    noise = rng.normal(0, 0.0035, x.shape)
    delay = int(0.028 * SR)
    echo = np.zeros_like(x)
    echo[delay:] = x[:-delay] * 0.11
    y = x * 0.94 + echo + noise
    # gentle saturate
    y = np.tanh(y * 1.25) * 0.92
    return y


def place(canvas: np.ndarray, sig: np.ndarray, t: float):
    i = int(t * SR)
    j = min(i + len(sig), len(canvas))
    if i >= len(canvas) or j <= i:
        return
    canvas[i:j] += sig[: j - i]


def main():
    # mouth curves
    curves = []
    for path, _ in SHOTS:
        c, fps = mouth_curve(path)
        curves.append((c, fps, path.name))
        print(path.name, "frames", len(c), "mean", round(float(c.mean()), 3), "max", round(float(c.max()), 3))

    # stitch mouth timeline with xfades (approx drop last 0.35s of outgoing)
    hop_out = []
    t = 0.0
    times = []
    for idx, ((c, fps, name), (_, dur)) in enumerate(zip(curves, SHOTS)):
        use = c
        if idx < len(SHOTS) - 1:
            cut = int(XFADE * fps)
            if cut > 0:
                use = c[: max(1, len(c) - cut)]
        for i, v in enumerate(use):
            hop_out.append(v)
            times.append(t + i / fps)
        t += (len(use) / fps)

    mouth = np.array(hop_out)
    times = np.array(times)
    # find high-open windows
    thr = float(np.quantile(mouth, 0.55))
    open_mask = mouth > thr
    # cluster starts
    starts = []
    on = False
    for i, flag in enumerate(open_mask):
        if flag and not on:
            starts.append(float(times[i]))
            on = True
        if not flag:
            on = False
    print("mouth-open onsets (s):", [round(s, 2) for s in starts[:20]])

    phrases = [
        WD / "audio/p1_neerja.mp3",
        WD / "audio/p2_neerja.mp3",
        WD / "audio/p3_neerja.mp3",
    ]
    loaded = []
    for p in phrases:
        sr, sig = load_wav_any(p)
        loaded.append(humanize(sig))
        print(p.name, "dur", round(len(sig) / SR, 2))

    # target starts: first open after 0.25, then after previous end+0.15, snapped to nearest open onset
    targets = []
    cursor = 0.25
    for sig in loaded:
        # nearest open onset >= cursor-0.15
        cands = [s for s in starts if s >= cursor - 0.2]
        start = cands[0] if cands else cursor
        # don't start too late
        if start > cursor + 1.2:
            start = cursor
        targets.append(start)
        cursor = start + len(sig) / SR + 0.18
    print("phrase starts", [round(t, 2) for t in targets])

    total = 21.30
    canvas = np.zeros(int(total * SR), dtype=np.float64)
    for sig, st in zip(loaded, targets):
        place(canvas, sig, st)
    peak = np.max(np.abs(canvas)) or 1.0
    canvas = canvas / peak * 0.78
    # fade out last 0.4s
    fo = int(0.35 * SR)
    canvas[-fo:] *= np.linspace(1, 0, fo)

    stereo = np.stack([canvas, canvas], axis=1)
    pcm = np.clip(stereo, -1, 1)
    pcm = (pcm * 32767).astype(np.int16)
    out = WD / "audio/vo_aligned.wav"
    with wave.open(str(out), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print("wrote", out, "dur", total)


if __name__ == "__main__":
    main()

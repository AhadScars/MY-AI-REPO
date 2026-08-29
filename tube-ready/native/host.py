#!/usr/bin/env python3
"""TubeReady native messaging host — runs yt-dlp for the Chrome extension."""

from __future__ import annotations

import json
import os
import re
import shutil
import struct
import subprocess
import sys
from pathlib import Path

if sys.platform == "win32":
    import msvcrt

    msvcrt.setmode(sys.stdin.fileno(), os.O_BINARY)
    msvcrt.setmode(sys.stdout.fileno(), os.O_BINARY)


def read_message():
    raw = sys.stdin.buffer.read(4)
    if not raw or len(raw) < 4:
        return None
    length = struct.unpack("<I", raw)[0]
    payload = sys.stdin.buffer.read(length)
    if not payload:
        return None
    return json.loads(payload.decode("utf-8"))


def send_message(obj):
    data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
    sys.stdout.buffer.write(struct.pack("<I", len(data)))
    sys.stdout.buffer.write(data)
    sys.stdout.buffer.flush()


def find_ytdlp():
    for name in ("yt-dlp", "yt-dlp.exe"):
        path = shutil.which(name)
        if path:
            return [path]
    return [sys.executable, "-m", "yt_dlp"]


def ytdlp_version(cmd):
    try:
        out = subprocess.check_output(cmd + ["--version"], text=True, timeout=20, stderr=subprocess.STDOUT)
        return out.strip().splitlines()[0]
    except Exception as exc:
        raise RuntimeError(f"yt-dlp is not available: {exc}") from exc


def downloads_dir():
    home = Path.home()
    for candidate in (home / "Downloads" / "TubeReady", Path(os.environ.get("USERPROFILE", "")) / "Downloads" / "TubeReady"):
        if str(candidate).strip("."):
            candidate.mkdir(parents=True, exist_ok=True)
            return candidate
    dest = home / "Downloads" / "TubeReady"
    dest.mkdir(parents=True, exist_ok=True)
    return dest


def format_for(quality, mode, has_ffmpeg):
    if mode == "audio":
        return "bestaudio/best"
    wanted = "1080" if quality == "max" else str(quality or "720")
    if not wanted.isdigit():
        wanted = "720"
    if has_ffmpeg:
        if quality == "max":
            return "bv*+ba/b"
        return f"bv*[height<={wanted}]+ba/b[height<={wanted}]/b"
    if quality == "max":
        return "b"
    return f"best[height<={wanted}][acodec!=none]/best[height<={wanted}]/best"


def run_download(url, quality, mode):
    cmd = find_ytdlp()
    ytdlp_version(cmd)
    has_ffmpeg = bool(shutil.which("ffmpeg"))
    dest = downloads_dir()
    outtmpl = str(dest / "%(title).180B [%(id)s].%(ext)s")
    fmt = format_for(quality, mode, has_ffmpeg)
    args = cmd + [
        "--newline",
        "--no-color",
        "--no-playlist",
        "--windows-filenames",
        "--no-mtime",
        "-o",
        outtmpl,
        "-f",
        fmt,
        "--print",
        "after_move:%(filepath)s",
        "--print",
        "after_video:%(filepath)s",
    ]
    if mode == "audio" and has_ffmpeg:
        args += ["-x", "--audio-format", "m4a", "--audio-quality", "0"]
    args.append(url)

    proc = subprocess.Popen(
        args,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        bufsize=1,
    )
    filepath = None
    percent_re = re.compile(r"\[download\]\s+(\d+(?:\.\d+)?)%")
    dest_re = re.compile(r"Destination:\s+(.+)$")
    merger_re = re.compile(r"Merging formats into \"(.+)\"")

    assert proc.stdout is not None
    for line in proc.stdout:
        line = line.strip()
        if not line:
            continue
        match = percent_re.search(line)
        if match:
            send_message(
                {
                    "type": "progress",
                    "percent": float(match.group(1)) / 100.0,
                    "line": line,
                }
            )
            continue
        dest_match = dest_re.search(line) or merger_re.search(line)
        if dest_match:
            filepath = dest_match.group(1).strip()
            continue
        if line.endswith((".mp4", ".webm", ".mkv", ".m4a", ".mp3", ".opus")) and Path(line).exists():
            filepath = line

    code = proc.wait()
    if code != 0:
        raise RuntimeError(f"yt-dlp exited with code {code}")
    if filepath:
        return filepath
    files = sorted(dest.glob("*"), key=lambda p: p.stat().st_mtime, reverse=True)
    return str(files[0]) if files else str(dest)


def handle(message):
    kind = message.get("type")
    if kind == "ping":
        cmd = find_ytdlp()
        version = ytdlp_version(cmd)
        return {
            "type": "pong",
            "ok": True,
            "version": version,
            "ffmpeg": bool(shutil.which("ffmpeg")),
            "exe": " ".join(cmd),
        }
    if kind == "download":
        url = message.get("url")
        if not url:
            raise RuntimeError("Missing video URL")
        send_message({"type": "progress", "percent": 0.01, "line": "Starting yt-dlp"})
        filepath = run_download(url, message.get("quality") or "720", message.get("mode") or "video")
        return {
            "type": "done",
            "ok": True,
            "filepath": filepath,
            "filename": Path(filepath).name if filepath else "",
        }
    raise RuntimeError(f"Unknown message: {kind}")


def main():
    while True:
        try:
            message = read_message()
        except Exception as exc:
            send_message({"type": "error", "ok": False, "error": f"Bad message: {exc}"})
            return
        if message is None:
            return
        try:
            reply = handle(message)
            send_message(reply)
        except Exception as exc:
            send_message({"type": "error", "ok": False, "error": str(exc)})


if __name__ == "__main__":
    main()

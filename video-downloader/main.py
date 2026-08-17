#!/usr/bin/env python3
"""
MediaVault — Professional multi-platform video & audio downloader.
Supports YouTube, Instagram, TikTok, and 1000+ sites via yt-dlp.
"""

from __future__ import annotations

import os
import re
import sys
import threading
import webbrowser
from pathlib import Path
from typing import Any, Callable, Optional

# ---------------------------------------------------------------------------
# Dependency bootstrap
# ---------------------------------------------------------------------------
try:
    import customtkinter as ctk
    from tkinter import filedialog, messagebox
except ImportError:
    print("Missing dependency: customtkinter")
    print("Install with:  pip install -r requirements.txt")
    sys.exit(1)

try:
    import yt_dlp
except ImportError:
    print("Missing dependency: yt-dlp")
    print("Install with:  pip install -r requirements.txt")
    sys.exit(1)


# ---------------------------------------------------------------------------
# Theme & constants
# ---------------------------------------------------------------------------
APP_NAME = "MediaVault"
APP_VERSION = "1.0.0"
APP_DIR = Path(__file__).resolve().parent
DEFAULT_DOWNLOAD_DIR = APP_DIR / "downloads"

# Colors — deep slate professional palette
C_BG = "#0B0F14"
C_SURFACE = "#121820"
C_CARD = "#161D27"
C_BORDER = "#243041"
C_PRIMARY = "#3B82F6"
C_PRIMARY_HOVER = "#2563EB"
C_ACCENT = "#22D3EE"
C_SUCCESS = "#22C55E"
C_WARNING = "#F59E0B"
C_DANGER = "#EF4444"
C_TEXT = "#F1F5F9"
C_MUTED = "#94A3B8"
C_DIM = "#64748B"

PLATFORM_COLORS = {
    "YouTube": "#FF0000",
    "Instagram": "#E1306C",
    "TikTok": "#00F2EA",
    "Twitter/X": "#1DA1F2",
    "Facebook": "#1877F2",
    "Vimeo": "#1AB7EA",
    "Reddit": "#FF4500",
    "Unknown": C_DIM,
}

QUALITY_MAP = {
    "Best (Original)": "bestvideo*+bestaudio/best",
    "1080p": "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best",
    "720p": "bestvideo[height<=720]+bestaudio/best[height<=720]/best",
    "480p": "bestvideo[height<=480]+bestaudio/best[height<=480]/best",
    "360p": "bestvideo[height<=360]+bestaudio/best[height<=360]/best",
}

AUDIO_FORMATS = {
    "MP3 (320kbps)": {"format": "bestaudio/best", "postprocessors": [{
        "key": "FFmpegExtractAudio",
        "preferredcodec": "mp3",
        "preferredquality": "320",
    }]},
    "M4A (Best)": {"format": "bestaudio/best", "postprocessors": [{
        "key": "FFmpegExtractAudio",
        "preferredcodec": "m4a",
        "preferredquality": "0",
    }]},
    "WAV (Lossless)": {"format": "bestaudio/best", "postprocessors": [{
        "key": "FFmpegExtractAudio",
        "preferredcodec": "wav",
    }]},
    "OPUS (Best)": {"format": "bestaudio/best", "postprocessors": [{
        "key": "FFmpegExtractAudio",
        "preferredcodec": "opus",
        "preferredquality": "0",
    }]},
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def detect_platform(url: str) -> str:
    u = url.lower()
    if "youtube.com" in u or "youtu.be" in u or "music.youtube" in u:
        return "YouTube"
    if "instagram.com" in u or "instagr.am" in u:
        return "Instagram"
    if "tiktok.com" in u or "vm.tiktok.com" in u:
        return "TikTok"
    if "twitter.com" in u or "x.com" in u:
        return "Twitter/X"
    if "facebook.com" in u or "fb.watch" in u:
        return "Facebook"
    if "vimeo.com" in u:
        return "Vimeo"
    if "reddit.com" in u or "redd.it" in u:
        return "Reddit"
    return "Unknown"


def format_size(num: Optional[float]) -> str:
    if not num or num <= 0:
        return "—"
    for unit in ("B", "KB", "MB", "GB"):
        if num < 1024:
            return f"{num:.1f} {unit}"
        num /= 1024
    return f"{num:.1f} TB"


def format_duration(seconds: Optional[float]) -> str:
    if not seconds:
        return "—"
    seconds = int(seconds)
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    if h:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


def sanitize_filename(name: str) -> str:
    name = re.sub(r'[<>:"/\\|?*]', "", name)
    return name.strip()[:180] or "download"


# ---------------------------------------------------------------------------
# Downloader engine
# ---------------------------------------------------------------------------
class DownloadEngine:
    def __init__(
        self,
        on_progress: Callable[[dict], None],
        on_status: Callable[[str], None],
        on_complete: Callable[[bool, str], None],
    ):
        self.on_progress = on_progress
        self.on_status = on_status
        self.on_complete = on_complete
        self._cancel = False
        self._ydl: Optional[yt_dlp.YoutubeDL] = None

    def cancel(self) -> None:
        self._cancel = True

    def fetch_info(self, url: str) -> dict[str, Any]:
        opts = {
            "quiet": True,
            "no_warnings": True,
            "skip_download": True,
            "extract_flat": False,
            "noplaylist": True,
        }
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
        if not info:
            raise RuntimeError("Could not extract video information.")
        return {
            "title": info.get("title") or "Untitled",
            "uploader": info.get("uploader") or info.get("channel") or "Unknown",
            "duration": info.get("duration"),
            "thumbnail": info.get("thumbnail"),
            "view_count": info.get("view_count"),
            "resolution": self._best_resolution(info),
            "ext": info.get("ext") or "mp4",
            "filesize": info.get("filesize") or info.get("filesize_approx"),
            "webpage_url": info.get("webpage_url") or url,
            "platform": detect_platform(url),
        }

    @staticmethod
    def _best_resolution(info: dict) -> str:
        height = info.get("height")
        width = info.get("width")
        if height:
            return f"{height}p" if not width else f"{width}x{height}"
        formats = info.get("formats") or []
        best_h = 0
        for f in formats:
            h = f.get("height") or 0
            if h > best_h:
                best_h = h
        return f"{best_h}p" if best_h else "Original"

    def download(
        self,
        url: str,
        out_dir: Path,
        mode: str,
        quality: str,
        audio_format: str,
    ) -> None:
        self._cancel = False
        out_dir.mkdir(parents=True, exist_ok=True)

        def hook(d: dict) -> None:
            if self._cancel:
                raise yt_dlp.utils.DownloadCancelled("Cancelled by user")
            status = d.get("status")
            if status == "downloading":
                total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
                done = d.get("downloaded_bytes") or 0
                speed = d.get("speed") or 0
                eta = d.get("eta")
                pct = (done / total * 100) if total else 0
                self.on_progress({
                    "percent": pct,
                    "downloaded": done,
                    "total": total,
                    "speed": speed,
                    "eta": eta,
                    "filename": d.get("filename") or "",
                })
            elif status == "finished":
                self.on_status("Processing / merging media…")
            elif status == "error":
                self.on_status("Download error from source.")

        opts: dict[str, Any] = {
            "outtmpl": str(out_dir / "%(title).180B [%(id)s].%(ext)s"),
            "progress_hooks": [hook],
            "noplaylist": True,
            "retries": 5,
            "fragment_retries": 5,
            "ignoreerrors": False,
            "quiet": True,
            "no_warnings": True,
            "concurrent_fragment_downloads": 4,
            # Prefer original / highest quality merge
            "merge_output_format": "mp4",
        }

        if mode == "audio":
            af = AUDIO_FORMATS.get(audio_format, AUDIO_FORMATS["MP3 (320kbps)"])
            opts["format"] = af["format"]
            opts["postprocessors"] = af["postprocessors"]
            opts.pop("merge_output_format", None)
        else:
            # Video — best original quality by default
            opts["format"] = QUALITY_MAP.get(quality, QUALITY_MAP["Best (Original)"])
            # Keep original when possible; remux to mp4 if needed for compatibility
            opts["postprocessors"] = [{
                "key": "FFmpegVideoRemuxer",
                "preferedformat": "mp4",
            }]

        try:
            self.on_status("Connecting to source…")
            with yt_dlp.YoutubeDL(opts) as ydl:
                self._ydl = ydl
                ydl.download([url])
            if self._cancel:
                self.on_complete(False, "Download cancelled.")
            else:
                self.on_complete(True, "Download completed successfully.")
        except yt_dlp.utils.DownloadCancelled:
            self.on_complete(False, "Download cancelled.")
        except Exception as exc:
            msg = str(exc).strip() or "Unknown error"
            # Friendlier messages
            if "ffmpeg" in msg.lower() or "ffprobe" in msg.lower():
                msg = (
                    "FFmpeg is required for merging/converting media.\n"
                    "Install FFmpeg and ensure it is on your PATH.\n"
                    f"Details: {msg}"
                )
            self.on_complete(False, msg)
        finally:
            self._ydl = None


# ---------------------------------------------------------------------------
# UI Components
# ---------------------------------------------------------------------------
class Card(ctk.CTkFrame):
    def __init__(self, master, **kwargs):
        kwargs.setdefault("fg_color", C_CARD)
        kwargs.setdefault("corner_radius", 14)
        kwargs.setdefault("border_width", 1)
        kwargs.setdefault("border_color", C_BORDER)
        super().__init__(master, **kwargs)


class Pill(ctk.CTkLabel):
    def __init__(self, master, text: str, color: str = C_PRIMARY, **kwargs):
        super().__init__(
            master,
            text=f"  {text}  ",
            font=ctk.CTkFont(family="Segoe UI", size=11, weight="bold"),
            text_color="#FFFFFF",
            fg_color=color,
            corner_radius=20,
            height=24,
            **kwargs,
        )


# ---------------------------------------------------------------------------
# Main Application
# ---------------------------------------------------------------------------
class MediaVaultApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("blue")

        self.title(f"{APP_NAME}  ·  Multi-Platform Downloader")
        self.geometry("960x720")
        self.minsize(860, 640)
        self.configure(fg_color=C_BG)

        self.download_dir = Path(DEFAULT_DOWNLOAD_DIR)
        self.download_dir.mkdir(parents=True, exist_ok=True)
        self.engine = DownloadEngine(
            on_progress=self._ui_progress,
            on_status=self._ui_status,
            on_complete=self._ui_complete,
        )
        self._busy = False
        self._info: Optional[dict] = None
        self._last_file: Optional[str] = None

        self._build_ui()
        self._center_window()

    # ---- layout ----------------------------------------------------------
    def _build_ui(self) -> None:
        # Outer padding
        root = ctk.CTkFrame(self, fg_color=C_BG)
        root.pack(fill="both", expand=True, padx=22, pady=18)
        root.grid_columnconfigure(0, weight=1)
        root.grid_rowconfigure(3, weight=1)

        self._build_header(root)
        self._build_url_section(root)
        self._build_options_section(root)
        self._build_info_section(root)
        self._build_progress_section(root)
        self._build_footer(root)

    def _build_header(self, parent) -> None:
        header = ctk.CTkFrame(parent, fg_color="transparent")
        header.grid(row=0, column=0, sticky="ew", pady=(0, 16))
        header.grid_columnconfigure(1, weight=1)

        logo = ctk.CTkFrame(header, width=46, height=46, corner_radius=12, fg_color=C_PRIMARY)
        logo.grid(row=0, column=0, rowspan=2, padx=(0, 14))
        logo.grid_propagate(False)
        ctk.CTkLabel(
            logo, text="▶", font=ctk.CTkFont(size=20, weight="bold"),
            text_color="#FFFFFF",
        ).place(relx=0.5, rely=0.5, anchor="center")

        ctk.CTkLabel(
            header, text=APP_NAME,
            font=ctk.CTkFont(family="Segoe UI", size=24, weight="bold"),
            text_color=C_TEXT,
        ).grid(row=0, column=1, sticky="w")

        ctk.CTkLabel(
            header,
            text="YouTube  ·  Instagram  ·  TikTok  ·  & 1000+ platforms  ·  Original quality",
            font=ctk.CTkFont(family="Segoe UI", size=12),
            text_color=C_MUTED,
        ).grid(row=1, column=1, sticky="w")

        badge = Pill(header, text=f"v{APP_VERSION}", color="#1E293B")
        badge.grid(row=0, column=2, rowspan=2, sticky="e")

    def _build_url_section(self, parent) -> None:
        card = Card(parent)
        card.grid(row=1, column=0, sticky="ew", pady=(0, 12))
        card.grid_columnconfigure(0, weight=1)

        inner = ctk.CTkFrame(card, fg_color="transparent")
        inner.pack(fill="x", padx=18, pady=16)
        inner.grid_columnconfigure(0, weight=1)

        top = ctk.CTkFrame(inner, fg_color="transparent")
        top.grid(row=0, column=0, sticky="ew", pady=(0, 8))
        top.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(
            top, text="VIDEO URL",
            font=ctk.CTkFont(family="Segoe UI", size=11, weight="bold"),
            text_color=C_DIM,
        ).grid(row=0, column=0, sticky="w")

        self.platform_pill = Pill(top, text="Ready", color=C_DIM)
        self.platform_pill.grid(row=0, column=1, sticky="e")

        self.url_entry = ctk.CTkEntry(
            inner,
            placeholder_text="Paste a YouTube, Instagram, TikTok, or any supported link…",
            height=44,
            corner_radius=10,
            border_width=1,
            border_color=C_BORDER,
            fg_color=C_SURFACE,
            text_color=C_TEXT,
            placeholder_text_color=C_DIM,
            font=ctk.CTkFont(family="Segoe UI", size=13),
        )
        self.url_entry.grid(row=1, column=0, sticky="ew")
        self.url_entry.bind("<KeyRelease>", self._on_url_change)
        self.url_entry.bind("<Return>", lambda e: self.fetch_info())

        btn_row = ctk.CTkFrame(inner, fg_color="transparent")
        btn_row.grid(row=2, column=0, sticky="ew", pady=(12, 0))

        self.fetch_btn = ctk.CTkButton(
            btn_row, text="Fetch Info", width=120, height=36,
            corner_radius=8, fg_color=C_SURFACE, hover_color=C_BORDER,
            border_width=1, border_color=C_BORDER, text_color=C_TEXT,
            font=ctk.CTkFont(family="Segoe UI", size=13, weight="bold"),
            command=self.fetch_info,
        )
        self.fetch_btn.pack(side="left", padx=(0, 8))

        ctk.CTkButton(
            btn_row, text="Paste", width=80, height=36,
            corner_radius=8, fg_color=C_SURFACE, hover_color=C_BORDER,
            border_width=1, border_color=C_BORDER, text_color=C_MUTED,
            font=ctk.CTkFont(family="Segoe UI", size=13),
            command=self._paste_url,
        ).pack(side="left", padx=(0, 8))

        ctk.CTkButton(
            btn_row, text="Clear", width=80, height=36,
            corner_radius=8, fg_color=C_SURFACE, hover_color=C_BORDER,
            border_width=1, border_color=C_BORDER, text_color=C_MUTED,
            font=ctk.CTkFont(family="Segoe UI", size=13),
            command=self._clear_url,
        ).pack(side="left")

    def _build_options_section(self, parent) -> None:
        card = Card(parent)
        card.grid(row=2, column=0, sticky="ew", pady=(0, 12))

        inner = ctk.CTkFrame(card, fg_color="transparent")
        inner.pack(fill="x", padx=18, pady=16)
        inner.grid_columnconfigure((0, 1, 2, 3), weight=1)

        # Mode
        ctk.CTkLabel(
            inner, text="DOWNLOAD MODE",
            font=ctk.CTkFont(family="Segoe UI", size=11, weight="bold"),
            text_color=C_DIM,
        ).grid(row=0, column=0, sticky="w", padx=(0, 10))

        ctk.CTkLabel(
            inner, text="VIDEO QUALITY",
            font=ctk.CTkFont(family="Segoe UI", size=11, weight="bold"),
            text_color=C_DIM,
        ).grid(row=0, column=1, sticky="w", padx=(0, 10))

        ctk.CTkLabel(
            inner, text="AUDIO FORMAT",
            font=ctk.CTkFont(family="Segoe UI", size=11, weight="bold"),
            text_color=C_DIM,
        ).grid(row=0, column=2, sticky="w", padx=(0, 10))

        ctk.CTkLabel(
            inner, text="SAVE TO",
            font=ctk.CTkFont(family="Segoe UI", size=11, weight="bold"),
            text_color=C_DIM,
        ).grid(row=0, column=3, sticky="w")

        self.mode_var = ctk.StringVar(value="Video")
        self.mode_menu = ctk.CTkSegmentedButton(
            inner,
            values=["Video", "Audio Only"],
            variable=self.mode_var,
            height=36,
            font=ctk.CTkFont(family="Segoe UI", size=12, weight="bold"),
            selected_color=C_PRIMARY,
            selected_hover_color=C_PRIMARY_HOVER,
            unselected_color=C_SURFACE,
            unselected_hover_color=C_BORDER,
            text_color=C_TEXT,
            command=self._on_mode_change,
        )
        self.mode_menu.grid(row=1, column=0, sticky="ew", padx=(0, 10), pady=(6, 0))

        self.quality_var = ctk.StringVar(value="Best (Original)")
        self.quality_menu = ctk.CTkOptionMenu(
            inner,
            values=list(QUALITY_MAP.keys()),
            variable=self.quality_var,
            height=36,
            corner_radius=8,
            fg_color=C_SURFACE,
            button_color=C_BORDER,
            button_hover_color=C_PRIMARY,
            dropdown_fg_color=C_CARD,
            dropdown_hover_color=C_BORDER,
            text_color=C_TEXT,
            font=ctk.CTkFont(family="Segoe UI", size=12),
        )
        self.quality_menu.grid(row=1, column=1, sticky="ew", padx=(0, 10), pady=(6, 0))

        self.audio_var = ctk.StringVar(value="MP3 (320kbps)")
        self.audio_menu = ctk.CTkOptionMenu(
            inner,
            values=list(AUDIO_FORMATS.keys()),
            variable=self.audio_var,
            height=36,
            corner_radius=8,
            fg_color=C_SURFACE,
            button_color=C_BORDER,
            button_hover_color=C_PRIMARY,
            dropdown_fg_color=C_CARD,
            dropdown_hover_color=C_BORDER,
            text_color=C_TEXT,
            font=ctk.CTkFont(family="Segoe UI", size=12),
            state="disabled",
        )
        self.audio_menu.grid(row=1, column=2, sticky="ew", padx=(0, 10), pady=(6, 0))

        folder_row = ctk.CTkFrame(inner, fg_color="transparent")
        folder_row.grid(row=1, column=3, sticky="ew", pady=(6, 0))
        folder_row.grid_columnconfigure(0, weight=1)

        self.folder_label = ctk.CTkLabel(
            folder_row,
            text=self._short_path(self.download_dir),
            font=ctk.CTkFont(family="Segoe UI", size=11),
            text_color=C_MUTED,
            anchor="w",
        )
        self.folder_label.grid(row=0, column=0, sticky="ew", padx=(0, 6))

        ctk.CTkButton(
            folder_row, text="Browse", width=72, height=36,
            corner_radius=8, fg_color=C_SURFACE, hover_color=C_BORDER,
            border_width=1, border_color=C_BORDER, text_color=C_TEXT,
            font=ctk.CTkFont(family="Segoe UI", size=12),
            command=self._choose_folder,
        ).grid(row=0, column=1)

    def _build_info_section(self, parent) -> None:
        card = Card(parent)
        card.grid(row=3, column=0, sticky="nsew", pady=(0, 12))
        card.grid_columnconfigure(0, weight=1)
        card.grid_rowconfigure(1, weight=1)

        head = ctk.CTkFrame(card, fg_color="transparent")
        head.grid(row=0, column=0, sticky="ew", padx=18, pady=(14, 6))

        ctk.CTkLabel(
            head, text="MEDIA DETAILS",
            font=ctk.CTkFont(family="Segoe UI", size=11, weight="bold"),
            text_color=C_DIM,
        ).pack(side="left")

        self.info_frame = ctk.CTkFrame(card, fg_color="transparent")
        self.info_frame.grid(row=1, column=0, sticky="nsew", padx=18, pady=(0, 14))
        self.info_frame.grid_columnconfigure(1, weight=1)

        self._info_placeholder = ctk.CTkLabel(
            self.info_frame,
            text="Paste a link and click  Fetch Info  to preview title, duration, and quality.",
            font=ctk.CTkFont(family="Segoe UI", size=13),
            text_color=C_DIM,
            justify="left",
        )
        self._info_placeholder.grid(row=0, column=0, columnspan=2, sticky="nw", pady=8)

        # Info fields (hidden until fetch)
        self._meta_labels: dict[str, ctk.CTkLabel] = {}
        fields = [
            ("title", "Title"),
            ("uploader", "Creator"),
            ("duration", "Duration"),
            ("resolution", "Quality"),
            ("platform", "Platform"),
        ]
        for i, (key, label) in enumerate(fields):
            lbl = ctk.CTkLabel(
                self.info_frame, text=f"{label}",
                font=ctk.CTkFont(family="Segoe UI", size=11, weight="bold"),
                text_color=C_DIM, anchor="w", width=90,
            )
            val = ctk.CTkLabel(
                self.info_frame, text="—",
                font=ctk.CTkFont(family="Segoe UI", size=13),
                text_color=C_TEXT, anchor="w",
            )
            lbl.grid(row=i, column=0, sticky="nw", pady=4)
            val.grid(row=i, column=1, sticky="ew", pady=4)
            lbl.grid_remove()
            val.grid_remove()
            self._meta_labels[key] = val
            self._meta_labels[f"{key}_lbl"] = lbl

    def _build_progress_section(self, parent) -> None:
        card = Card(parent)
        card.grid(row=4, column=0, sticky="ew", pady=(0, 12))

        inner = ctk.CTkFrame(card, fg_color="transparent")
        inner.pack(fill="x", padx=18, pady=14)
        inner.grid_columnconfigure(0, weight=1)

        top = ctk.CTkFrame(inner, fg_color="transparent")
        top.grid(row=0, column=0, sticky="ew")
        top.grid_columnconfigure(0, weight=1)

        self.status_label = ctk.CTkLabel(
            top, text="Ready to download",
            font=ctk.CTkFont(family="Segoe UI", size=12),
            text_color=C_MUTED, anchor="w",
        )
        self.status_label.grid(row=0, column=0, sticky="w")

        self.pct_label = ctk.CTkLabel(
            top, text="0%",
            font=ctk.CTkFont(family="Segoe UI", size=12, weight="bold"),
            text_color=C_ACCENT, anchor="e",
        )
        self.pct_label.grid(row=0, column=1, sticky="e")

        self.progress = ctk.CTkProgressBar(
            inner, height=10, corner_radius=5,
            progress_color=C_PRIMARY, fg_color=C_SURFACE,
        )
        self.progress.grid(row=1, column=0, sticky="ew", pady=(8, 4))
        self.progress.set(0)

        self.detail_label = ctk.CTkLabel(
            inner, text="",
            font=ctk.CTkFont(family="Segoe UI", size=11),
            text_color=C_DIM, anchor="w",
        )
        self.detail_label.grid(row=2, column=0, sticky="w")

        actions = ctk.CTkFrame(inner, fg_color="transparent")
        actions.grid(row=3, column=0, sticky="ew", pady=(12, 0))

        self.download_btn = ctk.CTkButton(
            actions, text="⬇  Download", height=44, width=180,
            corner_radius=10, fg_color=C_PRIMARY, hover_color=C_PRIMARY_HOVER,
            text_color="#FFFFFF",
            font=ctk.CTkFont(family="Segoe UI", size=14, weight="bold"),
            command=self.start_download,
        )
        self.download_btn.pack(side="left", padx=(0, 10))

        self.cancel_btn = ctk.CTkButton(
            actions, text="Cancel", height=44, width=100,
            corner_radius=10, fg_color=C_SURFACE, hover_color="#3F1D1D",
            border_width=1, border_color=C_BORDER, text_color=C_MUTED,
            font=ctk.CTkFont(family="Segoe UI", size=13),
            command=self.cancel_download, state="disabled",
        )
        self.cancel_btn.pack(side="left", padx=(0, 10))

        self.open_btn = ctk.CTkButton(
            actions, text="Open Folder", height=44, width=120,
            corner_radius=10, fg_color=C_SURFACE, hover_color=C_BORDER,
            border_width=1, border_color=C_BORDER, text_color=C_MUTED,
            font=ctk.CTkFont(family="Segoe UI", size=13),
            command=self._open_folder,
        )
        self.open_btn.pack(side="right")

    def _build_footer(self, parent) -> None:
        foot = ctk.CTkFrame(parent, fg_color="transparent")
        foot.grid(row=5, column=0, sticky="ew")

        ctk.CTkLabel(
            foot,
            text="Powered by yt-dlp  ·  FFmpeg recommended for best quality merges  ·  For personal use only",
            font=ctk.CTkFont(family="Segoe UI", size=11),
            text_color=C_DIM,
        ).pack(side="left")

        link = ctk.CTkButton(
            foot, text="yt-dlp docs", width=90, height=24,
            fg_color="transparent", hover_color=C_SURFACE,
            text_color=C_PRIMARY, font=ctk.CTkFont(size=11, underline=True),
            command=lambda: webbrowser.open("https://github.com/yt-dlp/yt-dlp"),
        )
        link.pack(side="right")

    # ---- helpers ---------------------------------------------------------
    def _center_window(self) -> None:
        self.update_idletasks()
        w, h = 960, 720
        x = (self.winfo_screenwidth() // 2) - (w // 2)
        y = (self.winfo_screenheight() // 2) - (h // 2)
        self.geometry(f"{w}x{h}+{x}+{y}")

    @staticmethod
    def _short_path(path: Path, max_len: int = 28) -> str:
        s = str(path)
        if len(s) <= max_len:
            return s
        return "…" + s[-(max_len - 1):]

    def _on_url_change(self, _event=None) -> None:
        url = self.url_entry.get().strip()
        if not url:
            self.platform_pill.configure(text="  Ready  ", fg_color=C_DIM)
            return
        platform = detect_platform(url)
        color = PLATFORM_COLORS.get(platform, C_DIM)
        self.platform_pill.configure(text=f"  {platform}  ", fg_color=color)

    def _on_mode_change(self, value: str) -> None:
        if value == "Audio Only":
            self.audio_menu.configure(state="normal")
            self.quality_menu.configure(state="disabled")
        else:
            self.audio_menu.configure(state="disabled")
            self.quality_menu.configure(state="normal")

    def _paste_url(self) -> None:
        try:
            clip = self.clipboard_get()
            if clip:
                self.url_entry.delete(0, "end")
                self.url_entry.insert(0, clip.strip())
                self._on_url_change()
        except Exception:
            pass

    def _clear_url(self) -> None:
        self.url_entry.delete(0, "end")
        self._info = None
        self._on_url_change()
        self._show_placeholder()
        self.progress.set(0)
        self.pct_label.configure(text="0%")
        self.status_label.configure(text="Ready to download", text_color=C_MUTED)
        self.detail_label.configure(text="")

    def _choose_folder(self) -> None:
        path = filedialog.askdirectory(initialdir=str(self.download_dir))
        if path:
            self.download_dir = Path(path)
            self.folder_label.configure(text=self._short_path(self.download_dir))

    def _open_folder(self) -> None:
        path = self.download_dir
        path.mkdir(parents=True, exist_ok=True)
        if sys.platform.startswith("win"):
            os.startfile(str(path))  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            os.system(f'open "{path}"')
        else:
            os.system(f'xdg-open "{path}"')

    def _show_placeholder(self) -> None:
        self._info_placeholder.grid()
        for key in ("title", "uploader", "duration", "resolution", "platform"):
            self._meta_labels[key].grid_remove()
            self._meta_labels[f"{key}_lbl"].grid_remove()

    def _show_info(self, info: dict) -> None:
        self._info_placeholder.grid_remove()
        mapping = {
            "title": info.get("title", "—"),
            "uploader": info.get("uploader", "—"),
            "duration": format_duration(info.get("duration")),
            "resolution": info.get("resolution", "—"),
            "platform": info.get("platform", "—"),
        }
        for key, value in mapping.items():
            self._meta_labels[f"{key}_lbl"].grid()
            self._meta_labels[key].configure(text=str(value))
            self._meta_labels[key].grid()

    def _set_busy(self, busy: bool) -> None:
        self._busy = busy
        state = "disabled" if busy else "normal"
        self.download_btn.configure(state=state)
        self.fetch_btn.configure(state=state)
        self.cancel_btn.configure(state="normal" if busy else "disabled")

    # ---- actions ---------------------------------------------------------
    def fetch_info(self) -> None:
        url = self.url_entry.get().strip()
        if not url:
            messagebox.showwarning(APP_NAME, "Please paste a video URL first.")
            return
        if self._busy:
            return

        self._set_busy(True)
        self.status_label.configure(text="Fetching media information…", text_color=C_ACCENT)
        self.detail_label.configure(text="")

        def worker():
            try:
                info = self.engine.fetch_info(url)
                self.after(0, lambda: self._on_info_ok(info))
            except Exception as exc:
                err = str(exc)
                self.after(0, lambda: self._on_info_err(err))

        threading.Thread(target=worker, daemon=True).start()

    def _on_info_ok(self, info: dict) -> None:
        self._info = info
        self._show_info(info)
        self._set_busy(False)
        self.status_label.configure(
            text=f"Ready  ·  {info.get('title', '')[:60]}",
            text_color=C_SUCCESS,
        )
        self.platform_pill.configure(
            text=f"  {info.get('platform', 'Unknown')}  ",
            fg_color=PLATFORM_COLORS.get(info.get("platform", ""), C_DIM),
        )

    def _on_info_err(self, err: str) -> None:
        self._set_busy(False)
        self.status_label.configure(text="Failed to fetch info", text_color=C_DANGER)
        self.detail_label.configure(text=err[:200])
        messagebox.showerror(APP_NAME, f"Could not fetch media info:\n\n{err}")

    def start_download(self) -> None:
        url = self.url_entry.get().strip()
        if not url:
            messagebox.showwarning(APP_NAME, "Please paste a video URL first.")
            return
        if self._busy:
            return

        mode = "audio" if self.mode_var.get() == "Audio Only" else "video"
        quality = self.quality_var.get()
        audio_fmt = self.audio_var.get()

        self._set_busy(True)
        self.progress.set(0)
        self.pct_label.configure(text="0%")
        self.status_label.configure(text="Starting download…", text_color=C_ACCENT)
        self.detail_label.configure(text="")

        def worker():
            self.engine.download(
                url=url,
                out_dir=self.download_dir,
                mode=mode,
                quality=quality,
                audio_format=audio_fmt,
            )

        threading.Thread(target=worker, daemon=True).start()

    def cancel_download(self) -> None:
        if self._busy:
            self.engine.cancel()
            self.status_label.configure(text="Cancelling…", text_color=C_WARNING)

    # ---- UI callbacks from engine (thread-safe via after) ----------------
    def _ui_progress(self, data: dict) -> None:
        def apply():
            pct = max(0.0, min(100.0, float(data.get("percent") or 0)))
            self.progress.set(pct / 100.0)
            self.pct_label.configure(text=f"{pct:.1f}%")
            speed = format_size(data.get("speed")) + "/s" if data.get("speed") else "—"
            total = format_size(data.get("total"))
            done = format_size(data.get("downloaded"))
            eta = data.get("eta")
            eta_s = f"{int(eta)}s" if eta is not None else "—"
            self.detail_label.configure(
                text=f"{done} / {total}   ·   {speed}   ·   ETA {eta_s}"
            )
            self.status_label.configure(text="Downloading…", text_color=C_ACCENT)
            fn = data.get("filename") or ""
            if fn:
                self._last_file = fn
        self.after(0, apply)

    def _ui_status(self, msg: str) -> None:
        self.after(0, lambda: self.status_label.configure(text=msg, text_color=C_ACCENT))

    def _ui_complete(self, ok: bool, message: str) -> None:
        def apply():
            self._set_busy(False)
            if ok:
                self.progress.set(1.0)
                self.pct_label.configure(text="100%")
                self.status_label.configure(text=message, text_color=C_SUCCESS)
                self.detail_label.configure(
                    text=f"Saved to: {self.download_dir}"
                )
                messagebox.showinfo(APP_NAME, f"{message}\n\nFolder:\n{self.download_dir}")
            else:
                self.status_label.configure(text="Download failed", text_color=C_DANGER)
                self.detail_label.configure(text=message[:240])
                if "cancel" not in message.lower():
                    messagebox.showerror(APP_NAME, message)
        self.after(0, apply)


# ---------------------------------------------------------------------------
# Entry
# ---------------------------------------------------------------------------
def main() -> None:
    DEFAULT_DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
    app = MediaVaultApp()
    app.mainloop()


if __name__ == "__main__":
    main()

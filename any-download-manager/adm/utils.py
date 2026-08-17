"""Shared helpers for ADM."""

from __future__ import annotations

import re
import urllib.parse
from pathlib import Path
from typing import Optional


def format_size(num: Optional[float]) -> str:
    if num is None or num < 0:
        return "—"
    if num == 0:
        return "0 B"
    n = float(num)
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if n < 1024:
            if unit == "B":
                return f"{int(n)} {unit}"
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} PB"


def format_speed(bps: Optional[float]) -> str:
    if not bps or bps <= 0:
        return "—"
    return f"{format_size(bps)}/s"


def format_eta(seconds: Optional[float]) -> str:
    if seconds is None or seconds < 0:
        return "—"
    seconds = int(seconds)
    if seconds < 60:
        return f"{seconds}s"
    m, s = divmod(seconds, 60)
    if m < 60:
        return f"{m}m {s}s"
    h, m = divmod(m, 60)
    if h < 24:
        return f"{h}h {m}m"
    d, h = divmod(h, 24)
    return f"{d}d {h}h"


def format_duration(seconds: Optional[float]) -> str:
    if not seconds:
        return "—"
    seconds = int(seconds)
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    if h:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


def sanitize_filename(name: str, max_len: int = 180) -> str:
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "", name)
    name = name.strip(" .")
    if not name:
        return "download"
    return name[:max_len]


def filename_from_url(url: str) -> str:
    try:
        path = urllib.parse.urlparse(url).path
        name = urllib.parse.unquote(Path(path).name)
        if name and "." in name:
            return sanitize_filename(name)
    except Exception:
        pass
    return "download.bin"


def filename_from_content_disposition(header: Optional[str]) -> Optional[str]:
    if not header:
        return None
    # filename*=UTF-8''...
    m = re.search(r"filename\*\s*=\s*([^']*)''([^;]+)", header, re.I)
    if m:
        try:
            return sanitize_filename(urllib.parse.unquote(m.group(2).strip().strip('"')))
        except Exception:
            pass
    m = re.search(r'filename\s*=\s*"([^"]+)"', header, re.I)
    if m:
        return sanitize_filename(m.group(1))
    m = re.search(r"filename\s*=\s*([^;]+)", header, re.I)
    if m:
        return sanitize_filename(m.group(1).strip().strip('"'))
    return None


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
    if "soundcloud.com" in u:
        return "SoundCloud"
    if "twitch.tv" in u:
        return "Twitch"
    return "Direct"


def is_media_site(url: str) -> bool:
    return detect_platform(url) != "Direct"


def unique_path(path: Path) -> Path:
    """If path exists, append (1), (2), ... before the suffix."""
    if not path.exists():
        return path
    stem, suffix = path.stem, path.suffix
    parent = path.parent
    n = 1
    while True:
        candidate = parent / f"{stem} ({n}){suffix}"
        if not candidate.exists():
            return candidate
        n += 1

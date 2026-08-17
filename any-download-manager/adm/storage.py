"""Persist queue history and app settings."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

from adm.models import DownloadJob


def _app_root() -> Path:
    """Project folder in dev; folder containing the .exe when frozen."""
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent.parent


APP_ROOT = _app_root()
DATA_DIR = APP_ROOT / "data"
DEFAULT_DOWNLOADS = APP_ROOT / "downloads"
SETTINGS_PATH = DATA_DIR / "settings.json"
HISTORY_PATH = DATA_DIR / "history.json"


def _native_path(path_str: str) -> str:
    """Convert WSL-style /mnt/c/... paths to Windows paths when running on Windows."""
    if not path_str:
        return str(DEFAULT_DOWNLOADS)
    # normalize slashes for detection
    raw = path_str.strip().replace("\\", "/")
    # /mnt/c/Users/... -> C:\Users\...
    # indices: 0123456 → / m n t / c /
    if sys.platform == "win32" and raw.startswith("/mnt/") and len(raw) >= 7 and raw[6] == "/":
        drive = raw[5].upper()
        rest = raw[7:]  # after /mnt/c/
        return str(Path(f"{drive}:/{rest}"))
    # Also handle //wsl$/ or accidental leading paths
    try:
        return str(Path(path_str))
    except Exception:
        return path_str


DEFAULT_SETTINGS: dict[str, Any] = {
    "download_dir": str(DEFAULT_DOWNLOADS),
    "default_connections": 16,
    "max_concurrent": 2,
    "auto_start": True,
    "theme": "dark",
}


def ensure_dirs() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    DEFAULT_DOWNLOADS.mkdir(parents=True, exist_ok=True)


def load_settings() -> dict[str, Any]:
    ensure_dirs()
    if not SETTINGS_PATH.exists():
        save_settings(DEFAULT_SETTINGS.copy())
        return DEFAULT_SETTINGS.copy()
    try:
        data = json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
        merged = DEFAULT_SETTINGS.copy()
        merged.update(data)
        # Fix broken WSL paths saved earlier
        merged["download_dir"] = _native_path(str(merged.get("download_dir") or DEFAULT_DOWNLOADS))
        # Ensure folder exists / is writable
        try:
            Path(merged["download_dir"]).mkdir(parents=True, exist_ok=True)
        except Exception:
            merged["download_dir"] = str(DEFAULT_DOWNLOADS)
            Path(merged["download_dir"]).mkdir(parents=True, exist_ok=True)
        return merged
    except Exception:
        return DEFAULT_SETTINGS.copy()


def save_settings(settings: dict[str, Any]) -> None:
    ensure_dirs()
    if "download_dir" in settings:
        settings["download_dir"] = _native_path(str(settings["download_dir"]))
    SETTINGS_PATH.write_text(json.dumps(settings, indent=2), encoding="utf-8")


def load_history() -> list[DownloadJob]:
    ensure_dirs()
    if not HISTORY_PATH.exists():
        return []
    try:
        raw = json.loads(HISTORY_PATH.read_text(encoding="utf-8"))
        jobs = []
        for item in raw:
            job = DownloadJob.from_dict(item)
            job.save_dir = _native_path(job.save_dir)
            jobs.append(job)
        return jobs
    except Exception:
        return []


def save_history(jobs: list[DownloadJob]) -> None:
    ensure_dirs()
    payload = [j.to_dict() for j in jobs[-500:]]
    HISTORY_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")

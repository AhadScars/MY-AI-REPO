"""Application configuration."""
from __future__ import annotations

import os
import sys
from pathlib import Path


def app_root() -> Path:
    """Directory for data files (works for source and frozen EXE)."""
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent.parent


ROOT = app_root()
DATA_DIR = ROOT / "data"
EXPORTS_DIR = DATA_DIR / "exports"
QR_DIR = DATA_DIR / "qr_codes"
DB_PATH = DATA_DIR / "attendance.db"
# Single shared SMS log next to the app (main.py / EXE folder) — easy to find
SMS_FILE = ROOT / "SMS.txt"
SECRET_KEY = os.environ.get("ATTENDANCE_SECRET", "school-attendance-change-me-in-prod")

# Default accounts (seeded on first run)
SUPER_ADMIN_USER = "admin"
SUPER_ADMIN_PASS = "123"
DEMO_SCHOOL_USER = "demoschool"
DEMO_SCHOOL_PASS = "123"
DEMO_SCHOOL_NAME = "Demo School 1"
# Default phone for demo / new students (SMS)
DEFAULT_STUDENT_PHONE = "9140980834"

# Host/port for local server (0.0.0.0 so phones on same Wi‑Fi can open the QR link)
HOST = os.environ.get("ATTENDANCE_HOST", "0.0.0.0")
PORT = int(os.environ.get("ATTENDANCE_PORT", "5050"))

# Optional fixed public URL printed into QR codes, e.g. http://192.168.1.10:5050
# If empty, QR is built from the browser request host when the school prints it.
PUBLIC_BASE_URL = os.environ.get("ATTENDANCE_PUBLIC_URL", "").rstrip("/")

# Default class / section filter options (always shown in dropdowns)
DEFAULT_CLASS_NUMS = [str(i) for i in range(1, 9)]  # 1 … 8
DEFAULT_SECTIONS = ["A", "B", "C", "D"]

# ── Cooldown (local PC time) ─────────────────────────────────────────────
# After a successful check-in, the same student cannot check in again until
# this many minutes have passed. Change this number to tune the cool-down.
# Example: 60 = 1 hour, 30 = 30 minutes, 5 = 5 minutes.
CHECKIN_COOLDOWN_MINUTES = int(os.environ.get("ATTENDANCE_CHECKIN_COOLDOWN", "60"))

# Same idea for check-out double-taps (defaults to same as check-in).
CHECKOUT_COOLDOWN_MINUTES = int(
    os.environ.get("ATTENDANCE_CHECKOUT_COOLDOWN", str(CHECKIN_COOLDOWN_MINUTES))
)

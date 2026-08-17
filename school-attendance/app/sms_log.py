"""
One SMS.txt file for all check-in / check-out messages.

Location: school-attendance/SMS.txt  (same folder as main.py / the EXE)
"""
from __future__ import annotations

import sys
from pathlib import Path

from app import config


def sms_path() -> Path:
    return Path(config.SMS_FILE)


def _hhmm(time_str: str | None = None) -> str:
    """HH:MM from 'HH:MM:SS' or current local time."""
    if time_str:
        parts = str(time_str).strip().split(":")
        if len(parts) >= 2:
            return f"{parts[0].zfill(2)}:{parts[1].zfill(2)}"
    from app.database import local_now

    return local_now().strftime("%H:%M")


def ensure_sms_file() -> Path:
    """Create empty SMS.txt if missing so users can always find it."""
    path = sms_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        path.write_text(
            "# School Attendance SMS log — one line per check-in / check-out\n",
            encoding="utf-8",
        )
    return path


def append_sms(line: str) -> bool:
    """Append one line to SMS.txt. Returns True on success."""
    try:
        path = ensure_sms_file()
        text = line.rstrip() + "\n"
        with open(path, "a", encoding="utf-8", newline="\n") as f:
            f.write(text)
            f.flush()
        return True
    except Exception as e:
        print(f"[SMS] Failed to write {sms_path()}: {e}", file=sys.stderr)
        return False


def log_check_in(
    student_name: str,
    time_str: str | None = None,
    phone: str | None = None,
) -> bool:
    """Log to SMS.txt and try WhatsApp (if configured)."""
    name = (student_name or "Unknown").strip()
    t = _hhmm(time_str)
    phone = (phone or config.DEFAULT_STUDENT_PHONE).strip()
    line = f"To: {phone} | Student {name} arrived at school at {t}"
    ok = append_sms(line)

    # WhatsApp (optional — needs Meta Cloud API keys)
    try:
        from app.whatsapp import is_enabled, notify_check_in

        if is_enabled():
            wa_ok, detail = notify_check_in(name, t, phone)
            status = "SENT" if wa_ok else "FAIL"
            append_sms(f"  WhatsApp {status}: {detail[:200]}")
    except Exception as e:
        append_sms(f"  WhatsApp ERROR: {e}")

    return ok


def log_check_out(
    student_name: str,
    time_str: str | None = None,
    phone: str | None = None,
) -> bool:
    """Log to SMS.txt and try WhatsApp (if configured)."""
    name = (student_name or "Unknown").strip()
    t = _hhmm(time_str)
    phone = (phone or config.DEFAULT_STUDENT_PHONE).strip()
    line = f"To: {phone} | Student {name} leave school at {t}"
    ok = append_sms(line)

    try:
        from app.whatsapp import is_enabled, notify_check_out

        if is_enabled():
            wa_ok, detail = notify_check_out(name, t, phone)
            status = "SENT" if wa_ok else "FAIL"
            append_sms(f"  WhatsApp {status}: {detail[:200]}")
    except Exception as e:
        append_sms(f"  WhatsApp ERROR: {e}")

    return ok

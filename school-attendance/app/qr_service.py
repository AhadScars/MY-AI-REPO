"""QR code generation. School gate QR opens the Enter-ID web page."""
from __future__ import annotations

from io import BytesIO
from pathlib import Path

import qrcode

from app import config


def student_payload(school_id: int, student_id: str) -> str:
    """Legacy payload (still accepted when typing/scanning into admin scanner)."""
    return f"SA|{school_id}|{student_id}"


def parse_payload(raw: str) -> tuple[int | None, str | None]:
    """Parse QR/NFC payload, gate URL, or plain student id."""
    raw = (raw or "").strip()
    if not raw:
        return None, None
    # Full gate URL with optional ?id=
    if "://" in raw and "/g/" in raw:
        try:
            # e.g. http://host:5050/g/TOKEN?id=STU001
            after = raw.split("/g/", 1)[1]
            student = None
            if "?" in after:
                path_part, query = after.split("?", 1)
                for part in query.split("&"):
                    if part.startswith("id="):
                        student = part[3:].split("#")[0]
                        break
            else:
                path_part = after.split("#")[0]
            # path_part is token only — school resolved separately
            return None, student
        except Exception:
            pass
    if raw.startswith("SA|"):
        parts = raw.split("|")
        if len(parts) >= 3:
            try:
                return int(parts[1]), parts[2]
            except ValueError:
                return None, parts[2]
    return None, raw


def gate_url(base_url: str, public_token: str, student_id: str | None = None) -> str:
    """Public URL encoded in the QR — opens Enter ID page on any phone."""
    base = (base_url or "").rstrip("/")
    url = f"{base}/g/{public_token}"
    if student_id:
        url = f"{url}?id={student_id}"
    return url


def generate_qr_image(payload: str, out_path: Path) -> Path:
    config.QR_DIR.mkdir(parents=True, exist_ok=True)
    img = qrcode.make(payload)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(str(out_path))
    return out_path


def generate_qr_bytes(payload: str) -> bytes:
    img = qrcode.make(payload)
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def qr_file_for(school_id: int, student_id: str) -> Path:
    safe = "".join(c if c.isalnum() else "_" for c in student_id)
    return config.QR_DIR / f"s{school_id}_{safe}.png"


def school_qr_file(school_id: int) -> Path:
    return config.QR_DIR / f"school_{school_id}_gate.png"

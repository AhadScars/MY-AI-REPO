"""Admin PIN authentication."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from config import ADMIN_PATH, DEFAULT_ADMIN_PIN, ensure_dirs


def _hash_pin(pin: str) -> str:
    return hashlib.sha256(pin.strip().encode("utf-8")).hexdigest()


def _load() -> dict:
    ensure_dirs()
    if not ADMIN_PATH.exists():
        data = {"pin_hash": _hash_pin(DEFAULT_ADMIN_PIN)}
        ADMIN_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")
        return data
    try:
        return json.loads(ADMIN_PATH.read_text(encoding="utf-8"))
    except Exception:
        data = {"pin_hash": _hash_pin(DEFAULT_ADMIN_PIN)}
        ADMIN_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")
        return data


def verify_pin(pin: str) -> bool:
    data = _load()
    return _hash_pin(pin) == data.get("pin_hash")


def change_pin(old_pin: str, new_pin: str) -> tuple[bool, str]:
    new_pin = new_pin.strip()
    if len(new_pin) < 4:
        return False, "PIN must be at least 4 characters."
    if not verify_pin(old_pin):
        return False, "Current PIN is incorrect."
    ensure_dirs()
    ADMIN_PATH.write_text(json.dumps({"pin_hash": _hash_pin(new_pin)}, indent=2), encoding="utf-8")
    return True, "Admin PIN updated."


def is_default_pin() -> bool:
    return verify_pin(DEFAULT_ADMIN_PIN)

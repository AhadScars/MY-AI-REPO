"""
Send WhatsApp messages for check-in / check-out.

Uses Meta WhatsApp Cloud API (official).
Configure via environment variables or a .env file next to main.py.

Required:
  WHATSAPP_ENABLED=1
  WHATSAPP_ACCESS_TOKEN=...
  WHATSAPP_PHONE_NUMBER_ID=...

Optional:
  WHATSAPP_API_VERSION=v21.0
  WHATSAPP_DEFAULT_COUNTRY=91          # India; prepended if number is 10 digits
  WHATSAPP_USE_TEMPLATE=0              # 1 = send approved template instead of free text
  WHATSAPP_TEMPLATE_NAME=attendance_alert
  WHATSAPP_TEMPLATE_LANG=en

Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from app import config


def _load_dotenv() -> None:
    """Load KEY=VALUE lines from project .env without extra packages."""
    env_path = config.ROOT / ".env"
    if not env_path.exists():
        return
    try:
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = val
    except Exception:
        pass


_load_dotenv()


def is_enabled() -> bool:
    flag = os.environ.get("WHATSAPP_ENABLED", "0").strip().lower()
    return flag in ("1", "true", "yes", "on")


def normalize_phone(phone: str | None) -> str:
    """
    Return digits-only international number (no +).
    10-digit local → prepend WHATSAPP_DEFAULT_COUNTRY (default 91).
    """
    digits = "".join(c for c in (phone or "") if c.isdigit())
    if not digits:
        return ""
    country = os.environ.get("WHATSAPP_DEFAULT_COUNTRY", "91").strip() or "91"
    if len(digits) == 10:
        return country + digits
    # Already has country code (e.g. 919140980834) or longer
    if digits.startswith("0") and len(digits) == 11:
        return country + digits[1:]
    return digits


def _credentials() -> tuple[str, str] | None:
    token = os.environ.get("WHATSAPP_ACCESS_TOKEN", "").strip()
    phone_id = os.environ.get("WHATSAPP_PHONE_NUMBER_ID", "").strip()
    if not token or not phone_id:
        return None
    return token, phone_id


def send_whatsapp_text(to_phone: str, message: str) -> tuple[bool, str]:
    """
    Send a WhatsApp text (or template) to to_phone.
    Returns (ok, detail).
    """
    if not is_enabled():
        return False, "WhatsApp disabled (set WHATSAPP_ENABLED=1)"

    creds = _credentials()
    if not creds:
        return False, "Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID"

    to = normalize_phone(to_phone)
    if not to or len(to) < 10:
        return False, f"Invalid phone: {to_phone!r}"

    token, phone_id = creds
    version = os.environ.get("WHATSAPP_API_VERSION", "v21.0").strip() or "v21.0"
    url = f"https://graph.facebook.com/{version}/{phone_id}/messages"

    use_template = os.environ.get("WHATSAPP_USE_TEMPLATE", "0").strip().lower() in (
        "1",
        "true",
        "yes",
    )

    if use_template:
        # Template must be pre-approved in Meta Business Manager.
        # Body params: {{1}}=message text (or split name/time in your own template)
        template_name = os.environ.get(
            "WHATSAPP_TEMPLATE_NAME", "attendance_alert"
        ).strip()
        lang = os.environ.get("WHATSAPP_TEMPLATE_LANG", "en").strip() or "en"
        payload: dict[str, Any] = {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {"code": lang},
                "components": [
                    {
                        "type": "body",
                        "parameters": [
                            {"type": "text", "text": message[:1024]},
                        ],
                    }
                ],
            },
        }
    else:
        # Free-form text: only works inside 24h customer-care window unless
        # the user messaged your business first. Prefer templates for production.
        payload = {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "text",
            "text": {"preview_url": False, "body": message[:4096]},
        }

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            return True, body
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        print(f"[WhatsApp] HTTP {e.code}: {err}", file=sys.stderr)
        return False, f"HTTP {e.code}: {err}"
    except Exception as e:
        print(f"[WhatsApp] Error: {e}", file=sys.stderr)
        return False, str(e)


def notify_check_in(name: str, time_hhmm: str, phone: str) -> tuple[bool, str]:
    msg = f"Student {name} arrived at school at {time_hhmm}"
    return send_whatsapp_text(phone, msg)


def notify_check_out(name: str, time_hhmm: str, phone: str) -> tuple[bool, str]:
    msg = f"Student {name} leave school at {time_hhmm}"
    return send_whatsapp_text(phone, msg)

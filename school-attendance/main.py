#!/usr/bin/env python3
"""School Attendance System — entry point (dev + PyInstaller EXE)."""
from __future__ import annotations

import os
import sys
import threading
import time
import webbrowser

# Ensure project root is on path when frozen or run as script
if getattr(sys, "frozen", False):
    BASE = os.path.dirname(sys.executable)
else:
    BASE = os.path.dirname(os.path.abspath(__file__))
if BASE not in sys.path:
    sys.path.insert(0, BASE)

from app import config  # noqa: E402
from app import create_app  # noqa: E402


def open_browser(url: str, delay: float = 1.2) -> None:
    def _open():
        time.sleep(delay)
        try:
            webbrowser.open(url)
        except Exception:
            pass

    t = threading.Thread(target=_open, daemon=True)
    t.start()


def _lan_hint() -> str:
    try:
        import socket

        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return f"http://{ip}:{config.PORT}"
    except Exception:
        return f"http://<your-pc-ip>:{config.PORT}"


def main() -> None:
    app = create_app()
    local_url = f"http://127.0.0.1:{config.PORT}"
    lan_url = _lan_hint()
    print("=" * 50)
    print("  School Attendance System")
    print(f"  This PC : {local_url}")
    print(f"  Phones  : {lan_url}  (same Wi‑Fi)")
    print("  Main admin : admin / 123")
    print("  Demo school: demoschool / 123")
    print("  Mark Attendance: school login → Mark Attendance")
    print(f"  SMS log   : {config.SMS_FILE}")
    try:
        from app.whatsapp import is_enabled

        print(
            "  WhatsApp  : "
            + ("ON (Cloud API)" if is_enabled() else "OFF — see WHATSAPP_SETUP.md")
        )
    except Exception:
        print("  WhatsApp  : OFF")
    print("  Press Ctrl+C to stop")
    print("=" * 50)

    try:
        from app.sms_log import ensure_sms_file

        ensure_sms_file()
    except Exception as e:
        print(f"  [warn] SMS file: {e}")

    # Auto-open browser when running as EXE or when ATTENDANCE_OPEN=1
    if getattr(sys, "frozen", False) or os.environ.get("ATTENDANCE_OPEN", "1") == "1":
        open_browser(local_url)

    app.run(
        host=config.HOST,
        port=config.PORT,
        debug=not getattr(sys, "frozen", False),
        use_reloader=False,
    )


if __name__ == "__main__":
    main()

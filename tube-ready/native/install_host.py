#!/usr/bin/env python3
"""Register the TubeReady yt-dlp native messaging host."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

EXT_ID = "moocdlcjbkenfjjhahfecfahlhcggbfo"
HOST_NAME = "com.tubeready.yt_dlp"


def main():
    here = Path(__file__).resolve().parent
    launcher = here / ("run_host.bat" if os.name == "nt" else "run_host.sh")
    if os.name != "nt":
        launcher.chmod(launcher.stat().st_mode | 0o111)
        (here / "host.py").chmod((here / "host.py").stat().st_mode | 0o111)

    manifest_path = here / f"{HOST_NAME}.json"
    manifest = {
        "name": HOST_NAME,
        "description": "TubeReady yt-dlp helper",
        "path": str(launcher),
        "type": "stdio",
        "allowed_origins": [f"chrome-extension://{EXT_ID}/"],
    }
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print("Wrote", manifest_path)

    if os.name == "nt":
        for hive in (
            rf"HKCU\Software\Google\Chrome\NativeMessagingHosts\{HOST_NAME}",
            rf"HKCU\Software\Chromium\NativeMessagingHosts\{HOST_NAME}",
            rf"HKCU\Software\Microsoft\Edge\NativeMessagingHosts\{HOST_NAME}",
        ):
            subprocess.run(
                ["reg", "add", hive, "/ve", "/t", "REG_SZ", "/d", str(manifest_path), "/f"],
                check=False,
                capture_output=True,
            )
            print("Registered", hive)
    else:
        for folder in (
            Path.home() / ".config/google-chrome/NativeMessagingHosts",
            Path.home() / ".config/chromium/NativeMessagingHosts",
            Path.home() / ".config/microsoft-edge/NativeMessagingHosts",
        ):
            folder.mkdir(parents=True, exist_ok=True)
            target = folder / f"{HOST_NAME}.json"
            target.write_text(manifest_path.read_text(encoding="utf-8"), encoding="utf-8")
            print("Installed", target)

    try:
        subprocess.run([sys.executable, "-m", "pip", "install", "-U", "yt-dlp"], check=False)
    except Exception:
        pass
    print("Done. Reload TubeReady on chrome://extensions")


if __name__ == "__main__":
    main()

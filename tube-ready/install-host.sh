#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
EXT_ID="moocdlcjbkenfjjhahfecfahlhcggbfo"
HOST_NAME="com.tubeready.yt_dlp"
LAUNCHER="$ROOT/native/run_host.sh"
MANIFEST="$ROOT/native/$HOST_NAME.json"

chmod +x "$LAUNCHER" "$ROOT/native/host.py"
python3 -m pip install -U yt-dlp

python3 - <<PY
import json
from pathlib import Path
manifest = {
    "name": "$HOST_NAME",
    "description": "TubeReady yt-dlp helper",
    "path": "$LAUNCHER",
    "type": "stdio",
    "allowed_origins": ["chrome-extension://$EXT_ID/"]
}
Path("$MANIFEST").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
print("wrote", "$MANIFEST")
PY

TARGET_DIR="${HOME}/.config/google-chrome/NativeMessagingHosts"
mkdir -p "$TARGET_DIR"
cp "$MANIFEST" "$TARGET_DIR/$HOST_NAME.json"
mkdir -p "${HOME}/.config/chromium/NativeMessagingHosts"
cp "$MANIFEST" "${HOME}/.config/chromium/NativeMessagingHosts/$HOST_NAME.json"
echo "Installed. Reload TubeReady on chrome://extensions"

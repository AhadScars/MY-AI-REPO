#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

PY=python3
if [[ -x .venv/bin/python ]]; then
  PY=.venv/bin/python
elif python3 -m venv .venv >/dev/null 2>&1; then
  .venv/bin/pip install -q -r requirements.txt
  PY=.venv/bin/python
fi

"$PY" -c "import flask, openpyxl" 2>/dev/null || {
  echo "Installing flask and openpyxl..."
  "$PY" -m pip install --user -q -r requirements.txt || "$PY" -m pip install --break-system-packages -q -r requirements.txt
}

echo "Starting Lead Generator..."
exec "$PY" app.py ui --no-browser

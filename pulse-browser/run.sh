#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ ! -d node_modules/electron ]]; then
  echo "Installing dependencies..."
  npm install
fi
# Ensure electron binary path is clean if install was partial
if [[ ! -x node_modules/electron/dist/electron ]]; then
  echo "Electron binary missing — reinstalling..."
  rm -rf node_modules/electron
  npm install electron --save-dev
fi
echo "Starting Pulse Browser..."
exec npm start

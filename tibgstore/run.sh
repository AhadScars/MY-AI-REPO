#!/usr/bin/env bash
cd "$(dirname "$0")"
if [ ! -d node_modules ]; then
  npm install
fi
echo "TIBGSTORE → http://localhost:5174"
node server.js

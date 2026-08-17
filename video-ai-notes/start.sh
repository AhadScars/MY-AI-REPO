#!/usr/bin/env bash
cd "$(dirname "$0")"
if [ ! -f .env ]; then
  echo ""
  echo "  [!] No .env file. Copying .env.example → .env"
  echo "  Add your GEMINI_API_KEY from https://aistudio.google.com/apikey"
  echo ""
  cp .env.example .env
fi
if [ ! -d node_modules ]; then
  npm install
fi
echo ""
echo "  Starting Video AI Notes at http://localhost:3847"
echo ""
node server/index.js

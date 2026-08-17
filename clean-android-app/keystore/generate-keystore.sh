#!/usr/bin/env bash
# Generate a release keystore for signing (run once, keep the file private forever).
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="keystore/release.jks"
PROPS="keystore/keystore.properties"

if [[ -f "$OUT" ]]; then
  echo "Already exists: $OUT"
  exit 0
fi

if ! command -v keytool >/dev/null 2>&1; then
  echo "keytool not found. Install a JDK (17+) and retry."
  exit 1
fi

STORE_PASS="${STORE_PASS:-CleanAppStore1!}"
KEY_PASS="${KEY_PASS:-CleanAppKey1!}"
ALIAS="${ALIAS:-cleanapp}"

keytool -genkeypair \
  -v \
  -keystore "$OUT" \
  -alias "$ALIAS" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass "$STORE_PASS" \
  -keypass "$KEY_PASS" \
  -dname "CN=Clean App, OU=Mobile, O=DigiHub, L=City, ST=State, C=US"

cat > "$PROPS" <<PROPS
storeFile=keystore/release.jks
storePassword=$STORE_PASS
keyAlias=$ALIAS
keyPassword=$KEY_PASS
PROPS

echo ""
echo "Created $OUT and $PROPS"
echo "Back up release.jks + passwords somewhere safe. Never commit them."
echo "Passwords used (change for production): store=$STORE_PASS key=$KEY_PASS"

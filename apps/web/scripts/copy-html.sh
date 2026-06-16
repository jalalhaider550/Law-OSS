#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/../../.."

mkdir -p "$SCRIPT_DIR/../public/app"
cp "$ROOT/law-oss-us.html" "$SCRIPT_DIR/../public/app/law-oss-us.html" 2>/dev/null || true
cp "$ROOT/law-oss-uk.html" "$SCRIPT_DIR/../public/app/law-oss-uk.html" 2>/dev/null || true
echo "✅ HTML app files copied to public/app/"

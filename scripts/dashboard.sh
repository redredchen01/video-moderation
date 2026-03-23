#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

if [ ! -f output/violations.json ]; then
  echo "[ERROR] No scan data found. Run a scan first: bash scripts/scan.sh"
  exit 1
fi

node src/dashboard.js

echo ""
echo "Open in browser: output/dashboard.html"

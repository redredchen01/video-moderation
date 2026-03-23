#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# Check setup
if [ ! -d node_modules ]; then
  echo "[ERROR] Dependencies not installed. Run: bash scripts/setup.sh"
  exit 1
fi

if [ ! -f .env ]; then
  echo "[ERROR] .env not found. Copy .env.example to .env and fill in credentials."
  exit 1
fi

echo "=== Starting Video Moderation Scan ==="
node src/main.js "$@"

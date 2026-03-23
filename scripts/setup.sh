#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo "=== Video Moderation Tool — Setup ==="

# Check Node.js
if ! command -v node &>/dev/null; then
  echo "[ERROR] Node.js is required but not installed."
  echo "  Install: https://nodejs.org/ (v18+)"
  exit 1
fi

NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt 18 ]; then
  echo "[ERROR] Node.js v18+ required, found v$(node -v)"
  exit 1
fi
echo "[OK] Node.js $(node -v)"

# Install npm dependencies
echo "[*] Installing dependencies..."
npm install --no-audit --no-fund

# Install Playwright Chromium
echo "[*] Installing Playwright Chromium..."
npx playwright install chromium

# Create .env if not exists
if [ ! -f .env ]; then
  cp .env.example .env
  echo "[*] Created .env from .env.example — please edit with your credentials."
else
  echo "[OK] .env already exists"
fi

# Create output directories
mkdir -p output/covers

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Edit .env with your admin credentials"
echo "  2. Run: bash scripts/scan.sh"
echo "  3. View: open output/dashboard.html"

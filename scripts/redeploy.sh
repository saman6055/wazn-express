#!/usr/bin/env bash
# =============================================================================
# Wazn Express - Redeploy script (run on the server after SSH)
# Usage: ./scripts/redeploy.sh   OR   bash scripts/redeploy.sh
# =============================================================================
set -e

# App directory: same directory as this script's parent (repo root)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$APP_DIR"

echo "=============================================="
echo "Wazn Express - Redeploy"
echo "=============================================="
echo "App dir: $APP_DIR"
echo ""

# 1) Git pull
echo "[1/5] Git pull..."
git fetch origin
git pull origin main
echo ""

# 2) Install dependencies
echo "[2/5] pnpm install..."
export NODE_ENV=production
pnpm install --frozen-lockfile
echo ""

# 3) Build
echo "[3/5] Build (client + server)..."
pnpm run build
echo ""

# 4) Optional: run DB migrations (uncomment if you use db:push on server)
# echo "[4/5] Database migration..."
# pnpm run db:push
# echo ""

# 4) Skip db:push by default (use API migration or run manually)
echo "[4/5] Database migration: skipped (run manually if needed: pnpm run db:push)"
echo ""

# 5) Restart PM2
echo "[5/5] PM2 restart..."
if command -v pm2 &> /dev/null; then
  pm2 restart wazn-express --update-env || pm2 start dist/index.js --name wazn-express
  pm2 save
  echo "PM2 restarted and saved."
else
  echo "PM2 not found. Start manually: NODE_ENV=production node dist/index.js"
fi

echo ""
echo "=============================================="
echo "Redeploy finished."
echo "=============================================="

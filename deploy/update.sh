#!/usr/bin/env bash
# Pull the latest main, rebuild, restart. Live games end on restart.
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
npm ci --include=dev
npm run build
sudo systemctl restart buzzline
sleep 2
curl -fsS http://127.0.0.1:4000/api/health && echo " buzzline is up"

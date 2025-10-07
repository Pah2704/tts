#!/usr/bin/env bash
set -Eeuo pipefail

# Reload worker with default QC profile
echo "=== Restart worker with normal QC profile (.env) ==="
docker compose up -d --force-recreate --no-deps worker

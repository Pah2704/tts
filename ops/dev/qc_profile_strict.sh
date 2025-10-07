#!/usr/bin/env bash
set -Eeuo pipefail

STRICT_ENV=.env.qc-strict
[[ -f "$STRICT_ENV" ]] || { echo "Strict env file $STRICT_ENV not found" >&2; exit 1; }

echo "=== Restart worker with strict QC profile ($STRICT_ENV) ==="
ENV_VARS=$(cat .env "$STRICT_ENV" | grep -v '^#' | xargs)
env $ENV_VARS docker compose up -d --force-recreate --no-deps worker

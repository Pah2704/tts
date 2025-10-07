#!/usr/bin/env bash
set -euo pipefail
set -x

cleanup() {
  docker compose -f docker-compose.yml -f docker-compose.minio.yml down -v >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "=== Compose up with MinIO override ==="
docker compose -f docker-compose.yml -f docker-compose.minio.yml up -d --build

echo "=== Wait API ready ==="
for i in {1..60}; do
  if curl -fsS -o /dev/null http://localhost:4000/health || curl -fsS -o /dev/null http://localhost:4000/; then
    break
  fi
  sleep 1
  if [[ "$i" -eq 60 ]]; then
    echo "API not ready after 60s"
    docker compose logs api
    exit 1
  fi
done

export CURL_FLAGS="--retry-all-errors --retry 10 --max-time 20 --connect-timeout 5"

echo "=== Run Day-5 smoke (now backed by S3) ==="
bash ops/dev/smoke_day5.sh

echo "=== Verify key scheme & downloads via /files ==="
SSE_LOG=$(ls -t sse_*.ndjson 2>/dev/null | head -n1 || true)

if [[ -n "$SSE_LOG" ]]; then
  jq -sc '.[-1]' "$SSE_LOG" > sse_last.json
  MANIFEST_KEY=$(jq -r 'select(.type=="final" and .state=="done") | .manifestKey' "$SSE_LOG" | tail -n1)
  MERGED_KEY=$(jq -r 'select(.type=="final" and .state=="done") | .mergedKey // empty' "$SSE_LOG" | tail -n1)
else
  MANIFEST_KEY=""
  MERGED_KEY=""
fi

if [[ -z "$MANIFEST_KEY" && -f sse_last.json ]]; then
  MANIFEST_KEY=$(jq -r '.manifestKey // empty' sse_last.json)
  MERGED_KEY=$(jq -r '.mergedKey // empty' sse_last.json)
fi

if [[ -n "$MANIFEST_KEY" ]]; then
  case "$MANIFEST_KEY" in
    blocks/*/manifest.json) echo "Manifest key OK: $MANIFEST_KEY" ;;
    *)
      echo "❌ Unexpected manifest key: $MANIFEST_KEY" >&2
      exit 1
      ;;
  esac
fi

if [[ -n "$MERGED_KEY" ]]; then
  case "$MERGED_KEY" in
    blocks/*/merged.wav) echo "Merged key OK: $MERGED_KEY" ;;
    *)
      echo "❌ Unexpected merged key: $MERGED_KEY" >&2
      exit 1
      ;;
  esac
fi

test -f merged.wav && echo "Merged OK"
test -f row0.wav && echo "Row0 OK"
echo "✅ MinIO smoke completed"

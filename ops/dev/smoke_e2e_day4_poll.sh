#!/usr/bin/env bash
set -Eeuo pipefail

API=${API:-http://localhost:4000}
TEXT=${TEXT:-"Hello there. This is an English TTS smoke test. Piper should generate per row."}

echo "=== Create EN block ==="
BLOCK_ID=$(
  curl -sS -f -X POST "$API/blocks" -H "Content-Type: application/json" \
    -d '{"projectId":"demo","kind":"mono","text":"'"$TEXT"'"}' \
  | jq -re '.id'
)
echo "BLOCK_ID=$BLOCK_ID"

echo "=== Enqueue TTS job ==="
JOB_ID=$(
  curl -sS -f -X POST "$API/jobs/tts" -H "Content-Type: application/json" \
    -d '{"blockId":"'"$BLOCK_ID"'"}' \
  | jq -re '.jobId'
)
echo "JOB_ID=$JOB_ID"

echo "=== Poll /status until final (120s timeout) ==="
DEADLINE=$((SECONDS+120))
LAST=""
while (( SECONDS < DEADLINE )); do
  S=$(curl -sS -f "$API/jobs/$JOB_ID/status" || true)
  [[ -n "$S" ]] || { sleep 1; continue; }
  # print only on change
  if [[ "$S" != "$LAST" ]]; then echo "$S" | jq .; LAST="$S"; fi
  [[ "$(jq -r '.type' <<<"$S")" == "final" ]] && break
  sleep 1
done

# Ensure success
jq -re 'select(.type=="final" and .state=="done")' <<<"$LAST" >/dev/null || { echo "❌ Job failed or timed out"; exit 1; }

echo "=== Manifest & sample ==="
MANIFEST=$(curl -sS -f "$API/blocks/$BLOCK_ID/manifest")
echo "$MANIFEST" | jq . | sed -n '1,12p'
FIRST=$(jq -r '.rows[0].fileKey' <<<"$MANIFEST")
curl -sS -f -o sample.wav "$API/files/$FIRST"
echo "Saved sample.wav ($(stat -c%s sample.wav) bytes)"

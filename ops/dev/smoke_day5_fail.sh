#!/usr/bin/env bash
set -Eeuo pipefail
API=${API:-http://localhost:4000}
TEXT=${TEXT:-"HELLO. SHOUT. THIS SHOULD PUSH PEAKS IF THRESHOLDS ARE STRICT."}

BLOCK_ID=$(curl -sS -f -X POST "$API/blocks" -H "Content-Type: application/json" \
  -d '{"projectId":"demo","kind":"mono","text":"'"$TEXT"'"}' | jq -re '.id')
JOB_ID=$(curl -sS -f -X POST "$API/jobs/tts" -H "Content-Type: application/json" \
  -d '{"blockId":"'"$BLOCK_ID"'"}' | jq -re '.jobId')

DEADLINE=$((SECONDS + 120))
LAST=""
while (( SECONDS < DEADLINE )); do
  SNAP=$(curl -sS "$API/jobs/$JOB_ID/status" 2>/dev/null || true)
  [[ -n "$SNAP" ]] || { sleep 1; continue; }
  TYPE=$(jq -r '.type // empty' <<<"$SNAP")
  STATE=$(jq -r '.state // empty' <<<"$SNAP")
  if [[ "$SNAP" != "$LAST" ]]; then echo "$SNAP" | jq .; LAST="$SNAP"; fi
  [[ "$TYPE" == "final" ]] && break
  sleep 0.5
done

[[ "$(jq -r '.state' <<<"$LAST")" == "error" ]] || { echo "❌ Expected final.error"; exit 1; }
jq -e '.atRow|numbers' <<<"$LAST" >/dev/null || { echo "❌ Missing atRow in final.error"; exit 1; }
echo "✅ QC fail path verified"

#!/usr/bin/env bash
set -Eeuo pipefail

API=${API:-http://localhost:4000}
TEXT=${TEXT:-"Hello there. This is an English TTS smoke test. Piper should generate per row."}
EXPECT_MERGE=${EXPECT_MERGE:-1}    # 1 nếu TTS_TAIL_MERGE=1

echo "=== Create block (EN) ==="
BLOCK_ID=$(curl -sS -f -X POST "$API/blocks" -H "Content-Type: application/json" \
  -d '{"projectId":"demo","kind":"mono","text":"'"$TEXT"'"}' | jq -re '.id')
echo "BLOCK_ID=$BLOCK_ID"

echo "=== Enqueue TTS job ==="
JOB_ID=$(curl -sS -f -X POST "$API/jobs/tts" -H "Content-Type: application/json" \
  -d '{"blockId":"'"$BLOCK_ID"'"}' | jq -re '.jobId')
echo "JOB_ID=$JOB_ID"

SSE_LOG="sse_${JOB_ID}.ndjson"
: > "$SSE_LOG"
echo "=== Start SSE capture in background ==="
(
  curl -sN "$API/jobs/$JOB_ID/stream" \
  | awk '/^data: /{sub(/^data: /,"", $0); print $0}' \
  | jq -rc 'select(.type=="row" or .type=="final")' \
  >>"$SSE_LOG"
) &
SSE_PID=$!
trap 'kill $SSE_PID 2>/dev/null || true' EXIT

echo "=== Poll /status until final (tolerate initial 404) ==="
DEADLINE=$((SECONDS + 180))
LAST=""
while (( SECONDS < DEADLINE )); do
  SNAP=$(curl -sS "$API/jobs/$JOB_ID/status" 2>/dev/null || true)
  [[ -n "$SNAP" ]] || { sleep 0.5; continue; }
  TYPE=$(jq -r '.type // empty' <<<"$SNAP")
  STATE=$(jq -r '.state // empty' <<<"$SNAP")
  if [[ "$SNAP" != "$LAST" ]]; then echo "$SNAP" | jq .; LAST="$SNAP"; fi
  [[ "$TYPE" == "final" ]] && break
  sleep 0.3
done

[[ "$(jq -r '.state' <<<"$LAST")" == "done" ]] || { echo "❌ Job did not succeed"; exit 1; }

echo "=== Validate final snapshot QC summary (+ merged if enabled) ==="
jq -e '.qcSummary and (.qcSummary|has("rowsPass") and has("rowsFail") and has("blockLufs") and has("blockTruePeakDb") and has("blockClippingPct"))' <<<"$LAST" >/dev/null
ROWS_FAIL=$(jq -re '.qcSummary.rowsFail' <<<"$LAST")
(( ROWS_FAIL == 0 )) || { echo "❌ qcSummary.rowsFail > 0"; exit 1; }
MERGED_KEY=$(jq -r '.mergedKey // empty' <<<"$LAST")
if (( EXPECT_MERGE == 1 )); then
  [[ -n "$MERGED_KEY" ]] || { echo "❌ mergedKey missing while EXPECT_MERGE=1"; exit 1; }
fi

echo "=== Inspect manifest v1.1 ==="
MANIFEST=$(curl -sS -f "$API/blocks/$BLOCK_ID/manifest")
jq -e 'select(.version == "1.1")' <<<"$MANIFEST" >/dev/null || { echo "❌ manifest.version != 1.1"; exit 1; }
jq -e 'all(.rows[]; .metrics and (.metrics|has("lufsIntegrated") and has("truePeakDb") and has("clippingPct") and has("score")))' <<<"$MANIFEST" >/dev/null || { echo "❌ Some rows missing metrics"; exit 1; }

ROWS_IN_MANIFEST=$(jq -r '.rows|length' <<<"$MANIFEST")
ROW_DONE_SEEN=$(jq -r 'select(.type=="row" and .state=="done") | .rowIndex' "$SSE_LOG" | sort -u | wc -l | awk '{print $1}')
if (( ROW_DONE_SEEN < ROWS_IN_MANIFEST )); then
  echo "❌ row.done via SSE seen ($ROW_DONE_SEEN) < rows in manifest ($ROWS_IN_MANIFEST)"
  echo "Dump last 20 SSE lines for debug:"
  tail -n 20 "$SSE_LOG" || true
  exit 1
fi

echo "=== Download sample row & merged ==="
FIRST_ROW_KEY=$(jq -r '.rows[0].fileKey' <<<"$MANIFEST")
curl -sS -f -o row0.wav "$API/files/$FIRST_ROW_KEY"
echo "Saved row0.wav ($(stat -c%s row0.wav) bytes)"
if (( EXPECT_MERGE == 1 )) && [[ -n "$MERGED_KEY" ]]; then
  curl -sS -f -o merged.wav "$API/files/$MERGED_KEY"
  echo "Saved merged.wav ($(stat -c%s merged.wav) bytes)"
fi

kill $SSE_PID 2>/dev/null || true
trap - EXIT

echo "✅ Day 5 smoke completed"

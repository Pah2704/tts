#!/usr/bin/env bash
set -Eeuo pipefail
API=${API:-http://localhost:4000}
JOB_ID="${1:-}"
if [[ -z "$JOB_ID" ]]; then echo "Usage: $0 <JOB_ID>"; exit 1; fi

curl --http1.1 -sN "$API/jobs/$JOB_ID/stream" | \
awk '
  /^data: / {
    sub(/^data: /,"", $0); print $0; fflush();
    if ($0 ~ /"type":"final"/) exit
  }
'

# CONFIG — TTS-VTN

## Environment (.env)
### API / Queue / Storage
- `API_PORT` — API port (default `4000`)
- `REDIS_URL` — e.g., `redis://redis:6379` (BullMQ queue)  ← aligns ADR-0008
- `STORAGE_KIND` — `fs` | `s3` (abstraction layer)         ← ADR-0010
- `STORAGE_ROOT` — local path when `fs` (e.g., `/data/storage`)
- `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_FORCE_PATH_STYLE=1`, `S3_SECURE=0`

### Worker / Engine
- `ENGINE_DEFAULT=piper` (HQ toggle → XTTS)                 ← ADR-0011
- `HQ_TOGGLE=true` (enable High-Quality mode switch)
- `CUDA=auto` (use GPU if present, CPU fallback)            ← ADR-0014

### Frontend
- `VITE_API_BASE` — e.g., `http://localhost:4000`

## Storage key scheme (fixed)
Use:
projects/{projectId}/blocks/{blockId}/rows/{rowId}.wav
mix/block-{blockId}.wav
qc/block-{blockId}.json
(Do **not** change; required by tooling & smoke.)  ← ADR-0017

## Realtime (SSE) via API
- Default realtime channel: **SSE** for row progress/events; WS optional later.  ← ADR-0005/0009/0016
- Contract: per-row `state ∈ {queued, running, done, error}`, `metrics` include `lufsIntegrated`, `truePeakDb`, `clippingPct`, `score`.  
- **Close stream when `final` received.**

## Nginx reverse proxy (SSE safe config)
```nginx
location /api/ {
  proxy_pass         http://api:4000/;
  proxy_http_version 1.1;
  proxy_set_header   Host $host;
  proxy_set_header   Connection '';
  proxy_buffering    off;
  gzip               off;
  chunked_transfer_encoding off;
  add_header         X-Accel-Buffering no;
  # Long-poll/SSE timeouts
  proxy_read_timeout 3600;
  proxy_send_timeout 3600;
}

QC policy (export guard)
Target: −16 ±1 LUFS, True Peak ≤ −1.0 dBTP, clipping ≤ 0.1%.
Export is blocked on fail; FE shows warnings with details. ← ADR-0013
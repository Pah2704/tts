CONTEXT_SNAPSHOT_2025-10-06-day4.md
Handoff Recap — from TTS-VTN Day 4 (paste this on top of new threads)

Status: Piper per-row → .wav, manifest per-block, SSE v2 with fileKey/bytes/durationMs, /jobs/:id/status reads Redis snapshot.

Infra: Docker Compose up (api/worker/redis), BullMQ + Redis, FS storage with a thin pluggable layer.

API: POST /jobs/tts, GET /jobs/:id/stream (SSE), GET /jobs/:id/status, GET /blocks/:id/manifest, GET /files/*.

Worker: Node (BullMQ) → Python runner; row-by-row synthesis; snapshot replay via progress:<jobId>:last.

Voices & tests: English-only (from now on).

Output verified: per-row WAVs under blocks/<blockId>/rows/…, valid manifest.json, SSE shows row events and final.

Carryover to Day 5: QC mandatory + tail-merge (optional) + minimal FE wiring for QC/merged.

Env: WSL2 Ubuntu, TZ Asia/Ho_Chi_Minh.

What changed on Day 4

Implemented Piper integration in worker; synthesized per row with ordered processing.

Introduced pluggable storage (FS default) and stable key scheme:

blocks/{blockId}/rows/{index:03d}_{rowId}.wav

blocks/{blockId}/manifest.json

SSE v2 payload enriched:

row.running | row.done include rowIndex, total, and (on done) fileKey, bytes, durationMs.

final.done carries manifestKey; final.error includes error and optional atRow.

Redis snapshot replay: worker sets progress:<jobId>:last (TTL) on every publish; API SSE replays last snapshot on connect; /status returns it instantly.

Disabled inline mock worker by default (API_INLINE_WORKER=0).

Interfaces (Day-4 stable)
API endpoints

POST /jobs/tts → { jobId: string }

Input: { blockId } or { blockId, rows[], engine? } (rows get expanded server-side if absent).

GET /jobs/:id/stream → SSE (text/event-stream) with :hb heartbeat.

GET /jobs/:id/status → last snapshot JSON (from Redis).

GET /blocks/:id/manifest → returns per-block manifest JSON.

GET /files/* → dev static bridge to storage (WAV/JSON).

SSE event schema (v2)
// row running:
{ "type":"row","state":"running","rowIndex":0,"total":3 }
// row done:
{ "type":"row","state":"done","rowIndex":0,"total":3,"fileKey":"...","bytes":46124,"durationMs":1044 }
// final done:
{ "type":"final","state":"done","manifestKey":"blocks/<id>/manifest.json" }
// final error:
{ "type":"final","state":"error","error":"<message>","atRow":0 }

Storage key scheme (FS default; S3-compatible later)
blocks/{blockId}/rows/{index:03d}_{rowId}.wav
blocks/{blockId}/manifest.json

Environment (dev defaults)
ENGINE_DEFAULT=piper
PIPER_MODEL=/models/piper/en/en_US-amy-medium.onnx
PIPER_VOICE_ID=en_US-amy-medium
STORAGE_KIND=fs
STORAGE_ROOT=/data/storage
REDIS_URL=redis://redis:6379/0
SNAPSHOT_TTL_SEC=900
QUEUE_TTS_BLOCK=tts:block
QUEUE_CONCURRENCY=1
API_INLINE_WORKER=0
TZ=Asia/Ho_Chi_Minh

Smoke evidence (passed)

Inline rows: POST /jobs/tts returned {"jobId":"…"}

SSE stream showed:

row.running → row.done × N

final.done with manifestKey

Manifest example (trimmed):

{
  "blockId": "<uuid>",
  "engine": "piper",
  "voiceId": "en_US-amy-medium",
  "rows": [
    { "index":0, "rowId":"r1", "fileKey":"blocks/<id>/rows/000_r1.wav", "bytes":43052, "durationMs":975 },
    { "index":1, "rowId":"r2", "fileKey":"blocks/<id>/rows/001_r2.wav", "bytes":138284, "durationMs":3134 }
  ]
}


Sample WAV saved via /files/<fileKey> and playable.

Known gaps / carryover → Day 5

QC mandatory (row + merged): compute metrics, attach to events/manifest, gate export on thresholds.

Tail-merge (env toggle): optional merge to merged.wav with configurable gapMs + small fadeMs.

FE tweaks: show per-row QC badges and “Download merged” when available.

Optional: make /jobs/:id/status return {type:"job",state:"queued"} instead of 404 before first snapshot; or emit early {type:"job",state:"accepted"} from worker.

Next (Day-5) — action checklist

Add QC_ENABLE=1, thresholds (QC_LUFS_TARGET, QC_TRUEPEAK_DB_MAX, etc.), and merge toggles (TTS_TAIL_MERGE, TTS_GAP_MS, TTS_FADE_MS) to .env.

Implement qc/quality_control.py and mix/merge.py (simple dependency-light first; can upgrade to pyloudnorm later).

Wire QC into row.done and manifest; short-circuit to final.error if thresholds fail.

If merge enabled & QC passed: create merged.wav, run QC on it, add mergedKey to final.done.

Update FE minimal UI for QC/merged; extend smoke script to assert mergedKey when enabled.

Notes

Voices/tests remain English-only across examples and fixtures.

Storage abstraction kept thin; S3/MinIO can be plugged later without changing keys or routes.
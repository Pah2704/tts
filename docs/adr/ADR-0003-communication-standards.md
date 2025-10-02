1) Frontend (React SPA)
REST (command/query):
POST /blocks (khởi tạo từ văn bản); PATCH /blocks/:id (sửa);
POST /blocks/:id/job (tạo job TTS cho Block);
GET /jobs/:id (trạng thái tổng quan); GET /blocks/:id/audio (file hợp khối).
Realtime: SSE GET /jobs/:id/stream (mặc định) hoặc WebSocket /ws (tuỳ triển khai); event: {rowIndex, state, progress, metrics}.
Format Row progress: state ∈ {queued, running, done, error}, metrics có lufsIntegrated, truePeakDb, clippingPct, score. (QC theo BRIEF/Spec)
Asset fetch: GET /files/:key (signed/công khai nội bộ).

2) Backend API (Node/Nest)
Queue payload (block_job):
{ "jobId":"...", "blockId":"...", "engine":"piper|xtts",
  "rows":[{"rowId":"...","text":"...","params":{...}}],
  "fx":{"bg":"...", "ducking":true}, "targets":["wav","mp3"] }
Progress channel: progress:jobId (PubSub/Stream) → {rowId, state, tElapsedMs, metrics?}.
Storage key scheme: projects/{projectId}/blocks/{blockId}/{rowId}.{wav|mp3} + mix/block-{blockId}.wav.
QC metrics contract: lufsIntegrated(-16±1 LUFS target), truePeakDb(≤-1.0 dBTP), clippingPct(≤0.1%).

3) Python Worker Pool (Piper/XTTS + Post-FX + QC)
Input: payload từ Redis (như trên).
Progress Out: PubSub progress:jobId → {rowId, state, tElapsedMs, metrics?} mỗi 200–500ms/lần hoặc theo bước (fetch→synth→post→qc→done).
Artifacts: ghi ra Storage theo key scheme; trả về manifest JSON (đường dẫn + QC summary).
Error Model: {rowId?, code, message, recoverable:bool}; cho phép retry ≤1 lần/job (BRIEF).

4) Redis (Queue & Progress Channel)
Job options: attempts: 2, backoff: fixed 2000ms, removeOnComplete: true.
Progress granularity: cập nhật theo bước và khi hoàn tất mỗi Row.

5) Storage (Local FS / S3-compatible)
Upload: workers ghi trực tiếp (SDK/FS).
Download: API phát link an toàn; chuẩn hoá Content-Type, Cache-Control.

6) Orchestration (Docker Compose – Phase 1)
ENV hợp nhất: ENGINE_DEFAULT=piper, HQ_TOGGLE=true|false, REDIS_URL=…, STORAGE_KIND=fs|s3, CUDA=auto.
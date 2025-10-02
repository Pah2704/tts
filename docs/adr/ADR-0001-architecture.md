
Sơ đồ (mô tả text)
1) Frontend (React SPA)
Browser(React SPA)
→ REST gọi API tạo/sửa Block, tạo Job (per-Block)
→ SSE/WebSocket nhận progress per-Row theo thời gian thực
→ HTTP GET tải audio preview/output từ Storage proxy của API
→ Local state quản lý Workspace một cửa (đơn thoại/hội thoại hợp nhất)

2) Backend API (Node/Nest)
React SPA ↔ Nest API
Nest API → Redis (BullMQ) để enqueue block_job
Nest API → Storage (FS/S3) lưu input/output
Nest API → SSE/WS đẩy progress per-Row
Python Worker kéo job từ Redis và callback API/Redis với progress/metrics

3) Python Worker Pool (Piper/XTTS + Post-FX + QC)
Worker-Manager (Python)
→ Job Fetcher (Redis) nhận block_job
→ Row Scheduler (vi đồng thời theo tài nguyên), Synth Engine: PiperAdapter (mặc định) hoặc XTTSAdapter (khi HQ)
→ Post Processing: Normalize/Limit per-Row → ghép Block → Normalize tổng thể
→ QC: đo LUFS/TruePeak/Clipping/Score; Level-matching hội thoại
→ Export: WAV/MP3, A/B stems; Report progress/metrics
→ CUDA auto-use khi có; nếu không có vẫn chạy XTTS (cảnh báo nhẹ—do FE hiển thị).

4) Redis (Queue & Progress Channel)
Nest Queue Orchestrator → BullMQ queue: block_jobs
Python Workers ← consume block_jobs
Python Workers → PubSub/Stream progress:jobId → Nest Progress Gateway → SSE/WS đến FE.

5) Storage (Local FS / S3-compatible)
Python Workers ↔ Object Storage (Local FS cho dev; MinIO/S3 cho prod)
Nest API phát link (signed hoặc nội bộ) → FE tải preview/output.

6) Orchestration (Docker Compose – Phase 1)
docker-compose chạy các services:
frontend (React) · api (Nest) · worker (Python) · redis · minio (tuỳ chọn) · nginx (reverse proxy).
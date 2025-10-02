1) Frontend (React SPA)
Workspace Shell: khung Block-first, tạo Block theo đoạn/turn; quản lý selection.
Block Panel: Voice/Style/Emotion, Pitch/Speed, Pause, Variability; nghe thử/A-B.
Row Editor: hiển thị câu (Row), gộp/chia câu, SSML Editor (chỉ mở khi HQ/XTTS).
Job Orchestrator (FE): bấm “Tạo âm thanh (Async)”, subscribe progress, hiển thị trạng thái Queued/Processing/Done/Error.
Audio Player: preview per-Row/Block, A/B.
Assets Manager: lấy link audio/FX.

2) Backend API (Node/Nest)
Command API: tạo/sửa Block; tạo Job; xuất file.
Read API: lấy trạng thái job, danh sách block, link asset.
Queue Orchestrator: chuẩn hoá payload job cấp Block, fan-out Row bên Worker.
Progress Gateway: gom progress từ Redis Stream/Channel → SSE/WS cho FE.
Storage Service: abstract FS/S3 (key scheme thống nhất).
Policy/Validation: whitelist SSML khi HQ bật; guard pipeline params.

3) Python Worker Pool (Piper/XTTS + Post-FX + QC)
Adapters: PiperAdapter, XTTSAdapter (map tham số, SSML chỉ ở XTTS).
Segmentation Guard: bảo vệ viết tắt/ký hiệu; chia nhóm thở nếu câu quá dài.
Post-FX: Silence mgmt, EQ/DRC, background FX (auto-ducking/fade).
QC Engine: LUFS/Peak/Clipping/Score; ngưỡng KPI.
Mixer: ghép per-Row → per-Block (giữ đúng thứ tự); xuất file.
Reporter: push progress per-Row; send final artifact paths.

4) Redis (Queue & Progress Channel)
Queues: block_jobs (durable, retry ≤1); optional mix_jobs nếu tách ghép.
Channels/Streams: progress:* realtime; optional metrics:* tổng hợp.
DLQ: block_jobs:failed để điều tra.

5) Storage (Local FS / S3-compatible)
Bucket/Root: projects/{projectId}/blocks/{blockId}/rows/…, mix/…, qc/…
Manifest: JSON tóm tắt artifact & QC.

6) Orchestration (Docker Compose – Phase 1)
Network: bridge nội bộ; expose cổng 80/443 (nginx), 3000 (FE dev), 4000 (API), 6379 (Redis internal).
Volumes: storage/ (audio), minio-data/.
Healthchecks: API readiness, Redis ping, Worker liveness.

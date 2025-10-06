# CONTEXT_SNAPSHOT_2025-10-02

> **Handoff Recap – từ TTS‑VTN (ngắn 5–10 dòng, dán ở dòng đầu khi mở thread mới):**
> • Trạng thái dừng: đã chốt **Block‑first UI**, **async‑by‑default**, **Piper mặc định / High‑Quality = XTTS**; hoàn tất Ngày 2 (Workspace, segmenter + test ≥25, SSE mock, router, Tailwind).  
> • Cần chuyển sang context mới: **Ngày 3 — Queue & Progress thật (BullMQ + Redis, SSE từ hàng đợi)**.  
> • Liên kết/điểm tựa: **ADR‑0001..0018**, **BRIEF_PROJECT_TTS_VTN_PHASE1_MVP_20251001**, **PLAN_TTS_VTN_BEGINNER_WSL2_2025‑10‑02**.  
> • Việc còn treo: cấu hình **TTS_TAIL_MERGE** (env) làm sau; chuẩn hoá API `/jobs/tts` thay cho `/jobs/mock`; key lưu trữ audio.  
> • Kỳ vọng output: queue chạy thật, **worker** xử lý **row‑by‑row**, SSE báo tiến độ thực, DoD có test E2E và log quan sát được.  
> • Hạ tầng: **Docker Compose**, **Redis + BullMQ**, storage **FS/S3‑compatible**.  
> • Môi trường: **Ubuntu trên WSL2**, TZ **Asia/Ho_Chi_Minh**.

---

## 1) Context Keys để gọi lại nhanh
- Nguyên tắc: **async‑by‑default**, **Job cấp Block → progress theo Row**, **Block‑first UI, một Workspace**.
- Engine: **Piper** mặc định; bật **High‑Quality → XTTS**; **CUDA opportunistic** khi có.
- Giao tiếp: **REST + SSE** (WebSocket optional).
- Hàng đợi: **Redis + BullMQ**; **một queue cho Block** (ADR‑0015), **giữ thứ tự row** (ADR‑0012), **progress via Redis PubSub/Stream** (ADR‑0016).
- Lưu trữ: **FS/S3‑compatible** (MinIO), **key scheme cố định** (ADR‑0017).

## 2) Trạng thái Ngày 2 (đã xong)
- `POST /blocks`, `PATCH /blocks/:id`, `GET /blocks/:id` (MVP, in‑memory).
- **Segmenter** (ngoại lệ viết tắt, nhóm thở, Unicode), **25 tests** pass (Jest/Vitest).
- **Workspace** (React Vite): dán văn bản → sinh Rows; gộp/chia; lưu cập nhật.
- **SSE mock**: `/jobs/mock` + `/jobs/:id/stream` báo tiến độ row‑by‑row.
- Router chuyển mặc định sang `/workspace`; FE đã có Tailwind.

## 3) TODO Ngày 3 — Queue & Progress (BullMQ + Redis)
### 3.1 Backend API
- [ ] Tạo **Jobs (real)** endpoint: `POST /jobs/tts { blockId } → { jobId }` (đẩy vào BullMQ queue `tts:block`).
- [ ] SSE: giữ `GET /jobs/:id/stream` nhưng **đọc event từ Redis PubSub/Stream** theo **ADR‑0016**.
- [ ] Chuẩn **DTO/Errors**: `JobNotFound`, `BlockNotFound`, `InvalidState`.
- [ ] Env bắt buộc: `REDIS_URL`, `QUEUE_TTS_BLOCK=tts:block`, `QUEUE_CONCURRENCY=1`.

**File/Thư mục đề xuất**
```
apps/api/src/modules/jobs/
  ├─ jobs.controller.ts   # /jobs/tts, /jobs/:id/stream
  ├─ jobs.service.ts      # enqueue, publish progress, lookup job meta
  ├─ jobs.queue.ts        # BullMQ Queue client
  └─ jobs.progress.ts     # adapter PubSub/Stream theo ADR‑0016
```

### 3.2 Worker (dịch vụ riêng)
- [ ] Service **worker** đọc queue `tts:block`, xử lý **row‑by‑row**, **emit progress**: `{type:'row-progress', index, total}` và cuối cùng `{type:'done'}`.
- [ ] Giữ **preserve order** theo ADR‑0012; concurrency = 1 ở cấp block, có thể prefetch nhỏ.
- [ ] Stub xử lý audio: chưa synth thật; chỉ `setTimeout`/fake compute + publish sự kiện.

**File/Thư mục đề xuất**
```
apps/worker/src/
  ├─ main.ts              # boot worker
  ├─ queues/tts.worker.ts # BullMQ Worker handler
  └─ progress/publisher.ts# publish progress (Redis channel/stream)
```

### 3.3 Frontend
- [ ] Đổi **API tạo job** sang `POST /jobs/tts` (thay cho `/jobs/mock`).
- [ ] Giữ nguyên **EventSource** `/jobs/:id/stream`; hiển thị progress (✓ theo row, % bar).
- [ ] Nếu `rows` thay đổi sau khi “Lưu cập nhật”, vô hiệu job cũ; nhắc tạo job mới.

### 3.4 Storage Keys (đặt nền, chưa synth)
- [ ] Chuẩn key (ADR‑0017), ví dụ: `project/{projectId}/block/{blockId}/row/{n}/tts/{engine}/v1/`.
- [ ] Sau này file: `audio.wav`, `metrics.json`, `ssml.xml` (khi bật HQ/XTTS), `log.txt`.

### 3.5 Observability & DoD
- [ ] Log enqueue/dequeue và progress (index/total, ms per row).
- [ ] **E2E test**: enqueue → stream SSE đến `done` trong ≤N giây.
- [ ] Compose: đảm bảo **Redis** healthcheck OK; Worker log thấy **processing row i/n**.
- [ ] DoD: UI progress chạy với 3 mẫu (đơn thoại/hội thoại/dài); retry reconnect SSE khi rớt.

## 4) Env & Compose (gợi ý thêm)
```
# apps/api/.env
REDIS_URL=redis://redis:6379
QUEUE_TTS_BLOCK=tts:block
QUEUE_CONCURRENCY=1

# apps/worker/.env
REDIS_URL=redis://redis:6379
QUEUE_TTS_BLOCK=tts:block
```
`docker-compose.yml` thêm service `worker`, mount code, depends_on `redis`.

## 5) Lệnh chạy nhanh
```bash
# Lên toàn bộ stack
docker compose up --build
# Chạy test API
pnpm -C apps/api exec jest --runInBand
```

## 6) Mẫu Handoff Recap (copy‑paste khi “qua context mới”)
```
[Handoff Recap – từ TTS‑VTN]
• Trạng thái dừng: Done Ngày 2 (Workspace + segmenter + SSE mock), giữ Block‑first UI.
• Context mới: Ngày 3 — Queue & Progress thật (BullMQ + Redis, SSE từ queue).
• Điểm tựa: ADR‑0001..0018, BRIEF_PHASE1_2025‑10‑01, PLAN_TTS_VTN_BEGINNER_WSL2_2025‑10‑02.
• Việc treo: cấu hình TTS_TAIL_MERGE (env) sẽ làm sau; đổi /jobs/mock → /jobs/tts.
• Kỳ vọng: enqueue job, worker xử lý row‑by‑row, SSE báo tiến độ, E2E pass.
```

---

**Ghi chú:** Snapshot này dùng để “neo” lại trạng thái và chỉ thị bước kế. Khi mở thread mới, dán khối *Handoff Recap* phía trên (5–10 dòng) rồi tiếp tục triển khai Ngày 3 theo checklist.


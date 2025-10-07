# CONTEXT SNAPSHOT — 2025‑10‑02 (TTS‑VTN)

> **Lưu file này tại:** `docs/context/CONTEXT_SNAPSHOT_2025-10-02.md`

## 1) Handoff Recap (dán ở dòng đầu của thread mới)

```
[Handoff Recap – từ TTS-VTN]
• Trạng thái dừng: Day 1 đã chạy xong Hello Compose (redis, api, worker, frontend).
• Quyết định chốt: Block-first UI, async-by-default, progress theo Row, Piper default / HQ = XTTS, realtime = SSE.
• Cần chuyển sang context mới: Day 2 — Mock Jobs & SSE Progress (API/Worker/FE).
• Liên kết/điểm tựa: ADR-0001..0018, BRIEF_PHASE1_2025-10-01, ARCH-0001, Functional Spec (async).
• Việc còn treo: API CORS (đã gợi ý), job & stream SSE mock, FE progress view, chuẩn hóa cổng Vite 3000.
• Kỳ vọng output: API `/blocks/:id/job`, `/jobs/:id/stream`; Worker mô phỏng tiến độ; FE hiển thị progress.
```

---

## 2) Mục tiêu snapshot

* Đặt **neo context** để có thể "qua context mới" nhưng vẫn gọi lại được các quyết định & file nền tảng của TTS‑VTN.
* Tóm tắt ngắn: **điểm dừng hiện tại**, **quyết định đã chốt**, **TODO mở**, và **đường dẫn file mỏ neo**.

---

## 3) Quyết định đã chốt (anchors)

* **Kiến trúc & giao tiếp**: `ADR-0001-architecture.md`, `ADR-0003-communication-standards.md`, `ADR-0009-rest-plus-sse-ws-optional.md`, `ADR-0005-realtime-sse-default.md`.
* **Phân ranh & UI**: `ADR-0002-bounded-contexts.md`, `ADR-0004-block-first-ui-workspace.md`.
* **Pipeline TTS**: `ADR-0011-engine-default-piper-hq-xtts.md`, `ADR-0006-ssml-editor-hq-xtts-only.md`.
* **Hàng đợi & tiến độ**: `ADR-0008-queue-bullmq-redis.md`, `ADR-0015-one-queue-block-jobs.md`, `ADR-0007-job-scope-block-progress-per-row.md`, `ADR-0012-row-concurrency-preserve-order.md`, `ADR-0016-progress-via-redis-pubsub-stream.md`.
* **Lưu trữ/triển khai**: `ADR-0010-storage-s3-compatible-abstraction.md`, `ADR-0017-storage-key-scheme-fixed.md`, `ADR-0018-orchestration-docker-compose-phase1.md`.
* **QC & compute**: `ADR-0013-qc-mandatory-before-export.md`, `ADR-0014-cuda-opportunistic.md`.
* **Tài liệu nền**: `docs/plan/BRIEF_PROJECT_TTS_VTN_PHASE1_MVP_2025-10-01.md`, `docs/spec/tts_vtn_functional_spec_async.md`, `docs/arch/ARCH-0001-tts-vtn-phase1.puml.md`.

> Gợi ý link mỏ neo trong repo: `docs/adr/ADR-XXXX-*.md`, `docs/plan/`, `docs/spec/`, `docs/arch/`.

---

## 4) Trạng thái dừng hiện tại (Day 1)

* **Compose** chạy 4 service: `redis:6379`, `api:4000`, `worker:5001`, `frontend:3000`.
* **API**: Nest skeleton (`GET /` và `/hello`), bật CORS (khuyến nghị đã nêu).
* **Worker**: Python skeleton (kết nối Redis, publish thông điệp mẫu, mở HTTP 5001).
* **Frontend**: Vite React skeleton (hiển thị link kiểm tra API/Worker, cổng 3000).
* Cây thư mục chính:

```
apps/
  api/ (Dockerfile, package.json, tsconfig.json, src/main.ts)
  worker/ (Dockerfile, requirements.txt, app.py)
  frontend/ (Dockerfile, package.json, tsconfig.json, index.html, src/main.tsx)
docker-compose.yml
ops/day1_bootstrap.sh
```

---

## 5) TODO mở (ưu tiên cho Day 2 — Mock Jobs & SSE Progress)

* [ ] **API**: `POST /blocks/:id/job` → trả `jobId` (mock) ; `GET /jobs/:id/stream` → SSE phát tiến độ `{rowId, state, tElapsedMs}`.
* [ ] **Worker**: mô phỏng xử lý theo **Block → Row**, publish progress định kỳ qua Redis PubSub (chuẩn bị nền cho BullMQ).
* [ ] **Frontend**: form tạo job (blockId), trang/view nghe SSE và render progress per-row.
* [ ] **CORS** cho API (nếu chưa bật).
* [ ] `.dockerignore` cho `api`/`frontend` để build nhanh & nhẹ.

### Day 2 — Workspace khởi tạo & Parser

* **Mục tiêu**: Dán văn bản → sinh **Blocks** (đoạn/turn) → **tự tách câu**.
* **Frontend**: trang **Workspace (Block‑first)** với: khung xem trước câu; **tool gộp/chia câu**; hiển thị **cảnh báo cú pháp hội thoại**.
* **Backend API**: `POST /blocks` (tạo Block từ văn bản dán), `PATCH /blocks/:id` (sửa Block/metadata).
* **Files cần tạo**:

  * `apps/api/src/modules/blocks/*` (controller/service/DTO)
  * `apps/frontend/src/pages/Workspace.tsx` (UI khung + preview câu)
* **Bộ test tách câu**: ≥ **20** test case; **KPI** tách câu **≥ 98%**.

---

## 6) Đường dẫn & lệnh nhanh

* Chạy stack: `docker compose up --build`
* FE: `http://localhost:3000`  ·  API: `http://localhost:4000/hello`  ·  Worker: `http://localhost:5001`
* Ghim commit: `git commit -m "snapshot: day1 baseline + anchors"`

---

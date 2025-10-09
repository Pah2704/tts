# Handoff Recap — từ TTS‑VTN Day‑5 → Day‑6 (dán dòng này lên đầu thread mới)

• Trạng thái dừng: **QC bắt buộc (row + block)**, **Tail‑merge** (bật qua env), **Manifest v1.1**, **SSE v2.1** (subscribe‑then‑replay, đóng ngay khi `final`). Smoke `ops/dev/smoke_day5.sh` **PASS**.
• Cần chuyển sang context mới: **Day‑6 — Docs & CI nhẹ, FE polish, bật S3/MinIO (tuỳ chọn)**.
• Liên kết/điểm tựa: ADR‑0001..0018, BRIEF_PHASE1_2025‑10‑01, ARCH‑0001, PLAN_TTS_VTN_BEGINNER_WSL2_2025‑10‑02.
• Việc còn treo: tinh gọn tài liệu cấu hình/quickstart, CI chạy smoke tự động, FE hiển thị QC rõ ràng, sample S3/MinIO.
• Kỳ vọng output: README/CONFIG/Quickstart hoàn chỉnh, GH Actions chạy green, FE có badge QC + nút tải merged, smoke MinIO xanh, tag **v0.5.0‑day5**.
• Môi trường: Docker Compose (api/worker/redis), WSL2 Ubuntu, TZ=Asia/Ho_Chi_Minh.

---

## Bản chụp ngữ cảnh — 2025‑10‑07 (Day‑6)

### 1) Mục tiêu Day‑6 (theo PLAN 2025‑10‑02 + tiến độ Day‑5)
- **Docs & DX**: hoàn thiện `docs/CONFIG.md`, `docs/quickstart.md`, cập nhật README, thêm `docs/releases/RELEASE_NOTES_v0.5.0-day5.md` (đã soạn), ghi rõ biến `.env`, cách cấu hình Nginx cho SSE.
- **CI nhẹ**: GitHub Actions workflow chạy Compose → `ops/dev/smoke_day5.sh` → down; cache build để tăng tốc.
- **FE polish**: badge QC theo row (✅/⚠️/⛔), tooltip (LUFS/Peak/Clip/Score/Warnings), nút **Tải merged** khi có `mergedKey`, banner lỗi tự scroll đến `atRow`.
- **Storage S3/MinIO (tuỳ chọn)**: bật `STORAGE_KIND=s3`, cấu hình `S3_*`, smoke đọc/ghi file + tải về qua `/files/*`.
- **(Backlog không chặn)**: LUFS "accurate" (pyloudnorm) + TruePeak oversampling, cải thiện `/status` trước snapshot, qcOverride (DEV only).

### 2) Hạng mục công việc chi tiết

#### A. Tài liệu & phát hành
- [ ] Review nhanh `docs/CONFIG.md`, `docs/quickstart.md` (đã soạn). Link từ README.
- [ ] Cập nhật README (mục **Quickstart ngắn** + link sang docs chi tiết).
- [ ] Đẩy `docs/releases/RELEASE_NOTES_v0.5.0-day5.md` + gắn tag `v0.5.0-day5`.

#### B. CI (GitHub Actions)
- [ ] Tạo `.github/workflows/smoke.yml`:
  - Trigger: push PR vào `main`.
  - Steps: checkout → setup Docker Buildx → `docker compose up -d --build` → `ops/dev/smoke_day5.sh` → `docker compose down -v`.
  - Artifacts: đính kèm `sse_*.ndjson`, `row0.wav`, `merged.wav` nếu cần debug.

#### C. Frontend polish (tối thiểu)
- [ ] Thêm badge QC: map theo `metrics` (pass/warn/fail). Tooltip hiện **LUFS**, **TruePeak**, **Clipping %**, **Score**, **Warnings[]**.
- [ ] Thêm **nút Tải merged** khi `mergedKey` có trong `final.done`.
- [ ] Banner lỗi (`final.error`) + auto‑scroll đến `atRow`.
- [ ] (Tuỳ chọn) Player row để nghe nhanh.

#### D. S3/MinIO (tuỳ chọn nhưng nên có 1 smoke)
- [ ] Bật biến trong `.env`:
  ```env
  STORAGE_KIND=s3
  S3_ENDPOINT=http://minio:9000
  S3_REGION=auto
  S3_BUCKET=tts-vtn
  S3_ACCESS_KEY=minioadmin
  S3_SECRET_KEY=minioadmin
  S3_FORCE_PATH_STYLE=1
  S3_SECURE=0
  ```
- [ ] Chạy `ops/dev/smoke_day5.sh` → kiểm tra tải `row0.wav` và `merged.wav` qua `/files/*` vẫn OK.

### 3) Acceptance Criteria (DoD Day‑6)
- **Docs**: README trỏ tới `docs/CONFIG.md` & `docs/quickstart.md`; các biến `.env` mô tả đủ; hướng dẫn Nginx SSE có ví dụ.
- **CI**: workflow chạy xanh trên PR, log có `final.done` với `qcSummary.rowsFail=0`.
- **FE**: badge QC + tooltip hiển thị từ `metrics`; nút **Tải merged** khi có; banner lỗi hoạt động.
- **S3/MinIO**: smoke pass; key scheme không thay đổi (`blocks/<id>/...`).

### 4) Rủi ro & ứng phó
- **SSE qua proxy**: tắt `proxy_buffering`/`gzip`, ép `--http1.1`; đã có snippet trong `CONFIG.md`.
- **Sai số LUFS nhanh**: giữ normalizer mặc định; nếu cần độ chính xác, đặt backlog `pyloudnorm`.
- **Quyền ghi storage**: mount volume local có quyền ghi; kiểm tra `STORAGE_ROOT`/S3 creds.

### 5) Mốc thời gian (gợi ý trong ngày)
- **Sáng**: Docs/README, CI workflow, chạy thử CI cục bộ (act hoặc run on PR).
- **Chiều**: FE polish nhỏ + smoke lại; nếu kịp, chạy thử MinIO.

### 6) Hành động ngay (checklist ngắn)
- [ ] `git tag v0.5.0-day5` (freeze Day‑5)
- [ ] Thêm `.github/workflows/smoke.yml`
- [ ] FE: badge & merged button
- [ ] (Tuỳ chọn) Bật MinIO + smoke

---

> Ghi chú: Toàn bộ tính năng Day‑5 đã **PASS** với cấu hình mặc định (normalize bật). Bài test "QC fail" được đưa vào backlog theo yêu cầu (không chặn DoD).
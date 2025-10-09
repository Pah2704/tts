# CONTEXT_SNAPSHOT_2025-10-09

[Handoff Recap – từ TTS‑VTN / Day 7]
• Trạng thái dừng: đã chốt **Block‑first UI**, pipeline worker **synthesize → merge → QC → manifest**, lưu trữ **S3/MinIO** ổn định; Piper chạy OK với lib chuẩn; API `/files` stream theo metadata; manifest 404 trả JSON chuẩn.  
• Kiểm thử hiện tại: `boot_log / finalize_semantics / oversample_sanitise / qc_override_warning / storage_roundtrip(manifest 404)` **đều pass**.  
• Việc còn treo từ Day‑7: **Docs quick‑start 3 lệnh**, mở rộng test API headers JSON, FE a11y + skeleton + SSE retry, chọn voice đa ngôn ngữ, chi tiết QC UI, bundling CI tổng hợp.  
• Cần chuyển sang context mới: **Day 8 – Release polish & UX hardening**.  
• Liên kết/điểm tựa: cấu hình Compose hiện tại, env S3 thống nhất, các test trong `ops/tests/*`.  
• Kỳ vọng output: bản **v0.6.x-day8** kèm hướng dẫn nhanh, CI một job, FE mượt ở trạng thái chờ/lỗi, và test tăng độ phủ.

---

## Mục tiêu context mới (Day 8 – theo *PLAN_TTS_VTN_BEGINNER_WSL2_2025-10-02* + dồn phần còn của Day 7)

### 1) Tài liệu & “3 lệnh” Quick‑Start
- README: mục **Quick‑start** đúng 3 lệnh
  1) `docker compose up -d --build`
  2) `curl` tạo block + job + vòng đợi trạng thái
  3) tải `merged.wav` từ `/files/<mixKey>`
- Cập nhật **CONFIG.md**: biến môi trường bắt buộc (S3, HQ/QC, Piper).  
- Changelog **v0.6.x-day8**: nêu rõ manifest 404 JSON, S3 streaming, QC schema.

### 2) CI gọn 1 job (pytest → API build → FE build)
- Thêm `.github/workflows/ci.yml` chạy: `pytest ops/tests` → `pnpm -C apps/api build` → `pnpm -C apps/frontend build`.  
- (Tuỳ chọn) job phụ `minio-smoke`: spin docker‑compose, chạy block/job, assert file HEAD trên S3.

### 3) Frontend polish (Block‑first)
- **A11y**: focus ring/order, `aria-live` cho trạng thái job, contrast AA, label/aria cho slider & nút.  
- **Skeleton loading**: block card, hàng row, QC badge, manifest panel (không nhảy layout).  
- **SSE robust**: auto‑reconnect (backoff + jitter), dùng `Last-Event-Id`, fallback polling, cancel khi unmount.  
- **Voice đa ngôn ngữ**: dropdown voice (id/locale), persist per‑block, POST `/jobs/tts` với `voiceId`; cảnh báo mềm khi thiếu model.  
- **QC UI chi tiết**: hiển thị LUFS/True‑Peak/Clipping/Oversample + so sánh ngưỡng, tooltip giải thích warning, link tải `qc/*.json`.

### 4) API & Worker
- API: thêm `/voices` (liệt kê voice khả dụng), kiểm thử **Content-Type: application/json** cho manifest hợp lệ.  
- Worker: đảm bảo **re‑upload QC sau finalize** (đã có), cảnh báo “HQ disabled”/“QC overridden” tồn tại trong cả QC JSON & manifest; tuỳ chỉnh `TRUEPEAK_OVERSAMPLE` an toàn.

### 5) Kiểm thử bổ sung
- **Finalize semantics**: thêm case `qc_ok` và `qc_threshold_failed` (non‑override).  
- **Manifest headers**: test `Content-Type: application/json` khi OK; 404 JSON khi thiếu/parse lỗi.  
- **Oversample sanitize**: case input phi số/âm/rỗng.  
- (Tuỳ chọn) smoke FE: tạo block→job, hiển thị manifest, badge trạng thái đúng màu.

### 6) Phát hành
- Tag **v0.6.x-day8**, export ảnh chụp console/manifest mẫu, checklist release (build images, verify S3 keys, quick‑start chạy được).

---

## Cách resume nhanh trên context mới
1) Checkout nhánh `feat/day8-polish` từ head hiện tại.  
2) Thêm CI YAML gọn 1 job, chạy thử cục bộ `act` (nếu dùng).  
3) Hoàn thiện README quick‑start rồi chốt FE a11y + skeleton.  
4) Bổ sung test API (manifest headers) và finalize semantics mở rộng.  
5) Smoke: `docker compose up -d` → 3 lệnh quick‑start → xác minh tải `merged.wav`.

> Ghi chú: mọi mục “dang dở” của Day‑7 đã được dồn sang danh mục Day‑8 bên trên.

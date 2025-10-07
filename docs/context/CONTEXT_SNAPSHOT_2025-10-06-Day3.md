
# CONTEXT SNAPSHOT — 2025-10-06

**Handoff Recap – từ TTS‑VTN (ngắn 5–10 dòng, dán ở dòng đầu khi mở thread mới):**
> • Trạng thái dừng: đã chốt **Block‑first UI**, **async‑by‑default**, **Piper mặc định / High‑Quality = XTTS**; **Docker Compose** chạy đủ `api + worker + redis (+ frontend)`; **BullMQ + Redis** hoạt động thật.  
> • Tiến độ Ngày 3: **worker** tách container, xử lý **row‑by‑row**, thứ tự bảo toàn; **SSE** báo tiến độ thật; đã bổ sung **heartbeat** và **snapshot replay** (Redis `progress:<jobId>:last`).  
> • API đã chuẩn hoá: `POST /jobs/tts`, `GET /jobs/:id/stream` (SSE); smoke E2E pass.  
> • Cần chuyển sang context mới: **Ngày 4 — Engine Piper & lưu trữ output (FS/S3‑compatible), manifest per‑block**.  
> • Liên kết/điểm tựa: **ADR‑0001..0018**, **BRIEF_PROJECT_TTS_VTN_PHASE1_MVP_20251001**, **PLAN_TTS_VTN_BEGINNER_WSL2_2025‑10‑02**.  
> • Việc còn treo: **TTS_TAIL_MERGE (env)**; chuẩn hoá storage key/manifest (ADR‑0017); mở rộng payload SSE; (tuỳ chọn) global prefix `/api`.  
> • Kỳ vọng output: synth Piper thật từng **row → .wav**, ghi theo key chuẩn; **manifest.json** cuối job; SSE trả **đường dẫn/bytes**; E2E có thể **download nghe thử**.  
> • Hạ tầng: **Docker Compose**, **Redis + BullMQ**, storage **FS/S3‑compatible**.  
> • Môi trường: **Ubuntu trên WSL2**, TZ **Asia/Ho_Chi_Minh**.

---

## Ngày 4 — Mục tiêu
- Tích hợp **Piper** (engine mặc định theo ADR‑0011) để sinh audio **per‑row**.
- Lưu ra **FS** (mặc định) theo **key scheme** cố định (ADR‑0017), sẵn sàng chuyển S3‑compatible (ADR‑0010).
- Hoàn thiện **manifest per‑block** (danh sách rows, đường dẫn, thời lượng, kích thước).
- Mở rộng **SSE**: kèm `fileKey`, `bytes`, `durationMs` mỗi khi một row hoàn tất.
- Smoke/E2E: tạo job → theo dõi SSE → tải file `.wav` → kiểm tra manifest.

## Phạm vi & ràng buộc (theo tiến độ Ngày 3)
- Không thay đổi flow hàng đợi: **API enqueue → Worker consume → publish PubSub → API bridge SSE**.
- **Snapshot replay** giữ nguyên (SET `progress:<jobId>:last`, TTL `SNAPSHOT_TTL_SEC`, mặc định 600–900s).
- **Concurrency** mặc định `1` (QUEUE_CONCURRENCY), có thể nâng sau khi Piper ổn định.

## Việc cần làm (To‑Do chi tiết)
### A. Engine Piper (Worker)
- [ ] Thêm module `engines/piper.ts` trong **worker (Node)**:
  - [ ] Cấu hình `.env`: `PIPER_VOICE` (vd: `vi_VN-khanh_dien`), `ENGINE_DEFAULT=piper`.
  - [ ] Chạy Piper: **subprocess** (CLI) hoặc HTTP local (nếu có service Python).
  - [ ] API đơn giản: `synthesize(text, outFilePath)` trả `{{ bytes, durationMs }}`.
- [ ] Wiring vào handler job:
  - [ ] Với mỗi `row`, gọi `piper.synthesize` → ghi `rows/<i>_<rowId>.wav`.
  - [ ] `publishWithSnapshot(ch, {{ type:'row', state:'done', rowIndex, total, fileKey, bytes, durationMs }})`.
- [ ] (Tuỳ chọn) xử lý **SSML** cơ bản (bỏ qua nếu chưa cần Ngày 4).

### B. Lưu trữ & key scheme (ADR‑0017, ADR‑0010)
- [ ] `.env`:  
      `STORAGE_KIND=fs`, `STORAGE_ROOT=/data/storage` (mount volume host: `./data:/data/storage`).  
- [ ] Key đề xuất (ổn cho FS & S3):  
      `blocks/{{blockId}}/rows/{{index:03d}}_{{rowId}}.wav`  
      `blocks/{{blockId}}/manifest.json`
- [ ] Manifest structure (ví dụ):
  ```json
  {{
    "blockId": "<id>",
    "engine": "piper",
    "createdAt": "<ISO>",
    "rows": [
      {{"index":0,"rowId":"r1","fileKey":"blocks/<id>/rows/000_r1.wav","bytes":12345,"durationMs":987}},
      ...
    ]
  }}
  ```

### C. API mở rộng
- [ ] `GET /jobs/:id/status` → trả snapshot hiện tại.  
- [ ] `GET /blocks/:blockId/manifest` → đọc file và trả JSON.  
- [ ] (Tuỳ chọn) `GET /files/*` → serve static từ `STORAGE_ROOT` (dev).

### D. SSE payload (v2)
- [ ] `row.running` (như cũ).  
- [ ] `row.done` kèm: `fileKey`, `bytes`, `durationMs` (nếu có).  
- [ ] `final.done` kèm: `manifestKey`.

### E. Docker Compose
- [ ] Mount volume để nghe thử file ra ngoài host:  
  `worker` và `api` dùng:  
  ```yaml
  volumes:
    - ./data:/data/storage
  ```
- [ ] (Nếu dùng Piper CLI) cài nhị phân trong image worker **hoặc** mount từ host; thêm healthcheck đơn giản.

### F. E2E / Smoke Ngày 4
- [ ] Script `ops/dev/smoke_e2e_day4.sh`:  
  1) POST `/jobs/tts` → lấy `jobId`  
  2) SSE đến khi `final.done`  
  3) GET `/blocks/<blockId>/manifest`  
  4) `ls ./data/blocks/<blockId>/rows/*.wav` và thử `ffprobe` (nếu có)  
- [ ] DoD: có ít nhất **3 file .wav** theo `rows/`, manifest hợp lệ, SSE trả thông tin file.

## Định nghĩa Hoàn thành (DoD — Ngày 4)
- [ ] Worker sinh âm thanh **per‑row** bằng **Piper** (mặc định).  
- [ ] File `.wav` được ghi và truy cập được từ host (`./data/...`).  
- [ ] `manifest.json` đầy đủ thông tin, khớp số lượng rows.  
- [ ] SSE có `fileKey`/`bytes`/`durationMs` cho mỗi row; `final.done` có `manifestKey`.  
- [ ] Smoke E2E pass (POST → SSE → đọc manifest → kiểm tra file).  
- [ ] Log/Quan sát: prefix rõ `[api]`, `[worker]`, `[engine:piper]`.

## Rủi ro & biện pháp
- **Phân phối Piper**: binary/voice có thể nặng → chọn 1 giọng mặc định, cache layer Docker.  
- **Âm lượng/clip**: QC để Ngày 5 (ADR‑0013) — tạm thời không chặn export.  
- **Hiệu năng**: giữ `QUEUE_CONCURRENCY=1` trong dev; scale sau khi ổn định.

## Biến môi trường liên quan
```
ENGINE_DEFAULT=piper
PIPER_VOICE=vi_VN-khanh_dien          # ví dụ
STORAGE_KIND=fs
STORAGE_ROOT=/data/storage
SNAPSHOT_TTL_SEC=900
QUEUE_TTS_BLOCK=tts_block
QUEUE_CONCURRENCY=1
TZ=Asia/Ho_Chi_Minh
```

---

### Ghi chú tham chiếu
- ADR‑0011: Engine default **Piper**, HQ toggle **XTTS**.  
- ADR‑0010: Abstraction **S3‑compatible/FS**.  
- ADR‑0017: **Storage key scheme** cố định cho artifact.  
- ADR‑0013: **QC bắt buộc trước export** (cho Ngày 5).


# Kế hoạch triển khai TTS‑VTN (Beginner) trên Ubuntu (WSL2/Windows)

> **Mục tiêu:** Cầm tay chỉ việc cho người mới để *cài đặt → chạy được MVP → làm tính năng theo ngày* cho dự án **TTS‑VTN**. Hệ điều hành: **Ubuntu trên WSL2/Windows**.  
> **Đầu ra tối thiểu (MVP):** Parse văn bản → tách câu → tạo job TTS async → synth bằng **Piper** (mặc định) → ghép block → phát & xuất file; realtime SSE; **QC cơ bản** (LUFS/True Peak/Clipping).  
> **Tùy chọn:** Bật **HQ** → dùng **XTTS** + **SSML Editor** cho từng câu.

---

## 0) Đối tượng & phạm vi

- Người mới lập trình, lần đầu dựng dự án AI audio trên WSL2.
- Chỉ tập trung vào **chạy được** + **hiểu pipeline** + **đóng KPI cơ bản**.  
- Không bao gồm: CI/CD, k8s, tối ưu chi phí cloud (đưa vào Phase sau).

---

## 1) Yêu cầu hệ thống

- Windows 10/11 với **WSL2** + Ubuntu 22.04/24.04.
- Dung lượng trống ≥ 15 GB.
- **Docker** (khuyên dùng Docker Desktop và bật WSL2 integration).
- **Không bắt buộc GPU** (có càng tốt; không có vẫn chạy CPU, chậm hơn).

---

## 2) Tóm tắt stack & bố cục repo

- **Frontend**: React + Vite (SPA).
- **API**: NestJS (REST + SSE realtime progress).
- **Worker**: Python 3.11 (Piper/XTTS + FX + QC).
- **Queue**: Redis (BullMQ).
- **Storage**: Local FS (có thể dùng MinIO/S3 sau).

**Cấu trúc đề xuất** (local-first):
```
tts-vtn/
├─ apps/
│  ├─ frontend/           # React (Vite)
│  ├─ api/                # NestJS API
│  └─ worker/             # Python worker: synth, mix, QC
├─ docs/
│  ├─ adr/                # Architecture Decision Records
│  └─ plan/               # Kế hoạch & tài liệu
├─ storage/               # Âm thanh, manifest, QC output (local)
└─ ops/
   └─ docker/             # Dev compose & scripts
```

**Quy ước key lưu file (gợi ý):**
```
projects/{{projectId}}/blocks/{{blockId}}/rows/{{rowId}}.wav
mix/block-{{blockId}}.wav
qc/block-{{blockId}}.json
```

---

## 3) Chuẩn bị máy (WSL2 Ubuntu)

1. **Bật systemd cho WSL2**
   ```bash
   sudo bash -lc 'grep -q "\[boot\]" /etc/wsl.conf || echo -e "[boot]\nsystemd=true" | sudo tee -a /etc/wsl.conf'
   # Windows PowerShell (ngoài Ubuntu):
   wsl --shutdown
   ```

2. **Cập nhật & công cụ cơ bản**
   ```bash
   sudo apt update && sudo apt -y upgrade
   sudo apt -y install build-essential git curl unzip jq ffmpeg sox ca-certificates
   ```

3. **Node.js 20 + pnpm**
   ```bash
   curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
   source ~/.bashrc
   nvm install 20 && nvm use 20
   corepack enable && corepack prepare pnpm@latest --activate
   ```

4. **Python 3.11 + venv**
   ```bash
   sudo apt -y install python3.11 python3.11-venv python3-pip
   python3.11 -m venv ~/.venvs/tts-vtn && source ~/.venvs/tts-vtn/bin/activate
   python -m pip install -U pip wheel
   ```

5. **Docker**
   - **Khuyên dùng:** Docker Desktop trên Windows → Settings → Resources → WSL Integration → bật cho Ubuntu.
   - **Hoặc** cài Docker Engine trong WSL:
     ```bash
     sudo apt -y install docker.io docker-compose-plugin
     sudo usermod -aG docker $USER
     newgrp docker
     sudo systemctl enable --now docker
     docker version && docker compose version
     ```

> **Gợi ý hiệu năng:** đặt repo trong `~/projects` (Linux FS), tránh làm việc trực tiếp dưới `/mnt/c/...` để giảm overhead I/O.

---

## 4) Tạo project skeleton & Compose

```bash
mkdir -p ~/projects/tts-vtn/{{apps/frontend,apps/api,apps/worker},docs/{adr,plan},storage,ops/docker}
cd ~/projects/tts-vtn
```

**.env (root)**
```env
# API
API_PORT=4000
REDIS_URL=redis://redis:6379
STORAGE_KIND=fs
STORAGE_ROOT=/data/storage

# Worker
ENGINE_DEFAULT=piper
HQ_TOGGLE=true
CUDA=auto   # nếu có GPU thì tận dụng, không có vẫn chạy CPU

# Frontend
VITE_API_BASE=http://localhost:4000
```

**docker-compose.yml (dev)**
```yaml
version: "3.9"
services:
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  api:
    build: ./apps/api
    env_file: .env
    ports: ["4000:4000"]
    depends_on: [redis]
    volumes:
      - ./storage:/data/storage

  worker:
    build: ./apps/worker
    env_file: .env
    depends_on: [redis]
    volumes:
      - ./storage:/data/storage

  frontend:
    build: ./apps/frontend
    env_file: .env
    ports: ["3000:3000"]
    depends_on: [api]

  # Tuỳ chọn: MinIO (S3 compatible) — bật sau nếu cần
  # minio:
  #   image: quay.io/minio/minio:latest
  #   command: server /data --console-address ":9001"
  #   ports: ["9000:9000","9001:9001"]
  #   volumes: [ "./storage/minio:/data" ]
```

> Sau khi có Dockerfile sườn cho 3 services, `docker compose up --build` sẽ khởi tạo toàn bộ môi trường dev.

---

## 5) Lộ trình theo ngày (7–10 ngày)

> Mỗi ngày có **Mục tiêu → Việc làm → File cần tạo**. Bạn có thể commit theo `feat/day-X-*` để dễ theo dõi.

### Ngày 1 — “Hello Compose” & đọc nhanh kiến trúc
- **Mục tiêu:** Lên 4 service (redis/api/worker/frontend) bản sườn, chạy OK.
- **Việc làm:**
  - Tạo **sườn** 3 app (hello world): React, Nest, Python.
  - `docker compose up --build` kiểm tra container healthy.
- **File cần tạo:**
  - `apps/api/Dockerfile`, `apps/api/src/main.ts` (Nest skeleton)
  - `apps/worker/Dockerfile`, `apps/worker/app.py` (Python skeleton)
  - `apps/frontend/Dockerfile`, `apps/frontend/src/main.tsx` (Vite skeleton)

### Ngày 2 — Workspace & Parser
- **Mục tiêu:** Dán văn bản → sinh **Block** → **tách câu** (Row).
- **Việc làm:**
  - **FE**: Trang Workspace, hiển thị câu, cho phép gộp/chia.
  - **API**: `POST /blocks` tạo block từ text, `PATCH /blocks/:id` cập nhật.
- **File cần tạo:**
  - `apps/api/src/modules/blocks/*` (controller/service/dto)
  - `apps/frontend/src/pages/Workspace.tsx`
  - Bộ test tách câu (≥20 case) — KPI parsing ≥ 98%.

### Ngày 3 — Queue & Job cấp Block
- **Mục tiêu:** Bấm **“Tạo âm thanh (Async)”** → enqueue job vào Redis.
- **Việc làm:**
  - **API**: BullMQ queue `block_jobs`, endpoints `POST /blocks/:id/job`, `GET /jobs/:id`.
  - **Worker**: tiêu thụ job `{jobId, blockId, rows[], engine}`.
- **File cần tạo:**
  - `apps/api/src/modules/jobs/*`
  - `apps/worker/queue_consumer.py` (log tiến độ giả lập).

### Ngày 4 — Piper tích hợp & playback
- **Mục tiêu:** Synth từng Row bằng **Piper**, ghép **Block** và phát thử.
- **Việc làm:**
  - **Worker**: `PiperAdapter` → xuất `rows/*.wav` theo key scheme, `mix/block-*.wav`, manifest JSON.
  - **FE**: Player phát theo Row/Block, nút **Xuất file**.
- **File cần tạo:**
  - `apps/worker/adapters/piper_adapter.py`, `apps/worker/mixer.py`
  - `apps/frontend/src/components/Player.tsx`

### Ngày 5 — Realtime SSE & QC cơ bản
- **Mục tiêu:** Hiển thị tiến độ per-Row realtime; đo **LUFS/True Peak/Clipping**.
- **Việc làm:**
  - **Worker** publish progress → Redis Pub/Sub (hoặc Stream).
  - **API** expose SSE: `GET /jobs/:id/stream`.
  - **QC**: tính LUFS/Peak/Clip, lưu `qc/block-*.json`; chặn export nếu fail.
- **File cần tạo:**
  - `apps/api/src/realtime/progress.gateway.ts` (SSE)
  - `apps/worker/qc/metrics.py`

### Ngày 6 — XTTS (HQ toggle) & SSML Editor (per‑row)
- **Mục tiêu:** Bật **HQ** → engine **XTTS**; modal **SSML Editor** (whitelist tag).
- **Việc làm:**
  - **FE**: Toggle HQ, mở SSML Editor với `<break>`, `<emphasis>`, `<prosody>`, `say-as` (áp dụng **theo câu**, không theo block).
  - **Worker**: `XTTSAdapter` (tham số nâng cao), bảo toàn thứ tự ghép.
- **File cần tạo:**
  - `apps/frontend/src/components/SsmlEditor.tsx`
  - `apps/worker/adapters/xtts_adapter.py`

### Ngày 7 — FX nền & level matching
- **Mục tiêu:** Thêm FX nền (auto-ducking, fade), cân bằng mức giữa các nhân vật.
- **Việc làm:**
  - Implement `fx/background.py`, `fx/ducking.py`, `mix/level_matching.py`.
- **File cần tạo:**
  - `apps/worker/fx/background.py`
  - `apps/worker/fx/ducking.py`
  - `apps/worker/mix/level_matching.py`

### Ngày 8–10 — Hoàn thiện & đóng KPI
- **Mục tiêu:** Ổn định pipeline, hoàn thiện tài liệu & ADR, tối ưu hiệu năng.
- **Việc làm:**
  - Piper ≤ **0.6× real-time**; TTFB Piper ≤ **5s**; XTTS-CPU ≤ **2.5× RT**.
  - Viết ADR tóm tắt các quyết định; dọn tài liệu trong `docs/`.

---

## 6) Cách chạy & smoke test

1) Lên dịch vụ:
```bash
cd ~/projects/tts-vtn
docker compose up --build
```

2) Tạo Block & Job (API 4000):
```bash
# Tạo block từ văn bản
curl -s -X POST http://localhost:4000/blocks   -H "Content-Type: application/json"   -d '{"projectId":"demo","kind":"mono","text":"Xin chào. Đây là thử nghiệm."}' | jq .

# Tạo job TTS cho block (engine Piper mặc định)
curl -s -X POST http://localhost:4000/blocks/{BLOCK_ID}/job -d '{}' | jq .

# Subscribe realtime (SSE) — mở trong trình duyệt:
# http://localhost:4000/jobs/{JOB_ID}/stream
```

3) Kết quả mong đợi:
- Player FE phát được `mix/block-*.wav` và từng `rows/*.wav`.
- `qc/block-*.json` có đủ LUFS/True Peak/Clipping; export chỉ pass khi trong ngưỡng.

---

## 7) KPI & tiêu chí hoàn thành (MVP)

- **QC pass ≥ 95%** câu đạt **−16 ± 1 LUFS**, **True Peak ≤ −1.0 dBTP**, **clipping ≤ 0.1%**.
- **UX async:** Mỗi Row có trạng thái *queued/running/done/error* và % tiến độ.
- **Hiệu năng tham chiếu:**
  - Piper: tốc độ synth ≤ **0.6× RT**; TTFB ≤ **5s**.
  - XTTS (CPU): ≤ **2.5× RT** (tuỳ phần cứng).

---

## 8) Troubleshooting (WSL2)

- **Docker permission denied** → `newgrp docker` hoặc mở terminal mới.
- **Chậm I/O** → đặt repo trong Linux FS (`~/projects`), hạn chế `/mnt/c/...`.
- **Thiếu codec** → `sudo apt install -y libsox-fmt-all`.
- **Không có GPU** → pipeline vẫn chạy CPU; HQ/XTTS có thể chậm, nhưng chức năng đầy đủ.

---

## 9) Phụ lục

### 9.1 Mẫu Dockerfile (gợi ý ngắn gọn)

**API (Nest)**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@latest --activate && pnpm i --frozen-lockfile
COPY . .
EXPOSE 4000
CMD ["pnpm","start"]
```

**Worker (Python)**
```dockerfile
FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y ffmpeg sox && rm -rf /var/lib/apt/lists/*
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python","app.py"]
```

**Frontend (Vite)**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@latest --activate && pnpm i --frozen-lockfile
COPY . .
EXPOSE 3000
CMD ["pnpm","dev","--host","0.0.0.0"]
```

### 9.2 Checklist trước commit
- [ ] `docker compose up --build` chạy OK tất cả services.
- [ ] Tạo được block → tách câu chuẩn (≥98%) → tạo job → synth → ghép.
- [ ] SSE hiển thị tiến độ theo Row.
- [ ] QC pass ≥95% câu theo ngưỡng.
- [ ] Tài liệu: cập nhật `docs/adr/*`, `docs/plan/*`.

---

**Lưu ý đặt file:** `docs/plan/PLAN_TTS_VTN_BEGINNER_WSL2_YYYY-MM-DD.md` (đây là file hiện tại).  
**Ngày tạo:** 2025-10-02.

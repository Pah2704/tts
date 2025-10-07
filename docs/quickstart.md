### 1.3 `docs/quickstart.md` (new)
```md
# Quickstart — Dev on WSL2 + Docker Compose

## Prereqs
Docker (WSL2), Node 20 + pnpm, Python 3.11, ffmpeg/sox.

## Up the stack
```bash
cp .env.example .env
docker compose up -d --build
```

## Run a job (outline)
- POST `/blocks` → POST `/blocks/:id/job`
- Subscribe SSE: `GET /jobs/:jobId/stream` (closes on `final`)
- Download: `/files/blocks/{blockId}/rows/{i}.wav`, `/files/blocks/{blockId}/merged.wav`
```

1) Prereqs: Docker (WSL2), Node 20 + pnpm, Python 3.11, ffmpeg/sox.
2) Clone & prepare:
```bash
cp .env.example .env     # fill as needed
docker compose up -d --build
```
3) Create a Block & Job:
# POST /blocks
# POST /blocks/:id/job  (engine piper by default)
# Subscribe: GET /jobs/:jobId/stream   (SSE)

Watch progress per-row (SSE); when final arrives, stream will close.
Download files:
rows/[row].wav, mix/block-*.wav via GET /files/:key.

Optional: MinIO (S3)
STORAGE_KIND=s3
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=tts-vtn
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_FORCE_PATH_STYLE=1
S3_SECURE=0

Bring MinIO up (see compose snippet in repo), then re-run smoke.

### 1.4 `docs/releases/RELEASE_NOTES_v0.5.0-day5.md` (new, minimal)
```md
# v0.5.0-day5 — Snapshot
- QC mandatory (row + block), Tail-merge (env-controlled), Manifest v1.1.
- SSE v2.1: subscribe-then-replay; auto-close on `final`.
- Smoke: `ops/dev/smoke_day5.sh` PASS (local FS).
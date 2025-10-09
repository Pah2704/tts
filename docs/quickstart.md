# Quickstart — TTS-VTN Day 8

This quick start assumes Docker + docker compose, `jq`, and curl are available. The API listens on `http://localhost:4000`, the frontend on `http://localhost:3000`, and artifacts are persisted to the S3-compatible key scheme defined in ADR-0017 (`mix/block-{blockId}.wav`, `qc/block-{blockId}.json`, etc.).

Run the following three commands from the project root:

1. **Bring the stack online**
   ```bash
   docker compose up -d --build
   ```

2. **Create a block and enqueue a job (single line)**
   ```bash
   BLOCK_ID=$(curl -s http://localhost:4000/blocks -H "Content-Type: application/json" \
     -d '{"projectId":"demo","kind":"mono","text":"Hello world. This is a quick start demo."}' | jq -r '.id') \
   && JOB_ID=$(curl -s -X POST http://localhost:4000/blocks/$BLOCK_ID/job -H "Content-Type: application/json" -d '{}' | jq -r '.jobId') \
   && echo "Block=$BLOCK_ID Job=$JOB_ID"
   ```

3. **Poll the manifest, fetch `merged.wav` once ready**
   ```bash
   bash -lc 'for i in {1..60}; do K=$(curl -fsS http://localhost:4000/blocks/'"$BLOCK_ID"'/manifest | jq -r ".mixKey//empty"); \
     if [ -n "$K" ]; then curl -fsS -o merged.wav "http://localhost:4000/files/$K" && echo "✓ saved merged.wav" && break; fi; sleep 2; done'
   ```

Behind the scenes the UI and tooling follow the ADR-0003 contract: REST endpoints for block/job orchestration, SSE at `GET /jobs/:jobId/stream` to monitor progress, and direct downloads via `/files/<key>` for finalized audio and QC artifacts.

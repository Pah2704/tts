FROM node:20-bullseye

WORKDIR /app/apps/worker

# Python + phonemizer deps for Piper
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    espeak-ng \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable \
  && corepack prepare pnpm@9.12.1 --activate

# Node dependencies
COPY package.json ./
RUN pnpm i --no-frozen-lockfile

COPY tsconfig.json ./

# Python dependencies (redis client + Piper CLI)
COPY requirements.txt ./requirements.txt
RUN pip3 install --no-cache-dir -r requirements.txt \
  && pip3 install --no-cache-dir piper-tts

# Ensure bind mount targets exist even without host volumes
RUN mkdir -p /data/storage /models

# Application sources
COPY adapters ./adapters
COPY handlers ./handlers
COPY mix ./mix
COPY qc ./qc
COPY run_block_job.py ./run_block_job.py
COPY src ./src

RUN pnpm build

CMD ["node", "dist/index.js"]

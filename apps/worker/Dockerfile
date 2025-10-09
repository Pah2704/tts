FROM node:20-bookworm AS worker
WORKDIR /app
ENV DEBIAN_FRONTEND=noninteractive

# OS deps + backports cho espeak-ng mới (đúng tên gói: espeak-ng-data)
RUN echo "deb http://deb.debian.org/debian bookworm-backports main" > /etc/apt/sources.list.d/backports.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends \
      python3 python3-venv python3-pip \
      libsndfile1 libatomic1 espeak-ng-data \
 && apt-get install -y --no-install-recommends -t bookworm-backports libespeak-ng1 \
 && rm -rf /var/lib/apt/lists/*

# Copy requirements trước khi tạo venv
COPY apps/worker/requirements.txt apps/worker/requirements.txt

# venv + deps
RUN python3 -m venv /opt/py --copies \
 && /opt/py/bin/python -m pip install --upgrade pip setuptools wheel \
 && /opt/py/bin/pip install --no-cache-dir -r apps/worker/requirements.txt

# Ưu tiên venv và lib Piper
ENV PATH="/opt/py/bin:${PATH}" \
    PYTHONPATH=/app \
    LD_LIBRARY_PATH="/usr/local/lib/piper:${LD_LIBRARY_PATH}" \
    CI=true

# pnpm
RUN corepack enable && corepack prepare pnpm@10.18.1 --activate

# Copy sources
COPY package.json pnpm-lock.yaml* ./
COPY apps ./apps

# Xác nhận Python deps tồn tại
RUN python - <<'PY'
import numpy, scipy, pyloudnorm, soundfile, boto3, redis
print("Python deps OK")
PY

# Node wrapper
RUN pnpm -C apps/worker install --frozen-lockfile=false --reporter=silent \
 && pnpm -C apps/worker run build

# Runtime
CMD ["node","/app/apps/worker/dist/index.js"]

#!/usr/bin/env bash
set -euo pipefail

root="$(pwd)"
mkdir -p apps/api/src apps/worker apps/frontend/src ops

# ------------------------------
# docker-compose.yml (root)
# ------------------------------
install -D /dev/null "$root/docker-compose.yml" >/dev/null 2>&1 || true
tee "$root/docker-compose.yml" >/dev/null <<'YAML'
services:
  redis:
    image: redis:7-alpine
    command: ["redis-server", "--appendonly", "no"]
    ports: ["6379:6379"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 3s
      timeout: 2s
      retries: 20

  api:
    build: ./apps/api
    working_dir: /app
    environment:
      - PORT=4000
      - REDIS_URL=redis://redis:6379
    ports: ["4000:4000"]
    depends_on:
      redis:
        condition: service_healthy
    restart: unless-stopped

  worker:
    build: ./apps/worker
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - PORT=5001
    ports: ["5001:5001"]
    depends_on:
      redis:
        condition: service_healthy
    restart: unless-stopped

  frontend:
    build: ./apps/frontend
    environment:
      - VITE_API_URL=http://localhost:4000
    ports: ["3000:3000"]
    depends_on:
      - api
    restart: unless-stopped

YAML

# ------------------------------
# API (Nest skeleton, chạy bằng ts-node)
# ------------------------------
install -D /dev/null "$root/apps/api/Dockerfile" >/dev/null 2>&1 || true
tee "$root/apps/api/Dockerfile" >/dev/null <<'DOCKER'
FROM node:20-alpine
WORKDIR /app
# pnpm via corepack
RUN corepack enable && corepack prepare pnpm@9.12.1 --activate
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install
COPY tsconfig.json ./
COPY src ./src
ENV PORT=4000
EXPOSE 4000
CMD ["pnpm","exec","ts-node","src/main.ts"]
DOCKER

install -D /dev/null "$root/apps/api/package.json" >/dev/null 2>&1 || true
tee "$root/apps/api/package.json" >/dev/null <<'JSON'
{
  "name": "tts-vtn-api",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "start": "node -r ts-node/register src/main.ts"
  },
  "dependencies": {
    "@nestjs/common": "^10.4.7",
    "@nestjs/core": "^10.4.7",
    "@nestjs/platform-express": "^10.4.7",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "ts-node": "^10.9.2",
    "typescript": "^5.6.2"
  }
}
JSON

install -D /dev/null "$root/apps/api/tsconfig.json" >/dev/null 2>&1 || true
tee "$root/apps/api/tsconfig.json" >/dev/null <<'JSON'
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "commonjs",
    "moduleResolution": "node",
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
JSON

install -D /dev/null "$root/apps/api/src/main.ts" >/dev/null 2>&1 || true
tee "$root/apps/api/src/main.ts" >/dev/null <<'TS'
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module, Controller, Get } from '@nestjs/common';

@Controller()
class AppController {
  @Get('/')
  root() { return { ok: true, service: 'api', msg: 'Hello from Nest API' }; }
  @Get('/hello')
  hello() { return { hello: 'world' }; }
}

@Module({ controllers: [AppController] })
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT || 4000;
  await app.listen(port as number);
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}`);
}

bootstrap();
TS

# ------------------------------
# Worker (Python skeleton, ping Redis và mở HTTP 5001)
# ------------------------------
install -D /dev/null "$root/apps/worker/Dockerfile" >/dev/null 2>&1 || true
tee "$root/apps/worker/Dockerfile" >/dev/null <<'DOCKER'
FROM python:3.11-slim
WORKDIR /app
RUN pip install --no-cache-dir --upgrade pip
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py ./
ENV PORT=5001
EXPOSE 5001
CMD ["python","-u","app.py"]
DOCKER

install -D /dev/null "$root/apps/worker/requirements.txt" >/dev/null 2>&1 || true
tee "$root/apps/worker/requirements.txt" >/dev/null <<'REQ'
redis==5.0.7
REQ

install -D /dev/null "$root/apps/worker/app.py" >/dev/null 2>&1 || true
tee "$root/apps/worker/app.py" >/dev/null <<'PY'
import os, time
import redis
from http.server import HTTPServer, BaseHTTPRequestHandler

REDIS_HOST = os.getenv('REDIS_HOST', 'redis')
REDIS_PORT = int(os.getenv('REDIS_PORT', '6379'))

print('[worker] starting... connecting to redis at', REDIS_HOST, REDIS_PORT)
for i in range(60):
    try:
        r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
        r.ping()
        print('[worker] connected to redis ✓')
        r.publish('progress:demo', '{"rowId":"demo","state":"running","tElapsedMs":0}')
        break
    except Exception as e:
        print('[worker] waiting for redis...', str(e))
        time.sleep(1)
else:
    print('[worker] could not connect to redis after retries')

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type','application/json')
        self.end_headers()
        self.wfile.write(b'{"ok": true, "service": "worker", "msg": "Hello from Python Worker"}')

PORT = int(os.getenv('PORT','5001'))
print(f'[worker] http server on :{PORT}')
HTTPServer(('', PORT), Handler).serve_forever()
PY

# ------------------------------
# Frontend (React + Vite skeleton)
# ------------------------------
install -D /dev/null "$root/apps/frontend/Dockerfile" >/dev/null 2>&1 || true
tee "$root/apps/frontend/Dockerfile" >/dev/null <<'DOCKER'
FROM node:20-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.12.1 --activate
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install
COPY index.html ./
COPY tsconfig.json ./
COPY src ./src
EXPOSE 3000
CMD ["pnpm","run","dev","--","--host","0.0.0.0","--port","3000"]
DOCKER

install -D /dev/null "$root/apps/frontend/package.json" >/dev/null 2>&1 || true
tee "$root/apps/frontend/package.json" >/dev/null <<'JSON'
{
  "name": "tts-vtn-frontend",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview --host --port 3000"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.6.2",
    "vite": "^5.4.0"
  }
}
JSON

install -D /dev/null "$root/apps/frontend/tsconfig.json" >/dev/null 2>&1 || true
tee "$root/apps/frontend/tsconfig.json" >/dev/null <<'JSON'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true
  }
}
JSON

install -D /dev/null "$root/apps/frontend/index.html" >/dev/null 2>&1 || true
tee "$root/apps/frontend/index.html" >/dev/null <<'HTML'
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>TTS‑VTN — Hello Compose</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
HTML

install -D /dev/null "$root/apps/frontend/src/main.tsx" >/dev/null 2>&1 || true
tee "$root/apps/frontend/src/main.tsx" >/dev/null <<'TSX'
import React from 'react'
import ReactDOM from 'react-dom/client'

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000'

function App() {
  return (
    <div style={{fontFamily:'system-ui', padding:24, lineHeight:1.5}}>
      <h1>TTS‑VTN — Hello Compose</h1>
      <p>Day 1 skeleton is running. Quick links:</p>
      <ul>
        <li>API: <a href={`${apiUrl}/hello`} target="_blank">{`${apiUrl}/hello`}</a></li>
        <li>Worker: <a href="http://localhost:5001" target="_blank">http://localhost:5001</a></li>
      </ul>
      <p>Redis is internal at <code>redis:6379</code> (health‑checked by Compose).</p>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
TSX



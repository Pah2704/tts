FROM node:20-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.12.1 --activate

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install

COPY index.html ./
COPY tsconfig.json ./
COPY tailwind.config.js postcss.config.js ./
COPY src ./src

EXPOSE 3000
CMD ["pnpm","run","dev","--","--host","0.0.0.0","--port","3000"]

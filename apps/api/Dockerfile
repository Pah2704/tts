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

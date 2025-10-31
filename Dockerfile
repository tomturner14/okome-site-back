# syntax=docker/dockerfile:1

# ===== Builder Stage =====
FROM node:20-bookworm-slim AS builder
WORKDIR /app
ENV NODE_ENV=development

# bcrypt 等のビルド & Prisma が OpenSSL を認識できるように openssl も入れる
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# 依存関係
COPY package*.json ./
RUN npm ci

# Prisma Client 生成（schema だけでOK）
COPY prisma ./prisma
RUN npx prisma generate

# TypeScript をビルド
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# 本番用に dev 依存を削る
RUN npm prune --omit=dev

# ===== Runtime Stage =====
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# 実行時にも OpenSSL が必要（Prisma の Query Engine 用）
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# 実行に必要な成果物をコピー
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --chown=node:node package*.json ./

USER node
EXPOSE 4000
CMD ["node", "dist/index.js"]

# syntax=docker/dockerfile:1

# ===== Builder Stage =====
FROM node:20-bookworm-slim AS builder
WORKDIR /app
ENV NODE_ENV=development

# ネイティブモジュール(bcrypt等)のビルドに必要
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

# 依存関係
COPY package*.json ./
RUN npm ci

# Prisma Client 生成（DB接続は不要。スキーマだけでOK）
COPY prisma ./prisma
RUN npx prisma generate

# TypeScript ソースと設定をコピーしてビルド
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# 本番用に dev 依存を削除（node_modules を軽量化）
RUN npm prune --omit=dev

# ===== Runtime Stage =====
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# 実行ユーザ（root回避）
USER node

# 実行に必要な成果物をコピー
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --chown=node:node package*.json ./

EXPOSE 4000
CMD ["node", "dist/index.js"]

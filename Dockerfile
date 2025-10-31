# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS builder
WORKDIR /app
- RUN apt-get update  && apt-get install -y --no-install-recommends python3 make g++  && rm -rf /var/lib/apt/lists/*
+ RUN apt-get update  \
+  && apt-get install -y --no-install-recommends openssl python3 make g++ ca-certificates \
+  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
# ★ OpenSSL がある状態で generate することが大事
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build
RUN npm prune --omit=dev


FROM node:20-bookworm-slim AS runner
WORKDIR /app
+ RUN apt-get update \
+  && apt-get install -y --no-install-recommends openssl ca-certificates \
+  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --chown=node:node package*.json ./

USER node
EXPOSE 4000
CMD ["node","dist/index.js"]

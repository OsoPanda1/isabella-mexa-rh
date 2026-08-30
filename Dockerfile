# ── Stage 1: Build ──────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts
COPY . .
RUN npx tsc --noEmit && npm run build

# ── Stage 2: Production ────────────────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app
RUN addgroup -g 1001 isabella && adduser -u 1001 -G isabella -s /bin/sh -D isabella

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/server.ts ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

RUN mkdir -p /app/data /app/.isabella-data && chown -R isabella:isabella /app
USER isabella

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://localhost:3000/api/health || exit 1
CMD ["node", "dist/server.cjs"]

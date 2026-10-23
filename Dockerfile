# syntax=docker/dockerfile:1

# --- Dependencies (full install for Next.js build) ---
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /src
# package manifests are bind-mounted (not COPY-ed): npm ci never rewrites them.
# Optional npmrc secret for private registries:
#   docker buildx build --secret id=npmrc,src=$HOME/.npmrc .
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=secret,id=npmrc,target=/root/.npmrc,required=false \
    --mount=type=cache,target=/root/.npm \
    npm ci

# --- Build ---
FROM node:22-alpine AS build
WORKDIR /src
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /src/node_modules ./node_modules
COPY . .
RUN --mount=type=cache,target=/src/.next/cache \
    npm run build

# --- Production runtime (Next.js standalone) ---
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs nextjs

COPY --from=build --chown=1001:1001 /src/public ./public
COPY --from=build --chown=1001:1001 /src/.next/standalone ./
COPY --from=build --chown=1001:1001 /src/.next/static ./.next/static

USER nextjs
EXPOSE 3000

LABEL org.opencontainers.image.title="TradingChart" \
      org.opencontainers.image.description="TradingView-style charting app"

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]

# --- Local development (compose.dev.yaml target) ---
FROM node:22-alpine AS development
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=secret,id=npmrc,target=/root/.npmrc,required=false \
    --mount=type=cache,target=/root/.npm \
    npm ci

COPY . .
EXPOSE 3000
CMD ["npx", "next", "dev", "--hostname", "0.0.0.0", "--port", "3000"]

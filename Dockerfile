# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Lumina LMS — multi-stage build.
#
# Produces a slim runtime image using Next.js `standalone` output: only the
# server bundle and its actually-used node_modules are copied forward, which
# keeps the final image well under 300 MB.
# ---------------------------------------------------------------------------

FROM node:22-alpine AS base
# Prisma's engines need this on musl-based images.
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app


# --- Dependencies ----------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci


# --- Build -----------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma needs a DATABASE_URL present at generate time. The real one is injected
# at runtime; this only has to satisfy schema validation.
ENV DATABASE_URL="file:./build.db"
ENV NEXT_TELEMETRY_DISABLED=1

RUN npx prisma generate

# AUTH_SECRET is scoped to this one RUN rather than set as ENV, so no secret-like
# value is baked into an image layer. It is freshly random per build and never
# used to sign anything — the runtime secret comes from the environment. A fixed
# placeholder would be rejected by the guard in src/lib/auth.ts, which is the
# point of that guard.
RUN AUTH_SECRET="$(head -c 32 /dev/urandom | base64 | tr -d '\n')" npm run build


# --- Runtime ---------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Keep in sync with DEFAULT_PORT in scripts/lib/port.mjs.
ENV PORT=4400
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# `standalone` emits a minimal server plus a trimmed node_modules tree.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Schema, migrations, and the Prisma CLI are needed so the container can run
# `prisma migrate deploy` on start.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma

# Volumes for the SQLite file and uploaded media.
RUN mkdir -p /app/data /app/storage && chown -R nextjs:nodejs /app/data /app/storage

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER nextjs
EXPOSE 4400

# 127.0.0.1 rather than localhost: the server binds 0.0.0.0 (IPv4), and localhost
# can resolve to IPv6 ::1 first, which would fail a perfectly healthy container.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4400)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]

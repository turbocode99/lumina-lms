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

# Prisma needs a DATABASE_URL present at generate time, and Next.js evaluates
# env at build time for anything NEXT_PUBLIC_. Real values are injected at run.
ENV DATABASE_URL="file:./build.db"
ENV AUTH_SECRET="build-time-placeholder-not-used-at-runtime"
ENV NEXT_TELEMETRY_DISABLED=1

RUN npx prisma generate
RUN npm run build


# --- Runtime ---------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
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
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]

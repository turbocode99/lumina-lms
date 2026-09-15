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
# NEXT_PUBLIC_* values are inlined into the client bundle as the build runs,
# so they have to be present *here* and not only in the runtime environment.
# Supplying them at runtime alone leaves server-rendered text correct while
# anything rendered on the client shows the fallback -- which is how a
# deployment for one organisation still said "Your Organization" in the
# sidebar while the dashboard beside it already used the real name.
ARG NEXT_PUBLIC_APP_NAME="Lumina"
ARG NEXT_PUBLIC_APP_TAGLINE="Learning, elevated."
ARG NEXT_PUBLIC_ORG_NAME="Your Organization"
ENV NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME}
ENV NEXT_PUBLIC_APP_TAGLINE=${NEXT_PUBLIC_APP_TAGLINE}
ENV NEXT_PUBLIC_ORG_NAME=${NEXT_PUBLIC_ORG_NAME}

RUN AUTH_SECRET="$(head -c 32 /dev/urandom | base64 | tr -d '\n')" npm run build

# Stage the packages the entrypoint's CLIs need into /cli-modules, computed
# from the installed tree rather than listed by hand -- see the script for why.
RUN node scripts/collect-cli-modules.js


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

# The CLIs the entrypoint runs (Prisma, and tsx for the optional seed) plus the
# full closure of their dependencies, staged in the builder. This replaces a
# hand-written list of package directories: that list silently went stale when
# Prisma 6.19 gave @prisma/config dependencies of its own, and the container
# crash-looped on `Cannot find module 'effect'` before it could reach the schema
# sync. Computing the closure at build time means an upstream dependency can no
# longer break the image unnoticed.
COPY --from=builder --chown=nextjs:nodejs /cli-modules ./node_modules

# The generated demo thumbnails/videos/PDFs that prisma/seed.ts installs when
# SEED_ON_START=true. Without this, a Docker deployment run with the demo
# seed would create the courses but silently skip every media file, since the
# seed script resolves this path relative to its own runtime location and
# finds nothing there.
COPY --from=builder --chown=nextjs:nodejs /app/demo-assets ./demo-assets

# tsx and esbuild travel in the staged closure above, so SEED_ON_START=true can
# run prisma/seed.ts directly with `node` — no dev dependencies and no network
# access at container start. esbuild's native binary is platform-specific, but
# since deps/builder/runner all share the same node:22-alpine base, `npm ci` in
# the deps stage already resolved the right one — the same reasoning that lets
# Prisma's native engine work here via libc6-compat, installed above.

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

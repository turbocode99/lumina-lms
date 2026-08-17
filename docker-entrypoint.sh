#!/bin/sh
set -e

# Bring the database up to date before serving traffic. `migrate deploy` only
# applies committed migrations and never prompts, so it is safe to run on every
# container start; if no migrations directory exists we fall back to `db push`,
# which is the right behaviour for a SQLite pilot deployment.

echo "→ Preparing database…"

if [ -d "./prisma/migrations" ] && [ -n "$(ls -A ./prisma/migrations 2>/dev/null)" ]; then
  npx prisma migrate deploy
else
  echo "  No migrations found — syncing schema directly."
  npx prisma db push --skip-generate --accept-data-loss
fi

# Optional demo seed. Off by default: on a fresh deployment the first account to
# register is made an administrator, which is the cleaner path for a real org.
# Set SEED_ON_START=true to populate the demo dataset instead. Requires the dev
# dependencies, so it only works on an image built with --target builder.
if [ "${SEED_ON_START:-false}" = "true" ]; then
  echo "→ Seeding demo data…"
  npx tsx prisma/seed.ts || echo "  Seed skipped (tsx unavailable in this image)."
fi

echo "→ Starting Lumina LMS on port ${PORT:-4400}"
exec "$@"

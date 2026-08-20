#!/bin/sh
set -e

# Bring the database up to date before serving traffic. `migrate deploy` only
# applies committed migrations and never prompts, so it is safe to run on every
# container start; if no migrations directory exists we fall back to `db push`,
# which is the right behaviour for a SQLite pilot deployment.

# A relative SQLite path is resolved against the Prisma schema directory, which
# inside the image is a build artifact rather than the mounted volume. That means
# writes land somewhere ephemeral and vanish when the container is replaced — with
# no error at any point. Absolute paths are the only safe form here.
case "${DATABASE_URL:-}" in
  file:/*|file:[A-Za-z]:*) ;;
  file:*)
    echo "✗ DATABASE_URL is a relative SQLite path: ${DATABASE_URL}"
    echo "  In a container this resolves inside the image, not your volume, so all"
    echo "  data would be lost on restart. Use an absolute path, e.g.:"
    echo "      DATABASE_URL=file:/app/data/lumina.db"
    exit 1
    ;;
esac

# Both CLIs below are invoked as `node <entry point>` rather than via `npx`.
# The runtime image intentionally ships no node_modules/.bin symlinks (only the
# specific package directories each needs), and `npx` falls back to fetching
# from the registry when it cannot resolve a command locally — silent on a
# machine with internet access, a hang or a confusing failure on a locked-down
# on-prem host with none. Direct invocation has exactly one resolution path.

echo "→ Preparing database…"

if [ -d "./prisma/migrations" ] && [ -n "$(ls -A ./prisma/migrations 2>/dev/null)" ]; then
  node ./node_modules/prisma/build/index.js migrate deploy
else
  echo "  No migrations found — syncing schema directly."
  node ./node_modules/prisma/build/index.js db push --skip-generate --accept-data-loss
fi

# Optional demo seed. Off by default: on a fresh deployment the first account to
# register is made an administrator, which is the cleaner path for a real org.
# Set SEED_ON_START=true to populate the demo dataset, including the generated
# thumbnails, lesson videos, and resource PDFs in demo-assets/.
if [ "${SEED_ON_START:-false}" = "true" ]; then
  if [ -f "./node_modules/tsx/dist/cli.mjs" ]; then
    echo "→ Seeding demo data…"
    node ./node_modules/tsx/dist/cli.mjs prisma/seed.ts
  else
    echo "  SEED_ON_START is true, but tsx is not present in this image — skipping."
    echo "  This image was likely built from a Dockerfile that no longer copies"
    echo "  node_modules/tsx into the runtime stage; see Dockerfile for the COPY line."
  fi
fi

echo "→ Starting Lumina LMS on port ${PORT:-4400}"
exec "$@"

#!/usr/bin/env sh
set -eu

mkdir -p "/app/data" "/app/storage/uploads"

bun run prisma:deploy
exec bun run start

FROM oven/bun:1

WORKDIR /app

ENV DATABASE_URL="file:/app/data/app.db"

COPY package.json bun.lock tsconfig.json prisma.config.ts ./
COPY prisma ./prisma

RUN bun install --frozen-lockfile
RUN bun run prisma:generate

COPY src ./src
COPY .env.example ./.env.example
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
  && mkdir -p /app/data /app/storage/uploads

EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

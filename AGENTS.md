# Repository Guidelines

## Project Structure & Module Organization

`src/` contains application code. `src/index.ts` is the HTTP entrypoint, and `src/lib/prisma.ts` owns Prisma client setup. `prisma/` contains database configuration, including `schema.prisma` and future migrations. `generated/prisma/` is generated output from Prisma Client and must not be edited manually. Root-level config lives in `package.json`, `tsconfig.json`, and `prisma.config.ts`.

## Build, Test, and Development Commands

- `bun install`: install dependencies.
- `bun run dev`: regenerate Prisma Client, then start the Elysia server in watch mode.
- `bun run prisma:generate`: regenerate the client after changing `prisma/schema.prisma`.
- `bun run prisma:migrate --name init`: create and apply a local migration.
- `bun run prisma:studio`: inspect local SQLite data.
- `bun test`: preferred test command once tests are added. The current `npm test` script is a placeholder and should not be relied on.

## Coding Style & Naming Conventions

Use TypeScript with strict typing and Bun-compatible ESM imports. Follow the existing style: 2-space indentation, semicolons, and double quotes. Keep modules focused; route setup belongs in `src/`, database access stays behind the Prisma client wrapper. Use `camelCase` for variables/functions, `PascalCase` for types/classes, and clear file names such as `certificate-service.ts` or `auth-routes.ts`.

## Testing Guidelines

There is no committed test suite yet. When adding tests, place them under `src/` as `*.test.ts` or in a top-level `tests/` directory if integration coverage grows. Prefer covering route behavior, Prisma queries, and failure paths such as missing `DATABASE_URL`. Include the exact command used to validate your change in the PR.

## Commit & Pull Request Guidelines

Current history is minimal (`Initial commit (via bun create)`), so keep commit messages short, imperative, and specific, for example `Add certificate model` or `Wire Prisma health check`. PRs should include a concise summary, note any schema or environment changes, and list validation steps such as `bun run prisma:generate` and `bun run dev`.

## Security & Configuration Tips

Keep secrets in `.env`; commit only `.env.example`. Do not commit SQLite database files or generated client artifacts. If you change the Prisma schema, regenerate the client before pushing.

# ReelPilot

Turn your app into scroll-stopping video ads in minutes.

- **Build plan (source of truth):** [docs/build-plan.md](docs/build-plan.md)
- **Decisions log:** [docs/decisions.md](docs/decisions.md)

## Getting started

```bash
cp .env.example .env         # fill in values
npm install                  # also generates the Prisma client
npm run db:deploy            # apply migrations
npm run dev
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint, including slice-boundary rules |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Vitest tests (database tests run only when `.env` exists) |
| `npm run db:migrate -- --name <name>` | Create and apply a migration, then regenerate the Prisma client |
| `npm run db:deploy` | Apply existing migrations |
| `npm run db:studio` | Browse the database |
| `npm run test:e2e` | Playwright e2e (first run: `npx playwright install chromium`). Signed-in tests create a throwaway user and session in the database from `.env` and delete it afterwards; they skip when there's no `.env` (CI) |
| `npm run format` | Prettier |

## Structure

Organized by feature (vertical slices), not by layer — see build plan §5–6.

```
src/
├── app/        # thin routes only
├── features/   # one folder per slice; import only via its index.ts
└── shared/     # feature-agnostic: ui, config, db, lib, styles
prisma/         # schema.prisma + migrations
```

Add shadcn components with `npx shadcn@latest add <name>` — they land in `src/shared/ui`.

## Database migrations

`db:migrate` needs an interactive terminal when Prisma shows a warning (for example, adding a unique constraint). From a non-interactive shell, generate and apply the SQL instead:

```bash
dir=prisma/migrations/$(date -u +%Y%m%d%H%M%S)_<name> && mkdir -p "$dir"
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script > "$dir/migration.sql"
# review migration.sql, then:
npx prisma migrate deploy && npx prisma generate
```

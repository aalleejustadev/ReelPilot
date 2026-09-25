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
| `npm test` | Vitest unit tests; database tests run when `DATABASE_URL` is set |
| `npm run test:watch` | Vitest in watch mode |
| `npm run db:migrate -- --name <name>` | Create and apply a migration, then regenerate the Prisma client |
| `npm run db:deploy` | Apply existing migrations |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:studio` | Browse the database |
| `npm run test:e2e` | Playwright e2e on desktop and 375px mobile (first run: `npx playwright install chromium`) |
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

Add shadcn components with `npx shadcn@latest add <name>` — they land in `src/shared/ui` (style `base-vega`). Follow the design rules in build plan §12, including the spacing table in §12.5.

## Testing

- **Unit and integration** (`npm test`): services, schemas, actions and the real magic-link flow. Tests that need a database run against `DATABASE_URL`.
- **End to end** (`npm run test:e2e`): pages, signed-in flows, accessibility (axe, WCAG 2.2 A/AA) and keyboard use. Signed-in tests create a throwaway user and session and delete them afterwards; they skip when `DATABASE_URL_UNPOOLED` isn't set.
- **CI** (GitHub Actions): lint, types, formatting, unit, build and e2e on every push, against a fresh `postgres:17` service container with all migrations applied.

## Database migrations

`db:migrate` needs an interactive terminal when Prisma shows a warning (for example, adding a unique constraint). From a non-interactive shell, generate and apply the SQL instead:

```bash
dir=prisma/migrations/$(date -u +%Y%m%d%H%M%S)_<name> && mkdir -p "$dir"
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script > "$dir/migration.sql"
# review migration.sql, then:
npx prisma migrate deploy && npx prisma generate
```

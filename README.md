# ReelPilot

Turn your app into scroll-stopping video ads in minutes.

- **Build plan (source of truth):** [docs/build-plan.md](docs/build-plan.md)
- **Decisions log:** [docs/decisions.md](docs/decisions.md)

## Getting started

```bash
cp .env.example .env         # fill in the non-Neon values
npm i -g neon && neon login  # Neon CLI, once per machine
neon link --project-id <id> --no-env-pull -y
neon checkout dev            # your dev branch; `--create` makes a new one
                             # (applies neon.ts: the private `media` bucket)
                             # and writes DATABASE_URL*, AWS_* into .env
npm install                  # also generates the Prisma client
npm run db:deploy            # apply migrations
npx prisma db seed           # stock presenters (first run downloads the voice model, ~90 MB)
npm run dev                  # app + background worker
```

Once per Neon branch, let browsers upload to the bucket: `npm run storage:cors`.

Development runs on the Neon `dev` branch; `production` is left alone until deployment (after M12). Files live in the `media` bucket declared in `neon.ts`; change it there and run `neon deploy`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server and job worker together (worker restarts on change); footage processing and exports need the worker |
| `npm run dev:web` | Dev server only (queued jobs wait until a worker runs) |
| `npm run worker` | Start the job worker alone (pg-boss queue; ffmpeg is bundled) |
| `npm run build` | Production build |
| `npm run lint` | ESLint, including slice-boundary rules |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Vitest unit tests; database tests run when `DATABASE_URL` is set, the live storage test when `NEON_BRANCH` is set |
| `npm run test:watch` | Vitest in watch mode |
| `npm run db:migrate -- --name <name>` | Create and apply a migration, then regenerate the Prisma client |
| `npm run db:deploy` | Apply existing migrations |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:studio` | Browse the database |
| `npm run test:e2e` | Playwright e2e on desktop and 375px mobile (first run: `npx playwright install chromium`) |
| `npm run format` | Prettier |
| `npm run storage:cors` | Set the bucket's CORS so browsers can upload (once per branch; `-- --create-bucket` for a local S3 server) |

## Structure

Organized by feature (vertical slices), not by layer — see build plan §5–6.

```
src/
├── app/        # thin routes only
├── features/   # one folder per slice; import only via its index.ts
└── shared/     # feature-agnostic: ui, config, db, ai, storage, lib, styles
prisma/         # schema.prisma + migrations
```

Add shadcn components with `npx shadcn@latest add <name>` — they land in `src/shared/ui` (style `base-vega`). Follow the design rules in build plan §12, including the spacing table in §12.5.

## Testing

- **Unit and integration** (`npm test`): services, schemas, actions and the real magic-link flow. Tests that need a database run against `DATABASE_URL`.
- **End to end** (`npm run test:e2e`): pages, signed-in flows, accessibility (axe, WCAG 2.2 A/AA) and keyboard use. Signed-in tests create a throwaway user and session and delete them afterwards; they skip when `DATABASE_URL_UNPOOLED` isn't set.
- **Background jobs**: `npm run worker` runs pg-boss jobs (footage processing with bundled ffmpeg). Playwright starts it alongside the app for e2e.
- **CI** (GitHub Actions): lint, types, formatting, unit, build and e2e on every push, against a fresh `postgres:17` service container with all migrations applied and a SeaweedFS S3 server (`.github/s3-ci.json`, dummy credentials) for storage, processing and upload tests.

## Database migrations

`db:migrate` needs an interactive terminal when Prisma shows a warning (for example, adding a unique constraint). From a non-interactive shell, generate and apply the SQL instead:

```bash
dir=prisma/migrations/$(date -u +%Y%m%d%H%M%S)_<name> && mkdir -p "$dir"
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script > "$dir/migration.sql"
# review migration.sql, then:
npx prisma migrate deploy && npx prisma generate
```

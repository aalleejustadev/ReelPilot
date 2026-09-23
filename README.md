# ReelPilot

Turn your app into scroll-stopping video ads in minutes.

- **Build plan (source of truth):** [docs/build-plan.md](docs/build-plan.md)
- **Decisions log:** [docs/decisions.md](docs/decisions.md)

## Getting started

```bash
cp .env.example .env.local   # fill in values
npm install
npm run dev
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint, including slice-boundary rules |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright e2e (first run: `npx playwright install chromium`) |
| `npm run format` | Prettier |

## Structure

Organized by feature (vertical slices), not by layer — see build plan §5–6.

```
src/
├── app/        # thin routes only
├── features/   # one folder per slice; import only via its index.ts
└── shared/     # feature-agnostic: ui, config, db, lib, styles
```

Add shadcn components with `npx shadcn@latest add <name>` — they land in `src/shared/ui`.

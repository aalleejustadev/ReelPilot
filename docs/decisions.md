# Decisions log

One line per decision: `YYYY-MM-DD — decision — reason`.

- 2026-09-23 — Source lives under `src/` (app, features, shared) per build plan §6 — keeps routes thin and slices self-contained.
- 2026-09-23 — shadcn/ui components install into `src/shared/ui` — design system components live in one place (§12.5).
- 2026-09-23 — Slice boundaries enforced with ESLint `no-restricted-imports` rather than `eslint-plugin-boundaries` — no extra dependency; covers the §5.3 rules for `@/` imports.
- 2026-09-23 — Removed `next-themes` and dark-mode toggle — dark mode is `[V1.1]` (§12.2).
- 2026-09-23 — Pinned ESLint to v9 — `eslint-plugin-react` (bundled by `eslint-config-next` 16.3) crashes on ESLint 10.
- 2026-09-23 — M0 ships personal workspaces only; no team invites, role changes or member removal yet — owner decision; the roles model stays so invites can be added later.
- 2026-09-23 — Packages are installed in the part of M0 that first uses them (Prisma in B, Better Auth in D), not up front — no unused dependencies.
- 2026-09-23 — Neon uses two URLs: `DATABASE_URL` (pooled, app) and `DATABASE_URL_UNPOOLED` (direct, Prisma migrations) — PgBouncer transaction mode breaks migrations (neon-postgres skill).
- 2026-09-23 — Added `INTERNAL` to the AppError codes — server actions need a safe code for unexpected errors so they never throw to the client (§13).
- 2026-09-23 — Env rules live in `env-schema.ts` (pure, testable); `env.ts` is server-only and validates on first import — tests run without real secrets.
- 2026-09-23 — Added `EMAIL_FROM` env var — Resend needs a verified sender for magic link emails.
- 2026-09-23 — Playwright runs against a production build on port 3100, in desktop and 375px mobile projects — matches the Definition of Done's responsive requirement.
- 2026-09-23 — File storage on Neon Object Storage instead of Cloudflare R2 — one provider and one credential; buckets branch with the database. Project region aws-us-east-2 supports it.
- 2026-09-23 — Voice is self-hosted Kokoro (Apache-2.0, `kokoro-js`, runs on CPU in the worker) — no API key or per-ad cost. Trade-off: stock voices only; founder voice cloning moves to V1.1.
- 2026-09-23 — Lip-synced avatars and founder avatars move to V1.1; V1 ads use a presenter still + voiceover — removes the avatar provider from V1. `founderAvatar` dropped from plans.ts until then.
- 2026-09-23 — Background jobs run in our own worker with pg-boss (queue in Neon Postgres), and Remotion renders in the same Docker image — replaces Trigger.dev/Inngest and Remotion Lambda/AWS. Neon Functions ruled out: the neon-functions skill says they're request/response only, not a job runner.
- 2026-09-23 — Rate limiting uses a Postgres table, not Upstash Redis — 3 trials/IP/day doesn't need Redis.
- 2026-09-23 — AI text stays on a direct provider (Anthropic, `ANTHROPIC_API_KEY`) through the Vercel AI SDK; Neon AI Gateway not used because it needs a paid Neon plan.
- 2026-09-23 — Prisma pinned to 7.10.0 (CLI and client) — `npm install prisma` resolved to an 8.0 release candidate; the plan specifies Prisma 7 and the CLI must match the client.
- 2026-09-23 — `prisma.config.ts` points migrations at `DATABASE_URL_UNPOOLED`; the app uses the pooled `DATABASE_URL` through `@prisma/adapter-pg` — Neon: PgBouncer breaks migrations. Read via `process.env` so `prisma generate` works in CI without a database.
- 2026-09-23 — The app creates its own `pg.Pool` (max 5) and registers it with `attachDatabasePool` from `@vercel/functions` — neon-postgres skill guidance for Vercel Fluid compute.
- 2026-09-23 — Generated Prisma client lives in `src/shared/db/generated` (gitignored, built by `postinstall`); import it only through `@/shared/db`.
- 2026-09-23 — Better Auth's four core tables were written by hand in Part B; `npx auth@latest generate` must confirm them in Part D — the CLI needs the auth config, which doesn't exist yet.
- 2026-09-23 — Tables use lowercase plural names via `@@map`; columns keep Better Auth's camelCase names.
- 2026-09-23 — Migrated on the Neon main branch (no real data yet); switch development to a `dev` branch at M2, when the Neon CLI is installed.
- 2026-09-23 — Database tests run against the real database when `.env` exists and skip otherwise (CI).

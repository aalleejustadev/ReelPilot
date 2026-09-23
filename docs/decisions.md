# Decisions log

One line per decision: `YYYY-MM-DD — decision — reason`.

- 2026-09-23 — Source lives under `src/` (app, features, shared) per build plan §6 — keeps routes thin and slices self-contained.
- 2026-09-23 — shadcn/ui components install into `src/shared/ui` — design system components live in one place (§12.5).
- 2026-09-23 — Slice boundaries enforced with ESLint `no-restricted-imports` rather than `eslint-plugin-boundaries` — no extra dependency; covers the §5.3 rules for `@/` imports.
- 2026-09-23 — Removed `next-themes` and dark-mode toggle — dark mode is `[V1.1]` (§12.2).
- 2026-09-23 — Pinned ESLint to v9 — `eslint-plugin-react` (bundled by `eslint-config-next` 16.3) crashes on ESLint 10.

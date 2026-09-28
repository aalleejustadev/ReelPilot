# ReelPilot — Product & Build Plan

> **Working name:** ReelPilot (placeholder — check domain and trademark before launch).
> **One-liner:** A browser video editor for product videos: record or upload your app, let the AI make the first cut, refine it in a real editor, then export an MP4 or share a link.
> **Audience:** SaaS and app founders (solo and small teams) who need launch videos, feature demos, walkthroughs and social ads of their product.
> **Status:** In build (M0–M4 done). This document is the single source of truth for the build agent.
> **Direction change (owner, 2026-09-28):** ReelPilot is now a **video editor**, not a UGC ad platform. Campaigns, scripts, compliance, presenter-led ads, credits/billing, admin and audio are out of V1; everything is kept as minimal as possible. Sections below reflect the new direction; the completion records in §14 are history.

Markers used in this doc:
- `TODO(owner)` — a decision or value the owner (Ali) still needs to set or confirm.
- `✏️ Owner notes` — blank space reserved for the owner to refine later.
- `[V1]`, `[V1.1]`, `[V2]` — which release a feature belongs to.

---

## 0. Instructions for the build agent

1. Read this whole document before writing code.
2. Build **only `[V1]`** unless the owner explicitly says otherwise. Do not scaffold V1.1 or V2 features "for later" — no dead code, no empty pages.
3. Build in **vertical slices** (Section 5). Finish one slice end to end (DB → server → UI → tests) before starting the next, following the order in Section 14.
4. Every slice must meet the Definition of Done (Section 14.1) before moving on.
5. When a decision is ambiguous, pick the simplest option that fits this doc, write it down in `docs/decisions.md` (one line: date, decision, reason), and continue.
6. Never hardcode secrets, limits, or provider names in feature code. Per-plan limits live in `src/shared/config/plans.ts`; providers live behind adapters (Section 10).
7. Follow the design system (Section 12) and code style guide (Section 13) exactly. If a component you need isn't in the design system, add it to `src/shared/ui` first, then use it.

---

## 1. Product summary

### 1.1 The problem
Founders need polished product videos all the time — launches, feature announcements, walkthroughs, social clips. Screen recorders capture the raw footage, but turning it into something that looks directed (camera moves, cuts, text, motion graphics, pacing) takes a video editor's skills and hours in heavyweight desktop tools.

### 1.2 What ReelPilot does
| Pain | ReelPilot's answer |
|---|---|
| Raw screen recordings look flat | A 3D stage with a camera that moves to what matters, plus cuts, speed, transitions, text, graphics and lens effects (the motion studio, §7.4b) |
| Editing takes skill and time | AI analyses the footage and directs a first cut; templates give a finished style in one click |
| Desktop editors are heavy | Everything runs in the browser, projects save as you go |
| Getting the video out | Export an MP4 in every shape (16:9, 9:16, 1:1, 4:5) or share a link anyone can watch |
| "Show me before I sign up" | Try-it: paste your site's URL, get an edited video of it |

### 1.3 Core user journey (V1)
1. Visitor pastes their app URL on the landing page → we record a short tour of the site and hand back an edited, watermarked preview (no account).
2. Signs up (Google / GitHub / email) and creates a **brand kit** (colours, fonts, logo — drafted from the site).
3. Adds **footage**: records their app or uploads recordings; the analysis finds key moments.
4. Starts a **video** and records or uploads straight into it (or picks clips it already has). A one-clip video opens right in the editor; "Add clip" joins more, one after another. A **template** or the AI makes the first cut; the owner refines it.
5. **Exports** an MP4 or **shares** a public link.

---

## 2. Pricing

**Not in V1 (owner, 2026-09-28): no billing, credits or paid plans.** `src/shared/config/plans.ts` stays as the one place for per-plan limits (footage caps, brand kits); every workspace is on Free until pricing is decided. `TODO(owner)`: pricing model when billing returns (export minutes, resolution and AI actions were the suggested levers).

---

## 3. Scope

### 3.1 `[V1]` — the video editor
- Auth (Google, GitHub, magic link) and one personal workspace per user. ✅
- **Brand kits:** colours, fonts, logo, drafted from a URL. ✅
- **Footage:** upload or in-browser recording, key moments, smart analysis. ✅
- **Motion studio:** camera, cuts/speed/transitions, text, motion graphics, layouts, lens, AI director, full-screen preview. ✅
- **Videos** (projects in code): one or more clips in order, joined by transitions; one-clip videos open straight in the editor; versioned saves. ✅ (M4)
- **Export & share:** MP4 in each shape; a public share link anyone can watch, revocable. (M5)
- **Templates & AI first cut.** (M6)
- **Try-it:** URL → recorded site tour → edited preview → sign-up. (M7)
- **Launch polish:** landing, legal pages, SEO, error/empty states, deploy. (M8)

Presenters (M3: stock portraits + Kokoro voices) were removed on 2026-09-28 (owner: not needed).

### 3.2 Later (not scheduled)
Audio (voiceover, music, sound effects, auto captions), recorder upgrades (microphone, webcam bubble, click tracking via a Chrome extension), billing and plans, admin, team invites, avatars and lip-sync, variants, localisation, ad-account publishing. Don't scaffold any of these.

✏️ Owner notes (scope):
>
>

---

## 4. Tech stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16** (App Router, Server Components, Server Actions), React 19, TypeScript strict | |
| Database | **PostgreSQL on Neon** + **Prisma 7** | |
| Auth | **Better Auth** | Google, GitHub, magic link; organization/workspace support |
| Styling | **Tailwind CSS** + **shadcn/ui** primitives, restyled to the ReelPilot design system | Tokens in Section 12 |
| AI text | **Vercel AI SDK** with a provider registry | Model-agnostic; no vendor lock-in |
| Background jobs | **pg-boss** (job queue stored in Neon Postgres), run by our own worker in `src/worker` | No extra service; code against the `src/shared/jobs` wrapper. Worker connects via `DATABASE_URL_UNPOOLED` |
| Video composition | **Remotion** (compositions in `src/remotion`): `FootageStage` (one clip) and `ProjectStage` (a project); the editor previews them in `@remotion/player` | `TODO(owner)`: review Remotion's license terms for commercial use |
| Render infra | Remotion renderer run by the worker (`src/shared/render`): each render in its own Node process, Chrome Headless Shell + Remotion's ffmpeg; the render bundle is `src/remotion/index.ts` with the kit fonts self-hosted from Fontsource | Worker host (owner, 2026-09-28): local for now; a Hostinger VPS (Docker) at launch, the app stays on Hostinger Node.js |
| Storage | **Neon Object Storage** (S3-compatible, branches with the database) via the Files SDK `neon` adapter | Signed URLs only; credentials come from `neon env pull` |
| Email | Resend + React Email | |
| Rate limiting | Postgres (Neon) table in `src/shared/rate-limit`; Better Auth's database rate-limit storage | No Redis service |
| Validation | Zod | All inputs at the boundary |
| Testing | Vitest (unit), Playwright (e2e) | |
| Observability | Sentry + structured logs | |
| Hosting | **Hostinger** (Node.js) | Deployment after M8 (launch polish); until then, development only |

---

## 5. Architecture: vertical slices

### 5.1 Principles
- The app is organized **by feature, not by layer**. Each feature folder owns everything it needs: UI, server actions, queries, validation schemas, jobs, and tests.
- `src/app` contains **thin routes only**: they read params, check auth, and render components from features.
- A feature exposes a **public API** through its `index.ts`. Other features may import only from that file — never from another feature's internals.
- Shared, feature-agnostic code lives in `src/shared` (UI kit, db client, auth helpers, provider adapters, config).
- Business rules live in `service.ts` (pure where possible, easy to unit-test). Server actions are thin: validate → authorize → call service → revalidate. Reference implementation: `src/features/workspaces/actions.ts` (`renameWorkspace`).
- A slice may also expose a browser-safe `client.ts` for other slices' client components (its `index.ts` can export server-only queries, which must never reach a browser bundle). Lint enforces both entries.

### 5.2 Slice anatomy
```
src/features/<feature>/
├── components/        # React components (server + client) for this feature only
├── actions.ts         # "use server" actions — thin, validated, authorized
├── queries.ts         # read functions (server only), cached where sensible
├── service.ts         # business logic, pure where possible
├── schema.ts          # Zod schemas + inferred types
├── jobs/              # background tasks owned by this feature
├── lib/               # helpers private to this feature
├── __tests__/         # unit tests for service + schema
└── index.ts           # public API — the only import surface for other features
```

### 5.3 Dependency rules
- `app/*` → may import `features/*` (via `index.ts`) and `shared/*`.
- `features/A` → may import `features/B/index.ts` and `shared/*`. No cycles.
- `shared/*` → must not import from `features/*`.
- Enforce with an ESLint rule (`eslint-plugin-boundaries` or `no-restricted-imports`).
- A feature's `index.ts` may export server-only code, so **client components must not import another feature's index**. When a client component needs another feature's component, a server component renders it and passes it in as a prop or slot (e.g. the app layout passes `<SignOutMenuItem />` to the sidebar).

---

## 6. Folder structure

```
reelpilot/
├── docs/
│   ├── decisions.md              # one-line architecture decisions log
│   └── build-plan.md             # this file
├── prisma/
│   └── schema.prisma
├── public/
├── src/
│   ├── app/
│   │   ├── (marketing)/
│   │   │   ├── page.tsx                  # landing + try-it input
│   │   │   ├── try/[trialId]/page.tsx    # anonymous try-it result (M7)
│   │   │   └── legal/{terms,privacy}/page.tsx
│   │   ├── (auth)/
│   │   │   ├── sign-in/page.tsx
│   │   │   └── sign-up/page.tsx
│   │   ├── (app)/                    # app shell: sidebar, top bar
│   │   │   ├── dashboard/page.tsx        # recent videos
│   │   │   ├── videos/page.tsx           # M4
│   │   │   ├── footage/page.tsx          # every clip; record/upload from here
│   │   │   ├── brand-kits/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [kitId]/{page,footage/page}.tsx
│   │   │   └── settings/{profile,workspace}/page.tsx
│   │   ├── (editor)/                 # full-screen editors, no sidebar
│   │   │   ├── brand-kits/[kitId]/footage/[footageId]/page.tsx   # clip editor
│   │   │   └── videos/[videoId]/page.tsx                         # a video's clips (M4)
│   │   ├── v/[token]/page.tsx        # public share link (M5)
│   │   └── api/auth/[...all]/route.ts    # Better Auth
│   ├── features/
│   │   ├── auth/             # session helpers, guards
│   │   ├── workspaces/       # workspaces, roles
│   │   ├── brand-kits/       # extraction, visual identity
│   │   ├── footage/          # upload, recording, analysis, the clip editor (motion studio)
│   │   ├── projects/         # videos: clips joined into one (M4; "videos" in the UI)
│   │   ├── exports/          # MP4 export jobs and share links (M5)
│   │   └── try-it/           # anonymous URL → recorded tour → preview (M7)
│   ├── worker/               # our own job worker: pg-boss + ffmpeg + Remotion (own Dockerfile)
│   ├── remotion/
│   │   ├── compositions/     # FootageStage (a clip), ProjectStage (a project)
│   │   └── components/       # player footage, text, graphics, layouts
│   └── shared/
│       ├── ui/               # design system components (Section 12)
│       ├── config/
│       │   ├── plans.ts      # per-plan limits — single source of truth
│       │   ├── site.ts       # name, URLs, copy constants
│       │   └── env.ts        # typed, validated env vars
│       ├── db/               # Prisma client
│       ├── ai/               # AI SDK provider registry
│       ├── jobs/             # job client wrapper
│       ├── storage/          # signed URL helpers
│       ├── rate-limit/
│       ├── lib/              # result type, errors, formatting, ids
│       └── styles/
│           └── globals.css   # tokens as CSS variables
├── tests/e2e/                # Playwright
├── .env.example
└── package.json
```

---

## 7. Slice catalog `[V1]`

Each slice lists purpose, routes, key actions/jobs, and acceptance criteria.

### 7.1 try-it (M7)
- **Purpose:** An anonymous visitor sees their own site as an edited video before signing up.
- **Flow:** validate the URL → the worker records a ~30s tour of the public page in headless Chrome (scroll through its sections, as the Stripe and Apple demos were made) → processing + analysis → AI first cut with a template → a watermarked share page.
- **Guards:** public pages only (no logins, no form filling); rate limit per visitor (Postgres rate-limit table); trials expire after 7 days; on sign-up the trial becomes the user's first brand kit and project.
- **Acceptance:** A valid URL produces a playable edited preview; invalid or blocked URLs show a clear error; the rate limit holds.

### 7.2 auth + workspaces
- **Purpose:** Sign-in, and a personal workspace created on first use with the user as owner. Team invites are `[V1.1]`.
- **Roles:** owner (billing + everything), editor (create/edit/render), viewer (view/comment). Enforced by `can(role, action)` in `features/workspaces/lib/permissions.ts`; every page and action starts with `requireWorkspaceAccess(action)`.
- **Acceptance:** Google, GitHub, magic link work; exactly one personal workspace per user, even under concurrent first requests; the role is checked on every action. (V1.1: invite email → accept → role enforced.)

### 7.3 brand-kits
- **Purpose:** Everything the AI needs to know about the product.
- **Fields:** name, URL, one-line description, audience, key features (list), pricing summary, **allowed claims** (list, each optionally with a source link), banned words, logo, colors (colour picker), fonts (heading + body, from the 15 ad fonts in `src/shared/config/ad-fonts.ts`, with previews), tone.
- **Actions:** `createKitFromUrl`, `updateKit`, `refreshFromSite` `[V1.1]`.
- **Acceptance:** Extraction pre-fills all fields; user can edit and save; plan limit on number of kits enforced.

### 7.4 footage
- **Purpose:** Real product footage for ads.
- **Input:** file upload (mp4/mov/webm, size cap by plan) or in-browser screen recording (MediaRecorder + Screen Capture API) with a guided prompt.
- **Processing job:** transcode to normalized mp4 (audio removed; ads get a voiceover), generate thumbnails, detect key moments (scene changes for uploads and recordings, plus moments the user marks while recording), store markers.
- **Recording key moments (owner decision 2026-09-25):** a browser can't see clicks in other tabs or apps, so recordings use scene detection plus a floating "Mark moment" button (Document Picture-in-Picture, Chrome/Edge; others get scene detection only). No microphone.
- **Where it lives:** a Footage tab on each brand kit (`/brand-kits/[kitId]/footage`), clip page `/brand-kits/[kitId]/footage/[footageId]`.
- **Acceptance:** Upload and recording both produce a playable clip with thumbnails and at least auto-detected markers; users can add/remove markers.

### 7.4a footage motion `[V1, owner-added 2026-09-25]`
- **Purpose:** Present screen footage like a product intro: the recording sits on a styled background and the camera tilts, turns, zooms and glides between the moments the owner marked.
- **Shots on markers:** any marker can carry a camera shot (tilt, turn, roll, zoom, focus point) and a transition (duration, easing). From that moment the camera moves into the shot; markers without one keep the previous shot. Presets: Flat, Tilt left, Tilt right, Low angle, Top down, Push in, Dramatic.
- **Clip presentation:** background (brand colours, gradient), frame (corner radius, shadow), intro (none, fly in from left/right, rise up, zoom out).
- **Controls:** a right-hand inspector on the clip page (selected marker's shot, or the clip's presentation), a live 3D preview in 16:9, 9:16 or 1:1, click the video to set the focus point.
- **AI direction:** the owner describes the motion in words; the AI proposes shots for every marker and the intro, which the owner can then adjust. Rate-limited.
- **One source of truth:** camera math in `src/shared/motion` (pure), used by the browser preview now and the Remotion compositions in M5, so renders match the preview.
- **Acceptance:** shots can be set per marker by preset, sliders or AI; the preview animates between them over the clip's background; settings persist; reduced-motion users get a non-animated preview.

### 7.4b motion studio `[V1, owner-added 2026-09-27]`
- **Purpose:** Turn the footage editor into a professional motion studio (researched against Screen Studio, Cap, Tella, FocuSee, CapCut, Rotato and Remotion libraries; notes in `docs/decisions.md`). Every option is tuned to look directed, never repetitive or cheap.
- **A. Smart analysis:** a worker job after processing maps where the screen changes (activity boxes per sample), idle and scrolling stretches, and the footage's palette; AI vision describes each key moment (what's on screen, a headline idea, on-screen words, the key element's box). The recorder also keeps the shared surface and, where the browser reports it (Captured Mouse Events), a cursor track. A web page can't see clicks in other tabs; a Chrome extension for clicks/element bounds is a later, separately approved step.
- **B. Engine:** the stage moves to a Remotion composition shown in `@remotion/player` (the same code M5 renders); spring camera with Focused / Smooth / Rapid temperaments, zoom time growing with depth, direct pans between nearby targets, velocity motion blur.
- **C. Camera looks as rules:** opener, a body pool with no repeats within two moments and flipping direction, a hero shot on the starred moment, a closer; "Zoom to action" from the analysis.
- **D. Cuts, speed and transitions:** split/trim, speed up idle parts; a short list of pro transitions (cut, pan, push/slide, whip, zoom-through, blur dissolve, mask wipe from the click point).
- **E. Text:** a text track, 8 animations (word rise, mask reveal, blur resolve, marker sweep, keyword swap, typewriter, number ticker, tracking-in), brand-font style presets; one animation style per video by default.
- **F. Motion graphics:** 12 presets (click ripple, spotlight dim, magnifier, callout with drawn arrow, scribble, key chip, stat card, lower third, logo reveal, end card, privacy blur, animated background) anchored to a moment's action box; "turn a moment into a graphic" by AI or tailored templates.
- **G. Editor:** multi-track timeline (camera, transitions, text, graphics) with drag/resize/snap, inspector per selection, live preset previews, on-stage placement, J/K/L and frame stepping.
- **H. AI director v2:** plans the whole edit from the analysis and brand kit, explained and undoable.
- **Acceptance:** each part ships with tests and axe checks; the preview is the composition M5 renders.

### 7.5 presenters (removed)
Stock presenters (a still portrait + a Kokoro voice) were built in M3 and removed on 2026-09-28: the page, slice, `presenters` table, seed, portraits and the Kokoro engine are gone.

### 7.14 videos — "projects" in code (M4 ✅)
- **Purpose:** A video: one or more of a brand kit's clips in order, each played with its own edit (the motion studio's presentation and camera shots), joined by transitions. Owner decision (2026-09-28): projects stay invisible — users only ever see **videos**.
- **Where:** Videos in the sidebar; the dashboard shows recent videos; `/videos` lists them (delete from a card); `/videos/[videoId]` is a video. A video belongs to one brand kit and uses its footage, fonts, colours and logo.
- **Flow:** "New video" (a name is optional: "Untitled video"; the brand kit) → an empty video offering **Record your screen**, **Upload video** and **Choose from footage**. A clip recorded or uploaded here joins the video at once and plays once processed (the page checks the clips' status every few seconds and refreshes once one changes).
- **One clip:** the video opens straight in the clip editor — titled with the video's name, back to Videos, with **Add clip** (which opens its clip list); "Delete clip" is hidden there (it would delete the video's recording).
- **Two or more clips:** `/videos/[videoId]` is the clip list: the whole video playing (`ProjectStage`, the composition M5 exports) with play/stop, a scrubber, full screen and shapes; a strip to record, upload or choose more, remove and reorder clips (buttons or drag), a transition on every join (cut, push, whip, zoom through, blur dissolve, circle reveal); "Edit clip" and back; rename and delete.
- **Versioned saves:** videos and clip edits carry a version; a save must name the version it started from, so a stale tab gets "changed somewhere else — reload" instead of overwriting newer work.
- **The Footage tab** on a brand kit stays the library: uploads there don't create videos.
- **Acceptance:** start a video, record or upload into it and edit it right away; add clips, reorder, set transitions, kept after a reload; it plays through its joins; delete from its card; a stale tab can't overwrite.

### 7.15 export & share (M5)
- **Export:** "Export" in the clip editor and the video editor opens *Export and share*: pick Landscape 16:9, Portrait 9:16 or Square 1:1 (the stage's shapes), "Export MP4" renders it at 1080p in the worker with the same composition the preview plays (a clip is rendered as a one-clip video), with progress, then "Download MP4" (named after the clip or video). Only the newest file per shape is kept; an edit since then shows "You've edited this since the last export" and offers "Export again" (a hash of what was rendered). A one-clip video's editor exports the video.
- **Share:** "Anyone with the link can watch" makes one link per clip or video (`/v/[token]`), which plays its newest finished export, signed out, not indexed; off, it 404s; on again, the same link returns.
- **Acceptance:** the export matches the preview; share links work signed out and stop working when turned off.

### 7.16 templates & AI first cut (M6)
- **Templates:** launch video, feature demo, social ad (9:16), walkthrough — each a preset of look, text style, lens, transitions, an intro slide and an end card.
- **AI first cut:** pick a template; the AI director (§7.4b H) edits every clip of the project in that style, as one undoable change.
- **Acceptance:** applying a template gives a finished-looking video; it can be undone.

### Dropped with the 2026-09-28 direction change
Campaigns and scripts (old 7.6), compliance (7.7), variant renders (7.8), the segment editor (7.9 — the footage editor is the editor), the ad library (7.10, replaced by projects + share), billing (7.11), admin (7.12) and notification emails (7.13).

---

## 8. Data model (Prisma sketch)

`prisma/schema.prisma` is the source of truth. Built: Better Auth's `User`/`Session`/`Account`/`Verification`/`RateLimit`, `Workspace`, `Membership` (M0); `BrandKit`, `AllowedClaim` (M1); `Footage`, `FootageMarker` (M2, with the motion studio's presentation, analysis and insight JSON); `Project`, `ProjectClip` (M4). Models of dropped slices (presenters, campaigns, scripts, variants, segments, renders, compliance, credits, review links, audit log, avatars) were removed from this sketch with the 2026-09-28 changes; M5's export and share models are defined when M5 is planned.

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  name          String?
  image         String?
  role          UserRole @default(USER)   // USER | ADMIN
  memberships   Membership[]
  createdAt     DateTime @default(now())
}

model Workspace {
  id             String   @id @default(cuid())
  name           String
  plan           Plan     @default(FREE)  // FREE | STARTER | GROWTH | AGENCY
  personalOwnerId String? @unique          // set on a user's personal workspace; cascades on user delete
  stripeCustomerId String?
  memberships    Membership[]
  brandKits      BrandKit[]
  createdAt      DateTime @default(now())
}

model Membership { id String @id @default(cuid()) userId String workspaceId String role MemberRole } // OWNER | EDITOR | VIEWER

model BrandKit {
  id String @id @default(cuid())
  workspaceId String
  name String
  url String
  description String
  audience String
  features Json          // string[]
  pricingSummary String?
  claims AllowedClaim[]
  bannedWords Json       // string[]
  logoUrl String?
  colors Json            // { primary, secondary, ... }
  fonts Json?
  tone String?
}

model AllowedClaim { id String @id @default(cuid()) brandKitId String text String sourceUrl String? }

model Footage {
  id String @id @default(cuid())
  brandKitId String
  storageKey String
  durationMs Int
  width Int
  height Int
  status FootageStatus    // UPLOADED | PROCESSING | READY | FAILED
  markers FootageMarker[]
}
model FootageMarker { id String @id @default(cuid()) footageId String atMs Int label String? source MarkerSource } // AUTO | MANUAL

model Project {           // M4
  id String @id @default(cuid())
  workspaceId String
  brandKitId String       // its footage, fonts, colours, logo
  name String
  version Int @default(0) // versioned saves
  clips ProjectClip[]
}
model ProjectClip { id String @id @default(cuid()) projectId String footageId String position Int transition Json }

```

---

## 9. Export pipeline notes (M5)

- Heavy work runs in background jobs (pg-boss in the worker); the page shows progress.
- One job per export: render `ProjectStage` (or `FootageStage` for one clip) with Remotion at 1080p in the chosen shape → store the MP4 → the page offers the download and the share link.
- The render path is frame-exact (a Sequence per part); the editor preview uses persistent videos for smooth playback. Both run the same compositions, so they match; M5 checks that on real renders. Fonts the editor loads through next/font must be available to the renderer.
- Retries: 3 attempts with backoff; then mark failed with a clear message.

---

## 10. Provider adapters

External AI providers sit behind the registry in `src/shared/ai`; feature code never imports a vendor SDK directly. In use: the Vercel AI SDK registry (text and vision). No voice, avatar or voice-cloning providers are planned.

---

## 11. Trust & safety

- **Private by default:** footage, projects and exports are private to the workspace, served through signed, short-lived URLs only; deletion on account close.
- **Share links** are unguessable tokens, can be turned off, and show only the exported video.
- **Try-it recording:** public pages only (no logins, no form filling, no crawling beyond the page), rate-limited, and trials expire.
- **Terms of Service** state that users are responsible for having the right to the footage they upload or record. `TODO(owner)`: legal review of Terms and Privacy before launch.

---

## 12. Design system

### 12.1 Direction: "the cutting room"
ReelPilot is an editing bay for ads, not a generic SaaS dashboard. The visual language borrows from film production: contact sheets, slates, timelines, a green-screen accent, and a red tally light for anything live or recording. Boldness is spent in one place — the **contact sheet** of 9:16 variant frames — and everything around it stays quiet.

✏️ Owner notes (direction):
>
>

### 12.2 Color tokens
`TODO(owner)`: tune after first screens. Define as CSS variables in `src/shared/styles/globals.css`, mapped into Tailwind.

| Token | Hex | Role |
|---|---|---|
| `--stage` | `#EEF0F3` | App background (cool studio gray) |
| `--surface` | `#FFFFFF` | Panels, editor inspector, dialogs |
| `--ink` | `#15171C` | Primary text, primary buttons |
| `--slate` | `#5B6170` | Secondary text, icons |
| `--frame` | `#D5D9E0` | Borders, dividers, timeline track |
| `--well` | `#E4E7EC` | Recessed fills one step below stage: tab tracks, hovers, skeletons (`muted`/`accent`) |
| `--chroma` | `#18B26B` | Accent: primary actions on dark, selection, "ready" states (green-screen green) |
| `--chroma-soft` | `#DDF5E9` | Selected rows, success backgrounds |
| `--tally` | `#E5484D` | Recording, the playhead, destructive actions |
| `--amber` | `#E8A23A` | Warnings |
| `--projector` | `#1B1D23` | Dark surfaces: video player, preview stage |

Dark mode `[V1.1]`: invert `stage`/`surface`/`ink`; keep `chroma` and `tally`.

Contrast rule: all text meets WCAG AA; `--chroma` is never used for body text on white.

### 12.3 Typography
| Role | Typeface | Notes |
|---|---|---|
| UI, body and headings | **Geist** (400/500/600) | Headings are semibold with tight tracking; no separate display face |
| Timecodes and counts | **Geist Mono** | Fixed-width digits and punctuation |

Tailwind's default type scale. Line length ≤ 72ch for prose. Sentence case everywhere; no all-caps labels.

### 12.4 Layout
- **App shell:** shadcn `Sidebar` (sidebar-07 pattern: collapses to icons, sheet on mobile) with the workspace name in the header, nav items, and the user menu in the footer; top bar with the sidebar toggle and page title; content on `--stage`. Nav shows only built pages (Dashboard, Videos, Footage, Brand kits, Settings) — add pages as they ship (`src/app/(app)/_components/nav-config.ts`, plus the `src/proxy.ts` matcher).
- **Editors** (clip editor, a video's clip list) are full screen without the sidebar: a top bar (back, name, save state, actions), the stage on `--projector`, a transport, and the timeline or clip strip below.
- **Landing:** left-aligned hero with the URL input (try-it); to the right, a player looping a real edited video; below, one before/after (raw screen recording → edited video).

```
Landing (desktop)
┌───────────────────────────────────────────────────────────┐
│ Logo                                             Sign in   │
│                                                           │
│  Your product, in videos that show it.   ┌────────────┐   │
│  Paste your URL. Get a video in minutes. │   player   │   │
│  [ https://yourapp.com   ][Make a video] │            │   │
│                                          └────────────┘   │
├───────────────────────────────────────────────────────────┤
│  raw screen recording  ──▶  edited video (before/after)   │
└───────────────────────────────────────────────────────────┘

A video's clips (two or more)
┌───────────────────────────────────────────────────────────┐
│ ← Videos   Launch video ✎            Saved   Delete video  │
│                      stage (player)                        │
│ ▶ ■ ───────●────────────────  0:12.4 / 0:28.0  ⛶ 16:9 9:16│
│ Clips  [1 Intro] Blur ▾ [2 Feature] Cut ▾ [3 Pricing]      │
│              [Record your screen] [Upload video] [Choose…] │
└───────────────────────────────────────────────────────────┘
```

### 12.5 Components (`src/shared/ui`)
Use **default shadcn components and variants** from the **`base-vega`** style (`components.json`), styled only through the theme tokens in 12.2. Every button shows a pointer cursor. Every button that starts async work shows a `Spinner` and is disabled until the work finishes; navigation that looks like a button uses `LinkButton` (`src/shared/ui/link-button.tsx`), which shows a spinner while the next page loads. For forms, show pending state with `useFormStatus` (server actions) or an `onSubmit` handler; never set local loading state inside a `<form action={fn}>` function, because React defers it until the action finishes. Inputs prefilled from server data (e.g. an edit form) are controlled (`value` + `onChange`), never `defaultValue`: revalidation changes the prop after mount, which Base UI rejects. Change a component's source only when it is mandatory (accessibility, a lint failure, a missing capability), and log the reason in `docs/decisions.md`.

Button (primary/ink, secondary/outline, ghost, danger/tally), Input, Textarea, Select, Tabs, Dialog, AlertDialog, ConflictDialog ("changed somewhere else"), Sheet, Toast, Tooltip, Badge, Slider, ToggleGroup, Empty, Spinner, Avatar.

Radius and shadows: shadcn defaults (`--radius: 0.625rem`).

**Spacing and sizing (apply everywhere):**
| Element | Rule |
|---|---|
| App page padding | `p-6 md:p-8` (24/32px); marketing header `h-16 px-6 md:px-8` |
| Between page sections | `gap-8` (32px); title block `gap-2` |
| Page title | `text-2xl md:text-3xl font-semibold tracking-tight`; description `text-muted-foreground` |
| Top bar | `h-16`, `px-6 md:px-8` (aligned with page content) |
| Cards | vega defaults (24px padding); actions in `CardFooter`, never bare in `CardContent` (it stretches children) |
| Forms | vega `FieldGroup`/`Field` spacing; input + button on one row use `gap-3` |
| Controls | App: default size (36px). Auth pages and marketing CTAs: `lg` (40px) |
| Button padding | Default `px-3`, `sm` `px-3`, `lg` `px-4` (set once in `button.tsx`; owner request) |
| Sidebar | Expanded: header/footer `p-3`, menu `gap-1.5`, nav items `h-9`. Collapsed: shadcn's `p-2` (`group-data-[collapsible=icon]:p-2`), so icons centre in the 48px rail |
| Content column | Centred: `mx-auto w-full max-w-5xl` in the app layout; settings `max-w-3xl`. Text stays left-aligned |
| Button groups | `gap-2`–`gap-3` |
| Page tabs | shadcn `Tabs` with `TabsTrigger render={<Link>}` (each tab has its URL; icon becomes a spinner while loading) |
| User menu | One `UserMenu` (`src/app/(app)/_components/user-menu.tsx`) used by the sidebar footer and the top-bar avatar; items share `userMenuItemClass` |

### 12.6 Motion
- One orchestrated moment on the landing page: the phone player cycling example ads.
- In-app motion only responds to actions: frame selection, render progress, segment reorder, dialog open.
- Respect `prefers-reduced-motion` everywhere.

### 12.7 Voice & copy
- Plain verbs, sentence case, no filler. A button says what happens: "Export MP4", then the toast says "Exporting your video."
- Name things by what users know: "videos," "clips," "footage" — not "variants payload" or "segment hash."
- Errors say what happened and what to do: "Your footage is longer than 10 minutes. Trim it or upload a shorter clip."
- Empty states invite action: "No videos yet. Start a video, then record or upload your app."

✏️ Owner notes (design system):
>
>

---

## 13. Code style guide

- TypeScript `strict: true`; no `any` (use `unknown` + Zod). No non-null assertions without a comment.
- **Naming:** files `kebab-case.ts`; components `PascalCase`; functions `camelCase` verbs (`createProject`, `saveProjectClips`); booleans `is/has/can`.
- **Server actions:** always `validate (Zod) → authorize (role + workspace) → service → revalidatePath/Tag`. Return a typed `Result<T, AppError>`; never throw to the client. Wrap the body in `try/catch`, call `unstable_rethrow(error)` first in the catch so Next's redirects still work, then return `err(toResultError(error))`. Pages and actions authorize with `requireWorkspaceAccess(action)` and scope every query by the returned `workspace.id`.
- **Errors:** `AppError` with `code` (`NOT_FOUND`, `FORBIDDEN`, `INSUFFICIENT_CREDITS`, `COMPLIANCE_BLOCKED`, `PROVIDER_FAILED`, `RATE_LIMITED`, `VALIDATION`) and a user-safe message.
- **Data access:** only in `queries.ts`/`service.ts`; every query is scoped by `workspaceId`.
- **Server vs client:** default to Server Components; add `"use client"` only for interactivity (editor, recorder, wizard steps).
- **Config over constants:** limits from `shared/config/plans.ts`.
- **Tests:** every `service.ts` has unit tests; each slice has at least one Playwright happy-path test.
- **Commits:** Conventional Commits (`feat(projects): join clips with transitions`).
- **Formatting/linting:** Prettier + ESLint with boundary rules; CI must pass before merge.

---

## 14. Build order & milestones `[V1]`

| # | Milestone | Slices | Outcome |
|---|---|---|---|
| M0 ✅ | Foundation | repo, env, db, auth, shared/ui tokens, app shell | Sign in, see empty dashboard with design system applied — **done 2026-09-25** (see 14.2) |
| M1 ✅ | Brand kit | brand-kits (+ URL extraction), Neon Object Storage + `shared/storage` (logo uploads) | Create and edit a kit from a URL, upload a logo — **done 2026-09-25** (see 14.3) |
| M2 ✅ | Footage | footage (reuses M1 storage), job worker (pg-boss + ffmpeg) | Upload/record footage with markers — **done 2026-09-25** (see 14.4) |
| M3 ✅ | Presenters | presenters (stock), Kokoro voice (`VoiceProvider`) | Choose a stock presenter and hear its voice — **done 2026-09-25** (see 14.5); removed 2026-09-28 |
| M3b ✅ | Footage motion (owner-added) | footage motion (§7.4a), `shared/motion` | 3D camera shots on markers, backgrounds, AI direction, live preview — **done 2026-09-25** (see 14.6) |
| M3c ✅ | Motion studio (owner-added) | footage analysis, Remotion player, camera rules, transitions, text, motion graphics, editor, AI director (§7.4b) | Professional motion editing in parts A–I — **done 2026-09-27** (see 14.7) |
| M4 ✅ | Videos | projects in code (§7.14), versioned saves, dashboard | Record or upload into a video and edit it; clips joined with transitions; stale tabs can't overwrite — **done 2026-09-28** (see 14.8) |
| M5 ✅ | Export & share | export jobs (Remotion renderer in the worker), share links (§7.15) | Download an MP4 in any shape; share a public link — **done 2026-09-28** (see 14.9) |
| M6 | Templates | templates + AI first cut (§7.16) | One click from clips to a finished-looking video |
| M7 | Try-it | try-it (§7.1) | Anonymous URL → recorded tour → edited preview → sign-up |
| M8 | Launch polish | landing, legal, SEO, error/empty states, e2e sweep, deploy (Hostinger) | Public launch |

### 14.1 Definition of Done (every slice)
- [ ] Prisma models + migration
- [ ] Zod schemas for all inputs
- [ ] Service logic with unit tests
- [ ] Server actions: validated, authorized, workspace-scoped
- [ ] UI built only from `shared/ui` components and tokens
- [ ] Loading, empty, and error states written per Section 12.7
- [ ] Accessible: keyboard navigation, visible focus, labels, reduced motion
- [ ] Responsive down to 375px (editor may show a "best on desktop" notice)
- [ ] One Playwright happy-path test
- [ ] Decisions logged in `docs/decisions.md`

---

### 14.2 M0 completion record (2026-09-25)
How M0 meets each Definition of Done item — use the same bar for every later milestone.

| Item | Evidence |
|---|---|
| Prisma models + migration | `users`, `sessions`, `accounts`, `verifications`, `rate_limits`, `workspaces`, `memberships`; 3 migrations, applied from scratch in CI |
| Zod schemas | env (`env-schema.ts`), profile name, workspace name |
| Service logic with unit tests | `workspaces/service.ts` (race-safe personal workspace), permissions matrix, auth error mapping, email template — 75 unit/integration tests |
| Server actions validated, authorized, scoped | `renameWorkspace` (reference), `updateProfile`; tested against a real database incl. redirect pass-through |
| UI from `shared/ui` + tokens | shadcn `base-vega` defaults; only documented edits (Button padding, Tabs contrast) |
| Loading, empty, error states | skeletons (app, auth), dashboard empty state, shared `ErrorFallback` (app, root, global), not-found |
| Accessible | axe WCAG 2.2 A/AA scans on every page and key states; keyboard tests; skip link; visible focus; reduced motion |
| Responsive to 375px | every e2e test runs on desktop and a 375px mobile device; no horizontal scroll checks |
| Playwright happy path | sign-in pages, signed-in shell, settings, sign-out, user menus, tabs (78 e2e checks) |
| Decisions logged | `docs/decisions.md` |
| CI | lint, types, format, unit, build, e2e against a `postgres:17` service on every push |

Still manual (can't be automated without real provider accounts): sign-in with Google, GitHub and a real magic-link email.

### 14.3 M1 completion record (2026-09-25)
Brand kits, built in parts A–F (A: storage + AI setup, B: data model, C: URL extraction, D: actions, E: UI, F: Definition of Done).

| Item | Evidence |
|---|---|
| Prisma models + migration | `brand_kits`, `allowed_claims` (M1), `rate_limit_buckets`; 5 migrations on the Neon `dev` branch and from scratch in CI |
| Zod schemas | every kit field with limits (`brandKitLimits`), website URL normalization, claim links, hex colours; action inputs; AI draft schema; AI and storage env |
| Service logic with unit tests | race-safe plan limit (workspace row lock), workspace-scoped CRUD, SSRF-safe fetch, page reader, AI draft + partial fallback, logo sniffing, rate limiter, ad fonts — 224 unit/integration tests |
| Server actions validated, authorized, scoped | `createBrandKitFromUrl`, `createBrandKitManually`, `saveBrandKit`, `uploadBrandKitLogo`, `removeBrandKitLogo`, `deleteBrandKit`; tested against a real database incl. viewer refusal, plan and daily AI limits, cross-workspace NOT_FOUND and redirect pass-through |
| UI from `shared/ui` + tokens | shadcn `base-vega` defaults; added `textarea`, `alert-dialog` and `select` unchanged; native colour picker behind the swatch |
| Loading, empty, error states | brand kit empty state with the create form, per-failure URL messages with a "Fill it in myself" fallback, field-level save errors, partial-draft alert, plan-limit alert, not-found for unknown kits |
| Accessible | axe WCAG 2.2 A/AA on the list, editor, validation errors, delete dialog and open font menu (scans wait for animations to settle); labelled controls, `aria-invalid` on the exact failing field |
| Responsive to 375px | every brand-kit e2e test runs on desktop and 375px mobile; no horizontal scroll checks |
| Playwright happy path | create (by hand) → fix a field error → pick colour and font → save (returns to the list) → reopen → plan limit → delete; private address refused; logo upload/remove against the real bucket (local); disguised logo refused (96 e2e checks) |
| Decisions logged | `docs/decisions.md` |

Checked live with the real model: linear.app and resend.com drafts (pricing page, real logo), and the full browser flow on resend.com — create from website → editor prefilled (24s, 5 claims, 600px logo, no console errors) → save → list. That run caught a bug CI couldn't (e2e never calls the AI or the network): creating the plan's last kit unmounted the form before its redirect ran; fixed. Not yet run: CI on GitHub (commits not pushed).

### 14.4 M2 completion record (2026-09-25)
Footage, built in parts A–G (A: worker + job queue, B: data model, C: direct uploads, D: processing job, E: screen recording, F: screens, G: Definition of Done).

| Item | Evidence |
|---|---|
| Prisma models + migration | `footage`, `footage_markers` (+ pg-boss's own `pgboss` schema, created by the worker); 7 migrations |
| Zod schemas | upload request (type incl. recorder codecs, size, source), completion (recorded marks), markers, job payloads; `DATABASE_URL_UNPOOLED` in env |
| Service logic with unit tests | race-safe clips-per-kit limit (kit row lock), forward-only status, retry-safe processed save, stale-upload expiry, markers; pure processing rules (thumbnail plan, scene log parsing, marker picking), recorder helpers — 289 unit/integration tests |
| Server actions validated, authorized, scoped | `requestFootageUpload`, `completeFootageUpload`, `deleteFootage`, `add/update/deleteFootageMarker`; viewers refused, arrival and size verified before queuing, idempotent completion |
| Background job | `footage.process` in `src/worker` against real ffmpeg + storage: converts MOV/MP4/duration-less WebM to silent H.264, poster, thumbnail strip, finds a hard cut within 100ms; bad files and over-long clips fail with plan-specific messages; queue retries with backoff tested |
| UI from `shared/ui` + tokens | shadcn `progress` and `dialog` added unchanged; Footage tab, clip grid, clip page with timeline, recorder dialog |
| Loading, empty, error states | empty footage tab, upload progress with cancel, Processing badges that refresh themselves, failed clips with the reason, plan-limit alert, "not a video" before upload, recorder not supported on mobile |
| Accessible | axe on the footage tab and recorder dialog; markers are keyboard buttons with spoken times; labelled inputs; reduced-motion respected on the recording light |
| Responsive to 375px | footage e2e on desktop and mobile; marker rows restack on narrow screens (checked in screenshots) |
| Playwright happy path | upload a real MP4 in the browser → worker processes it → Ready with the cut found → add, label, reload, remove a marker → delete clip; non-video refused; recorder dialog (106 e2e checks) |
| Decisions logged | `docs/decisions.md` |
| CI | a SeaweedFS S3 server in each job (Docker, no account) so storage, processing and upload tests run on every push; simulated locally against SeaweedFS 4.47: 289 unit + 106 e2e passed |

Still manual: an actual screen capture (headless browsers can't capture a screen) and the floating "Mark moment" window (Chrome/Edge). Not yet run: GitHub CI (commits not pushed). Deployment note: the worker is a second long-running process that runs ffmpeg; the worker host is still `TODO(owner)` (§17).

### 14.5 M3 completion record (2026-09-25)
Presenters, built in parts A–D (A: voice engine, B: presenter data + seed, C: presenters page, D: Definition of Done).

| Item | Evidence |
|---|---|
| Prisma models + migration | `presenters` (global stock library); 8 migrations |
| Zod schemas | none needed: no user input in M3 (catalog is code, seed is trusted); voice ids typed from the catalog |
| Service logic with unit tests | `syncStockPresenters` (idempotent uploads and samples, changed-voice re-speak, replaced portraits, missing portrait error), Kokoro provider against the real model and storage (AAC output, length, queued requests, loads after Prisma), shared file keys — 299 unit/integration tests |
| Server actions | none: the page only reads; nothing is written by users in M3 |
| UI from `shared/ui` + tokens | Card grid, Badge tags, Button with Spinner/Play/Pause |
| Loading, empty, error states | app loading skeleton, empty library message, "Sample coming soon", playback error toast |
| Accessible | axe on /presenters; play buttons have spoken names and `aria-pressed`; portraits have alt text |
| Responsive to 375px | presenter e2e on desktop and mobile; no horizontal scroll check |
| Playwright happy path | sidebar → Presenters → 8 presenters with real portraits in order → play Maya, switching to Emma stops Maya, pause (112 e2e checks) |
| Decisions logged | `docs/decisions.md` |
| CI | model cached (`.cache/models`), `prisma db seed` before e2e against the SeaweedFS S3 server |

Still to do by the owner: replace the 8 placeholder portraits with licensed photos (same file names) and re-run the seed.

### 14.6 M3b completion record (2026-09-25)
Footage motion (§7.4a), owner-requested after M3.

| Item | Evidence |
|---|---|
| Prisma + migration | `footage_markers.shot`, `footage.presentation` (JSON, validated by `shared/motion`); 9 migrations |
| Zod schemas | camera (limits per axis), shot (transition, easing), presentation (background, frame, intro); action inputs; AI direction schema |
| Logic with tests | `shared/motion` camera timeline (intro, holds, mid-move starts without jumps, ordering, cuts, easing), CSS transform/background builders, presets; AI direction clean-up (unknown/duplicate markers dropped, values clamped) and prompt fencing; motion actions (save/clear shot, limits, presentation, workspace scoping, AI apply, no-marker refusal, rate limit) — 323 unit/integration tests |
| UI | 3D stage (CSS perspective; pose written per animation frame, React told the time 10×/s), playback bar, 16:9/9:16/1:1 preview, timeline marks moments with a camera, right-hand inspector (Shot / Style / AI tabs), auto-save with status, click-to-set focus on a flat frame |
| States | reduced-motion preview (cuts, note), "select a moment" empty inspector, AI needs a key moment first, save failure toast, AI limit message |
| Accessible | axe on the clip page with the inspector; labelled sliders (shadcn Slider accessibility edit), toggle groups, moments as pressed buttons with spoken times and "camera set" |
| Responsive | inspector stacks under the editor on narrow screens; checked at 375px |
| Playwright | upload → Ready → select the cut → Dramatic → stage transform really turned → Solid background → reload keeps both → axe (112 e2e checks) |

Checked live with the real model: "Direct with AI" returned in 7.5s, chose a zoom-out intro and aimed a 2.2× zoom at a marker labelled "Export button (top right)" (focus 0.85, 0.15). Not yet: rendering the motion into the final video arrives with the Remotion compositions in M5 (they use the same `cameraTimeline`).

### 14.7 M3c completion record (2026-09-27)
Motion studio (§7.4b), owner-requested after M3b, built in parts A–I plus the owner's lens request (depth of field, progressive blur).

| Item | Evidence |
|---|---|
| Prisma + migration | `footage.analysis`, `analysisStatus`, `recording`; `footage_markers.insight` (10 migrations). Edit, text, graphics, lens and background light live in the validated `footage.presentation` JSON |
| Zod schemas | analysis, insight, recording; clip edit (parts, speed, transitions); text items and style; graphics; lens; AI plan (director v2) and graphic suggestion |
| Logic with tests | frame-diff activity, idle, scroll and palette; "aim at the action"; closed-form spring camera (smooth/snappy/linear, speed carried, log-space zoom); look rules (no repeats, alternating turns, rests, hero, pans, depth-scaled timing, takes); cut/speed/transition time mapping; text helpers (keyword swap, number ticker, readable colours); thin-lens depth of field and progressive blur (quadrature-corrected layers); graphic templates; AI plan cleaning and application — 420+ unit/integration tests |
| UI | Remotion Player stage (same composition M5 renders); tools: Effects, Shot, Cuts, Text, Graphics, Lens, Style, AI, Moments; live previews that run the real transition and text code; multi-row timeline (parts, text, graphics, shots) with drag, resize and snapping; on-stage text dragging with guides; J/K/L, frame steps, S split, Delete, shortcuts sheet |
| States | analysis pending/running/failed with "Analyse again"; flat-shot hint for depth of field; AI limits; reduced motion (static previews, cut shots) |
| Accessible | axe on each new tool (cuts, text, graphics, lens) and the analysis panel; spoken names for toggles and keycaps; label-in-name for the split key |
| Responsive | editor at 375px: tools in a scrolling row that keeps the open tool in view |
| Playwright | analysis after upload; cuts/speed/transitions played to the end; text; lens; graphics and end card; pro controls (shuttle, frame steps, stage and timeline drags, Delete); playback through refreshes (125 e2e checks) |

Checked live with the real model: moment descriptions with pixel-accurate focus boxes; graphic choices ("Export CSV" click + label; "+18%" stat card); a whole-edit plan for a four-moment clip in 12.8s. Not yet: the final render (M5) — it uses the same `FootageStage` composition; fonts for the renderer are M5 work (the editor loads them through next/font). Owner to-do: confirm the Remotion licence (§17).

### 14.8 M4 completion record (2026-09-28)
Projects (§7.14), after the owner's direction change to a video editor.

| Item | Evidence |
|---|---|
| Prisma + migration | `projects`, `project_clips` (cascade with their kit and their footage); `footage.presentationVersion` — migration `projects` |
| Zod schemas | create, rename, delete; the clip list (`projectClipSchema`: footage + transition, up to 30) with `baseVersion`; clip presentation saves now carry `baseVersion` |
| Logic with tests | `projectLayout`/`clipAt` (clips joined by transitions fitted to half of either clip), versioned saves (conflict on a stale version), kit/ready/workspace checks, lengths from each clip's edit, signed-link reuse (`shared/storage/url-cache`) — 457 unit/integration tests |
| UI | Projects in the sidebar; dashboard with recent projects; `/projects` grid; project page with the `ProjectStage` player (transport, scrubber, full screen, shapes), clip strip (add, remove, reorder by buttons or drag, transition per join), inline rename, delete; "Edit clip" and back; "changed somewhere else" dialog in the project page and the clip editor |
| States | empty (no kit / no projects / no clips / kit without ready footage), loading clips, saving/saved/not saved, conflict |
| Accessible | axe on `/projects` and the project page (empty and filled); every control named ("Move Feature tour earlier", "Transition into clip 2"); Edit is a real link; Shift+arrows jump 1s on scrubbers |
| Responsive | project page and dialogs at 375px (mobile e2e) |
| Playwright | make a project from two clips, join, reorder, play through, reload, edit and back, rename, list, delete (desktop + mobile); two tabs: stale project and clip saves get the reload dialog (desktop) — 144 e2e checks in the suite |

Reworked the same day (owner: "do we need projects?"): projects became invisible — **Videos** everywhere, record/upload straight into a video (clips may join while processing), one-clip videos open in the editor with "Add clip", delete from a card. A latent build issue surfaced and was fixed: `global-error` declared its own Geist font, so Turbopack emitted a second Geist stylesheet that every page preloaded unused (a console warning on every page); both now share `src/app/fonts.ts`.

Also in M4: shared player hooks (Space, full screen) used by both editors; a browser-safe `@/features/footage/client` entry (the index exports server queries); the clip editor's "Saved" now waits for in-flight saves (a reload could lose the last change); a project join checked frame by frame on the GPU (no flashes).

### 14.9 M5 completion record (2026-09-28)
Export & share (§7.15), for clips and videos (owner, 2026-09-28).

| Item | Evidence |
|---|---|
| Prisma + migration | `exports` (status, progress, file, fingerprint; one of footage/project, checked in SQL), `share_links` (unique token, one per clip or video) — migration `exports_and_share_links` |
| Zod schemas | target (clip/video), shape, start export, share on/off |
| Logic with tests | render input built exactly as the editors play (presentation defaults, shots, kit fonts via Fontsource, accents, logo, end card), fingerprint ignoring link signatures, newest-per-shape kept (older rows and files removed), duplicate clicks, not-ready/empty/failed/other-workspace refusals, 50 exports/day per workspace, share link on/off/revive, public lookup; a real 9:16 render (Chrome + ffmpeg) of a stored clip, probed at 1080×1920 — 463 unit/integration tests |
| UI | "Export" in both editors → *Export and share* dialog (shape, progress, download with size, out-of-date note, export again, share switch, link + copy); `/v/[token]` public page; download route `/api/exports/[id]/download` |
| States | not ready, queued, rendering %, failed (keeps the older file), ready, out of date, sharing off, shared but not exported yet, link off → 404 |
| Accessible | axe on the dialog and the public page; the button keeps its name on phones (icon only) |
| Responsive | dialog and public page at 375px (mobile e2e) |
| Playwright | export a clip in 9:16 → download "Product demo 9x16.mp4" → share → watch signed out (plays 5s) → off → 404; edit after export → out of date; a one-clip video exports and shares as the video, same state from its clip list (desktop + mobile) — 150 e2e checks in the suite |

Found on the way: Neon's storage ignores `response-content-disposition`, so a signed link can't name a download; MP4s download through our own route instead. Remotion's renderer can't load under the worker's `react-server` condition, so each render runs in a child process. The render path now uses `OffthreadVideo` (frame-exact) and writes standard-range `yuv420p` (the default JPEG frames came out as full-range `yuvj420p`, which some players show washed out).

## 15. Environment variables (`.env.example`)

```
# Neon: pooled (-pooler host) for the app, direct for migrations and the worker
DATABASE_URL=
DATABASE_URL_UNPOOLED=

# Better Auth. Secret: min 32 chars, generate with: openssl rand -base64 32
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Resend. Sender on a domain verified in Resend, e.g. ReelPilot <hello@yourdomain.com>
RESEND_API_KEY=
EMAIL_FROM=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER=
STRIPE_PRICE_GROWTH=
STRIPE_PRICE_AGENCY=
STRIPE_PRICE_TOPUP_5=

# AI text via the Vercel AI SDK. Provider name (e.g. anthropic), model id,
# and that provider's own key variable
AI_TEXT_PROVIDER=
AI_TEXT_MODEL=
ANTHROPIC_API_KEY=

# Neon Object Storage (from M1). Don't fill by hand: `neon env pull` writes these
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_ENDPOINT_URL_S3=
AWS_REGION=

# Optional: Remotion company licence key, used when rendering exports
# REMOTION_LICENSE_KEY=

SENTRY_DSN=
NEXT_PUBLIC_APP_URL=
```
All env vars are validated at startup in `src/shared/config/env.ts`.

---

## 16. Metrics to track from day one
- Try-it → sign-up conversion.
- Sign-up → first export (activation).
- Projects per active workspace per month; exports and share-link views.
- Export failure rate and median export time.

---

## 17. Open decisions (owner)
- [ ] Final product name, domain, logo. `TODO(owner)`
- [ ] Pricing, when billing returns (not in V1). `TODO(owner)`
- [x] Jobs platform: own worker + pg-boss on Neon (2026-09-23).
- [x] Render infra: Remotion in the same worker (2026-09-23).
- [x] Worker host (2026-09-28): local now; a Hostinger VPS with Docker at launch (it needs ffmpeg and headless Chrome); the app on Hostinger Node.js.
- [ ] Remotion licence: free for individuals and companies of up to 3 people; larger companies need a company licence (set `REMOTION_LICENSE_KEY`). `TODO(owner)`: confirm which applies.
- [x] Share links play the newest export (2026-09-28), not one link per export.
- [x] Voice and presenters: removed (2026-09-28); no voice in V1.
- [x] Footage caps per plan (2026-09-25): Free 200 MB / 3 min / 5 clips per kit; Starter 500 MB / 5 min / 20; Growth and Agency 1 GB / 10 min / 50.
- [ ] Legal review of Terms and Privacy. `TODO(owner)`
- [x] Typeface: Geist + Geist Mono (2026-09-25).
- [x] Hosting: Hostinger (Node.js), deployment after M8 (2026-09-28).
- [ ] Color tuning. `TODO(owner)`
- [x] Direction: a video editor, minimal scope; UGC ads, billing, admin, audio out of V1 (2026-09-28).
- [x] Projects live inside a brand kit (its footage, fonts, colours, logo) (2026-09-28).

✏️ Owner notes (general):
>
>

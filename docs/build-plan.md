# ReelPilot — Product & Build Plan

> **Working name:** ReelPilot (placeholder — check domain and trademark before launch).
> **One-liner:** Turn your app into scroll-stopping video ads in minutes: your real product footage, a presenter who sells it, and a batch of variations to test — without filming anything.
> **Audience:** SaaS and app founders (solo and small teams) who run or want to run paid social ads.
> **Status:** Pre-build. This document is the single source of truth for the build agent.

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
6. Never hardcode secrets, prices, credit costs, or provider names in feature code. Prices and credit costs live in `src/shared/config/plans.ts`; providers live behind adapters (Section 10).
7. Follow the design system (Section 12) and code style guide (Section 13) exactly. If a component you need isn't in the design system, add it to `src/shared/ui` first, then use it.

---

## 1. Product summary

### 1.1 The problem
Founders need a steady stream of fresh video ads (15–30 variants a month for accounts spending seriously) to beat creative fatigue. Hiring UGC creators costs roughly $200 per video and takes weeks. Existing AI UGC tools are expensive to start, expire credits, charge a full re-render for any edit, and use AI actors pretending to hold a product — which doesn't work for software.

### 1.2 What ReelPilot does differently
| Pain | ReelPilot's answer |
|---|---|
| AI actors can't demo software | Ads are built around the founder's **real screen recordings**, with a presenter layered on top |
| Fake testimonials are legally risky | **Compliance guard** blocks fake-customer claims and adds AI disclosure automatically |
| Generic AI actors feel fake | **Founder avatar**: the real founder, recorded once, with consent |
| Any edit = full paid re-render | **Segment-level editing**: text/cut edits are free, a changed line re-renders only that segment |
| Hidden pricing, no trial, expiring credits | Public pricing, a real free tier, **rollover credits**, cost shown before every render |
| "Here's a video, good luck" | (V2) connects to ad accounts, finds winners, makes more like them |

### 1.3 Core user journey (V1)
1. Visitor pastes their app URL on the landing page → gets an AI brief, 10 hooks, and 1 watermarked preview (no account).
2. Signs up (Google / GitHub / email).
3. Onboarding builds a **brand kit**: brief, allowed claims, logo/colors, screen footage, presenter.
4. Creates a **campaign**: goal/platform → angles → script matrix → presenter/layout → preview → render.
5. Edits variants in the **segment editor**.
6. Exports from the **library** in 9:16, 4:5, 1:1.
7. Manages plan, credits, and team in **settings**.

---

## 2. Pricing, plans & credits

All values live in `src/shared/config/plans.ts`. `TODO(owner)`: confirm final prices after measuring real per-render API cost in the admin cost monitor.

| Plan | Price (draft) | Ad credits / month | Brand kits | Seats | Notes |
|---|---|---|---|---|---|
| **Free** | $0 | **2 watermarked previews** (720p) | 1 | 1 | No HD export, stock presenters only |
| **Starter** | ~$29/mo | **10 HD ads** | 1 | 1 | Rollover; founder avatar in V1.1 |
| **Growth** | ~$79/mo | **30 HD ads** | 3 | 3 | Priority render queue; ad-account connection in V2 |
| **Agency** | ~$199/mo | **100 HD ads** | 10 client workspaces | 5 (+$15/extra seat) | Review links for clients, bulk render |

Price per ad sanity check: Starter ≈ $2.90, Growth ≈ $2.63, Agency ≈ $1.99. `TODO(owner)`: keep each tier's margin positive against measured cost per render (target ≥ 60% gross margin).

### 2.1 Credit rules
- **1 ad credit** = one final HD render of one variant, up to 30 seconds, in all three aspect ratios.
- **Previews (animatics) are free** within a fair-use cap (Starter 40/mo, Growth 120/mo, Agency 400/mo). A preview is a low-cost storyboard: presenter still frame + synthesized voice + real footage + captions. No avatar video generation.
- **Free edits** (0 credits): captions, text overlays, trims, clip reordering, footage swaps, music, layout changes.
- **Segment re-voice** (0.25 credit): rewriting one spoken line regenerates only that segment.
- **Rollover:** unused credits roll over one month, capped at one month's allowance.
- **Top-ups:** packs of 5 ad credits. `TODO(owner)`: price.
- **Failed renders** are refunded automatically.
- Credit cost is always shown **before** confirming a render.

---

## 3. Scope by release

### 3.1 `[V1]` — MVP (the build video / "today")
- Marketing site: landing, pricing, legal pages.
- **Try-it flow:** URL → brief + 10 hooks + 1 watermarked preview, no account (rate-limited).
- Auth: Better Auth with Google, GitHub, email magic link.
- Workspaces: one personal workspace per user. Roles (owner, editor, viewer) exist in the model; team invites are `[V1.1]`.
- **Brand kit:** URL extraction, brief editing, allowed claims, logo/colors/fonts, multiple kits per plan limit.
- **Footage:** upload or in-browser screen recording, auto-detected key moments, manual markers.
- **Presenters:** stock presenter library — a still portrait paired with a stock voice. Lip-synced avatar video and founder avatars are `[V1.1]`.
- **Campaign wizard:** goal & platform → angles → script matrix → presenter/voice/layout/captions → preview → render.
- **Compliance guard** inline in the script matrix; blocking rules on render.
- **Render pipeline:** background jobs, progress, email on completion, automatic refunds on failure.
- **Segment editor:** timeline of segments, free edits, segment re-voice, side-by-side compare.
- **Library & export:** filters, 9:16/4:5/1:1 export, AI-disclosure label, shareable review link (view + comment).
- **Billing:** Stripe subscriptions, credit ledger, top-ups, invoices, rollover logic.
- **Admin panel:** users & plans, credit adjustments, cost monitor, moderation queue, render health.

### 3.2 `[V1.1]` — Fast follows ("tomorrow")
- Hook library: save and reuse best hooks across campaigns.
- Team invites, role changes and member removal.
- **Founder avatar + lip-synced presenter video** (consent flow in 7.5, `AvatarProvider` in Section 10).
- Founder voice cloning (needs a provider with consent support; Kokoro has no cloning).
- Music library with auto-ducking under voice.
- More caption styles and layout templates.
- Brand kit auto-refresh when the site changes.
- Bulk re-render of a campaign with a new presenter.
- Onboarding checklist + in-app tips.
- Referral credits.
- Localization of ads into additional languages (voice + captions).

### 3.3 `[V2]` — Performance loop
- Connect Meta and TikTok ad accounts (OAuth).
- One-click publish of variants to an ad set.
- Pull back hook rate, CTR, CPC, cost per result per variant.
- **Winners view** with AI explanation of *why* variants win.
- "Make more like this" generation from winners.
- Creative fatigue alerts and auto-refresh suggestions.
- **Ad structure cloner:** paste a public ad (e.g., from Meta Ad Library) → extract structure (hook timing, pacing, angle) → rebuild for your app. Copies format only, never content, voice, or likeness.
- Agency client portal with approval workflows.
- Public API + MCP server so agents can generate ads.

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
| Video composition | **Remotion** (compositions in `src/remotion`) | Captions, overlays, zooms, layouts. `TODO(owner)`: review Remotion's license terms for commercial use |
| Render infra | Remotion renderer inside the same worker (one Docker image) | `TODO(owner)`: worker host (Railway, Fly.io or a VPS) |
| Avatar / lip-sync video | `[V1.1]` provider adapter (Section 10) | Not in V1: ads use presenter stills + voiceover |
| Voice | **Kokoro** (open-source TTS, Apache-2.0) self-hosted in the worker via `kokoro-js`, behind the `VoiceProvider` adapter | No API key, no per-ad cost; stock voices only |
| Storage | **Neon Object Storage** (S3-compatible, branches with the database) via the Files SDK `neon` adapter | Signed URLs only; credentials come from `neon env pull` |
| Payments | **Stripe** (Billing + Checkout + Customer Portal) | |
| Email | Resend + React Email | |
| Rate limiting | Postgres (Neon) table in `src/shared/rate-limit`; Better Auth's database rate-limit storage | No Redis service |
| Validation | Zod | All inputs at the boundary |
| Testing | Vitest (unit), Playwright (e2e) | |
| Observability | Sentry + structured logs; per-render cost logging | |
| Hosting | Vercel (web) | |

---

## 5. Architecture: vertical slices

### 5.1 Principles
- The app is organized **by feature, not by layer**. Each feature folder owns everything it needs: UI, server actions, queries, validation schemas, jobs, and tests.
- `src/app` contains **thin routes only**: they read params, check auth, and render components from features.
- A feature exposes a **public API** through its `index.ts`. Other features may import only from that file — never from another feature's internals.
- Shared, feature-agnostic code lives in `src/shared` (UI kit, db client, auth helpers, provider adapters, config).
- Business rules live in `service.ts` (pure where possible, easy to unit-test). Server actions are thin: validate → authorize → call service → revalidate.
- Every mutation that spends credits goes through the **billing** feature's `spendCredits()` / `refundCredits()` — never direct DB writes.
- Every script that will be rendered goes through **compliance**'s `checkScript()`.

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

---

## 6. Folder structure

```
reelpilot/
├── docs/
│   ├── decisions.md              # one-line architecture decisions log
│   └── build-plan.md             # this file
├── prisma/
│   ├── schema.prisma
│   └── seed.ts                   # stock presenters, angle templates, demo data
├── public/
├── src/
│   ├── app/
│   │   ├── (marketing)/
│   │   │   ├── page.tsx                  # landing + try-it input
│   │   │   ├── pricing/page.tsx
│   │   │   ├── try/[trialId]/page.tsx    # anonymous try-it results
│   │   │   └── legal/{terms,privacy,ai-disclosure}/page.tsx
│   │   ├── (auth)/
│   │   │   ├── sign-in/page.tsx
│   │   │   └── sign-up/page.tsx
│   │   ├── (app)/
│   │   │   ├── layout.tsx                # app shell: sidebar, workspace switcher, credits
│   │   │   ├── onboarding/page.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── brand-kits/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [kitId]/page.tsx
│   │   │   ├── campaigns/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── new/page.tsx          # wizard
│   │   │   │   └── [campaignId]/page.tsx # contact sheet of variants
│   │   │   ├── editor/[variantId]/page.tsx
│   │   │   ├── library/page.tsx
│   │   │   ├── presenters/page.tsx
│   │   │   └── settings/
│   │   │       ├── billing/page.tsx
│   │   │       ├── team/page.tsx
│   │   │       └── profile/page.tsx
│   │   ├── (admin)/admin/
│   │   │   ├── page.tsx                  # overview
│   │   │   ├── users/page.tsx
│   │   │   ├── costs/page.tsx
│   │   │   ├── moderation/page.tsx
│   │   │   └── renders/page.tsx
│   │   ├── review/[shareToken]/page.tsx  # public review link
│   │   └── api/
│   │       ├── auth/[...all]/route.ts    # Better Auth
│   │       └── webhooks/stripe/route.ts
│   ├── features/
│   │   ├── try-it/           # anonymous URL → brief, hooks, preview
│   │   ├── auth/             # session helpers, guards, workspace context
│   │   ├── workspaces/       # workspaces, members, roles, invites
│   │   ├── brand-kits/       # extraction, brief, claims, visual identity
│   │   ├── footage/          # upload, screen recording, key-moment detection
│   │   ├── presenters/       # stock library (founder avatars + consent in V1.1)
│   │   ├── campaigns/        # wizard state, angles, variant matrix
│   │   ├── scripts/          # AI script generation (hooks/bodies/CTAs)
│   │   ├── compliance/       # rules engine, disclosure, flags
│   │   ├── renders/          # preview + HD render orchestration, segments
│   │   ├── editor/           # segment timeline, edits, compare
│   │   ├── library/          # browsing, filters, export, review links
│   │   ├── billing/          # plans, Stripe, credit ledger, rollover
│   │   ├── notifications/    # emails, in-app toasts
│   │   └── admin/            # users, costs, moderation, render health
│   ├── worker/               # our own job worker: pg-boss + Remotion + Kokoro (own Dockerfile)
│   ├── remotion/
│   │   ├── Root.tsx
│   │   ├── compositions/
│   │   │   ├── CornerPresenter.tsx       # presenter bubble over app footage
│   │   │   ├── FullPresenterCutaways.tsx
│   │   │   └── FootageVoiceover.tsx
│   │   ├── components/                    # captions, zoom-on-click, logo sting, disclosure label
│   │   └── schema.ts                      # Zod props shared with renders feature
│   └── shared/
│       ├── ui/               # design system components (Section 12)
│       ├── config/
│       │   ├── plans.ts      # prices, credits, limits — single source of truth
│       │   ├── site.ts       # name, URLs, copy constants
│       │   └── env.ts        # typed, validated env vars
│       ├── db/               # Prisma client
│       ├── ai/               # AI SDK provider registry
│       ├── providers/        # voice (Kokoro) and storage (Neon) adapters (Section 10)
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

### 7.1 try-it
- **Purpose:** Let an anonymous visitor see their own app in an ad before signing up.
- **Routes:** `(marketing)/page.tsx` input, `(marketing)/try/[trialId]`.
- **Flow:** validate URL → fetch page server-side → AI extracts brief → generate 10 hooks → build 1 preview animatic (stock presenter still + TTS + site screenshots) → watermark.
- **Actions/jobs:** `startTrial(url)`, job `buildTrialPreview`.
- **Limits:** 3 trials per IP per day (Postgres rate-limit table). Trials expire after 7 days. On sign-up, the trial converts into the user's first brand kit.
- **Acceptance:** A valid URL produces a brief, 10 hooks, and a playable watermarked preview in under ~60s; invalid/blocked URLs show a clear error; rate limit enforced.

### 7.2 auth + workspaces
- **Purpose:** Sign-in, personal workspace on first login, team invites with roles.
- **Roles:** owner (billing + everything), editor (create/edit/render), viewer (view/comment).
- **Acceptance:** Google, GitHub, magic link work; workspace auto-created; invite email → accept → correct role enforced on every action.

### 7.3 brand-kits
- **Purpose:** Everything the AI needs to know about the product.
- **Fields:** name, URL, one-line description, audience, key features (list), pricing summary, **allowed claims** (list, each optionally with a source link), banned words, logo, colors, fonts, tone.
- **Actions:** `createKitFromUrl`, `updateKit`, `refreshFromSite` `[V1.1]`.
- **Acceptance:** Extraction pre-fills all fields; user can edit and save; plan limit on number of kits enforced.

### 7.4 footage
- **Purpose:** Real product footage for ads.
- **Input:** file upload (mp4/mov/webm, size cap by plan) or in-browser screen recording (MediaRecorder + Screen Capture API) with a guided prompt.
- **Processing job:** transcode to normalized mp4, generate thumbnails, detect key moments (click events captured during in-browser recording; scene changes for uploads), store markers.
- **Acceptance:** Upload and recording both produce a playable clip with thumbnails and at least auto-detected markers; users can add/remove markers.

### 7.5 presenters
- **Purpose:** Stock presenters: a licensed still portrait paired with a Kokoro stock voice. `TODO(owner)`: source of the portraits (licensed stock photos or generated faces).
- **`[V1.1]` — everything below in this section.**
- **Founder avatar flow:** record ~2-minute video following on-screen script → record spoken consent statement → submit → provider training job → admin moderation check (face in consent video matches training video) → available.
- **Rules:** Only the person themselves can create their avatar. Owner can revoke/delete anytime; deletion removes provider-side data via adapter.
- **Acceptance (V1):** Stock library browsable; each presenter plays a short voice sample.
- **Acceptance (V1.1):** founder avatar goes through consent → processing → approved → usable; revoke works end to end.

### 7.6 campaigns + scripts
- **Wizard steps:**
  1. **Goal & platform** — objective (installs, signups, trials, demo bookings); platforms (Meta, TikTok, YouTube Shorts, LinkedIn) → sets aspect ratios, max length, tone.
  2. **Angles** — AI suggests 5–8 angles from templates: problem/solution, "I tried every tool," feature demo, founder story, before/after, old way vs new way, objection buster. User picks 2–3.
  3. **Script matrix** — hooks × bodies × CTAs grid; every cell editable; compliance flags inline; variant count and credit cost shown live.
  4. **Presenter, voice, layout, captions** — one or more presenters; layout: corner presenter / full presenter with cutaways / footage + voiceover; caption style; footage markers mapped to body beats.
  5. **Preview & render** — free animatic previews of every variant; select variants; confirm with credit cost; render.
- **Wizard state** persists as a draft campaign so users can leave and return.
- **Acceptance:** A user can go from empty to confirmed render; drafts persist; matrix math and credit cost are correct; compliance blocks unsafe scripts from rendering.

### 7.7 compliance
- **Purpose:** Keep users' ads safe to run.
- **Rule types:**
  - **Block:** first-person customer testimonials by a non-founder presenter ("I've been using this for a year", "as a customer…"); claims not in the brand kit's allowed claims that include numbers/guarantees; impersonation of real people or brands.
  - **Warn:** health, finance, earnings, or "#1/best" superlatives; competitor names.
  - **Auto-apply:** AI-disclosure label on every export (position/style configurable, removal not allowed); disclosure text in export metadata.
- **Implementation:** deterministic rules first (patterns, claim matching), then an AI classifier pass; every flag stored with reason and suggested rewrite.
- **Acceptance:** Seeded bad scripts are blocked/warned with a clear reason and rewrite; clean scripts pass; disclosure label present on all exports.

### 7.8 renders
- **Purpose:** Turn a variant into video.
- **Pipeline (per variant):**
  1. Split script into segments (hook, body beats, CTA).
  2. Per segment: TTS (Kokoro) → store audio. (`[V1.1]`: avatar lip-sync video for HD.)
  3. Remotion composition assembles segments + footage + captions + overlays + disclosure label.
  4. Render 9:16, then derive 4:5 and 1:1 (smart reframing rules per layout).
  5. Upload outputs, update status, log cost, notify.
- **Preview vs HD:** both use the presenter still + TTS in V1. Preview renders at 720p with a watermark; HD renders at 1080p without one.
- **Idempotency:** each segment keyed by a hash of (script text, voice, presenter, settings) so unchanged segments are reused on edits.
- **Credits:** reserve on confirm → capture on success → release/refund on failure.
- **Acceptance:** Batch renders complete in the background with live status; a failed provider call retries then refunds; unchanged segments are never regenerated.

### 7.9 editor
- **Purpose:** Fix a variant without starting over.
- **UI:** preview player + horizontal segment timeline; inspector panel for the selected segment.
- **Free edits:** captions, overlay text, trim, reorder, swap footage clip/marker, layout, caption style, music.
- **Paid edit:** rewrite a spoken line → 0.25 credit segment re-voice (cost shown before confirming).
- **Compare:** two variants side by side, synced playback.
- **Acceptance:** Free edits re-compose without spending credits; re-voice spends exactly 0.25 and regenerates one segment; compare works.

### 7.10 library
- **Purpose:** Find, export, and share ads.
- **Features:** filters (campaign, angle, presenter, platform, status), bulk select + bulk download (zip), per-ad download in each ratio, review link (public token, view + timestamped comments, revocable).
- **Acceptance:** Filters work; exports include disclosure; review link works logged-out and can be revoked.

### 7.11 billing
- **Purpose:** Plans, credits, money.
- **Pieces:** Stripe Checkout for plans and top-ups, Customer Portal, webhook handler, **append-only credit ledger** (grant, spend, reserve, release, refund, rollover, expire, admin-adjust), monthly grant + rollover job.
- **Acceptance:** Upgrading/downgrading updates limits; balance always equals the ledger sum; rollover cap enforced; webhook replays are idempotent.

### 7.12 admin
- **Access:** users with `role = admin` on the User model only; separate layout.
- **Pages:** users (search, plan, balance, adjust credits with required reason, impersonate read-only); **costs** (provider spend per render/user/day vs revenue, margin per plan); **moderation** (compliance flags, avatar consent reviews, reported review links); **renders** (queue depth, failures, retry, refund).
- **Acceptance:** Non-admins get 404; every admin mutation writes an audit log entry.

### 7.13 notifications
- Emails: welcome, invite, render complete, render failed (refunded), avatar approved/rejected, low credits, receipt.
- In-app toasts for action results, using the same verb as the button ("Render" → "Rendering started").

---

## 8. Data model (Prisma sketch)

`TODO(agent)`: expand into full `schema.prisma` with indexes and relations; keep names.

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
  stripeCustomerId String?
  memberships    Membership[]
  brandKits      BrandKit[]
  creditEntries  CreditLedgerEntry[]
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

model Presenter {
  id String @id @default(cuid())
  kind PresenterKind      // STOCK | FOUNDER
  workspaceId String?     // null for stock
  name String
  providerRef String?
  stillUrl String
  previewUrl String?
  status PresenterStatus  // PENDING_CONSENT | PROCESSING | IN_REVIEW | APPROVED | REJECTED | REVOKED
  consent AvatarConsent?
}
model AvatarConsent { id String @id @default(cuid()) presenterId String @unique userId String consentVideoKey String statementText String recordedAt DateTime reviewedById String? reviewedAt DateTime? }

model Campaign {
  id String @id @default(cuid())
  brandKitId String
  name String
  goal CampaignGoal
  platforms Json          // Platform[]
  status CampaignStatus   // DRAFT | RENDERING | READY
  wizardState Json        // persisted draft
  angles Json             // selected angle keys
  scriptLines ScriptLine[]
  variants Variant[]
}

model ScriptLine {
  id String @id @default(cuid())
  campaignId String
  kind ScriptLineKind     // HOOK | BODY | CTA
  angle String
  text String
  complianceFlags ComplianceFlag[]
}

model Variant {
  id String @id @default(cuid())
  campaignId String
  hookId String
  bodyId String
  ctaId String
  presenterId String
  voiceId String
  layout Layout
  captionStyle String
  settings Json
  segments Segment[]
  renders Render[]
}

model Segment {
  id String @id @default(cuid())
  variantId String
  order Int
  kind SegmentKind        // HOOK | BODY | CTA
  text String
  footageMarkerId String?
  contentHash String      // reuse key
  audioKey String?
  avatarVideoKey String?
}

model Render {
  id String @id @default(cuid())
  variantId String
  quality RenderQuality   // PREVIEW | HD
  status RenderStatus     // QUEUED | RUNNING | SUCCEEDED | FAILED
  outputs Json            // { "9:16": key, "4:5": key, "1:1": key }
  creditCost Decimal
  providerCostUsd Decimal?
  error String?
  createdAt DateTime @default(now())
}

model ComplianceFlag { id String @id @default(cuid()) scriptLineId String severity FlagSeverity rule String reason String suggestion String? resolved Boolean @default(false) }

model CreditLedgerEntry {
  id String @id @default(cuid())
  workspaceId String
  type LedgerType         // GRANT | SPEND | RESERVE | RELEASE | REFUND | ROLLOVER | EXPIRE | ADMIN_ADJUST | TOPUP
  amount Decimal          // positive or negative
  renderId String?
  reason String?
  idempotencyKey String   @unique
  createdAt DateTime @default(now())
}

model ReviewLink { id String @id @default(cuid()) token String @unique campaignId String revokedAt DateTime? comments ReviewComment[] }
model ReviewComment { id String @id @default(cuid()) reviewLinkId String variantId String atMs Int? authorName String body String createdAt DateTime @default(now()) }

model Trial { id String @id @default(cuid()) url String ipHash String brief Json hooks Json previewKey String? convertedWorkspaceId String? expiresAt DateTime }

model AuditLog { id String @id @default(cuid()) actorId String action String targetType String targetId String meta Json createdAt DateTime @default(now()) }
```

---

## 9. Rendering pipeline notes

- All heavy work runs in background jobs; the UI polls or subscribes to status.
- **Job graph per HD variant:** `prepareSegments` → fan-out `generateSegmentAudio` (skip if `contentHash` exists; `generateSegmentAvatar` joins in V1.1) → `composeVariant` (Remotion) → `deriveAspectRatios` → `finalizeRender` (store outputs, capture credits, log cost, notify).
- Retries: 3 attempts with backoff per provider call; after that, mark failed and refund.
- Concurrency limits per workspace by plan (Growth/Agency get priority queue).
- Log `providerCostUsd` per step; admin cost monitor aggregates it.
- Watermark and disclosure label are Remotion components, applied in composition (never optional for disclosure).

---

## 10. Provider adapters

All external AI/media providers sit behind interfaces in `src/shared/providers`. Feature code never imports a vendor SDK directly.

```ts
// src/shared/providers/types.ts
export interface VoiceProvider {
  listVoices(): Promise<Voice[]>;
  synthesize(input: { text: string; voiceId: string }): Promise<{ audioKey: string; durationMs: number; costUsd: number }>;
  cloneVoice?(input: { sampleKeys: string[]; consentId: string }): Promise<{ voiceId: string }>;
  deleteVoice?(voiceId: string): Promise<void>;
}

export interface AvatarProvider {
  createAvatar(input: { trainingVideoKey: string; consentId: string }): Promise<{ providerRef: string }>;
  getAvatarStatus(providerRef: string): Promise<"processing" | "ready" | "failed">;
  lipSync(input: { providerRef: string; audioKey: string; aspect: "9:16" }): Promise<{ videoKey: string; costUsd: number }>;
  deleteAvatar(providerRef: string): Promise<void>;
}

export interface TextModel { /* via Vercel AI SDK registry in src/shared/ai */ }
```

V1 voice: Kokoro, self-hosted (no `cloneVoice`/`deleteVoice`). `AvatarProvider` is `[V1.1]`: don't build it in V1. When avatars start, run the bake-off (quality, API stability, per-second cost, commercial terms, deletion support) and record the choice in `docs/decisions.md`.

---

## 11. Trust, safety & compliance

- **No fake testimonials.** Stock presenters may present, explain, demo, and compare — never claim to be a customer. Founder avatars may speak as the founder.
- **AI disclosure** on every export and in the review link player. Users cannot remove it.
- **Avatar consent:** recorded consent statement, admin review, revocable, provider-side deletion.
- **No impersonation:** block uploads/avatars of public figures; block scripts naming real people as endorsers.
- **Claims:** numeric or guaranteed claims must match the brand kit's allowed claims.
- **Terms of Service** must state users are responsible for complying with ad-platform policies and local laws. `TODO(owner)`: legal review of Terms, Privacy, and AI-disclosure pages before launch.
- **Data:** signed URLs only; footage and avatars are private to the workspace; deletion on account close.

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
| `--chroma` | `#18B26B` | Accent: primary actions on dark, selection, "ready" states (green-screen green) |
| `--chroma-soft` | `#DDF5E9` | Selected rows, success backgrounds |
| `--tally` | `#E5484D` | Recording, live render, destructive, blocking compliance flags |
| `--amber` | `#E8A23A` | Warnings, compliance "warn" |
| `--projector` | `#1B1D23` | Dark surfaces: video player, preview stage |

Dark mode `[V1.1]`: invert `stage`/`surface`/`ink`; keep `chroma` and `tally`.

Contrast rule: all text meets WCAG AA; `--chroma` is never used for body text on white.

### 12.3 Typography
| Role | Typeface | Notes |
|---|---|---|
| Display (landing hero, section titles, empty states) | **Big Shoulders Display** (700–800) | Condensed, marquee/slate feel; use large and tight |
| UI + body | **Schibsted Grotesk** (400/500/600) | Clear at small sizes, a bit of character |
| Timecodes & credit counts | Schibsted Grotesk with `font-variant-numeric: tabular-nums` | No separate monospace face |

Scale (rem): 0.75 / 0.875 / 1 / 1.125 / 1.375 / 1.75 / 2.5 / 3.75 / 5.
Line length ≤ 72ch for prose. Sentence case everywhere; no all-caps labels.

`TODO(owner)`: confirm typefaces (both on Google Fonts).

### 12.4 Layout
- **App shell:** left sidebar (Dashboard, Campaigns, Library, Brand kits, Presenters, Settings), top bar with workspace switcher and credit balance, content area on `--stage`.
- **Campaign page:** a **contact sheet** — a grid of 9:16 frames on a `--projector` strip, each labeled with hook text and status; selecting frames highlights them with a chroma outline.
- **Editor:** player on top (on `--projector`), segment timeline below, inspector on the right.
- **Landing:** left-aligned hero with the URL input; to the right, a phone-frame player looping real example ads; below, one before/after (raw screen recording → finished ad).

```
Landing (desktop)
┌───────────────────────────────────────────────────────────┐
│ Logo                                   Pricing   Sign in   │
│                                                           │
│  Your app, in ads that sell it.          ┌────────┐       │
│  Paste your URL. Get ads in minutes.     │ phone  │       │
│  [ https://yourapp.com      ][Make ads]  │ player │       │
│                                          └────────┘       │
├───────────────────────────────────────────────────────────┤
│  raw screen recording  ──▶  finished ad (before/after)    │
└───────────────────────────────────────────────────────────┘

Editor
┌───────────────────────────────┬──────────────┐
│          player (9:16)         │  inspector   │
│                                │  segment text│
├───────────────────────────────┤  captions    │
│ [HOOK][ body 1 ][ body 2 ][CTA]│  footage     │
└───────────────────────────────┴──────────────┘
```

### 12.5 Components (`src/shared/ui`)
Button (primary/ink, secondary/outline, ghost, danger/tally), Input, Textarea, Select, Tabs, Dialog, Sheet, Toast, Tooltip, Badge (status: draft/rendering/ready/failed), CreditCost (inline cost chip shown before any spend), ProgressRing, EmptyState, PhoneFrame, VideoPlayer, ContactSheet + FrameTile, SegmentTimeline, ComplianceFlag (inline, with rewrite action), StepWizard, DataTable (admin), Avatar, WorkspaceSwitcher.

Radius: 6px controls, 10px panels, 18px phone frames — radius follows hierarchy, not one value everywhere. Shadows: none on panels (use `--frame` borders); a single soft shadow only on floating elements (dialogs, popovers).

### 12.6 Motion
- One orchestrated moment on the landing page: the phone player cycling example ads.
- In-app motion only responds to actions: frame selection, render progress, segment reorder, dialog open.
- Respect `prefers-reduced-motion` everywhere.

### 12.7 Voice & copy
- Plain verbs, sentence case, no filler. A button says what happens: "Render 12 ads (12 credits)", then the toast says "Rendering 12 ads."
- Name things by what users know: "ads," "hooks," "presenter," "footage" — not "variants payload" or "segment hash."
- Errors say what happened and what to do: "Your footage is longer than 10 minutes. Trim it or upload a shorter clip."
- Empty states invite action: "No campaigns yet. Create your first one from your brand kit."

✏️ Owner notes (design system):
>
>

---

## 13. Code style guide

- TypeScript `strict: true`; no `any` (use `unknown` + Zod). No non-null assertions without a comment.
- **Naming:** files `kebab-case.ts`; components `PascalCase`; functions `camelCase` verbs (`createCampaign`, `spendCredits`); booleans `is/has/can`.
- **Server actions:** always `validate (Zod) → authorize (role + workspace) → service → revalidatePath/Tag`. Return a typed `Result<T, AppError>`; never throw to the client.
- **Errors:** `AppError` with `code` (`NOT_FOUND`, `FORBIDDEN`, `INSUFFICIENT_CREDITS`, `COMPLIANCE_BLOCKED`, `PROVIDER_FAILED`, `RATE_LIMITED`, `VALIDATION`) and a user-safe message.
- **Data access:** only in `queries.ts`/`service.ts`; every query is scoped by `workspaceId`.
- **Server vs client:** default to Server Components; add `"use client"` only for interactivity (editor, recorder, wizard steps).
- **Money & credits:** `Decimal`, never floats. All credit changes via the billing ledger.
- **Config over constants:** prices, limits, credit costs from `shared/config/plans.ts`.
- **Tests:** every `service.ts` has unit tests; each slice has at least one Playwright happy-path test.
- **Commits:** Conventional Commits (`feat(campaigns): add script matrix`).
- **Formatting/linting:** Prettier + ESLint with boundary rules; CI must pass before merge.

---

## 14. Build order & milestones `[V1]`

| # | Milestone | Slices | Outcome |
|---|---|---|---|
| M0 | Foundation | repo, env, db, auth, shared/ui tokens, app shell | Sign in, see empty dashboard with design system applied |
| M1 | Brand kit | brand-kits (+ URL extraction) | Create and edit a kit from a URL |
| M2 | Footage | footage | Upload/record footage with markers |
| M3 | Presenters | presenters (stock), Kokoro voice in the worker | Choose a stock presenter and hear its voice |
| M4 | Scripts & compliance | campaigns wizard steps 1–3, scripts, compliance | Generate a compliant script matrix |
| M5 | Previews | renders (PREVIEW), Remotion compositions | Free animatic previews for every variant |
| M6 | Billing | billing, plans, ledger, Stripe | Subscribe, get credits, see balance |
| M7 | HD renders | renders (HD), notifications | Spend credits, get HD ads, refunds on failure |
| M8 | Editor | editor | Free edits + segment re-voice |
| M9 | Library | library, export, review links | Export all ratios, share review link |
| M10 | Try-it | try-it | Anonymous URL → preview → sign-up conversion |
| M11 | Admin | admin | Users, costs, moderation, render health |
| M12 | Launch polish | landing, pricing, legal, SEO, error/empty states, e2e | Public launch |

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

# Neon Object Storage (from M2). Don't fill by hand: `neon env pull` writes these
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_ENDPOINT_URL_S3=
AWS_REGION=

SENTRY_DSN=
NEXT_PUBLIC_APP_URL=
```
All env vars are validated at startup in `src/shared/config/env.ts`.

---

## 16. Metrics to track from day one
- Try-it → sign-up conversion.
- Sign-up → first render (activation).
- Free → paid conversion.
- Renders per paying workspace per month; credits unused at period end.
- Provider cost per HD ad; gross margin per plan.
- Render failure rate and median render time.
- Compliance blocks per 100 scripts.

---

## 17. Open decisions (owner)
- [ ] Final product name, domain, logo. `TODO(owner)`
- [ ] Final prices and top-up price. `TODO(owner)`
- [x] Jobs platform: own worker + pg-boss on Neon (2026-09-23).
- [x] Render infra: Remotion in the same worker (2026-09-23).
- [ ] Worker host (Railway, Fly.io or VPS) and Remotion company-license check. `TODO(owner)`
- [x] Voice: self-hosted Kokoro (2026-09-23).
- [ ] Avatar provider bake-off — `[V1.1]`.
- [ ] Stock presenter portrait source. `TODO(owner)`
- [ ] Footage size/length caps per plan. `TODO(owner)`
- [ ] Legal review of Terms, Privacy, AI disclosure. `TODO(owner)`
- [ ] Typeface confirmation and color tuning. `TODO(owner)`

✏️ Owner notes (general):
>
>

import {
  defaultPresentation,
  flatCamera,
  mirrorCamera,
  moveDurationMs,
  shotPresets,
  type CameraSettings,
  type EasingName,
  type IntroKind,
  type Pace,
  type Presentation,
  type Shot,
  type ShotPresetName,
} from "@/shared/motion"

import type { Aim } from "./aim"
import type { Palette } from "./analysis"

/**
 * One-click looks, written as rules rather than a fixed loop of shots (a
 * repeating Float → Tilted card → Float… reads as cheap). Each look has:
 * an opener, a pool of body shots drawn in a varied but repeatable order
 * (never the same move within two moments, turning left then right, a calm
 * "rest" shot every few moves), a hero shot for the strongest moment and a
 * closer. Shots aim at the action the analysis found; nearby moments pan
 * instead of zooming out and back in; each move's time follows how far the
 * camera travels. Deterministic: a look gives the same cut every time, and
 * "New take" draws a different one.
 */
type Beat = {
  preset: ShotPresetName
  /** Adjusts the preset's camera (e.g. a gentler turn). */
  tweak?: Partial<CameraSettings>
  /** Aim at the action: "full" zooms right in, "soft" keeps angles readable. */
  aim?: "full" | "soft"
}

export type Look = {
  id: string
  title: string
  description: string
  intro: IntroKind
  introMs: number
  frame: Partial<Presentation["frame"]>
  opener: Beat
  pool: Beat[]
  hero: Beat
  closer: Beat
  /** A rest shot after this many moves in a row (0 = never). */
  restEvery: number
  rest: Beat
  easing: EasingName
  pace: Pace
  /** Drift for short and long holds. */
  drift: [number, number]
  /** Hard cuts between shots instead of moves. */
  cuts?: boolean
}

export const looks: Look[] = [
  {
    id: "launch",
    title: "Product launch",
    description: "Rises in, glides between angles, lands on the key feature.",
    intro: "rise",
    introMs: 1400,
    frame: { radius: 3, shadow: true, padding: 0.1 },
    opener: { preset: "hero-rise" },
    pool: [
      { preset: "flat", aim: "full" },
      { preset: "tilt-left", aim: "soft" },
      { preset: "tilt-right", aim: "soft" },
      { preset: "float", aim: "soft" },
      { preset: "push-in", aim: "full" },
    ],
    hero: { preset: "spotlight", aim: "full" },
    closer: { preset: "tilted-card" },
    restEvery: 3,
    rest: { preset: "flat" },
    easing: "smooth",
    pace: "normal",
    drift: [0.2, 0.5],
  },
  {
    id: "tour",
    title: "Product tour",
    description: "Calm, flat zooms to where things happen. Easy to follow.",
    intro: "none",
    introMs: 1200,
    frame: { radius: 2, shadow: true, padding: 0.05 },
    opener: { preset: "flat" },
    pool: [{ preset: "flat", aim: "full" }],
    hero: { preset: "flat", aim: "full", tweak: { zoom: 2.2 } },
    closer: { preset: "flat" },
    restEvery: 3,
    rest: { preset: "flat" },
    easing: "smooth",
    pace: "calm",
    drift: [0.05, 0.15],
  },
  {
    id: "hype",
    title: "Hype",
    description: "Punchy, snappy moves between bold angles. Built for feeds.",
    intro: "zoom-out",
    introMs: 900,
    frame: { radius: 2.5, shadow: true, padding: 0.06 },
    opener: { preset: "dramatic" },
    pool: [
      { preset: "dutch", aim: "soft" },
      { preset: "tilt-left", aim: "soft" },
      { preset: "tilt-right", aim: "soft" },
      { preset: "isometric" },
      { preset: "flat", aim: "full" },
      { preset: "low-angle", aim: "soft" },
    ],
    hero: { preset: "push-in", aim: "full", tweak: { zoom: 2.2 } },
    closer: { preset: "flat" },
    restEvery: 4,
    rest: { preset: "flat", aim: "full" },
    easing: "snappy",
    pace: "brisk",
    drift: [0, 0.15],
  },
  {
    id: "isometric",
    title: "Isometric",
    description:
      "A floating 3D product shot that glides from detail to detail.",
    intro: "rise",
    introMs: 1500,
    frame: { radius: 3, shadow: true, padding: 0.14 },
    opener: { preset: "isometric" },
    pool: [
      { preset: "isometric", aim: "soft" },
      { preset: "isometric-right", aim: "soft" },
      { preset: "orbit-left", aim: "soft" },
      { preset: "orbit-right", aim: "soft" },
    ],
    hero: { preset: "isometric", aim: "soft", tweak: { zoom: 1.6 } },
    closer: { preset: "flat" },
    restEvery: 0,
    rest: { preset: "flat" },
    easing: "smooth",
    pace: "calm",
    drift: [0.3, 0.6],
  },
  {
    id: "editorial",
    title: "Editorial",
    description: "Clean cuts between wide and close. Nothing moves for show.",
    intro: "none",
    introMs: 1200,
    frame: { radius: 2, shadow: true, padding: 0.08 },
    opener: { preset: "flat" },
    pool: [{ preset: "push-in", aim: "full" }, { preset: "flat" }],
    hero: { preset: "spotlight", aim: "full" },
    closer: { preset: "flat" },
    restEvery: 0,
    rest: { preset: "flat" },
    easing: "smooth",
    pace: "normal",
    drift: [0.05, 0.12],
    cuts: true,
  },
  {
    id: "dolly",
    title: "Dolly",
    description: "Slow, continuous pushes with a gentle sway. Cinematic.",
    intro: "zoom-out",
    introMs: 1600,
    frame: { radius: 3, shadow: true, padding: 0.1 },
    opener: { preset: "sway-left" },
    pool: [
      { preset: "sway-left", aim: "soft" },
      { preset: "sway-right", aim: "soft" },
      { preset: "flat", aim: "soft" },
    ],
    hero: { preset: "push-in", aim: "full" },
    closer: { preset: "flat" },
    restEvery: 0,
    rest: { preset: "flat" },
    easing: "smooth",
    pace: "calm",
    drift: [0.5, 0.9],
  },
]

/** A moment as looks see it: when, and where its action is. */
export type LookMoment = { id: string; atMs: number; aim?: Aim | null }

/** Small, fast, seedable random numbers (mulberry32). */
function random(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash(text: string) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  }
  return h >>> 0
}

const sameCamera = (a: CameraSettings, b: CameraSettings) =>
  (Object.keys(a) as (keyof CameraSettings)[]).every(
    (key) => Math.abs(a[key] - b[key]) < 0.001
  )
const beatKey = (beat: Beat) =>
  `${beat.preset}:${JSON.stringify(beat.tweak ?? {})}`
const turnSign = (camera: CameraSettings) => Math.sign(Math.round(camera.turn))
const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n))

/**
 * The strongest moment for the hero shot: among the middle moments, the
 * most focused action (highest aim zoom), nearest 60% of the way through.
 */
function heroIndex(ordered: LookMoment[]) {
  if (ordered.length < 3) return -1
  const first = ordered[0]!.atMs
  const span = Math.max(1, ordered.at(-1)!.atMs - first)
  let best = -1
  let bestScore = -Infinity
  for (let i = 1; i < ordered.length - 1; i++) {
    const moment = ordered[i]!
    const position = (moment.atMs - first) / span
    const score = (moment.aim?.zoom ?? 1) * 2 - Math.abs(position - 0.6)
    if (score > bestScore) {
      best = i
      bestScore = score
    }
  }
  return best
}

/**
 * How a take varies the same rules, so "New take" always looks different:
 * odd takes mirror every angle and rest a beat later, and each take steps
 * to another of three zoom depths.
 */
function takeStyle(take: number) {
  return {
    mirror: take % 2 === 1,
    depth: [1, 0.9, 1.1][take % 3]!,
    restShift: take % 2,
  }
}
type TakeStyle = ReturnType<typeof takeStyle>

/** The camera for a beat at a moment: the preset, tweaked and aimed. */
function cameraFor(
  beat: Beat,
  aim: Aim | null | undefined,
  style: TakeStyle = takeStyle(0)
): CameraSettings {
  let camera = { ...shotPresets[beat.preset].camera, ...beat.tweak }
  if (style.mirror) camera = mirrorCamera(camera)
  if (!beat.aim || !aim) return camera
  // As close as the action needs (or the shot's own zoom, if deeper),
  // scaled by the take's depth; angled shots stop at 1.45× to stay legible.
  const wanted = Math.max(camera.zoom, aim.zoom)
  const deep = 1 + (wanted - 1) * style.depth
  const zoom =
    beat.aim === "full" ? deep : Math.min(deep, Math.max(camera.zoom, 1.45))
  return {
    ...camera,
    focusX: aim.focusX,
    focusY: aim.focusY,
    zoom: Math.round(clamp(zoom, 1, 3) * 100) / 100,
  }
}

/**
 * Applies a look to every moment. Focus points the owner picked (not the
 * centre) are kept. `take` picks a different, equally varied cut.
 */
export function applyLook(
  lookId: string,
  moments: LookMoment[],
  current: { shots: Record<string, Shot | null>; presentation: Presentation },
  options: { take?: number } = {}
) {
  const look = looks.find((candidate) => candidate.id === lookId)
  if (!look) throw new Error(`Unknown look: ${lookId}`)
  const ordered = [...moments].sort((a, b) => a.atMs - b.atMs)
  const next = random(
    hash(`${look.id}:${options.take ?? 0}:${ordered.map((m) => m.id).join()}`)
  )
  const hero = heroIndex(ordered)
  const style = takeStyle(options.take ?? 0)
  const restEvery = look.restEvery > 0 ? look.restEvery + style.restShift : 0

  const shots: Record<string, Shot | null> = {}
  const recent: string[] = []
  let sinceRest = 0
  let previous: { camera: CameraSettings; beat: Beat; aim: Aim | null } = {
    camera: flatCamera,
    beat: look.rest,
    aim: null,
  }
  let lastTurn = 0

  ordered.forEach((moment, index) => {
    const isLast = index === ordered.length - 1 && ordered.length >= 3
    let beat: Beat
    if (index === 0) beat = look.opener
    else if (index === hero) beat = look.hero
    else if (isLast) beat = look.closer
    else if (
      restEvery > 0 &&
      sinceRest >= restEvery &&
      // A rest right after a shot that already looks like one says nothing.
      !sameCamera(cameraFor(look.rest, moment.aim, style), previous.camera)
    ) {
      beat = look.rest
    } else {
      // No move repeats within two moments (when the pool allows), and
      // shots turn the other way from the last turned one.
      const fresh = (keep: number) =>
        look.pool.filter((b) => !recent.slice(-keep).includes(beatKey(b)))
      let candidates = fresh(2)
      if (candidates.length === 0) candidates = fresh(1)
      if (candidates.length === 0) candidates = look.pool
      const flips = candidates.filter((b) => {
        const sign = turnSign(cameraFor(b, null, style))
        return sign === 0 || sign !== lastTurn
      })
      if (flips.length > 0) candidates = flips
      beat = candidates[Math.floor(next() * candidates.length)]!
    }

    let camera = cameraFor(beat, moment.aim, style)
    // Zoomed in and the next action is close by: pan straight there at
    // the same zoom, instead of zooming out and back in.
    const aim = moment.aim ?? null
    if (
      beat.aim === "full" &&
      previous.beat.aim === "full" &&
      aim &&
      previous.aim &&
      index !== hero &&
      Math.hypot(
        aim.focusX - previous.aim.focusX,
        aim.focusY - previous.aim.focusY
      ) < 0.35
    ) {
      camera = {
        ...camera,
        zoom: clamp(Math.max(previous.camera.zoom, camera.zoom), 1, 3),
      }
    }
    // A focus the owner picked (not the centre) matters more than the look.
    const owned = current.shots[moment.id]?.camera
    if (owned && (owned.focusX !== 0.5 || owned.focusY !== 0.5)) {
      camera = { ...camera, focusX: owned.focusX, focusY: owned.focusY }
    }

    // Longer holds drift more; rests barely.
    const nextAt = ordered[index + 1]?.atMs
    const hold = nextAt === undefined ? 4000 : nextAt - moment.atMs
    const [low, high] = look.drift
    const drift =
      beat === look.rest ? low : low + (high - low) * clamp(hold / 6000, 0, 1)

    let transitionMs = look.cuts
      ? 0
      : moveDurationMs(previous.camera, camera, look.pace)
    // Never slower than the gap to the moment before.
    const gap = index > 0 ? moment.atMs - ordered[index - 1]!.atMs : Infinity
    if (transitionMs > gap * 0.8) {
      transitionMs = Math.max(0, Math.floor((gap * 0.8) / 50) * 50)
    }

    shots[moment.id] = {
      camera,
      transitionMs,
      easing: look.easing,
      drift: Math.round(drift * 100) / 100,
    }

    recent.push(beatKey(beat))
    sinceRest = beat === look.rest ? 0 : sinceRest + 1
    const sign = turnSign(camera)
    if (sign !== 0) lastTurn = sign
    previous = { camera, beat, aim }
  })

  return {
    shots,
    presentation: {
      ...current.presentation,
      intro: { kind: look.intro, durationMs: look.introMs },
      frame: { ...current.presentation.frame, ...look.frame },
    },
  }
}

/** Back to flat: no shots, no intro, the default frame. */
export function resetLook(moments: LookMoment[], presentation: Presentation) {
  return {
    shots: Object.fromEntries(moments.map((moment) => [moment.id, null])),
    presentation: {
      ...presentation,
      intro: { ...presentation.intro, kind: "none" as const },
      frame: defaultPresentation.frame,
    },
  }
}

/** Mixes a hex colour toward white (+) or black (−) by `amount` (0–1). */
export function shade(hex: string, amount: number) {
  const target = amount >= 0 ? 255 : 0
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return `#${channels
    .map((c) =>
      Math.round(c + (target - c) * Math.abs(amount))
        .toString(16)
        .padStart(2, "0")
    )
    .join("")}`
}

/**
 * Backgrounds matched to the footage's own colours (§7.4b): its accent
 * (buttons, charts) as a gradient, and a tone just off its main colour.
 */
export function footageBackgrounds(palette: Palette | null) {
  const presets: { name: string; background: Presentation["background"] }[] = []
  const [accent, second] = palette?.accents ?? []
  if (accent) {
    presets.push({
      name: "Footage accent",
      background: {
        kind: "gradient",
        from: accent,
        to: second ?? shade(accent, -0.45),
      },
    })
  }
  const main = palette?.colors[0]?.hex
  if (main) {
    presets.push({
      name: "Footage tone",
      background: {
        kind: "gradient",
        from: shade(main, palette.isDark ? 0.14 : -0.06),
        to: shade(main, palette.isDark ? -0.25 : -0.16),
      },
    })
  }
  return presets
}

/**
 * Ready-made backgrounds: "Brand" uses the kit's colours when it has them,
 * then the ones matched to the footage, then fixed presets.
 */
export function backgroundPresets(
  brand: string[],
  palette: Palette | null = null
) {
  const presets: { name: string; background: Presentation["background"] }[] = [
    {
      name: "Midnight",
      background: { kind: "gradient", from: "#0f172a", to: "#334155" },
    },
    {
      name: "Sunset",
      background: { kind: "gradient", from: "#f97316", to: "#db2777" },
    },
    {
      name: "Ocean",
      background: { kind: "gradient", from: "#0ea5e9", to: "#1e3a8a" },
    },
    {
      name: "Mint",
      background: { kind: "gradient", from: "#34d399", to: "#065f46" },
    },
    {
      name: "Lilac",
      background: { kind: "gradient", from: "#c4b5fd", to: "#6d28d9" },
    },
    {
      name: "Paper",
      background: { kind: "solid", from: "#f5f5f4", to: "#f5f5f4" },
    },
    {
      name: "Studio",
      background: { kind: "solid", from: "#15171c", to: "#15171c" },
    },
  ]
  presets.unshift(...footageBackgrounds(palette))
  const [first, second] = brand
  if (first) {
    presets.unshift({
      name: "Brand",
      background: { kind: "gradient", from: first, to: second ?? first },
    })
  }
  return presets
}

import {
  defaultPresentation,
  shotPresets,
  type EasingName,
  type IntroKind,
  type Presentation,
  type Shot,
  type ShotPresetName,
} from "@/shared/motion"

/**
 * One-click looks: each gives every key moment a shot (cycling through a
 * sequence), and sets the intro and frame. Deterministic, no AI.
 */
type Look = {
  id: string
  title: string
  description: string
  intro: IntroKind
  sequence: ShotPresetName[]
  transitionMs: number
  easing: EasingName
  drift: number
  frame?: Partial<Presentation["frame"]>
}

export const looks: Look[] = [
  {
    id: "launch",
    title: "Product launch",
    description: "Flies in, then glides between angled views.",
    intro: "fly-left",
    sequence: ["tilt-left", "push-in", "tilt-right", "float"],
    transitionMs: 900,
    easing: "smooth",
    drift: 0.3,
    frame: { radius: 3, shadow: true, padding: 0.12 },
  },
  {
    id: "showcase",
    title: "Showcase",
    description: "Alternating orbits with a slow drift.",
    intro: "zoom-out",
    sequence: ["orbit-left", "orbit-right"],
    transitionMs: 1200,
    easing: "smooth",
    drift: 0.5,
  },
  {
    id: "feature-zoom",
    title: "Feature zoom",
    description: "Stays flat and pushes in on each moment.",
    intro: "none",
    sequence: ["push-in"],
    transitionMs: 700,
    easing: "smooth",
    drift: 0.2,
  },
  {
    id: "cinematic",
    title: "Cinematic",
    description: "Hero rise and long, sweeping moves.",
    intro: "rise",
    sequence: ["hero-rise", "side-sweep-left", "birds-eye", "side-sweep-right"],
    transitionMs: 1600,
    easing: "smooth",
    drift: 0.6,
  },
  {
    id: "energetic",
    title: "Energetic",
    description: "Snappy moves between bold angles.",
    intro: "fly-right",
    sequence: ["dramatic", "isometric", "dutch", "spotlight"],
    transitionMs: 450,
    easing: "snappy",
    drift: 0,
  },
  {
    id: "floating",
    title: "Floating card",
    description: "A soft, tilted card with room to breathe.",
    intro: "rise",
    sequence: ["float", "tilted-card"],
    transitionMs: 1100,
    easing: "smooth",
    drift: 0.4,
    frame: { radius: 5, shadow: true, padding: 0.18 },
  },
]

type Moment = { id: string; atMs: number }

/** Applies a look to every moment; focus points the owner set are kept. */
export function applyLook(
  lookId: string,
  moments: Moment[],
  current: { shots: Record<string, Shot | null>; presentation: Presentation }
) {
  const look = looks.find((candidate) => candidate.id === lookId)
  if (!look) throw new Error(`Unknown look: ${lookId}`)
  const ordered = [...moments].sort((a, b) => a.atMs - b.atMs)
  const shots: Record<string, Shot | null> = {}
  ordered.forEach((moment, index) => {
    const preset = look.sequence[index % look.sequence.length] ?? "flat"
    const camera = { ...shotPresets[preset].camera }
    const previous = current.shots[moment.id]?.camera
    // A focus the owner picked (not the centre) matters more than the look.
    if (previous && (previous.focusX !== 0.5 || previous.focusY !== 0.5)) {
      camera.focusX = previous.focusX
      camera.focusY = previous.focusY
    }
    shots[moment.id] = {
      camera,
      transitionMs: look.transitionMs,
      easing: look.easing,
      drift: look.drift,
    }
  })
  return {
    shots,
    presentation: {
      ...current.presentation,
      intro: { ...current.presentation.intro, kind: look.intro },
      frame: { ...current.presentation.frame, ...look.frame },
    },
  }
}

/** Back to flat: no shots, no intro, the default frame. */
export function resetLook(moments: Moment[], presentation: Presentation) {
  return {
    shots: Object.fromEntries(moments.map((moment) => [moment.id, null])),
    presentation: {
      ...presentation,
      intro: { ...presentation.intro, kind: "none" as const },
      frame: defaultPresentation.frame,
    },
  }
}

/** Ready-made backgrounds; "Brand" uses the kit's colours when it has them. */
export function backgroundPresets(brand: string[]) {
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
  const [first, second] = brand
  if (first) {
    presets.unshift({
      name: "Brand",
      background: { kind: "gradient", from: first, to: second ?? first },
    })
  }
  return presets
}

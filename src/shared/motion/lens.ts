import { z } from "zod"

import type { CameraPose } from "./presets"

/**
 * Lens effects (§7.4b, owner-added 2026-09-27): depth of field and
 * progressive blur, both drawn inside the frame as stacked blur layers
 * with gradient masks. (Stage-wide blur is left out: Chrome's backdrop
 * filter misreads a 3D-transformed video beneath it.)
 *
 * Depth of field follows a thin lens focused on the camera's focus point.
 * A point `z` in front of that plane (CSS z, toward the viewer) is at
 * distance P − z from a viewer P away (the stage's perspective), and its
 * circle of confusion on screen is c = A·|z| / (P − z) for an aperture A.
 * The frame's content is blurred *before* the 3D transform, where the
 * projection magnifies by P / (P − z) and the zoom by `zoom`, so the blur
 * to apply in the frame's own pixels is c·(P − z)/(P·zoom) = A·|z|/(P·zoom).
 * With z = zoom·(gx·dx + gy·dy) for a rotated plane, that is exactly
 * A·|gx·dx + gy·dy| / P: linear in the frame's coordinates, so straight
 * gradient masks reproduce it (no approximation but the layer count).
 *
 * Like a real lens, a band around the focus plane stays sharp: blur only
 * shows once the circle of confusion passes the acceptable one (the
 * "depth of field" proper), so the subject reads crisply and the image
 * softens gradually away from it instead of from a single sharp line.
 */
export const fStops = [1.4, 2, 2.8, 4, 5.6, 8] as const
export type FStop = (typeof fStops)[number]

export const blurEdges = [
  "top",
  "bottom",
  "both",
  "left",
  "right",
  "edges",
] as const
export type BlurEdge = (typeof blurEdges)[number]

export const lensSchema = z.object({
  depthOfField: z
    .object({
      enabled: z.boolean(),
      fStop: z
        .number()
        .refine((n) => (fStops as readonly number[]).includes(n)),
      /** Most blur allowed, in % of the stage's width. */
      maxBlur: z.number().min(0.2).max(3),
    })
    .default({ enabled: false, fStop: 2.8, maxBlur: 0.6 }),
  progressiveBlur: z
    .object({
      enabled: z.boolean(),
      from: z.enum(blurEdges),
      /** Blur at the edge, in % of the stage's width. */
      strength: z.number().min(0.1).max(2.5),
      /** How far in from the edge it reaches (0–1 of the area). */
      reach: z.number().min(0.1).max(0.7),
    })
    .default({
      enabled: false,
      from: "bottom",
      strength: 0.8,
      reach: 0.3,
    }),
})
export type Lens = z.output<typeof lensSchema>

export const defaultLens: Lens = lensSchema.parse({})

/** A blur layer: CSS blur radius (px) and the mask where it shows. */
export type BlurLayer = { blurPx: number; mask: string }

/** Layers per effect: more are smoother, each costs a blur pass. */
const layerCount = 6

/**
 * The aperture's diameter in stage pixels for an f-stop, tuned so f/1.4
 * on a 28° turn blurs the far edge about 1% of the stage's width.
 */
export const apertureFor = (fStop: number, stageWidth: number) =>
  (stageWidth * 0.1225) / fStop

/**
 * The largest circle of confusion that still reads as sharp, in stage px:
 * 1/800 of the width (2.4 px at 1080p), a little looser than print's
 * d/1500 because video is watched moving and scaled down.
 */
export const acceptableCoc = (stageWidth: number) => stageWidth / 800

/** CSS blur (a Gaussian's σ) that looks like a circle of confusion `c`. */
const sigmaFor = (coc: number) => coc * 0.42

/**
 * How depth changes across the frame for a pose: z = zoom·(gx·dx + gy·dy)
 * for a point (dx, dy) px from the focus point, with CSS's rotateX, then
 * rotateY, then rotateZ (y down, z toward the viewer).
 */
export function depthGradient(pose: CameraPose) {
  const rad = Math.PI / 180
  const a = pose.tilt * rad
  const b = pose.turn * rad
  const c = pose.roll * rad
  // Third row of Rx(a)·Ry(b)·Rz(c).
  return {
    gx: -Math.cos(a) * Math.sin(b) * Math.cos(c) + Math.sin(a) * Math.sin(c),
    gy: Math.cos(a) * Math.sin(b) * Math.sin(c) + Math.sin(a) * Math.cos(c),
  }
}

/**
 * The blur to apply (CSS px, in the frame's own pixels) at a point `dx`,
 * `dy` px from the focus point, before any cap. Exact for the thin lens.
 */
export function depthBlurAt(input: {
  pose: CameraPose
  dx: number
  dy: number
  fStop: number
  stageWidth: number
  perspectivePx: number
}) {
  const { gx, gy } = depthGradient(input.pose)
  const coc =
    (apertureFor(input.fStop, input.stageWidth) *
      Math.abs(gx * input.dx + gy * input.dy)) /
    input.perspectivePx
  // The acceptable circle in the frame's own pixels (the zoom magnifies).
  const sharp = acceptableCoc(input.stageWidth) / input.pose.zoom
  return sigmaFor(Math.max(0, coc - sharp))
}

const px = (n: number) => `${n.toFixed(2)}px`

/**
 * Incremental blur per layer: each layer blurs what's under it, and
 * Gaussians add in quadrature, so layer k blurs √(Tₖ² − Tₖ₋₁²) to reach Tₖ.
 */
function increments(targets: number[]) {
  return targets.map((t, i) => Math.sqrt(t * t - (targets[i - 1] ?? 0) ** 2))
}

/**
 * Depth-of-field layers for the frame at a pose (frame-local px). None
 * when the frame faces the camera (all of it is in focus, as with a real
 * lens) or the blur never reaches half a pixel.
 */
export function depthOfFieldLayers(input: {
  pose: CameraPose
  frameWidth: number
  frameHeight: number
  stageWidth: number
  perspectivePx: number
  fStop: number
  /** Cap, in % of the stage's width. */
  maxBlur: number
}): BlurLayer[] {
  const { pose, frameWidth: w, frameHeight: h } = input
  const { gx, gy } = depthGradient(pose)
  const length = Math.hypot(gx, gy)
  if (length < 1e-4) return []
  // Blur grows by `slope` px for each px along the depth direction.
  const slope = sigmaFor(
    (apertureFor(input.fStop, input.stageWidth) * length) / input.perspectivePx
  )
  // CSS gradient angle whose direction (sin θ, −cos θ) is the depth's.
  const nx = gx / length
  const ny = gy / length
  const theta = Math.atan2(nx, -ny)
  const line = Math.abs(w * Math.sin(theta)) + Math.abs(h * Math.cos(theta))
  const along = (x: number, y: number) =>
    (x - w / 2) * Math.sin(theta) - (y - h / 2) * Math.cos(theta) + line / 2
  const focus = along(pose.focusX * w, pose.focusY * h)
  // The farthest the frame gets from the focus line, and its blur.
  const reach = Math.max(focus, line - focus)
  const cap = (input.maxBlur / 100) * input.stageWidth
  // Blur past the sharp zone: σ(d) = slope·d − offset, 0 inside ±d₀.
  const offset = sigmaFor(acceptableCoc(input.stageWidth) / pose.zoom)
  const top = Math.min(cap, slope * reach - offset)
  if (top < 0.5) return []

  const targets = Array.from(
    { length: layerCount },
    (_, i) => (top * (i + 1)) / layerCount
  )
  const steps = increments(targets)
  return targets.map((target, i) => {
    const inner = ((targets[i - 1] ?? 0) + offset) / slope
    const outer = (target + offset) / slope
    const mask = `linear-gradient(${((theta * 180) / Math.PI).toFixed(2)}deg, #000 0px, #000 ${px(focus - outer)}, transparent ${px(focus - inner)}, transparent ${px(focus + inner)}, #000 ${px(focus + outer)}, #000 ${px(line)})`
    return { blurPx: Number(steps[i]!.toFixed(3)), mask }
  })
}

/**
 * Progressive blur layers for a box `width`×`height`: no blur `reach` in
 * from the chosen edge(s), rising evenly to `strength` at the edge.
 */
export function progressiveBlurLayers(input: {
  from: BlurEdge
  strength: number
  reach: number
  width: number
  height: number
  stageWidth: number
}): BlurLayer[] {
  const top = (input.strength / 100) * input.stageWidth
  if (top < 0.5) return []
  const targets = Array.from(
    { length: layerCount },
    (_, i) => (top * (i + 1)) / layerCount
  )
  const steps = increments(targets)
  // Where blur k starts and is complete, as fractions of the reach (0 at
  // the inner edge of the blurred band, 1 at the frame's edge).
  const at = (k: number) => (targets[k] ?? 0) / top
  return targets.map((_, i) => {
    const start = at(i - 1)
    const full = at(i)
    const pct = (f: number) => `${(f * 100).toFixed(2)}%`
    // Distance from the edge inward, as a % of the length, for fraction f.
    const fromEdge = (f: number) => input.reach * (1 - f)
    let mask: string
    if (input.from === "edges") {
      const inner = 1 - fromEdge(start)
      const outer = 1 - fromEdge(full)
      mask = `radial-gradient(closest-side, transparent ${pct(inner)}, #000 ${pct(outer)})`
    } else if (input.from === "both") {
      mask = `linear-gradient(180deg, #000 0%, #000 ${pct(fromEdge(full))}, transparent ${pct(fromEdge(start))}, transparent ${pct(1 - fromEdge(start))}, #000 ${pct(1 - fromEdge(full))}, #000 100%)`
    } else {
      const angle = { top: 0, right: 90, bottom: 180, left: 270 }[input.from]
      // Toward the edge: clear, then ramping to full blur.
      mask = `linear-gradient(${angle}deg, transparent ${pct(1 - fromEdge(start))}, #000 ${pct(1 - fromEdge(full))})`
    }
    return { blurPx: Number(steps[i]!.toFixed(3)), mask }
  })
}

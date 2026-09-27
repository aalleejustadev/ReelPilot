import {
  outputDuration,
  toOutput,
  toOutputNearest,
  type ClipEdit,
} from "./edit"
import type { GraphicItem } from "./graphics"
import { flatCamera, type CameraPose } from "./presets"
import type { Presentation } from "./schema"
import { cameraTimeline, type TimedShot } from "./timeline"

/**
 * The stage's geometry, shared by the composition (which draws it) and
 * the editor (which lets you grab things on it), so both agree exactly.
 */
export const perspectiveFor = (stageWidth: number) => 1.4 * stageWidth

/** Where the frame sits: centred, fitted inside the padded stage. */
export function frameGeometry(input: {
  width: number
  height: number
  padding: number
  videoWidth: number
  videoHeight: number
}) {
  // CSS padding is a % of the width on all four sides.
  const pad = input.padding * input.width
  const frameWidth = Math.max(
    1,
    Math.min(
      input.width - 2 * pad,
      ((input.height - 2 * pad) * input.videoWidth) /
        Math.max(1, input.videoHeight)
    )
  )
  const frameHeight =
    (frameWidth * input.videoHeight) / Math.max(1, input.videoWidth)
  return {
    frameWidth,
    frameHeight,
    left: (input.width - frameWidth) / 2,
    top: (input.height - frameHeight) / 2,
  }
}
export type FrameGeometry = ReturnType<typeof frameGeometry>

// ── Split layouts: the video on one side, text on the other ───────────────

/** How long the frame takes to glide into a split, and back out. */
export const splitInMs = 650
export const splitOutMs = 550

type Rect = { x: number; y: number; w: number; h: number }

/**
 * A split's two areas in stage px. Wide stages split side by side (the
 * video left or right); tall and square ones stack (left = video on top),
 * where a half-width column would leave a landscape video tiny.
 */
export function splitAreas(input: {
  width: number
  height: number
  side: GraphicItem["side"]
}): { video: Rect; text: Rect; stacked: boolean } {
  const { width: w, height: h } = input
  const first = input.side !== "right" && input.side !== "bottom"
  const stacked = w / h < 1.3
  if (stacked) {
    const top = { x: 0, y: 0, w, h: h / 2 }
    const bottom = { x: 0, y: h / 2, w, h: h / 2 }
    return first
      ? { video: top, text: bottom, stacked }
      : { video: bottom, text: top, stacked }
  }
  const left = { x: 0, y: 0, w: w / 2, h }
  const right = { x: w / 2, y: 0, w: w / 2, h }
  return first
    ? { video: left, text: right, stacked }
    : { video: right, text: left, stacked }
}

/** The frame's 2D move on the stage: scale about the centre, then shift. */
export type StageLayout = { scale: number; dx: number; dy: number }
export const fullLayout: StageLayout = { scale: 1, dx: 0, dy: 0 }

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))

/** How far into its split a graphic is at `adMs` (0 = full, 1 = split). */
export function splitProgress(startMs: number, lengthMs: number, adMs: number) {
  if (adMs < startMs || adMs >= startMs + lengthMs) return 0
  const inMs = Math.min(splitInMs, lengthMs / 2)
  const outMs = Math.min(splitOutMs, lengthMs / 2)
  return easeInOutCubic(
    clamp01(
      Math.min((adMs - startMs) / inMs, (startMs + lengthMs - adMs) / outMs)
    )
  )
}

/**
 * Where the frame sits at `adMs`: full stage, or gliding into (or out of)
 * the video's half of a split. The frame keeps its size and camera; the
 * whole view scales into the half, so every effect on it stays exact.
 */
export function stageLayoutAt(input: {
  graphics: GraphicItem[]
  edit: ClipEdit
  durationMs: number
  adMs: number
  width: number
  height: number
  padding: number
  videoWidth: number
  videoHeight: number
}): StageLayout {
  // The top layer's split wins if two overlap.
  const active = input.graphics
    .filter((g) => g.kind === "split")
    .map((g) => ({
      item: g,
      t: splitProgress(
        toOutputNearest(input.edit, input.durationMs, g.atMs),
        g.durationMs,
        input.adMs
      ),
    }))
    .filter((entry) => entry.t > 0)
    .sort((a, b) => b.item.track - a.item.track)[0]
  if (!active) return fullLayout
  const { width, height, videoWidth, videoHeight } = input
  const full = frameGeometry({ ...input })
  const area = splitAreas({ width, height, side: active.item.side }).video
  // Keep the stage's padding (in stage px), a little tighter at the seam.
  const pad = Math.max(0.025, input.padding * 0.4) * width
  const half = frameGeometry({
    width: area.w,
    height: area.h,
    padding: pad / area.w,
    videoWidth,
    videoHeight,
  })
  const target = {
    scale: half.frameWidth / full.frameWidth,
    dx: area.x + half.left + half.frameWidth / 2 - width / 2,
    dy: area.y + half.top + half.frameHeight / 2 - height / 2,
  }
  const t = active.t
  return {
    scale: 1 + (target.scale - 1) * t,
    dx: target.dx * t,
    dy: target.dy * t,
  }
}

/** A layout as CSS on an element filling the stage (origin = centre). */
export const layoutTransform = (layout: StageLayout) =>
  layout.scale === 1 && layout.dx === 0 && layout.dy === 0
    ? undefined
    : `translate(${layout.dx.toFixed(2)}px, ${layout.dy.toFixed(2)}px) scale(${layout.scale.toFixed(5)})`

/**
 * The camera at any time of the ad: moments in cut footage drop out, the
 * rest move to ad time. Reduced motion cuts between shots.
 */
export function stageCamera(input: {
  presentation: Presentation
  shots: TimedShot[]
  durationMs: number
  reduceMotion?: boolean
}) {
  const { edit } = input.presentation
  const timed = input.shots.flatMap((entry) => {
    const atMs = toOutput(edit, input.durationMs, entry.atMs)
    return atMs === null
      ? []
      : [
          {
            atMs,
            shot: input.reduceMotion
              ? { ...entry.shot, transitionMs: 0 }
              : entry.shot,
          },
        ]
  })
  const intro = input.reduceMotion
    ? { ...input.presentation.intro, kind: "none" as const }
    : input.presentation.intro
  const timeline = cameraTimeline(
    timed,
    intro,
    outputDuration(edit, input.durationMs)
  )
  const splits = input.presentation.graphics
    .filter((g) => g.kind === "split")
    .map((g) => ({
      startMs: toOutputNearest(edit, input.durationMs, g.atMs),
      lengthMs: g.durationMs,
    }))
  if (splits.length === 0) return timeline
  // In a split the camera settles, so the whole video sits in its half:
  // zoom and pan ease out, angles soften to a gentle 3D tilt.
  return (atMs: number): CameraPose => {
    const pose = timeline(atMs)
    const t = Math.max(
      ...splits.map((s) => splitProgress(s.startMs, s.lengthMs, atMs))
    )
    if (t === 0) return pose
    const k = 1 - t
    const soft = 1 - 0.6 * t
    return {
      ...pose,
      zoom: 1 + (pose.zoom - 1) * k,
      x: pose.x * k,
      y: pose.y * k,
      tilt: pose.tilt * soft,
      turn: pose.turn * soft,
      roll: pose.roll * k,
    }
  }
}

export const flatPose: CameraPose = { ...flatCamera, x: 0, y: 0 }

type Vec3 = [number, number, number]

/**
 * The frame's projection onto the stage for a pose: CSS's
 * translate · rotateX · rotateY · rotateZ · scale about the focus point,
 * then the stage's perspective about its centre. A plane seen in
 * perspective is a homography, so it inverts exactly: `toFrame` finds the
 * point on the (tilted) screen under a point on the stage.
 */
export function frameProjection(input: {
  pose: CameraPose
  geometry: FrameGeometry
  width: number
  height: number
  /** A split's move of the whole view (default: none). */
  layout?: StageLayout
}) {
  const { pose, geometry: g } = input
  const L = input.layout ?? fullLayout
  const P = perspectiveFor(input.width)
  const rad = Math.PI / 180
  const [a, b, c] = [pose.tilt * rad, pose.turn * rad, pose.roll * rad]
  const rx = [
    [1, 0, 0],
    [0, Math.cos(a), -Math.sin(a)],
    [0, Math.sin(a), Math.cos(a)],
  ]
  const ry = [
    [Math.cos(b), 0, Math.sin(b)],
    [0, 1, 0],
    [-Math.sin(b), 0, Math.cos(b)],
  ]
  const rz = [
    [Math.cos(c), -Math.sin(c), 0],
    [Math.sin(c), Math.cos(c), 0],
    [0, 0, 1],
  ]
  const mul = (m: number[][], n: number[][]) =>
    m.map((row) =>
      [0, 1, 2].map((j) => row.reduce((sum, v, k) => sum + v * n[k]![j]!, 0))
    )
  const r = mul(mul(rx, ry), rz)
  // Columns of R·scale(zoom) for the frame's x and y axes.
  const ax: Vec3 = [
    r[0]![0]! * pose.zoom,
    r[1]![0]! * pose.zoom,
    r[2]![0]! * pose.zoom,
  ]
  const ay: Vec3 = [
    r[0]![1]! * pose.zoom,
    r[1]![1]! * pose.zoom,
    r[2]![1]! * pose.zoom,
  ]
  const ox = pose.focusX * g.frameWidth
  const oy = pose.focusY * g.frameHeight
  // The focus point on the stage (translate() moves it by % of the frame).
  const origin: Vec3 = [
    g.left + ox + pose.x * g.frameWidth,
    g.top + oy + pose.y * g.frameHeight,
    0,
  ]
  // world(u, v) = origin + (u − ox)·ax + (v − oy)·ay
  const base: Vec3 = [
    origin[0] - ox * ax[0] - oy * ay[0],
    origin[1] - ox * ax[1] - oy * ay[1],
    origin[2] - ox * ax[2] - oy * ay[2],
  ]
  const cx = input.width / 2
  const cy = input.height / 2
  // Perspective about (cx, cy): X = (P·wx − cx·wz) / (P − wz), same for Y.
  const project = (w: Vec3, isPoint: boolean): Vec3 => [
    P * w[0] - cx * w[2],
    P * w[1] - cy * w[2],
    (isPoint ? P : 0) - w[2],
  ]
  const h0 = project(ax, false)
  const h1 = project(ay, false)
  const h2 = project(base, true)
  // H maps (u, v, 1) → homogeneous stage point: columns h0, h1, h2.
  const H = [
    [h0[0], h1[0], h2[0]],
    [h0[1], h1[1], h2[1]],
    [h0[2], h1[2], h2[2]],
  ]
  const det =
    H[0]![0]! * (H[1]![1]! * H[2]![2]! - H[1]![2]! * H[2]![1]!) -
    H[0]![1]! * (H[1]![0]! * H[2]![2]! - H[1]![2]! * H[2]![0]!) +
    H[0]![2]! * (H[1]![0]! * H[2]![1]! - H[1]![1]! * H[2]![0]!)
  const inv = [
    [
      H[1]![1]! * H[2]![2]! - H[1]![2]! * H[2]![1]!,
      H[0]![2]! * H[2]![1]! - H[0]![1]! * H[2]![2]!,
      H[0]![1]! * H[1]![2]! - H[0]![2]! * H[1]![1]!,
    ],
    [
      H[1]![2]! * H[2]![0]! - H[1]![0]! * H[2]![2]!,
      H[0]![0]! * H[2]![2]! - H[0]![2]! * H[2]![0]!,
      H[0]![2]! * H[1]![0]! - H[0]![0]! * H[1]![2]!,
    ],
    [
      H[1]![0]! * H[2]![1]! - H[1]![1]! * H[2]![0]!,
      H[0]![1]! * H[2]![0]! - H[0]![0]! * H[2]![1]!,
      H[0]![0]! * H[1]![1]! - H[0]![1]! * H[1]![0]!,
    ],
  ].map((row) => row.map((v) => v / det))
  const apply = (m: number[][], x: number, y: number) => {
    const w = m[2]![0]! * x + m[2]![1]! * y + m[2]![2]!
    return {
      x: (m[0]![0]! * x + m[0]![1]! * y + m[0]![2]!) / w,
      y: (m[1]![0]! * x + m[1]![1]! * y + m[1]![2]!) / w,
    }
  }
  // The split's move, about the stage's centre.
  const out = (p: { x: number; y: number }) => ({
    x: cx + (p.x - cx) * L.scale + L.dx,
    y: cy + (p.y - cy) * L.scale + L.dy,
  })
  return {
    /** A point on the frame (its own px) → on the stage (composition px). */
    toStage: (u: number, v: number) => out(apply(H, u, v)),
    /** A point on the stage → the point of the frame under it. */
    toFrame: (x: number, y: number) =>
      apply(
        inv,
        cx + (x - L.dx - cx) / L.scale,
        cy + (y - L.dy - cy) / L.scale
      ),
  }
}

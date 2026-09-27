import { outputDuration, toOutput } from "./edit"
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
  return cameraTimeline(timed, intro, outputDuration(edit, input.durationMs))
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
}) {
  const { pose, geometry: g } = input
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
  return {
    /** A point on the frame (its own px) → on the stage (composition px). */
    toStage: (u: number, v: number) => apply(H, u, v),
    /** A point on the stage → the point of the frame under it. */
    toFrame: (x: number, y: number) => apply(inv, x, y),
  }
}

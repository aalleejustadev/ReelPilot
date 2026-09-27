import { flatCamera, introPoses, type CameraPose } from "./presets"
import type { EasingName, Presentation, Shot } from "./schema"

const flatPose: CameraPose = { ...flatCamera, x: 0, y: 0 }
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))

export type TimedShot = { atMs: number; shot: Shot }

/**
 * The camera moves on springs (like Screen Studio and Cap), solved in
 * closed form so every frame is exact and the preview and render agree.
 * Each channel is a damped spring pulled toward the shot; zoom runs in log
 * space so zooming in and out feel equally fast. A new shot starts from
 * the camera's position *and speed*, so interrupted moves flow on.
 *
 * "Move takes" is when the camera has visibly landed (about 98%):
 * - smooth: critically damped, no overshoot, a soft landing;
 * - snappy: quicker off the mark, settles with ~1% overshoot;
 * - linear: constant speed (for mechanical or looping moves).
 */
const channels = [
  "tilt",
  "turn",
  "roll",
  "zoom",
  "focusX",
  "focusY",
  "x",
  "y",
] as const
type Channel = (typeof channels)[number]
type State = Record<Channel, { p: number; v: number }>

const springs: Record<
  Exclude<EasingName, "linear">,
  { zeta: number; k: number }
> = {
  smooth: { zeta: 1, k: 5.8 },
  snappy: { zeta: 0.82, k: 6 },
}

/** Pose values as spring coordinates (zoom → log zoom) and back. */
const toSpace = (pose: CameraPose): Record<Channel, number> => ({
  ...pose,
  zoom: Math.log(pose.zoom),
})
const fromSpace = (values: Record<Channel, number>): CameraPose => ({
  ...values,
  zoom: Math.exp(values.zoom),
})

type Move = {
  atMs: number
  target: Record<Channel, number>
  durationS: number
  easing: EasingName
}

/** One channel `seconds` into a move from (p, v) toward `target`. */
function step(
  start: { p: number; v: number },
  target: number,
  seconds: number,
  move: Move
) {
  if (move.durationS === 0) return { p: target, v: 0 }
  if (move.easing === "linear") {
    const t = clamp01(seconds / move.durationS)
    const slope = (target - start.p) / move.durationS
    return { p: start.p + (target - start.p) * t, v: t < 1 ? slope : 0 }
  }
  const { zeta, k } = springs[move.easing]
  const omega = k / move.durationS
  const e0 = start.p - target
  const v0 = start.v
  const t = seconds
  if (zeta >= 1) {
    const b = v0 + omega * e0
    const decay = Math.exp(-omega * t)
    return {
      p: target + (e0 + b * t) * decay,
      v: (b - omega * (e0 + b * t)) * decay,
    }
  }
  const wd = omega * Math.sqrt(1 - zeta * zeta)
  const a = e0
  const b = (v0 + zeta * omega * e0) / wd
  const decay = Math.exp(-zeta * omega * t)
  const cos = Math.cos(wd * t)
  const sin = Math.sin(wd * t)
  return {
    p: target + decay * (a * cos + b * sin),
    v:
      decay *
      ((wd * b - zeta * omega * a) * cos - (zeta * omega * b + wd * a) * sin),
  }
}

function advance(state: State, move: Move, seconds: number): State {
  const next = {} as State
  for (const channel of channels) {
    next[channel] = step(state[channel], move.target[channel], seconds, move)
  }
  return next
}

const stateOf = (pose: CameraPose): State => {
  const values = toSpace(pose)
  const state = {} as State
  for (const channel of channels) state[channel] = { p: values[channel], v: 0 }
  return state
}

const poseOf = (state: State): CameraPose => {
  const values = {} as Record<Channel, number>
  for (const channel of channels) values[channel] = state[channel].p
  return fromSpace(values)
}

/** Strongest drift over a whole hold: a gentle push in and around. */
const driftReach = { zoom: 0.1, turn: 5, tilt: 2.5 }

function withDrift(pose: CameraPose, drift: number, progress: number) {
  if (!drift) return pose
  const d = drift * clamp01(progress)
  return {
    ...pose,
    zoom: pose.zoom * (1 + driftReach.zoom * d),
    turn: pose.turn + driftReach.turn * d,
    tilt: pose.tilt + driftReach.tilt * d,
  }
}

/**
 * The camera at any moment of a clip. Before the first shot the camera is
 * flat (after the intro, if any). At each shot's time it moves from
 * wherever it is (even mid-move, keeping its speed) into that shot.
 * Deterministic, so the preview and the rendered video agree.
 */
export function cameraTimeline(
  shots: TimedShot[],
  intro: Presentation["intro"],
  /** The clip's length: how long the last shot holds (for its drift). */
  durationMs = Infinity
): (timeMs: number) => CameraPose {
  const ordered = [...shots].sort((a, b) => a.atMs - b.atMs)

  // The intro is the first move: from its pose into flat.
  const moves: (Move & { drift: number; endMs: number })[] = []
  if (intro.kind !== "none") {
    moves.push({
      atMs: 0,
      target: toSpace(flatPose),
      durationS: intro.durationMs / 1000,
      easing: "smooth",
      drift: 0,
      endMs: ordered[0]?.atMs ?? durationMs,
    })
  }
  ordered.forEach(({ atMs, shot }, i) => {
    moves.push({
      atMs,
      target: toSpace({ ...shot.camera, x: 0, y: 0 }),
      durationS: shot.transitionMs / 1000,
      easing: shot.easing,
      drift: shot.drift,
      endMs: ordered[i + 1]?.atMs ?? durationMs,
    })
  })

  // The camera's state as each move begins, drift included (so the next
  // move starts exactly where the drifting camera was: no jump).
  const initial = stateOf(
    intro.kind === "none" ? flatPose : introPoses[intro.kind]
  )
  const starts: State[] = []
  moves.forEach((move, i) => {
    const previous = moves[i - 1]
    if (!previous) {
      starts[i] = initial
      return
    }
    const seconds = (move.atMs - previous.atMs) / 1000
    const state = advance(starts[i - 1]!, previous, seconds)
    const span = Math.max(1, previous.endMs - previous.atMs)
    const drifted = withDrift(
      poseOf(state),
      previous.drift,
      (move.atMs - previous.atMs) / span
    )
    const values = toSpace(drifted)
    for (const channel of channels) state[channel].p = values[channel]
    starts[i] = state
  })

  return (timeMs) => {
    let index = -1
    for (let i = moves.length - 1; i >= 0; i--) {
      if (moves[i]!.atMs <= timeMs) {
        index = i
        break
      }
    }
    const move = moves[index]
    if (!move) return intro.kind === "none" ? flatPose : poseOf(initial)
    const seconds = (timeMs - move.atMs) / 1000
    const pose = poseOf(advance(starts[index]!, move, seconds))
    const span = Math.max(1, move.endMs - move.atMs)
    return withDrift(pose, move.drift, (timeMs - move.atMs) / span)
  }
}

/**
 * How fast the camera moves at a moment (0 = still, ~1 = a brisk move),
 * from two poses `dtMs` apart. Drives motion blur.
 */
export function cameraSpeed(a: CameraPose, b: CameraPose, dtMs: number) {
  const perSecond = 1000 / Math.max(1, dtMs)
  const angle =
    Math.max(
      Math.abs(b.tilt - a.tilt),
      Math.abs(b.turn - a.turn),
      Math.abs(b.roll - a.roll)
    ) * perSecond
  const zoom = Math.abs(Math.log(b.zoom) - Math.log(a.zoom)) * perSecond
  const pan =
    Math.max(
      Math.abs(b.x - a.x),
      Math.abs(b.y - a.y),
      Math.abs(b.focusX - a.focusX),
      Math.abs(b.focusY - a.focusY)
    ) * perSecond
  // 90°/s, a 2.7× zoom per second or a frame-width pan per second ≈ 1.
  return angle / 90 + zoom + pan
}

/**
 * CSS for the frame at a pose. The stage sets `perspective`; the frame's
 * `transform-origin` is the focus point, so zoom and turns pivot there.
 */
export function cameraStyle(pose: CameraPose) {
  const round = (n: number, digits = 3) => Number(n.toFixed(digits))
  return {
    transform: [
      `translate(${round(pose.x * 100, 2)}%, ${round(pose.y * 100, 2)}%)`,
      `rotateX(${round(pose.tilt, 2)}deg)`,
      `rotateY(${round(pose.turn, 2)}deg)`,
      `rotateZ(${round(pose.roll, 2)}deg)`,
      `scale(${round(pose.zoom)})`,
    ].join(" "),
    transformOrigin: `${round(pose.focusX * 100, 2)}% ${round(pose.focusY * 100, 2)}%`,
  }
}

/** CSS background for the stage. */
export function backgroundStyle(background: Presentation["background"]) {
  return background.kind === "gradient"
    ? `linear-gradient(135deg, ${background.from}, ${background.to})`
    : background.from
}

/**
 * The frame's corner radius as CSS. `radius` is a % of the stage's width,
 * turned into one length (container units) so corners are round. A plain
 * `border-radius: 2%` is a % of width *and* of height separately, which
 * gives stretched, elliptical corners on a wide frame. The stage must be
 * an inline-size container.
 */
export function frameRadiusCss(radius: number) {
  return `${Number(radius.toFixed(2))}cqw`
}

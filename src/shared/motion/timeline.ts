import { flatCamera, introPoses, type CameraPose } from "./presets"
import type { EasingName, Presentation, Shot } from "./schema"

const easings: Record<EasingName, (t: number) => number> = {
  smooth: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  snappy: (t) => (t === 1 ? 1 : 1 - 2 ** (-10 * t)),
  linear: (t) => t,
}

const flatPose: CameraPose = { ...flatCamera, x: 0, y: 0 }
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))

function mix(from: CameraPose, to: CameraPose, t: number): CameraPose {
  const lerp = (a: number, b: number) => a + (b - a) * t
  return {
    tilt: lerp(from.tilt, to.tilt),
    turn: lerp(from.turn, to.turn),
    roll: lerp(from.roll, to.roll),
    zoom: lerp(from.zoom, to.zoom),
    focusX: lerp(from.focusX, to.focusX),
    focusY: lerp(from.focusY, to.focusY),
    x: lerp(from.x, to.x),
    y: lerp(from.y, to.y),
  }
}

export type TimedShot = { atMs: number; shot: Shot }

/**
 * The camera at any moment of a clip. Before the first shot the camera is
 * flat (after the intro, if any). At each shot's time it moves from wherever
 * it was (even mid-move) into that shot over the shot's transition.
 * Deterministic, so the preview and the rendered video agree.
 */
export function cameraTimeline(
  shots: TimedShot[],
  intro: Presentation["intro"]
): (timeMs: number) => CameraPose {
  const ordered = [...shots].sort((a, b) => a.atMs - b.atMs)

  const before = (timeMs: number): CameraPose => {
    if (intro.kind === "none" || timeMs >= intro.durationMs) return flatPose
    const t = easings.smooth(clamp01(timeMs / intro.durationMs))
    return mix(introPoses[intro.kind], flatPose, t)
  }

  // Where each move starts: the camera's pose the moment its shot begins.
  const starts: CameraPose[] = []
  const at = (timeMs: number, upTo: number): CameraPose => {
    for (let i = upTo - 1; i >= 0; i--) {
      const entry = ordered[i]
      const from = starts[i]
      if (!entry || !from || entry.atMs > timeMs) continue
      const { shot } = entry
      const target = { ...shot.camera, x: 0, y: 0 }
      const t =
        shot.transitionMs === 0
          ? 1
          : clamp01((timeMs - entry.atMs) / shot.transitionMs)
      return mix(from, target, easings[shot.easing](t))
    }
    return before(timeMs)
  }
  ordered.forEach((entry, i) => {
    starts[i] = at(entry.atMs, i)
  })

  return (timeMs) => at(timeMs, ordered.length)
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

import { useMemo } from "react"
import {
  AbsoluteFill,
  Html5Video,
  useCurrentFrame,
  useVideoConfig,
} from "remotion"

import {
  backgroundStyle,
  cameraSpeed,
  cameraStyle,
  cameraTimeline,
  flatCamera,
  type Presentation,
  type TimedShot,
} from "@/shared/motion"

/** Frames per second of the stage (footage is converted to 30fps). */
export const stageFps = 30

/** Composition size for each shape, in pixels (what M5 renders). */
export const stageSizes = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
} as const
export type StageShape = keyof typeof stageSizes

export const framesFor = (durationMs: number) =>
  Math.max(1, Math.round((durationMs / 1000) * stageFps))

export type FootageStageProps = {
  videoUrl: string
  posterUrl?: string | null
  presentation: Presentation
  shots: TimedShot[]
  durationMs: number
  /** Show the frame flat (the editor picks a focus point on it). */
  flat?: boolean
  /** Cut between shots instead of moving, and skip the intro. */
  reduceMotion?: boolean
  /** Editor only: a click on the flat frame, in 0–1 of the frame. */
  onPickFocus?: (point: { x: number; y: number }) => void
  /** The video stopped loading (e.g. its signed link expired). */
  onVideoError?: () => void
}

const flatPose = { ...flatCamera, x: 0, y: 0 }

/** Strongest blur, in % of the stage width (about 5px at 1080p). */
const maxBlur = 0.28

/**
 * The screen recording on its stage: background, frame, and the camera
 * moving between shots. The same component plays in the editor (Remotion
 * Player) and renders the final video (M5), so they always match.
 */
export function FootageStage({
  videoUrl,
  posterUrl,
  presentation,
  shots,
  durationMs,
  flat = false,
  reduceMotion = false,
  onPickFocus,
  onVideoError,
}: FootageStageProps) {
  const frameNumber = useCurrentFrame()
  const { fps, width } = useVideoConfig()
  const poseAt = useMemo(
    () =>
      reduceMotion
        ? cameraTimeline(
            shots.map((entry) => ({
              ...entry,
              shot: { ...entry.shot, transitionMs: 0 },
            })),
            { ...presentation.intro, kind: "none" },
            durationMs
          )
        : cameraTimeline(shots, presentation.intro, durationMs),
    [shots, presentation.intro, reduceMotion, durationMs]
  )

  const timeMs = (frameNumber / fps) * 1000
  const pose = flat ? flatPose : poseAt(timeMs)
  const style = cameraStyle(pose)
  // 1% of the stage's width, so every size scales with the composition.
  const unit = width / 100
  const speed =
    flat || reduceMotion || !presentation.motionBlur
      ? 0
      : cameraSpeed(poseAt(timeMs - 1000 / fps), pose, 1000 / fps)
  // Blur only fast moves (a slow drift stays sharp), capped.
  const blur = Math.min(maxBlur, Math.max(0, speed - 0.35) * 0.18) * unit
  const { frame } = presentation

  return (
    <AbsoluteFill
      style={{ background: backgroundStyle(presentation.background) }}
    >
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          perspective: `${140 * unit}px`,
          padding: `${frame.padding * 100}%`,
        }}
      >
        <div
          data-testid="camera-frame"
          className="will-change-transform"
          style={{
            position: "relative",
            width: "100%",
            overflow: "hidden",
            transform: style.transform,
            transformOrigin: style.transformOrigin,
            // One length for both directions: round, not stretched, corners.
            borderRadius: `${frame.radius * unit}px`,
            boxShadow: frame.shadow
              ? `0 ${3 * unit}px ${6 * unit}px ${-1.2 * unit}px rgb(0 0 0 / 0.55)`
              : "none",
            filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
            cursor: flat && onPickFocus ? "crosshair" : undefined,
          }}
          onClick={(event) => {
            if (!flat || !onPickFocus) return
            const box = event.currentTarget.getBoundingClientRect()
            onPickFocus({
              x: Number(((event.clientX - box.left) / box.width).toFixed(3)),
              y: Number(((event.clientY - box.top) / box.height).toFixed(3)),
            })
          }}
        >
          <Html5Video
            src={videoUrl}
            poster={posterUrl ?? undefined}
            muted
            pauseWhenBuffering
            onError={onVideoError}
            style={{ display: "block", width: "100%" }}
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

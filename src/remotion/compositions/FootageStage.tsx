import { useId, useMemo } from "react"
import {
  AbsoluteFill,
  Html5Video,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion"

import {
  backgroundStyle,
  cameraSpeed,
  cameraStyle,
  cameraTimeline,
  depthOfFieldLayers,
  flatCamera,
  outputDuration,
  outputLayout,
  progressiveBlurLayers,
  toOutput,
  type Presentation,
  type TimedShot,
  type Transition,
} from "@/shared/motion"

import {
  defaultStageFonts,
  TextLayer,
  type StageFonts,
} from "../components/TextLayer"

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
  /** The footage's own size (the frame takes its shape). */
  videoWidth: number
  videoHeight: number
  presentation: Presentation
  /** Shots at footage times (moments); mapped onto the ad's timeline. */
  shots: TimedShot[]
  /** The footage's length. */
  durationMs: number
  /** Show the frame flat (the editor picks a focus point on it). */
  flat?: boolean
  /** Cut between shots instead of moving, and skip the intro. */
  reduceMotion?: boolean
  /** Editor only: a click on the flat frame, in 0–1 of the frame. */
  onPickFocus?: (point: { x: number; y: number }) => void
  /** The video stopped loading (e.g. its signed link expired). */
  onVideoError?: () => void
  /** The brand kit's fonts for text, and accent colours (best first). */
  fonts?: StageFonts
  accents?: string[]
}

/** The ad's length for these props (cuts, speed and transitions). */
export const stageDurationMs = (props: {
  presentation: Presentation
  durationMs: number
}) => outputDuration(props.presentation.edit, props.durationMs)

const flatPose = { ...flatCamera, x: 0, y: 0 }

/** Strongest blur, in % of the stage width (about 4px at 1080p). */
const maxBlur = 0.22

const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
const easeInOutQuart = (t: number) =>
  t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2

/**
 * The screen recording on its stage: background, frame, the kept parts of
 * the footage with transitions between them, and the camera moving
 * between shots. The same component plays in the editor (Remotion Player)
 * and renders the final video (M5), so they always match.
 */
export function FootageStage({
  videoUrl,
  posterUrl,
  videoWidth,
  videoHeight,
  presentation,
  shots,
  durationMs,
  flat = false,
  reduceMotion = false,
  onPickFocus,
  onVideoError,
  fonts = defaultStageFonts,
  accents = [],
}: FootageStageProps) {
  const frameNumber = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()
  const { edit } = presentation
  const layout = useMemo(
    () => outputLayout(edit, durationMs),
    [edit, durationMs]
  )
  const poseAt = useMemo(() => {
    // Moments in cut footage drop out; the rest move to ad time.
    const timed = shots.flatMap((entry) => {
      const atMs = toOutput(edit, durationMs, entry.atMs)
      return atMs === null
        ? []
        : [
            {
              atMs,
              shot: reduceMotion
                ? { ...entry.shot, transitionMs: 0 }
                : entry.shot,
            },
          ]
    })
    const intro = reduceMotion
      ? { ...presentation.intro, kind: "none" as const }
      : presentation.intro
    return cameraTimeline(timed, intro, outputDuration(edit, durationMs))
  }, [shots, edit, durationMs, presentation.intro, reduceMotion])

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
  const { frame, lens } = presentation
  // The frame fits inside the padded stage by width and height (CSS
  // padding is a % of the width on all sides).
  const pad = frame.padding * width
  const frameWidth = Math.max(
    1,
    Math.min(
      width - 2 * pad,
      ((height - 2 * pad) * videoWidth) / Math.max(1, videoHeight)
    )
  )
  const frameHeight = (frameWidth * videoHeight) / Math.max(1, videoWidth)
  const perspectivePx = 140 * unit
  const depthLayers =
    lens.depthOfField.enabled && !flat
      ? depthOfFieldLayers({
          pose,
          frameWidth,
          frameHeight,
          stageWidth: width,
          perspectivePx,
          fStop: lens.depthOfField.fStop,
          maxBlur: lens.depthOfField.maxBlur,
        })
      : []
  const edgeBlur = lens.progressiveBlur
  const edgeLayers = edgeBlur.enabled
    ? progressiveBlurLayers({
        from: edgeBlur.from,
        strength: edgeBlur.strength,
        reach: edgeBlur.reach,
        stageWidth: width,
        width: frameWidth,
        height: frameHeight,
      })
    : []

  return (
    <AbsoluteFill
      style={{
        background: backgroundStyle(presentation.background),
        overflow: "hidden",
      }}
    >
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          perspective: `${perspectivePx}px`,
          padding: `${frame.padding * 100}%`,
        }}
      >
        <div
          data-testid="camera-frame"
          className="will-change-transform"
          style={{
            position: "relative",
            width: `${frameWidth}px`,
            height: `${frameHeight}px`,
            flexShrink: 0,
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
            background: "#000",
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
          {layout.map((part, i) => {
            const next = layout[i + 1]
            const from = Math.round((part.outStartMs / 1000) * fps)
            const to = Math.round((part.outEndMs / 1000) * fps)
            return (
              <Sequence
                key={part.startMs}
                from={from}
                durationInFrames={Math.max(1, to - from)}
                // Loads and seeks the next part a second early: no blank
                // frame at a cut.
                premountFor={fps}
              >
                <PartLayer
                  videoUrl={videoUrl}
                  posterUrl={posterUrl}
                  trimBefore={Math.round((part.startMs / 1000) * fps)}
                  speed={part.speed}
                  lengthMs={part.outEndMs - part.outStartMs}
                  enter={
                    i > 0 ? { ...part.transition, durationMs: part.inMs } : null
                  }
                  exit={
                    next ? { ...next.transition, durationMs: next.inMs } : null
                  }
                  irisAt={{ x: pose.focusX, y: pose.focusY }}
                  unit={unit}
                  onVideoError={onVideoError}
                />
              </Sequence>
            )
          })}
          <BlurLayers layers={depthLayers} testId="depth-of-field" />
          <BlurLayers layers={edgeLayers} testId="progressive-blur" />
        </div>
      </AbsoluteFill>
      {!flat && (
        <TextLayer
          items={presentation.texts}
          animation={presentation.textStyle.animation}
          edit={edit}
          durationMs={durationMs}
          fonts={fonts}
          background={presentation.background}
          accents={accents}
        />
      )}
    </AbsoluteFill>
  )
}

/**
 * Stacked blur layers, each blurring what's beneath it where its mask
 * shows (backdrop-filter), so blur can vary smoothly across an area.
 */
function BlurLayers({
  layers,
  testId,
}: {
  layers: { blurPx: number; mask: string }[]
  testId: string
}) {
  if (layers.length === 0) return null
  return (
    <div
      data-testid={testId}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      {layers.map((layer, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            inset: 0,
            backdropFilter: `blur(${layer.blurPx}px)`,
            WebkitBackdropFilter: `blur(${layer.blurPx}px)`,
            maskImage: layer.mask,
            WebkitMaskImage: layer.mask,
          }}
        />
      ))}
    </div>
  )
}

/**
 * One part of the footage inside the frame, styled by the transitions
 * into it (`enter`) and out of it into the next part (`exit`).
 */
function PartLayer({
  videoUrl,
  posterUrl,
  trimBefore,
  speed,
  lengthMs,
  enter,
  exit,
  irisAt,
  unit,
  onVideoError,
}: {
  videoUrl: string
  posterUrl?: string | null
  trimBefore: number
  speed: number
  lengthMs: number
  enter: Transition | null
  exit: Transition | null
  irisAt: { x: number; y: number }
  unit: number
  onVideoError?: () => void
}) {
  const filterId = useId().replace(/:/g, "")
  const localMs = (useCurrentFrame() / stageFps) * 1000
  const inT =
    enter && enter.durationMs > 0 ? clamp01(localMs / enter.durationMs) : 1
  const outT =
    exit && exit.durationMs > 0
      ? clamp01((localMs - (lengthMs - exit.durationMs)) / exit.durationMs)
      : 0
  const look = {
    ...(enter && inT < 1 ? enterStyle(enter, inT, irisAt, unit) : {}),
    ...(exit && outT > 0 ? exitStyle(exit, outT, unit) : {}),
  }
  const whip = look.whipBlur ?? 0

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transform: look.transform,
        opacity: look.opacity,
        clipPath: look.clipPath,
        filter:
          whip > 0.1
            ? `url(#${filterId})`
            : look.blur
              ? `blur(${look.blur.toFixed(2)}px)`
              : undefined,
      }}
    >
      {whip > 0.1 && (
        // A horizontal-only blur: CSS blur() can't blur in one direction.
        <svg width="0" height="0" style={{ position: "absolute" }}>
          <filter id={filterId}>
            <feGaussianBlur stdDeviation={`${whip.toFixed(2)} 0`} />
          </filter>
        </svg>
      )}
      <Html5Video
        src={videoUrl}
        poster={posterUrl ?? undefined}
        muted
        pauseWhenBuffering
        trimBefore={trimBefore}
        playbackRate={speed}
        onError={onVideoError}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
    </div>
  )
}

export type LayerLook = {
  transform?: string
  opacity?: number
  clipPath?: string
  blur?: number
  whipBlur?: number
}

const pushOffset = (direction: Transition["direction"], amount: number) =>
  direction === "left"
    ? `translateX(${amount}%)`
    : direction === "right"
      ? `translateX(${-amount}%)`
      : direction === "up"
        ? `translateY(${amount}%)`
        : `translateY(${-amount}%)`

/** The incoming part at progress `t` (0 → 1). */
export function enterStyle(
  transition: Transition,
  t: number,
  irisAt: { x: number; y: number },
  unit: number
): LayerLook {
  switch (transition.kind) {
    case "push": {
      const e = easeInOutCubic(t)
      return { transform: pushOffset(transition.direction, (1 - e) * 100) }
    }
    case "whip": {
      const e = easeInOutQuart(t)
      return {
        transform: pushOffset(transition.direction, (1 - e) * 100),
        whipBlur: Math.sin(Math.PI * e) * 2.4 * unit,
      }
    }
    case "zoom": {
      const e = easeInOutCubic(t)
      return {
        transform: `scale(${0.88 + 0.12 * e})`,
        opacity: e,
        blur: (1 - e) * 0.4 * unit,
      }
    }
    case "blur": {
      const e = easeInOutCubic(t)
      return { opacity: e, blur: Math.sin(Math.PI * e) * 0.5 * unit }
    }
    case "iris": {
      // A circle opening from where the camera is looking.
      const e = easeInOutCubic(t)
      return {
        clipPath: `circle(${(e * 150).toFixed(2)}% at ${(irisAt.x * 100).toFixed(1)}% ${(irisAt.y * 100).toFixed(1)}%)`,
      }
    }
    default:
      return {}
  }
}

/** The outgoing part at progress `t` (0 → 1) of the next part's entry. */
export function exitStyle(
  transition: Transition,
  t: number,
  unit: number
): LayerLook {
  switch (transition.kind) {
    case "push": {
      const e = easeInOutCubic(t)
      return { transform: pushOffset(transition.direction, -e * 100) }
    }
    case "whip": {
      const e = easeInOutQuart(t)
      return {
        transform: pushOffset(transition.direction, -e * 100),
        whipBlur: Math.sin(Math.PI * e) * 2.4 * unit,
      }
    }
    case "zoom": {
      const e = easeInOutCubic(t)
      return {
        transform: `scale(${1 + 0.35 * e})`,
        blur: e * 0.4 * unit,
      }
    }
    case "blur": {
      const e = easeInOutCubic(t)
      return { blur: Math.sin(Math.PI * e) * 0.5 * unit }
    }
    default:
      return {}
  }
}

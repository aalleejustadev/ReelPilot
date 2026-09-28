import { useId } from "react"
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion"

import {
  projectLayout,
  type Presentation,
  type TimedShot,
  type Transition,
} from "@/shared/motion"

import { defaultStageFonts, type StageFonts } from "../components/TextLayer"
import {
  FootageStage,
  partLook,
  stageDurationMs,
  type LayerLook,
} from "./FootageStage"

export type ProjectStageClip = {
  /** The footage's id (stable while its links are re-signed). */
  id: string
  videoUrl: string
  posterUrl?: string | null
  videoWidth: number
  videoHeight: number
  presentation: Presentation
  shots: TimedShot[]
  durationMs: number
  /** How it comes in from the clip before (ignored on the first). */
  transition: Transition
}

export type ProjectStageProps = {
  clips: ProjectStageClip[]
  fonts?: StageFonts
  accents?: string[]
  logoUrl?: string | null
  brandName?: string
  siteLabel?: string
  reduceMotion?: boolean
  /** The editor's live preview (see FootageStage). */
  preview?: boolean
  playing?: boolean
  onVideoError?: () => void
}

/** Each clip's slot in the project, from its edited length. */
export function projectSlots(clips: ProjectStageClip[]) {
  return projectLayout(
    clips.map((clip) => ({
      lengthMs: stageDurationMs(clip),
      transition: clip.transition,
    }))
  )
}

/** The project's length (clips joined by their transitions). */
export const projectDurationMs = (props: { clips: ProjectStageClip[] }) =>
  projectSlots(props.clips).durationMs

/**
 * A project: its clips one after another, each on its own stage with its
 * own edit (the same FootageStage the clip editor plays), coming in from
 * the one before with a transition — the same transition styles a clip
 * uses between its parts, applied to the whole stage. M5 renders this.
 */
export function ProjectStage({
  clips,
  fonts = defaultStageFonts,
  accents = [],
  logoUrl = null,
  brandName = "",
  siteLabel = "",
  reduceMotion = false,
  preview = false,
  playing = false,
  onVideoError,
}: ProjectStageProps) {
  const frame = useCurrentFrame()
  const { fps, width } = useVideoConfig()
  const timeMs = (frame / fps) * 1000
  const { slots } = projectSlots(clips)
  const unit = width / 100

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {clips.map((clip, i) => {
        const slot = slots[i]!
        const next = slots[i + 1]
        const from = Math.round((slot.startMs / 1000) * fps)
        const to = Math.round((slot.endMs / 1000) * fps)
        const look = partLook(
          {
            outStartMs: slot.startMs,
            outEndMs: slot.endMs,
            enter:
              i > 0 && slot.inMs > 0
                ? { ...clip.transition, durationMs: slot.inMs }
                : null,
            exit:
              next && next.inMs > 0
                ? { ...clips[i + 1]!.transition, durationMs: next.inMs }
                : null,
          },
          timeMs - slot.startMs,
          { x: 0.5, y: 0.5 },
          unit
        )
        const showing = timeMs >= slot.startMs && timeMs < slot.endMs
        return (
          <Sequence
            // Position and footage: the same clip may appear twice.
            key={`${i}-${clip.id}`}
            from={from}
            durationInFrames={Math.max(1, to - from)}
            // The next clip loads and waits at its first frame.
            premountFor={Math.round(1.5 * fps)}
          >
            <ClipLayer look={look}>
              <FootageStage
                {...clip}
                // Only the first clip shows before its video loads; the
                // others load ahead out of sight (a poster there is a
                // wasted, warned-about preload).
                posterUrl={i === 0 ? clip.posterUrl : null}
                reduceMotion={reduceMotion}
                preview={preview}
                playing={playing && showing}
                fonts={fonts}
                accents={accents}
                logoUrl={logoUrl}
                brandName={brandName}
                siteLabel={siteLabel}
                onVideoError={onVideoError}
              />
            </ClipLayer>
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}

/** One clip's whole stage, styled by the transitions into and out of it. */
function ClipLayer({
  look,
  children,
}: {
  look: LayerLook
  children: React.ReactNode
}) {
  const filterId = useId().replace(/:/g, "")
  const whip = look.whipBlur ?? 0
  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
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
        // The whip's horizontal-only blur, as between a clip's parts.
        <svg width="0" height="0" style={{ position: "absolute" }}>
          <filter id={filterId}>
            <feGaussianBlur stdDeviation={`${whip.toFixed(2)} 0`} />
          </filter>
        </svg>
      )}
      {children}
    </AbsoluteFill>
  )
}

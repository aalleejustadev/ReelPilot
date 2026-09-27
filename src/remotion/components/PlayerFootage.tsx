import { useEffect, useId, useRef } from "react"

import type { Transition } from "@/shared/motion"

/**
 * The footage as the editor's preview plays it (Remotion Player only; the
 * render keeps a Sequence per part, which is frame-exact).
 *
 * A new <video> element per part had to load and seek at every cut, and
 * the Player waited for it: over the internet playback stalled at part
 * boundaries (and when a magnifier appeared). Here two persistent video
 * elements take turns — part 1 in slot A, part 2 in B, part 3 in A… —
 * and the idle one waits paused, already seeked to its next part's start,
 * so every cut switches to a ready element. Each element plays natively at
 * its part's speed and is only re-seeked when it drifts; the Player never
 * waits on the network, so a slow link can briefly lag the picture but
 * never freezes playback.
 */
export type PlayerPart = {
  startMs: number
  endMs: number
  outStartMs: number
  outEndMs: number
  speed: number
  enter: Transition | null
  exit: Transition | null
}

type Look = {
  transform?: string
  opacity?: number
  clipPath?: string
  blur?: number
  whipBlur?: number
}

/** Seconds of drift before a playing video is re-seeked. */
const maxDrift = 0.3

function useSyncedVideo(
  ref: React.RefObject<HTMLVideoElement | null>,
  input: {
    /** Where the video should be now, in footage seconds (null = idle). */
    at: number | null
    /** When idle: where to wait for the next part. */
    ready: number | null
    speed: number
    playing: boolean
  }
) {
  useEffect(() => {
    const video = ref.current
    if (!video) return
    const { at, ready, speed, playing } = input
    const seek = (seconds: number, tolerance: number) => {
      if (Math.abs(video.currentTime - seconds) > tolerance && !video.seeking) {
        video.currentTime = seconds
      }
    }
    if (at === null) {
      if (!video.paused) video.pause()
      if (ready !== null) seek(ready, 0.05)
      return
    }
    if (playing) {
      if (video.playbackRate !== speed) video.playbackRate = speed
      seek(at, maxDrift)
      if (video.paused) {
        video.play().catch(() => {
          // A pause interrupted it, or autoplay rules: the next frame retries.
        })
      }
    } else {
      if (!video.paused) video.pause()
      // Paused or scrubbing: show exactly this frame.
      seek(at, 0.02)
    }
  })
}

export function PlayerFootage({
  videoUrl,
  posterUrl,
  parts,
  adMs,
  playing,
  styleFor,
  onVideoError,
}: {
  videoUrl: string
  posterUrl?: string | null
  parts: PlayerPart[]
  adMs: number
  /** The Player is playing forward (reverse and paused seek per frame). */
  playing: boolean
  /** Transition styles for a part at a moment (from the composition). */
  styleFor: (part: PlayerPart, localMs: number) => Look
  onVideoError?: () => void
}) {
  return (
    <>
      {[0, 1].map((slot) => (
        <Slot
          key={slot}
          videoUrl={videoUrl}
          // Only the first slot shows before loading (a poster on the
          // hidden one is a wasted, warned-about preload).
          posterUrl={slot === 0 ? posterUrl : null}
          parts={parts.filter((_, i) => i % 2 === slot)}
          adMs={adMs}
          playing={playing}
          styleFor={styleFor}
          onVideoError={onVideoError}
        />
      ))}
    </>
  )
}

function Slot({
  videoUrl,
  posterUrl,
  parts,
  adMs,
  playing,
  styleFor,
  onVideoError,
}: {
  videoUrl: string
  posterUrl?: string | null
  parts: PlayerPart[]
  adMs: number
  playing: boolean
  styleFor: (part: PlayerPart, localMs: number) => Look
  onVideoError?: () => void
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const filterId = useId().replace(/:/g, "")
  const active = parts.find((p) => adMs >= p.outStartMs && adMs < p.outEndMs)
  const next = parts.find((p) => p.outStartMs > adMs)
  const at = active
    ? (active.startMs + (adMs - active.outStartMs) * active.speed) / 1000
    : null
  useSyncedVideo(ref, {
    at: at === null ? null : Math.min(at, active!.endMs / 1000),
    ready: next ? next.startMs / 1000 : null,
    speed: active?.speed ?? 1,
    playing,
  })
  const look = active ? styleFor(active, adMs - active.outStartMs) : {}
  const whip = look.whipBlur ?? 0
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        // Waiting slots stay loaded but out of sight.
        visibility: active ? "visible" : "hidden",
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
        // The whip's horizontal-only blur, as in the render.
        <svg width="0" height="0" style={{ position: "absolute" }}>
          <filter id={filterId}>
            <feGaussianBlur stdDeviation={`${whip.toFixed(2)} 0`} />
          </filter>
        </svg>
      )}
      <video
        ref={ref}
        src={videoUrl}
        poster={posterUrl ?? undefined}
        muted
        playsInline
        preload="auto"
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

/**
 * The magnifier's footage in the preview: one persistent element synced
 * to the footage time (a fresh one per magnifier stalled like the parts).
 */
export function PlayerMagnifierVideo({
  videoUrl,
  at,
  speed,
  playing,
}: {
  videoUrl: string
  /** Footage seconds now. */
  at: number
  speed: number
  playing: boolean
}) {
  const ref = useRef<HTMLVideoElement>(null)
  useSyncedVideo(ref, { at, ready: null, speed, playing })
  return (
    <video
      ref={ref}
      src={videoUrl}
      muted
      playsInline
      preload="auto"
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        objectFit: "cover",
      }}
    />
  )
}

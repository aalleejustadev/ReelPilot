import { useCallback, useEffect, useId, useRef, useState } from "react"

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

/** A slot's video, as its events last reported it. */
type VideoState = {
  /** Not seeking, with a frame to show. */
  settled: boolean
  /** Its time, in footage seconds. */
  at: number
}

/** How early (ad ms) a part coming in with a transition is staged. */
const stageMs = 150

/** How far (s) a video may be from its moment and still count as there. */
const onTime = 0.5

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
  const [states, setStates] = useState<[VideoState, VideoState]>([
    { settled: false, at: -1 },
    { settled: false, at: -1 },
  ])
  const report = useCallback((slot: number, state: VideoState) => {
    setStates((current) => {
      const before = current[slot]!
      if (before.settled === state.settled && before.at === state.at)
        return current
      const next = [...current] as [VideoState, VideoState]
      next[slot] = state
      return next
    })
  }, [])

  // Parts each video has been seen at its moment in (by start), so it
  // stays in front for the rest of the part: its time is reported only a
  // few times a second, and at 4× it runs well ahead of the last report.
  const [shown, setShown] = useState<[number | null, number | null]>([
    null,
    null,
  ])

  const slots = [0, 1].map((slot) => {
    const own = parts.filter((_, i) => i % 2 === slot)
    const active = own.find((p) => adMs >= p.outStartMs && adMs < p.outEndMs)
    const at = active
      ? Math.min(
          active.startMs + (adMs - active.outStartMs) * active.speed,
          active.endMs
        ) / 1000
      : null
    const state = states[slot]!
    // Showing (about) the right moment: safe to put in front.
    const seenOnTime =
      at !== null && state.settled && Math.abs(state.at - at) < onTime
    return {
      own,
      active,
      at,
      seenOnTime,
      onTime:
        seenOnTime ||
        (active !== undefined && shown[slot] === active.outStartMs),
      settled: state.settled,
    }
  })
  const latch0 = slots[0]!.seenOnTime ? slots[0]!.active!.outStartMs : null
  const latch1 = slots[1]!.seenOnTime ? slots[1]!.active!.outStartMs : null
  // Remember it (React's "adjust state while rendering" pattern).
  if (
    (latch0 !== null && latch0 !== shown[0]) ||
    (latch1 !== null && latch1 !== shown[1])
  ) {
    setShown([latch0 ?? shown[0], latch1 ?? shown[1]])
  }

  /*
   * Both videos stay visible, stacked, instead of hiding the idle one:
   * Chrome paints a video's new frames apart from the page's styles, so a
   * video hidden (or shown) and seeked in the same instant could flash a
   * frame from elsewhere in the ad. The video showing its part's moment is
   * in front; the other waits behind it, so whatever it paints while it
   * seeks to its next part is never seen. If the part that just started
   * isn't at its moment yet, the one before holds its last frame in front
   * until it is (a held frame reads as nothing; a wrong one as a flash).
   * During a transition both are in their part, in document order as
   * before.
   */
  const front = (() => {
    const [a, b] = slots
    // In a transition the incoming part (the later one) is on top.
    if (a!.active && b!.active)
      return a!.active.outStartMs > b!.active.outStartMs ? 0 : 1
    const k = a!.active ? 0 : b!.active ? 1 : null
    if (k === null) return null
    const other = slots[1 - k]!
    // A part about to come in with a transition is staged on top while
    // still invisible, so the transition only changes its opacity:
    // re-stacking a video in the same frame its opacity changes could
    // draw it at full strength for a frame.
    const upNext = other.own.find((p) => p.outStartMs > adMs)
    if (
      upNext?.enter &&
      upNext.enter.kind !== "cut" &&
      upNext.outStartMs - adMs <= stageMs &&
      slots[k]!.onTime
    )
      return 1 - k
    return slots[k]!.onTime || !other.settled ? k : 1 - k
  })()
  // Staged: on top, not yet showing.
  const staged = (i: number) => front === i && !slots[i]!.active

  return (
    // Their own stacking context: the slots' order is between themselves,
    // under the frame's blurs and graphics (which sample them). A z-index
    // makes no backdrop root, so those blurs still see the video.
    <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
      {slots.map((slot, i) => {
        const inFront = front === null || front === i
        const next = slot.own.find((p) => p.outStartMs > adMs)
        return (
          <Slot
            key={i}
            slot={i}
            videoUrl={videoUrl}
            // Only the first slot shows before loading (a poster on the
            // other is a wasted, warned-about preload).
            posterUrl={i === 0 ? posterUrl : null}
            active={slot.active ?? null}
            at={slot.at}
            // Waiting behind: seek ahead only while the other is in front.
            ready={
              !slot.active && next && front !== null && front !== i
                ? next.startMs / 1000
                : null
            }
            z={front === null ? undefined : inFront ? 2 : 1}
            staged={staged(i)}
            adMs={adMs}
            playing={playing}
            styleFor={styleFor}
            onState={report}
            onVideoError={onVideoError}
          />
        )
      })}
    </div>
  )
}

function Slot({
  slot,
  videoUrl,
  posterUrl,
  active,
  at,
  ready,
  z,
  staged,
  adMs,
  playing,
  styleFor,
  onState,
  onVideoError,
}: {
  slot: number
  videoUrl: string
  posterUrl?: string | null
  /** Its part showing now, if any. */
  active: PlayerPart | null
  /** Where its video should be now (footage s), when active. */
  at: number | null
  /** When idle: where to wait for its next part (null = stay put). */
  ready: number | null
  z: number | undefined
  /** On top ahead of its transition, invisible until it starts. */
  staged: boolean
  adMs: number
  playing: boolean
  styleFor: (part: PlayerPart, localMs: number) => Look
  onState: (slot: number, state: VideoState) => void
  onVideoError?: () => void
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const filterId = useId().replace(/:/g, "")
  useSyncedVideo(ref, {
    at,
    ready,
    speed: active?.speed ?? 1,
    playing,
  })
  // Report where the video really is, from its own events.
  useEffect(() => {
    const video = ref.current
    if (!video) return
    const update = () =>
      onState(slot, {
        settled: !video.seeking && video.readyState >= 2,
        at: video.currentTime,
      })
    const events = [
      "seeking",
      "seeked",
      "loadeddata",
      "canplay",
      "playing",
      "waiting",
      "timeupdate",
    ]
    for (const name of events) video.addEventListener(name, update)
    update()
    return () => {
      for (const name of events) video.removeEventListener(name, update)
    }
  }, [slot, onState])
  const look = active ? styleFor(active, adMs - active.outStartMs) : {}
  const whip = look.whipBlur ?? 0
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: z,
        transform: look.transform,
        opacity: staged ? 0 : look.opacity,
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

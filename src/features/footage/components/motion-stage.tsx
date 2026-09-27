"use client"

import { Player, type PlayerRef } from "@remotion/player"
import { CrosshairIcon } from "lucide-react"
import { useEffect, useMemo, useRef } from "react"

import {
  FootageStage,
  framesFor,
  stageFps,
  stageSizes,
  type FootageStageProps,
} from "@/remotion/compositions/FootageStage"
import type { Presentation, TimedShot } from "@/shared/motion"

export const stageAspects = {
  "16:9": "16 / 9",
  "9:16": "9 / 16",
  "1:1": "1 / 1",
} as const
export type StageAspect = keyof typeof stageAspects

/**
 * The clip on its stage, played by Remotion's Player: the same
 * composition (src/remotion) renders the final video, so the preview is
 * what gets rendered. Time and play state are reported to the editor.
 */
export function MotionStage({
  playerRef,
  videoUrl,
  posterUrl,
  presentation,
  shots,
  durationMs,
  aspect,
  reduceMotion,
  pickingFocus,
  onPickFocus,
  onTimeChange,
  onPlayingChange,
  onVideoError,
}: {
  playerRef: React.RefObject<PlayerRef | null>
  videoUrl: string
  posterUrl: string | null
  presentation: Presentation
  shots: TimedShot[]
  /** The clip's length (the composition's length). */
  durationMs: number
  aspect: StageAspect
  reduceMotion: boolean
  /** While true the frame is shown flat and a click sets the focus point. */
  pickingFocus: boolean
  onPickFocus: (point: { x: number; y: number }) => void
  onTimeChange: (ms: number) => void
  onPlayingChange: (playing: boolean) => void
  /** The video stopped loading (e.g. its signed link expired). */
  onVideoError?: () => void
}) {
  const size = stageSizes[aspect]
  // Where playback was, so switching shape (a new Player) keeps the spot.
  const lastFrame = useRef(0)
  const inputProps: FootageStageProps = useMemo(
    () => ({
      videoUrl,
      posterUrl,
      presentation,
      shots,
      durationMs,
      flat: pickingFocus,
      reduceMotion,
      onPickFocus,
      onVideoError,
    }),
    [
      videoUrl,
      posterUrl,
      presentation,
      shots,
      durationMs,
      pickingFocus,
      reduceMotion,
      onPickFocus,
      onVideoError,
    ]
  )

  // Tell the editor the time (only when the tenth of a second changes, so
  // it re-renders 10×/s, not per frame) and whether it's playing.
  useEffect(() => {
    const player = playerRef.current
    if (!player) return
    let lastTenth = -1
    const report = (frame: number) => {
      lastFrame.current = frame
      const ms = (frame / stageFps) * 1000
      const tenth = Math.floor(ms / 100)
      if (tenth === lastTenth) return
      lastTenth = tenth
      onTimeChange(Math.round(ms))
    }
    const onFrame = ({ detail }: { detail: { frame: number } }) =>
      report(detail.frame)
    const onPlay = () => onPlayingChange(true)
    const onStop = () => onPlayingChange(false)
    player.addEventListener("frameupdate", onFrame)
    player.addEventListener("seeked", onFrame)
    player.addEventListener("play", onPlay)
    player.addEventListener("pause", onStop)
    player.addEventListener("ended", onStop)
    report(player.getCurrentFrame())
    return () => {
      player.removeEventListener("frameupdate", onFrame)
      player.removeEventListener("seeked", onFrame)
      player.removeEventListener("play", onPlay)
      player.removeEventListener("pause", onStop)
      player.removeEventListener("ended", onStop)
    }
  }, [playerRef, onTimeChange, onPlayingChange, aspect])

  const { width: w, height: h } = size
  return (
    // The box fills the space it's given; the stage is the largest
    // rectangle of the chosen shape that fits inside (container units).
    <div className="[container-type:size] flex size-full items-center justify-center">
      <div
        className="relative overflow-hidden rounded-lg shadow-sm"
        style={{
          aspectRatio: stageAspects[aspect],
          width: `min(100cqw, calc(100cqh * ${w} / ${h}))`,
        }}
        data-testid="motion-stage"
      >
        <Player
          // A new shape is a new composition size.
          key={aspect}
          ref={playerRef}
          component={FootageStage}
          inputProps={inputProps}
          durationInFrames={framesFor(durationMs)}
          compositionWidth={w}
          compositionHeight={h}
          fps={stageFps}
          // Read once, when a new shape mounts a new Player.
          // eslint-disable-next-line react-hooks/refs
          initialFrame={lastFrame.current}
          controls={false}
          clickToPlay={false}
          doubleClickToFullscreen={false}
          spaceKeyToPlayOrPause={false}
          moveToBeginningWhenEnded={false}
          // The owner reviews Remotion's licence terms (build plan §17).
          acknowledgeRemotionLicense
          style={{ width: "100%", height: "100%" }}
        />
        {pickingFocus && (
          <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
            <span className="flex items-center gap-2 rounded-md bg-foreground/80 px-3 py-1.5 text-sm text-background">
              <CrosshairIcon aria-hidden className="size-4" />
              Click where the camera should focus
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

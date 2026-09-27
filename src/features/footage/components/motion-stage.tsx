"use client"

import { CrosshairIcon } from "lucide-react"
import { useEffect, useMemo, useRef } from "react"

import { cn } from "@/shared/lib/utils"
import {
  backgroundStyle,
  cameraStyle,
  cameraTimeline,
  frameRadiusCss,
  type Presentation,
  type TimedShot,
} from "@/shared/motion"

export const stageAspects = {
  "16:9": "16 / 9",
  "9:16": "9 / 16",
  "1:1": "1 / 1",
} as const
export type StageAspect = keyof typeof stageAspects

/**
 * The clip in 3D over its background. The frame's transform is written
 * straight to the element every animation frame (no React render per
 * frame), from the same camera timeline Remotion will use in M5.
 */
export function MotionStage({
  videoRef,
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
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>
  videoUrl: string
  posterUrl: string | null
  presentation: Presentation
  shots: TimedShot[]
  /** The clip's length, so the last shot's drift runs to the end. */
  durationMs: number
  aspect: StageAspect
  reduceMotion: boolean
  /** While true the frame is shown flat and a click sets the focus point. */
  pickingFocus: boolean
  onPickFocus: (point: { x: number; y: number }) => void
  onTimeChange: (ms: number) => void
  onPlayingChange: (playing: boolean) => void
}) {
  const frameRef = useRef<HTMLDivElement>(null)

  // Reduced motion: shots cut instead of animating, and no intro.
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

  useEffect(() => {
    const video = videoRef.current
    const frame = frameRef.current
    if (!video || !frame) return
    let raf = 0
    // Report the time to React only when the tenth of a second changes.
    let lastTenth = -1
    const draw = () => {
      const ms = video.currentTime * 1000
      const style = pickingFocus
        ? { transform: "none", transformOrigin: "50% 50%" }
        : cameraStyle(poseAt(ms))
      frame.style.transform = style.transform
      frame.style.transformOrigin = style.transformOrigin
      const tenth = Math.floor(ms / 100)
      if (tenth !== lastTenth) {
        lastTenth = tenth
        onTimeChange(Math.round(ms))
      }
    }
    const loop = () => {
      draw()
      raf = requestAnimationFrame(loop)
    }
    const start = () => {
      onPlayingChange(true)
      cancelAnimationFrame(raf)
      loop()
    }
    const stop = () => {
      onPlayingChange(false)
      cancelAnimationFrame(raf)
      draw()
    }
    video.addEventListener("play", start)
    video.addEventListener("pause", stop)
    video.addEventListener("ended", stop)
    video.addEventListener("seeked", draw)
    video.addEventListener("loadedmetadata", draw)
    draw()
    if (!video.paused) start()
    return () => {
      cancelAnimationFrame(raf)
      video.removeEventListener("play", start)
      video.removeEventListener("pause", stop)
      video.removeEventListener("ended", stop)
      video.removeEventListener("seeked", draw)
      video.removeEventListener("loadedmetadata", draw)
    }
  }, [videoRef, poseAt, pickingFocus, onTimeChange, onPlayingChange])

  const { frame } = presentation
  const [w, h] = aspect.split(":").map(Number) as [number, number]
  return (
    // The box fills the space it's given; the stage is the largest
    // rectangle of the chosen shape that fits inside (container units).
    <div className="[container-type:size] flex size-full items-center justify-center">
      <div
        // An inline-size container, so the frame's radius can be a % of
        // the stage's width that stays round (see frameRadiusCss).
        className="[container-type:inline-size] relative overflow-hidden rounded-lg shadow-sm"
        style={{
          aspectRatio: stageAspects[aspect],
          width: `min(100cqw, calc(100cqh * ${w} / ${h}))`,
          background: backgroundStyle(presentation.background),
        }}
        data-testid="motion-stage"
      >
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ perspective: "1400px", padding: `${frame.padding * 100}%` }}
        >
          <div
            ref={frameRef}
            className={cn(
              "relative w-full overflow-hidden will-change-transform",
              pickingFocus && "cursor-crosshair"
            )}
            style={{
              borderRadius: frameRadiusCss(frame.radius),
              boxShadow: frame.shadow
                ? "0 30px 60px -12px rgb(0 0 0 / 0.55)"
                : "none",
            }}
            onClick={(event) => {
              if (!pickingFocus) return
              const box = event.currentTarget.getBoundingClientRect()
              onPickFocus({
                x: Number(((event.clientX - box.left) / box.width).toFixed(3)),
                y: Number(((event.clientY - box.top) / box.height).toFixed(3)),
              })
            }}
          >
            <video
              ref={videoRef}
              src={videoUrl}
              poster={posterUrl ?? undefined}
              playsInline
              preload="metadata"
              className="block w-full"
            >
              Your browser can’t play this video.
            </video>
            {pickingFocus && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-foreground/20 text-background">
                <span className="flex items-center gap-2 rounded-md bg-foreground/80 px-3 py-1.5 text-sm">
                  <CrosshairIcon aria-hidden className="size-4" />
                  Click where the camera should focus
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

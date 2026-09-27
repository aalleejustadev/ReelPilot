"use client"

import { Player, type PlayerRef } from "@remotion/player"
import { CrosshairIcon } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import {
  FootageStage,
  framesFor,
  stageDurationMs,
  stageFps,
  stageSizes,
  type FootageStageProps,
} from "@/remotion/compositions/FootageStage"
import type { StageFonts } from "@/remotion/components/TextLayer"
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
  videoWidth,
  videoHeight,
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
  fonts,
  accents,
  logoUrl,
  brandName,
  siteLabel,
  playbackRate = 1,
  selectedTextId = null,
  onMoveText,
}: {
  playerRef: React.RefObject<PlayerRef | null>
  videoUrl: string
  posterUrl: string | null
  videoWidth: number
  videoHeight: number
  presentation: Presentation
  /** Shots at footage times. */
  shots: TimedShot[]
  /** The footage's length (the ad's comes from the edit). */
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
  fonts: StageFonts
  accents: string[]
  logoUrl: string | null
  brandName: string
  siteLabel: string
  /** −4…4 (J/K/L shuttle); never 0. */
  playbackRate?: number
  /** Text tool: the selected text, which can be dragged on the stage. */
  selectedTextId?: string | null
  onMoveText?: (id: string, point: { x: number; y: number }) => void
}) {
  const size = stageSizes[aspect]
  // Where playback was, so switching shape (a new Player) keeps the spot.
  const lastFrame = useRef(0)
  const inputProps: FootageStageProps = useMemo(
    () => ({
      videoUrl,
      posterUrl,
      videoWidth,
      videoHeight,
      presentation,
      shots,
      durationMs,
      flat: pickingFocus,
      reduceMotion,
      onPickFocus,
      onVideoError,
      fonts,
      accents,
      logoUrl,
      brandName,
      siteLabel,
    }),
    [
      videoUrl,
      posterUrl,
      videoWidth,
      videoHeight,
      presentation,
      shots,
      durationMs,
      pickingFocus,
      reduceMotion,
      onPickFocus,
      onVideoError,
      fonts,
      accents,
      logoUrl,
      brandName,
      siteLabel,
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
  // Reported times are the ad's (after cuts and speed changes).
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
          durationInFrames={framesFor(
            stageDurationMs({ presentation, durationMs })
          )}
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
          playbackRate={playbackRate}
          // The owner reviews Remotion's licence terms (build plan §17).
          acknowledgeRemotionLicense
          style={{ width: "100%", height: "100%" }}
        />
        {selectedTextId && onMoveText && !pickingFocus && (
          <TextDragHandle
            textId={selectedTextId}
            anchor={
              presentation.texts.find((t) => t.id === selectedTextId) ?? null
            }
            onMove={(point) => onMoveText(selectedTextId, point)}
          />
        )}
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

/** Where text snaps to while dragged: safe margins, thirds and centre. */
const snapX = [0.08, 1 / 3, 0.5, 2 / 3, 0.92]
const snapY = [0.12, 1 / 3, 0.5, 2 / 3, 0.88]
const snapTo = (value: number, points: number[]) => {
  const near = points.find((point) => Math.abs(point - value) < 0.02)
  return near === undefined
    ? { value, snapped: null }
    : { value: near, snapped: near }
}

/**
 * A box around the selected text (measured from the stage itself) that
 * drags it, snapping to margins, thirds and the centre with guides.
 */
function TextDragHandle({
  textId,
  anchor,
  onMove,
}: {
  textId: string
  anchor: { x: number; y: number } | null
  onMove: (point: { x: number; y: number }) => void
}) {
  const layerRef = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState<{
    left: number
    top: number
    width: number
    height: number
  } | null>(null)
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({
    x: null,
    y: null,
  })
  const drag = useRef<{
    startX: number
    startY: number
    x: number
    y: number
  } | null>(null)

  // Follow the text as it animates or the playhead moves.
  useEffect(() => {
    let raf = 0
    const measure = () => {
      const layer = layerRef.current
      const stage = layer?.parentElement
      const text = stage?.querySelector<HTMLElement>(
        `[data-text-id="${textId}"]`
      )
      if (layer && stage && text) {
        const s = stage.getBoundingClientRect()
        const t = text.getBoundingClientRect()
        setRect((current) => {
          const next = {
            left: t.left - s.left,
            top: t.top - s.top,
            width: t.width,
            height: t.height,
          }
          return current &&
            Math.abs(current.left - next.left) < 0.5 &&
            Math.abs(current.top - next.top) < 0.5 &&
            Math.abs(current.width - next.width) < 0.5
            ? current
            : next
        })
      } else {
        setRect(null)
      }
      raf = requestAnimationFrame(measure)
    }
    raf = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(raf)
  }, [textId])

  return (
    <div ref={layerRef} className="pointer-events-none absolute inset-0">
      {guides.x !== null && (
        <span
          className="absolute inset-y-0 w-px bg-chroma"
          style={{ left: `${guides.x * 100}%` }}
        />
      )}
      {guides.y !== null && (
        <span
          className="absolute inset-x-0 h-px bg-chroma"
          style={{ top: `${guides.y * 100}%` }}
        />
      )}
      {rect && anchor && (
        <div
          role="presentation"
          title="Drag to move the text"
          className="pointer-events-auto absolute cursor-move touch-none rounded-sm outline-2 outline-offset-4 outline-chroma outline-dashed"
          style={rect}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId)
            drag.current = {
              startX: event.clientX,
              startY: event.clientY,
              x: anchor.x,
              y: anchor.y,
            }
          }}
          onPointerMove={(event) => {
            const current = drag.current
            const stage = layerRef.current?.getBoundingClientRect()
            if (!current || !stage) return
            const x = snapTo(
              Math.min(
                1,
                Math.max(
                  0,
                  current.x + (event.clientX - current.startX) / stage.width
                )
              ),
              snapX
            )
            const y = snapTo(
              Math.min(
                1,
                Math.max(
                  0,
                  current.y + (event.clientY - current.startY) / stage.height
                )
              ),
              snapY
            )
            setGuides({ x: x.snapped, y: y.snapped })
            onMove({
              x: Math.round(x.value * 1000) / 1000,
              y: Math.round(y.value * 1000) / 1000,
            })
          }}
          onPointerUp={(event) => {
            drag.current = null
            setGuides({ x: null, y: null })
            event.currentTarget.releasePointerCapture(event.pointerId)
          }}
        />
      )}
    </div>
  )
}

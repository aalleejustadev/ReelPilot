"use client"

import { useRef } from "react"

import { cn } from "@/shared/lib/utils"

import { formatTimecode } from "../lib/format"

export type TimelineMoment = {
  id: string
  atMs: number
  label: string | null
  source: "AUTO" | "MANUAL"
  /** The shot's name if the moment has one ("Tilt left", "Custom"). */
  shotLabel: string | null
}

const clampPercent = (ms: number, durationMs: number) =>
  Math.min(100, Math.max(0, (ms / durationMs) * 100))

/**
 * Thumbnail strip with a draggable playhead and the key moments, plus a
 * row showing which shot each part of the clip uses. Press or drag
 * anywhere on the strip to move the playhead; the handle is also a
 * keyboard slider (arrows ±0.1s, Shift ±1s, Home/End).
 */
export function ClipTimeline({
  durationMs,
  currentMs,
  thumbnailsUrl,
  stripWidth,
  moments,
  selectedId,
  onSeek,
  onScrubbingChange,
  onSelect,
}: {
  durationMs: number
  currentMs: number
  thumbnailsUrl: string | null
  stripWidth: number
  moments: TimelineMoment[]
  selectedId: string | null
  onSeek: (ms: number) => void
  /** True while the user drags, so playback can pause and resume. */
  onScrubbingChange: (scrubbing: boolean) => void
  onSelect: (id: string) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const msAt = (clientX: number) => {
    const box = trackRef.current?.getBoundingClientRect()
    if (!box || box.width === 0) return 0
    const fraction = Math.min(1, Math.max(0, (clientX - box.left) / box.width))
    return Math.round(fraction * durationMs)
  }

  function startDrag(event: React.PointerEvent) {
    // Moments are buttons of their own; pressing one selects it instead.
    if ((event.target as HTMLElement).closest("[data-moment]")) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragging.current = true
    onScrubbingChange(true)
    onSeek(msAt(event.clientX))
  }

  function drag(event: React.PointerEvent) {
    if (dragging.current) onSeek(msAt(event.clientX))
  }

  function endDrag(event: React.PointerEvent) {
    if (!dragging.current) return
    dragging.current = false
    event.currentTarget.releasePointerCapture(event.pointerId)
    onScrubbingChange(false)
  }

  function onKeyDown(event: React.KeyboardEvent) {
    const step = event.shiftKey ? 1000 : 100
    const next =
      event.key === "ArrowLeft" || event.key === "ArrowDown"
        ? currentMs - step
        : event.key === "ArrowRight" || event.key === "ArrowUp"
          ? currentMs + step
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? durationMs
              : null
    if (next === null) return
    event.preventDefault()
    onSeek(Math.min(durationMs, Math.max(0, next)))
  }

  // Parts of the clip: each shot lasts until the next moment with a shot.
  const withShots = moments
    .filter((moment) => moment.shotLabel)
    .sort((a, b) => a.atMs - b.atMs)
  const parts = withShots.map((moment, index) => ({
    moment,
    endMs: withShots[index + 1]?.atMs ?? durationMs,
  }))
  const playhead = clampPercent(currentMs, durationMs)

  return (
    <div className="flex flex-col gap-1.5">
      <div
        ref={trackRef}
        className="relative h-16 cursor-ew-resize touch-none overflow-hidden rounded-md border bg-muted select-none"
        role="group"
        aria-label="Timeline"
        onPointerDown={startDrag}
        onPointerMove={drag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {thumbnailsUrl && (
          // Signed, short-lived storage URL (see brand-kits LogoField).
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailsUrl}
            alt=""
            draggable={false}
            className="pointer-events-none absolute inset-y-0 left-0 h-full max-w-none"
            style={{ width: `${stripWidth}%` }}
          />
        )}
        {moments.map((moment) => (
          <button
            key={moment.id}
            type="button"
            data-moment
            className="group absolute inset-y-0 z-10 -ml-2.5 flex w-5 cursor-pointer justify-center outline-none"
            // Kept just inside the ends so a moment at 0:00 stays visible.
            style={{
              left: `clamp(0.375rem, ${clampPercent(moment.atMs, durationMs)}%, calc(100% - 0.375rem))`,
            }}
            aria-label={`Select the moment at ${formatTimecode(moment.atMs)}${moment.label ? `, ${moment.label}` : ""}${moment.shotLabel ? ", camera set" : ""}`}
            aria-pressed={moment.id === selectedId}
            onClick={() => onSelect(moment.id)}
          >
            <span
              aria-hidden
              // A light outline keeps the bar visible over any footage.
              className={cn(
                "h-full w-1 rounded-full bg-chroma-strong ring-2 ring-background group-hover:w-1.5 group-focus-visible:w-1.5",
                moment.source === "MANUAL" && "bg-tally-strong",
                moment.id === selectedId && "w-1.5 ring-foreground"
              )}
            />
            {moment.shotLabel && (
              <span
                aria-hidden
                className="absolute bottom-1 size-2.5 rounded-full bg-background ring-2 ring-foreground"
              />
            )}
          </button>
        ))}

        {/* The playhead: a line with a handle you can drag or focus. */}
        <div
          role="slider"
          tabIndex={0}
          aria-label="Playhead"
          aria-valuemin={0}
          aria-valuemax={durationMs}
          aria-valuenow={currentMs}
          aria-valuetext={formatTimecode(currentMs)}
          className="group absolute inset-y-0 z-20 -ml-2 flex w-4 cursor-ew-resize justify-center outline-none"
          // Kept just inside the ends so the handle is never cut off.
          style={{
            left: `clamp(0.5rem, ${playhead}%, calc(100% - 0.5rem))`,
          }}
          onKeyDown={onKeyDown}
        >
          <span
            aria-hidden
            className="h-full w-0.5 bg-foreground ring-1 ring-background"
          />
          <span
            aria-hidden
            className="absolute top-1 size-3.5 rounded-full bg-foreground ring-2 ring-background group-focus-visible:ring-4 group-focus-visible:ring-ring/60"
          />
        </div>
      </div>

      {/* Which shot each part of the clip uses. */}
      <div
        className="relative h-6 overflow-hidden rounded-sm bg-muted"
        aria-hidden
      >
        {parts.length === 0 ? (
          <span className="absolute inset-0 flex items-center px-2 text-xs text-muted-foreground">
            Flat all the way. Pick a shot for a key moment to add camera motion.
          </span>
        ) : (
          parts.map(({ moment, endMs }) => (
            <button
              key={moment.id}
              type="button"
              tabIndex={-1}
              className={cn(
                "absolute inset-y-0 truncate border-l-2 border-foreground/60 bg-secondary px-1.5 text-left text-xs",
                moment.id === selectedId && "bg-chroma-soft font-medium"
              )}
              style={{
                left: `${clampPercent(moment.atMs, durationMs)}%`,
                width: `${clampPercent(endMs - moment.atMs, durationMs)}%`,
              }}
              onClick={() => onSelect(moment.id)}
            >
              {moment.shotLabel}
            </button>
          ))
        )}
      </div>
    </div>
  )
}

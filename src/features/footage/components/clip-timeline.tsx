"use client"

import { useRef, useState } from "react"

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
  onMoveMoment,
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
  /** Drag (or arrow keys on a focused moment) moved it; omit = read-only. */
  onMoveMoment?: (id: string, atMs: number, nudge?: boolean) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  // A moment being dragged: where it started, and where it is now.
  const momentDrag = useRef<{
    id: string
    startX: number
    moved: boolean
  } | null>(null)
  const [dragPreview, setDragPreview] = useState<{
    id: string
    atMs: number
  } | null>(null)
  const justDragged = useRef(false)

  function startMomentDrag(event: React.PointerEvent, id: string) {
    if (!onMoveMoment) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    momentDrag.current = { id, startX: event.clientX, moved: false }
  }

  function dragMoment(event: React.PointerEvent) {
    const drag = momentDrag.current
    if (!drag) return
    // A few pixels of slack, so a click still selects instead of moving.
    if (!drag.moved && Math.abs(event.clientX - drag.startX) < 4) return
    drag.moved = true
    setDragPreview({ id: drag.id, atMs: msAt(event.clientX) })
  }

  function endMomentDrag(event: React.PointerEvent) {
    const drag = momentDrag.current
    momentDrag.current = null
    if (!drag) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    if (drag.moved && onMoveMoment) {
      onMoveMoment(drag.id, msAt(event.clientX))
      justDragged.current = true // swallow the click that follows
    }
    setDragPreview(null)
  }

  function nudgeMoment(event: React.KeyboardEvent, moment: TimelineMoment) {
    if (!onMoveMoment) return
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
    event.preventDefault()
    const step =
      (event.shiftKey ? 1000 : 100) * (event.key === "ArrowLeft" ? -1 : 1)
    onMoveMoment(
      moment.id,
      Math.min(durationMs, Math.max(0, moment.atMs + step)),
      true
    )
  }

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

  // Ruler marks: whole seconds, labelled at a spacing that stays readable.
  const seconds = Math.floor(durationMs / 1000)
  const labelEvery =
    [1, 2, 5, 10, 15, 30, 60].find((n) => seconds / n <= 10) ?? 120

  return (
    <div className="flex flex-col gap-1.5">
      {/* Ruler: second marks and the playhead's handle (press or drag it,
          or anywhere on the ruler, to move the playhead). */}
      <div
        className="relative h-6 cursor-ew-resize touch-none select-none"
        onPointerDown={startDrag}
        onPointerMove={drag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {Array.from({ length: seconds + 1 }, (_, second) => (
          <span
            key={second}
            aria-hidden
            // The first and last labels sit inside the ruler, not half off it.
            className={cn(
              "absolute bottom-0 flex flex-col gap-0.5",
              second === 0
                ? "items-start"
                : second * 1000 >= durationMs - 250
                  ? "-translate-x-full items-end"
                  : "-translate-x-1/2 items-center"
            )}
            style={{ left: `${clampPercent(second * 1000, durationMs)}%` }}
          >
            {second % labelEvery === 0 && (
              <span className="font-mono text-[10px] leading-none text-muted-foreground">
                {Math.floor(second / 60)}:{String(second % 60).padStart(2, "0")}
              </span>
            )}
            <span
              className={cn(
                "w-px bg-border",
                second % labelEvery === 0 ? "h-2" : "h-1"
              )}
            />
          </span>
        ))}
        <div
          role="slider"
          tabIndex={0}
          aria-label="Playhead"
          aria-valuemin={0}
          aria-valuemax={durationMs}
          aria-valuenow={currentMs}
          aria-valuetext={formatTimecode(currentMs)}
          className="group absolute inset-y-0 z-20 -ml-3 flex w-6 cursor-ew-resize items-end justify-center outline-none"
          // Kept just inside the ends so the handle is never cut off.
          style={{ left: `clamp(0.75rem, ${playhead}%, calc(100% - 0.75rem))` }}
          onKeyDown={onKeyDown}
        >
          <span
            aria-hidden
            className="mb-0.5 size-4 rounded-full bg-foreground ring-2 ring-background group-focus-visible:ring-4 group-focus-visible:ring-ring/60"
          />
        </div>
      </div>

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
            className={cn(
              "group absolute inset-y-0 z-10 -ml-3 flex w-6 justify-center outline-none",
              onMoveMoment
                ? "cursor-grab active:cursor-grabbing"
                : "cursor-pointer"
            )}
            // Kept just inside the ends so a moment at 0:00 stays visible.
            style={{
              left: `clamp(0.75rem, ${clampPercent(dragPreview?.id === moment.id ? dragPreview.atMs : moment.atMs, durationMs)}%, calc(100% - 0.75rem))`,
            }}
            aria-label={`Select the moment at ${formatTimecode(moment.atMs)}${moment.label ? `, ${moment.label}` : ""}${moment.shotLabel ? ", camera set" : ""}`}
            aria-pressed={moment.id === selectedId}
            aria-keyshortcuts={
              onMoveMoment ? "ArrowLeft ArrowRight" : undefined
            }
            title={onMoveMoment ? "Drag to move · arrow keys nudge" : undefined}
            onPointerDown={(event) => startMomentDrag(event, moment.id)}
            onPointerMove={dragMoment}
            onPointerUp={endMomentDrag}
            onPointerCancel={endMomentDrag}
            onKeyDown={(event) => nudgeMoment(event, moment)}
            onClick={() => {
              if (justDragged.current) {
                justDragged.current = false
                return
              }
              onSelect(moment.id)
            }}
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
            {dragPreview?.id === moment.id && (
              <span
                aria-hidden
                className="absolute top-1 rounded bg-foreground px-1.5 py-0.5 font-mono text-[11px] text-background"
              >
                {formatTimecode(dragPreview.atMs)}
              </span>
            )}
          </button>
        ))}

        {/* The playhead's line; its handle lives in the ruler above, so
            it never covers a moment. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 z-20 -ml-px w-0.5 bg-foreground ring-1 ring-background"
          style={{ left: `clamp(0.75rem, ${playhead}%, calc(100% - 0.75rem))` }}
        />
      </div>

      {/* Which shot each part of the clip uses. */}
      <div
        className="relative h-6 overflow-hidden rounded-sm bg-muted"
        aria-hidden
      >
        {parts.length === 0 ? (
          <span className="absolute inset-0 truncate px-2 text-xs leading-6 text-muted-foreground">
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

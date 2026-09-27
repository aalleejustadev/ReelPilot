"use client"

import { useRef, useState } from "react"

import { cn } from "@/shared/lib/utils"
import { transitionDefaults, type TimedPart } from "@/shared/motion"

import { formatTimecode } from "../lib/format"
import { dragMime, type DragPayload } from "./layer-control"

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
  idle = [],
  clipParts = [],
  selectedPart = null,
  onSelectPart,
  overlays = [],
  selectedOverlay = null,
  onSelectOverlay,
  onMoveOverlay,
  onResizeOverlay,
  onDropItem,
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
  /** Stretches where nothing changes on screen (from the analysis). */
  idle?: { startMs: number; endMs: number }[]
  /** The footage's parts (cuts, speed, transitions). */
  clipParts?: TimedPart[]
  selectedPart?: number | null
  onSelectPart?: (index: number) => void
  /** Text and graphics on their layers, in footage time. */
  overlays?: OverlayBlock[]
  selectedOverlay?: string | null
  onSelectOverlay?: (id: string) => void
  /** Drag a block in time and between layers; omit = read-only. */
  onMoveOverlay?: (id: string, startMs: number, track: number) => void
  onResizeOverlay?: (id: string, endMs: number) => void
  /** A preset dragged in from a panel, dropped at a time on a layer. */
  onDropItem?: (payload: DragPayload, atMs: number, track: number) => void
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
  const snapTo = [...moments.map((moment) => moment.atMs), currentMs, 0]

  // Ruler marks: whole seconds, labelled at a spacing that stays readable.
  const seconds = Math.floor(durationMs / 1000)
  const labelEvery =
    [1, 2, 5, 10, 15, 30, 60].find((n) => seconds / n <= 10) ?? 120

  const row =
    "grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[4rem_minmax(0,1fr)]"
  const label =
    "truncate text-right text-[11px] font-medium text-muted-foreground"

  return (
    <div className="flex flex-col gap-1.5">
      <div className={row}>
        <span />
        {/* Ruler: second marks and the playhead's handle (press or drag it,
          or anywhere on the ruler, to move the playhead). */}
        <div
          className="relative mx-3 h-6 cursor-ew-resize touch-none select-none"
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
                  {Math.floor(second / 60)}:
                  {String(second % 60).padStart(2, "0")}
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
            style={{ left: `${playhead}%` }}
            onKeyDown={onKeyDown}
          >
            <span
              aria-hidden
              className="mb-0.5 size-4 rounded-full bg-foreground ring-2 ring-background group-focus-visible:ring-4 group-focus-visible:ring-ring/60"
            />
          </div>
        </div>
      </div>

      {/* Layers above the video, highest first: higher ones draw over
          lower ones on the stage, like tracks in a video editor. */}
      <OverlayTracks
        items={overlays}
        selectedId={selectedOverlay}
        durationMs={durationMs}
        snapTo={snapTo}
        rowClass={row}
        labelClass={label}
        onSelect={onSelectOverlay}
        onMove={onMoveOverlay}
        onResize={onResizeOverlay}
        onDrop={onDropItem}
      />

      <div className={row}>
        <span className={label}>Video</span>
        <div
          className="relative h-16 cursor-ew-resize touch-none overflow-hidden rounded-md border bg-muted select-none"
          role="group"
          aria-label="Timeline"
          onPointerDown={startDrag}
          onPointerMove={drag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {/* The time area: 0:00 is exactly its left edge and the clip's end
            its right edge. The 12px on each side leaves room for handles at
            the ends instead of nudging them inward (which shifted 0:00). */}
          <div ref={trackRef} className="absolute inset-x-3 inset-y-0">
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
            {clipParts
              .filter((part) => part.removed)
              .map((part) => (
                <span
                  key={`cut-${part.startMs}`}
                  aria-hidden
                  data-testid="cut-range"
                  className="pointer-events-none absolute inset-y-0 bg-background/75"
                  style={{
                    left: `${clampPercent(part.startMs, durationMs)}%`,
                    width: `${clampPercent(part.endMs - part.startMs, durationMs)}%`,
                  }}
                />
              ))}
            {clipParts.slice(1).map((part) => (
              <span
                key={`split-${part.startMs}`}
                aria-hidden
                className="pointer-events-none absolute inset-y-0 -ml-px w-0.5 bg-background"
                style={{ left: `${clampPercent(part.startMs, durationMs)}%` }}
              />
            ))}
            {idle.map((range) => (
              <span
                key={range.startMs}
                aria-hidden
                data-testid="idle-range"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-1.5 bg-[repeating-linear-gradient(135deg,var(--foreground)_0_2px,var(--background)_2px_5px)] opacity-80"
                style={{
                  left: `${clampPercent(range.startMs, durationMs)}%`,
                  width: `${clampPercent(range.endMs - range.startMs, durationMs)}%`,
                }}
              />
            ))}
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
                style={{
                  left: `${clampPercent(dragPreview?.id === moment.id ? dragPreview.atMs : moment.atMs, durationMs)}%`,
                }}
                aria-label={`Select the moment at ${formatTimecode(moment.atMs)}${moment.label ? `, ${moment.label}` : ""}${moment.shotLabel ? ", camera set" : ""}`}
                aria-pressed={moment.id === selectedId}
                aria-keyshortcuts={
                  onMoveMoment ? "ArrowLeft ArrowRight" : undefined
                }
                title={
                  onMoveMoment ? "Drag to move · arrow keys nudge" : undefined
                }
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
              data-testid="playhead-line"
              className="pointer-events-none absolute inset-y-0 z-20 -ml-px w-0.5 bg-foreground ring-1 ring-background"
              style={{ left: `${playhead}%` }}
            />
          </div>
        </div>
      </div>

      {/* The footage's parts: kept, cut, sped up, and how each comes in. */}
      {clipParts.length > 1 && (
        <div className={row}>
          <span className={label}>Parts</span>
          <div className="relative h-6" aria-hidden>
            <div className="absolute inset-x-3 inset-y-0">
              {clipParts.map((part) => (
                <button
                  key={part.startMs}
                  type="button"
                  tabIndex={-1}
                  className={cn(
                    "absolute inset-y-0 truncate rounded-sm border border-background px-1.5 text-left text-xs",
                    part.removed
                      ? "bg-muted text-muted-foreground line-through"
                      : "bg-secondary",
                    part.index === selectedPart && "ring-2 ring-ring"
                  )}
                  style={{
                    left: `${clampPercent(part.startMs, durationMs)}%`,
                    width: `${clampPercent(part.endMs - part.startMs, durationMs)}%`,
                  }}
                  onClick={() => onSelectPart?.(part.index)}
                >
                  {part.removed
                    ? "Cut"
                    : [
                        part.index > 0 && part.transition.kind !== "cut"
                          ? `↦ ${transitionDefaults[part.transition.kind].label}`
                          : null,
                        part.speed !== 1 ? `${part.speed}×` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || `Part ${part.index + 1}`}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Which shot each part of the clip uses. */}
      <div className={row}>
        <span className={label}>Camera</span>
        <div
          className="relative h-6 overflow-hidden rounded-sm bg-muted"
          aria-hidden
        >
          {parts.length === 0 ? (
            <span className="absolute inset-0 truncate px-2 text-xs leading-6 text-muted-foreground">
              Flat all the way. Pick a shot for a key moment to add camera
              motion.
            </span>
          ) : (
            <div className="absolute inset-x-3 inset-y-0">
              {parts.map(({ moment, endMs }) => (
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
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export type OverlayBlock = {
  id: string
  type: "text" | "graphic"
  track: number
  startMs: number
  endMs: number
  label: string
}

/**
 * The layers above the video. Drag a block to move it in time and up or
 * down a layer, or its right edge to change its length; both snap within
 * 8px to key moments, the playhead and 0:00. Presets dragged in from the
 * panels drop at the time and layer under the pointer; the empty top row
 * starts a new layer.
 */
function OverlayTracks({
  items,
  selectedId,
  durationMs,
  snapTo,
  rowClass,
  labelClass,
  onSelect,
  onMove,
  onResize,
  onDrop,
}: {
  items: OverlayBlock[]
  selectedId: string | null
  durationMs: number
  snapTo: number[]
  rowClass: string
  labelClass: string
  onSelect?: (id: string) => void
  onMove?: (id: string, startMs: number, track: number) => void
  onResize?: (id: string, endMs: number) => void
  onDrop?: (payload: DragPayload, atMs: number, track: number) => void
}) {
  const rowsRef = useRef<HTMLDivElement>(null)
  // Every layer's time area has the same width: any one maps x to time.
  const area = () =>
    rowsRef.current?.querySelector<HTMLElement>("[data-time-area]") ?? null
  const drag = useRef<{
    id: string
    mode: "move" | "resize"
    startX: number
    startY: number
    startMs: number
    endMs: number
    track: number
    moved: boolean
  } | null>(null)
  const [preview, setPreview] = useState<{
    id: string
    startMs: number
    endMs: number
    track: number
  } | null>(null)
  const [dropAt, setDropAt] = useState<{ ms: number; track: number } | null>(
    null
  )

  const top = Math.min(9, Math.max(0, ...items.map((item) => item.track)) + 1)
  const tracks = Array.from({ length: top + 1 }, (_, i) => top - i)
  const msPerPx = () => {
    const width = area()?.getBoundingClientRect().width ?? 0
    return width > 0 ? durationMs / width : 0
  }
  const msAt = (clientX: number) => {
    const box = area()?.getBoundingClientRect()
    if (!box || box.width === 0) return 0
    return Math.round(
      Math.min(1, Math.max(0, (clientX - box.left) / box.width)) * durationMs
    )
  }
  const trackAt = (clientY: number) => {
    const rows = rowsRef.current?.querySelectorAll<HTMLElement>("[data-track]")
    for (const element of rows ?? []) {
      const box = element.getBoundingClientRect()
      if (clientY >= box.top - 2 && clientY <= box.bottom + 2) {
        return Number(element.dataset.track)
      }
    }
    return clientY < (rowsRef.current?.getBoundingClientRect().top ?? 0)
      ? top
      : 0
  }
  const snap = (ms: number) => {
    const tolerance = 8 * msPerPx()
    let best = ms
    let bestGap = tolerance
    for (const point of snapTo) {
      const gap = Math.abs(point - ms)
      if (gap < bestGap) {
        best = point
        bestGap = gap
      }
    }
    return Math.round(best)
  }
  const readPayload = (event: React.DragEvent): DragPayload | null => {
    try {
      return JSON.parse(event.dataTransfer.getData(dragMime)) as DragPayload
    } catch {
      return null
    }
  }

  return (
    <div ref={rowsRef} className="flex flex-col gap-1">
      {tracks.map((track) => {
        const own = items.filter((item) =>
          preview?.id === item.id
            ? preview.track === track
            : item.track === track
        )
        const isNew = track === top
        const isDropTarget = dropAt?.track === track
        return (
          <div key={track} className={rowClass}>
            <span className={labelClass}>
              {isNew && items.length > 0 ? (
                <>
                  <span className="sm:hidden">New</span>
                  <span className="hidden sm:inline">New layer</span>
                </>
              ) : (
                `Layer ${track + 1}`
              )}
            </span>
            <div
              data-track={track}
              className={cn(
                "relative h-7 rounded-sm border border-dashed border-transparent",
                isNew ? "bg-transparent" : "bg-muted/50",
                isDropTarget && "border-ring bg-chroma-soft/60"
              )}
              onDragOver={(event) => {
                if (!onDrop || !event.dataTransfer.types.includes(dragMime))
                  return
                event.preventDefault()
                event.dataTransfer.dropEffect = "copy"
                setDropAt({ ms: snap(msAt(event.clientX)), track })
              }}
              onDragLeave={() => setDropAt(null)}
              onDrop={(event) => {
                const payload = readPayload(event)
                setDropAt(null)
                if (!payload || !onDrop) return
                event.preventDefault()
                onDrop(payload, snap(msAt(event.clientX)), track)
              }}
            >
              <div className="absolute inset-x-3 inset-y-0" data-time-area>
                {items.length === 0 && isNew && (
                  <span className="pointer-events-none absolute inset-0 flex items-center truncate text-xs text-muted-foreground">
                    Drag text or graphics here, or add them from the Text and
                    Graphics tools
                  </span>
                )}
                {isDropTarget && dropAt && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 -ml-px w-0.5 bg-ring"
                    style={{ left: `${clampPercent(dropAt.ms, durationMs)}%` }}
                  />
                )}
                {own.map((item) => {
                  const shown = preview?.id === item.id ? preview : item
                  const start = (
                    event: React.PointerEvent,
                    mode: "move" | "resize"
                  ) => {
                    if (!onMove) return
                    event.stopPropagation()
                    event.currentTarget.setPointerCapture(event.pointerId)
                    drag.current = {
                      id: item.id,
                      mode,
                      startX: event.clientX,
                      startY: event.clientY,
                      startMs: item.startMs,
                      endMs: item.endMs,
                      track: item.track,
                      moved: false,
                    }
                  }
                  const move = (event: React.PointerEvent) => {
                    const current = drag.current
                    if (!current || current.id !== item.id) return
                    const dx = event.clientX - current.startX
                    const dy = event.clientY - current.startY
                    if (!current.moved && Math.hypot(dx, dy) < 4) return
                    current.moved = true
                    const delta = dx * msPerPx()
                    if (current.mode === "move") {
                      const length = current.endMs - current.startMs
                      const startMs = Math.min(
                        durationMs - 100,
                        Math.max(0, snap(current.startMs + delta))
                      )
                      setPreview({
                        id: item.id,
                        startMs,
                        endMs: startMs + length,
                        track: trackAt(event.clientY),
                      })
                    } else {
                      const endMs = Math.min(
                        durationMs,
                        Math.max(
                          current.startMs + 400,
                          snap(current.endMs + delta)
                        )
                      )
                      setPreview({
                        id: item.id,
                        startMs: current.startMs,
                        endMs,
                        track: current.track,
                      })
                    }
                  }
                  const end = (event: React.PointerEvent) => {
                    const current = drag.current
                    drag.current = null
                    if (!current || current.id !== item.id) return
                    event.currentTarget.releasePointerCapture(event.pointerId)
                    const result = preview
                    setPreview(null)
                    if (!current.moved) {
                      onSelect?.(item.id)
                      return
                    }
                    if (!result) return
                    if (current.mode === "move")
                      onMove?.(item.id, result.startMs, result.track)
                    else onResize?.(item.id, result.endMs)
                  }
                  return (
                    <div
                      key={item.id}
                      data-overlay-block={item.id}
                      className={cn(
                        "absolute inset-y-0.5 flex min-w-6 touch-none items-center overflow-hidden rounded-sm border text-xs shadow-xs select-none",
                        item.type === "text"
                          ? "border-border bg-card font-medium"
                          : "border-chroma/40 bg-chroma-soft",
                        onMove
                          ? "cursor-grab active:cursor-grabbing"
                          : "cursor-pointer",
                        item.id === selectedId && "ring-2 ring-ring"
                      )}
                      style={{
                        left: `${clampPercent(shown.startMs, durationMs)}%`,
                        width: `${clampPercent(shown.endMs - shown.startMs, durationMs)}%`,
                      }}
                      title={`${item.label} · drag to move, drag the right edge to resize`}
                      onPointerDown={(event) => start(event, "move")}
                      onPointerMove={move}
                      onPointerUp={end}
                      onPointerCancel={end}
                      onClick={() => !onMove && onSelect?.(item.id)}
                    >
                      <span className="min-w-0 flex-1 truncate px-1.5">
                        {item.label}
                      </span>
                      {onResize && (
                        <span
                          className="h-full w-2 shrink-0 cursor-ew-resize bg-foreground/15 hover:bg-foreground/30"
                          onPointerDown={(event) => start(event, "resize")}
                          onPointerMove={move}
                          onPointerUp={end}
                          onPointerCancel={end}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

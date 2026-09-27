"use client"

import { useRef } from "react"

/** Smallest and largest timeline heights, px (largest: 70% of the window). */
export const timelineMinHeight = 120
const maxShare = 0.7
const keyStep = 24

const clampHeight = (px: number) =>
  Math.round(
    Math.min(
      Math.max(timelineMinHeight, px),
      Math.max(timelineMinHeight, window.innerHeight * maxShare)
    )
  )

/**
 * The timeline's top edge: drag it (or use ↑/↓ while focused) to make the
 * timeline taller or shorter; double-click (or Enter) goes back to fitting
 * every layer.
 */
export function TimelineResizeHandle({
  height,
  current,
  onResize,
}: {
  /** The set height, or null when it fits its content. */
  height: number | null
  /** The timeline's rendered height now, px. */
  current: number
  onResize: (height: number | null) => void
}) {
  const drag = useRef<{ startY: number; startHeight: number } | null>(null)

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize timeline"
      aria-valuenow={Math.round(current)}
      aria-valuemin={timelineMinHeight}
      tabIndex={0}
      title="Drag to resize the timeline · double-click to fit"
      data-testid="timeline-resize"
      className="group flex h-3 shrink-0 cursor-row-resize touch-none items-center justify-center outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      onPointerDown={(event) => {
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        drag.current = { startY: event.clientY, startHeight: current }
      }}
      onPointerMove={(event) => {
        const current = drag.current
        if (!current) return
        // Up makes it taller: the handle is its top edge.
        onResize(
          clampHeight(current.startHeight - (event.clientY - current.startY))
        )
      }}
      onPointerUp={(event) => {
        drag.current = null
        event.currentTarget.releasePointerCapture(event.pointerId)
      }}
      onPointerCancel={() => (drag.current = null)}
      onDoubleClick={() => onResize(null)}
      onKeyDown={(event) => {
        const base = height ?? current
        if (event.key === "ArrowUp") {
          event.preventDefault()
          onResize(clampHeight(base + keyStep))
        } else if (event.key === "ArrowDown") {
          event.preventDefault()
          onResize(clampHeight(base - keyStep))
        } else if (event.key === "Enter" || event.key === "Home") {
          event.preventDefault()
          onResize(null)
        }
      }}
    >
      <span
        aria-hidden
        className="h-1 w-10 rounded-full bg-border transition-colors group-hover:bg-muted-foreground group-focus-visible:bg-muted-foreground"
      />
    </div>
  )
}
